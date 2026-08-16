import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowsClockwise, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle,
  CursorClick,
  Broadcast
} from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { RollingTime } from "./RollingTime";
import { MetalButton } from "./metal-button";

// Configuration des seuils nominaux par type de capteur
const SENSOR_TYPE_CONFIGS = {
  temperature: { label: "Temperature", unit: "°C", normal_range: [20.0, 80.0] },
  vibration: { label: "Vibration", unit: "mm/s", normal_range: [0.0, 5.0] },
  pression: { label: "Pression", unit: "bar", normal_range: [1.0, 10.0] },
  humidite: { label: "Humidite", unit: "%", normal_range: [30.0, 70.0] },
  consommation: { label: "Puissance Electrique", unit: "kW", normal_range: [100.0, 500.0] }
};

// 15 Capteurs actifs surveillés
const ALL_SENSORS_METADATA = [
  { id: "sensor_temp_001", type: "temperature", loc: "agadir_serre_1", color: "#06b6d4" },
  { id: "sensor_temp_002", type: "temperature", loc: "dakhla_station_pompage", color: "#a855f7" },
  { id: "sensor_temp_003", type: "temperature", loc: "chichaoua_parc_solaire", color: "#f59e0b" },
  { id: "sensor_vib_001", type: "vibration", loc: "agadir_serre_1", color: "#06b6d4" },
  { id: "sensor_vib_002", type: "vibration", loc: "dakhla_station_pompage", color: "#a855f7" },
  { id: "sensor_vib_003", type: "vibration", loc: "chichaoua_parc_solaire", color: "#f59e0b" },
  { id: "sensor_pres_001", type: "pression", loc: "agadir_serre_1", color: "#06b6d4" },
  { id: "sensor_pres_002", type: "pression", loc: "dakhla_station_pompage", color: "#a855f7" },
  { id: "sensor_pres_003", type: "pression", loc: "chichaoua_parc_solaire", color: "#f59e0b" },
  { id: "sensor_hum_001", type: "humidite", loc: "agadir_serre_1", color: "#06b6d4" },
  { id: "sensor_hum_002", type: "humidite", loc: "dakhla_station_pompage", color: "#a855f7" },
  { id: "sensor_hum_003", type: "humidite", loc: "chichaoua_parc_solaire", color: "#f59e0b" },
  { id: "sensor_pow_001", type: "consommation", loc: "transformateur_general", color: "#06b6d4" },
  { id: "sensor_pow_002", type: "consommation", loc: "groupe_secours_agadir", color: "#a855f7" },
  { id: "sensor_pow_003", type: "consommation", loc: "station_solaire_dakhla", color: "#f59e0b" }
];

