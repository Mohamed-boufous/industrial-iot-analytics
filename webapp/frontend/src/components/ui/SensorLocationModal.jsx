import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, NavigationArrow, Gauge, Pulse, ShieldCheck, Compass } from "@phosphor-icons/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZONE_GEOLOCATIONS } from "../../constants/geo";

export function SensorLocationModal({ isOpen, onClose, sensor }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Fermeture par la touche Echap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Initialisation et configuration de la carte Leaflet
  useEffect(() => {
    if (!isOpen || !sensor || !mapContainerRef.current) return;

    const zoneKey = sensor.location;
    const zoneInfo = ZONE_GEOLOCATIONS[zoneKey] || {
      name: sensor.location,
      city: "Maroc",
      region: "AzurA",
      color: sensor.dotColor || "#0284c7",
      center: { lat: sensor.latitude || 30.2825, lng: sensor.longitude || -9.5050 },
      polygon: []
    };

    const sensorLat = Number(sensor.latitude) || zoneInfo.center.lat;
    const sensorLng = Number(sensor.longitude) || zoneInfo.center.lng;
    const zoneColor = zoneInfo.color || "#0284c7";

    // Nettoyage de l'ancienne instance de carte si existante
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // 1. Initialisation de la carte centrée et zoomée sur le capteur
    const map = L.map(mapContainerRef.current, {
      center: [sensorLat, sensorLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // 2. Fond de carte cartographique haute lisibilite
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(map);

    // Contrôles de zoom stylisés en bas à droite
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 3. Tracé des BORDURES UNIQUEMENT du polygone de la zone de ce capteur
    if (zoneInfo.polygon && zoneInfo.polygon.length > 0) {
      const polygonCoords = zoneInfo.polygon.map(p => [p.lat, p.lng]);
      
      const zonePolygon = L.polygon(polygonCoords, {
        color: zoneColor,
        weight: 2.5,
        opacity: 0.9,
        fillColor: zoneColor,
        fillOpacity: 0.03,
        dashArray: "6, 6",
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);

      zonePolygon.bindTooltip(
        `<div style="font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 750; font-size: 11.5px; color: #0f172a; padding: 2px 4px;">
          Périmètre : ${zoneInfo.name}
        </div>`,
        { sticky: true, className: "azura-map-tooltip" }
      );
    }

    // 4. Marqueur Télémétrique de Haute Précision pour CE Capteur
    const markerHtml = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: auto; transform: translate(-50%, -100%);">
        <!-- Badge Flottant Télémétrie en Direct -->
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          background: #0f172a;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          margin-bottom: 5px;
          user-select: none;
        ">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${sensor.statusColor || '#22c55e'}; box-shadow: 0 0 6px ${sensor.statusColor || '#22c55e'};"></span>
          <span>${sensor.id}</span>
          <span style="color: #94a3b8; font-weight: 400;">|</span>
          <span style="color: #38bdf8;">${sensor.value} ${sensor.unit}</span>
        </div>

        <!-- Pointe Indicatrice de Précision avec Cible Radar -->
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: ${zoneColor}; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: #0f172a; border: 2.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; border-radius: 50%; background-color: ${zoneColor};"></div>
          </div>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: markerHtml,
      className: "azura-sensor-precision-pin",
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    const sensorMarker = L.marker([sensorLat, sensorLng], { icon: customIcon }).addTo(map);

    // Popup informative et épurée au clic
    sensorMarker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px 2px;">
        <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
          ${sensor.id}
        </div>
        <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">
          ${sensor.device_type} &bull; ${zoneInfo.name}
        </div>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #0f172a; font-weight: 700;">
          ${sensorLat.toFixed(4)}° N, ${sensorLng.toFixed(4)}° W
        </div>
      </div>
    `);

    // Recentrage propre après le montage du modal
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.setView([sensorLat, sensorLng], 15, { animate: true });
    }, 280);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, sensor]);

  if (!isOpen || !sensor) return null;

  const zoneKey = sensor.location;
  const zoneInfo = ZONE_GEOLOCATIONS[zoneKey] || {
    name: sensor.location,
    city: "Maroc",
    region: "AzurA",
    color: sensor.dotColor || "#0284c7"
  };

  const sensorLat = Number(sensor.latitude) || 30.2825;
  const sensorLng = Number(sensor.longitude) || -9.5050;
  const zoneColor = zoneInfo.color || "#0284c7";

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}
      >
        {/* Arrière-plan flou sombre avec animation d'opacité */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(10, 15, 29, 0.75)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)"
          }}
        />

        {/* Boîte Modale Centrée avec Animation Pop-Up / Depop-up Fluide */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.92, y: 16, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.8 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "840px",
            height: "78vh",
            maxHeight: "640px",
            backgroundColor: "var(--azura-card-bg, #ffffff)",
            border: "1px solid var(--azura-border, #e2e8f0)",
            borderRadius: "18px",
            boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 10
          }}
        >
          {/* 1. Entête Épuré et Haute Précision */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--azura-border, #e2e8f0)",
            backgroundColor: "rgba(0, 0, 0, 0.01)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Point Indicateur Minimaliste */}
              <div style={{
                position: "relative",
                width: "10px",
                height: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <span style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  backgroundColor: zoneColor,
                  opacity: 0.6,
                  animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
                }} />
                <span style={{
                  position: "relative",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: zoneColor
                }} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    color: "var(--azura-text, #0f172a)",
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "-0.01em"
                  }}>
                    {sensor.id}
                  </h3>
                  <span style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--azura-text-muted, #64748b)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    ({sensor.device_type})
                  </span>
                </div>
                <div style={{
                  fontSize: "0.76rem",
                  color: "var(--azura-text-muted, #64748b)",
                  fontWeight: 500,
                  marginTop: "2px",
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {zoneInfo.name} &bull; Region {zoneInfo.region}
                </div>
              </div>
            </div>

            {/* Actions : Coordonnées Neutres et Bouton Fermer (X) */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(0, 0, 0, 0.03)",
                border: "1px solid var(--azura-border, #e2e8f0)",
                fontSize: "0.78rem",
                fontWeight: 650,
                color: "var(--azura-text, #0f172a)",
                fontFamily: "'JetBrains Mono', monospace"
              }}>
                <Compass size={14} weight="bold" style={{ color: "var(--azura-text-muted)" }} />
                <span>{sensorLat.toFixed(4)}° N, {sensorLng.toFixed(4)}° W</span>
              </div>

              {/* Bouton de Fermeture X */}
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.1, backgroundColor: "rgba(0, 0, 0, 0.08)" }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                title="Fermer (Echap)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--azura-border, #e2e8f0)",
                  color: "var(--azura-text, #0f172a)",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <X size={16} weight="bold" />
              </motion.button>
            </div>
          </div>

          {/* 2. Conteneur de la Carte Leaflet */}
          <div style={{ position: "relative", flex: 1, width: "100%", height: "100%", minHeight: "320px" }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

            {/* Bouton Flottant Épuré de Recentrage */}
            <motion.button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([sensorLat, sensorLng], 16, { animate: true });
                }
              }}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                zIndex: 1000,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.94)",
                backdropFilter: "blur(8px)",
                border: "1px solid #cbd5e1",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.08)",
                color: "#0f172a",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            >
              <NavigationArrow size={13} weight="bold" style={{ color: "#0f172a" }} />
              <span>Recentrer</span>
            </motion.button>
          </div>

          {/* 3. Pied de la Modale : Fiche Récapitulative Télémétrique */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "12px 20px",
            borderTop: "1px solid var(--azura-border, #e2e8f0)",
            backgroundColor: "rgba(0, 0, 0, 0.01)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              {/* Grandeur & Valeur */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Gauge size={16} weight="bold" style={{ color: "var(--azura-text-muted)" }} />
                <div>
                  <span style={{ fontSize: "0.68rem", color: "var(--azura-text-muted)", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
                    Valeur Actuelle
                  </span>
                  <span style={{ fontSize: "0.92rem", fontWeight: 800, color: sensor.statusColor || "var(--azura-text)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {sensor.value} {sensor.unit}
                  </span>
                </div>
              </div>

              <div style={{ width: "1px", height: "24px", backgroundColor: "var(--azura-border)" }} />

              {/* Plage Nominale */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Pulse size={16} weight="bold" style={{ color: "var(--azura-text-muted)" }} />
                <div>
                  <span style={{ fontSize: "0.68rem", color: "var(--azura-text-muted)", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
                    Plage Nominale
                  </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--azura-text)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {sensor.nominalRange}
                  </span>
                </div>
              </div>

              <div style={{ width: "1px", height: "24px", backgroundColor: "var(--azura-border)" }} />

              {/* Statut Télémétrique */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} weight="bold" style={{ color: sensor.statusColor || "#22c55e" }} />
                <div>
                  <span style={{ fontSize: "0.68rem", color: "var(--azura-text-muted)", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
                    Statut Télémétrique
                  </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: sensor.statusColor || "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>
                    {sensor.statusLabel || "Normal"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default SensorLocationModal;
