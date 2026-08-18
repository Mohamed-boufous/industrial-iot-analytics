import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowsClockwise, 
  ArrowUp, 
  ArrowDown,
  ClockCounterClockwise,
  ThermometerSimple,
  Waveform,
  Gauge,
  Drop,
  Lightning,
  Radio,
  ShieldCheck,
  CursorClick
} from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Badge } from "./badge";
import { RollingTime } from "./RollingTime";
import { MetalButton } from "./metal-button";

// Dictionnaire exhaustif de configuration télémétrique par grandeur
const METRIC_CONFIG_MAP = {
  temperature:  { label: "Temperature", unit: "°C",   Icon: ThermometerSimple, color: "#f97316", min: 5.0,   max: 80.0 },
  temp:         { label: "Temperature", unit: "°C",   Icon: ThermometerSimple, color: "#f97316", min: 5.0,   max: 80.0 },
  vibration:    { label: "Vibration",   unit: "mm/s", Icon: Waveform,          color: "#a855f7", min: 0.0,   max: 5.0 },
  vib:          { label: "Vibration",   unit: "mm/s", Icon: Waveform,          color: "#a855f7", min: 0.0,   max: 5.0 },
  pression:     { label: "Pression",    unit: "bar",  Icon: Gauge,             color: "#06b6d4", min: 1.0,   max: 10.0 },
  pressure:     { label: "Pression",    unit: "bar",  Icon: Gauge,             color: "#06b6d4", min: 1.0,   max: 10.0 },
  pres:         { label: "Pression",    unit: "bar",  Icon: Gauge,             color: "#06b6d4", min: 1.0,   max: 10.0 },
  humidite:     { label: "Humidite",    unit: "%",    Icon: Drop,              color: "#3b82f6", min: 30.0,  max: 70.0 },
  humidity:     { label: "Humidite",    unit: "%",    Icon: Drop,              color: "#3b82f6", min: 30.0,  max: 70.0 },
  hum:          { label: "Humidite",    unit: "%",    Icon: Drop,              color: "#3b82f6", min: 30.0,  max: 70.0 },
  consommation: { label: "Puissance",   unit: "kW",   Icon: Lightning,         color: "#eab308", min: 100.0, max: 500.0 },
  power:        { label: "Puissance",   unit: "kW",   Icon: Lightning,         color: "#eab308", min: 100.0, max: 500.0 },
  puissance:    { label: "Puissance",   unit: "kW",   Icon: Lightning,         color: "#eab308", min: 100.0, max: 500.0 },
  pow:          { label: "Puissance",   unit: "kW",   Icon: Lightning,         color: "#eab308", min: 100.0, max: 500.0 },
};

// Fonction de résolution infaillible de la grandeur industrielle
function resolveMetricInfo(deviceType, deviceId, status) {
  const dt = String(deviceType || "").toLowerCase().trim();
  if (METRIC_CONFIG_MAP[dt]) return METRIC_CONFIG_MAP[dt];

  const did = String(deviceId || "").toUpperCase();
  const st = String(status || "").toUpperCase();

  if (dt.includes("temp") || did.includes("TEMP") || st.includes("TEMP")) return METRIC_CONFIG_MAP.temperature;
  if (dt.includes("vib") || did.includes("VIB") || st.includes("VIB")) return METRIC_CONFIG_MAP.vibration;
  if (dt.includes("pres") || did.includes("PRES") || st.includes("PRES")) return METRIC_CONFIG_MAP.pression;
  if (dt.includes("hum") || did.includes("HUM") || st.includes("HUM")) return METRIC_CONFIG_MAP.humidite;
  if (dt.includes("pow") || dt.includes("cons") || did.includes("POW") || st.includes("POW")) return METRIC_CONFIG_MAP.consommation;

  return {
    label: deviceType ? (deviceType.charAt(0).toUpperCase() + deviceType.slice(1)) : "Capteur",
    unit: "",
    Icon: Radio,
    color: "#8b5cf6",
    min: 0,
    max: 100
  };
}

