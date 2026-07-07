import json
import random
import time
from datetime import datetime, timezone
from faker import Faker

fake = Faker("fr_FR")

SENSOR_PROFILES = {
    "temperature": {
        "unit": "°C",
        "interval": 1.0,
        "normal_range": (20.0, 80.0),
        "critical_min": 90.0,
        "manufacturer": "Siemens Maroc",
        "model": "TH-200X",
        "drift": 0.5,       # Variation physique max par étape
        "noise": 0.1,       # Petit bruit de mesure
    },
    "vibration": {
        "unit": "mm/s",
        "interval": 0.5,
        "normal_range": (0.0, 5.0),
        "critical_min": 8.0,
        "manufacturer": "Fluke",
        "model": "VB-805",
        "drift": 0.2,
        "noise": 0.05,
    },
    "pression": {
        "unit": "bar",
        "interval": 2.0,
        "normal_range": (1.0, 10.0),
        "critical_min": 12.0,
        "manufacturer": "Bosch",
        "model": "PR-3000",
        "drift": 0.3,
        "noise": 0.05,
    },
    "humidite": {
        "unit": "%",
        "interval": 5.0,
        "normal_range": (30.0, 70.0),
        "critical_min": 85.0,
        "manufacturer": "Honeywell",
        "model": "HM-40",
        "drift": 1.0,
        "noise": 0.2,
    },
    "consommation": {
        "unit": "kW",
        "interval": 1.0,
        "normal_range": (100.0, 500.0),
        "critical_min": 700.0,
        "manufacturer": "Schneider Electric",
        "model": "PM-5000",
        "drift": 15.0,
        "noise": 2.0,
    },
}

# Dictionnaire global pour stocker l'état interne continu de chaque capteur
SENSOR_STATES = {}

def initialize_sensor_states(active_sensors):
    """Initialise l'état physique initial et persistant des capteurs."""
    for sensor in active_sensors:
        s_id = sensor["id"]
        s_type = sensor["type"]
        profile = SENSOR_PROFILES[s_type]
        
        # On démarre au milieu de la plage normale
        low, high = profile["normal_range"]
        initial_value = (low + high) / 2.0
        
        SENSOR_STATES[s_id] = {
            "current_value": initial_value,
            "failure_remaining_steps": 0,  # Nombre de pas de temps où la panne va persister
            "battery_level": round(random.uniform(85.0, 100.0), 1),
            "calibration_date": fake.date_between(start_date="-1y", end_date="today").strftime("%Y-%m-%d")
        }

def generate_sensor_data(sensor_type, device_id, location):
    profile = SENSOR_PROFILES[sensor_type]
    state = SENSOR_STATES[device_id]
    
    # 1. Gestion de la décharge batterie réaliste (lente diminution)
    state["battery_level"] = max(0.0, round(state["battery_level"] - 0.001, 3))
    
    # 2. Déclenchement d'une panne persistante (0.2% de chance à chaque pas)
    if state["failure_remaining_steps"] == 0:
        if random.random() < 0.002:
            state["failure_remaining_steps"] = random.randint(5, 15)  # La panne dure entre 5 et 15 cycles

    # 3. Calcul de la valeur physique continue
    if state["failure_remaining_steps"] > 0:
        # Mode Panne : La valeur dérive fortement vers le haut ou reste instable au-dessus du critique
        drift_direction = 1.5 * profile["drift"]
        state["current_value"] += drift_direction + random.uniform(-profile["noise"], profile["noise"])
        
        # Plafonner la valeur haute en anomalie
        max_anomaly = profile["critical_min"] * 1.2
        if state["current_value"] > max_anomaly:
            state["current_value"] = max_anomaly
            
        status = "critical"
        quality_score = round(random.uniform(0.70, 0.82), 2)
        state["failure_remaining_steps"] -= 1
    else:
        # Mode Normal : Evolution par marche aléatoire (valeur précédente + petite variation)
        change = random.uniform(-profile["drift"], profile["drift"])
        state["current_value"] += change + random.uniform(-profile["noise"], profile["noise"])
        
        # Forcer le retour vers la plage normale si dérive trop forte (stabilisateur physique)
        low, high = profile["normal_range"]
        if state["current_value"] < low:
            state["current_value"] = low + abs(change)
        elif state["current_value"] > high:
            state["current_value"] = high - abs(change)
            
        status = "normal"
        quality_score = round(random.uniform(0.96, 1.0), 2)

    # 4. Horodatage ISO 8601 UTC correct (Remplacement de utcnow obsolète)
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    payload = {
        "device_id": device_id,
        "device_type": sensor_type,
        "location": location,
        "timestamp": current_time,
        "value": round(state["current_value"], 1),
        "unit": profile["unit"],
        "status": status,
        "metadata": {
            "manufacturer": profile["manufacturer"],
            "model": profile["model"],
            "firmware_version": "2.1.4",
            "calibration_date": state["calibration_date"],
        },
        "quality_score": quality_score,
        "battery_level": round(state["battery_level"], 1),
        "signal_strength": random.randint(-65, -45) if status == "normal" else random.randint(-85, -70),
    }

    return payload

def run_simulator():
    active_sensors = [
        {"type": "temperature", "id": "sensor_temp_001", "loc": "casablanca_zone_ind"},
        {"type": "vibration", "id": "sensor_vib_002", "loc": "tangier_med_zone"},
        {"type": "pression", "id": "sensor_pres_003", "loc": "kenitra_industrial_zone"},
        {"type": "humidite", "id": "sensor_hum_004", "loc": "stockage_central"},
        {"type": "consommation", "id": "sensor_pow_005", "loc": "transformateur_1"},
    ]

    # Initialisation de la mémoire des capteurs
    initialize_sensor_states(active_sensors)
    
    last_sent_time = {sensor["id"]: 0.0 for sensor in active_sensors}

    print("--- Démarrage du Simulateur IoT Réaliste (Pour ML) ---")

    try:
        while True:
            current_now = time.time()

            for sensor in active_sensors:
                sensor_id = sensor["id"]
                sensor_type = sensor["type"]
                interval_required = SENSOR_PROFILES[sensor_type]["interval"]

                if current_now - last_sent_time[sensor_id] >= interval_required:
                    data = generate_sensor_data(sensor_type, sensor_id, sensor["loc"])
                    json_output = json.dumps(data, indent=2, ensure_ascii=False)
                    print(json_output)
                    print("-" * 40)

                    last_sent_time[sensor_id] = current_now

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n--- Simulateur Arrêté ---")

if __name__ == "__main__":
    run_simulator()