export function SensorsKafkaTable({ sensorsMap = {} }) {
  const [isStreaming, setIsStreaming] = useState(true);
  const [frozenSensors, setFrozenSensors] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(Date.now());
  const [showClickMeHint, setShowClickMeHint] = useState(true);

  // Minuteur automatique de 20s pour masquer l'indice "Click me"
  useEffect(() => {
    const hintTimer = setTimeout(() => {
      setShowClickMeHint(false);
    }, 20000);
    return () => clearTimeout(hintTimer);
  }, []);

  // En mode streaming actif, synchroniser l'affichage
  useEffect(() => {
    if (isStreaming) {
      setFrozenSensors(sensorsMap);
      setLastUpdatedTime(Date.now());
    }
  }, [sensorsMap, isStreaming]);

  // Initialisation dès la première réception de données
  useEffect(() => {
    if (Object.keys(frozenSensors).length === 0 && Object.keys(sensorsMap).length > 0) {
      setFrozenSensors(sensorsMap);
      setLastUpdatedTime(Date.now());
    }
  }, [sensorsMap]);

  // Bascule du mode Streaming (Live vs Pause)
  const toggleStreaming = () => {
    if (isStreaming) {
      // Fige les données
      setFrozenSensors({ ...sensorsMap });
      setIsStreaming(false);
    } else {
      // Reprend le flux en direct
      setIsStreaming(true);
      setFrozenSensors({ ...sensorsMap });
      setLastUpdatedTime(Date.now());
    }
  };

  // Actualisation manuelle lorsque le streaming est en pause
  const handleManualRefresh = () => {
    setIsRefreshing(true);

    // Snapshot direct depuis le dictionnaire temps réel en mémoire
    const freshSnapshot = {};
    Object.entries(sensorsMap).forEach(([sId, data]) => {
      freshSnapshot[sId] = { ...data };
    });

    fetch('/api/stats/sensors-state')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.latest)) {
          data.latest.forEach(item => {
            if (item.device_id) {
              const prev = freshSnapshot[item.device_id] || {};
              freshSnapshot[item.device_id] = {
                ...prev,
                id: item.device_id,
                type: item.device_type || prev.type,
                loc: item.location || prev.loc,
                unit: item.unit || prev.unit,
                latestValue: Number(item.value),
                value: Number(item.value),
                latestTimestamp: new Date(item.timestamp || Date.now()).getTime(),
                timestamp: item.timestamp
              };
            }
          });
        }
        setFrozenSensors(freshSnapshot);
        setLastUpdatedTime(Date.now());
      })
      .catch(() => {
        setFrozenSensors(freshSnapshot);
        setLastUpdatedTime(Date.now());
      })
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 500);
      });
  };

  // Construction des 15 lignes du tableau avec statut et seuils en direct
  const rows = useMemo(() => {
    const currentDataSource = isStreaming ? sensorsMap : frozenSensors;

    return ALL_SENSORS_METADATA.map(meta => {
      const liveData = currentDataSource[meta.id];
      const cfg = SENSOR_TYPE_CONFIGS[meta.type] || { label: meta.type, unit: "", normal_range: [0, 100] };
      const [normMin, normMax] = cfg.normal_range;

      let value = null;
      let timestamp = Date.now();

      if (liveData) {
        if (typeof liveData.latestValue === "number" && !isNaN(liveData.latestValue)) {
          value = liveData.latestValue;
          timestamp = liveData.latestTimestamp || timestamp;
        } else if (typeof liveData.value === "number" && !isNaN(liveData.value)) {
          value = liveData.value;
          timestamp = liveData.latestTimestamp || (liveData.timestamp ? new Date(liveData.timestamp).getTime() : timestamp);
        } else if (liveData.points && liveData.points.length > 0) {
          const lastPt = liveData.points[liveData.points.length - 1];
          value = lastPt.value;
          timestamp = lastPt.time || timestamp;
        }
      }

      // Si pas encore de valeur reçue, valeur médiane nominale
      const hasRealData = value !== null && !isNaN(value);
      const displayVal = hasRealData ? value : (normMin + normMax) / 2;

      let status = "NORMAL";
      let statusLabel = "Normal";
      let statusColor = "#22c55e";

      if (displayVal > normMax) {
        status = "HIGH";
        statusLabel = "Haut";
        statusColor = "#ef4444";
      } else if (displayVal < normMin) {
        status = "LOW";
        statusLabel = "Bas";
        statusColor = "#0284c7";
      }

      const timeStr = new Date(timestamp).toLocaleTimeString('fr-FR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return {
        id: meta.id,
        device_type: cfg.label,
        location: meta.loc,
        value: displayVal.toFixed(1),
        unit: cfg.unit,
        nominalRange: `${normMin} - ${normMax} ${cfg.unit}`,
        status,
        statusLabel,
        statusColor,
        dotColor: meta.color,
        timeStr,
        hasRealData
      };
    });
  }, [sensorsMap, frozenSensors, isStreaming]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* 1. Entête du Tableau : Titre Centré & Épuré */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "8px 0",
        gap: "6px"
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 14px",
          borderRadius: "9999px",
          backgroundColor: "rgba(255, 255, 255, 0.02)"
        }}>
          <Broadcast size={22} weight="bold" style={{ color: "var(--azura-accent-green)", filter: "drop-shadow(0 0 8px rgba(34, 197, 94, 0.45))" }} />
          <h2 style={{
            fontSize: "1.2rem",
            fontWeight: 800,
            color: "var(--azura-text)",
            margin: 0,
            letterSpacing: "-0.01em",
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            Etat Telemetrique des 15 Capteurs en Temps Reel
          </h2>
        </div>
      </div>

      {/* 2. Barre de Contrôles : Streaming / Actualiser + Horodatage Dynamique */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "14px",
        padding: "10px 16px",
        backgroundColor: "var(--azura-card-bg)",
        border: "1px solid var(--azura-border)",
        borderRadius: "14px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Conteneur du Bouton Streaming avec Indice Temporaire 'Click me' */}
          <div style={{ position: "relative", display: "inline-flex" }}>
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

            {/* Bouton Streaming Liquid Metal */}
            <MetalButton
              preset={isStreaming ? "chromatic" : "silver"}
              variant="outline"
              strength={1.0}
              ringCssPx={4.0}
              shaderScale={1.8}
              borderRadius={14}
              onClick={toggleStreaming}
              className="!py-3.5 !px-8 border-0 bg-transparent cursor-pointer"
              style={{ padding: "12px 28px" }}
              metalFxStyle={{
                backgroundColor: isStreaming ? "rgba(34, 197, 94, 0.16)" : "rgba(0, 0, 0, 0.05)",
                border: isStreaming ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid var(--azura-border)",
                borderRadius: "14px",
                boxShadow: isStreaming ? "0 4px 18px rgba(34, 197, 94, 0.22)" : "none"
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
                <span style={{
                  position: "relative",
                  display: "flex",
                  width: "9px",
                  height: "9px"
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
                    width: "9px",
                    height: "9px",
                    backgroundColor: isStreaming ? "#22c55e" : "var(--azura-text-muted)",
                    boxShadow: isStreaming ? "0 0 10px #22c55e" : "none"
                  }} />
                </span>

                <span style={{
                  fontSize: "0.875rem",
                  fontWeight: 800,
                  color: isStreaming ? "#22c55e" : "var(--azura-text-muted)",
                  letterSpacing: "0.01em",
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {isStreaming ? "Streaming Live Actif" : "Streaming en Pause"}
                </span>
              </div>
            </MetalButton>
          </div>

          {/* Bouton Actualiser Manuel */}
          <AnimatePresence mode="popLayout">
            {!isStreaming && (
              <motion.div
                layout
                initial={{ opacity: 0, x: -20, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <MetalButton
                  preset="gold"
                  variant="outline"
                  strength={1.0}
                  ringCssPx={4.0}
                  shaderScale={1.8}
                  borderRadius={14}
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="!py-3.5 !px-6 border-0 bg-transparent cursor-pointer"
                  style={{ padding: "12px 24px" }}
                  metalFxStyle={{
                    backgroundColor: "rgba(239, 68, 68, 0.16)",
                    border: "1px solid rgba(239, 68, 68, 0.5)",
                    borderRadius: "14px",
                    boxShadow: "0 4px 18px rgba(239, 68, 68, 0.22)"
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", color: "var(--azura-accent-red)" }}>
                    <ArrowsClockwise
                      size={18}
                      weight="bold"
                      className={isRefreshing ? "animate-spin" : ""}
                    />
                    <span style={{ fontSize: "0.875rem", fontWeight: 800, letterSpacing: "0.01em", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {isRefreshing ? "Synchronisation..." : "Actualiser"}
                    </span>
                  </div>
                </MetalButton>
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

      {/* 3. Tableau Télémétrique Pleine Largeur */}
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
                Valeur Actuelle
              </TableHead>
              <TableHead style={{ width: "14%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Plage Nominale
              </TableHead>
              <TableHead style={{ width: "12%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 16px" }}>
                Statut
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                style={{
                  borderBottom: "1px solid var(--azura-border)",
                  transition: "background-color 0.15s ease"
                }}
                className="hover:bg-white/[0.03]"
              >
                {/* Colonne 1 : Equipement */}
                <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: row.dotColor,
                      boxShadow: `0 0 8px ${row.dotColor}`,
                      flexShrink: 0
                    }} />
                    <span style={{
                      fontWeight: 800,
                      color: "var(--azura-text)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.88rem"
                    }}>
                      {row.id}
                    </span>
                  </div>
                </TableCell>

                {/* Colonne 2 : Grandeur Mesurée */}
                <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                  <span style={{
                    fontWeight: 700,
                    color: "var(--azura-text)",
                    fontSize: "0.86rem"
                  }}>
                    {row.device_type}
                  </span>
                </TableCell>

                {/* Colonne 3 : Emplacement */}
                <TableCell style={{ padding: "14px 16px", textAlign: "center", color: "var(--azura-text-muted)", fontSize: "0.84rem", fontWeight: 500 }}>
                  {row.location}
                </TableCell>

                {/* Colonne 4 : Valeur Actuelle */}
                <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span style={{
                      fontWeight: 800,
                      color: row.statusColor,
                      fontSize: "0.95rem",
                      fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      {row.value} {row.unit}
                    </span>
                    {row.status === "HIGH" && (
                      <ArrowUp size={14} weight="bold" style={{ color: "#ef4444", flexShrink: 0 }} />
                    )}
                    {row.status === "LOW" && (
                      <ArrowDown size={14} weight="bold" style={{ color: "#0284c7", flexShrink: 0 }} />
                    )}
                  </div>
                </TableCell>

                {/* Colonne 5 : Plage Nominale */}
                <TableCell style={{
                  padding: "14px 16px",
                  textAlign: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "var(--azura-text-muted)",
                  fontSize: "0.82rem",
                  fontWeight: 600
                }}>
                  {row.nominalRange}
                </TableCell>

                {/* Colonne 6 : Statut (Normal en Vert, Haut en Rouge, Bas en Bleu) */}
                <TableCell style={{ padding: "14px 16px", textAlign: "center" }}>
                  <span
                    style={{
                      color: row.statusColor,
                      fontWeight: 800,
                      fontSize: "0.86rem",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.02em"
                    }}
                  >
                    {row.statusLabel}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default SensorsKafkaTable;
