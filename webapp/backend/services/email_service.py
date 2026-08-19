import os
import smtplib
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from config import settings

class EmailNotificationService:
    """
    Service de notification par email consolidé (Digest HTML Premium).
    - Charte graphique officielle Azura Group (Vert AzurA #1B5E20, Jaune Soleil #FBC02D, Rouge Alerte #D32F2F).
    - Intégration du logo officiel inline via Content-ID (cid:azura_logo).
    - Design exécutif moderne, épuré et ultra-lisible.
    """

    def __init__(self):
        # Dictionnaire d'historique des incidents par capteur :
        # { "device_id": { "first_seen": timestamp, "first_status": str, "first_val": float, ... } }
        self.incidents: dict[str, dict] = {}
        self.digest_timer_start: float | None = None
        self.digest_email_sent: bool = False

    def process_alert_event(self, alert_data: dict):
        """
        Enregistre chaque événement reçu du consommateur Kafka et évalue si le rapport récapitulatif doit être envoyé.
        """
        device_id = alert_data.get("device_id")
        status = alert_data.get("status")
        val = alert_data.get("value", 0.0)
        unit = alert_data.get("unit", "")
        location = alert_data.get("location", "AZURA Site")
        timestamp_str = alert_data.get("timestamp", datetime.now(timezone.utc).isoformat())

        if not device_id:
            return

        now = time.time()

        # Cas 1 : Réception d'un statut ANORMAL (début ou continuité de panne)
        if status and status != "NORMAL":
            if self.digest_timer_start is None:
                self.digest_timer_start = now
                self.digest_email_sent = False
                print(f"[EmailService] ⏱️ Premier incident détecté ({device_id}). Démarrage de la fenêtre de 120s pour le rapport récapitulatif.")

            if device_id not in self.incidents:
                self.incidents[device_id] = {
                    "device_id": device_id,
                    "first_seen": now,
                    "first_seen_str": timestamp_str,
                    "first_status": status,
                    "first_val": val,
                    "last_status": status,
                    "last_val": val,
                    "unit": unit,
                    "location": location,
                    "is_resolved": False,
                    "resolved_at_str": None,
                }
                print(f"[EmailService] 📌 Panne enregistrée pour {device_id} ({status} - {val} {unit})")
            else:
                inc = self.incidents[device_id]
                inc["last_status"] = status
                inc["last_val"] = val
                inc["is_resolved"] = False

        # Cas 2 : Réception d'un retour à la normale (panne temporaire résolue)
        elif status == "NORMAL":
            if device_id in self.incidents and not self.incidents[device_id]["is_resolved"]:
                inc = self.incidents[device_id]
                inc["is_resolved"] = True
                inc["resolved_at_str"] = timestamp_str
                print(f"[EmailService] 🟢 Panne TEMPORAIRE résolue pour {device_id} (Revenu au calme à {timestamp_str})")

        # Envoi automatique suspendu (en attente du plan et de la logique de validation avec l'utilisateur)
        # if self.digest_timer_start is not None and not self.digest_email_sent:
        #     elapsed = now - self.digest_timer_start
        #     if elapsed >= settings.ALERT_EMAIL_THRESHOLD_SECONDS:
        #         print(f"[EmailService] 🚨 Fenêtre de 120s atteinte ({round(elapsed)}s)...")
        #         success = self.send_consolidated_digest_email(round(elapsed))
        #         if success:
        #             self.digest_email_sent = True

    def send_consolidated_digest_email(self, elapsed_seconds: int) -> bool:
        """Génère et envoie UN SEUL email synthétique (Digest HTML Premium) avec charte AzurA."""
        if not self.incidents:
            return False

        # Séparation des capteurs entre Permanents (non résolus) et Temporaires (résolus)
        permanent_faults = [inc for inc in self.incidents.values() if not inc["is_resolved"]]
        temporary_faults = [inc for inc in self.incidents.values() if inc["is_resolved"]]

        if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not settings.ALERT_EMAIL_RECIPIENT:
            print("\n" + "="*70)
            print(f"  [SIMULATION RAPPORT EMAIL CONSOLIDÉ (Après {elapsed_seconds}s)]")
            print(f"  - Pannes PERMANENTES (Toujours en alerte > 2 min) : {len(permanent_faults)}")
            for p in permanent_faults:
                print(f"    * {p['device_id']} ({p['location']}) : {p['last_status']} | Val: {p['last_val']} {p['unit']}")
            print(f"  - Pannes TEMPORAIRES (Résolues automatiquement) : {len(temporary_faults)}")
            for t in temporary_faults:
                print(f"    * {t['device_id']} ({t['location']}) : Début {t['first_status']} à {t['first_seen_str']} ➔ Résolu à {t['resolved_at_str']}")
            print("="*70 + "\n")
            return True

        try:
            subject = f"🚨 [AZURA SUPERVISION] Rapport d'Incident IoT — Bilan de Synthèse ({elapsed_seconds}s)"
            
            # Construction des cartes/lignes HTML pour les pannes permanentes
            perm_rows = ""
            for p in permanent_faults:
                perm_rows += f"""
                <tr style="border-bottom: 1px solid #EEF2F6;">
                    <td style="padding: 14px 16px; font-weight: 700; color: #1E293B;">
                        <span style="display: inline-block; width: 8px; height: 8px; background-color: #D32F2F; border-radius: 50%; margin-right: 8px;"></span>
                        {p['device_id']}
                    </td>
                    <td style="padding: 14px 16px; color: #475569; font-size: 13px;">📍 {p['location']}</td>
                    <td style="padding: 14px 16px;">
                        <span style="background-color: #FFEBEE; color: #D32F2F; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid #FFCDD2;">
                            {p['last_status']}
                        </span>
                    </td>
                    <td style="padding: 14px 16px; font-weight: 700; color: #B71C1C; font-size: 15px;">{p['last_val']} {p['unit']}</td>
                    <td style="padding: 14px 16px; color: #D32F2F; font-size: 12px; font-weight: 600;">Intervention requise</td>
                </tr>
                """

            # Construction des cartes/lignes HTML pour les pannes temporaires
            temp_rows = ""
            for t in temporary_faults:
                temp_rows += f"""
                <tr style="border-bottom: 1px solid #EEF2F6;">
                    <td style="padding: 14px 16px; font-weight: 700; color: #1E293B;">
                        <span style="display: inline-block; width: 8px; height: 8px; background-color: #2E7D32; border-radius: 50%; margin-right: 8px;"></span>
                        {t['device_id']}
                    </td>
                    <td style="padding: 14px 16px; color: #475569; font-size: 13px;">📍 {t['location']}</td>
                    <td style="padding: 14px 16px;">
                        <span style="background-color: #E8F5E9; color: #2E7D32; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid #C8E6C9;">
                            {t['first_status']} ➔ NORMAL
                        </span>
                    </td>
                    <td style="padding: 14px 16px; color: #64748B; font-size: 13px;">Init: <strong>{t['first_val']} {t['unit']}</strong></td>
                    <td style="padding: 14px 16px; color: #2E7D32; font-size: 12px; font-weight: 600;">Résolu à {t['resolved_at_str']}</td>
                </tr>
                """

            html_content = f"""
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Rapport d'Incident AzurA IoT</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #F4F6F9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
                
                <!-- CONTAINER PRINCIPAL -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4F6F9; padding: 40px 10px;">
                    <tr>
                        <td align="center">
                            <table width="680" border="0" cellspacing="0" cellpadding="0" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 35px rgba(0,0,0,0.07); border: 1px solid #E2E8F0;">
                                
                                <!-- HEADER BANNER CHARTE AZURA -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%); padding: 30px 40px; border-bottom: 4px solid #FBC02D;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="left">
                                                    <img src="cid:azura_logo" alt="AzurA Group" style="max-height: 48px; width: auto; display: block;" />
                                                </td>
                                                <td align="right">
                                                    <span style="background-color: rgba(251, 192, 45, 0.2); color: #FBC02D; font-size: 11px; font-weight: 800; letter-spacing: 1px; padding: 6px 14px; border-radius: 30px; border: 1px solid rgba(251, 192, 45, 0.4); text-transform: uppercase;">
                                                        SUPERVISION TEMPS RÉEL
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- TITRE & SYNTHÈSE -->
                                <tr>
                                    <td style="padding: 35px 40px 20px 40px;">
                                        <h1 style="color: #0F172A; font-size: 22px; font-weight: 800; margin: 0 0 10px 0; letter-spacing: -0.5px;">
                                            📋 Rapport Synthétique d'Incident IoT
                                        </h1>
                                        <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0;">
                                            Bilan d'évaluation consolidé généré automatiquement après une fenêtre de surveillance de <strong>{elapsed_seconds} secondes</strong>.
                                        </p>
                                    </td>
                                </tr>

                                <!-- CARTES KPIS DE SYNTHÈSE -->
                                <tr>
                                    <td style="padding: 0 40px 30px 40px;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td width="48%" style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 18px; text-align: center;">
                                                    <div style="font-size: 12px; font-weight: 700; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px;">Pannes Permanentes</div>
                                                    <div style="font-size: 28px; font-weight: 900; color: #D32F2F; margin-top: 4px;">{len(permanent_faults)}</div>
                                                    <div style="font-size: 11px; color: #B91C1C; margin-top: 2px;">En alerte continue &gt; 2 min</div>
                                                </td>
                                                <td width="4%"></td>
                                                <td width="48%" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 18px; text-align: center;">
                                                    <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Pannes Temporaires</div>
                                                    <div style="font-size: 28px; font-weight: 900; color: #2E7D32; margin-top: 4px;">{len(temporary_faults)}</div>
                                                    <div style="font-size: 11px; color: #15803D; margin-top: 2px;">Régulées automatiquement</div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- TABLEAU 1 : PANNES PERMANENTES -->
                                <tr>
                                    <td style="padding: 0 40px 30px 40px;">
                                        <div style="margin-bottom: 12px; display: flex; align-items: center;">
                                            <span style="font-size: 16px; font-weight: 800; color: #991B1B;">🔴 1. Pannes Permanentes (Action Requise Urgent)</span>
                                        </div>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-radius: 10px; overflow: hidden; border: 1px solid #E2E8F0;">
                                            <thead>
                                                <tr style="background-color: #991B1B; color: #FFFFFF; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                                                    <th style="padding: 12px 16px; text-align: left;">Capteur</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Localisation</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Statut Actuel</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Valeur</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Recommandation</th>
                                                </tr>
                                            </thead>
                                            <tbody style="background-color: #FFFFFF;">
                                                {perm_rows if perm_rows else '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #166534; font-weight: 600; font-size: 13px;">✅ Aucune panne permanente détectée. Les systèmes sont stables.</td></tr>'}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>

                                <!-- TABLEAU 2 : PANNES TEMPORAIRES -->
                                <tr>
                                    <td style="padding: 0 40px 40px 40px;">
                                        <div style="margin-bottom: 12px;">
                                            <span style="font-size: 16px; font-weight: 800; color: #166534;">🟢 2. Pannes Temporaires (Régulées Automatiquement)</span>
                                        </div>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-radius: 10px; overflow: hidden; border: 1px solid #E2E8F0;">
                                            <thead>
                                                <tr style="background-color: #166534; color: #FFFFFF; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                                                    <th style="padding: 12px 16px; text-align: left;">Capteur</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Localisation</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Évolution Statut</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Valeur Init.</th>
                                                    <th style="padding: 12px 16px; text-align: left;">Heure Résolution</th>
                                                </tr>
                                            </thead>
                                            <tbody style="background-color: #FFFFFF;">
                                                {temp_rows if temp_rows else '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748B; font-size: 13px;">Aucune panne temporaire enregistrée pendant cette fenêtre.</td></tr>'}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>

                                <!-- FOOTER CHARTE AZURA -->
                                <tr>
                                    <td style="background-color: #0F172A; padding: 25px 40px; text-align: center; border-top: 3px solid #1B5E20;">
                                        <p style="color: #94A3B8; font-size: 12px; margin: 0 0 6px 0; font-weight: 600;">
                                            AzurA Group — Plateforme de Supervision IoT Big Data
                                        </p>
                                        <p style="color: #64748B; font-size: 11px; margin: 0;">
                                            Agadir • Dakhla • Casablanca • Tanger • Kénitra | Notification automatique de sécurité
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>

            </body>
            </html>
            """

            # Construction du message MIME avec logo inline (Content-ID)
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_USER
            msg["To"] = settings.ALERT_EMAIL_RECIPIENT

            msg_alternative = MIMEMultipart("alternative")
            msg.attach(msg_alternative)
            msg_alternative.attach(MIMEText(html_content, "html"))

            # Attachement du logo officiel AzurA inline
            logo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets", "azura_logo.png")
            if os.path.exists(logo_path):
                with open(logo_path, "rb") as f:
                    logo_img = MIMEImage(f.read())
                    logo_img.add_header("Content-ID", "<azura_logo>")
                    logo_img.add_header("Content-Disposition", "inline", filename="azura_logo.png")
                    msg.attach(logo_img)
            else:
                print(f"[EmailService] ⚠️ Fichier logo introuvable sur {logo_path}, l'email sera envoyé sans image inline.")

            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, settings.ALERT_EMAIL_RECIPIENT, msg.as_string())
            server.quit()

            print(f"[EmailService] ✅ Email récapitulatif consolidé avec charte AzurA envoyé avec succès à {settings.ALERT_EMAIL_RECIPIENT} !")
            return True

        except Exception as e:
            print(f"[EmailService] ❌ Échec de l'envoi de l'email récapitulatif: {e}")
            return False

    def send_otp_verification_email(self, recipient_email: str, otp_code: str) -> bool:
        """Envoie un email de vérification OTP optimisé pour la délivrabilité Gmail."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"[EmailService] ⚠️ SMTP non configuré. Simulation Code OTP pour {recipient_email} : {otp_code}")
            return True

        try:
            import email.utils

            subject = f"Code de verification AzurA : {otp_code}"
            
            body = f"""Bonjour,

