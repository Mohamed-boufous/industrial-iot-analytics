from fastapi import APIRouter, HTTPException, Body
from services.mongo_service import mongo_service
from services.email_service import email_service
from config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/thresholds")
def get_thresholds():
    """
    Retourne les seuils officiels de surveillance système depuis la collection MongoDB 'system_configuration'.
    """
    try:
        thresholds = mongo_service.get_system_thresholds()
        return {"status": "success", "thresholds": thresholds}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB lors de la lecture des seuils: {str(e)}")

@router.put("/thresholds")
def update_thresholds(payload: dict = Body(...)):
    """
    Met à jour les seuils de surveillance physique dans MongoDB.
    """
    try:
        updated = mongo_service.update_system_thresholds(payload)
        return {"status": "success", "message": "Seuils mis a jour avec succes dans MongoDB", "thresholds": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB lors de la mise a jour des seuils: {str(e)}")

@router.post("/thresholds/reset")
def reset_thresholds():
    """
    Réinitialise les seuils de surveillance aux valeurs d'usine par défaut.
    """
    try:
        defaults = mongo_service.reset_system_thresholds()
        return {"status": "success", "message": "Seuils reinitialises aux valeurs d usine", "thresholds": defaults}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur MongoDB lors de la reinitialisation des seuils: {str(e)}")

@router.post("/test-email")
def test_email_notification(recipient: str = Body(default=None, embed=True)):
    """
    Déclenche un test d'envoi d'email SMTP en direct avec la charte AzurA.
    """
    target_email = recipient or settings.ALERT_EMAIL_RECIPIENT
    if not target_email:
        raise HTTPException(status_code=400, detail="Aucune adresse email destinataire configuree.")
    
    try:
        # Envoi via email_service
        success = email_service.send_consolidated_alert_email()
        if success:
            return {"status": "success", "message": f"Email de test envoye avec succes a {target_email}"}
        else:
            return {"status": "warning", "message": "Le service email a termine mais le serveur SMTP n a pas confirme la reception."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Echec envoi email SMTP: {str(e)}")
