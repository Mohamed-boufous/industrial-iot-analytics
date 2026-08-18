import React, { useState, useEffect, useCallback } from 'react';
import { ChartLineUp, Database } from '@phosphor-icons/react';
import StrokeText from '../components/ui/StrokeText';
import StatsFilterBar from '../components/ui/StatsFilterBar';
import StatsKpiCards from '../components/ui/StatsKpiCards';
import StatsPhysicalMetricsCards from '../components/ui/StatsPhysicalMetricsCards';
import StatsBatteryHealthTable from '../components/ui/StatsBatteryHealthTable';
import StatsLocationIncidentsChart from '../components/ui/StatsLocationIncidentsChart';
import StatsDataTable from '../components/ui/StatsDataTable';

export default function StatsDashboard() {
  const [selectedPreset, setSelectedPreset] = useState('24h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSensor, setSelectedSensor] = useState('ALL');
  const [selectedPhysicalLocation, setSelectedPhysicalLocation] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isPhysicalLoading, setIsPhysicalLoading] = useState(false);

  // Etats des donnees
  const [kpis, setKpis] = useState({});
  const [rawHistory, setRawHistory] = useState([]);
  const [alertsList, setAlertsList] = useState([]);
  const [topSensors, setTopSensors] = useState([]);
  const [alertsByType, setAlertsByType] = useState([]);
  const [physicalMetrics, setPhysicalMetrics] = useState([]);
  const [locationIncidents, setLocationIncidents] = useState([]);
  const [batteryCritical, setBatteryCritical] = useState([]);

  // Chargement specifique des grandeurs physiques lors du changement d emplacement
  const fetchPhysicalMetricsForLocation = useCallback(async (loc) => {
    setIsPhysicalLoading(true);
    try {
      const q = new URLSearchParams();
      if (startDate) q.append('start_date', startDate);
      if (endDate) q.append('end_date', endDate);
      if (selectedSensor && selectedSensor !== 'ALL') q.append('device_id', selectedSensor);
      if (loc && loc !== 'ALL') q.append('location', loc);

      const res = await fetch(`/api/stats/physical-metrics?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPhysicalMetrics(data || []);
      }
    } catch (err) {
      console.error('Erreur chargement grandeurs physiques:', err);
    } finally {
      setIsPhysicalLoading(false);
    }
  }, [startDate, endDate, selectedSensor]);

  const handlePhysicalLocationChange = (loc) => {
    setSelectedPhysicalLocation(loc);
    fetchPhysicalMetricsForLocation(loc);
  };

  // Chargement des donnees analytiques filtrées depuis l API MongoDB FastAPI
  const fetchFilteredData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);
      if (selectedSensor && selectedSensor !== 'ALL') queryParams.append('device_id', selectedSensor);

      const physicalParams = new URLSearchParams(queryParams);
      if (selectedPhysicalLocation && selectedPhysicalLocation !== 'ALL') {
        physicalParams.append('location', selectedPhysicalLocation);
      }

      // Fetch parallele des 8 endpoints d aggregation
      const [resKpis, resAlerts, resRaw, resTop, resByType, resPhysical, resLoc, resBat] = await Promise.all([
        fetch(`/api/stats/filtered-kpis?${queryParams.toString()}`),
        fetch(`/api/stats/filtered-alerts?${queryParams.toString()}`),
        fetch(`/api/stats/filtered-raw?${queryParams.toString()}`),
        fetch('/api/stats/top-problematic?limit=5'),
        fetch('/api/stats/alerts-by-type'),
        fetch(`/api/stats/physical-metrics?${physicalParams.toString()}`),
        fetch(`/api/stats/alerts-by-location?${queryParams.toString()}`),
        fetch(`/api/stats/critical-battery?${queryParams.toString()}`)
      ]);

      if (resKpis.ok) {
        const dataKpis = await resKpis.json();
        setKpis(dataKpis);
      }

      if (resAlerts.ok) {
        const dataAlerts = await resAlerts.json();
        setAlertsList(dataAlerts.alerts || []);
      }

      if (resRaw.ok) {
        const dataRaw = await resRaw.json();
        setRawHistory(dataRaw.measurements || []);
      }

      if (resTop.ok) {
        const dataTop = await resTop.json();
        setTopSensors(dataTop || []);
      }

      if (resByType.ok) {
        const dataByType = await resByType.json();
        setAlertsByType(dataByType || []);
      }

      if (resPhysical.ok) {
        const dataPhysical = await resPhysical.json();
        setPhysicalMetrics(dataPhysical || []);
      }

      if (resLoc.ok) {
        const dataLoc = await resLoc.json();
        setLocationIncidents(dataLoc || []);
      }

      if (resBat.ok) {
        const dataBat = await resBat.json();
        setBatteryCritical(dataBat || []);
      }
    } catch (error) {
      console.error('Erreur chargement statistiques MongoDB:', error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedSensor, selectedPhysicalLocation]);

  // Chargement automatique a chaque changement de filtre (dates, capteur, raccourci)
  useEffect(() => {
    fetchFilteredData();
  }, [fetchFilteredData, selectedPreset]);

  // Reinitialisation des filtres
  const handleReset = () => {
    setSelectedPreset('24h');
    setStartDate('');
    setEndDate('');
    setSelectedSensor('ALL');
    fetchFilteredData();
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* En-tete Anime avec Titre Trace StrokeText Centre */}
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
          {/* Point Pulse indicateur Bleu/Cyan */}
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
            text="STATISTIQUES & ANALYTIQUE"
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
            text="Statistiques & Tendances Globales"
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

      {/* 1. Barre de Filtres Temporels et Multi-Criteres */}
      <StatsFilterBar
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedSensor={selectedSensor}
        setSelectedSensor={setSelectedSensor}
        onApply={fetchFilteredData}
        onReset={handleReset}
        isLoading={isLoading}
      />

      {/* 2. Cartes de KPIs Synthetiques 3D */}
      <StatsKpiCards kpis={kpis} isLoading={isLoading} />

      {/* 3. Section des Statistiques par Grandeurs Physiques (Moyenne, Min, Max) */}
      <StatsPhysicalMetricsCards
        metrics={physicalMetrics}
        isLoading={isLoading || isPhysicalLoading}
        selectedLocation={selectedPhysicalLocation}
        onLocationChange={handlePhysicalLocationChange}
      />

      {/* 4. Section Santé Matérielle : Top 5 Capteurs à Batterie Critique */}
      <StatsBatteryHealthTable batteryData={batteryCritical} isLoading={isLoading} />

      {/* 5. Section Cartographie des Incidents par Emplacement / Serre */}
      <StatsLocationIncidentsChart locationData={locationIncidents} isLoading={isLoading} />

      {/* 6. Grille d Exploration des Donnees avec Export CSV/JSON */}
      <StatsDataTable alertsList={alertsList} rawList={rawHistory} />
    </div>
  );
}
