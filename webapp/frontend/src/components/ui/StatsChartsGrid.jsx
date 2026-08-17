import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { ChartLineUp, WarningCircle, Cpu, ChartPie } from '@phosphor-icons/react';

const STATUS_COLORS = {
  CRITICAL_TEMP_HIGH: '#ef4444',
  CRITICAL_VIB_HIGH: '#dc2626',
  CRITICAL_POWER_HIGH: '#b91c1c',
  WARNING_TEMP_HIGH: '#f97316',
  WARNING_VIB_HIGH: '#f59e0b',
  WARNING_PRESSURE_LOW: '#eab308',
  WARNING_HUMIDITY_HIGH: '#06b6d4',
  NORMAL: '#22c55e'
};

const PIE_COLORS = ['#22c55e', '#ef4444', '#f97316', '#eab308', '#8b5cf6'];

export default function StatsChartsGrid({
  rawHistory = [],
  alertsList = [],
  topSensors = [],
  alertsByType = []
}) {
  // Prepa 1 : Donnees chronologiques pour l AreaChart
  const timeSeriesData = rawHistory.slice(-40).map((pt) => ({
    time: pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '',
    value: typeof pt.value === 'number' ? Number(pt.value.toFixed(2)) : 0,
    device: pt.device_id || 'capteur'
  }));

  // Prepa 2 : Donnees pour le BarChart par type d alerte
  const alertTypeData = alertsByType.map((item) => ({
    name: item.status || 'AUTRE',
    count: item.count || 0,
    fill: STATUS_COLORS[item.status] || '#64748b'
  }));

  // Prepa 3 : Donnees pour le Ranking Top 5 Capteurs
  const topSensorsData = topSensors.map((item) => ({
    name: item.device_id || 'Capteur',
    count: item.alert_count || 0
  }));

  // Prepa 4 : Donut Chart Statut Normal vs Anormal
  const statusSplitData = [
    { name: 'Conformes (NORMAL)', value: Math.max(0, rawHistory.length - alertsList.length) },
    { name: 'Anomalies Detectees', value: alertsList.length }
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}
    >
      {/* Graphique 1 : Chronologie Telemetrique en Aires */}
      <div
        style={{
          backgroundColor: 'var(--azura-card-bg)',
          border: '1px solid var(--azura-border)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ChartLineUp size={20} weight="bold" style={{ color: '#0284c7' }} />
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Chronologie & Tendance des Mesures Telemetriques
          </h3>
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.8rem'
                }}
              />
              <Area type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#areaGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graphique 2 : Distribution des Incidents par Type */}
      <div
        style={{
          backgroundColor: 'var(--azura-card-bg)',
          border: '1px solid var(--azura-border)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <WarningCircle size={20} weight="bold" style={{ color: '#ef4444' }} />
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Distribution des Incidents par Type d Alerte
          </h3>
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={alertTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-15} textAnchor="end" height={45} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.8rem'
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {alertTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graphique 3 : Top 5 Capteurs les Plus Problematiques */}
      <div
        style={{
          backgroundColor: 'var(--azura-card-bg)',
          border: '1px solid var(--azura-border)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Cpu size={20} weight="bold" style={{ color: '#8b5cf6' }} />
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Top 5 Capteurs Generateurs d Incidents
          </h3>
        </div>

        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSensorsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={130} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.8rem'
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graphique 4 : Donut Ratio Conforme vs Anormal */}
      <div
        style={{
          backgroundColor: 'var(--azura-card-bg)',
          border: '1px solid var(--azura-border)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ChartPie size={20} weight="bold" style={{ color: '#22c55e' }} />
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Proportion Conforme vs Anomalies
          </h3>
        </div>

        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusSplitData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {statusSplitData.map((entry, index) => (
                  <Cell key={`cell-pie-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.8rem'
                }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
