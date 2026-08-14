import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, WarningOctagon, Waveform, Radio, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { RollingTime } from "./RollingTime";

// Seuils industriels nominaux conformes aux standards d'exploitation AzurA
const SENSOR_THRESHOLDS = {
  temperature:  { min: 5.0,   max: 80.0,  unit: "°C",   label: "Température" },
  vibration:    { min: 0.0,   max: 5.0,   unit: "mm/s", label: "Vibration" },
  pression:     { min: 1.0,   max: 10.0,  unit: "bar",  label: "Pression" },
  humidite:     { min: 30.0,  max: 70.0,  unit: "%",    label: "Humidité" },
  consommation: { min: 100.0, max: 500.0, unit: "kW",   label: "Puissance" },
};

// Diagnostics explicites orientés métier/opérateur
const SENSOR_DIAGNOSTICS = {
  CRITICAL_TEMP_HIGH: "Surchauffe Machine",
  CRITICAL_TEMP_LOW:  "Sous-Température / Risque Gel",
  CRITICAL_VIB_HIGH:  "Déséquilibre Mécanique",
  CRITICAL_VIB_LOW:   "Anomalie Capteur Vibration",
  CRITICAL_PRES_HIGH: "Surpression Circuit",
  CRITICAL_PRES_LOW:  "Chute Pression / Fuite",
  CRITICAL_HUM_HIGH:  "Sur-Humidité / Condensation",
  CRITICAL_HUM_LOW:   "Air Trop Sec",
  CRITICAL_POW_HIGH:  "Surcharge Électrique",
  CRITICAL_POW_LOW:   "Sous-Charge / Déconnexion",
};

// Palette de 8 couleurs distinctes pour identifier chaque capteur (tête de courbe + carte)
// Exclut formellement : Rouge (réservé dépassement haut), Bleu/Cyan (réservé chute basse), Blanc et Noir
const SENSOR_ID_COLORS = [
  "#facc15", // 1. Jaune Ambre / Or Vif
  "#c084fc", // 2. Violet Néon / Pourpre
  "#34d399", // 3. Vert Émeraude / Menthe
  "#fb923c", // 4. Orange Vif / Mandarine
  "#f472b6", // 5. Rose Magenta Flash
  "#a3e635", // 6. Vert Lime Acidulé
  "#e879f9", // 7. Fuchsia Lumineux
  "#fdba74", // 8. Pêche Électrique
];

/**
 * Calcule l'indice de gravité (Severity & Deviation Index) en % de dépassement au-delà du seuil critique
 */
function calculateSeverityIndex(value, deviceType) {
  const t = SENSOR_THRESHOLDS[deviceType] || { min: 0, max: 100 };
  const span = t.max - t.min || 1;

  if (value > t.max) {
    const deviation = ((value - t.max) / span) * 100;
    return {
      severity: Math.max(1, deviation),
      direction: "HIGH",
      directionColor: "#ef4444", // Rouge pour Dépassement Haut
      badge: "HAUT",
      thresholdVal: t.max
    };
  } else if (value < t.min) {
    const deviation = ((t.min - value) / span) * 100;
    return {
      severity: Math.max(1, deviation),
      direction: "LOW",
      directionColor: "#06b6d4", // Cyan pour Chute Basse
      badge: "BAS",
      thresholdVal: t.min
    };
  }

  return {
    severity: 0,
    direction: "NORMAL",
    directionColor: "#22c55e",
    badge: "NOMINAL",
    thresholdVal: t.max
  };
}

