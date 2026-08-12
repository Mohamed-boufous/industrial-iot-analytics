import React from 'react';
import { WarningOctagon } from '@phosphor-icons/react';

export default function AlertsDashboard() {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <WarningOctagon size={28} weight="fill" style={{ color: 'var(--azura-accent-red)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--azura-text)' }}>
          Dashboard Alertes Temps Réel
        </h1>
      </div>
      <p style={{ color: 'var(--azura-text-muted)' }}>
        Surveillance continue des anomalies détectées par le cluster Kafka (topic: <code>iot-alerts</code>).
      </p>
      <div className="azura-card" style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600 }}>[En cours d'implémentation — Étape 10]</p>
      </div>
    </div>
  );
}
