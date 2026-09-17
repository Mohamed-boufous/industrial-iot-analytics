import os
import smtplib
import time
import email.utils
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from config import settings
from services.mongo_service import mongo_service

# Referentiel des 20 capteurs industriels d'exploitation AzurA
# IMPORTANT : Les IDs doivent correspondre EXACTEMENT a ceux du simulateur (simulators/config.py)
ALL_KNOWN_SENSORS = [
    # ── Zone 1 : Agadir ──
    {"id": "sensor_temp_001", "type": "temperature", "location": "agadir_serre_1"},
    {"id": "sensor_vib_001", "type": "vibration", "location": "agadir_serre_1"},
    {"id": "sensor_pres_001", "type": "pression", "location": "agadir_serre_1"},
    {"id": "sensor_hum_001", "type": "humidite", "location": "agadir_serre_1"},
    {"id": "sensor_pow_001", "type": "consommation", "location": "agadir_serre_1"},
    # ── Zone 2 : Dakhla ──
    {"id": "sensor_temp_002", "type": "temperature", "location": "dakhla_station_emballage"},
    {"id": "sensor_vib_002", "type": "vibration", "location": "dakhla_station_emballage"},
    {"id": "sensor_pres_002", "type": "pression", "location": "dakhla_station_emballage"},
    {"id": "sensor_hum_002", "type": "humidite", "location": "dakhla_station_emballage"},
    {"id": "sensor_pow_002", "type": "consommation", "location": "dakhla_station_emballage"},
    # ── Zone 3 : Kenitra ──
    {"id": "sensor_temp_003", "type": "temperature", "location": "kenitra_station_filtrage"},
    {"id": "sensor_vib_003", "type": "vibration", "location": "kenitra_station_filtrage"},
    {"id": "sensor_pres_003", "type": "pression", "location": "kenitra_station_filtrage"},
    {"id": "sensor_hum_003", "type": "humidite", "location": "kenitra_station_filtrage"},
    {"id": "sensor_pow_003", "type": "consommation", "location": "kenitra_station_filtrage"},
    # ── Zone 4 : Tanger Med ──
    {"id": "sensor_temp_004", "type": "temperature", "location": "tangier_med_hub"},
    {"id": "sensor_vib_004", "type": "vibration", "location": "tangier_med_hub"},
    {"id": "sensor_pres_004", "type": "pression", "location": "tangier_med_hub"},
    {"id": "sensor_hum_004", "type": "humidite", "location": "tangier_med_hub"},
    {"id": "sensor_pow_004", "type": "consommation", "location": "tangier_med_hub"},
]

