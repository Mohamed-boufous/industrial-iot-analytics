from datetime import datetime, timezone
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

    def get_physical_metrics_stats(self, start_date: str = None, end_date: str = None, device_id: str = None) -> list[dict]:
        """
        Agrégation MongoDB pour calculer les métriques réelles (Moyenne, Min, Max, Nombre de mesures, Alertes)
        pour chacun des 5 types de grandeurs physiques (Température, Humidité, Vibration, Pression, Puissance).
        """
        db = self._get_db()
        query_raw = {}
        query_alerts = {}

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

        # 1. Agrégation sur raw_measurements pour Moyenne, Min, Max
        pipeline_raw = [
            {"$match": query_raw},
            {
                "$group": {
                    "_id": "$device_type",
                    "avg_value": {"$avg": "$value"},
                    "min_value": {"$min": "$value"},
                    "max_value": {"$max": "$value"},
                    "count": {"$sum": 1},
                    "unit": {"$first": "$unit"}
                }
            }
        ]

        raw_stats = list(db[settings.COLLECTION_RAW].aggregate(pipeline_raw))
        raw_dict = {item["_id"]: item for item in raw_stats if item["_id"]}

        # 2. Agrégation sur alerts_history pour le nombre d'alertes par grandeur
        pipeline_alerts = [
            {"$match": query_alerts},
            {
                "$group": {
                    "_id": "$device_type",
                    "alerts_count": {"$sum": 1}
                }
            }
        ]
        alerts_stats = list(db[settings.COLLECTION_ALERTS].aggregate(pipeline_alerts))
        alerts_dict = {item["_id"]: item.get("alerts_count", 0) for item in alerts_stats if item["_id"]}

        # Configuration des métriques physiques supportées
        TYPE_METADATA = {
            "temperature": {"label": "Temperature", "unit": "°C", "icon": "Thermometer", "color": "#ef4444", "bg": "rgba(239, 68, 68, 0.08)"},
            "humidite": {"label": "Humidite", "unit": "%", "icon": "Drop", "color": "#06b6d4", "bg": "rgba(6, 182, 212, 0.08)"},
            "vibration": {"label": "Vibration Mecanique", "unit": "mm/s", "icon": "Activity", "color": "#8b5cf6", "bg": "rgba(139, 92, 246, 0.08)"},
            "pression": {"label": "Pression Hydraulique", "unit": "bar", "icon": "Gauge", "color": "#3b82f6", "bg": "rgba(59, 130, 246, 0.08)"},
            "consommation": {"label": "Puissance Electrique", "unit": "kW", "icon": "Lightning", "color": "#f59e0b", "bg": "rgba(245, 158, 11, 0.08)"}
        }

        results = []
        for type_key, meta in TYPE_METADATA.items():
            raw_info = raw_dict.get(type_key, {})
            avg_v = raw_info.get("avg_value")
            min_v = raw_info.get("min_value")
            max_v = raw_info.get("max_value")
            cnt = raw_info.get("count", 0)
            alt_cnt = alerts_dict.get(type_key, 0)

            results.append({
                "type": type_key,
                "label": meta["label"],
                "unit": meta["unit"],
                "icon": meta["icon"],
                "color": meta["color"],
                "bg": meta["bg"],
                "avg": round(float(avg_v), 2) if avg_v is not None else 0.0,
                "min": round(float(min_v), 2) if min_v is not None else 0.0,
                "max": round(float(max_v), 2) if max_v is not None else 0.0,
                "total_measurements": cnt,
                "total_alerts": alt_cnt
            })

        return results

    def get_alerts_by_location(self, start_date: str = None, end_date: str = None, device_id: str = None) -> list[dict]:
        """
        Agrégation MongoDB pour la cartographie des incidents par emplacement géographique / serre (location).
        """
        db = self._get_db()
        query_alerts = {}

        if device_id and device_id != "ALL":
            query_alerts["device_id"] = device_id

        if start_date or end_date:
            time_query = {}
            if start_date:
                time_query["$gte"] = start_date
            if end_date:
                time_query["$lte"] = end_date
            query_alerts["timestamp"] = time_query

        # Mapping canonique des emplacements vers les villes / régions d'exploitation AzurA
        LOCATION_TO_CITY = {
            "agadir_serre_1": "Agadir",
            "agadir_chambre_froide_2": "Agadir",
            "agadir_station_pompage": "Agadir",
            "agadir_reseau_principal": "Agadir",
            "agadir_entrepot_central": "Agadir",
            "groupe_secours_agadir": "Agadir",
            "transformateur_general": "Agadir",
            "stockage_legumes_ch1": "Agadir",
            "stockage_legumes_ch2": "Agadir",
            "zone_pompage_nord": "Agadir",
            "conditionnement_chambre_2": "Agadir",
            "dakhla_station_emballage": "Dakhla",
            "dakhla_dessalement_p1": "Dakhla",
            "station_solaire_dakhla": "Dakhla",
            "tangier_med_hub": "Tanger Med",
            "casablanca_logistique": "Casablanca",
            "kenitra_station_filtrage": "Kenitra"
        }

        ALL_CITIES = ["Agadir", "Dakhla", "Tanger Med", "Casablanca", "Kenitra"]

        pipeline = [
            {"$match": query_alerts},
            {
                "$group": {
                    "_id": "$location",
                    "count": {"$sum": 1}
                }
            }
        ]

        raw_locs = list(db[settings.COLLECTION_ALERTS].aggregate(pipeline))
        city_counts = {city: 0 for city in ALL_CITIES}

        for item in raw_locs:
            loc_id = str(item.get("_id") or "").lower().strip()
            cnt = item.get("count", 0)
            
            # Détermination de la ville
            resolved_city = LOCATION_TO_CITY.get(loc_id)
            if not resolved_city:
                if "agadir" in loc_id or "serre" in loc_id or "stockage" in loc_id or "transformateur" in loc_id:
                    resolved_city = "Agadir"
                elif "dakhla" in loc_id:
                    resolved_city = "Dakhla"
                elif "tang" in loc_id:
                    resolved_city = "Tanger Med"
                elif "casa" in loc_id:
                    resolved_city = "Casablanca"
                elif "kenitra" in loc_id:
                    resolved_city = "Kenitra"
                else:
                    resolved_city = "Agadir"

            city_counts[resolved_city] = city_counts.get(resolved_city, 0) + cnt

        total_alerts = sum(city_counts.values())
        results = []
        for city, cnt in city_counts.items():
            pct = round((cnt / total_alerts * 100), 1) if total_alerts > 0 else 0.0
            results.append({
                "location_id": city.lower().replace(" ", "_"),
                "label": city,
                "count": cnt,
                "percentage": pct
            })

        # Trier par nombre d'incidents décroissant
        results.sort(key=lambda x: x["count"], reverse=True)
        return results

    def get_critical_battery_sensors(self, start_date: str = None, end_date: str = None, device_id: str = None, limit: int = 5) -> list[dict]:
        """
        Agrégation MongoDB pour identifier les 5 capteurs les plus critiques en termes de niveau de batterie restant.
        """
        db = self._get_db()
        query_raw = {}

        if device_id and device_id != "ALL":
            query_raw["device_id"] = device_id

        if start_date or end_date:
            time_query = {}
            if start_date:
                time_query["$gte"] = start_date
            if end_date:
                time_query["$lte"] = end_date
            query_raw["timestamp"] = time_query

        LOCATION_LABELS = {
            "tangier_med_hub": "Hub Logistique Tanger Med",
            "agadir_entrepot_central": "Entrepot Central (Agadir)",
            "transformateur_general": "Transformateur General",
            "station_solaire_dakhla": "Station Solaire Dakhla",
            "agadir_serre_1": "Serre Maraichere 1 (Agadir)",
            "stockage_legumes_ch1": "Chambre Stockage Legumes 1",
            "zone_pompage_nord": "Station Pompage Nord",
            "conditionnement_chambre_2": "Chambre Conditionnement 2"
        }

        TYPE_LABELS = {
            "temperature": "Temperature",
            "humidite": "Humidite",
            "vibration": "Vibration Mecanique",
            "pression": "Pression Hydraulique",
            "consommation": "Puissance Electrique"
        }

        pipeline = [
            {"$match": query_raw},
            {"$sort": {"timestamp": DESCENDING}},
            {
                "$group": {
                    "_id": "$device_id",
                    "latest_battery": {"$first": "$battery_level"},
                    "device_type": {"$first": "$device_type"},
                    "location": {"$first": "$location"},
                    "last_seen": {"$first": "$timestamp"},
                    "signal_strength": {"$first": "$signal_strength"}
                }
            },
            {"$sort": {"latest_battery": 1}},  # Plus faible batterie en premier
            {"$limit": limit}
        ]

        raw_items = list(db[settings.COLLECTION_RAW].aggregate(pipeline))
        results = []

        for item in raw_items:
            b_val = item.get("latest_battery")
            battery_pct = round(float(b_val), 1) if b_val is not None else 100.0
            
            # Classification d'état
            if battery_pct < 20.0:
                health_status = "CRITIQUE"
                health_color = "#dc2626"
            elif battery_pct < 50.0:
                health_status = "ATTENTION"
                health_color = "#f59e0b"
            else:
                health_status = "BON"
                health_color = "#2563eb"

            loc_raw = item.get("location", "")
            type_raw = item.get("device_type", "")

            results.append({
                "device_id": item.get("_id"),
                "device_type": TYPE_LABELS.get(type_raw, type_raw),
                "location": LOCATION_LABELS.get(loc_raw, loc_raw),
                "battery_level": battery_pct,
                "signal_strength": item.get("signal_strength", -50),
                "last_seen": item.get("last_seen", ""),
                "status": health_status,
                "status_color": health_color
            })

        return results

    def get_system_thresholds(self) -> dict:
        """
        Récupère les seuils de surveillance système depuis la collection MongoDB 'system_configuration'.
        Si la configuration n'existe pas encore, elle est automatiquement initialisée avec les valeurs par défaut.
        """
        db = self._get_db()
        config_doc = db[settings.COLLECTION_CONFIG].find_one({"_id": "thresholds_config"})

        if not config_doc:
            default_config = {
                "_id": "thresholds_config",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "thresholds": DEFAULT_THRESHOLDS
            }
            db[settings.COLLECTION_CONFIG].insert_one(default_config)
            return DEFAULT_THRESHOLDS

        return config_doc.get("thresholds", DEFAULT_THRESHOLDS)

    def update_system_thresholds(self, updated_thresholds: dict) -> dict:
        """
        Met à jour les seuils de surveillance dans MongoDB.
        """
        db = self._get_db()
        current_thresholds = self.get_system_thresholds()

        for key, vals in updated_thresholds.items():
            if key in current_thresholds:
                if "min" in vals:
                    current_thresholds[key]["min"] = float(vals["min"])
                if "max" in vals:
                    current_thresholds[key]["max"] = float(vals["max"])

        update_doc = {
            "$set": {
                "thresholds": current_thresholds,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
        db[settings.COLLECTION_CONFIG].update_one({"_id": "thresholds_config"}, update_doc, upsert=True)
        return current_thresholds

    def reset_system_thresholds(self) -> dict:
        """
        Réinitialise tous les seuils aux valeurs d'usine par défaut.
        """
        db = self._get_db()
        update_doc = {
            "$set": {
                "thresholds": DEFAULT_THRESHOLDS,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
        db[settings.COLLECTION_CONFIG].update_one({"_id": "thresholds_config"}, update_doc, upsert=True)
        return DEFAULT_THRESHOLDS


DEFAULT_THRESHOLDS = {
    "temperature": {
        "key": "temperature",
        "label": "Temperature",
        "unit": "°C",
        "min": 5.0,
        "max": 80.0,
        "step": 0.5,
        "standard_reference": "Norme IEC 60034-1 (Machines)",
        "danger_low_description": "Risque de gel / froid critique (< 5°C)",
        "danger_high_description": "Surchauffe machine / risque incendie (> 80°C)"
    },
    "vibration": {
        "key": "vibration",
        "label": "Vibration Mecanique",
        "unit": "mm/s",
        "min": 0.0,
        "max": 5.0,
        "step": 0.1,
        "standard_reference": "Norme ISO 10816-3 (Rotors & Pompes)",
        "danger_low_description": "Fonctionnement nominal stable (0 mm/s)",
        "danger_high_description": "Desequilibre rotor / risque de casse (> 5.0 mm/s)"
    },
    "pression": {
        "key": "pression",
        "label": "Pression Hydraulique",
        "unit": "bar",
        "min": 1.0,
        "max": 10.0,
        "step": 0.1,
        "standard_reference": "Norme Hydraulique ISO 4413",
        "danger_low_description": "Fuite de fluide / cavitation pompes (< 1.0 bar)",
        "danger_high_description": "Surpression / risque explosion conduite (> 10.0 bar)"
    },
    "humidite": {
        "key": "humidite",
        "label": "Humidite",
        "unit": "%",
        "min": 30.0,
        "max": 70.0,
        "step": 1.0,
        "standard_reference": "Stockage Agricole & Maraicher",
        "danger_low_description": "Secheresse extreme / electricite statique (< 30%)",
        "danger_high_description": "Humidite excessive / moisissures & corrosion (> 70%)"
    },
    "consommation": {
        "key": "consommation",
        "label": "Puissance Electrique",
        "unit": "kW",
        "min": 100.0,
        "max": 500.0,
        "step": 5.0,
        "standard_reference": "Transformateurs & Reseau MT",
        "danger_low_description": "Arret anormal d equipement (< 100 kW)",
        "danger_high_description": "Surcharge reseau electrique (> 500 kW)"
    },
    "battery": {
        "key": "battery",
        "label": "Batterie Capteur",
        "unit": "%",
        "min": 20.0,
        "max": 100.0,
        "step": 1.0,
        "standard_reference": "IoT Power Safety Standard",
        "danger_low_description": "Batterie critique (< 20%) - Remplacement urgent",
        "danger_high_description": "Charge maximale nominale (100%)"
    }
}


mongo_service = MongoService()


