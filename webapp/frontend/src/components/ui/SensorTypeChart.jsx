import React, { useState, useRef, useMemo } from "react";
import { ArrowUp, ArrowDown, CheckCircle, Radio, WifiSlash } from "@phosphor-icons/react";

/**
 * Palette de 4 couleurs distinctes et haute visibilite pour differencier les 4 capteurs (1 par site).
 */
const SENSOR_LINE_COLORS = [
  { stroke: "#06b6d4", glow: "rgba(6, 182, 212, 0.45)", fill: "rgba(6, 182, 212, 0.10)", name: "Capteur 1 (Agadir)" },
  { stroke: "#a855f7", glow: "rgba(168, 85, 247, 0.45)", fill: "rgba(168, 85, 247, 0.10)", name: "Capteur 2 (Dakhla)" },
  { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.45)", fill: "rgba(245, 158, 11, 0.10)", name: "Capteur 3 (Kenitra)" },
  { stroke: "#10b981", glow: "rgba(16, 185, 129, 0.45)", fill: "rgba(16, 185, 129, 0.10)", name: "Capteur 4 (Tanger Med)" }
];

/**
 * Composant de Diagramme Télémétrique plein écran par Type de Capteur.
 * 
 * - Titre et Plage nominale centrés en haut.
 * - Pointage 2D de haute précision interactif.
 * - Axe X Temporel Continu (HH:mm:ss) avec défilement fluide.
 * - Valeurs réelles des 4 capteurs affichées au centre du bas de diagramme.
 * - Aucune perte d'état lors du refresh grâce au tampon d'historique backend.
 */
