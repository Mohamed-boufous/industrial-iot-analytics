import React from 'react';
import { GearSix } from '@phosphor-icons/react';

export default function Settings() {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <GearSix size={28} weight="bold" style={{ color: 'var(--azura-text)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--azura-text)' }}>
          Configuration & Notifications
        </h1>
      </div>
      <p style={{ color: 'var(--azura-text-muted)' }}>
        Gestion des destinataires email et seuils de déclenchement des rapports d'alerte.
      </p>
      <div className="azura-card" style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600 }}>[En cours d'implémentation — Étape 13]</p>
      </div>
    </div>
  );
}
