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
        """Configure les scénarios de pannes :
        1. 4 capteurs avec pannes physiques de grandeur (2 temporaires 60s->180s, 2 permanentes > 60s).
        2. 1 capteur parmi les 16 restants qui tombe en PANNE TOTALE (Silence Radio) à t = 120s (2 minutes).
        3. 1 capteur parmi les restants qui subit une BATTERIE FAIBLE (< 20%) à t = 65s.
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
        
        # Sélection parmi les 16 capteurs normaux
        remaining_ids = [s_id for s_id in all_ids if s_id not in selected_fault_ids]
        
        # 1. Capteur en Panne Totale / Silence Radio après 2 minutes (120s)
        self.silent_sensor_id = random.choice(remaining_ids)
        self.silent_start_delay = 120.0  # 2 minutes de fonctionnement normal
        
        # 2. Capteur pour tester l'alerte Batterie Faible (< 20%)
        other_remaining_ids = [s_id for s_id in remaining_ids if s_id != self.silent_sensor_id]
        self.battery_fault_sensor_id = random.choice(other_remaining_ids)
        self.battery_fault_start_delay = 65.0 # Déclenchement à 65s
        
        print("\n" + "="*75)
        print("  [SCENARIOS DE PANNES CONFIGURES]")
        print("  - t = 0s a 60s (0-1 min) : Tous les 20 capteurs sont 100% NORMAUX (0 alerte)")
        for s_id, sc in self.fault_scenarios.items():
            kind = "TEMPORAIRE (guerie a t = 180s)" if sc["is_temporary"] else "PERMANENTE (active indefiniment)"
            print(f"  - Capteur {s_id} : Panne Physique {kind} declenchee a t = 60s")
        print(f"  - Capteur {self.silent_sensor_id} : SILENCE RADIO (Panne Totale / 0 emission) a t >= 120s (2 min)")
        print(f"  - Capteur {self.battery_fault_sensor_id} : BATTERIE FAIBLE (< 20%) declenchee a t >= 65s")
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
        print(f"--- Démarrage du Simulateur IoT (20 Capteurs Actifs) ---")
        last_sent_time = {sensor["id"]: 0.0 for sensor in self.active_sensors}
        
        # Taux de décharge réaliste par type de grandeur physique
        TYPE_DISCHARGE_RATES = {
            "vibration": 0.008,    # Échantillonnage dynamique intensif
            "consommation": 0.006, # Mesure continue de puissance
            "temperature": 0.004,  # Sonde thermo-résistive
            "pression": 0.003,     # Transducteur piézo-électrique
            "humidite": 0.001      # Sonde capacitive très basse consommation
        }
        
        try:
            while True:
                current_now = time.time()
                elapsed = current_now - self.start_time

                for sensor in self.active_sensors:
                    sensor_id = sensor["id"]
                    sensor_type = sensor["type"]
                    interval = sensor["interval"]
                    loc = sensor["loc"]
                    lat = sensor["latitude"]
                    lng = sensor["longitude"]
                    profile = self.profiles[sensor_type]
                    
                    # ── CAS 1 : PANNE TOTALE / SILENCE RADIO APRÈS 2 MINUTES (120s) ──
                    if sensor_id == self.silent_sensor_id and elapsed >= self.silent_start_delay:
                        # Ce capteur ne transmet PLUS AUCUNE information vers Kafka
                        continue

                    if current_now - last_sent_time[sensor_id] >= interval:
                        state = self.states[sensor_id]
                        
                        # ── CAS 2 : TEST BATTERIE FAIBLE (< 20%) APRÈS 65s ──
                        if sensor_id == self.battery_fault_sensor_id and elapsed >= self.battery_fault_start_delay:
                            # Décharge brutale sous le seuil d'alerte pour déclencher Spark (< 20.0%)
                            state["battery_level"] = max(5.0, state["battery_level"] - 0.4) if state["battery_level"] > 14.5 else 14.2
                        else:
                            rate = TYPE_DISCHARGE_RATES.get(sensor_type, 0.002)
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
                            latitude=lat,
                            longitude=lng,
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
