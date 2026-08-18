import React from 'react';
import StrokeText from '../components/ui/StrokeText';
import SettingsThresholdsManager from '../components/ui/SettingsThresholdsManager';

export default function Settings() {
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
      {/* En-tête Animé avec Titre StrokeText Centré */}
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
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          boxShadow: '0 0 16px rgba(2, 132, 199, 0.12)',
          marginBottom: '0.75rem',
          backdropFilter: 'blur(8px)'
        }}>
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
              backgroundColor: '#0284c7',
              opacity: 0.75,
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
            }} />
            <span style={{
              position: 'relative',
              display: 'inline-flex',
              borderRadius: '50%',
              width: '8px',
              height: '8px',
              backgroundColor: '#0284c7'
            }} />
          </span>

          <StrokeText
            text="PARAMETRAGE & GOUVERNANCE"
            strokeColor="#0284c7"
            fillColor="#0284c7"
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

        {/* Titre StrokeText Principal Interactif Centré */}
        <div style={{ width: '100%', maxWidth: '780px', display: 'flex', justifyContent: 'center', margin: '0 auto' }}>
          <StrokeText
            text="Configuration Systeme & Regles Metier"
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

      {/* 1. Gestionnaire Dynamique des Seuils Métier (MongoDB Single Source of Truth) */}
      <SettingsThresholdsManager />
    </div>
  );
}

