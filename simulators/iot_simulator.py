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
        """Configure le scénario temporel exact :
        - 4 capteurs choisis au hasard parmi les 15.
        - t = 0s à 60s (0-1 min) : 0 alerte dans Kafka iot-alerts.
        - t = 60s : Déclenchement simultané des 4 pannes (2 temporaires, 2 permanentes).
        - t = 180s (3 min) : Guérison immédiate des 2 pannes temporaires.
        - t > 180s : Seules les 2 pannes permanentes continuent d'émettre des alertes.
        """
        all_ids = [s["id"] for s in self.active_sensors]
        selected_fault_ids = random.sample(all_ids, 4)
        
        temp_fault_ids = selected_fault_ids[:2]   # 2 pannes temporaires
        perm_fault_ids = selected_fault_ids[2:]   # 2 pannes permanentes
        
        for s_id in selected_fault_ids:
            is_temporary = s_id in temp_fault_ids
            self.fault_scenarios[s_id] = {
                "start_delay": 60.0,                              # Déclenchement à t = 60s pile
                "is_temporary": is_temporary,
                "end_time": 180.0 if is_temporary else float('inf'), # Fin à t = 180s pour temporaires
                "direction": random.choice([1, -1])              # 1 = surchauffe/surpression, -1 = sous-pression/gel
            }
        
        print("\n" + "="*75)
        print("  [SCÉNARIO TEMPOREL CONFIGURÉ (Strict 1 à 3 min)]")
        print("  - t = 0s à 60s (0-1 min) : Tous les 15 capteurs sont 100% NORMAUX (0 alerte)")
        for s_id, sc in self.fault_scenarios.items():
            kind = "TEMPORAIRE (guérie à t = 180s)" if sc["is_temporary"] else "PERMANENTE (active indéfiniment)"
            print(f"  - Capteur {s_id} : Panne {kind} déclenchée à t = 60s")
        print("="*75 + "\n")

    def _initialize_sensor_states(self):
        for sensor in self.active_sensors:
            s_id = sensor["id"]
            s_type = sensor["type"]
            profile = self.profiles[s_type]
            low, high = profile["normal_range"]
            initial_value = (low + high) / 2.0
            
            random_days = random.randint(0, 365)
            cal_date = (date.today() - timedelta(days=random_days)).strftime("%Y-%m-%d")
            
            # Au demarrage initial, TOUS les capteurs commencent a 100.0%
            self.states[s_id] = {
                "current_value": initial_value,
                "battery_level": 100.0,
                "calibration_date": cal_date
            }

    def generate_reading(self, sensor_id: str, sensor_type: str) -> float:
        """Génère une lecture physique continue et gère le cycle de vie des pannes."""
        state = self.states[sensor_id]
        profile = self.profiles[sensor_type]
        low, high = profile["normal_range"]
        elapsed = time.time() - self.start_time

        # Déterminer si le capteur est actuellement en phase de panne active
        is_in_active_fault = False
        if sensor_id in self.fault_scenarios:
            sc = self.fault_scenarios[sensor_id]
            if sc["start_delay"] <= elapsed:
                if not sc["is_temporary"] or elapsed <= sc["end_time"]:
                    is_in_active_fault = True

        # ── CAS 1 : Capteur NORMAL (jamais en panne, ou temporaire guérie après 180s, ou avant 60s)
        if not is_in_active_fault:
            # Réinitialisation immédiate au centre de la plage normale si le capteur sort de panne
            if state["current_value"] < low or state["current_value"] > high:
                state["current_value"] = (low + high) / 2.0

            drift_val = random.uniform(-profile["drift"], profile["drift"])
            noise = random.gauss(0, profile["noise_std"])
            new_value = state["current_value"] + drift_val + noise

            # Régulation stricte au centre de la plage normale
            new_value = max(low + 1.0, min(high - 1.0, new_value))
            state["current_value"] = new_value
            return round(new_value, 2)

        # ── CAS 2 : Panne ACTIVE (t = 60s à 180s pour temporaires, t > 60s pour permanentes)
        else:
            sc = self.fault_scenarios[sensor_id]
            direction = sc["direction"]
            
            # Valeurs d'anomalie franches qui franchissent à coup sûr les seuils de détection de Spark
            FAULT_TARGETS = {
                "temperature":  {"high": 95.0,  "low": 2.0},
                "vibration":    {"high": 8.5,   "low": 8.5},  # La vibration dérive toujours vers le haut (> 5.0 mm/s)
                "pression":     {"high": 14.0,  "low": 0.2},
                "humidite":     {"high": 88.0,  "low": 15.0},
                "consommation": {"high": 650.0, "low": 40.0},
            }
            
            targets = FAULT_TARGETS.get(sensor_type, {"high": high + 10.0, "low": max(0.0, low - 10.0)})
            target_val = targets["high"] if direction > 0 else targets["low"]
            
            drift_val = random.uniform(-profile["drift"], profile["drift"])
            state["current_value"] = target_val + drift_val
            return round(state["current_value"], 2)

    def _delivery_report(self, err, msg):
        if err is not None:
            print(f"[-] Échec d'envoi Kafka: {err}")
        else:
            key_str = msg.key().decode('utf-8') if msg.key() else "N/A"
            print(f"[✓ Kafka] {key_str} transmis au topic '{msg.topic()}' [Partition {msg.partition()}]")
        sys.stdout.flush()

    def produce_to_kafka(self, reading: SensorReading):
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
                        # Décharge progressive et douce selon la consommation matérielle du capteur
                        DISCHARGE_RATES = {
                            "sensor_vib_002": 0.010,  # Vibration haute fréquence
                            "sensor_pow_001": 0.008,  # Puissance Transformateur
                            "sensor_vib_001": 0.006,  # Vibration Moteur 1
                            "sensor_temp_003": 0.004, # Température Chambre 2
                            "sensor_pres_001": 0.003, # Pression hydraulique
                            "sensor_hum_001": 0.001,  # Humidité standard (très économe)
                        }
                        rate = DISCHARGE_RATES.get(sensor_id, 0.001)
                        state["battery_level"] = max(2.0, state["battery_level"] - rate)
                        
                        # Génération de la valeur physique
                        val = self.generate_reading(sensor_id, sensor_type)
                        
                        quality_score = round(random.uniform(0.90, 1.0), 2)
                        sig_strength = random.randint(-65, -45)
                            
                        current_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                        
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
                        
                        self.produce_to_kafka(reading_obj)
                        last_sent_time[sensor_id] = current_now
                        
                if self.producer:
                    self.producer.flush(0.05)
                sys.stdout.flush()
                time.sleep(0.05)
        except KeyboardInterrupt:
            print("\n--- Simulateur Arrêté ---")
            sys.stdout.flush()

if __name__ == "__main__":
    sim = IoTSimulator()
    sim.run()