export function SensorTypeChart({
  typeKey,
  config,
  sensorsData = [],
  timeWindowSec = 45,
  currentTime: propCurrentTime
}) {
  const [hoveredData, setHoveredData] = useState(null);
  const svgRef = useRef(null);

  const { label, unit, normal_range = [0, 100], fault_floor = 0, fault_ceiling = 100 } = config;
  const [normMin, normMax] = normal_range;

  // Calcul dynamique des bornes Y en fonction des seuils nominaux et des valeurs réelles
  const { yMin, yMax, yTicks } = useMemo(() => {
    let allValues = [];
    sensorsData.forEach(s => {
      if (s.points && s.points.length > 0) {
        s.points.forEach(p => allValues.push(p.value));
      }
    });

    const observedMin = allValues.length > 0 ? Math.min(...allValues) : normMin;
    const observedMax = allValues.length > 0 ? Math.max(...allValues) : normMax;

    // Élargissement avec marges confortables
    const calculatedMin = Math.min(normMin * 0.85, observedMin * 0.9, fault_floor);
    const calculatedMax = Math.max(normMax * 1.15, observedMax * 1.1, normMax * 1.05);

    const span = calculatedMax - calculatedMin || 10;
    const step = span / 4;
    const ticks = [0, 1, 2, 3, 4].map(i => calculatedMin + i * step);

    return {
      yMin: calculatedMin,
      yMax: calculatedMax,
      yTicks: ticks
    };
  }, [sensorsData, normMin, normMax, fault_floor, fault_ceiling]);

  // Fenêtre temporelle continue glissante (synchronisée via horloge globale)
  const now = propCurrentTime || Date.now();
  const minTime = now - timeWindowSec * 1000;
  const maxTime = now;

  // Dimensions graphiques SVG larges (Format Bande Pleine Largeur)
  const width = 980;
  const height = 275;
  const padding = { left: 65, right: 30, top: 25, bottom: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Projections mathématiques de coordonnées
  const getX = (timeMs) => {
    const ratio = Math.max(0, Math.min(1, (timeMs - minTime) / (maxTime - minTime || 1)));
    return padding.left + ratio * chartWidth;
  };

  const getY = (val) => {
    const ratio = (val - yMin) / (yMax - yMin || 1);
    return padding.top + chartHeight - ratio * chartHeight;
  };

  const normMinY = getY(normMin);
  const normMaxY = getY(normMax);

  // Graduations temporelles réelles sur l'Axe X (HH:mm:ss défilant chaque seconde)
  const timeTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const t = minTime + ratio * (maxTime - minTime);
      const timeStr = new Date(t).toLocaleTimeString('fr-FR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return { time: t, label: timeStr, x: getX(t) };
    });
  }, [minTime, maxTime]);

  // Préparation des séries de points avec métadonnées complètes
  const processedSeries = useMemo(() => {
    return sensorsData.map((sensor, sIdx) => {
      const palette = SENSOR_LINE_COLORS[sIdx % SENSOR_LINE_COLORS.length];
      const allSensorPoints = sensor.points || [];
      
      // Récupération de la dernière valeur connue du capteur et de son horodatage
      const lastKnown = allSensorPoints.length > 0 ? allSensorPoints[allSensorPoints.length - 1] : null;
      const latestValue = lastKnown ? lastKnown.value : null;
      const lastTime = lastKnown ? (typeof lastKnown.time === "number" ? lastKnown.time : new Date(lastKnown.time).getTime()) : 0;

      // Détection du Silence Radio / Déconnexion (> 9s sans nouvelle mesure)
      const isOffline = lastTime > 0 && (now - lastTime > 9000);
      const isLowBattery = sensor.status === "LOW_BATTERY" || (sensor.battery_level !== undefined && sensor.battery_level < 20.0);

      let latestStatus = "NORMAL";
      if (isOffline) {
        latestStatus = "OFFLINE";
      } else if (isLowBattery) {
        latestStatus = "LOW_BATTERY";
      } else if (latestValue !== null) {
        if (latestValue > normMax) latestStatus = "HIGH";
        else if (latestValue < normMin) latestStatus = "LOW";
      }

      const validPoints = allSensorPoints
        .filter(p => p.time >= minTime - 5000)
        .map(p => {
          let status = "NORMAL";
          if (p.value > normMax) status = "HIGH";
          else if (p.value < normMin) status = "LOW";

          return {
            ...p,
            deviceId: sensor.id,
            location: sensor.loc || sensor.id,
            palette,
            status,
            unit
          };
        });

      if (validPoints.length === 0) {
        return {
          sensor,
          palette,
          points: [],
          linePath: "",
          areaPath: "",
          lastPt: null,
          latestValue,
          latestStatus
        };
      }

      // Construction de la ligne continue
      const coords = validPoints.map(p => ({
        x: getX(p.time),
        y: getY(p.value),
        ...p
      }));

      let d = `M ${coords[0].x} ${coords[0].y}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i];
        const p1 = coords[i + 1];
        const cx = (p0.x + p1.x) / 2;
        d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
      }

      const lastX = coords[coords.length - 1].x;
      const firstX = coords[0].x;
      const bottomY = padding.top + chartHeight;
      const areaD = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

      const lastPt = coords[coords.length - 1];

      return {
        sensor,
        palette,
        points: coords,
        linePath: d,
        areaPath: areaD,
        lastPt,
        latestValue,
        latestStatus
      };
    });
  }, [sensorsData, minTime, maxTime, yMin, yMax, normMin, normMax]);

  // Tous les points visibles pour le pointage 2D de haute précision
  const allVisiblePoints = useMemo(() => {
    return processedSeries.flatMap(s => s.points.filter(p => p.time >= minTime && p.time <= maxTime));
  }, [processedSeries, minTime, maxTime]);

  // Algorithme de Pointage 2D Haute Précision
  const handleMouseMove = (e) => {
    if (!svgRef.current || allVisiblePoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * height;

    let closestPoint = null;
    let minDistance2D = Infinity;

    allVisiblePoints.forEach((pt) => {
      const px = getX(pt.time);
      const py = getY(pt.value);

      const dx = px - mouseX;
      const dy = py - mouseY;
      const dist2D = Math.sqrt(dx * dx + dy * dy * 1.8);

      if (dist2D < minDistance2D && dist2D < 55) {
        minDistance2D = dist2D;
        closestPoint = pt;
      }
    });

    setHoveredData(closestPoint);
  };

  const handleMouseLeave = () => setHoveredData(null);

  return (
    <div className="azura-card" style={{
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      padding: "22px 26px",
      borderRadius: "18px",
      border: "1px solid var(--azura-border)",
      backgroundColor: "var(--azura-card-bg)",
      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04)",
      overflow: "hidden"
    }}>
      {/* 1. En-tête de la Carte : Titre de la Grandeur et Plage Nominale Centrés */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "6px",
        borderBottom: "1px solid var(--azura-border)",
        paddingBottom: "14px"
      }}>
        {/* Titre Pill de la Grandeur */}
        <div style={{
          padding: "5px 16px",
          borderRadius: "9999px",
          backgroundColor: "rgba(2, 132, 199, 0.08)",
          border: "1px solid rgba(2, 132, 199, 0.3)",
          color: "var(--azura-text)",
          fontSize: "0.95rem",
          fontWeight: 800,
          letterSpacing: "0.02em"
        }}>
          {label}
        </div>
        {/* Sous-titre Plage Nominale */}
        <span style={{ fontSize: "0.82rem", color: "var(--azura-text-muted)", fontWeight: 600 }}>
          Plage Nominale : <strong style={{ color: "var(--azura-text)" }}>{normMin} a {normMax} {unit}</strong>
        </span>
      </div>

      {/* 2. Surface Graphique SVG Haute Définition */}
      <div
        ref={svgRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "relative",
          width: "100%",
          height: "275px",
          backgroundColor: "rgba(0, 0, 0, 0.015)",
          borderRadius: "12px",
          cursor: "crosshair",
          userSelect: "none"
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          <defs>
            {SENSOR_LINE_COLORS.map((col, idx) => (
              <linearGradient key={idx} id={`grad-${typeKey}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={col.stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={col.stroke} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Zone Nominale Sécurisée (Fond Vert subtil) */}
          <rect
            x={padding.left}
            y={normMaxY}
            width={chartWidth}
            height={Math.max(0, normMinY - normMaxY)}
            fill="rgba(34, 197, 94, 0.04)"
            stroke="none"
          />

          {/* Ligne Guide Seuil Max Critique (Rouge #ef4444) */}
          <line
            x1={padding.left}
            y1={normMaxY}
            x2={padding.left + chartWidth}
            y2={normMaxY}
            stroke="#ef4444"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.85"
          />
          <text
            x={padding.left + chartWidth - 8}
            y={normMaxY - 6}
            textAnchor="end"
            fill="#ef4444"
            fontSize="10"
            fontWeight="800"
          >
            SEUIL MAX : {normMax} {unit}
          </text>

          {/* Ligne Guide Seuil Min Critique (Bleu #0284c7) */}
          <line
            x1={padding.left}
            y1={normMinY}
            x2={padding.left + chartWidth}
            y2={normMinY}
            stroke="#0284c7"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.85"
          />
          <text
            x={padding.left + chartWidth - 8}
            y={normMinY + 14}
            textAnchor="end"
            fill="#0284c7"
            fontSize="10"
            fontWeight="800"
          >
            SEUIL MIN : {normMin} {unit}
          </text>

          {/* Grille et Graduations de l'Axe Y avec Vraies Valeurs Physiques */}
          {yTicks.map((val, idx) => {
            const yPos = getY(val);
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={padding.left + chartWidth}
                  y2={yPos}
                  stroke="var(--azura-border)"
                  strokeWidth="0.8"
                  strokeDasharray="2 4"
                  opacity="0.6"
                />
                <text
                  x={padding.left - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fill="var(--azura-text-muted)"
                  fontSize="10.5"
                  fontWeight="600"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {val.toFixed(val >= 100 ? 0 : 1)} {unit}
                </text>
              </g>
            );
          })}

          {/* Ligne de Base Axe X */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight}
            stroke="var(--azura-border)"
            strokeWidth="1.2"
          />

          {/* Graduations et Horodatages Dynamiques de l'Axe X (HH:mm:ss) */}
          {timeTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={tick.x}
                y1={padding.top + chartHeight}
                x2={tick.x}
                y2={padding.top + chartHeight + 6}
                stroke="var(--azura-border)"
                strokeWidth="1.2"
              />
              <text
                x={tick.x}
                y={padding.top + chartHeight + 20}
                textAnchor="middle"
                fill="var(--azura-text-muted)"
                fontSize="10"
                fontWeight="600"
                fontFamily="'JetBrains Mono', monospace"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Courbes Télémétriques des 3 Capteurs */}
          {processedSeries.map((sp, idx) => {
            if (!sp.linePath) return null;
            const isThisHovered = hoveredData && hoveredData.deviceId === sp.sensor.id;
            const hasAnyHover = !!hoveredData;
            const strokeOpacity = isThisHovered ? 1 : hasAnyHover ? 0.35 : 0.9;
            const strokeWidth = isThisHovered ? 3.5 : 2.2;

            return (
              <g key={idx}>
                {/* Aire sous la courbe */}
                <path
                  d={sp.areaPath}
                  fill={`url(#grad-${typeKey}-${idx})`}
                  opacity={isThisHovered ? 1 : hasAnyHover ? 0.2 : 0.7}
                />
                {/* Ligne principale */}
                <path
                  d={sp.linePath}
                  fill="none"
                  stroke={sp.palette.stroke}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: isThisHovered ? `drop-shadow(0 0 8px ${sp.palette.stroke})` : "none",
                    transition: "all 0.15s ease-out"
                  }}
                />

                {/* Tête de courbe pulsante en direct */}
                {sp.lastPt && (
                  <g transform={`translate(${sp.lastPt.x}, ${sp.lastPt.y})`}>
                    <circle
                      r={isThisHovered ? 11 : 8}
                      fill={sp.palette.stroke}
                      opacity={isThisHovered ? 0.45 : 0.25}
                      className="animate-ping"
                    />
                    <circle
                      r={isThisHovered ? 6.5 : 5}
                      fill="var(--azura-card-bg)"
                      stroke={sp.palette.stroke}
                      strokeWidth="2"
                    />
                    <circle
                      r={isThisHovered ? 3.5 : 2.5}
                      fill={sp.palette.stroke}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Réticule de Pointage Actif au Survol */}
          {hoveredData && (
            <g style={{ pointerEvents: "none" }}>
              {/* Ligne verticale de guidage */}
              <line
                x1={getX(hoveredData.time)}
                y1={padding.top}
                x2={getX(hoveredData.time)}
                y2={padding.top + chartHeight}
                stroke={hoveredData.palette.stroke}
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.75"
              />
              {/* Cercle cible exact sur le point */}
              <circle
                cx={getX(hoveredData.time)}
                cy={getY(hoveredData.value)}
                r="7"
                fill="none"
                stroke={hoveredData.palette.stroke}
                strokeWidth="2.5"
                style={{ filter: `drop-shadow(0 0 6px ${hoveredData.palette.stroke})` }}
              />
              <circle
                cx={getX(hoveredData.time)}
                cy={getY(hoveredData.value)}
                r="3.5"
                fill={hoveredData.palette.stroke}
              />
            </g>
          )}
        </svg>

        {/* Infobulle de Survol Flottante Ciblée */}
        {hoveredData && (
          <div style={{
            position: "absolute",
            left: `${Math.max(110, Math.min(width - 160, getX(hoveredData.time)))}px`,
            top: `${Math.max(15, getY(hoveredData.value) - 85)}px`,
            transform: "translateX(-50%)",
            backgroundColor: "var(--azura-card-bg)",
            border: `1.5px solid ${hoveredData.palette.stroke}`,
            borderRadius: "10px",
            padding: "8px 14px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
            pointerEvents: "none",
            zIndex: 30,
            minWidth: "170px"
          }}>
            {/* Ligne 1 : Id du capteur + Tag Statut */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: hoveredData.palette.stroke,
                  boxShadow: `0 0 6px ${hoveredData.palette.stroke}`
                }} />
                <span style={{ fontWeight: 800, color: "var(--azura-text)", fontSize: "0.82rem" }}>
                  {hoveredData.deviceId}
                </span>
              </div>
              <span style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                color: hoveredData.status === "HIGH" ? "#ef4444" : hoveredData.status === "LOW" ? "#0284c7" : "#22c55e",
                backgroundColor: hoveredData.status === "HIGH" ? "rgba(239, 68, 68, 0.12)" : hoveredData.status === "LOW" ? "rgba(2, 132, 199, 0.12)" : "rgba(34, 197, 94, 0.12)",
                padding: "2px 6px",
                borderRadius: "4px"
              }}>
                {hoveredData.status === "HIGH" ? "Haut" : hoveredData.status === "LOW" ? "Bas" : "Normal"}
              </span>
            </div>

            {/* Ligne 2 : Valeur Mesurée */}
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: hoveredData.palette.stroke, lineHeight: 1.2 }}>
              {hoveredData.value.toFixed(1)} {unit}
            </div>

            {/* Ligne 3 : Emplacement & Heure */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "4px",
              paddingTop: "4px",
              borderTop: "1px solid var(--azura-border)",
              fontSize: "0.7rem",
              color: "var(--azura-text-muted)"
            }}>
              <span>{hoveredData.location}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {new Date(hoveredData.time).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Pied de Carte : Badges des 3 Capteurs avec Valeurs Réelles Centrés au Bas */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "14px",
        paddingTop: "12px",
        borderTop: "1px solid var(--azura-border)"
      }}>
        {processedSeries.map((sp, idx) => {
          const hasData = sp.latestValue !== null;
          const isOffline = sp.latestStatus === "OFFLINE";
          const isBattery = sp.latestStatus === "LOW_BATTERY";
          const isHigh = sp.latestStatus === "HIGH";
          const isLow = sp.latestStatus === "LOW";

          let statusColor = "#22c55e";
          let statusText = "Normal";

          if (isOffline) {
            statusColor = "#ef4444";
            statusText = "Hors Ligne";
          } else if (isBattery) {
            statusColor = "#f59e0b";
            statusText = "Batterie";
          } else if (isHigh) {
            statusColor = "#ef4444";
            statusText = "Haut";
          } else if (isLow) {
            statusColor = "#0284c7";
            statusText = "Bas";
          }

          const isHoveredSeries = hoveredData && hoveredData.deviceId === sp.sensor.id;

          return (
            <div
              key={sp.sensor.id || idx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "9px",
                padding: "6px 14px",
                borderRadius: "10px",
                border: isHoveredSeries ? `1.5px solid ${sp.palette.stroke}` : `1px solid ${sp.palette.stroke}40`,
                backgroundColor: isHoveredSeries ? `${sp.palette.stroke}18` : "rgba(0, 0, 0, 0.02)",
                transition: "all 0.2s ease"
              }}
            >
              {/* Pastille de couleur spécifique */}
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: sp.palette.stroke,
                boxShadow: `0 0 8px ${sp.palette.stroke}`
              }} />

              <span style={{ fontWeight: 700, color: "var(--azura-text)", fontSize: "0.82rem" }}>
                {sp.sensor.id}
              </span>

              {hasData ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    fontWeight: 800,
                    color: isOffline ? "#ef4444" : isBattery ? "var(--azura-text)" : statusColor,
                    fontSize: "0.875rem",
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    {sp.latestValue.toFixed(1)} {unit}
                  </span>
                  <span style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    color: statusColor,
                    backgroundColor: `${statusColor}18`,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px"
                  }}>
                    {isOffline && <WifiSlash size={12} weight="bold" />}
                    {statusText}
                  </span>
                </div>
              ) : (
                <span style={{ color: "var(--azura-text-muted)", fontStyle: "italic", fontSize: "0.78rem" }}>
                  Connexion...
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SensorTypeChart;
