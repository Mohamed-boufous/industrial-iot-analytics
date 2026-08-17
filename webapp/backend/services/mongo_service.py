from pymongo import MongoClient, DESCENDING
from config import settings

class MongoService:
    """
    Service d'interaction avec le cluster MongoDB Sharded d'AzurA.
    Fournit les données historiques et les agrégations pour les dashboards.
    """
    def __init__(self):
        self.client = None
        self.db = None

    def _get_db(self):
        if self.db is None:
            self.client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
            self.db = self.client[settings.MONGO_DB_NAME]
        return self.db

    def get_global_kpis(self) -> dict:
        """Calcule les KPIs globaux : total lectures, total alertes, etc."""
        db = self._get_db()
        total_raw = db[settings.COLLECTION_RAW].estimated_document_count()
        
        # Agrégation des status dans raw_measurements (si présent) ou comptage simple
        return {
            "total_raw_measurements": total_raw,
            "monitored_sensors_count": 15,
            "active_locations_count": 5
        }

    def get_alerts_by_type(self) -> list[dict]:
        """Retourne le nombre d'alertes groupées par type de statut depuis la collection alerts_history."""
        db = self._get_db()
        pipeline = [
            {"$match": {"status": {"$exists": True, "$ne": None, "$nin": ["NORMAL"]}}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"count": DESCENDING}}
        ]
        results = list(db[settings.COLLECTION_ALERTS].aggregate(pipeline))
        return [{"status": r["_id"], "count": r["count"]} for r in results]

    def get_top_problematic_sensors(self, limit: int = 5) -> list[dict]:
        """Retourne les capteurs ayant généré le plus d'alertes depuis la collection alerts_history."""
        db = self._get_db()
        pipeline = [
            {"$match": {"status": {"$exists": True, "$ne": None, "$nin": ["NORMAL"]}}},
            {"$group": {
                "_id": "$device_id",
                "device_type": {"$first": "$device_type"},
                "location": {"$first": "$location"},
                "alert_count": {"$sum": 1}
            }},
            {"$sort": {"alert_count": DESCENDING}},
            {"$limit": limit}
        ]
        results = list(db[settings.COLLECTION_ALERTS].aggregate(pipeline))
        return [
            {
                "device_id": r["_id"],
                "device_type": r.get("device_type", "INCONNU"),
                "location": r.get("location", "AZURA_SITE"),
                "alert_count": r["alert_count"]
            }
            for r in results
        ]

    def get_sensor_history(self, device_id: str, limit: int = 60) -> list[dict]:
        """Retourne l'historique récent d'un capteur spécifique pour le graphique."""
        db = self._get_db()
        docs = db[settings.COLLECTION_RAW].find(
            {"device_id": device_id},
            {"_id": 0, "timestamp": 1, "value": 1, "unit": 1, "status": 1}
        ).sort("timestamp", DESCENDING).limit(limit)
        
        history = list(docs)
        history.reverse() # Remet dans l'ordre chronologique
        return history

    def get_all_sensors_recent_history(self, limit_per_sensor: int = 60) -> dict[str, list[dict]]:
        """
        Retourne l'historique récent des mesures pour chacun des 15 capteurs depuis raw_measurements.
        Permet de remplir l'axe temporel X immédiatement dès le chargement ou refresh de la page.
        """
        db = self._get_db()
        history = {}
        all_sensor_ids = [
            "sensor_temp_001", "sensor_temp_002", "sensor_temp_003",
            "sensor_vib_001", "sensor_vib_002", "sensor_vib_003",
            "sensor_pres_001", "sensor_pres_002", "sensor_pres_003",
            "sensor_hum_001", "sensor_hum_002", "sensor_hum_003",
            "sensor_pow_001", "sensor_pow_002", "sensor_pow_003"
        ]
        
        for dev_id in all_sensor_ids:
            try:
                docs = list(db[settings.COLLECTION_RAW].find(
                    {"device_id": dev_id},
                    {"_id": 0, "device_id": 1, "device_type": 1, "location": 1, "timestamp": 1, "value": 1, "unit": 1, "status": 1}
                ).sort("timestamp", DESCENDING).limit(limit_per_sensor))
                
                docs.reverse()
                if docs:
                    history[dev_id] = docs
            except Exception:
                pass
                
        return history

    def get_recent_alerts(self, limit: int = 100) -> list[dict]:
        """Retourne les alertes les plus récentes depuis la collection alerts_history."""
        db = self._get_db()
        docs = db[settings.COLLECTION_ALERTS].find({}, {"_id": 0}).sort("timestamp", DESCENDING).limit(limit)
        return list(docs)

    def get_filtered_kpis(self, start_date: str = None, end_date: str = None, device_id: str = None) -> dict:
        """Calcule les KPIs globaux filtrés par plage temporelle et par capteur."""
        db = self._get_db()
        query_raw = {}
        query_alerts = {"status": {"$exists": True, "$ne": None, "$nin": ["NORMAL"]}}

        if device_id and device_id != "ALL":
            query_raw["device_id"] = device_id
            query_alerts["device_id"] = device_id

        if start_date or end_date:
            time_query = {}
            if start_date:
                time_query["$gte"] = start_date
            if end_date:
                time_query["$lte"] = end_date
            query_raw["timestamp"] = time_query
            query_alerts["timestamp"] = time_query

        total_raw = db[settings.COLLECTION_RAW].count_documents(query_raw)
        total_alerts = db[settings.COLLECTION_ALERTS].count_documents(query_alerts)

        # Calcul du taux de conformité
        compliance_rate = 100.0
        if total_raw > 0:
            compliance_rate = max(0.0, round(((total_raw - total_alerts) / total_raw) * 100, 1))

        # Identification du capteur le plus instable
        top_sensor = "Aucun"
        top_pipeline = [
            {"$match": query_alerts},
            {"$group": {"_id": "$device_id", "count": {"$sum": 1}}},
            {"$sort": {"count": DESCENDING}},
            {"$limit": 1}
        ]
        top_res = list(db[settings.COLLECTION_ALERTS].aggregate(top_pipeline))
        if top_res:
            top_sensor = f"{top_res[0]['_id']} ({top_res[0]['count']} incidents)"

        return {
            "total_raw_measurements": total_raw,
            "total_alerts": total_alerts,
            "compliance_rate": compliance_rate,
            "top_problematic_sensor": top_sensor,
            "monitored_sensors_count": 15
        }

    def get_filtered_alerts(self, start_date: str = None, end_date: str = None, device_id: str = None, limit: int = 200) -> list[dict]:
        """Retourne les alertes filtrées depuis alerts_history."""
        db = self._get_db()
        query = {}

        if device_id and device_id != "ALL":
            query["device_id"] = device_id

        if start_date or end_date:
            time_query = {}
            if start_date:
                time_query["$gte"] = start_date
            if end_date:
                time_query["$lte"] = end_date
            query["timestamp"] = time_query

        docs = db[settings.COLLECTION_ALERTS].find(query, {"_id": 0}).sort("timestamp", DESCENDING).limit(limit)
        return list(docs)

    def get_filtered_raw_measurements(self, start_date: str = None, end_date: str = None, device_id: str = None, limit: int = 300) -> list[dict]:
        """Retourne les mesures brutes filtrées depuis raw_measurements."""
        db = self._get_db()
        query = {}

        if device_id and device_id != "ALL":
            query["device_id"] = device_id

        if start_date or end_date:
            time_query = {}
            if start_date:
                time_query["$gte"] = start_date
            if end_date:
                time_query["$lte"] = end_date
            query["timestamp"] = time_query

        docs = db[settings.COLLECTION_RAW].find(query, {"_id": 0}).sort("timestamp", DESCENDING).limit(limit)
        res = list(docs)
        res.reverse()
        return res

mongo_service = MongoService()
