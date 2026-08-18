import os

# Configuration du simulateur IoT

KAFKA_BROKERS_ENV = os.environ.get("KAFKA_BROKERS", "84.8.222.106:9092")
KAFKA_BOOTSTRAP_SERVERS = [b.strip() for b in KAFKA_BROKERS_ENV.split(",")]  # Modifiable selon l'environnement de la VM ou Docker
KAFKA_TOPIC = "iot-raw-data"
ANOMALY_RATE = 0.10  # 10% d'anomalies contrôlées

# Profils physiques des capteurs
SENSOR_PROFILES = {
    "temperature": {
        "unit": "°C",
        "normal_range": (20.0, 80.0),
        "critical_min": 90.0,
        "manufacturer": "Siemens Maroc",
        "model": "TH-200X",
        "drift": 0.5,           # Dérive physique maximale par étape
        "noise_std": 0.15,      # Écart-type pour le bruit gaussien
        "fault_floor": -20.0,   # Borne minimale physique lors d'une panne
        "fault_ceiling": 150.0, # Borne maximale physique lors d'une panne (surchauffe)
    },
    "vibration": {
        "unit": "mm/s",
        "normal_range": (0.0, 5.0),
        "critical_min": 8.0,
        "manufacturer": "Fluke",
        "model": "VB-805",
        "drift": 0.2,
        "noise_std": 0.08,
        "fault_floor": 0.0,
        "fault_ceiling": 25.0,
    },
    "pression": {
        "unit": "bar",
        "normal_range": (1.0, 10.0),
        "critical_min": 12.0,
        "manufacturer": "Bosch",
        "model": "PR-3000",
        "drift": 0.3,
        "noise_std": 0.07,
        "fault_floor": 0.0,
        "fault_ceiling": 30.0,
    },
    "humidite": {
        "unit": "%",
        "normal_range": (30.0, 70.0),
        "critical_min": 85.0,
        "manufacturer": "Honeywell",
        "model": "HM-40",
        "drift": 1.0,
        "noise_std": 0.25,
        "fault_floor": 0.0,
        "fault_ceiling": 100.0,
    },
    "consommation": {
        "unit": "kW",
        "normal_range": (100.0, 500.0),
        "critical_min": 700.0,
        "manufacturer": "Schneider Electric",
        "model": "PM-5000",
        "drift": 15.0,
        "noise_std": 2.5,
        "fault_floor": 0.0,
        "fault_ceiling": 2000.0,
    },
}

# Liste des capteurs simulés actifs (15 capteurs : 3 par type)
# Cadence optimisée et fluide : 1 envoi toutes les 1.0s à 1.2s pour chaque capteur
ACTIVE_SENSORS = [
    # ── Température (Chambres froides & Serres AzurA) ──
    {"type": "temperature", "id": "sensor_temp_001", "loc": "agadir_serre_1",          "interval": 1.0},
    {"type": "temperature", "id": "sensor_temp_002", "loc": "agadir_chambre_froide_2",  "interval": 1.0},
    {"type": "temperature", "id": "sensor_temp_003", "loc": "dakhla_station_emballage", "interval": 1.2},

    # ── Vibration (Moteurs & Pompes d'irrigation) ──
    {"type": "vibration",   "id": "sensor_vib_001",  "loc": "agadir_station_pompage",   "interval": 1.0},
    {"type": "vibration",   "id": "sensor_vib_002",  "loc": "tangier_med_hub",          "interval": 1.0},
    {"type": "vibration",   "id": "sensor_vib_003",  "loc": "casablanca_logistique",    "interval": 1.2},

    # ── Pression (Conduites d'eau & Réseau hydraulique) ──
    {"type": "pression",    "id": "sensor_pres_001", "loc": "agadir_reseau_principal",  "interval": 1.0},
    {"type": "pression",    "id": "sensor_pres_002", "loc": "kenitra_station_filtrage", "interval": 1.0},
    {"type": "pression",    "id": "sensor_pres_003", "loc": "dakhla_dessalement_p1",    "interval": 1.2},

    # ── Humidité (Entrepôts de stockage des récoltes) ──
    {"type": "humidite",    "id": "sensor_hum_001",  "loc": "agadir_entrepot_central",  "interval": 1.0},
    {"type": "humidite",    "id": "sensor_hum_002",  "loc": "stockage_legumes_ch1",     "interval": 1.2},
    {"type": "humidite",    "id": "sensor_hum_003",  "loc": "stockage_legumes_ch2",     "interval": 1.2},

    # ── Consommation électrique (Transformateurs & Groupes électrogènes) ──
    {"type": "consommation", "id": "sensor_pow_001",  "loc": "transformateur_general",   "interval": 1.0},
    {"type": "consommation", "id": "sensor_pow_002",  "loc": "groupe_secours_agadir",    "interval": 1.0},
    {"type": "consommation", "id": "sensor_pow_003",  "loc": "station_solaire_dakhla",   "interval": 1.2},
]

