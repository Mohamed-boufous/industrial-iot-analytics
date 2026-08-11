from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from services.kafka_consumer import kafka_service
from routes_ws import alerts_ws, sensors_ws
from routers import stats

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestionnaire de cycle de vie : démarre et arrête les services d'arrière-plan."""
    # Action au DÉMARRAGE de FastAPI
    kafka_service.start()
    yield
    # Action à l'ARRÊT de FastAPI
    kafka_service.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API FastAPI et WebSockets pour la plateforme de supervision IoT AzurA",
    lifespan=lifespan
)

# Configuration CORS sécurisée pour autoriser uniquement le frontend React (localhost et IP de la VM)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Liste des origines explicites et sécurisées
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Enregistrement des endpoints WebSockets & REST
app.include_router(alerts_ws.router)
app.include_router(sensors_ws.router)
app.include_router(stats.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "message": "Bienvenue sur l'API FastAPI du projet AzurA !"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "kafka_brokers": settings.KAFKA_BROKERS,
        "mongo_uri": settings.MONGO_URI
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
