import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ShieldCheck, WarningOctagon, Waveform, ArrowUp, ArrowDown, WifiSlash } from "@phosphor-icons/react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { RollingTime } from "./RollingTime";
import { AlertsKafkaTable } from "./AlertsKafkaTable";

// Seuils industriels nominaux conformes aux standards d'exploitation AzurA
const SENSOR_THRESHOLDS = {
  temperature:  { min: 5.0,   max: 80.0,  unit: "°C",   label: "Temperature" },
  vibration:    { min: 0.0,   max: 5.0,   unit: "mm/s", label: "Vibration" },
  pression:     { min: 1.0,   max: 10.0,  unit: "bar",  label: "Pression" },
  humidite:     { min: 30.0,  max: 70.0,  unit: "%",    label: "Humidite" },
  consommation: { min: 100.0, max: 500.0, unit: "kW",   label: "Puissance" },
};

// Référentiel des 20 capteurs industriels déployés sur les 4 zones AzurA
const ALL_SENSORS_METADATA = [
  // ZONE 1 : Agadir
  { id: "sensor_temp_001", type: "temperature",  location: "agadir_serre_1" },
  { id: "sensor_vib_001",  type: "vibration",    location: "agadir_serre_1" },
  { id: "sensor_pres_001", type: "pression",     location: "agadir_serre_1" },
  { id: "sensor_hum_001",  type: "humidite",     location: "agadir_serre_1" },
  { id: "sensor_pow_001",  type: "consommation", location: "agadir_serre_1" },

  // ZONE 2 : Dakhla
  { id: "sensor_temp_002", type: "temperature",  location: "dakhla_station_emballage" },
  { id: "sensor_vib_002",  type: "vibration",    location: "dakhla_station_emballage" },
  { id: "sensor_pres_002", type: "pression",     location: "dakhla_station_emballage" },
  { id: "sensor_hum_002",  type: "humidite",     location: "dakhla_station_emballage" },
  { id: "sensor_pow_002",  type: "consommation", location: "dakhla_station_emballage" },

  // ZONE 3 : Kenitra
  { id: "sensor_temp_003", type: "temperature",  location: "kenitra_station_filtrage" },
  { id: "sensor_vib_003",  type: "vibration",    location: "kenitra_station_filtrage" },
  { id: "sensor_pres_003", type: "pression",     location: "kenitra_station_filtrage" },
  { id: "sensor_hum_003",  type: "humidite",     location: "kenitra_station_filtrage" },
  { id: "sensor_pow_003",  type: "consommation", location: "kenitra_station_filtrage" },

  // ZONE 4 : Tanger Med
  { id: "sensor_temp_004", type: "temperature",  location: "tangier_med_hub" },
  { id: "sensor_vib_004",  type: "vibration",    location: "tangier_med_hub" },
  { id: "sensor_pres_004", type: "pression",     location: "tangier_med_hub" },
  { id: "sensor_hum_004",  type: "humidite",     location: "tangier_med_hub" },
  { id: "sensor_pow_004",  type: "consommation", location: "tangier_med_hub" },
];

// Diagnostics explicites orientes metier/operateur
const SENSOR_DIAGNOSTICS = {
  CRITICAL_TEMP_HIGH: "Surchauffe Machine",
  CRITICAL_TEMP_LOW:  "Sous-Temperature / Risque Gel",
  CRITICAL_VIB_HIGH:  "Desequilibre Mecanique",
  CRITICAL_VIB_LOW:   "Anomalie Capteur Vibration",
  CRITICAL_PRES_HIGH: "Surpression Circuit",
  CRITICAL_PRES_LOW:  "Chute Pression / Fuite",
  CRITICAL_HUM_HIGH:  "Sur-Humidite / Condensation",
  CRITICAL_HUM_LOW:   "Air Excessif Sec",
  CRITICAL_POW_HIGH:  "Surconsommation Electrique",
  CRITICAL_POW_LOW:   "Chute Alimentation / Sous-Tension",
  LOW_BATTERY:        "Niveau Batterie Faible",
  HIGH:               "Depassement de Seuil Haut",
  LOW:                "Chute en-dessous de Seuil Bas",
  ANOMALY:            "Derive Critique"
};

// Palette de 8 couleurs vives et 100% DISTINCTES pour les lignes d'alerte des capteurs
const SENSOR_ID_COLORS = [
  "#ef4444", // 1. Rouge Vif
  "#06b6d4", // 2. Cyan Electrique
  "#f59e0b", // 3. Ambre Brillant
  "#8b5cf6", // 4. Violet Neon
  "#10b981", // 5. Emeraude
  "#3b82f6", // 6. Bleu Royal
  "#e879f9", // 7. Fuchsia Lumineux
  "#fdba74", // 8. Peche Electrique
];

