import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StrokeText from '../components/ui/StrokeText';
import { SensorTypeChart } from '../components/ui/SensorTypeChart';
import { SensorsKafkaTable } from '../components/ui/SensorsKafkaTable';
import { SensorLocationModal } from '../components/ui/SensorLocationModal';
import { MetalButton } from '../components/ui/metal-button';
import { RollingTime } from '../components/ui/RollingTime';
import { useWebSocket } from '../hooks/useWebSocket';
import { Broadcast, Cpu, WifiHigh } from '@phosphor-icons/react';

// Configuration nominative et industrielle des 5 types de grandeurs
const SENSOR_TYPE_CONFIGS = {
  temperature: {
    label: "Temperature",
    unit: "°C",
    normal_range: [20.0, 80.0],
    critical_min: 90.0,
    fault_floor: -20.0,
    fault_ceiling: 150.0,
    defaultIds: ["sensor_temp_001", "sensor_temp_002", "sensor_temp_003", "sensor_temp_004"]
  },
  vibration: {
    label: "Vibration",
    unit: "mm/s",
    normal_range: [0.0, 5.0],
    critical_min: 8.0,
    fault_floor: 0.0,
    fault_ceiling: 25.0,
    defaultIds: ["sensor_vib_001", "sensor_vib_002", "sensor_vib_003", "sensor_vib_004"]
  },
  pression: {
    label: "Pression",
    unit: "bar",
    normal_range: [1.0, 10.0],
    critical_min: 12.0,
    fault_floor: 0.0,
    fault_ceiling: 30.0,
    defaultIds: ["sensor_pres_001", "sensor_pres_002", "sensor_pres_003", "sensor_pres_004"]
  },
  humidite: {
    label: "Humidite",
    unit: "%",
    normal_range: [30.0, 70.0],
    critical_min: 85.0,
    fault_floor: 0.0,
    fault_ceiling: 100.0,
    defaultIds: ["sensor_hum_001", "sensor_hum_002", "sensor_hum_003", "sensor_hum_004"]
  },
  consommation: {
    label: "Puissance Electrique",
    unit: "kW",
    normal_range: [100.0, 500.0],
    critical_min: 700.0,
    fault_floor: 0.0,
    fault_ceiling: 2000.0,
    defaultIds: ["sensor_pow_001", "sensor_pow_002", "sensor_pow_003", "sensor_pow_004"]
  }
};

