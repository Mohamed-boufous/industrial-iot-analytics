import os

# Configuration du simulateur IoT

KAFKA_BROKERS_ENV = os.environ.get("KAFKA_BROKERS", "localhost:9092")
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

# Dictionnaire geographique des 4 zones AzurA (Polygones a 4 points pour la cartographie)
ZONE_GEOLOCATIONS = {
    # ── Zone 1 : Agadir (Serres agricoles Souss) ──
    "agadir_serre_1": {
        "city": "Agadir",
        "region": "Souss-Massa",
        "center": {"lat": 30.2825, "lng": -9.5050},
        "polygon": [
            {"lat": 30.2850, "lng": -9.5200},
            {"lat": 30.2950, "lng": -9.5050},
            {"lat": 30.2800, "lng": -9.4900},
            {"lat": 30.2700, "lng": -9.5050}
        ]
    },
    
    # ── Zone 2 : Dakhla (Station d'emballage & conditionnement) ──
    "dakhla_station_emballage": {
        "city": "Dakhla",
        "region": "Dakhla-Oued Ed-Dahab",
        "center": {"lat": 23.7125, "lng": -15.9200},
        "polygon": [
            {"lat": 23.7150, "lng": -15.9350},
            {"lat": 23.7250, "lng": -15.9200},
            {"lat": 23.7100, "lng": -15.9050},
            {"lat": 23.7000, "lng": -15.9200}
        ]
    },
    
    # ── Zone 3 : Kenitra (Station de filtrage et reseau hydraulique) ──
    "kenitra_station_filtrage": {
        "city": "Kenitra",
        "region": "Rabat-Sale-Kenitra",
        "center": {"lat": 34.2525, "lng": -6.5700},
        "polygon": [
            {"lat": 34.2550, "lng": -6.5850},
            {"lat": 34.2650, "lng": -6.5700},
            {"lat": 34.2500, "lng": -6.5550},
            {"lat": 34.2400, "lng": -6.5700}
        ]
    },
    
    # ── Zone 4 : Tanger Med (Hub logistique export) ──
    "tangier_med_hub": {
        "city": "Tanger Med",
        "region": "Tanger-Tetouan-Al Hoceima",
        "center": {"lat": 35.8825, "lng": -5.5000},
        "polygon": [
            {"lat": 35.8850, "lng": -5.5150},
            {"lat": 35.8950, "lng": -5.5000},
            {"lat": 35.8800, "lng": -5.4850},
            {"lat": 35.8700, "lng": -5.5000}
        ]
    }
}

# Liste des 20 capteurs simules actifs (4 zones x 5 types = 20 capteurs, cadence 2.0s)
# Chaque capteur dispose de ses coordonnees GPS exactes (latitude Y, longitude X) situees dans le polygone de sa zone
ACTIVE_SENSORS = [
    # ── ZONE 1 : agadir_serre_1 (Agadir, Souss-Massa) ──
    {"type": "temperature",  "id": "sensor_temp_001", "loc": "agadir_serre_1",          "latitude": 30.2840, "longitude": -9.5070, "interval": 2.0},
    {"type": "vibration",    "id": "sensor_vib_001",  "loc": "agadir_serre_1",          "latitude": 30.2810, "longitude": -9.5020, "interval": 2.0},
    {"type": "pression",     "id": "sensor_pres_001", "loc": "agadir_serre_1",          "latitude": 30.2860, "longitude": -9.5040, "interval": 2.0},
    {"type": "humidite",     "id": "sensor_hum_001",  "loc": "agadir_serre_1",          "latitude": 30.2790, "longitude": -9.5080, "interval": 2.0},
    {"type": "consommation", "id": "sensor_pow_001",  "loc": "agadir_serre_1",          "latitude": 30.2830, "longitude": -9.4980, "interval": 2.0},

    # ── ZONE 2 : dakhla_station_emballage (Dakhla, Oued Ed-Dahab) ──
    {"type": "temperature",  "id": "sensor_temp_002", "loc": "dakhla_station_emballage", "latitude": 23.7140, "longitude": -15.9220, "interval": 2.0},
    {"type": "vibration",    "id": "sensor_vib_002",  "loc": "dakhla_station_emballage", "latitude": 23.7110, "longitude": -15.9170, "interval": 2.0},
    {"type": "pression",     "id": "sensor_pres_002", "loc": "dakhla_station_emballage", "latitude": 23.7160, "longitude": -15.9190, "interval": 2.0},
    {"type": "humidite",     "id": "sensor_hum_002",  "loc": "dakhla_station_emballage", "latitude": 23.7090, "longitude": -15.9230, "interval": 2.0},
    {"type": "consommation", "id": "sensor_pow_002",  "loc": "dakhla_station_emballage", "latitude": 23.7130, "longitude": -15.9130, "interval": 2.0},

    # ── ZONE 3 : kenitra_station_filtrage (Kenitra, Rabat-Sale-Kenitra) ──
    {"type": "temperature",  "id": "sensor_temp_003", "loc": "kenitra_station_filtrage", "latitude": 34.2540, "longitude": -6.5720, "interval": 2.0},
    {"type": "vibration",    "id": "sensor_vib_003",  "loc": "kenitra_station_filtrage", "latitude": 34.2510, "longitude": -6.5670, "interval": 2.0},
    {"type": "pression",     "id": "sensor_pres_003", "loc": "kenitra_station_filtrage", "latitude": 34.2560, "longitude": -6.5690, "interval": 2.0},
    {"type": "humidite",     "id": "sensor_hum_003",  "loc": "kenitra_station_filtrage", "latitude": 34.2490, "longitude": -6.5730, "interval": 2.0},
    {"type": "consommation", "id": "sensor_pow_003",  "loc": "kenitra_station_filtrage", "latitude": 34.2530, "longitude": -6.5630, "interval": 2.0},

    # ── ZONE 4 : tangier_med_hub (Tanger Med, Hub Export) ──
    {"type": "temperature",  "id": "sensor_temp_004", "loc": "tangier_med_hub",          "latitude": 35.8840, "longitude": -5.5020, "interval": 2.0},
    {"type": "vibration",    "id": "sensor_vib_004",  "loc": "tangier_med_hub",          "latitude": 35.8810, "longitude": -5.4970, "interval": 2.0},
    {"type": "pression",     "id": "sensor_pres_004", "loc": "tangier_med_hub",          "latitude": 35.8860, "longitude": -5.4990, "interval": 2.0},
    {"type": "humidite",     "id": "sensor_hum_004",  "loc": "tangier_med_hub",          "latitude": 35.8790, "longitude": -5.5030, "interval": 2.0},
    {"type": "consommation", "id": "sensor_pow_004",  "loc": "tangier_med_hub",          "latitude": 35.8830, "longitude": -5.4930, "interval": 2.0},
]



