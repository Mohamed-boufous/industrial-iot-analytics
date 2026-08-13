import json
import time
from confluent_kafka import Consumer, KafkaError

def main():
    conf = {
        'bootstrap.servers': 'kafka1:19092,kafka2:19092,kafka3:19092',
        'group.id': f'recent-alert-checker-{time.time()}',
        'auto.offset.reset': 'latest'
    }
    consumer = Consumer(conf)
    consumer.subscribe(['iot-alerts'])
    
    print("--- LECTURE DES ALERTES EN TEMPS RÉEL (10 secondes) ---")
    recent_alerts = {}
    total_recent = 0
    start_t = time.time()
    
    while time.time() - start_t < 10.0:
        msg = consumer.poll(0.5)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            else:
                break
        total_recent += 1
        try:
            val = json.loads(msg.value().decode('utf-8'))
            dev_id = val.get('device_id')
            status = val.get('status')
            if dev_id:
                recent_alerts[dev_id] = status
        except Exception:
            pass
            
    consumer.close()
    
    print(f"Messages d'alerte reçus en temps réel durant les 10 dernières secondes : {total_recent}")
    print(f"Nombre de capteurs DISTINCTS émettant actuellement des alertes : {len(recent_alerts)}")
    print("Liste des capteurs actifs en alerte (device_id -> statut) :")
    for d_id in sorted(list(recent_alerts.keys())):
        print(f"  - {d_id} => {recent_alerts[d_id]}")

if __name__ == "__main__":
    main()
