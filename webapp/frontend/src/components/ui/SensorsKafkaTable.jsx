import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowsClockwise, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle,
  CursorClick,
  Broadcast,
  MapPin,
  MapTrifold
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

// Libelles et couleurs pour les 4 emplacements officiels
const LOCATION_DISPLAY = {
  agadir_serre_1: { name: "Agadir - Serre 1", city: "Agadir", color: "#06b6d4" },
  dakhla_station_emballage: { name: "Dakhla - Station Emballage", city: "Dakhla", color: "#a855f7" },
  kenitra_station_filtrage: { name: "Kenitra - Station Filtrage", city: "Kenitra", color: "#f59e0b" },
  tangier_med_hub: { name: "Tanger Med - Hub Logistique", city: "Tanger Med", color: "#10b981" }
};

// 20 Capteurs actifs surveilles repartis sur les 4 zones (5 par zone avec coordonnees GPS exactes X/Y)
const ALL_SENSORS_METADATA = [
  // ── ZONE 1 : Agadir (agadir_serre_1) ──
  { id: "sensor_temp_001", type: "temperature",  loc: "agadir_serre_1",          latitude: 30.2840, longitude: -9.5070, color: "#06b6d4" },
  { id: "sensor_vib_001",  type: "vibration",    loc: "agadir_serre_1",          latitude: 30.2810, longitude: -9.5020, color: "#06b6d4" },
  { id: "sensor_pres_001", type: "pression",     loc: "agadir_serre_1",          latitude: 30.2860, longitude: -9.5040, color: "#06b6d4" },
  { id: "sensor_hum_001",  type: "humidite",     loc: "agadir_serre_1",          latitude: 30.2790, longitude: -9.5080, color: "#06b6d4" },
  { id: "sensor_pow_001",  type: "consommation", loc: "agadir_serre_1",          latitude: 30.2830, longitude: -9.4980, color: "#06b6d4" },

  // ── ZONE 2 : Dakhla (dakhla_station_emballage) ──
  { id: "sensor_temp_002", type: "temperature",  loc: "dakhla_station_emballage", latitude: 23.7140, longitude: -15.9220, color: "#a855f7" },
  { id: "sensor_vib_002",  type: "vibration",    loc: "dakhla_station_emballage", latitude: 23.7110, longitude: -15.9170, color: "#a855f7" },
  { id: "sensor_pres_002", type: "pression",     loc: "dakhla_station_emballage", latitude: 23.7160, longitude: -15.9190, color: "#a855f7" },
  { id: "sensor_hum_002",  type: "humidite",     loc: "dakhla_station_emballage", latitude: 23.7090, longitude: -15.9230, color: "#a855f7" },
  { id: "sensor_pow_002",  type: "consommation", loc: "dakhla_station_emballage", latitude: 23.7130, longitude: -15.9130, color: "#a855f7" },

  // ── ZONE 3 : Kenitra (kenitra_station_filtrage) ──
  { id: "sensor_temp_003", type: "temperature",  loc: "kenitra_station_filtrage", latitude: 34.2540, longitude: -6.5720, color: "#f59e0b" },
  { id: "sensor_vib_003",  type: "vibration",    loc: "kenitra_station_filtrage", latitude: 34.2510, longitude: -6.5670, color: "#f59e0b" },
  { id: "sensor_pres_003", type: "pression",     loc: "kenitra_station_filtrage", latitude: 34.2560, longitude: -6.5690, color: "#f59e0b" },
  { id: "sensor_hum_003",  type: "humidite",     loc: "kenitra_station_filtrage", latitude: 34.2490, longitude: -6.5730, color: "#f59e0b" },
  { id: "sensor_pow_003",  type: "consommation", loc: "kenitra_station_filtrage", latitude: 34.2530, longitude: -6.5630, color: "#f59e0b" },

  // ── ZONE 4 : Tanger Med (tangier_med_hub) ──
  { id: "sensor_temp_004", type: "temperature",  loc: "tangier_med_hub",          latitude: 35.8840, longitude: -5.5020, color: "#10b981" },
  { id: "sensor_vib_004",  type: "vibration",    loc: "tangier_med_hub",          latitude: 35.8810, longitude: -5.4970, color: "#10b981" },
  { id: "sensor_pres_004", type: "pression",     loc: "tangier_med_hub",          latitude: 35.8860, longitude: -5.4990, color: "#10b981" },
  { id: "sensor_hum_004",  type: "humidite",     loc: "tangier_med_hub",          latitude: 35.8790, longitude: -5.5030, color: "#10b981" },
  { id: "sensor_pow_004",  type: "consommation", loc: "tangier_med_hub",          latitude: 35.8830, longitude: -5.4930, color: "#10b981" },
];