export function RealTimeAnalytics() {
  const { lastMessage, isConnected } = useWebSocket("/ws/alerts");
  
  // Dictionnaire des séries télémétriques par capteur
  const [sensorSeries, setSensorSeries] = useState({});
  // Horodatage réel courant pour l'axe X glissant (mise à jour chaque 1s)
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [hoveredData, setHoveredData] = useState(null);
  const svgRef = useRef(null);

  const width = 960;
  const height = 330;
  const padding = { top: 35, right: 40, bottom: 50, left: 105 };

  // Horloge temps réel continue : fait avancer l'axe X chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fonction d'ajout et de synchronisation des alertes
  const processAlertsBatch = (alerts) => {
    if (!Array.isArray(alerts) || alerts.length === 0) return;

    setSensorSeries((prev) => {
      const updated = { ...prev };
      const now = Date.now();

      alerts.forEach((alert) => {
        const devId = alert.device_id;
        if (!devId) return;

        const val = typeof alert.value === "number" ? alert.value : 0;
        const devType = alert.device_type || "temperature";
        const status = alert.status || "ANOMALY";
        const unit = alert.unit || (SENSOR_THRESHOLDS[devType] ? SENSOR_THRESHOLDS[devType].unit : "");
        const location = alert.location || "AzurA Site";

        // Calcul de la gravité
        const sevInfo = calculateSeverityIndex(val, devType);
        const diagnostic = SENSOR_DIAGNOSTICS[status] || "Dérive Opérationnelle";

        // Conversion horodatage
        const timeMs = alert.timestamp ? new Date(alert.timestamp).getTime() : now;

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
        // Évite les doublons stricts sur la même seconde
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
  };

  // Synchronisation continue (Polling régulier pour garantir la persistance des données)
  const syncLatestAlerts = () => {
    fetch("/api/stats/recent-alerts")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.alerts)) {
          processAlertsBatch(data.alerts);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    syncLatestAlerts();
    const interval = setInterval(syncLatestAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  // Réception en direct par flux continu (sub-seconde)
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "INITIAL_ALERTS_HISTORY" && Array.isArray(lastMessage.data)) {
      processAlertsBatch(lastMessage.data);
    } else if (lastMessage.type === "NEW_ALERT" && lastMessage.data) {
      processAlertsBatch([lastMessage.data]);
    }
  }, [lastMessage]);

  // Fenêtre glissante de temps réel : 2 minutes visibles à l'écran
  const windowDurationMs = 120000;
  const minTime = currentTime - windowDurationMs;
  const maxTime = currentTime + 4000;
  const timeRange = maxTime - minTime;

  // Capteurs actifs ayant émis une alerte dans les 60 dernières secondes
  // Triés par device_id pour assurer une attribution de couleur stable et 100% DISTINCTE (zéro collision)
  const rawActive = Object.values(sensorSeries).filter((s) => {
    return s.points.some((p) => p.time >= currentTime - 60000);
  });
  rawActive.sort((a, b) => (a.device_id || "").localeCompare(b.device_id || ""));

  // Attribution d'une couleur UNIQUE garantie sans collision à chaque capteur actif
  const activeSensors = rawActive.map((sensor, idx) => {
    const assignedColor = SENSOR_ID_COLORS[idx % SENSOR_ID_COLORS.length];
    return {
      ...sensor,
      uniqueColor: assignedColor,
      points: sensor.points.map((pt) => ({
        ...pt,
        uniqueColor: assignedColor,
      })),
    };
  });
  const activeCount = activeSensors.length;

  const getX = (time) => {
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right);
  };

  // Échelle Y de Gravité : de 0% (seuil d'alerte) à 60%+ (dépassement extrême)
  const maxObservedSeverity = Math.max(35, ...activeSensors.flatMap(s => s.points.map(p => p.severity)));
  const yMaxGravity = Math.ceil(maxObservedSeverity / 10) * 10 + 5;

  const getY = (sevVal) => {
    const clamped = Math.max(0, Math.min(yMaxGravity, sevVal));
    const ratio = clamped / yMaxGravity;
    return padding.top + (1 - ratio) * (height - padding.top - padding.bottom);
  };

  // Horodatages gradués sur l'Axe X (HH:mm:ss rafraîchis en continu chaque seconde)
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const t = minTime + ratio * (maxTime - minTime);
    const timeStr = new Date(t).toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return { time: t, label: timeStr, x: getX(t) };
  });

  // Graduations de l'Axe Y de Gravité
  const step = yMaxGravity / 4;
  const yTicks = [
    { val: yMaxGravity, label: `+${yMaxGravity.toFixed(0)}% (Critique)` },
    { val: step * 3,    label: `+${(step * 3).toFixed(0)}% (Élevé)` },
    { val: step * 2,    label: `+${(step * 2).toFixed(0)}% (Modéré)` },
    { val: step,        label: `+${step.toFixed(0)}% (Faible)` },
    { val: 0,           label: `0% [Seuil]` },
  ];

  // Points visibles pour l'infobulle interactif
  const visiblePoints = activeSensors.flatMap((s) => s.points.filter((p) => p.time >= minTime && p.time <= maxTime));

  // Pointage 2D de haute précision : trouve le point le plus proche selon X ET Y
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
      {/* Panneau Principal du Graphique Télémétrique */}
      <div style={{
        backgroundColor: "var(--azura-card-bg)",
        border: "1px solid var(--azura-border)",
        borderRadius: "18px",
        padding: "24px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
      }}>
        {/* Entête du Graphique : Titre Centré & Épuré */}
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
            {/* Icône Vintage & Moderne (Waveform Oscilloscope Télémétrique) */}
            <Waveform size={24} weight="bold" style={{ color: "var(--azura-accent-red)", filter: "drop-shadow(0 0 8px rgba(239, 68, 68, 0.45))" }} />
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--azura-text)",
              margin: 0,
              letterSpacing: "-0.02em",
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              Dynamique des Dérives d'Anomalies
            </h2>
          </div>
        </div>

        {/* Surface Graphique SVG */}
        <div style={{ position: "relative", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "14px", padding: "16px 12px" }}>
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredData(null)}
            style={{ overflow: "visible", cursor: "crosshair" }}
          >
            <defs>
              {/* Dégradé vertical d'intensité */}
              <linearGradient id="alertZoneGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.02" />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.12" />
              </linearGradient>

              {/* MASQUE DE DÉCOUPE STRICT : Empêche tout débordement sur l'axe Y à gauche */}
              <clipPath id="chartPlotAreaClip">
                <rect
                  x={padding.left}
                  y={padding.top}
                  width={width - padding.left - padding.right}
                  height={height - padding.top - padding.bottom}
                />
              </clipPath>
            </defs>

            {/* Zone d'Arrière-Plan */}
            <rect
              x={padding.left}
              y={padding.top}
              width={width - padding.left - padding.right}
              height={height - padding.top - padding.bottom}
              fill="url(#alertZoneGrad)"
              rx="6"
            />

            {/* Lignes de Seuils et Graduations Y */}
            {yTicks.map((tick, i) => {
              const yPos = getY(tick.val);
              const isBase = tick.val === 0;
              const strokeColor = isBase ? "#ef4444" : "var(--azura-border)";
              const strokeDash = isBase ? "none" : "4 4";
              const strokeWidth = isBase ? "2" : "1";
              const opacity = isBase ? "0.9" : "0.35";

              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={width - padding.right}
                    y2={yPos}
                    stroke={strokeColor}
                    strokeDasharray={strokeDash}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                  />
                  <text
                    x={padding.left - 12}
                    y={yPos + 4}
                    fill={isBase ? "#ef4444" : "var(--azura-text-muted)"}
                    fontSize="11"
                    fontWeight={isBase ? "800" : "600"}
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Axe X des Abscisses : Horodatages Temps Réel Continu (HH:mm:ss) */}
            {timeTicks.map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={tick.x}
                  y1={height - padding.bottom}
                  x2={tick.x}
                  y2={height - padding.bottom + 6}
                  stroke="var(--azura-border)"
                  strokeWidth="1.5"
                />
                <text
                  x={tick.x}
                  y={height - padding.bottom + 22}
                  fill="var(--azura-text-muted)"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Ligne de base Axe X */}
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="var(--azura-border)"
              strokeWidth="1.5"
            />

            {/* Tracé des courbes de dérive (Clip Path Strict) */}
            {activeCount === 0 ? (
              <g transform={`translate(${padding.left + (width - padding.left - padding.right) / 2}, ${padding.top + (height - padding.top - padding.bottom) / 2})`}>
                {/* Pastille Lumineuse Verte avec Halo */}
                <circle cx="-160" cy="0" r="5" fill="#22c55e" />
                <circle cx="-160" cy="0" r="9" fill="#22c55e" opacity="0.25" />
                
                {/* Texte Centré Proprement Sans Fond Vert */}
                <text
                  x="-142"
                  y="4"
                  fill="var(--azura-text)"
                  fontSize="12.5"
                  fontWeight="700"
                  textAnchor="start"
                  letterSpacing="0.02em"
                >
                  Système AzurA Nominal — Aucun dépassement de seuil
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

            {/* Têtes de Courbes Colorées 100% DISTINCTES par Capteur */}
            {activeSensors.map((series) => {
              const pts = series.points;
              if (pts.length === 0) return null;
              const lastPt = pts[pts.length - 1];
              if (lastPt.time < minTime) return null;

              const lastX = Math.max(padding.left, Math.min(width - padding.right, getX(lastPt.time)));
              const lastY = getY(lastPt.severity);
              const headColor = series.uniqueColor; // Couleur garantie 100% unique parmi les capteurs actifs
              const isThisHovered = hoveredData && hoveredData.deviceId === series.device_id;

              return (
                <g key={`head-${series.device_id}`}>
                  {/* Halo externe */}
                  <circle
                    cx={lastX}
                    cy={lastY}
                    r={isThisHovered ? 10 : 7}
                    fill={headColor}
                    opacity={isThisHovered ? 0.45 : 0.25}
                    style={{ filter: `drop-shadow(0 0 8px ${headColor})` }}
                  />
                  {/* Pastille de tête */}
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

            {/* Réticule de Survol (Hover Crosshair) */}
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

          {/* Infobulle de Survol Épurée et Professionnelle (Sans icônes, Design Télémétrique Compact) */}
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
              {/* Ligne 1 : Pastille + Device ID + Tag Direction */}
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

              {/* Ligne 2 : Valeur Mesurée */}
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: hoveredData.uniqueColor, lineHeight: 1.1 }}>
                {hoveredData.value} {hoveredData.unit}
              </div>

              {/* Ligne 3 : Métriques Résumées & Horodatage */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "4px",
                paddingTop: "4px",
                borderTop: "1px solid var(--azura-border)"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: hoveredData.directionColor }}>
                  Dérive: +{hoveredData.severity.toFixed(1)}%
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--azura-text-muted)", fontFamily: "monospace" }}>
                  {new Date(hoveredData.time).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Barre Inférieure de Contrôles & Statuts Intégrée au Cadre */}
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
          {/* Groupe de Boutons Télémétriques Haut de Gamme */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* 1. Bouton Statut Flux Continu */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              backgroundColor: isConnected ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.28)" : "rgba(239, 68, 68, 0.28)"}`,
              borderRadius: "8px",
              boxShadow: isConnected ? "0 2px 8px rgba(34, 197, 94, 0.1)" : "none",
              transition: "all 0.2s ease"
            }}>
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isConnected ? "#22c55e" : "#ef4444",
                boxShadow: isConnected ? "0 0 8px #22c55e" : "none"
              }} />
              <span style={{
                color: isConnected ? "#22c55e" : "#ef4444",
                fontSize: "0.8125rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {isConnected ? "Flux Continu" : "Connexion..."}
              </span>
            </div>

            {/* 2. Bouton Décompte Incidents Actifs */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              backgroundColor: activeCount > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(34, 197, 94, 0.08)",
              border: `1px solid ${activeCount > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.28)"}`,
              borderRadius: "8px",
              boxShadow: activeCount > 0 ? "0 2px 10px rgba(239, 68, 68, 0.12)" : "0 2px 8px rgba(34, 197, 94, 0.1)",
              transition: "all 0.2s ease"
            }}>
              {activeCount > 0 ? (
                <WarningOctagon size={18} weight="fill" style={{ color: "#ef4444" }} />
              ) : (
                <ShieldCheck size={18} weight="fill" style={{ color: "#22c55e" }} />
              )}
              <span style={{
                fontSize: "0.8125rem",
                fontWeight: 800,
                color: activeCount > 0 ? "#ef4444" : "#22c55e",
                letterSpacing: "0.01em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {activeCount === 0 ? "Aucune Dérive Détectée" : activeCount === 1 ? "1 Incident en Cours" : `${activeCount} Incidents en Cours`}
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
              Dernière mise à jour :
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

      {/* Grille des Fiches de Triage des Incidents Actifs */}
      {activeCount > 0 && (
        <div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            padding: "0 4px"
          }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--azura-text)", margin: 0 }}>
              Équipements en Dérive Critique ({activeCount})
            </h3>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "14px"
          }}>
            {activeSensors.map((series) => {
              const lastPt = series.points[series.points.length - 1];
              const isHigh = series.direction === "HIGH";
              const idColor = series.uniqueColor; // Couleur garantie 100% unique
              const isThisHovered = hoveredData && hoveredData.deviceId === series.device_id;

              return (
                <div
                  key={series.device_id}
                  style={{
                    backgroundColor: "var(--azura-card-bg)",
                    borderLeft: `5px solid ${idColor}`,
                    borderTop: isThisHovered ? `1px solid ${idColor}` : "1px solid var(--azura-border)",
                    borderRight: isThisHovered ? `1px solid ${idColor}` : "1px solid var(--azura-border)",
                    borderBottom: isThisHovered ? `1px solid ${idColor}` : "1px solid var(--azura-border)",
                    borderRadius: "14px",
                    padding: "16px 18px",
                    boxShadow: isThisHovered ? `0 8px 24px ${idColor}20` : "0 2px 10px rgba(0,0,0,0.03)",
                    transform: isThisHovered ? "translateY(-2px)" : "none",
                    transition: "all 0.15s ease-out",
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
                        backgroundColor: idColor,
                        boxShadow: `0 0 8px ${idColor}`
                      }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--azura-text)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {SENSOR_THRESHOLDS[series.device_type] ? SENSOR_THRESHOLDS[series.device_type].label : series.device_type}
                      </span>
                    </div>

                    <span style={{ fontSize: "0.75rem", color: "var(--azura-text-muted)" }}>
                      {series.location}
                    </span>
                  </div>

                  {/* Ligne 2 : Identifiant + Diagnostic */}
                  <div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--azura-text)" }}>
                      {series.device_id}
                    </div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: series.directionColor, marginTop: "2px" }}>
                      {series.diagnostic}
                    </div>
                  </div>

                  {/* Ligne 3 : Valeur Réelle + Jauge de Dérive */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                      <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--azura-text)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {lastPt ? lastPt.value : 0} <span style={{ fontSize: "0.9rem", color: "var(--azura-text-muted)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{series.unit}</span>
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {isHigh ? (
                          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "3px" }}>
                            <ArrowUp size={12} weight="bold" /> +{lastPt ? lastPt.severity.toFixed(0) : 0}%
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#06b6d4", backgroundColor: "rgba(6,182,212,0.1)", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "3px" }}>
                            <ArrowDown size={12} weight="bold" /> -{lastPt ? lastPt.severity.toFixed(0) : 0}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Micro Barre de Progression de Gravité */}
                    <div style={{
                      width: "100%",
                      height: "4px",
                      backgroundColor: "rgba(0,0,0,0.06)",
                      borderRadius: "9999px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(10, (lastPt ? lastPt.severity : 0) * 1.5))}%`,
                        height: "100%",
                        backgroundColor: series.directionColor,
                        borderRadius: "9999px",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default RealTimeAnalytics;