class EmailNotificationService:
    """
    Moteur d'Alertes Email Intelligent, Anti-Saturation (Zéro Spam) et Haute Décision.
    - Règle 1 : Dérive physique continue > 5 minutes (300s).
    - Règle 2 : Équipement hors service / silence radio > 10 minutes (600s).
    - Règle 3 : Batterie critique (< 20%).
    - Cooldown : 1 heure par capteur / type d'incident.
    - Consolidation en rafale (Batching 30s) pour envoyer un seul email synthétique Noir & Blanc.
    """

    DRIFT_THRESHOLD_SEC = 300       # 5 minutes de dérive continue
    OFFLINE_THRESHOLD_SEC = 600     # 10 minutes de silence radio
    BATTERY_CRITICAL_LIMIT = 20.0   # Seuil critique de batterie (%)
    COOLDOWN_SEC = 3600             # 1 heure de temporisation anti-spam
    BATCH_WINDOW_SEC = 30           # Fenêtre de 30s de consolidation

    def __init__(self):
        # Suivi des dérives physiques : { device_id: { "first_seen": ts, "status": str, "val": float, ... } }
        self.drift_trackers: dict[str, dict] = {}
        # Suivi du dernier battement de cœur (heartbeat) pré-initialisé pour les 20 capteurs
        self.heartbeat_trackers: dict[str, dict] = {}
        now = time.time()
        for s in ALL_KNOWN_SENSORS:
            self.heartbeat_trackers[s["id"]] = {
                "last_seen": now,
                "location": s["location"],
                "type": s["type"]
            }

        # Historique des envois pour le Cooldown (1h) : { (device_id, alert_type): last_sent_ts }
        self.cooldown_trackers: dict[tuple, float] = {}
        # File d'attente des alertes qualifiées en attente de consolidation (Batch)
        self.pending_batch: list[dict] = []
        self.batch_timer_start: float | None = None

    def _get_active_recipient(self) -> str | None:
        """
        Recupere l'email destinataire des alertes :
        1. Priorite : Email personnalise verifie dans MongoDB (ex: responsable sur site).
        2. Repli par defaut : Si aucun email verifie n'est configure, utilise ALERT_EMAIL_RECIPIENT ou SMTP_USER depuis .env.
        """
        try:
            cfg = mongo_service.get_alert_recipient_config()
            if cfg.get("is_verified") and cfg.get("email"):
                verified_email = cfg.get("email").strip()
                if verified_email:
                    return verified_email
        except Exception as e:
            print(f"[EmailEngine] Erreur lecture destinataire MongoDB: {e}")

        # Repli par defaut si aucun email personnalise n'est configure
        fallback_email = (settings.ALERT_EMAIL_RECIPIENT or settings.SMTP_USER or "").strip()
        return fallback_email if fallback_email else None

    def process_alert_event(self, alert_data: dict):
        """Traite chaque evenement recu de Kafka et applique les 3 regles de declenchement."""
        device_id = alert_data.get("device_id")
        if not device_id:
            return

        status = alert_data.get("status")
        val = alert_data.get("value", 0.0)
        unit = alert_data.get("unit", "")
        location = alert_data.get("location", "Site AzurA")
        sensor_type = alert_data.get("type") or alert_data.get("device_type", "sensor")
        battery = alert_data.get("battery") if alert_data.get("battery") is not None else alert_data.get("battery_level", 100.0)
        now = time.time()

        # 1. Mise a jour du battement de coeur (Heartbeat)
        self.heartbeat_trackers[device_id] = {
            "last_seen": now,
            "location": location,
            "type": sensor_type
        }

        # ═════════════════════════════════════════════════════════════════════
        # REGLE 1 : DERIVE PHYSIQUE CONTINUE > 5 MINUTES (300 SECONDES)
        # Statuts Spark reconnus : CRITICAL_TEMP_LOW, CRITICAL_TEMP_HIGH,
        # CRITICAL_VIB_LOW, CRITICAL_VIB_HIGH, CRITICAL_PRES_LOW, CRITICAL_PRES_HIGH,
        # CRITICAL_HUM_LOW, CRITICAL_HUM_HIGH, CRITICAL_POW_LOW, CRITICAL_POW_HIGH
        # ═════════════════════════════════════════════════════════════════════

        # Mapping des statuts Spark vers des descriptions humaines lisibles
        DRIFT_STATUS_MAP = {
            "CRITICAL_TEMP_LOW":  "Sous-Temperature / Risque Gel",
            "CRITICAL_TEMP_HIGH": "Sur-Temperature / Surchauffe",
            "CRITICAL_VIB_LOW":   "Vibration Anormalement Basse",
            "CRITICAL_VIB_HIGH":  "Desequilibre Mecanique / Vibrations Excessives",
            "CRITICAL_PRES_LOW":  "Pression Insuffisante",
            "CRITICAL_PRES_HIGH": "Surpression Critique",
            "CRITICAL_HUM_LOW":   "Humidite Anormalement Basse",
            "CRITICAL_HUM_HIGH":  "Humidite Excessive",
            "CRITICAL_POW_LOW":   "Sous-Consommation Electrique",
            "CRITICAL_POW_HIGH":  "Surconsommation Electrique",
        }

        is_drift_status = status in DRIFT_STATUS_MAP

        if is_drift_status:
            drift_label = DRIFT_STATUS_MAP[status]
            if device_id not in self.drift_trackers:
                # Premier evenement en anomalie : on demarre le chronometre
                self.drift_trackers[device_id] = {
                    "first_seen": now,
                    "status": status,
                    "val": val,
                    "unit": unit,
                    "location": location,
                    "type": sensor_type,
                    "drift_label": drift_label
                }
            else:
                track = self.drift_trackers[device_id]
                track["val"] = val
                track["status"] = status
                track["drift_label"] = drift_label
                duration = now - track["first_seen"]

                if duration >= self.DRIFT_THRESHOLD_SEC:
                    cooldown_key = (device_id, "DRIFT")
                    last_sent = self.cooldown_trackers.get(cooldown_key, 0)
                    if (now - last_sent) >= self.COOLDOWN_SEC:
                        self._enqueue_alert({
                            "device_id": device_id,
                            "type": sensor_type,
                            "location": location,
                            "category": "DERIVE PHYSIQUE",
                            "description": f"{drift_label} ({val} {unit})",
                            "duration_str": f"{int(duration // 60)} min {int(duration % 60)} s",
                            "severity": "CRITIQUE"
                        }, cooldown_key)

        elif status == "NORMAL":
            # Si le capteur redevient normal, on reinitialise son suivi de derive
            if device_id in self.drift_trackers:
                del self.drift_trackers[device_id]

        # ═════════════════════════════════════════════════════════════════════
        # REGLE 3 : BATTERIE CRITIQUE (< 20%)
        # Statut Spark reconnu : LOW_BATTERY, ou battery_level < seuil
        # ═════════════════════════════════════════════════════════════════════
        is_battery_critical = (
            (battery is not None and battery < self.BATTERY_CRITICAL_LIMIT)
            or status == "LOW_BATTERY"
        )
        if is_battery_critical:
            cooldown_key = (device_id, "BATTERY")
            last_sent = self.cooldown_trackers.get(cooldown_key, 0)
            if (now - last_sent) >= self.COOLDOWN_SEC:
                self._enqueue_alert({
                    "device_id": device_id,
                    "type": sensor_type,
                    "location": location,
                    "category": "BATTERIE CRITIQUE",
                    "description": f"Niveau de charge critique a {battery}%",
                    "duration_str": "Imminent",
                    "severity": "ATTENTION"
                }, cooldown_key)

        # Vérification du déclenchement du batch
        self._check_batch_flush()

    def check_offline_sensors_cycle(self):
        """Vérifie périodiquement les capteurs muets depuis plus de 10 minutes (RÈGLE 2)."""
        now = time.time()
        for device_id, hb in list(self.heartbeat_trackers.items()):
            silence_duration = now - hb["last_seen"]
            if silence_duration >= self.OFFLINE_THRESHOLD_SEC:
                cooldown_key = (device_id, "OFFLINE")
                last_sent = self.cooldown_trackers.get(cooldown_key, 0)
                if (now - last_sent) >= self.COOLDOWN_SEC:
                    self._enqueue_alert({
                        "device_id": device_id,
                        "type": hb.get("type", "sensor"),
                        "location": hb.get("location", "Site AzurA"),
                        "category": "EQUIPEMENT HORS SERVICE",
                        "description": "Perte de signal telemetrique (Silence Radio)",
                        "duration_str": f"{int(silence_duration // 60)} minutes",
                        "severity": "CRITIQUE"
                    }, cooldown_key)

        self._check_batch_flush()

    def _enqueue_alert(self, alert_item: dict, cooldown_key: tuple):
        """Ajoute une alerte qualifiée dans la file d'attente de consolidation."""
        now = time.time()
        self.cooldown_trackers[cooldown_key] = now
        self.pending_batch.append(alert_item)

        if self.batch_timer_start is None:
            self.batch_timer_start = now
            print(f"[EmailEngine] 📥 Nouvelle alerte qualifiee ({alert_item['device_id']}). Demarrage fenetre de regroupement ({self.BATCH_WINDOW_SEC}s)...")

    def _check_batch_flush(self):
        """Envoie le rapport consolidé si la fenêtre de 30 secondes s'est écoulée."""
        if not self.pending_batch or self.batch_timer_start is None:
            return

        now = time.time()
        if (now - self.batch_timer_start) >= self.BATCH_WINDOW_SEC:
            alerts_to_send = list(self.pending_batch)
            self.pending_batch = []
            self.batch_timer_start = None
            self._send_monochrome_incident_report(alerts_to_send)

    def _send_monochrome_incident_report(self, alerts: list[dict]):
        """Génère et transmet l'email d'incident au format élégant Noir & Blanc avec logo AzurA."""
        recipient = self._get_active_recipient()
        if not recipient or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"[EmailEngine] ⚠️ SMTP ou destinataire non configure. Simulation envoi pour {len(alerts)} alertes a {recipient}")
            # Enregistrement dans l'historique même en simulation
            mongo_service.log_email_notification({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "recipient": recipient or "non_configure@azura.com",
                "subject": f"Alerte Supervision AzurA IoT — {len(alerts)} Equipement(s) Impacte(s)",
                "total_alerts": len(alerts),
                "alerts": alerts
            })
            return False

        try:
            total_incidents = len(alerts)
            subject = f"Alerte Supervision AzurA IoT — {total_incidents} Equipement(s) Impacte(s)"

            # 1. Version Texte Brut
            plain_rows = ""
            for a in alerts:
                plain_rows += f"- [{a['category']}] {a['device_id']} ({a['location']}) : {a['description']} (Duree: {a['duration_str']})\n"

            plain_text = f"""AzurA Group — Plateforme Industrielle de Supervision IoT
RAPPORT OFFICIEL D'INCIDENT TECHNIQUE

Date : {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S UTC')}
Destinataire : {recipient}

Synthèse des alertes qualifiées nécessitant une prise de décision :

{plain_rows}

Mesures recommandées :
1. Consulter le tableau de bord temps réel : http://{settings.VM_PUBLIC_IP or 'localhost'}/
2. Vérifier l'état physique des équipements mentionnés sur site.

--
Support Technique AzurA Group
Plateforme Industrielle de Supervision IoT
"""

            # 2. Version HTML 100% Noir & Blanc (Style Minimaliste & Logo)
            table_rows_html = ""
            for a in alerts:
                table_rows_html += f"""
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding: 12px 14px; font-weight: 800; color: #111827; font-family: monospace; font-size: 13px;">
                        {a['device_id']}
                    </td>
                    <td style="padding: 12px 14px; color: #111827; font-size: 12px; font-weight: 700;">
                        <span style="display: inline-block; padding: 2px 8px; border: 1px solid #111827; border-radius: 4px; font-size: 10.5px;">
                            {a['category']}
                        </span>
                    </td>
                    <td style="padding: 12px 14px; color: #374151; font-size: 12px;">
                        <strong>{a['description']}</strong><br/>
                        <span style="color: #6B7280; font-size: 11px;">Durée : {a['duration_str']}</span>
                    </td>
                    <td style="padding: 12px 14px; color: #4B5563; font-size: 12px;">
                        {a['location']}
                    </td>
                </tr>
                """

            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport d'Incident AzurA IoT</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
    <div style="max-width: 620px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #000000; border-radius: 12px; padding: 32px 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        
        <!-- EN-TÊTE NOIR & BLANC AVEC LOGO -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom: 2px solid #000000; padding-bottom: 20px; margin-bottom: 24px;">
            <tr>
                <td align="left" style="vertical-align: middle;">
                    <img src="cid:azura_logo" alt="Logo AzurA" style="height: 36px; width: auto; display: block;" />
                </td>
                <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 14px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000000;">
                        RAPPORT D'INCIDENT IOT
                    </div>
                    <div style="font-size: 11px; color: #6B7280; margin-top: 4px;">
                        {datetime.now(timezone.utc).strftime('%d/%m/%Y - %H:%M:%S UTC')}
                    </div>
                </td>
            </tr>
        </table>

        <p style="font-size: 13.5px; line-height: 1.5; color: #111827; margin: 0 0 16px 0;">
            Bonjour,
        </p>
        <p style="font-size: 13.5px; line-height: 1.5; color: #374151; margin: 0 0 20px 0;">
            Le moteur de surveillance AzurA IoT a qualifié <strong>{total_incidents} anomalie(s) critique(s)</strong> confirmée(s) selon les règles d'exploitation industrielle :
        </p>

        <!-- TABLEAU DES INCIDENTS (NOIR & BLANC ÉPURÉ) -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
            <thead>
                <tr style="background-color: #000000; color: #FFFFFF;">
                    <th align="left" style="padding: 10px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Equipement</th>
                    <th align="left" style="padding: 10px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Type</th>
                    <th align="left" style="padding: 10px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Constat & Duree</th>
                    <th align="left" style="padding: 10px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Zone</th>
                </tr>
            </thead>
            <tbody>
                {table_rows_html}
            </tbody>
        </table>

        <!-- ACTIONS RECOMMANDÉES -->
        <div style="background-color: #F9FAFB; border: 1px solid #000000; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: #000000;">
                Actions Recommandees :
            </div>
            <div style="font-size: 12.5px; color: #374151; line-height: 1.5;">
                • Accéder à la plateforme de télémétrie : <a href="http://{settings.VM_PUBLIC_IP or 'localhost'}/" style="color: #000000; font-weight: 700; text-decoration: underline;">Supervision Temps Réel</a><br/>
                • Effectuer une vérification physique sur site pour les équipements signalés ci-dessus.
            </div>
        </div>

        <!-- PIED DE PAGE -->
        <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 11px; color: #6B7280; text-align: center;">
            © 2026 AzurA Group — Plateforme Industrielle de Supervision IoT Temps Réel
        </div>

    </div>
