import React, { useState, useEffect, useCallback } from 'react';
import { ChartLineUp, Database } from '@phosphor-icons/react';
import StatsFilterBar from '../components/ui/StatsFilterBar';
import StatsKpiCards from '../components/ui/StatsKpiCards';
import StatsChartsGrid from '../components/ui/StatsChartsGrid';
import StatsDataTable from '../components/ui/StatsDataTable';

export default function StatsDashboard() {
  const [selectedPreset, setSelectedPreset] = useState('24h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSensor, setSelectedSensor] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Etats des donnees
  const [kpis, setKpis] = useState({});
  const [rawHistory, setRawHistory] = useState([]);
  const [alertsList, setAlertsList] = useState([]);
  const [topSensors, setTopSensors] = useState([]);
  const [alertsByType, setAlertsByType] = useState([]);

  // Chargement des donnees analytiques filtrées depuis l API MongoDB FastAPI
  const fetchFilteredData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);
      if (selectedSensor && selectedSensor !== 'ALL') queryParams.append('device_id', selectedSensor);

      // Fetch parallele des 5 endpoints d aggregation
      const [resKpis, resAlerts, resRaw, resTop, resByType] = await Promise.all([
        fetch(`/api/stats/filtered-kpis?${queryParams.toString()}`),
        fetch(`/api/stats/filtered-alerts?${queryParams.toString()}`),
        fetch(`/api/stats/filtered-raw?${queryParams.toString()}`),
        fetch('/api/stats/top-problematic?limit=5'),
        fetch('/api/stats/alerts-by-type')
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
    } catch (error) {
      console.error('Erreur chargement statistiques MongoDB:', error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedSensor]);

  // Chargement initial au montage et au changement de raccourci
  useEffect(() => {
    fetchFilteredData();
  }, [selectedPreset]);

  // Reinitialisation des filtres
  const handleReset = () => {
    setSelectedPreset('24h');
    setStartDate('');
    setEndDate('');
    setSelectedSensor('ALL');
    fetchFilteredData();
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* En-tete de la page Statistiques */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ChartLineUp size={30} weight="bold" style={{ color: 'var(--azura-primary)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--azura-text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Statistiques & Historique Analytique
            </h1>
          </div>
          <p style={{ color: 'var(--azura-text-muted)', fontSize: '0.88rem', marginTop: '4px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Supervision rétrospective basée sur les deux collections MongoDB (<code>raw_measurements</code> & <code>alerts_history</code>).
          </p>
        </div>

        {/* Badge Indicateur de Base de Donnees */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '12px',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          color: '#0369a1',
          fontSize: '0.82rem',
          fontWeight: 750,
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <Database size={17} weight="bold" />
          <span>MongoDB Cluster Sharded</span>
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

      {/* 3. Grille de Visualisations Graphiques (Recharts v3) */}
      <StatsChartsGrid
        rawHistory={rawHistory}
        alertsList={alertsList}
        topSensors={topSensors}
        alertsByType={alertsByType}
      />

      {/* 4. Grille d Exploration des Donnees avec Export CSV/JSON */}
      <StatsDataTable alertsList={alertsList} rawList={rawHistory} />
    </div>
  );
}
