import React from 'react';
import { RealTimeAnalytics } from '../components/ui/real-time-analytics';
import WarpText from '../components/ui/WarpText';

export default function AlertsDashboard() {
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Entête avec Titre Interactif WebGL WarpText */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '4px 2px'
      }}>
        <div style={{ width: '100%', maxWidth: '750px' }}>
          {/* Badge Catégorie Minimaliste */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: '0.5rem'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--azura-accent-red)',
              boxShadow: '0 0 6px var(--azura-accent-red)'
            }} />
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--azura-accent-red)'
            }}>
              Centre d'Incidents
            </span>
          </div>

          {/* Titre WarpText Interactif ReactBits */}
          <WarpText
            text="Supervision des Dérives & Alertes"
            color="var(--azura-text)"
            warpStrength={0.06}
            warpScale={1.5}
            speed={0.45}
            pointerInfluence={0.38}
            pointerStrength={0.32}
            refraction={0.015}
            ripple
            fontSize="clamp(1.5rem, 3vw, 2.2rem)"
            fontWeight={800}
            style={{ height: '52px', width: '100%' }}
          />

          <p style={{
            color: 'var(--azura-text-muted)',
            fontSize: '0.875rem',
            marginTop: '0.25rem',
            margin: 0
          }}>
            Surveillance continue des seuils critiques sur les lignes de production AzurA.
          </p>
        </div>
      </div>

      {/* Console Graphique Temps Réel */}
      <RealTimeAnalytics />
    </div>
  );
}
