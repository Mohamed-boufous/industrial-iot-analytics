import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.kafka_consumer import kafka_service
from config import settings

router = APIRouter()

class SensorsConnectionManager:
    """Gestionnaire de connexions WebSockets pour le flux de tous les capteurs (iot-processed)."""
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WebSocket Sensors] Nouveau client connecté. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket Sensors] Client déconnecté. Total restant: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Envoie la mise à jour d'un capteur à tous les clients connectés."""
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = SensorsConnectionManager()

def on_kafka_sensor_event(topic: str, data: dict):
    """Callback appelé dès qu'une nouvelle mesure arrive du topic iot-processed."""
    if topic == settings.KAFKA_TOPIC_PROCESSED:
        try:
            loop = asyncio.get_running_loop()
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "SENSOR_UPDATE", "data": data}),
                loop
            )
        except RuntimeError:
            pass

# Enregistrement du callback auprès du consommateur Kafka
kafka_service.add_listener(on_kafka_sensor_event)

@router.websocket("/ws/sensors")
async def websocket_sensors_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Envoie l'état actuel de tous les capteurs en mémoire dès la connexion
        await websocket.send_json({
            "type": "INITIAL_SENSORS_STATE",
            "data": list(kafka_service.latest_sensors.values())
        })
        
        # Maintient la connexion ouverte
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[-] Erreur WebSocket Sensors: {e}")
        manager.disconnect(websocket)