export function AlertsKafkaTable({ alerts = [], thresholdsConfig = null, onRefresh, isRefreshing: propIsRefreshing }) {
  // Mode Streaming en direct active par defaut
  const [isStreaming, setIsStreaming] = useState(true);
  // Donnees affichees dans le tableau (figees si streaming desactive jusqu'au clic sur Actualiser)
  const [displayedAlerts, setDisplayedAlerts] = useState([]);
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(Date.now());
  // Message interactif temporaire "Click me" affiche pendant 20s au demarrage
  const [showClickMeHint, setShowClickMeHint] = useState(true);

  const isRefreshing = propIsRefreshing !== undefined ? propIsRefreshing : isRefreshingLocal;

  // Minuteur automatique de 20s pour masquer l'indice "Click me"
  useEffect(() => {
    const hintTimer = setTimeout(() => {
      setShowClickMeHint(false);
    }, 20000);
    return () => clearTimeout(hintTimer);
  }, []);

  // Mise a jour continue lorsque le streaming est active
  useEffect(() => {
    if (isStreaming && Array.isArray(alerts) && alerts.length > 0) {
      setDisplayedAlerts(alerts.slice(0, 10));
      setLastUpdatedTime(Date.now());
    }
  }, [alerts, isStreaming]);

  // Initialisation au premier chargement
  useEffect(() => {
    if (displayedAlerts.length === 0 && alerts.length > 0) {
      setDisplayedAlerts(alerts.slice(0, 10));
      setLastUpdatedTime(Date.now());
    }
  }, [alerts]);

  // Fonction d'actualisation manuelle a la demande
  const handleManualRefresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    setIsRefreshingLocal(true);
    fetch("/api/stats/recent-alerts")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.alerts)) {
          setDisplayedAlerts(data.alerts.slice(0, 10));
          setLastUpdatedTime(Date.now());
        }
      })
      .catch(() => {
        setDisplayedAlerts(alerts.slice(0, 10));
        setLastUpdatedTime(Date.now());
      })
      .finally(() => {
        setTimeout(() => setIsRefreshingLocal(false), 500);
      });
  };

  // Bascule du mode Streaming (masque definitivement l'indice au clic)
  const toggleStreaming = () => {
    setShowClickMeHint(false);
    const nextState = !isStreaming;
    setIsStreaming(nextState);
    if (nextState) {
      setDisplayedAlerts(alerts.slice(0, 10));
      setLastUpdatedTime(Date.now());
    }
  };

  // Formatage et classification rigoureuse HIGH (Rouge) vs LOW (Bleu) avec seuils dynamiques
  const rows = useMemo(() => {
    return displayedAlerts.map((al, idx) => {
      const metricInfo = resolveMetricInfo(al.device_type || al.metric, al.device_id, al.status);
      const val = typeof al.value === "number" ? al.value : typeof al.current_value === "number" ? al.current_value : 0;
      
      const dyn = thresholdsConfig && (thresholdsConfig[al.device_type] || thresholdsConfig[al.metric]);
      const effMin = dyn ? Number(dyn.min) : metricInfo.min;
      const effMax = dyn ? Number(dyn.max) : metricInfo.max;
      const span = (effMax - effMin) || 1;

      // Classification exacte du sens : HIGH (Depassement Haut -> Rouge) vs LOW (Chute Basse -> Bleu)
      let isHigh = true;
      const statusStr = String(al.status || "").toUpperCase();
      const directionStr = String(al.direction || "").toUpperCase();

      if (directionStr === "LOW" || statusStr.includes("LOW") || statusStr.includes("GEL") || statusStr.includes("FUITE") || statusStr.includes("SEC") || statusStr.includes("DECONNEXION")) {
        isHigh = false;
      } else if (directionStr === "HIGH" || statusStr.includes("HIGH") || statusStr.includes("SURCHAUFFE") || statusStr.includes("SURPRESSION") || statusStr.includes("SURCHARGE")) {
        isHigh = true;
      } else {
        // Verification par rapport aux bornes minimales et maximales
        if (val < effMin) {
          isHigh = false;
        } else {
          isHigh = true;
        }
      }

      // Couleur stricte : ROUGE pour HIGH, BLEU pour LOW
      const directionColor = isHigh ? "#ef4444" : "#0284c7"; // Rouge vif vs Bleu electrique cyan
      const statusLabel = isHigh ? "Haut" : "Bas";
      const targetThreshold = al.threshold || (isHigh ? effMax : effMin);

      // Calcul dynamique précis de la sévérité en % d'écart
      let sevText = "CRITIQUE";
      if (al.deviation_pct !== undefined) {
        sevText = `+${al.deviation_pct.toFixed(1)}%`;
      } else if (isHigh && val > effMax) {
        const pct = ((val - effMax) / span) * 100;
        sevText = `+${pct.toFixed(1)}%`;
      } else if (!isHigh && val < effMin) {
        const pct = ((effMin - val) / span) * 100;
        sevText = `+${pct.toFixed(1)}%`;
      } else if (al.severity) {
        sevText = typeof al.severity === "number" ? `+${al.severity.toFixed(1)}%` : String(al.severity);
      }

      return {
        id: al._id || al.alert_id || `al-${idx}-${al.device_id}-${al.timestamp}`,
        device_id: al.device_id || "N/A",
        device_type: metricInfo.label,
        MetricIcon: metricInfo.Icon,
        metricColor: metricInfo.color,
        location: al.location || "Site AzurA",
        value: val,
        threshold: targetThreshold,
        unit: al.unit || metricInfo.unit,
        severity: sevText,
        statusLabel: statusLabel,
        isHigh: isHigh,
        directionColor: directionColor,
        timeStr: al.timestamp ? new Date(al.timestamp).toLocaleTimeString('fr-FR', { hour12: false }) : "N/A"
      };
    });
  }, [displayedAlerts, thresholdsConfig]);

  return (
    <div style={{
      backgroundColor: "var(--azura-card-bg)",
      border: "1px solid var(--azura-border)",
      borderRadius: "18px",
      padding: "24px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      width: "100%",
      position: "relative"
    }}>
      {/* 1. EN-TETE SUPÉRIEUR : TITRE CENTRE ET EPURE (CONFORME A SECTION 1 & 2) */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
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
          <ClockCounterClockwise size={24} weight="bold" style={{ color: "var(--azura-accent-red)", filter: "drop-shadow(0 0 8px rgba(239, 68, 68, 0.45))" }} />
          <h2 style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "var(--azura-text)",
            margin: 0,
            letterSpacing: "-0.02em",
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            Journal des 10 Derniers Incidents Detectes
          </h2>
        </div>
      </div>

      {/* 2. BARRE DE CONTROLES PLACE EN HAUT DU TABLEAU (DIRECTEMENT VISIBLE SANS SCROLL) */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: "14px",
        borderBottom: "1px solid var(--azura-border)",
        flexWrap: "wrap",
        gap: "12px",
        width: "100%"
      }}>
        {/* GROUPE DE BOUTONS TELEMETRIQUES AVEC ANIMATIONS FLUIDES ET INDICE 20S */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
          
          {/* Conteneur relatif du Bouton Streaming avec Indice Temporaire 'Click me' */}
          <div style={{ position: "relative", display: "inline-flex" }}>
            {/* Bulle d'indication "Click me" animee pendant 20s */}
            <AnimatePresence>
              {showClickMeHint && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.85 }}
                  animate={{ 
                    opacity: 1, 
                    y: [0, -4, 0], 
                    scale: 1,
                    transition: {
                      y: { repeat: Infinity, duration: 1.6, ease: "easeInOut" },
                      opacity: { duration: 0.3 }
                    }
                  }}
                  exit={{ opacity: 0, y: 6, scale: 0.85, transition: { duration: 0.25 } }}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 9px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#22c55e",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                    padding: "3px 9px",
                    borderRadius: "6px",
                    boxShadow: "0 4px 14px rgba(34, 197, 94, 0.4)",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    pointerEvents: "none",
                    zIndex: 20
                  }}
                >
                  <CursorClick size={14} weight="bold" />
                  <span>Click me</span>
                  {/* Fleche vers le bas */}
                  <span style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "5px solid #22c55e"
                  }} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bouton 3D Tactile Streaming Live / Pause */}
            <motion.button
              type="button"
              onClick={toggleStreaming}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ y: 1.5, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 18px",
                borderRadius: "12px",
                border: isStreaming ? "1px solid #86efac" : "1px solid #cbd5e1",
                background: isStreaming
                  ? "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)"
                  : "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                boxShadow: isStreaming
                  ? "inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 3px 0 #4ade80, 0 6px 14px rgba(34, 197, 94, 0.22)"
                  : "inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 3px 0 #94a3b8, 0 5px 10px rgba(0, 0, 0, 0.06)",
                cursor: "pointer",
                userSelect: "none",
                outline: "none"
              }}
            >
              <span style={{
                position: "relative",
                display: "flex",
                width: "8px",
                height: "8px"
              }}>
                {isStreaming && (
                  <span style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    opacity: 0.75,
                    animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
                  }} />
                )}
                <span style={{
                  position: "relative",
                  display: "inline-flex",
                  borderRadius: "50%",
                  width: "8px",
                  height: "8px",
                  backgroundColor: isStreaming ? "#22c55e" : "#64748b",
                  boxShadow: isStreaming ? "0 0 8px #22c55e" : "none"
                }} />
              </span>

              <span style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                color: isStreaming ? "#15803d" : "#475569",
                letterSpacing: "0.01em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {isStreaming ? "Streaming Live Actif" : "Streaming en Pause"}
              </span>
            </motion.button>
          </div>

          {/* Bouton 3D Tactile Actualiser Manuel */}
          <AnimatePresence mode="popLayout">
            {!isStreaming && (
              <motion.div
                layout
                initial={{ opacity: 0, x: -12, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -12, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
              >
                <motion.button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  whileHover={{ y: isRefreshing ? 0 : -2, scale: isRefreshing ? 1 : 1.02 }}
                  whileTap={{ y: isRefreshing ? 0 : 1.5, scale: isRefreshing ? 1 : 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 18px",
                    borderRadius: "12px",
                    border: "1px solid #fca5a5",
                    background: "linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)",
                    boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 3px 0 #f87171, 0 6px 14px rgba(239, 68, 68, 0.22)",
                    cursor: isRefreshing ? "not-allowed" : "pointer",
                    opacity: isRefreshing ? 0.75 : 1,
                    userSelect: "none",
                    outline: "none"
                  }}
                >
                  <ArrowsClockwise
                    size={16}
                    weight="bold"
                    style={{ color: "#dc2626" }}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                  <span style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "#b91c1c",
                    letterSpacing: "0.01em",
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    {isRefreshing ? "Synchronisation..." : "Actualiser"}
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Horodatage Dynamique avec Rolling Time */}
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
            timestamp={lastUpdatedTime}
            style={{
              color: "var(--azura-text)",
              fontWeight: 800,
              fontSize: "0.8125rem",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
        </div>
      </div>

      {/* 3. SURFACE DU TABLEAU TELEMETRIQUE PRENANT 100% DE LA LARGEUR */}
      <div style={{
        width: "100%",
        overflowX: "auto",
        borderRadius: "14px",
        border: "1px solid var(--azura-border)",
        backgroundColor: "rgba(0, 0, 0, 0.02)",
        padding: "2px"
      }}>
        <Table style={{ width: "100%", tableLayout: "fixed" }}>
          <TableHeader style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
            <TableRow style={{ borderBottom: "1px solid var(--azura-border)" }}>
              <TableHead style={{ width: "18%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Equipement
              </TableHead>
              <TableHead style={{ width: "18%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Grandeur Mesuree
              </TableHead>
              <TableHead style={{ width: "20%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Emplacement
              </TableHead>
              <TableHead style={{ width: "18%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Valeur / Tolerance
              </TableHead>
              <TableHead style={{ width: "13%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Critique
              </TableHead>
              <TableHead style={{ width: "13%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Horodatage
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => {
                return (
                  <TableRow
                    key={row.id}
                    style={{
                      borderBottom: "1px solid var(--azura-border)",
                      transition: "background-color 0.15s ease",
                    }}
                    className="hover:bg-white/[0.03]"
                  >
                    {/* Colonne 1 : Equipement (Centre avec pastille Rouge pour HIGH, Bleu pour LOW) */}
                    <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: row.directionColor,
                          boxShadow: `0 0 8px ${row.directionColor}`,
                          flexShrink: 0
                        }} />
                        <span style={{
                          fontWeight: 800,
                          color: "var(--azura-text)",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.88rem"
                        }}>
                          {row.device_id}
                        </span>
                      </div>
                    </TableCell>

                    {/* Colonne 2 : Grandeur Mesuree (Texte pur centre sans icone ni emoji) */}
                    <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span style={{
                        fontWeight: 700,
                        color: "var(--azura-text)",
                        fontSize: "0.86rem"
                      }}>
                        {row.device_type}
                      </span>
                    </TableCell>

                    {/* Colonne 3 : Emplacement Industriel (Centre) */}
                    <TableCell style={{ padding: "14px 16px", textAlign: "center", color: "var(--azura-text-muted)", fontSize: "0.84rem", fontWeight: 500 }}>
                      {row.location}
                    </TableCell>

                    {/* Colonne 4 : Valeur Mesuree vs Seuil (Centre avec fleche Rouge pour HIGH, Bleu pour LOW) */}
                    <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <span style={{
                          fontWeight: 800,
                          color: row.directionColor,
                          fontSize: "0.95rem",
                          fontFamily: "'JetBrains Mono', monospace"
                        }}>
                          {row.value} {row.unit}
                        </span>
                        {row.isHigh ? (
                          <ArrowUp size={14} weight="bold" style={{ color: "#ef4444", flexShrink: 0 }} />
                        ) : (
                          <ArrowDown size={14} weight="bold" style={{ color: "#0284c7", flexShrink: 0 }} />
                        )}
                      </div>
                    </TableCell>

                    {/* Colonne 5 : Critique (Centre sans cadre : Haut en Rouge, Bas en Bleu) */}
                    <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          color: row.directionColor,
                          fontWeight: 800,
                          fontSize: "0.86rem",
                          fontFamily: "'JetBrains Mono', monospace",
                          letterSpacing: "0.02em"
                        }}
                      >
                        {row.statusLabel}
                      </span>
                    </TableCell>

                    {/* Colonne 6 : Horodatage (Centre) */}
                    <TableCell style={{
                      padding: "14px 16px",
                      textAlign: "center",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "var(--azura-text-muted)",
                      fontSize: "0.82rem"
                    }}>
                      {row.timeStr}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} style={{ textAlign: "center", padding: "36px 0", color: "var(--azura-text-muted)" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={28} weight="bold" style={{ color: "#22c55e" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--azura-text)" }}>
                      Aucun incident recent enregistre
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--azura-text-muted)" }}>
                      Les seuils nominaux sont respectes sur l'ensemble des equipements surveilles.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default AlertsKafkaTable;