export function SensorsKafkaTable({ sensorsMap = {}, thresholdsConfig = null, onSelectSensorLocation = null }) {
  const [isStreaming, setIsStreaming] = useState(true);
  const [frozenSensors, setFrozenSensors] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(Date.now());
  const [showClickMeHint, setShowClickMeHint] = useState(true);
  const [dynamicThresholds, setDynamicThresholds] = useState(thresholdsConfig);

  // Chargement / Actualisation périodique des seuils depuis l'API MongoDB
  useEffect(() => {
    if (thresholdsConfig) {
      setDynamicThresholds(thresholdsConfig);
      return;
    }
    const fetchThresholds = () => {
      fetch('/api/settings/thresholds')
        .then(res => res.json())
        .then(data => {
          if (data && data.thresholds) {
            setDynamicThresholds(data.thresholds);
          }
        })
        .catch(() => {});
    };
    fetchThresholds();
    const interval = setInterval(fetchThresholds, 3000);
    return () => clearInterval(interval);
  }, [thresholdsConfig]);

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
    fetch('/api/stats/sensors-state')
      .then(res => res.json())
      .then(data => {
        if (data && data.latest) {
          data.latest.forEach(item => {
            if (item.device_id) {
              freshSnapshot[item.device_id] = {
                latestValue: item.value,
                latestTimestamp: new Date(item.timestamp || Date.now()).getTime(),
                timestamp: item.timestamp,
                status: item.status
              };
            }
          });
        }
        setFrozenSensors(freshSnapshot);
        setLastUpdatedTime(Date.now());
      })
      .catch(() => {
        setLastUpdatedTime(Date.now());
      })
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 500);
      });
  };

  // Construction des 15 lignes du tableau avec statut et seuils dynamiques en direct
  const rows = useMemo(() => {
    const currentDataSource = isStreaming ? sensorsMap : frozenSensors;

    return ALL_SENSORS_METADATA.map(meta => {
      const liveData = currentDataSource[meta.id];
      const defaultCfg = SENSOR_TYPE_CONFIGS[meta.type] || { label: meta.type, unit: "", normal_range: [0, 100] };
      const dynCfg = dynamicThresholds && dynamicThresholds[meta.type];

      const normMin = dynCfg ? dynCfg.min : defaultCfg.normal_range[0];
      const normMax = dynCfg ? dynCfg.max : defaultCfg.normal_range[1];
      const unit = dynCfg ? dynCfg.unit : defaultCfg.unit;
      const label = dynCfg ? dynCfg.label : defaultCfg.label;

      let value = null;
      let timestamp = Date.now();
      let rawStatus = null;

      if (liveData) {
        rawStatus = liveData.status;
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
          rawStatus = lastPt.status || rawStatus;
        }
      }

      // Si pas encore de valeur reçue, valeur médiane nominale
      const hasRealData = value !== null && !isNaN(value);
      const displayVal = hasRealData ? value : (normMin + normMax) / 2;

      let status = "NORMAL";
      let statusLabel = "Normal";
      let statusColor = "#22c55e";

      // Évaluation dynamique par rapport aux bornes réelles MongoDB
      if (displayVal > normMax || (rawStatus && rawStatus.includes("HIGH"))) {
        status = "HIGH";
        statusLabel = "Haut";
        statusColor = "#ef4444";
      } else if (displayVal < normMin || (rawStatus && rawStatus.includes("LOW"))) {
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
        device_type: label,
        location: meta.loc,
        latitude: liveData?.latitude ?? meta.latitude,
        longitude: liveData?.longitude ?? meta.longitude,
        value: displayVal.toFixed(1),
        unit: unit,
        nominalRange: `${normMin} - ${normMax} ${unit}`,
        status,
        statusLabel,
        statusColor,
        dotColor: meta.color,
        timeStr,
        hasRealData
      };
    });
  }, [sensorsMap, frozenSensors, isStreaming, dynamicThresholds]);

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
            Etat Telemetrique des 20 Capteurs en Temps Reel
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
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

      {/* 3. Tableau Télémétrique Pleine Largeur avec Colonne Location */}
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
              <TableHead style={{ width: "16%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Equipement
              </TableHead>
              <TableHead style={{ width: "16%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Grandeur Mesuree
              </TableHead>
              <TableHead style={{ width: "18%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Emplacement
              </TableHead>
              <TableHead style={{ width: "16%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Valeur Actuelle
              </TableHead>
              <TableHead style={{ width: "14%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Plage Nominale
              </TableHead>
              <TableHead style={{ width: "10%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Statut
              </TableHead>
              <TableHead style={{ width: "10%", color: "var(--azura-text)", fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "14px 12px" }}>
                Location
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
                <TableCell style={{ padding: "14px 12px", textAlign: "center" }}>
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
                <TableCell style={{ padding: "14px 12px", textAlign: "center" }}>
                  <span style={{
                    fontWeight: 700,
                    color: "var(--azura-text)",
                    fontSize: "0.86rem"
                  }}>
                    {row.device_type}
                  </span>
                </TableCell>

                {/* Colonne 3 : Emplacement (Texte Standard Noir / Blanc en Dark Mode) */}
                <TableCell style={{
                  padding: "14px 12px",
                  textAlign: "center",
                  color: "var(--azura-text)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {row.location}
                </TableCell>

                {/* Colonne 4 : Valeur Actuelle */}
                <TableCell style={{ padding: "14px 12px", textAlign: "center" }}>
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
                  padding: "14px 12px",
                  textAlign: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "var(--azura-text-muted)",
                  fontSize: "0.82rem",
                  fontWeight: 600
                }}>
                  {row.nominalRange}
                </TableCell>

                {/* Colonne 6 : Statut */}
                <TableCell style={{ padding: "14px 12px", textAlign: "center" }}>
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

                {/* Colonne 7 : Bouton Icone Location (Noir / Blanc selon Dark Mode) */}
                <TableCell style={{ padding: "14px 12px", textAlign: "center" }}>
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (onSelectSensorLocation) {
                        onSelectSensorLocation(row);
                      }
                    }}
                    whileHover={{ scale: 1.2, y: -1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    title={`Localisation de ${row.id} (${row.location})`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: "transparent",
                      border: "none",
                      color: "var(--azura-text)",
                      cursor: "pointer",
                      transition: "opacity 0.2s ease, transform 0.2s ease",
                      outline: "none"
                    }}
                  >
                    <MapPin size={22} weight="regular" style={{ color: "var(--azura-text)" }} />
                  </motion.button>
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
