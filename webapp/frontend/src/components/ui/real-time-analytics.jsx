import React, { useState, useEffect, useRef } from "react";
import { Broadcast, WarningOctagon, CheckCircle, Pulse } from "@phosphor-icons/react";
import { useWebSocket } from "../../hooks/useWebSocket";

/**
 * Composant Graphique Temps Réel d'Analyse des Alertes IoT
 * 
 * Se connecte au WebSocket FastAPI (/ws/alerts) pour suivre le cycle de vie des pannes :
 * - t = 0s à 60s   : 0 alerte active (Lignes calmes).
 * - t = 60s à 180s : 4 courbes actives (2 pannes temporaires + 2 pannes permanentes).
 * - t > 180s       : 2 pannes temporaires guéries, seules les 2 pannes permanentes restent sur le chart !
 */
export function RealTimeAnalytics() {
  const { messages, lastMessage, isConnected } = useWebSocket("/ws/alerts");
  
  // Stockage glissant de la télémétrie des alertes par capteur { device_id: DataPoint[] }
  const [sensorSeries, setSensorSeries] = useState({});
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const svgRef = useRef(null);

  const maxPoints = 40;
  const width = 850;
  const height = 280;
  const padding = { top: 25, right: 30, bottom: 40, left: 55 };

  // Palette de couleurs distinctes par capteur (Thème industriel monochrome & néon)
  const sensorColors = {
    temperature: { line: "#ef4444", gradient: "rgba(239, 68, 68, 0.2)" },  // Rouge critique
    vibration:   { line: "#f97316", gradient: "rgba(249, 115, 22, 0.2)" },  // Orange critique
    pression:    { line: "#a855f7", gradient: "rgba(168, 85, 247, 0.2)" },  // Violet critique
    humidite:    { line: "#3b82f6", gradient: "rgba(59, 130, 246, 0.2)" },  // Bleu critique
    consommation:{ line: "#eab308", gradient: "rgba(234, 179, 8, 0.2)" },  // Jaune critique
  };

  // Traitement des alertes reçues via WebSocket
  useEffect(() => {
    if (!lastMessage) return;

    // Structure du message WebSocket: { type: "NEW_ALERT" | "INITIAL_ALERTS_HISTORY", data: ... }
    let incomingAlerts = [];
    if (lastMessage.type === "INITIAL_ALERTS_HISTORY" && Array.isArray(lastMessage.data)) {
      incomingAlerts = lastMessage.data;
    } else if (lastMessage.type === "NEW_ALERT" && lastMessage.data) {
      incomingAlerts = [lastMessage.data];
    }

    if (incomingAlerts.length === 0) return;

    setSensorSeries((prev) => {
      const updated = { ...prev };
      const now = Date.now();

      incomingAlerts.forEach((alert) => {
        const devId = alert.device_id;
        const val = typeof alert.value === "number" ? alert.value : 0;
        const devType = alert.device_type || "temperature";
        const status = alert.status || "UNKNOWN";

        if (!updated[devId]) {
          updated[devId] = {
            device_id: devId,
            device_type: devType,
            location: alert.location || "Zone Industrielle",
            unit: alert.unit || "",
            points: [],
            lastUpdated: now,
            status: status
          };
        }

        const points = updated[devId].points;
        points.push({ time: now, value: val, status: status });
        
        // Conserve un historique glissant des maxPoints derniers points
        updated[devId].points = points.slice(-maxPoints);
        updated[devId].lastUpdated = now;
        updated[devId].status = status;
      });

      return updated;
    });
  }, [lastMessage]);

  // Nettoyage automatique des capteurs dont la dernière alerte date de plus de 15 secondes (Guérison temporaire)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSensorSeries((prev) => {
        const nextState = {};
        let activeCount = 0;

        Object.keys(prev).forEach((devId) => {
          const series = prev[devId];
          // Si le capteur a émis une alerte dans les 15 dernières secondes, il est toujours en alerte active
          if (now - series.lastUpdated < 15000) {
            nextState[devId] = series;
            activeCount++;
          }
        });

        setActiveAlertsCount(activeCount);
        return nextState;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Calcul des échelles X et Y pour le SVG
  const allPoints = Object.values(sensorSeries).flatMap((s) => s.points);
  
  const minTime = allPoints.length > 0 ? Math.min(...allPoints.map((p) => p.time)) : Date.now() - 60000;
  const maxTime = allPoints.length > 0 ? Math.max(...allPoints.map((p) => p.time)) : Date.now();
  const timeRange = Math.max(maxTime - minTime, 1000);

  const getX = (time) => {
    return padding.left + ((time - minTime) / timeRange) * (width - padding.left - padding.right);
  };

  // Normalisation générique de Y (0 à 100%)
  const getY = (value, type) => {
    let minVal = 0;
    let maxVal = 100;
    if (type === "temperature") { minVal = 0; maxVal = 120; }
    if (type === "vibration")   { minVal = 0; maxVal = 12; }
    if (type === "pression")    { minVal = 0; maxVal = 20; }
    if (type === "consommation"){ minVal = 0; maxVal = 800; }
    if (type === "humidite")    { minVal = 0; maxVal = 100; }

    const norm = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal || 1)));
    return padding.top + (1 - norm) * (height - padding.top - padding.bottom);
  };

  const activeSensorsList = Object.values(sensorSeries);

  return (
    <div style={{
      backgroundColor: "var(--azura-card-bg)",
      border: "1px solid var(--azura-border)",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
      marginBottom: "24px"
    }}>
      {/* Entête du Composant Graphique */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Pulse size={24} weight="bold" style={{ color: "var(--azura-text)" }} />
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--azura-text)", margin: 0 }}>
              Analyse Temps Réel des Flux d'Alertes
            </h2>
          </div>
          <p style={{ color: "var(--azura-text-muted)", fontSize: "0.875rem", margin: 0 }}>
            Visualisation directe des alertes Kafka reçues via WebSockets.
          </p>
        </div>

        {/* Badge de Connexion Live WebSocket & Compteur d'Alertes Actives */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: isConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            borderRadius: "12px"
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "#22c55e" : "#ef4444",
              boxShadow: isConnected ? "0 0 10px #22c55e" : "none"
            }} />
            <span style={{ color: isConnected ? "#22c55e" : "#ef4444", fontSize: "0.85rem", fontWeight: "600" }}>
              {isConnected ? "WebSocket Live" : "Déconnecté"}
            </span>
          </div>

          <div style={{
            padding: "8px 16px",
            backgroundColor: activeAlertsCount > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
            border: `1px solid ${activeAlertsCount > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            {activeAlertsCount > 0 ? (
              <WarningOctagon size={18} weight="fill" style={{ color: "#ef4444" }} />
            ) : (
              <CheckCircle size={18} weight="fill" style={{ color: "#22c55e" }} />
            )}
            <span style={{ fontSize: "0.875rem", fontWeight: "700", color: "var(--azura-text)" }}>
              {activeAlertsCount} {activeAlertsCount === 1 ? "Capteur en Alerte" : "Capteurs en Alerte"}
            </span>
          </div>
        </div>
      </div>

      {/* Zone SVG d'affichage des Courbes Dynamiques */}
      <div style={{ position: "relative", backgroundColor: "rgba(0,0,0,0.03)", borderRadius: "12px", padding: "12px" }}>
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: "visible" }}
        >
          {/* Grille d'arrière-plan */}
          {[0, 25, 50, 75, 100].map((val) => {
            const yPos = padding.top + (1 - val / 100) * (height - padding.top - padding.bottom);
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={width - padding.right}
                  y2={yPos}
                  stroke="var(--azura-border)"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
                <text
                  x={padding.left - 10}
                  y={yPos}
                  fill="var(--azura-text-muted)"
                  fontSize="11"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Tracer des lignes pour chaque capteur actif en alerte */}
          {activeSensorsList.length === 0 ? (
            <text
              x={width / 2}
              y={height / 2}
              fill="var(--azura-text-muted)"
              fontSize="14"
              textAnchor="middle"
              fontWeight="500"
            >
              🟢 Aucun capteur en anomalie (Système AzurA 100% Nominal)
            </text>
          ) : (
            activeSensorsList.map((series) => {
              const points = series.points;
              if (points.length < 2) return null;

              const styleConfig = sensorColors[series.device_type] || { line: "#a855f7", gradient: "rgba(168,85,247,0.2)" };

              const dPath = points
                .map((pt, i) => {
                  const x = getX(pt.time);
                  const y = getY(pt.value, series.device_type);
                  return `${i === 0 ? "M" : "L"} ${x},${y}`;
                })
                .join(" ");

              const lastPoint = points[points.length - 1];
              const lastX = getX(lastPoint.time);
              const lastY = getY(lastPoint.value, series.device_type);

              return (
                <g key={series.device_id}>
                  {/* Ligne de tendance de l'alerte */}
                  <path
                    d={dPath}
                    fill="none"
                    stroke={styleConfig.line}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: `drop-shadow(0 0 6px ${styleConfig.line})`,
                      transition: "all 0.3s ease"
                    }}
                  />

                  {/* Point le plus récent pulsant en direct */}
                  <circle
                    cx={lastX}
                    cy={lastY}
                    r="6"
                    fill={styleConfig.line}
                    style={{
                      filter: `drop-shadow(0 0 8px ${styleConfig.line})`
                    }}
                  />

                  {/* Étiquette d'identifiant du capteur sur la courbe */}
                  <text
                    x={lastX + 10}
                    y={lastY + 4}
                    fill={styleConfig.line}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {series.device_id} ({lastPoint.value} {series.unit})
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Légende et Cartes Récapitulatives des Capteurs en Alerte */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginTop: "20px"
      }}>
        {activeSensorsList.length === 0 ? (
          <div style={{
            gridColumn: "1 / -1",
            padding: "16px",
            backgroundColor: "rgba(34, 197, 94, 0.05)",
            border: "1px dashed rgba(34, 197, 94, 0.3)",
            borderRadius: "12px",
            textAlign: "center",
            color: "var(--azura-text-muted)",
            fontSize: "0.875rem"
          }}>
            En attente de la première minute de surveillance (t = 60s)... Aucune alerte enregistrée.
          </div>
        ) : (
          activeSensorsList.map((series) => {
            const styleConfig = sensorColors[series.device_type] || { line: "#a855f7" };
            const lastPoint = series.points[series.points.length - 1];

            return (
              <div
                key={series.device_id}
                style={{
                  backgroundColor: "var(--azura-card-bg)",
                  border: `1px solid ${styleConfig.line}`,
                  borderRadius: "12px",
                  padding: "12px 16px",
                  boxShadow: `0 4px 15px rgba(0,0,0,0.05)`
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: styleConfig.line, textTransform: "uppercase" }}>
                    {series.device_type}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--azura-text-muted)" }}>
                    {series.location}
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: "700", color: "var(--azura-text)" }}>
                  {series.device_id}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "8px" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: "800", color: styleConfig.line }}>
                    {lastPoint ? lastPoint.value : 0} {series.unit}
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#ef4444" }}>
                    {series.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RealTimeAnalytics;
