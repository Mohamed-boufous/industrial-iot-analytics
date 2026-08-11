import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.kafka_consumer import kafka_service
from config import settings

router = APIRouter()

class AlertsConnectionManager:
    """Gestionnaire de connexions WebSockets pour le flux d'alertes."""
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WebSocket Alerts] Nouveau client connecté. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket Alerts] Client déconnecté. Total restant: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Envoie le message à tous les clients connectés."""
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = AlertsConnectionManager()

def on_kafka_event(topic: str, data: dict):
    """Callback appelé par KafkaConsumerService dès qu'un message arrive."""
    if topic == settings.KAFKA_TOPIC_ALERTS:
        try:
            loop = asyncio.get_running_loop()
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "NEW_ALERT", "data": data}),
                loop
            )
        except RuntimeError:
            pass

# Enregistrement du callback auprès du consommateur Kafka
kafka_service.add_listener(on_kafka_event)

@router.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Envoie l'historique récent des 50 dernières alertes dès la connexion
        await websocket.send_json({
            "type": "INITIAL_ALERTS_HISTORY",
            "data": kafka_service.recent_alerts
        })
        
        # Maintient la connexion ouverte
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[-] Erreur WebSocket Alerts: {e}")
        manager.disconnect(websocket)
