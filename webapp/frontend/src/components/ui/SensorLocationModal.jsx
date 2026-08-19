import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, NavigationArrow, Compass, GlobeHemisphereWest, Moon } from "@phosphor-icons/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZONE_GEOLOCATIONS } from "../../constants/geo";

// Configurations des couches de tuiles cartographiques
const MAP_STYLES = {
  satellite: {
    name: "Satellite",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "Google Satellite",
    maxZoom: 20
  },
  dark: {
    name: "Sombre",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "CartoDB Dark",
    maxZoom: 19,
    subdomains: "abcd"
  }
};

export function SensorLocationModal({ isOpen, onClose, sensor }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [activeMapStyle, setActiveMapStyle] = useState("satellite"); // Mode Satellite par défaut

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
      tileLayerRef.current = null;
    }

    // 1. Initialisation de la carte centrée et zoomée sur le capteur
    const map = L.map(mapContainerRef.current, {
      center: [sensorLat, sensorLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // 2. Ajout de la couche de tuiles sélectionnée (Satellite ou Sombre)
    const currentStyleConfig = MAP_STYLES[activeMapStyle] || MAP_STYLES.satellite;
    const tileLayer = L.tileLayer(currentStyleConfig.url, {
      maxZoom: currentStyleConfig.maxZoom,
      subdomains: currentStyleConfig.subdomains || "abc"
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Contrôles de zoom stylisés en bas à droite
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 3. Tracé des BORDURES UNIQUEMENT du polygone de la zone de ce capteur
    if (zoneInfo.polygon && zoneInfo.polygon.length > 0) {
      const polygonCoords = zoneInfo.polygon.map(p => [p.lat, p.lng]);
      
      const zonePolygon = L.polygon(polygonCoords, {
        color: zoneColor,
        weight: 3,
        opacity: 0.95,
        fillColor: zoneColor,
        fillOpacity: 0.04,
        dashArray: "7, 7",
        lineCap: "round",
        lineJoin: "round"
      }).addTo(map);

      zonePolygon.bindTooltip(
        `<div style="font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 750; font-size: 11.5px; color: #0f172a; padding: 2px 4px;">
          Périmètre officiel : ${zoneInfo.name}
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
          background: rgba(15, 23, 42, 0.92);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          margin-bottom: 5px;
          user-select: none;
          backdrop-filter: blur(8px);
        ">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${sensor.statusColor || '#22c55e'}; box-shadow: 0 0 6px ${sensor.statusColor || '#22c55e'};"></span>
          <span>${sensor.id}</span>
          <span style="color: #94a3b8; font-weight: 400;">|</span>
          <span style="color: #38bdf8;">${sensor.value} ${sensor.unit}</span>
        </div>

        <!-- Pointe Indicatrice de Précision avec Cible Radar -->
        <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: ${zoneColor}; opacity: 0.45; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 15px; height: 15px; border-radius: 50%; background: #0f172a; border: 2.5px solid #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
            <div style="width: 5px; height: 5px; border-radius: 50%; background-color: ${zoneColor};"></div>
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
      map.setView([sensorLat, sensorLng], 16, { animate: true });
    }, 280);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [isOpen, sensor, activeMapStyle]);

  // Changement dynamique du fond de carte sans recharger toute l'instance
  const switchMapStyle = (newStyle) => {
    if (newStyle === activeMapStyle) return;
    setActiveMapStyle(newStyle);
  };

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
        {/* Arrière-plan flou sombre avec fermeture au clic */}
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

        {/* Boîte Modale Pleine Hauteur avec Bouton X Circulaire Flottant Hors du Cadre */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.92, y: 16, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.8 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "920px",
            height: "84vh",
            maxHeight: "720px",
            backgroundColor: "var(--azura-card-bg, #ffffff)",
            border: "1px solid var(--azura-border, #e2e8f0)",
            borderRadius: "20px",
            boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            display: "flex",
            flexDirection: "column",
            overflow: "visible", // Permet au bouton X de flotter hors du cadre
            zIndex: 10
          }}
        >
          {/* Bouton de Fermeture (X) Circulaire Flottant Hors du Cadre en Haut à Droite */}
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.14, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            title="Fermer la carte (Echap)"
            style={{
              position: "absolute",
              top: "-14px",
              right: "-14px",
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              backgroundColor: "#0f172a",
              border: "2px solid rgba(255, 255, 255, 0.35)",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.45)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 60,
              outline: "none"
            }}
          >
            <X size={18} weight="bold" />
          </motion.button>

          {/* 1. Entête Épuré et Haute Précision */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid var(--azura-border, #e2e8f0)",
            backgroundColor: "rgba(0, 0, 0, 0.01)",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px"
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
                    fontSize: "1.08rem",
                    fontWeight: 800,
                    color: "var(--azura-text, #0f172a)",
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "-0.01em"
                  }}>
                    {sensor.id}
                  </h3>
                  <span style={{
                    fontSize: "0.84rem",
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

            {/* Coordonnées GPS Neutres */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.03)",
              border: "1px solid var(--azura-border, #e2e8f0)",
              fontSize: "0.8rem",
              fontWeight: 650,
              color: "var(--azura-text, #0f172a)",
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              <Compass size={15} weight="bold" style={{ color: "var(--azura-text-muted)" }} />
              <span>{sensorLat.toFixed(4)}° N, {sensorLng.toFixed(4)}° W</span>
            </div>
          </div>

          {/* 2. Conteneur de la Carte Leaflet Pleine Hauteur (100% de l'espace restant) */}
          <div style={{
            position: "relative",
            flex: 1,
            width: "100%",
            height: "100%",
            borderBottomLeftRadius: "20px",
            borderBottomRightRadius: "20px",
            overflow: "hidden"
          }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

            {/* Barre de Contrôles Flottants Supérieurs : Sélecteur de Style (Satellite / Sombre) + Recentrer */}
            <div style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              {/* Sélecteur de Style de Carte Moderne (Satellite <-> Sombre) */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px",
                borderRadius: "10px",
                backgroundColor: "rgba(15, 23, 42, 0.88)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)"
              }}>
                <button
                  type="button"
                  onClick={() => switchMapStyle("satellite")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 11px",
                    borderRadius: "7px",
                    backgroundColor: activeMapStyle === "satellite" ? "rgba(255, 255, 255, 0.2)" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "0.74rem",
                    fontWeight: activeMapStyle === "satellite" ? 800 : 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    outline: "none"
                  }}
                >
                  <GlobeHemisphereWest size={14} weight={activeMapStyle === "satellite" ? "fill" : "bold"} />
                  <span>Satellite</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchMapStyle("dark")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 11px",
                    borderRadius: "7px",
                    backgroundColor: activeMapStyle === "dark" ? "rgba(255, 255, 255, 0.2)" : "transparent",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "0.74rem",
                    fontWeight: activeMapStyle === "dark" ? 800 : 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    outline: "none"
                  }}
                >
                  <Moon size={14} weight={activeMapStyle === "dark" ? "fill" : "bold"} />
                  <span>Sombre</span>
                </button>
              </div>

              {/* Bouton de Recentrage sur le Capteur */}
              <motion.button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([sensorLat, sensorLng], 16, { animate: true });
                  }
                }}
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 13px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(15, 23, 42, 0.88)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 750,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  outline: "none"
                }}
              >
                <NavigationArrow size={14} weight="bold" style={{ color: "#38bdf8" }} />
                <span>Recentrer</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default SensorLocationModal;
