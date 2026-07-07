# Configuration du simulateur IoT

KAFKA_BOOTSTRAP_SERVERS = ["84.8.222.106:9092"]  # Modifiable selon l'environnement de la VM
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
    },
    "vibration": {
        "unit": "mm/s",
        "normal_range": (0.0, 5.0),
        "critical_min": 8.0,
        "manufacturer": "Fluke",
        "model": "VB-805",
        "drift": 0.2,
        "noise_std": 0.08,
    },
    "pression": {
        "unit": "bar",
        "normal_range": (1.0, 10.0),
        "critical_min": 12.0,
        "manufacturer": "Bosch",
        "model": "PR-3000",
        "drift": 0.3,
        "noise_std": 0.07,
    },
    "humidite": {
        "unit": "%",
        "normal_range": (30.0, 70.0),
        "critical_min": 85.0,
        "manufacturer": "Honeywell",
        "model": "HM-40",
        "drift": 1.0,
        "noise_std": 0.25,
    },
    "consommation": {
        "unit": "kW",
        "normal_range": (100.0, 500.0),
        "critical_min": 700.0,
        "manufacturer": "Schneider Electric",
        "model": "PM-5000",
        "drift": 15.0,
        "noise_std": 2.5,
    },
}

# Liste des capteurs simulés actifs
ACTIVE_SENSORS = [
    {"type": "temperature", "id": "sensor_temp_001", "loc": "casablanca_zone_ind", "interval": 1.0},
    {"type": "vibration", "id": "sensor_vib_002", "loc": "tangier_med_zone", "interval": 0.5},
    {"type": "pression", "id": "sensor_pres_003", "loc": "kenitra_industrial_zone", "interval": 2.0},
    {"type": "humidite", "id": "sensor_hum_004", "loc": "stockage_central", "interval": 5.0},
    {"type": "consommation", "id": "sensor_pow_005", "loc": "transformateur_1", "interval": 1.0},
]
