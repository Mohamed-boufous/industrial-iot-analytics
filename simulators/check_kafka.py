import json
import time
from confluent_kafka import Consumer, KafkaError

def main():
    conf = {
        'bootstrap.servers': 'kafka1:19092,kafka2:19092,kafka3:19092',
        'group.id': f'alert-checker-{time.time()}',
        'auto.offset.reset': 'earliest'
    }
    consumer = Consumer(conf)
    consumer.subscribe(['iot-alerts'])
    
    print("--- LECTURE DIRECTE KAFKA VIA CONFLUENT_KAFKA ---")
    device_alerts = {}
    total_messages = 0
    start_t = time.time()
    
    while time.time() - start_t < 4.0:
        msg = consumer.poll(0.5)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            else:
                break
        total_messages += 1
        try:
            val = json.loads(msg.value().decode('utf-8'))
            dev_id = val.get('device_id')
            status = val.get('status')
            if dev_id:
                device_alerts[dev_id] = status
        except Exception:
            pass
            
    consumer.close()
    
    print(f"Total messages d'alerte consommés : {total_messages}")
    print(f"Nombre de capteurs distincts ayant émis une alerte : {len(device_alerts)}")
    print("Liste des capteurs en alerte (device_id -> statut) :")
    for d_id in sorted(list(device_alerts.keys())):
        print(f"  - {d_id} => {device_alerts[d_id]}")

if __name__ == "__main__":
    main()
