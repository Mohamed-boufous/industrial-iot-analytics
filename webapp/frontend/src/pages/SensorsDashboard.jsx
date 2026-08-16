import React, { useState, useEffect, useMemo } from 'react';
import StrokeText from '../components/ui/StrokeText';
import { SensorTypeChart } from '../components/ui/SensorTypeChart';
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
    defaultIds: ["sensor_temp_001", "sensor_temp_002", "sensor_temp_003"]
  },
  vibration: {
    label: "Vibration",
    unit: "mm/s",
    normal_range: [0.0, 5.0],
    critical_min: 8.0,
    fault_floor: 0.0,
    fault_ceiling: 25.0,
    defaultIds: ["sensor_vib_001", "sensor_vib_002", "sensor_vib_003"]
  },
  pression: {
    label: "Pression",
    unit: "bar",
    normal_range: [1.0, 10.0],
    critical_min: 12.0,
    fault_floor: 0.0,
    fault_ceiling: 30.0,
    defaultIds: ["sensor_pres_001", "sensor_pres_002", "sensor_pres_003"]
  },
  humidite: {
    label: "Humidite",
    unit: "%",
    normal_range: [30.0, 70.0],
    critical_min: 85.0,
    fault_floor: 0.0,
    fault_ceiling: 100.0,
    defaultIds: ["sensor_hum_001", "sensor_hum_002", "sensor_hum_003"]
  },
  consommation: {
    label: "Puissance Electrique",
    unit: "kW",
    normal_range: [100.0, 500.0],
    critical_min: 700.0,
    fault_floor: 0.0,
    fault_ceiling: 2000.0,
    defaultIds: ["sensor_pow_001", "sensor_pow_002", "sensor_pow_003"]
  }
};

export default function SensorsDashboard() {
  const { lastMessage, isConnected } = useWebSocket('/ws/sensors');
  const [sensorSeries, setSensorSeries] = useState({});
  const [lastUpdatedTime, setLastUpdatedTime] = useState(Date.now());
  const [activeCount, setActiveCount] = useState(15);

  // Ingestion des messages entrants depuis le WebSocket Kafka (iot-processed)
  useEffect(() => {
    if (!lastMessage) return;

    const now = Date.now();
    setLastUpdatedTime(now);

    // 1. Initialisation depuis l'état mémoire backend
    if (lastMessage.type === "INITIAL_SENSORS_STATE" && Array.isArray(lastMessage.data)) {
      setSensorSeries(prev => {
        const next = { ...prev };
        lastMessage.data.forEach(item => {
          const sId = item.device_id;
          if (!sId) return;
          const point = { time: new Date(item.timestamp || now).getTime(), value: Number(item.value) };
          if (!next[sId]) {
            next[sId] = {
              id: sId,
              type: item.device_type,
              loc: item.location || sId,
              unit: item.unit,
              points: [point]
            };
          } else {
            next[sId] = {
              ...next[sId],
              points: [...next[sId].points, point].slice(-60)
            };
          }
        });
        return next;
      });
    }

    // 2. Mise à jour unitaire en flux continu temps réel
    if (lastMessage.type === "SENSOR_UPDATE" && lastMessage.data) {
      const item = lastMessage.data;
      const sId = item.device_id;
      if (!sId) return;

      const point = { time: new Date(item.timestamp || now).getTime(), value: Number(item.value) };

      setSensorSeries(prev => {
        const existing = prev[sId] || {
          id: sId,
          type: item.device_type,
          loc: item.location || sId,
          unit: item.unit,
          points: []
        };

        const updatedPoints = [...existing.points, point]
          .filter(p => p.time >= now - 60000) // Conserve 60s d'historique glissant
          .slice(-80);

        return {
          ...prev,
          [sId]: {
            ...existing,
            loc: item.location || existing.loc,
            unit: item.unit || existing.unit,
            points: updatedPoints
          }
        };
      });
    }
  }, [lastMessage]);

  // Regroupement des capteurs par type de grandeur
  const groupedSensors = useMemo(() => {
    const groups = {
      temperature: [],
      vibration: [],
      pression: [],
      humidite: [],
      consommation: []
    };

    // Parcourir chaque configuration pour assurer la présence des 3 capteurs même avant réception du flux
    Object.entries(SENSOR_TYPE_CONFIGS).forEach(([typeKey, cfg]) => {
      cfg.defaultIds.forEach(id => {
        if (sensorSeries[id]) {
          groups[typeKey].push(sensorSeries[id]);
        } else {
          // Placeholder prêt à recevoir des points
          groups[typeKey].push({
            id,
            type: typeKey,
            loc: id,
            unit: cfg.unit,
            points: []
          });
        }
      });
    });

    return groups;
  }, [sensorSeries]);

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
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease'
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
              backgroundColor: '#0284c7',
              boxShadow: '0 0 8px #0284c7'
            }} />
          </span>

          {/* Texte anime StrokeText pour Badge */}
          <StrokeText
            text="TELEMETRIE CAPTEURS"
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
            text="Flux Telemetrique en Direct"
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

      {/* Barre de Statuts & Controles avec MetalButton */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "14px",
        padding: "14px 20px",
        backgroundColor: "var(--azura-card-bg)",
        border: "1px solid var(--azura-border)",
        borderRadius: "14px",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Bouton MetalButton Statut Telemetrie */}
          <MetalButton
            preset="silver"
            variant="outline"
            strength={1.0}
            ringCssPx={4.0}
            shaderScale={1.8}
            borderRadius={14}
            className="!py-3 !px-7 border-0 bg-transparent"
            style={{ padding: "10px 24px" }}
            metalFxStyle={{
              backgroundColor: isConnected ? "rgba(34, 197, 94, 0.16)" : "rgba(239, 68, 68, 0.16)",
              border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)"}`,
              borderRadius: "14px",
              boxShadow: isConnected ? "0 4px 18px rgba(34, 197, 94, 0.22)" : "none"
            }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                backgroundColor: isConnected ? "#22c55e" : "#ef4444",
                boxShadow: isConnected ? "0 0 10px #22c55e" : "none"
              }} />
              <span style={{
                color: isConnected ? "#22c55e" : "#ef4444",
                fontSize: "0.85rem",
                fontWeight: 800,
                letterSpacing: "0.01em",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {isConnected ? "Flux Telemetrie Actif" : "Connexion au Flux..."}
              </span>
            </div>
          </MetalButton>

          {/* Badge Nombre de Capteurs Connectés */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "10px",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            border: "1px solid rgba(2, 132, 199, 0.25)",
            color: "var(--azura-text)",
            fontSize: "0.82rem",
            fontWeight: 700
          }}>
            <Cpu size={18} weight="bold" style={{ color: "#0284c7" }} />
            <span>15/15 Capteurs Actifs</span>
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
        {Object.entries(SENSOR_TYPE_CONFIGS).map(([typeKey, cfg]) => (
          <SensorTypeChart
            key={typeKey}
            typeKey={typeKey}
            config={cfg}
            sensorsData={groupedSensors[typeKey] || []}
            timeWindowSec={45}
          />
        ))}
      </div>
    </div>
  );
}
