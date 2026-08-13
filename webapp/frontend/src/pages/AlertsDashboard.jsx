import React from 'react';
import { WarningOctagon } from '@phosphor-icons/react';
import { RealTimeAnalytics } from '../components/ui/real-time-analytics';

export default function AlertsDashboard() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Entête de la Page */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <WarningOctagon size={32} weight="fill" style={{ color: 'var(--azura-accent-red)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--azura-text)', margin: 0 }}>
            Supervision des Alertes Temps Réel
          </h1>
        </div>
        <p style={{ color: 'var(--azura-text-muted)', fontSize: '0.9rem', margin: 0 }}>
          Plateforme industrielle AzurA — Surveillance continue des anomalies détectées par Spark Streaming (topic Kafka: <code>iot-alerts</code>).
        </p>
      </div>

      {/* Intégration Épurée du Composant Graphique Temps Réel */}
      <RealTimeAnalytics />
    </div>
  );
}
