import random
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

# =========================================================================
# GOUVERNANCE EMAIL & VÉRIFICATION OTP (6 CHIFFRES)
# =========================================================================

@router.get("/email-config")
def get_email_configuration():
    """
    Retourne la configuration actuelle de l'email destinataire des alertes d'incidents.
    """
    try:
        email_cfg = mongo_service.get_alert_recipient_config()
        return {
            "status": "success",
            "email": email_cfg.get("email"),
            "is_verified": email_cfg.get("is_verified", False),
            "verified_at": email_cfg.get("verified_at"),
            "smtp_sender": settings.SMTP_USER
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lecture configuration email: {str(e)}")

@router.post("/send-verification-otp")
def send_email_verification_otp(email: str = Body(..., embed=True)):
    """
    Génère un code OTP aléatoire de 6 chiffres, le stocke temporairement dans MongoDB et l'envoie par email.
    """
    target_email = email.strip()
    if not target_email or "@" not in target_email:
        raise HTTPException(status_code=400, detail="Adresse email invalide.")

    # 1. Génération d'un code aléatoire de 6 chiffres sécurisé
    otp_code = f"{random.randint(100000, 999999)}"

    # 2. Sauvegarde temporaire dans MongoDB (durée 10 min)
    mongo_service.save_pending_email_otp(target_email, otp_code, expires_minutes=10)

    # 3. Envoi de l'email via SMTP
    sent = email_service.send_otp_verification_email(target_email, otp_code)
    if not sent:
        raise HTTPException(status_code=500, detail="Echec de l envoi de l email SMTP. Verifiez vos identifiants.")

    return {
        "status": "success",
        "message": f"Code de confirmation envoye a {target_email}",
        "email": target_email
    }

@router.post("/verify-email-otp")
def verify_email_otp_code(email: str = Body(...), code: str = Body(...)):
    """
    Valide le code OTP saisi par l'utilisateur et enregistre l'adresse email dans MongoDB comme destinataire actif.
    """
    target_email = email.strip()
    input_code = code.strip()

    if not target_email or not input_code:
        raise HTTPException(status_code=400, detail="L email et le code de confirmation sont requis.")

    result = mongo_service.verify_email_otp(target_email, input_code)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("reason", "Code invalide ou expire."))

    # Mise à jour en mémoire du destinataire actif
    settings.ALERT_EMAIL_RECIPIENT = target_email

    return {
        "status": "success",
        "message": "Adresse email confirmee et activee avec succes pour les alertes !",
        "email": target_email,
        "verified_at": result.get("verified_at")
    }

@router.post("/request-email-change-otp")
def request_email_change_otp():
    """
    Envoie un code OTP de sécurité à l'adresse email actuellement vérifiée pour autoriser sa modification ou suppression.
    """
    cfg = mongo_service.get_alert_recipient_config()
    current_email = cfg.get("email")
    if not current_email or not cfg.get("is_verified"):
        raise HTTPException(status_code=400, detail="Aucun email verifie n est actuellement configure.")

    # 1. Génération d'un code OTP à 6 chiffres
    otp_code = f"{random.randint(100000, 999999)}"

    # 2. Sauvegarde temporaire dans MongoDB (durée 10 min)
    mongo_service.save_pending_email_otp(current_email, otp_code, expires_minutes=10)

    # 3. Envoi de l'email de confirmation de révocation
    sent = email_service.send_email_revocation_otp(current_email, otp_code)
    if not sent:
        raise HTTPException(status_code=500, detail="Echec de l envoi de l email SMTP de confirmation.")

    return {
        "status": "success",
        "message": f"Code de confirmation de changement envoye a {current_email}",
        "email": current_email
    }

@router.post("/confirm-email-change-otp")
def confirm_email_change_otp(code: str = Body(..., embed=True)):
    """
    Valide le code OTP saisi et supprime l'adresse email actuelle pour permettre la configuration d'un nouvel email.
    """
    cfg = mongo_service.get_alert_recipient_config()
    current_email = cfg.get("email")
    if not current_email:
        raise HTTPException(status_code=400, detail="Aucun email a modifier.")

    input_code = code.strip()
    if not input_code:
        raise HTTPException(status_code=400, detail="Le code de securite est requis.")

    # Vérification du code
    res = mongo_service.verify_email_otp(current_email, input_code)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("reason", "Code incorrect ou expire."))

    # Suppression de l'email actif dans MongoDB
    mongo_service.reset_alert_recipient_config()
    settings.ALERT_EMAIL_RECIPIENT = ""

    return {
        "status": "success",
        "message": "Association email supprimee avec succes. Vous pouvez configurer une nouvelle adresse."
    }

@router.post("/test-email")
def test_email_notification(recipient: str = Body(default=None, embed=True)):
    """
    Déclenche un test d'envoi d'email SMTP en direct avec la charte AzurA.
    """
    target_email = recipient or settings.ALERT_EMAIL_RECIPIENT or settings.SMTP_USER
    if not target_email:
        raise HTTPException(status_code=400, detail="Aucune adresse email destinataire configuree.")
    
    try:
        # Envoi d'un rapport de test
        success = email_service.send_consolidated_digest_email(elapsed_seconds=120)
        if success:
            return {"status": "success", "message": f"Email de test envoye avec succes a {target_email}"}
        else:
            return {"status": "warning", "message": "Le service email a termine mais le serveur SMTP n a pas confirme la reception."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Echec envoi email SMTP: {str(e)}")