</body>
</html>
"""

            # 3. Construction des en-têtes RFC standards
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_USER
            msg["Reply-To"] = settings.SMTP_USER
            msg["To"] = recipient
            msg["Date"] = email.utils.formatdate(localtime=True)
            msg["Message-ID"] = email.utils.make_msgid(domain="gmail.com")

            alt_part = MIMEMultipart("alternative")
            alt_part.attach(MIMEText(plain_text, "plain", "utf-8"))
            alt_part.attach(MIMEText(html_content, "html", "utf-8"))
            msg.attach(alt_part)

            # Intégration du logo en pièce jointe inline CID
            logo_paths = [
                "/app/assets/azura_logo.png",
                "assets/azura_logo.png",
                "webapp/backend/assets/azura_logo.png",
                "webapp/frontend/public/azura_logo.png"
            ]
            for lp in logo_paths:
                if os.path.exists(lp):
                    try:
                        with open(lp, "rb") as img_f:
                            img = MIMEImage(img_f.read(), name="azura_logo.png")
                            img.add_header("Content-ID", "<azura_logo>")
                            img.add_header("Content-Disposition", "inline", filename="azura_logo.png")
                            msg.attach(img)
                        break
                    except Exception as ex:
                        print(f"[EmailEngine] Erreur attachement logo CID: {ex}")

            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, recipient, msg.as_string())
            server.quit()

            # Enregistrement dans l'historique MongoDB
            mongo_service.log_email_notification({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "recipient": recipient,
                "subject": subject,
                "total_alerts": total_incidents,
                "alerts": alerts
            })

            print(f"[EmailEngine] ✉️ Rapport d'incident Noir & Blanc envoyé avec succès ({total_incidents} alertes) à {recipient} !")
            return True

        except Exception as e:
            print(f"[EmailEngine] ❌ Échec transmission rapport d'incident : {e}")
            return False

    def send_otp_verification_email(self, recipient_email: str, otp_code: str) -> bool:
        """Envoie un email de vérification OTP en TEXTE BRUT pur pour une délivrabilité maximale."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"[EmailService] ⚠️ SMTP non configuré. Simulation Code OTP pour {recipient_email} : {otp_code}")
            return True

        try:
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
