from fastapi import APIRouter, HTTPException, Query
from services.mongo_service import mongo_service

router = APIRouter(prefix="/api/stats", tags=["Statistiques & Historique"])

@router.get("/kpis")
def get_kpis():
    """Retourne les indicateurs clés de performance (KPIs) globaux."""
    try:
        return mongo_service.get_global_kpis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB: {str(e)}")

@router.get("/alerts-by-type")
def get_alerts_by_type():
    """Retourne le nombre d'alertes par type de statut (ex: CRITICAL_TEMP_HIGH)."""
    try:
        return mongo_service.get_alerts_by_type()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB: {str(e)}")

@router.get("/top-problematic")
def get_top_problematic_sensors(limit: int = Query(default=5, ge=1, le=20)):
    """Retourne le top des capteurs ayant généré le plus d'incidents."""
    try:
        return mongo_service.get_top_problematic_sensors(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB: {str(e)}")

@router.get("/sensor-history/{device_id}")
def get_sensor_history(device_id: str, limit: int = Query(default=60, ge=10, le=500)):
    """Retourne l'historique chronologique des mesures d'un capteur."""
    try:
        history = mongo_service.get_sensor_history(device_id=device_id, limit=limit)
        return {"device_id": device_id, "count": len(history), "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB: {str(e)}")

@router.get("/recent-alerts")
def get_recent_alerts(limit: int = Query(default=100, ge=1, le=500)):
    """Retourne la liste des alertes récentes pour la réhydratation instantanée du dashboard."""
    try:
        from services.kafka_consumer import kafka_service
        alerts = mongo_service.get_recent_alerts(limit=limit)
        if not alerts:
            alerts = kafka_service.recent_alerts
        return {"count": len(alerts), "alerts": alerts}
    except Exception as e:
        from services.kafka_consumer import kafka_service
        return {"count": len(kafka_service.recent_alerts), "alerts": kafka_service.recent_alerts}
