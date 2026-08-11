import json
import threading
import time
from confluent_kafka import Consumer, KafkaError
from config import settings

class KafkaConsumerService:
    """
    Service d'arrière-plan consommant en continu les topics Kafka 'iot-processed' et 'iot-alerts'.
    Stocke le dernier état des 15 capteurs et alimente les événements WebSockets.
    """
    def __init__(self):
        self.running = False
        self.thread = None
        self.latest_sensors = {}  # Dict {device_id: dernier_message_json}
        self.recent_alerts = []   # Liste des 50 dernières alertes
        self.websocket_listeners = set() # Listeners enregistrés (WebSockets)

    def _create_consumer(self):
        """Configuration et création du consommateur confluent-kafka."""
        conf = {
            'bootstrap.servers': settings.KAFKA_BROKERS,
            'group.id': settings.KAFKA_GROUP_ID_WEBAPP,
            'auto.offset.reset': 'latest', # Consomme uniquement les messages frais en temps réel
            'enable.auto.commit': True
        }
        return Consumer(conf)

    def start(self):
        """Démarre le thread de consommation en arrière-plan."""
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._consume_loop, daemon=True)
        self.thread.start()
        print(f"[KafkaConsumerService] Démarré et abonné aux topics: {settings.KAFKA_TOPIC_PROCESSED}, {settings.KAFKA_TOPIC_ALERTS}")

    def stop(self):
        """Arrête proprement le consommateur."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        print("[KafkaConsumerService] Arrêté avec succès.")

    def _consume_loop(self):
        """Boucle principale de lecture des messages Kafka."""
        consumer = None
        while self.running:
            try:
                if consumer is None:
                    consumer = self._create_consumer()
                    consumer.subscribe([settings.KAFKA_TOPIC_PROCESSED, settings.KAFKA_TOPIC_ALERTS])

                msg = consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() != KafkaError._PARTITION_EOF:
                        print(f"[-] Erreur Kafka Consumer: {msg.error()}")
                    continue

                # Décodage du message JSON
                payload = json.loads(msg.value().decode('utf-8'))
                topic = msg.topic()

                if topic == settings.KAFKA_TOPIC_PROCESSED:
                    device_id = payload.get("device_id")
                    if device_id:
                        self.latest_sensors[device_id] = payload

                elif topic == settings.KAFKA_TOPIC_ALERTS:
                    self.recent_alerts.insert(0, payload)
                    # On ne garde que les 50 alertes les plus récentes en mémoire
                    if len(self.recent_alerts) > 50:
                        self.recent_alerts.pop()

                # Dispatching du message à tous les abonnés WebSockets actifs
                self._notify_listeners(topic, payload)

            except Exception as e:
                print(f"[-] Exception dans le boucle Kafka Consumer: {e}")
                time.sleep(2.0) # Petite pause avant de retenter en cas d'erreur réseau
                consumer = None
        
        if consumer:
            consumer.close()

    def add_listener(self, callback):
        """Enregistre un callback/WebSocket qui sera notifié à chaque nouveau message."""
        self.websocket_listeners.add(callback)

    def remove_listener(self, callback):
        """Retire un callback/WebSocket."""
        self.websocket_listeners.discard(callback)

    def _notify_listeners(self, topic: str, data: dict):
        """Diffuse le message à tous les écouteurs enregistrés."""
        dead_listeners = set()
        for callback in list(self.websocket_listeners):
            try:
                callback(topic, data)
            except Exception:
                dead_listeners.add(callback)
        
        for dead in dead_listeners:
            self.websocket_listeners.discard(dead)

# Instance globale unique (Singleton)
kafka_service = KafkaConsumerService()