Vous avez demande a recevoir les alertes de supervision de la plateforme AzurA IoT sur cette adresse email.

Voici votre code de verification personnel : {otp_code}

Ce code reste valide pendant 10 minutes.
Si vous n'etes pas a l'origine de cette demande, vous pouvez simplement ignorer ce message.

Cordialement,
Support Technique AzurA Group
Plateforme Industrielle de Supervision IoT
"""

            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_USER
            msg["Reply-To"] = settings.SMTP_USER
            msg["To"] = recipient_email.strip()
            msg["Date"] = email.utils.formatdate(localtime=True)
            msg["Message-ID"] = email.utils.make_msgid(domain="gmail.com")

            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, recipient_email.strip(), msg.as_string())
            server.quit()

            print(f"[EmailService] ✉️ Code OTP envoyé avec succès à {recipient_email} !")
            return True

        except Exception as e:
            print(f"[EmailService] ❌ Échec envoi code OTP à {recipient_email}: {e}")
            return False

    def send_email_revocation_otp(self, recipient_email: str, otp_code: str) -> bool:
        """Envoie un email contenant le code OTP de confirmation pour la révocation/changement d'email."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"[EmailService] ⚠️ SMTP non configuré. Simulation Code Révocation pour {recipient_email} : {otp_code}")
            return True

        try:
            import email.utils

            subject = f"Confirmation de changement d'email AzurA : {otp_code}"
            
            body = f"""Bonjour,

Une demande de changement d'email destinataire des alertes a ete initiee sur la plateforme AzurA IoT.

ATTENTION : La validation de ce code supprimera cette adresse email du systeme de notification.

Voici votre code de securite a 6 chiffres : {otp_code}

Ce code est valable pendant 10 minutes.
Si vous n'etes pas a l'origine de cette demande, ne partagez pas ce code.

Cordialement,
Support Technique AzurA Group
Plateforme Industrielle de Supervision IoT
"""

            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_USER
            msg["Reply-To"] = settings.SMTP_USER
            msg["To"] = recipient_email.strip()
            msg["Date"] = email.utils.formatdate(localtime=True)
            msg["Message-ID"] = email.utils.make_msgid(domain="gmail.com")

            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, recipient_email.strip(), msg.as_string())
            server.quit()

            print(f"[EmailService] ✉️ Code de révocation OTP envoyé avec succès à {recipient_email} !")
            return True

        except Exception as e:
            print(f"[EmailService] ❌ Échec envoi code révocation OTP à {recipient_email}: {e}")
            return False

# Singleton global pour le service email
email_service = EmailNotificationService()

