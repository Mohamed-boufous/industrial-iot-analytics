import React, { useState, useEffect } from 'react';
import StrokeText from '../components/ui/StrokeText';
import SettingsThresholdsManager from '../components/ui/SettingsThresholdsManager';
import SettingsEmailManager from '../components/ui/SettingsEmailManager';

export default function Settings() {
  const [emailConfig, setEmailConfig] = useState({
    email: '',
    is_verified: false,
    verified_at: null
  });
  const [isLoading, setIsLoading] = useState(true);

  // Récupération de l'état de validation email depuis MongoDB
  const fetchEmailConfig = async () => {
    try {
      const res = await fetch('/api/settings/email-config');
      if (res.ok) {
        const data = await res.json();
        setEmailConfig(data);
      }
    } catch (err) {
      console.error('Erreur chargement statut email:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--azura-text-muted)',
        fontSize: '0.9rem',
        fontWeight: 600
      }}>
        Chargement des parametres...
      </div>
    );
  }

  // CAS 1 : Aucun email vérifié -> Verrouillage d'accès complet et affichage de la modale Gate Onboarding
  if (!emailConfig?.is_verified) {
    return (
      <SettingsEmailManager
        emailConfig={emailConfig}
        onEmailConfigChange={setEmailConfig}
        isGateMode={true}
      />
    );
  }

  // CAS 2 : Email vérifié -> Déverrouillage complet de la page des paramètres
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

      {/* 2. Gestionnaire du Destinataire des Notifications d'Alerte (Lecture seule + Changement sécurisé) */}
      <SettingsEmailManager
        emailConfig={emailConfig}
        onEmailConfigChange={setEmailConfig}
        isGateMode={false}
      />
    </div>
  );
}
