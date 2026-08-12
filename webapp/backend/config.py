import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # --- PROJET & SÉCURITÉ ---
    PROJECT_NAME: str = "AzurA IoT Platform API"
    VERSION: str = "1.0.0"
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:80",
        "http://localhost",
        "http://84.8.222.106:5173",
        "http://84.8.222.106:80",
        "http://84.8.222.106",
    ]
    
    # --- KAFKA CONFIGURATION ---
    KAFKA_BROKERS: str = os.getenv("KAFKA_BROKERS", "kafka1:19092,kafka2:19092,kafka3:19092")
    KAFKA_TOPIC_RAW: str = "iot-raw-data"
    KAFKA_TOPIC_PROCESSED: str = "iot-processed"
    KAFKA_TOPIC_ALERTS: str = "iot-alerts"
    KAFKA_GROUP_ID_WEBAPP: str = "azura-webapp-group"
    
    # --- MONGODB CONFIGURATION ---
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://mongos-router:27017")
    MONGO_DB_NAME: str = "azura_iot"
    COLLECTION_RAW: str = "raw_measurements"
    COLLECTION_ALERTS: str = "alerts_history"
    
    # --- NOTIFICATION EMAIL CONFIGURATION ---
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    ALERT_EMAIL_RECIPIENT: str = os.getenv("ALERT_EMAIL_RECIPIENT", "")
    
    # Délai de confirmation d'une alerte continue avant envoi du rapport récapitulatif (en secondes)
    ALERT_EMAIL_THRESHOLD_SECONDS: int = 120  # 2 minutes

settings = Settings()
