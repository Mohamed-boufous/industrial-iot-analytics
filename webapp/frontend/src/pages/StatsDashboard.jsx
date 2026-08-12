import React from 'react';
import { ChartLineUp } from '@phosphor-icons/react';

export default function StatsDashboard() {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <ChartLineUp size={28} weight="bold" style={{ color: 'var(--azura-text)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--azura-text)' }}>
          Statistiques & Historique
        </h1>
      </div>
      <p style={{ color: 'var(--azura-text-muted)' }}>
        Analytique métier issue des agrégations MongoDB (collection: <code>raw_measurements</code>).
      </p>
      <div className="azura-card" style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600 }}>[En cours d'implémentation — Étape 12]</p>
      </div>
    </div>
  );
}
