import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';

export default function StatsLocationIncidentsChart({ locationData = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div style={{
        height: '340px',
        borderRadius: '14px',
        backgroundColor: 'var(--azura-card-bg)',
        border: '1px solid var(--azura-border)',
        marginBottom: '1.75rem',
        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }} />
    );
  }

  if (!locationData || locationData.length === 0) {
    return null;
  }

  const totalIncidents = locationData.reduce((acc, curr) => acc + (curr.count || 0), 0);

  // Custom Tooltip épuré et professionnel
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '10px 14px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          border: '1px solid #334155',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <p style={{ fontWeight: 800, fontSize: '0.85rem', margin: 0 }}>{data.label}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '6px', fontSize: '0.78rem' }}>
            <span style={{ color: '#94a3b8' }}>Incidents detectes :</span>
            <span style={{ fontWeight: 800, color: data.count > 0 ? '#ef4444' : '#22c55e' }}>
              {data.count.toLocaleString()} ({data.percentage}%)
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginBottom: '2rem', width: '100%' }}>
      {/* 1. Titre de Section Uniquement (Sans badges à droite) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
        <div style={{ width: '4px', height: '18px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
        <h2 style={{
          fontSize: '1rem',
          fontWeight: 800,
          color: 'var(--azura-text)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          margin: 0
        }}>
          Cartographie des Incidents par Ville / Region
        </h2>
      </div>

      {/* 2. Graphique Centré avec Noms des Villes en Bas (Axe X) et Incidents en Axe Y */}
      <div style={{
        width: '100%',
        height: '360px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={locationData}
            margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.06)" />
            
            {/* Axe X en bas : Noms des Villes */}
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--azura-text)', fontSize: 12, fontWeight: 700 }}
              axisLine={{ stroke: 'var(--azura-border)' }}
              tickLine={false}
              interval={0}
            />

            {/* Axe Y à gauche : Nombre d'alertes / incidents */}
            <YAxis
              tick={{ fill: 'var(--azura-text-muted)', fontSize: 11, fontWeight: 600 }}
              axisLine={{ stroke: 'var(--azura-border)' }}
              tickLine={false}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.03)' }} />

            {/* Barres verticales avec têtes arrondies */}
            <Bar dataKey="count" radius={[10, 10, 0, 0]} maxBarSize={55}>
              {locationData.map((entry, index) => {
                // Rouge pour la ville la plus critique, Bleu pour les autres, Gris si 0
                const isTopCritical = entry.count > (totalIncidents * 0.35);
                const barColor = isTopCritical ? '#dc2626' : entry.count > 0 ? '#2563eb' : '#94a3b8';
                return <Cell key={`cell-${index}`} fill={barColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