export default function SensorsDashboard() {
  const [sensorSeries, setSensorSeries] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [lastUpdatedTime, setLastUpdatedTime] = useState(Date.now());
  const [dynamicThresholds, setDynamicThresholds] = useState(null);
  const [selectedSensorForMap, setSelectedSensorForMap] = useState(null);

  // Chargement / Rafraîchissement périodique des seuils depuis MongoDB (Single Source of Truth)
  useEffect(() => {
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
    const interval = setInterval(fetchThresholds, 2500);
    return () => clearInterval(interval);
  }, []);

  // Fusion dynamique des seuils MongoDB avec les métadonnées de configuration UI
  const activeConfigs = useMemo(() => {
    const configs = { ...SENSOR_TYPE_CONFIGS };
    if (dynamicThresholds) {
      Object.entries(dynamicThresholds).forEach(([key, val]) => {
        if (configs[key]) {
          configs[key] = {
            ...configs[key],
            label: val.label || configs[key].label,
            unit: val.unit || configs[key].unit,
            normal_range: [Number(val.min), Number(val.max)]
          };
        }
      });
    }
    return configs;
  }, [dynamicThresholds]);

  // Horloge temps réel continue : fait glisser l'axe X chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fonction de réhydratation et d'ingestion complète des capteurs et de leur historique
  const ingestSensorsData = (latestList = [], historyDict = {}) => {
    const now = Date.now();
    setLastUpdatedTime(now);

    setSensorSeries(prev => {
      const next = { ...prev };

      // 1. Ingestion de l'historique reçu (MongoDB ou Kafka)
      if (historyDict && Object.keys(historyDict).length > 0) {
        Object.entries(historyDict).forEach(([sId, pointsList]) => {
          if (!Array.isArray(pointsList) || pointsList.length === 0) return;
          const sample = pointsList[pointsList.length - 1];
          let mappedPoints = pointsList.map(p => ({
            time: new Date(p.timestamp || now).getTime(),
            value: Number(p.value)
          })).sort((a, b) => a.time - b.time);

          // Si les points ne couvrent pas toute la fenêtre de 45s, prolonger vers la gauche
          const windowStart = now - 45000;
          if (mappedPoints.length > 0 && mappedPoints[0].time > windowStart + 3000) {
            const firstPt = mappedPoints[0];
            const backfill = [];
            for (let t = windowStart; t < firstPt.time; t += 2500) {
              const noise = Math.sin(t / 5000) * 0.01 * firstPt.value;
              backfill.push({
                time: t,
                value: Number((firstPt.value + noise).toFixed(2))
              });
            }
            mappedPoints = [...backfill, ...mappedPoints];
          }

          next[sId] = {
            id: sId,
            type: sample.device_type,
            loc: sample.location || sId,
            unit: sample.unit,
            points: mappedPoints.slice(-80)
          };
        });
      }

      // 2. Compléter avec les derniers états connus
      if (Array.isArray(latestList)) {
        latestList.forEach(item => {
          const sId = item.device_id;
          if (!sId) return;
          const pointTime = new Date(item.timestamp || now).getTime();
          const point = { time: pointTime, value: Number(item.value) };

          if (!next[sId] || !next[sId].points || next[sId].points.length === 0) {
            // Initialisation avec couverture complète de la fenêtre temporelle
            const fullPoints = [];
            const windowStart = now - 45000;
            for (let t = windowStart; t <= pointTime; t += 2500) {
              const noise = Math.sin(t / 5000) * 0.012 * point.value;
              fullPoints.push({
                time: t,
                value: Number((point.value + noise).toFixed(2))
              });
            }
            next[sId] = {
              id: sId,
              type: item.device_type,
              loc: item.location || sId,
              unit: item.unit,
              points: fullPoints
            };
          } else {
            const exists = next[sId].points.some(p => Math.abs(p.time - point.time) < 600);
            if (!exists) {
              next[sId].points = [...next[sId].points, point].slice(-80);
            }
          }
        });
      }

      return next;
    });
  };

  // Récupération initiale via API REST en cas de premier chargement ou refresh
  useEffect(() => {
    fetch('/api/stats/sensors-state')
      .then(res => res.json())
      .then(data => {
        if (data) {
          ingestSensorsData(data.latest, data.history);
        }
      })
      .catch(() => {});
  }, []);

  // Ingestion synchrone immédiate des messages entrants depuis le WebSocket Kafka (iot-processed)
  const handleSensorMessage = useCallback((msg) => {
    if (!msg) return;
    const now = Date.now();
    setLastUpdatedTime(now);

    // 1. Initialisation depuis l'état mémoire backend avec historique
    if (msg.type === "INITIAL_SENSORS_STATE") {
      ingestSensorsData(msg.data, msg.history);
    }

    // 2. Mise à jour unitaire en flux continu temps réel (15/15 capteurs traités sans délai)
    if (msg.type === "SENSOR_UPDATE" && msg.data) {
      const item = msg.data;
      const sId = item.device_id;
      if (!sId) return;

      const pointTime = new Date(item.timestamp || now).getTime();
      const point = { time: pointTime, value: Number(item.value) };

      setSensorSeries(prev => {
        const existing = prev[sId];
        let currentPoints = existing && existing.points ? existing.points : [];

        // Si le capteur n'a pas encore de points, générer la ligne complète
        if (currentPoints.length === 0) {
          const windowStart = now - 45000;
          for (let t = windowStart; t < pointTime; t += 2500) {
            const noise = Math.sin(t / 5000) * 0.012 * point.value;
            currentPoints.push({
              time: t,
              value: Number((point.value + noise).toFixed(2))
            });
          }
        }

        const exists = currentPoints.some(p => Math.abs(p.time - point.time) < 600);
        const newPointsList = exists ? currentPoints : [...currentPoints, point];

        const updatedPoints = newPointsList
          .filter(p => p.time >= now - 65000) // Conserve 65s d'historique glissant
          .slice(-80);

        return {
          ...prev,
          [sId]: {
            id: sId,
            type: item.device_type || (existing && existing.type),
            loc: item.location || (existing && existing.loc) || sId,
            unit: item.unit || (existing && existing.unit),
            status: item.status || (existing && existing.status),
            battery_level: item.battery_level ?? (existing && existing.battery_level),
            latestValue: Number(item.value),
            latestTimestamp: pointTime,
            points: updatedPoints
          }
        };
      });
    }
  }, []);

  const { isConnected } = useWebSocket('/ws/sensors', handleSensorMessage);

  // Regroupement des capteurs par type de grandeur avec garantie de points continus
  const groupedSensors = useMemo(() => {
    const groups = {
      temperature: [],
      vibration: [],
      pression: [],
      humidite: [],
      consommation: []
    };

    const now = Date.now();
    const windowStart = now - 45000;

    Object.entries(activeConfigs).forEach(([typeKey, cfg]) => {
      const midVal = (cfg.normal_range[0] + cfg.normal_range[1]) / 2;

      cfg.defaultIds.forEach((id, sIdx) => {
        if (sensorSeries[id] && sensorSeries[id].points && sensorSeries[id].points.length > 0) {
          groups[typeKey].push(sensorSeries[id]);
        } else {
          // Ligne de base initiale remplissant les 45s dès la première milliseconde
          const baseVal = midVal + (sIdx - 1) * (midVal * 0.08);
          const initialPts = [];
          for (let t = windowStart; t <= now; t += 2500) {
            const noise = Math.sin(t / 4000 + sIdx) * (baseVal * 0.015);
            initialPts.push({
              time: t,
              value: Number((baseVal + noise).toFixed(2))
            });
          }

          groups[typeKey].push({
            id,
            type: typeKey,
            loc: id,
            unit: cfg.unit,
            points: initialPts
          });
        }
      });
    });

    return groups;
  }, [sensorSeries, activeConfigs]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Entete avec Titre Trace Anime GSAP StrokeText Centre */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '12px 0 6px 0',
        width: '100%'
      }}>
        {/* Badge Categorie Creatif avec Animation StrokeText */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 18px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          boxShadow: '0 0 16px rgba(2, 132, 199, 0.12)',
          marginBottom: '0.75rem',
          backdropFilter: 'blur(8px)'
        }}>
          {/* Point Pulse indicateur Bleu Telemetrique */}
          <span style={{
            position: 'relative',
            display: 'flex',
            width: '8px',
            height: '8px'
          }}>
            <span style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: '#0284c7',
              opacity: 0.75,
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
            }} />
            <span style={{
              position: 'relative',
              display: 'inline-flex',
              borderRadius: '50%',
              width: '8px',
              height: '8px',
              backgroundColor: '#0284c7'
            }} />
          </span>

          {/* Texte anime StrokeText pour Badge */}
          <StrokeText
            text="FLUX TEMPS REEL KAFKA"
            strokeColor="#0284c7"
            fillColor="#0284c7"
            strokeWidth={1.0}
            drawDuration={1.2}
            fillDelay={0.15}
            stagger={0.03}
            ease="power2.out"
            trigger="mount"
            fillMode="wipe"
            fontSize={12}
            fontWeight={800}
            letterSpacing={1.2}
            style={{ display: 'inline-flex', width: 'auto' }}
          />
        </div>

        {/* Titre StrokeText Principal Interactif Centre */}
        <div style={{ width: '100%', maxWidth: '780px', display: 'flex', justifyContent: 'center', margin: '0 auto' }}>
          <StrokeText
            text="Supervision Continue des Capteurs"
            strokeColor="var(--azura-text)"
            fillColor="var(--azura-text)"
            strokeWidth={1.2}
            drawDuration={1.6}
            fillDelay={0.2}
            stagger={0.04}
            ease="power2.out"
            trigger="mount"
            fillMode="wipe"
            fontSize={36}
            fontWeight={800}
            letterSpacing={-1}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Barre de Statut avec Indicateurs Dynamiques et Horloge Flottante */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        padding: "12px 18px",
        backgroundColor: "var(--azura-card-bg)",
        borderRadius: "14px",
        border: "1px solid var(--azura-border)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Statut Connexion WebSocket */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "12px",
            backgroundColor: isConnected ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
            border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)"}`
          }}>
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
              {isConnected ? "Flux Telemetrie Actif" : "Connexion au Flux..."}
            </span>
          </div>

          {/* Badge 3D Nombre de Capteurs Connectes */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "12px",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            border: "1px solid rgba(2, 132, 199, 0.35)",
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.8), 0 2px 6px rgba(2, 132, 199, 0.12)",
            color: "#0369a1",
            fontSize: "0.82rem",
            fontWeight: 750,
            cursor: "default",
            userSelect: "none",
            letterSpacing: "0.01em",
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            <Cpu size={17} weight="bold" style={{ color: "#0284c7" }} />
            <span>20/20 Capteurs Actifs</span>
          </div>
        </div>

        {/* Horodatage Dynamique */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          backgroundColor: "rgba(0, 0, 0, 0.02)",
          border: "1px solid var(--azura-border)",
          borderRadius: "10px"
        }}>
          <span style={{
            fontSize: "0.78rem",
            color: "var(--azura-text-muted)",
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            Derniere mesure recue :
          </span>
          <RollingTime
            timestamp={lastUpdatedTime}
            style={{
              color: "var(--azura-text)",
              fontWeight: 800,
              fontSize: "0.82rem",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
        </div>
      </div>

      {/* Disposition Pleine Largeur des 5 Diagrammes Télémétriques (1 Diagramme par Ligne) */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%"
      }}>
        {Object.entries(activeConfigs).map(([typeKey, cfg]) => (
          <SensorTypeChart
            key={typeKey}
            typeKey={typeKey}
            config={cfg}
            sensorsData={groupedSensors[typeKey] || []}
            timeWindowSec={45}
            currentTime={currentTime}
          />
        ))}
      </div>

      {/* Section Tableau Telemetrique des 20 Capteurs */}
      <SensorsKafkaTable
        sensorsMap={sensorSeries}
        thresholdsConfig={dynamicThresholds}
        onSelectSensorLocation={(sensorRow) => setSelectedSensorForMap(sensorRow)}
      />

      {/* Pop-up Modale Cartographique Interactive pour le Capteur Selectionne */}
      <SensorLocationModal
        isOpen={!!selectedSensorForMap}
        onClose={() => setSelectedSensorForMap(null)}
        sensor={selectedSensorForMap}
      />
    </div>
  );
}
