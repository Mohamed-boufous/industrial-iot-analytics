import React from 'react';
import { RealTimeAnalytics } from '../components/ui/real-time-analytics';
import StrokeText from '../components/ui/StrokeText';

export default function AlertsDashboard() {
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Entête avec Titre Tracé Animé GSAP StrokeText Centré */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '12px 0 6px 0',
        width: '100%'
      }}>
        {/* Badge Catégorie Créatif avec Animation StrokeText */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 18px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 0 16px rgba(239, 68, 68, 0.12)',
          marginBottom: '0.75rem',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease'
        }}>
          {/* Point Pulse indicateur */}
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
              backgroundColor: 'var(--azura-accent-red)',
              opacity: 0.75,
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
            }} />
            <span style={{
              position: 'relative',
              display: 'inline-flex',
              borderRadius: '50%',
              width: '8px',
              height: '8px',
              backgroundColor: 'var(--azura-accent-red)',
              boxShadow: '0 0 8px var(--azura-accent-red)'
            }} />
          </span>

          {/* Texte animé StrokeText pour Centre d'Incidents */}
          <StrokeText
            text="CENTRE D'INCIDENTS"
            strokeColor="var(--azura-accent-red)"
            fillColor="var(--azura-accent-red)"
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

        {/* Titre StrokeText Principal Interactif Centre (Contour et Remplissage sobres, 100% harmonises avec le theme) */}
        <div style={{ width: '100%', maxWidth: '780px', display: 'flex', justifyContent: 'center', margin: '0 auto' }}>
          <StrokeText
            text="Supervision des Derives & Alertes"
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

      {/* Console Graphique Temps Réel */}
      <RealTimeAnalytics />
    </div>
  );
}
