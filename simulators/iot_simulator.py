import json
import random
import time
from datetime import datetime, timezone, timedelta, date

import os
import sys
# Ajout du dossier racine au PATH pour faciliter les imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Assurer l'encodage UTF-8 sur la sortie standard pour éviter les caractères brisés (ex: °C)
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

from simulators.config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC, ANOMALY_RATE, SENSOR_PROFILES, ACTIVE_SENSORS
from simulators.schemas import SensorReading, SensorMetadata

class IoTSimulator:
    def __init__(self):
        self.active_sensors = ACTIVE_SENSORS
        self.profiles = SENSOR_PROFILES
        self.anomaly_rate = ANOMALY_RATE
        self.states = {}
        self._initialize_sensor_states()
        
        # Initialisation facultative de Kafka
        self.producer = None
        try:
            from confluent_kafka import Producer
            self.producer = Producer({
                'bootstrap.servers': ','.join(KAFKA_BOOTSTRAP_SERVERS),
                'client.id': 'iot-simulator-producer'
            })
            print(f"[*] Connecté à Kafka sur {KAFKA_BOOTSTRAP_SERVERS}")
        except Exception as e:
            print(f"[-] Kafka n'est pas disponible en local, mode standalone (print) activé. (Détail: {e})")

    def _initialize_sensor_states(self):
        for sensor in self.active_sensors:
            s_id = sensor["id"]
            s_type = sensor["type"]
            profile = self.profiles[s_type]
            low, high = profile["normal_range"]
            initial_value = (low + high) / 2.0
            
            # Génération d'une date de calibration aléatoire dans l'année passée
            random_days = random.randint(0, 365)
            cal_date = (date.today() - timedelta(days=random_days)).strftime("%Y-%m-%d")
            
            self.states[s_id] = {
                "current_value": initial_value,
                "battery_level": round(random.uniform(85.0, 100.0), 1),
                "calibration_date": cal_date
            }

    def generate_reading(self, sensor_id: str, sensor_type: str) -> float:
        """Génère une lecture physique continue réaliste avec bruit gaussien."""
        state = self.states[sensor_id]
        profile = self.profiles[sensor_type]
        
        # Evolution par marche aléatoire
        drift_val = random.uniform(-profile["drift"], profile["drift"])
        # Bruit gaussien avec écart-type noise_std
        noise = random.gauss(0, profile["noise_std"])
        
        new_value = state["current_value"] + drift_val + noise
        
        # Régulation : forcer le retour vers la plage normale si dérive excessive
        low, high = profile["normal_range"]
        if new_value < low:
            new_value = low + abs(drift_val)
        elif new_value > high:
            new_value = high - abs(drift_val)
            
        state["current_value"] = new_value
        return new_value

    def inject_anomaly(self, sensor_type: str, value: float) -> float:
        """Injecte une valeur physiquement anormale (10% du temps) pour simuler des pannes réelles.
        
        NOTE ARCHITECTURALE : Le simulateur génère uniquement la VALEUR brute, même anormale.
        La détection et le label ('critique', 'normal') sont de la responsabilité de Spark.
        """
        profile = self.profiles[sensor_type]
        
        # 10% de chance d'injecter une valeur hors-norme
        if random.random() < self.anomaly_rate:
            direction = random.choice([1, -1])
            anomaly_value = profile["critical_min"] + random.uniform(2.0, 15.0)
            if direction == -1:
                anomaly_value = (profile["normal_range"][0] - random.uniform(5.0, 20.0))
            return round(anomaly_value, 2)
        
        return round(value, 2)

    def produce_to_kafka(self, reading: SensorReading):
        """Envoie la lecture validée par Pydantic sur le topic Kafka ou l'affiche dans la console."""
        payload = reading.model_dump()
        json_payload = json.dumps(payload, ensure_ascii=False)
        
        if self.producer:
            try:
                self.producer.produce(
                    KAFKA_TOPIC, 
                    key=reading.device_id, 
                    value=json_payload.encode('utf-8')
                )
                self.producer.flush()
                print(f"[✓ Kafka] {reading.device_id} -> {reading.value} {reading.unit}")
            except Exception as e:
                print(f"[-] Erreur de publication Kafka: {e}")
                print(f"[Fallback Console] {json_payload}")
        else:
            print(f"[Console Output] {json_payload}\n")

    def run(self):
        print(f"--- Démarrage du Simulateur IoT (Taux d'anomalies: {self.anomaly_rate * 100}%) ---")
        last_sent_time = {sensor["id"]: 0.0 for sensor in self.active_sensors}
        
        try:
            while True:
                current_now = time.time()
                for sensor in self.active_sensors:
                    sensor_id = sensor["id"]
                    sensor_type = sensor["type"]
                    interval = sensor["interval"]
                    loc = sensor["loc"]
                    profile = self.profiles[sensor_type]
                    
                    if current_now - last_sent_time[sensor_id] >= interval:
                        state = self.states[sensor_id]
                        # Décharge batterie réaliste
                        state["battery_level"] = max(0.0, round(state["battery_level"] - 0.005, 3))
                        
                        # Génération de la valeur brute
                        raw_val = self.generate_reading(sensor_id, sensor_type)
                        
                        # Injection éventuelle d'une valeur physiquement anormale
                        # Spark sera responsable de décider si c'est une alerte
                        val = self.inject_anomaly(sensor_type, raw_val)
                        
                        # Le score qualité reflète la qualité du signal réseau uniquement
                        quality_score = round(random.uniform(0.90, 1.0), 2)
                        sig_strength = random.randint(-65, -45)
                            
                        current_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                        
                        # Validation via Pydantic — status supprimé, sera calculé par Spark
                        reading_obj = SensorReading(
                            device_id=sensor_id,
                            device_type=sensor_type,
                            location=loc,
                            timestamp=current_time,
                            value=val,
                            unit=profile["unit"],
                            metadata=SensorMetadata(
                                manufacturer=profile["manufacturer"],
                                model=profile["model"],
                                firmware_version="2.1.4",
                                calibration_date=state["calibration_date"]
                            ),
                            quality_score=quality_score,
                            battery_level=round(state["battery_level"], 1),
                            signal_strength=sig_strength
                        )
                        
                        # Publication
                        self.produce_to_kafka(reading_obj)
                        
                        last_sent_time[sensor_id] = current_now
                        
                time.sleep(0.05)
        except KeyboardInterrupt:
            print("\n--- Simulateur Arrêté ---")

if __name__ == "__main__":
    sim = IoTSimulator()
    sim.run()
