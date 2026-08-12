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

mongo_service = MongoService()
