import json
import random
import time
from datetime import datetime, timezone, timedelta, date

import os
import sys
# Ajout du dossier racine au PATH pour faciliter les imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Assurer l'encodage UTF-8 et forcer le flush automatique (line_buffering)
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
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
        self.start_time = time.time()
        self.fault_scenarios = {}
        
        self._initialize_sensor_states()
        self._setup_fault_scenarios()
        
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

    def _setup_fault_scenarios(self):
        """Configure le scénario temporel accéléré :
        - 4 capteurs choisis au hasard parmi les 15.
        - Pannes déclenchées aléatoirement entre 1 min (60s) et 2 min (120s).
        - 2 pannes TEMPORAIRES : arrêtent de dériver et reviennent à la normale à t = 3 min (180s).
        - 2 pannes PERMANENTES : continuent de dériver indéfiniment.
        """
        all_ids = [s["id"] for s in self.active_sensors]
        selected_fault_ids = random.sample(all_ids, 4)
        
        temp_fault_ids = selected_fault_ids[:2]   # 2 pannes temporaires
        perm_fault_ids = selected_fault_ids[2:]   # 2 pannes permanentes
        
        for s_id in selected_fault_ids:
            # Déclenchement échelonné entre 1 minute (60s) et 2 minutes (120s)
            start_delay = random.uniform(60.0, 120.0)
            is_temporary = s_id in temp_fault_ids
            
            self.fault_scenarios[s_id] = {
                "start_delay": start_delay,
                "is_temporary": is_temporary,
                "end_time": 180.0 if is_temporary else float('inf'), # Max 3 min (180s)
                "direction": random.choice([1, -1])  # 1 = surchauffe/surpression, -1 = sous-pression/gel
            }
        
        print("\n" + "="*70)
        print("  [SCÉNARIO TEMPOREL CONFIGURÉ (1 à 3 min)]")
        print("  - t = 0s à 60s (0-1 min) : Tous les capteurs sont 100% NORMAUX")
        for s_id, sc in self.fault_scenarios.items():
            kind = "TEMPORAIRE (résolue à t = 3 min)" if sc["is_temporary"] else "PERMANENTE (nécessite intervention)"
            print(f"  - Capteur {s_id} : Panne {kind} déclenchée à t = {round(sc['start_delay'])}s")
        print("="*70 + "\n")


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
        noise = random.gauss(0, profile["noise_std"])
        
        new_value = state["current_value"] + drift_val + noise
        
        # Vérifier si le capteur est actuellement en phase de panne active
        is_in_active_fault = False
        if sensor_id in self.fault_scenarios:
            sc = self.fault_scenarios[sensor_id]
            elapsed = time.time() - self.start_time
            if sc["start_delay"] <= elapsed:
                if not sc["is_temporary"] or elapsed <= sc["end_time"]:
                    is_in_active_fault = True
        
        # Régulation : forcer le retour vers la plage normale si pas en panne active
        if not is_in_active_fault:
            low, high = profile["normal_range"]
            if new_value < low:
                new_value = low + abs(drift_val)
            elif new_value > high:
                new_value = high - abs(drift_val)
            
        state["current_value"] = new_value
        return new_value

    def inject_anomaly(self, sensor_id: str, sensor_type: str, value: float) -> float:
        """Simule la dérive de panne en fonction du temps écoulé depuis le lancement."""
        if sensor_id not in self.fault_scenarios:
            return round(value, 2)
            
        scenario = self.fault_scenarios[sensor_id]
        elapsed = time.time() - self.start_time
        
        # Phase 1 : Avant le déclenchement de la panne (0 à start_delay) ➔ NORMAL
        if elapsed < scenario["start_delay"]:
            return round(value, 2)
            
        state = self.states[sensor_id]
        profile = self.profiles[sensor_type]
        direction = scenario["direction"]
        low, high = profile["normal_range"]
        
        # Phase 2 : Pendant la panne (entre start_delay et end_time) ➔ DÉRIVE ANORMALE
        if elapsed <= scenario["end_time"]:
            increment = profile["drift"] * 2.5 * direction
            state["current_value"] = state["current_value"] + increment
            return round(state["current_value"], 2)
            
        # Phase 3 : Après end_time pour les pannes TEMPORAIRES ➔ RETOUR IMMÉDIAT ET MAINTIEN À LA NORMALE
        if scenario["is_temporary"]:
            normal_target = (low + high) / 2.0
            if state["current_value"] > high or state["current_value"] < low:
                state["current_value"] = normal_target
            return round(state["current_value"], 2)
            
        return round(state["current_value"], 2)



    def _delivery_report(self, err, msg):
        """Callback appelé automatiquement par librdkafka quand le message est confirmé."""
        if err is not None:
            print(f"[-] Échec d'envoi Kafka: {err}")
        else:
            key_str = msg.key().decode('utf-8') if msg.key() else "N/A"
            print(f"[✓ Kafka] {key_str} transmis au topic '{msg.topic()}' [Partition {msg.partition()}]")
        sys.stdout.flush()

    def produce_to_kafka(self, reading: SensorReading):
        """Envoie la lecture validée par Pydantic sur le topic Kafka."""
        payload = reading.model_dump()
        json_payload = json.dumps(payload, ensure_ascii=False)
        
        if self.producer:
            try:
                self.producer.produce(
                    KAFKA_TOPIC, 
                    key=reading.device_id.encode('utf-8'), 
                    value=json_payload.encode('utf-8'),
                    on_delivery=self._delivery_report
                )
                # Servir les callbacks accumulés sans bloquer
                self.producer.poll(0)
            except Exception as e:
                print(f"[-] Erreur de publication Kafka: {e}")
                print(f"[Fallback Console] {json_payload}")
                sys.stdout.flush()
        else:
            print(f"[Console Output] {json_payload}\n")
            sys.stdout.flush()

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
                        
                        # Injection éventuelle d'une dérive de panne (ex: sensor_temp_002)
                        val = self.inject_anomaly(sensor_id, sensor_type, raw_val)
                        
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
                        
                # Forcer l'affichage immédiat dans Docker
                sys.stdout.flush()
                time.sleep(0.05)
        except KeyboardInterrupt:
            print("\n--- Simulateur Arrêté ---")
            sys.stdout.flush()

if __name__ == "__main__":
    sim = IoTSimulator()
    sim.run()