/**
 * Normalise et convertit de manière sécurisée tout format d'horodatage en millisecondes epoch
 */
function parseTimestamp(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const normalized = ts.includes(" ") ? ts.replace(" ", "T") : ts;
    const ms = new Date(normalized).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/**
 * Calcule l'indice de gravite (Severity & Deviation Index) en % de depassement au-dela du seuil critique dynamique
 */
function calculateSeverityIndex(value, deviceType, dynamicThresholds = null) {
  const currentThresholds = dynamicThresholds || SENSOR_THRESHOLDS;
  const t = currentThresholds[deviceType] || { min: 0, max: 100 };
  const minVal = Number(t.min);
  const maxVal = Number(t.max);
  const span = (maxVal - minVal) || 1;

  if (value > maxVal) {
    const deviation = ((value - maxVal) / span) * 100;
    return {
      severity: Math.max(1, deviation),
      direction: "HIGH",
      directionColor: "#ef4444", // Rouge pour Depassement Haut
      badge: "HAUT",
      thresholdVal: maxVal
    };
  } else if (value < minVal) {
    const deviation = ((minVal - value) / span) * 100;
    return {
      severity: Math.max(1, deviation),
      direction: "LOW",
      directionColor: "#06b6d4", // Cyan pour Chute Basse
      badge: "BAS",
      thresholdVal: minVal
    };
  }

  return {
    severity: 0,
    direction: "NORMAL",
    directionColor: "#22c55e",
    badge: "NOMINAL",
    thresholdVal: maxVal
  };
}

export function RealTimeAnalytics() {
  const [sensorSeries, setSensorSeries] = useState({});
  const [rawAlerts, setRawAlerts] = useState([]);
  const [latestSensorsState, setLatestSensorsState] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dynamicThresholds, setDynamicThresholds] = useState(null);
  // Horodatage reel courant pour l'axe X glissant et le heartbeat (mise a jour chaque 1s)
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [hoveredData, setHoveredData] = useState(null);
  const svgRef = useRef(null);

  const width = 960;
  const height = 330;
  const padding = { top: 35, right: 40, bottom: 50, left: 105 };

  // Chargement / Rafraîchissement périodique des seuils depuis MongoDB (Single Source of Truth)
  useEffect(() => {
    const fetchThresholds = () => {
      fetch("/api/settings/thresholds")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.thresholds) {
            setDynamicThresholds(data.thresholds);
          }
        })
        .catch(() => {});
    };
    fetchThresholds();
    const interval = setInterval(fetchThresholds, 2500);
    return () => clearInterval(interval);
  }, []);

  // Horloge temps reel continue : fait avancer l'axe X et déclenche le contrôle de heartbeat chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recalcul immediat des series et cartes d alertes lors d un changement de seuil
  useEffect(() => {
    if (!dynamicThresholds) return;
    setSensorSeries(prev => {
      const next = {};
      Object.entries(prev).forEach(([sId, series]) => {
        const remappedPoints = (series.points || []).map(p => {
          const sevInfo = calculateSeverityIndex(p.value, p.deviceType, dynamicThresholds);
          return {
            ...p,
            severity: sevInfo.severity,
            direction: sevInfo.direction,
            directionColor: sevInfo.directionColor,
            thresholdVal: sevInfo.thresholdVal
          };
        });
        const lastPt = remappedPoints[remappedPoints.length - 1];
        next[sId] = {
          ...series,
          points: remappedPoints,
          direction: lastPt ? lastPt.direction : series.direction,
          directionColor: lastPt ? lastPt.directionColor : series.directionColor
        };
      });
      return next;
    });
  }, [dynamicThresholds]);

  // Fonction d'ajout et de synchronisation des alertes
  const processAlertsBatch = useCallback((alerts) => {
    if (!Array.isArray(alerts) || alerts.length === 0) return;

    setRawAlerts((prev) => {
      const combined = [...alerts, ...prev];
      const unique = [];
      const seen = new Set();
      for (const item of combined) {
        const key = `${item.device_id}-${item.timestamp}-${item.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      }
      return unique.slice(0, 50);
    });

    setSensorSeries((prev) => {
      const updated = { ...prev };
      const now = Date.now();

      alerts.forEach((alert) => {
        const devId = alert.device_id;
        if (!devId) return;

        const val = typeof alert.value === "number" ? alert.value : 0;
        const devType = alert.device_type || "temperature";
        const status = alert.status || "ANOMALY";
        const dynCfg = dynamicThresholds && dynamicThresholds[devType];
        const unit = alert.unit || (dynCfg ? dynCfg.unit : (SENSOR_THRESHOLDS[devType] ? SENSOR_THRESHOLDS[devType].unit : ""));
        const location = alert.location || "Site AzurA";

        // Calcul de la gravite par rapport aux seuils dynamiques
        const sevInfo = calculateSeverityIndex(val, devType, dynamicThresholds);
        const diagnostic = SENSOR_DIAGNOSTICS[status] || "Derive Operationnelle";

        // Conversion horodatage sécurisée
        const timeMs = parseTimestamp(alert.timestamp) || now;

        if (!updated[devId]) {
          updated[devId] = {
            device_id: devId,
            device_type: devType,
            location: location,
            unit: unit,
            points: [],
            lastUpdated: timeMs,
            status: status,
            diagnostic: diagnostic,
            directionColor: sevInfo.directionColor,
            direction: sevInfo.direction
          };
        }

        const pts = updated[devId].points;
        // Evite les doublons stricts sur la meme seconde
        const exists = pts.some(p => Math.abs(p.time - timeMs) < 600);
        if (!exists) {
          pts.push({
            time: timeMs,
            value: val,
            severity: sevInfo.severity,
            direction: sevInfo.direction,
            status: status,
            diagnostic: diagnostic,
            deviceId: devId,
            deviceType: devType,
            unit: unit,
            location: location,
            directionColor: sevInfo.directionColor,
            thresholdVal: sevInfo.thresholdVal
          });

          // Trie par ordre chronologique et conserve les 60 derniers points
          pts.sort((a, b) => a.time - b.time);
          updated[devId].points = pts.slice(-60);
          updated[devId].lastUpdated = Math.max(updated[devId].lastUpdated, timeMs);
          updated[devId].status = status;
          updated[devId].diagnostic = diagnostic;
          updated[devId].directionColor = sevInfo.directionColor;
          updated[devId].direction = sevInfo.direction;
        }
      });

      return updated;
    });
  }, [dynamicThresholds]);

  // Synchronisation manuelle ou automatique (Live Refresh sans recharger la page)
  const syncLatestAlerts = useCallback((isManual = false) => {
    if (isManual) setIsRefreshing(true);

    fetch("/api/stats/recent-alerts")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.alerts)) {
          processAlertsBatch(data.alerts);
        }
      })
      .catch(() => {});

    fetch("/api/stats/sensors-state")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          const stateObj = {};
          if (data.history && typeof data.history === "object") {
            Object.entries(data.history).forEach(([sId, pts]) => {
              if (Array.isArray(pts) && pts.length > 0) {
                const last = pts[pts.length - 1];
                stateObj[sId] = {
                  ...last,
                  latestTimestamp: parseTimestamp(last.timestamp)
                };
              }
            });
          }
          if (data.latest) {
            const list = Array.isArray(data.latest) ? data.latest : Object.values(data.latest);
            list.forEach((item) => {
              if (item && item.device_id) {
                stateObj[item.device_id] = {
                  ...item,
                  latestTimestamp: parseTimestamp(item.timestamp)
                };
              }
            });
          }
          setLatestSensorsState((prev) => ({ ...prev, ...stateObj }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isManual) {
          setTimeout(() => setIsRefreshing(false), 600);
        }
      });
  }, [processAlertsBatch]);

  useEffect(() => {
    syncLatestAlerts(false);
    const interval = setInterval(() => syncLatestAlerts(false), 2500);
    return () => clearInterval(interval);
  }, [syncLatestAlerts]);

  // Reception synchrone en direct par flux continu WebSocket des alertes
  const handleAlertMessage = useCallback((msg) => {
    if (!msg) return;
    if (msg.type === "INITIAL_ALERTS_HISTORY" && Array.isArray(msg.data)) {
      processAlertsBatch(msg.data);
    } else if ((msg.type === "NEW_ALERT" || msg.type === "ALERT_NOTIFICATION") && msg.data) {
      processAlertsBatch([msg.data]);
    }
  }, [processAlertsBatch]);

  const { isConnected } = useWebSocket("/ws/alerts", handleAlertMessage);

  // Reception synchrone en direct par flux continu WebSocket de la telemetrie des 20 capteurs
  const handleSensorMessage = useCallback((msg) => {
    if (!msg) return;
    if (msg.type === "INITIAL_SENSORS_STATE" || msg.type === "INITIAL_SENSORS_HISTORY") {
      const stateObj = {};
      if (msg.history && typeof msg.history === "object") {
        Object.entries(msg.history).forEach(([sId, pts]) => {
          if (Array.isArray(pts) && pts.length > 0) {
            const last = pts[pts.length - 1];
            stateObj[sId] = {
              ...last,
              latestTimestamp: parseTimestamp(last.timestamp)
            };
          }
        });
      }
      if (msg.data) {
        const list = Array.isArray(msg.data) ? msg.data : Object.values(msg.data);
        list.forEach((item) => {
          if (item && item.device_id) {
            stateObj[item.device_id] = {
              ...item,
              latestTimestamp: parseTimestamp(item.timestamp)
            };
          }
        });
      }
      setLatestSensorsState((prev) => ({ ...prev, ...stateObj }));
    } else if (msg.type === "SENSOR_UPDATE" || msg.type === "TELEMETRY_UPDATE") {
      const d = msg.data;
      if (d && d.device_id) {
        setLatestSensorsState((prev) => ({
          ...prev,
          [d.device_id]: {
            ...d,
            latestTimestamp: Date.now()
          }
        }));
      }
    }
  }, []);

  useWebSocket("/ws/sensors", handleSensorMessage);

  // Fenetre glissante de temps reel : 2 minutes visibles a l'ecran
  const windowDurationMs = 120000;
  const minTime = currentTime - windowDurationMs;
  const maxTime = currentTime + 4000;
  const timeRange = maxTime - minTime;

  // Capteurs actifs ayant emis une alerte dans les 45 dernieres secondes
  // et dont le dernier point est REELLEMENT une anomalie de depassement physique (HIGH ou LOW) par rapport aux seuils actuels
  const rawActive = useMemo(() => {
    const list = Object.values(sensorSeries).filter((s) => {
      const recentPoints = (s.points || []).filter((p) => p.time >= currentTime - 45000);
      if (recentPoints.length === 0) return false;
      const latestPt = recentPoints[recentPoints.length - 1];
      return latestPt && latestPt.severity > 0 && (latestPt.direction === "HIGH" || latestPt.direction === "LOW");
    });
    list.sort((a, b) => (a.device_id || "").localeCompare(b.device_id || ""));
    return list;
  }, [sensorSeries, currentTime]);

  // Attribution d'une couleur UNIQUE garantie sans collision a chaque capteur actif sur le graphique
  const activeSensors = useMemo(() => {
    return rawActive.map((sensor, idx) => {
      const assignedColor = SENSOR_ID_COLORS[idx % SENSOR_ID_COLORS.length];
      return {
        ...sensor,
        uniqueColor: assignedColor,
        points: (sensor.points || []).map((pt) => ({
          ...pt,
          uniqueColor: assignedColor,
        })),
      };
    });
  }, [rawActive]);

  const activeCount = activeSensors.length;

  // Cartes d'équipements en anomalie globale : Dérives Physiques (HIGH/LOW) + Batterie Faible + Silence Radio (Perte de connexion)
  const allProblematicCards = useMemo(() => {
    const cards = [];
    const seenDevices = new Set();

    // 1. Capteurs en Dérive Physique de Valeur (HIGH / LOW)
    activeSensors.forEach((series) => {
      seenDevices.add(series.device_id);
      const lastPt = series.points[series.points.length - 1];
      const isHigh = series.direction === "HIGH";
      cards.push({
        device_id: series.device_id,
        device_type: SENSOR_THRESHOLDS[series.device_type] ? SENSOR_THRESHOLDS[series.device_type].label : series.device_type,
        location: series.location,
        diagnostic: series.diagnostic || (isHigh ? "Depassement de Seuil Haut" : "Chute de Seuil Bas"),
        issueType: "PHYSICAL",
        isHigh: isHigh,
        color: series.uniqueColor,
        displayValue: `${lastPt ? lastPt.value : 0}`,
        unit: series.unit,
        badgeText: isHigh ? `+${lastPt ? lastPt.severity.toFixed(0) : 0}%` : `-${lastPt ? lastPt.severity.toFixed(0) : 0}%`,
        badgeColor: isHigh ? "#ef4444" : "#06b6d4",
        badgeBg: isHigh ? "rgba(239, 68, 68, 0.1)" : "rgba(6, 182, 212, 0.1)",
        barPercent: Math.min(100, Math.max(15, (lastPt ? lastPt.severity : 0) * 1.5))
      });
    });

    // 2. Capteurs en Perte de Connexion / Silence Radio (> 9s) ou Batterie Faible (< 20%)
    ALL_SENSORS_METADATA.forEach((meta) => {
      const sId = meta.id;
      if (seenDevices.has(sId)) return;

      const liveSensor = latestSensorsState[sId];
      if (!liveSensor) return;

      const timeMs = liveSensor.latestTimestamp || parseTimestamp(liveSensor.timestamp);
      const timeSince = currentTime - timeMs;
      const isOffline = timeMs > 0 && timeSince > 9000;
      const bLevel = liveSensor.battery_level !== undefined ? Number(liveSensor.battery_level) : 100;
      const isLowBattery = liveSensor.status === "LOW_BATTERY" || bLevel < 20.0;

      if (isOffline) {
        seenDevices.add(sId);
        const devType = meta.type || liveSensor.device_type || "temperature";
        cards.push({
          device_id: sId,
          device_type: SENSOR_THRESHOLDS[devType]?.label || devType,
          location: meta.location || liveSensor.location || "Site AzurA",
          diagnostic: "Silence Radio / Hors Ligne",
          issueType: "OFFLINE",
          color: "#ef4444",
          displayValue: "Hors Ligne",
          unit: "",
          badgeText: "SIGNAL PERDU",
          badgeColor: "#ef4444",
          badgeBg: "rgba(239, 68, 68, 0.1)",
          barPercent: 100
        });
      } else if (isLowBattery) {
        seenDevices.add(sId);
        const devType = meta.type || liveSensor.device_type || "temperature";
        cards.push({
          device_id: sId,
          device_type: SENSOR_THRESHOLDS[devType]?.label || devType,
          location: meta.location || liveSensor.location || "Site AzurA",
          diagnostic: "Niveau Batterie Critique (< 20%)",
          issueType: "BATTERY",
          color: "#f59e0b",
          displayValue: `${bLevel.toFixed(1)}`,
          unit: "%",
          badgeText: "CRITIQUE",
          badgeColor: "#f59e0b",
          badgeBg: "rgba(245, 158, 11, 0.12)",
          barPercent: Math.max(10, ((20 - bLevel) / 20) * 100)
        });
      }
    });

    return cards;
  }, [activeSensors, latestSensorsState, currentTime]);

  // Liste des alertes physiques UNIQUEMENT (HIGH et LOW) pour le Journal des Incidents
  const activeAlertsList = useMemo(() => {
    return rawAlerts.filter((al) => {
      const statusStr = String(al.status || "").toUpperCase();
      const directionStr = String(al.direction || "").toUpperCase();
      if (statusStr === "LOW_BATTERY" || directionStr === "LOW_BATTERY" || (al.battery_level !== undefined && al.battery_level < 20.0)) {
        return false;
      }
      if (!dynamicThresholds) return true;
      const devType = al.device_type || al.metric;
      const val = typeof al.value === "number" ? al.value : typeof al.current_value === "number" ? al.current_value : 0;
      const sevInfo = calculateSeverityIndex(val, devType, dynamicThresholds);
      return sevInfo.direction === "HIGH" || sevInfo.direction === "LOW";
    });
  }, [rawAlerts, dynamicThresholds]);

  const getX = (time) => {
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right);
  };

  // Echelle Y de Gravite : de 0% (seuil d'alerte) a 60%+ (depassement extreme)
  const maxObservedSeverity = Math.max(35, ...activeSensors.flatMap(s => s.points.map(p => p.severity)));
  const yMaxGravity = Math.ceil(maxObservedSeverity / 10) * 10 + 5;

  const getY = (sevVal) => {
    const clamped = Math.max(0, Math.min(yMaxGravity, sevVal));
    const ratio = clamped / yMaxGravity;
    return padding.top + (1 - ratio) * (height - padding.top - padding.bottom);
  };

  // Horodatages gradués sur l'Axe X (HH:mm:ss rafraichis en continu chaque seconde)
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const t = minTime + ratio * (maxTime - minTime);
    const timeStr = new Date(t).toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { time: t, label: timeStr, x: getX(t) };
  });

  // Graduations de l'Axe Y de Gravite
  const step = yMaxGravity / 4;
  const yTicks = [
    { val: yMaxGravity, label: `+${yMaxGravity.toFixed(0)}% (Critique)` },
    { val: step * 3,    label: `+${(step * 3).toFixed(0)}% (Eleve)` },
    { val: step * 2,    label: `+${(step * 2).toFixed(0)}% (Modere)` },
    { val: step,        label: `+${step.toFixed(0)}% (Faible)` },
    { val: 0,           label: `0% [Seuil]` },
  ];

  // Points visibles pour l'infobulle interactif
  const visiblePoints = activeSensors.flatMap((s) => s.points.filter((p) => p.time >= minTime && p.time <= maxTime));

  // Pointage 2D de haute precision : trouve le point le plus proche selon X ET Y
  const handleMouseMove = (e) => {
    if (!svgRef.current || visiblePoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * height;

    let closestPoint = null;
    let minDistance2D = Infinity;

    visiblePoints.forEach((pt) => {
      const px = getX(pt.time);
      const py = getY(pt.severity);
      
      const dx = px - mouseX;
      const dy = py - mouseY;
      const dist2D = Math.sqrt(dx * dx + dy * dy * 2.2);

      if (dist2D < minDistance2D && dist2D < 45) {
        minDistance2D = dist2D;
        closestPoint = pt;
      }
    });

    setHoveredData(closestPoint);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Panneau Principal du Graphique Telemetrique */}
      <div style={{
        backgroundColor: "var(--azura-card-bg)",
        border: "1px solid var(--azura-border)",
        borderRadius: "18px",
        padding: "24px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
      }}>
        {/* Entete du Graphique : Titre Centre & Epure */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          marginBottom: "18px",
          gap: "6px"
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "4px 16px",
            borderRadius: "9999px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
          }}>
            <Waveform size={24} weight="bold" style={{ color: "var(--azura-accent-red)", filter: "drop-shadow(0 0 8px rgba(239, 68, 68, 0.45))" }} />
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--azura-text)",
              margin: 0,
              letterSpacing: "-0.02em",
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              Dynamique des Derives d'Anomalies
            </h2>
          </div>
        </div>

        {/* Surface Graphique SVG */}
        <div style={{ position: "relative", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "14px", padding: "16px 12px" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: "100%", height: "auto", display: "block", overflow: "hidden", cursor: "crosshair" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredData(null)}
          >
            <defs>
              <linearGradient id="gridGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
                <stop offset="40%" stopColor="#ef4444" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
              </linearGradient>
              <clipPath id="chartPlotAreaClip">
                <rect x={padding.left} y={padding.top} width={width - padding.left - padding.right} height={height - padding.top - padding.bottom} />
              </clipPath>
            </defs>

            {/* Zone d'Alerte Gradient */}
            <rect
              x={padding.left}
              y={padding.top}
              width={width - padding.left - padding.right}
              height={height - padding.top - padding.bottom}
              fill="url(#gridGlow)"
              rx="8"
            />

            {/* Lignes Horizontales Y (Graduations de Gravite) */}
            {yTicks.map((tick, i) => {
              const y = getY(tick.val);
              const isBase = tick.val === 0;
              return (
                <g key={`ytick-${i}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={isBase ? "#ef4444" : "var(--azura-border)"}
                    strokeWidth={isBase ? "2" : "1"}
                    strokeDasharray={isBase ? "none" : "4 4"}
                    opacity={isBase ? "0.85" : "0.5"}
                  />
                  <text
                    x={padding.left - 12}
                    y={y + 4}
                    fill={isBase ? "#ef4444" : "var(--azura-text-muted)"}
                    fontSize="11"
                    fontWeight={isBase ? "800" : "600"}
                    textAnchor="end"
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Lignes Verticales X (Temps Reel Dynamique) */}
            {timeTicks.map((tick, i) => (
              <g key={`xtick-${i}`}>
                <line
                  x1={tick.x}
                  y1={padding.top}
                  x2={tick.x}
                  y2={height - padding.bottom}
                  stroke="var(--azura-border)"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  opacity="0.4"
                />
                <text
                  x={tick.x}
                  y={height - padding.bottom + 22}
                  fill="var(--azura-text-muted)"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Axe Horizontal de Base (Seuil Critique 0%) */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="var(--azura-border)"
              strokeWidth="1.5"
            />

            {/* Trace des courbes de derive (Clip Path Strict) */}
            {activeCount === 0 ? (
              <g transform={`translate(${padding.left + (width - padding.left - padding.right) / 2}, ${padding.top + (height - padding.top - padding.bottom) / 2})`}>
                <circle cx="-160" cy="0" r="5" fill="#22c55e" />
                <circle cx="-160" cy="0" r="9" fill="#22c55e" opacity="0.25" />
                <text
                  x="-142"
                  y="4"
                  fill="var(--azura-text)"
                  fontSize="12.5"
                  fontWeight="700"
                  textAnchor="start"
                  letterSpacing="0.02em"
                >
                  Systeme AzurA Nominal — Aucun depassement de seuil
                </text>
              </g>
            ) : (
              <g clipPath="url(#chartPlotAreaClip)">
                {activeSensors.map((series) => {
                  const pts = series.points.filter((p) => p.time >= minTime - 5000 && p.time <= maxTime + 5000);
                  if (pts.length === 0) return null;

                  const lineColor = series.directionColor;
                  const isThisHovered = hoveredData && hoveredData.deviceId === series.device_id;
                  const hasAnyHover = !!hoveredData;

                  const strokeOpacity = isThisHovered ? 1 : hasAnyHover ? 0.3 : 0.85;
                  const strokeWidth = isThisHovered ? 4.5 : 3.0;

                  const dPath = pts
                    .map((pt, i) => {
                      const x = getX(pt.time);
                      const y = getY(pt.severity);
                      return `${i === 0 ? "M" : "L"} ${x},${y}`;
                    })
                    .join(" ");

                  return (
                    <path
                      key={`path-${series.device_id}`}
                      d={dPath}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        filter: isThisHovered ? `drop-shadow(0 0 10px ${lineColor})` : `drop-shadow(0 0 4px ${lineColor})`,
                        transition: "all 0.15s ease-out"
                      }}
                    />
                  );
                })}
              </g>
            )}

            {/* Tetes de Courbes Colorees 100% DISTINCTES par Capteur */}
            {activeSensors.map((series) => {
              const pts = series.points;
              if (pts.length === 0) return null;
              const lastPt = pts[pts.length - 1];
              if (lastPt.time < minTime) return null;

              const lastX = Math.max(padding.left, Math.min(width - padding.right, getX(lastPt.time)));
              const lastY = getY(lastPt.severity);
              const headColor = series.uniqueColor;
              const isThisHovered = hoveredData && hoveredData.deviceId === series.device_id;

              return (
                <g key={`head-${series.device_id}`}>
                  <circle
                    cx={lastX}
                    cy={lastY}
                    r={isThisHovered ? 10 : 7}
                    fill={headColor}
                    opacity={isThisHovered ? 0.45 : 0.25}
                    style={{ filter: `drop-shadow(0 0 8px ${headColor})` }}
                  />
                  <circle
                    cx={lastX}
                    cy={lastY}
                    r={isThisHovered ? 6.5 : 5}
                    fill={headColor}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{ filter: `drop-shadow(0 0 6px ${headColor})` }}
                  />
                </g>
              );
            })}

            {/* Reticule de Survol (Hover Crosshair) */}
            {hoveredData && (
              <g style={{ pointerEvents: "none" }}>
                <line
                  x1={getX(hoveredData.time)}
                  y1={padding.top}
                  x2={getX(hoveredData.time)}
                  y2={height - padding.bottom}
                  stroke={hoveredData.uniqueColor}
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                  opacity="0.6"
                />
                <circle
                  cx={getX(hoveredData.time)}
                  cy={getY(hoveredData.severity)}
                  r="6.5"
                  fill="none"
                  stroke={hoveredData.uniqueColor}
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>

          {/* Infobulle de Survol */}
          {hoveredData && (
            <div
              style={{
                position: "absolute",
                left: `${Math.max(110, Math.min(width - 190, getX(hoveredData.time)))}px`,
                top: `${Math.max(15, getY(hoveredData.severity) - 75)}px`,
                transform: "translateX(-50%)",
                backgroundColor: "var(--azura-card-bg)",
                border: `1.5px solid ${hoveredData.uniqueColor}`,
                borderRadius: "8px",
                padding: "8px 12px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
                pointerEvents: "none",
                zIndex: 25,
                minWidth: "160px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: hoveredData.uniqueColor,
                    boxShadow: `0 0 6px ${hoveredData.uniqueColor}`
                  }} />
                  <span style={{ fontWeight: 800, color: "var(--azura-text)", fontSize: "0.85rem" }}>
                    {hoveredData.deviceId}
                  </span>
                </div>
                <span style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: hoveredData.directionColor,
                  backgroundColor: `${hoveredData.directionColor}18`,
                  padding: "1px 5px",
                  borderRadius: "4px",
                  letterSpacing: "0.5px"
                }}>
                  {hoveredData.direction === "HIGH" ? "HAUT" : "BAS"}
                </span>
              </div>

              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: hoveredData.uniqueColor, lineHeight: 1.1 }}>
                {hoveredData.value} {hoveredData.unit}
              </div>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "4px",
                paddingTop: "4px",
                borderTop: "1px solid var(--azura-border)"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: hoveredData.directionColor }}>
                  Derive: +{hoveredData.severity.toFixed(1)}%
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--azura-text-muted)", fontFamily: "monospace" }}>
                  {new Date(hoveredData.time).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Barre Inferieure de Controles & Statuts Integree au Cadre */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid var(--azura-border)",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* 1. Badge Statut Flux Continu */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "12px",
                backgroundColor: isConnected ? "rgba(34, 197, 94, 0.09)" : "rgba(239, 68, 68, 0.09)",
                border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
                cursor: "default",
                userSelect: "none"
              }}
            >
              <span style={{
                position: "relative",
                display: "inline-flex",
                width: "8px",
                height: "8px"
              }}>
                {isConnected && (
                  <span style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    opacity: 0.75,
                    animation: "ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite"
                  }} />
                )}
                <span style={{
                  position: "relative",
                  borderRadius: "50%",
                  width: "8px",
                  height: "8px",
                  backgroundColor: isConnected ? "#22c55e" : "#ef4444",
                  boxShadow: isConnected ? "0 0 8px #22c55e" : "none"
                }} />
              </span>
              <span style={{
                color: isConnected ? "#15803d" : "#b91c1c",
                fontSize: "0.82rem",
                fontWeight: 750,
                letterSpacing: "0.01em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {isConnected ? "Flux Continu" : "Connexion..."}
              </span>
            </div>

            {/* 2. Badge Decompte Incidents Actifs */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "12px",
                backgroundColor: allProblematicCards.length > 0 ? "rgba(239, 68, 68, 0.09)" : "rgba(34, 197, 94, 0.09)",
                border: `1px solid ${allProblematicCards.length > 0 ? "rgba(239, 68, 68, 0.35)" : "rgba(34, 197, 94, 0.35)"}`,
                cursor: "default",
                userSelect: "none"
              }}
            >
              {allProblematicCards.length > 0 ? (
                <WarningOctagon size={17} weight="fill" style={{ color: "#ef4444" }} />
              ) : (
                <ShieldCheck size={17} weight="fill" style={{ color: "#22c55e" }} />
              )}
              <span style={{
                fontSize: "0.82rem",
                fontWeight: 750,
                color: allProblematicCards.length > 0 ? "#b91c1c" : "#15803d",
                letterSpacing: "0.01em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {allProblematicCards.length === 0 ? "Aucune Derive Detectee" : allProblematicCards.length === 1 ? "1 Incident en Cours" : `${allProblematicCards.length} Incidents en Cours`}
              </span>
            </div>
          </div>

          {/* 3. Horodatage Dynamique avec Rolling Time */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            backgroundColor: "rgba(0, 0, 0, 0.02)",
            border: "1px solid var(--azura-border)",
            borderRadius: "8px"
          }}>
            <span style={{
              fontSize: "0.78rem",
              color: "var(--azura-text-muted)",
              fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              Derniere mise a jour :
            </span>
            <RollingTime
              timestamp={currentTime}
              style={{
                color: "var(--azura-text)",
                fontWeight: 800,
                fontSize: "0.8125rem",
                fontFamily: "'JetBrains Mono', monospace"
              }}
            />
          </div>
        </div>
      </div>

      {/* Cartes des Equipements en Derive & Anomalies Critiques (Valeurs Physiques + Batterie + Deconnexion) */}
      {allProblematicCards.length > 0 && (
        <div style={{
          backgroundColor: "var(--azura-card-bg)",
          border: "1px solid var(--azura-border)",
          borderRadius: "18px",
          padding: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
        }}>
          {/* Entete de la Section */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            marginBottom: "24px",
            gap: "6px"
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "4px 16px",
              borderRadius: "9999px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
            }}>
              <WarningOctagon size={24} weight="bold" style={{ color: "#ef4444", filter: "drop-shadow(0 0 8px rgba(239, 68, 68, 0.45))" }} />
              <h2 style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--azura-text)",
                margin: 0,
                letterSpacing: "-0.02em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                Equipements en Derive & Anomalies Critiques ({allProblematicCards.length})
              </h2>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "14px"
          }}>
            {allProblematicCards.map((card) => (
              <div
                key={card.device_id}
                style={{
                  backgroundColor: "var(--azura-card-bg)",
                  borderLeft: `5px solid ${card.color}`,
                  borderTop: "1px solid var(--azura-border)",
                  borderRight: "1px solid var(--azura-border)",
                  borderBottom: "1px solid var(--azura-border)",
                  borderRadius: "14px",
                  padding: "16px 18px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px"
                }}
              >
                {/* Ligne 1 : Type de Grandeur + Emplacement */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: card.color,
                      boxShadow: `0 0 8px ${card.color}`
                    }} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--azura-text)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {card.device_type}
                    </span>
                  </div>

                  <span style={{ fontSize: "0.75rem", color: "var(--azura-text-muted)" }}>
                    {card.location}
                  </span>
                </div>

                {/* Ligne 2 : Identifiant + Diagnostic */}
                <div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--azura-text)" }}>
                    {card.device_id}
                  </div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: card.color, marginTop: "2px" }}>
                    {card.diagnostic}
                  </div>
                </div>

                {/* Ligne 3 : Valeur Reelle + Badge */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                    <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--azura-text)", fontFamily: "'JetBrains Mono', monospace" }}>
                      {card.displayValue} {card.unit && <span style={{ fontSize: "0.9rem", color: "var(--azura-text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{card.unit}</span>}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: card.badgeColor,
                        backgroundColor: card.badgeBg,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "3px"
                      }}>
                        {card.issueType === "PHYSICAL" && (card.isHigh ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />)}
                        {card.issueType === "OFFLINE" && <WifiSlash size={12} weight="bold" />}
                        {card.badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Micro Barre de Progression */}
                  <div style={{
                    width: "100%",
                    height: "4px",
                    backgroundColor: "rgba(0,0,0,0.06)",
                    borderRadius: "9999px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${card.barPercent}%`,
                      height: "100%",
                      backgroundColor: card.color,
                      borderRadius: "9999px",
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau Deroulant & Selectionnable des 10 Dernieres Alertes Physiques (HAUT / BAS) */}
      <AlertsKafkaTable
        alerts={activeAlertsList}
        thresholdsConfig={dynamicThresholds}
        onRefresh={() => syncLatestAlerts(true)}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}

export default RealTimeAnalytics;
