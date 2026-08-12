import React from 'react';
import { Broadcast } from '@phosphor-icons/react';

export default function SensorsDashboard() {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <Broadcast size={28} weight="bold" style={{ color: 'var(--azura-text)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--azura-text)' }}>
          Dashboard Capteurs en Direct
        </h1>
      </div>
      <p style={{ color: 'var(--azura-text-muted)' }}>
        Flux de télémétrie en temps réel sur l'ensemble des 15 capteurs IoT (topic: <code>iot-processed</code>).
      </p>
      <div className="azura-card" style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600 }}>[En cours d'implémentation — Étape 11]</p>
      </div>
    </div>
  );
}
