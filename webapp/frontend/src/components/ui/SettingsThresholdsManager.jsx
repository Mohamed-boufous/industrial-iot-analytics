import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function SettingsThresholdsManager() {
  const [thresholds, setThresholds] = useState({});
  const [initialThresholds, setInitialThresholds] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { type: 'success' | 'error', message: string }

  // 1. Chargement des seuils depuis MongoDB via FastAPI
  const fetchThresholds = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/thresholds');
      if (res.ok) {
        const data = await res.json();
        setThresholds(data.thresholds || {});
        setInitialThresholds(JSON.parse(JSON.stringify(data.thresholds || {})));
      }
    } catch (error) {
      console.error('Erreur chargement des seuils:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

  // 2. Gestion des modifications locales dans le formulaire
  const handleValueChange = (key, field, value) => {
    const numVal = parseFloat(value);
    setThresholds(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: isNaN(numVal) ? value : numVal
      }
    }));
  };

  // 3. Sauvegarde dans MongoDB via PUT /api/settings/thresholds
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/settings/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds)
      });
      if (res.ok) {
        const data = await res.json();
        setThresholds(data.thresholds);
        setInitialThresholds(JSON.parse(JSON.stringify(data.thresholds)));
        setSaveStatus({ type: 'success', message: 'Seuils enregistres et synchronises avec succes dans MongoDB !' });
      } else {
        setSaveStatus({ type: 'error', message: 'Echec de l enregistrement dans MongoDB.' });
      }
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Erreur reseau lors de la sauvegarde.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // 4. Reinitialisation aux valeurs d'usine par defaut
  const handleReset = async () => {
    if (!window.confirm('Voulez-vous vraiment restaurer les seuils d usine par defaut ?')) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/thresholds/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setThresholds(data.thresholds);
        setInitialThresholds(JSON.parse(JSON.stringify(data.thresholds)));
        setSaveStatus({ type: 'success', message: 'Seuils restaures aux valeurs par defaut avec succes !' });
      }
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Erreur lors de la reinitialisation.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // Verifier si des modifications sont en attente
  const hasChanges = JSON.stringify(thresholds) !== JSON.stringify(initialThresholds);

  if (isLoading) {
    return (
      <div style={{
        height: '380px',
        backgroundColor: 'var(--azura-card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--azura-border)',
        animation: 'pulse 1.5s infinite'
      }} />
    );
  }

  const metricKeys = ['temperature', 'vibration', 'pression', 'humidite', 'consommation', 'battery'];

  return (
    <div style={{ marginBottom: '2.5rem', width: '100%' }}>
      {/* En-tête de Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '4px', height: '18px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
          <div>
            <h2 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              margin: 0
            }}>
              Seuils de Surveillance & Regles Metier (Source Unique de Verite)
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--azura-text-muted)', margin: '3px 0 0 0', fontWeight: 600 }}>
              Configuration centralisee dans MongoDB 'system_configuration'. Toute modification s applique automatiquement.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleReset}
            disabled={isSaving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--azura-border)',
              color: 'var(--azura-text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Valeurs par Defaut
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              backgroundColor: hasChanges ? '#2563eb' : 'rgba(0,0,0,0.06)',
              border: 'none',
              color: hasChanges ? '#ffffff' : 'var(--azura-text-muted)',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: hasChanges ? '0 4px 14px rgba(37, 99, 235, 0.25)' : 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
          </button>
        </div>
      </div>

      {/* Message Toast de Statut */}
      {saveStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            backgroundColor: saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(220, 38, 38, 0.1)',
            border: `1px solid ${saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
            color: saveStatus.type === 'success' ? '#16a34a' : '#dc2626',
            fontSize: '0.82rem',
            fontWeight: 750,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>{saveStatus.message}</span>
        </motion.div>
      )}

      {/* Grille des 6 Métriques Physiques */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.25rem'
      }}>
        {metricKeys.map(key => {
          const item = thresholds[key];
          if (!item) return null;

          return (
            <div
              key={key}
              style={{
                backgroundColor: 'var(--azura-card-bg)',
                borderRadius: '14px',
                border: '1px solid var(--azura-border)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
              }}
            >
              {/* En-tête de la Carte */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: 'var(--azura-text)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    {item.label}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
                    {item.standard_reference}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#2563eb',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  Unite : {item.unit}
                </span>
              </div>

              {/* Formulaire Min / Max */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--azura-border)'
              }}>
                {/* Borne Minimale */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--azura-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Borne Min ({item.unit})
                  </label>
                  <input
                    type="number"
                    step={item.step || 0.1}
                    value={item.min}
                    onChange={(e) => handleValueChange(key, 'min', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--azura-border)',
                      backgroundColor: 'var(--azura-card-bg)',
                      color: 'var(--azura-text)',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Borne Maximale */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--azura-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Borne Max ({item.unit})
                  </label>
                  <input
                    type="number"
                    step={item.step || 0.1}
                    value={item.max}
                    onChange={(e) => handleValueChange(key, 'max', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--azura-border)',
                      backgroundColor: 'var(--azura-card-bg)',
                      color: 'var(--azura-text)',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Descriptions des Seuils Critiques */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                  <span style={{ fontWeight: 800 }}>• Alerte Basse :</span>
                  <span>{item.danger_low_description}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                  <span style={{ fontWeight: 800 }}>• Alerte Haute :</span>
                  <span>{item.danger_high_description}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
