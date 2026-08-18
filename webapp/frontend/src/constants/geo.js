// ══════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH : Donnees Geographiques Officielles des 4 Zones AzurA
// ══════════════════════════════════════════════════════════════════════════════

export const ZONE_GEOLOCATIONS = {
  // ── Zone 1 : Agadir (Serres agricoles Souss) ──
  agadir_serre_1: {
    key: "agadir_serre_1",
    name: "Agadir - Serre 1",
    city: "Agadir",
    region: "Souss-Massa",
    color: "#06b6d4", // Cyan
    center: { lat: 30.2825, lng: -9.5050 },
    polygon: [
      { lat: 30.2850, lng: -9.5200 },
      { lat: 30.2950, lng: -9.5050 },
      { lat: 30.2800, lng: -9.4900 },
      { lat: 30.2700, lng: -9.5050 }
    ]
  },

  // ── Zone 2 : Dakhla (Station d'emballage & conditionnement) ──
  dakhla_station_emballage: {
    key: "dakhla_station_emballage",
    name: "Dakhla - Station Emballage",
    city: "Dakhla",
    region: "Dakhla-Oued Ed-Dahab",
    color: "#a855f7", // Violet
    center: { lat: 23.7125, lng: -15.9200 },
    polygon: [
      { lat: 23.7150, lng: -15.9350 },
      { lat: 23.7250, lng: -15.9200 },
      { lat: 23.7100, lng: -15.9050 },
      { lat: 23.7000, lng: -15.9200 }
    ]
  },

  // ── Zone 3 : Kenitra (Station de filtrage et reseau hydraulique) ──
  kenitra_station_filtrage: {
    key: "kenitra_station_filtrage",
    name: "Kenitra - Station Filtrage",
    city: "Kenitra",
    region: "Rabat-Sale-Kenitra",
    color: "#f59e0b", // Ambre
    center: { lat: 34.2525, lng: -6.5700 },
    polygon: [
      { lat: 34.2550, lng: -6.5850 },
      { lat: 34.2650, lng: -6.5700 },
      { lat: 34.2500, lng: -6.5550 },
      { lat: 34.2400, lng: -6.5700 }
    ]
  },

  // ── Zone 4 : Tanger Med (Hub logistique export) ──
  tangier_med_hub: {
    key: "tangier_med_hub",
    name: "Tanger Med - Hub Logistique",
    city: "Tanger Med",
    region: "Tanger-Tetouan-Al Hoceima",
    color: "#10b981", // Emeraude
    center: { lat: 35.8825, lng: -5.5000 },
    polygon: [
      { lat: 35.8850, lng: -5.5150 },
      { lat: 35.8950, lng: -5.5000 },
      { lat: 35.8800, lng: -5.4850 },
      { lat: 35.8700, lng: -5.5000 }
    ]
  }
};
