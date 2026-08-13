import React, { useState, useEffect, useRef } from "react";
import { WarningOctagon, CheckCircle, Pulse, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { useWebSocket } from "../../hooks/useWebSocket";

// Seuils industriels conformes au moteur Spark Streaming (stream_processor.py)
const SENSOR_THRESHOLDS = {
  temperature:  { min: 5.0,   max: 80.0,  unit: "°C",   label: "Température" },
  vibration:    { min: 0.0,   max: 5.0,   unit: "mm/s", label: "Vibration" },
  pression:     { min: 1.0,   max: 10.0,  unit: "bar",  label: "Pression" },
  humidite:     { min: 30.0,  max: 70.0,  unit: "%",    label: "Humidité" },
  consommation: { min: 100.0, max: 500.0, unit: "kW",   label: "Puissance" },
};

/**
 * Calcule l'indice de gravité (Severity & Deviation Index) en % de dépassement au-delà du seuil critique :
 * - Dépassement Seuil Haut (V > Max) : (V - Max) / (Max - Min) * 100  -> Direction "HIGH" (Rouge)
 * - Chute Sous Seuil Bas  (V < Min) : (Min - V) / (Max - Min) * 100  -> Direction "LOW"  (Bleu Cyan)
 */
function calculateSeverityIndex(value, deviceType) {
  const t = SENSOR_THRESHOLDS[deviceType] || { min: 0, max: 100 };
  const span = t.max - t.min || 1;

  if (value > t.max) {
    const deviation = ((value - t.max) / span) * 100;
    return {
      severity: Math.max(1, deviation),
      direction: "HIGH",
      color: "#ef4444", // Rouge Néon pour Dépassement Haut (Surchauffe, Surpression)
      badge: "Dépassement Haut",
      thresholdVal: t.max
    };
  } else if (value < t.min) {
    const deviation = ((t.min - value) / span) * 100;
    return {
      severity: Math.max(1, deviation),
      direction: "LOW",
      color: "#06b6d4", // Cyan Électrique pour Chute Basse (Sous-pression, Sous-tension)
      badge: "Chute Basse",
      thresholdVal: t.min
    };
  }

  return {
    severity: 0,
    direction: "NORMAL",
    color: "#22c55e",
    badge: "Nominal",
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

  const width = 940;
  const height = 340;
  const padding = { top: 35, right: 40, bottom: 50, left: 85 };

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

        // Calcul de la gravité et de la couleur (Rouge = Haut, Cyan = Bas)
        const sevInfo = calculateSeverityIndex(val, devType);

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
            color: sevInfo.color,
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
            deviceId: devId,
            deviceType: devType,
            unit: unit,
            location: location,
            color: sevInfo.color,
            thresholdVal: sevInfo.thresholdVal
          });

          // Trie par ordre chronologique et conserve les 60 derniers points
          pts.sort((a, b) => a.time - b.time);
          updated[devId].points = pts.slice(-60);
          updated[devId].lastUpdated = Math.max(updated[devId].lastUpdated, timeMs);
          updated[devId].status = status;
          updated[devId].color = sevInfo.color;
          updated[devId].direction = sevInfo.direction;
        }
      });

      return updated;
    });
  };

  // Synchronisation continue (Polling toutes les 3s pour garantir la persistance des données)
  const syncLatestAlerts = () => {
    fetch("/api/stats/recent-alerts")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.alerts)) {
          processAlertsBatch(data.alerts);
        }
      })
      .catch((err) => console.error("[-] Sync error:", err));
  };

  useEffect(() => {
    syncLatestAlerts();
    const interval = setInterval(syncLatestAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  // Réception en direct par WebSockets (sub-seconde)
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
  const activeSensors = Object.values(sensorSeries).filter((s) => {
    return s.points.some((p) => p.time >= currentTime - 60000);
  });
  const activeCount = activeSensors.length;

  const getX = (time) => {
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right);
  };

  // Échelle Y de Gravité : de 0% (seuil d'alerte) à 60%+ (dépassement extrême)
  const maxObservedSeverity = Math.max(35, ...activeSensors.flatMap(s => s.points.map(p => p.severity)));
  const yMaxGravity = Math.ceil(maxObservedSeverity / 10) * 10 + 5; // Échelle adaptative propre

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
  const visiblePoints = activeSensors.flatMap((s) => s.points.filter((p) => p.time >= minTime - 5000 && p.time <= maxTime + 5000));

  const handleMouseMove = (e) => {
    if (!svgRef.current || visiblePoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    let closestPoint = null;
    let minDist = Infinity;

    visiblePoints.forEach((pt) => {
      const px = getX(pt.time);
      const dist = Math.abs(px - mouseX);
      if (dist < minDist && dist < 45) {
        minDist = dist;
        closestPoint = pt;
      }
    });

    setHoveredData(closestPoint);
  };

  return (
    <div style={{
      backgroundColor: "var(--azura-card-bg)",
      border: "1px solid var(--azura-border)",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)"
    }}>
      {/* Entête de Supervision */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Pulse size={28} weight="bold" style={{ color: "var(--azura-accent-red)" }} />
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--azura-text)", margin: 0 }}>
              Analyse Temps Réel — Indice de Gravité des Alertes
            </h2>
          </div>
          <p style={{ color: "var(--azura-text-muted)", fontSize: "0.875rem", marginTop: "4px", margin: 0 }}>
            Échelle de dépassement critique : <span style={{ color: "#ef4444", fontWeight: 700 }}>🔴 Rouge = Dépassement Haut</span> | <span style={{ color: "#06b6d4", fontWeight: 700 }}>🔵 Cyan = Chute Basse</span>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Statut Live */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: isConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            borderRadius: "20px"
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "#22c55e" : "#ef4444",
              boxShadow: isConnected ? "0 0 10px #22c55e" : "none"
            }} />
            <span style={{ color: isConnected ? "#22c55e" : "#ef4444", fontSize: "0.85rem", fontWeight: "700" }}>
              {isConnected ? "WebSocket Live" : "Mode Synchro"}
            </span>
          </div>

          {/* Compteur d'Alertes Actives */}
          <div style={{
            padding: "8px 18px",
            backgroundColor: activeCount > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
            border: `1px solid ${activeCount > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            {activeCount > 0 ? (
              <WarningOctagon size={20} weight="fill" style={{ color: "#ef4444" }} />
            ) : (
              <CheckCircle size={20} weight="fill" style={{ color: "#22c55e" }} />
            )}
            <span style={{ fontSize: "0.9rem", fontWeight: "800", color: activeCount > 0 ? "#ef4444" : "#22c55e" }}>
              {activeCount} {activeCount === 1 ? "Capteur en Alerte Active" : "Capteurs en Alerte Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Surface Graphique SVG */}
      <div style={{ position: "relative", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "12px", padding: "16px 12px" }}>
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
            {/* Dégradé vertical d'intensité d'alerte */}
            <linearGradient id="alertZoneGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.03" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Zone d'Arrière-Plan Dégradée de Sévérité */}
          <rect
            x={padding.left}
            y={padding.top}
            width={width - padding.left - padding.right}
            height={height - padding.top - padding.bottom}
            fill="url(#alertZoneGrad)"
            rx="6"
          />

          {/* Lignes de Seuils et Graduations de l'Axe Y de Gravité */}
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
                  x={padding.left - 10}
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

          {/* Tracé des courbes de gravité par capteur */}
          {activeCount === 0 ? (
            <g>
              <circle cx={width / 2 - 180} cy={height / 2 - 10} r="7" fill="#22c55e" />
              <text
                x={width / 2}
                y={height / 2 - 5}
                fill="var(--azura-text-muted)"
                fontSize="14"
                fontWeight="700"
                textAnchor="middle"
              >
                🟢 Aucun capteur en anomalie (Système AzurA 100% Nominal)
              </text>
            </g>
          ) : (
            activeSensors.map((series) => {
              const pts = series.points.filter((p) => p.time >= minTime - 10000 && p.time <= maxTime + 5000);
              if (pts.length === 0) return null;

              const strokeColor = series.color;

              // Tracé SVG utilisant l'indice de gravité severity
              const dPath = pts
                .map((pt, i) => {
                  const x = getX(pt.time);
                  const y = getY(pt.severity);
                  return `${i === 0 ? "M" : "L"} ${x},${y}`;
                })
                .join(" ");

              const lastPt = pts[pts.length - 1];
              const lastX = getX(lastPt.time);
              const lastY = getY(lastPt.severity);

              return (
                <g key={series.device_id}>
                  {/* Courbe Néon avec Lueur */}
                  <path
                    d={dPath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: `drop-shadow(0 0 6px ${strokeColor})`,
                      transition: "all 0.1s linear"
                    }}
                  />

                  {/* Tête de courbe en direct */}
                  <circle
                    cx={lastX}
                    cy={lastY}
                    r="6"
                    fill={strokeColor}
                    style={{ filter: `drop-shadow(0 0 8px ${strokeColor})` }}
                  />
                </g>
              );
            })
          )}

          {/* Réticule de Survol (Hover Crosshair) */}
          {hoveredData && (
            <g style={{ pointerEvents: "none" }}>
              <line
                x1={getX(hoveredData.time)}
                y1={padding.top}
                x2={getX(hoveredData.time)}
                y2={height - padding.bottom}
                stroke={hoveredData.color}
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <circle
                cx={getX(hoveredData.time)}
                cy={getY(hoveredData.severity)}
                r="7"
                fill="none"
                stroke={hoveredData.color}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Infobulle de Survol (Hover Tooltip avec Valeur Réelle + Gravité) */}
        {hoveredData && (
          <div
            style={{
              position: "absolute",
              left: `${Math.max(100, Math.min(width - 180, getX(hoveredData.time)))}px`,
              top: `${Math.max(20, getY(hoveredData.severity) - 85)}px`,
              transform: "translateX(-50%)",
              backgroundColor: "var(--azura-card-bg)",
              border: `1.5px solid ${hoveredData.color}`,
              borderRadius: "10px",
              padding: "10px 14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              pointerEvents: "none",
              zIndex: 20
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: hoveredData.color }} />
              <span style={{ fontWeight: 800, color: "var(--azura-text)", fontSize: "0.9rem" }}>
                {hoveredData.deviceId}
              </span>
              <span style={{
                fontSize: "0.7rem",
                fontWeight: 800,
                color: hoveredData.color,
                backgroundColor: `${hoveredData.color}15`,
                padding: "2px 6px",
                borderRadius: "4px"
              }}>
                {hoveredData.direction === "HIGH" ? "🔴 DÉPASSEMENT HAUT" : "🔵 CHUTE BASSE"}
              </span>
            </div>
            <div style={{ color: hoveredData.color, fontSize: "1.2rem", fontWeight: 800 }}>
              {hoveredData.value} {hoveredData.unit}
            </div>
            <div style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: hoveredData.color,
              marginTop: "2px"
            }}>
              🚨 Gravité: +{hoveredData.severity.toFixed(1)}% au-delà du seuil critique ({hoveredData.thresholdVal} {hoveredData.unit})
            </div>
            <div style={{ color: "var(--azura-text-muted)", fontSize: "0.75rem", fontFamily: "monospace", marginTop: "2px" }}>
              🕒 {new Date(hoveredData.time).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Cartes Légendes Dynamiques Récapitulatives */}
      {activeCount > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "12px",
          marginTop: "20px"
        }}>
          {activeSensors.map((series) => {
            const lastPt = series.points[series.points.length - 1];
            const isHigh = series.direction === "HIGH";

            return (
              <div
                key={series.device_id}
                style={{
                  backgroundColor: "var(--azura-card-bg)",
                  borderLeft: `5px solid ${series.color}`,
                  borderTop: "1px solid var(--azura-border)",
                  borderRight: "1px solid var(--azura-border)",
                  borderBottom: "1px solid var(--azura-border)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {isHigh ? (
                      <ArrowUp size={14} weight="bold" style={{ color: series.color }} />
                    ) : (
                      <ArrowDown size={14} weight="bold" style={{ color: series.color }} />
                    )}
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: series.color, textTransform: "uppercase" }}>
                      {series.device_type}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--azura-text-muted)" }}>
                    {series.location}
                  </span>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--azura-text)" }}>
                  {series.device_id}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "8px" }}>
                  <div>
                    <span style={{ fontSize: "1.2rem", fontWeight: 800, color: series.color }}>
                      {lastPt ? lastPt.value : 0} {series.unit}
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: series.color, marginLeft: "6px" }}>
                      (+{lastPt ? lastPt.severity.toFixed(0) : 0}% gravité)
                    </span>
                  </div>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: series.color,
                    backgroundColor: `${series.color}15`,
                    padding: "3px 8px",
                    borderRadius: "6px"
                  }}>
                    {series.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RealTimeAnalytics;
