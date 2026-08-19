import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WarningOctagon,
  ArrowCounterClockwise,
  FloppyDisk,
  X,
  CheckCircle
} from '@phosphor-icons/react';

export default function SettingsThresholdsManager() {
  const [thresholds, setThresholds] = useState({});
  const [initialThresholds, setInitialThresholds] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Modale de confirmation "Attention"
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: null,
    title: '',
    message: '',
    confirmText: ''
  });

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

  // 3. Demande de confirmation pour Enregistrer (Pop-up Rouge)
  const promptSave = () => {
    setModalConfig({
      isOpen: true,
      type: 'save',
      title: 'Attention',
      message: 'Vous etes sur le point d enregistrer de nouveaux seuils de surveillance dans MongoDB. Ces regles metier seront appliquees immediatement a l ensemble du cluster (moteur Spark, flux Kafka et tableaux de bord). Souhaitez-vous confirmer l enregistrement ?',
      confirmText: 'Confirmer l Enregistrement'
    });
  };

  // 4. Demande de confirmation pour Reinitialiser (Pop-up Rouge)
  const promptReset = () => {
    setModalConfig({
      isOpen: true,
      type: 'reset',
      title: 'Attention',
      message: 'Vous etes sur le point de restaurer l ensemble des seuils industriels aux valeurs d usine par defaut. Toutes les valeurs personnalisees actuelles seront reinitialisees dans MongoDB. Souhaitez-vous continuer ?',
      confirmText: 'Confirmer la Reinitialisation'
    });
  };

  // 5. Execution de la sauvegarde apres confirmation
  const executeSave = async () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
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

  // 6. Execution de la reinitialisation apres confirmation
  const executeReset = async () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/thresholds/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setThresholds(data.thresholds);
        setInitialThresholds(JSON.parse(JSON.stringify(data.thresholds)));
        setSaveStatus({ type: 'success', message: 'Seuils restaures aux valeurs par defaut avec succes !' });
      } else {
        setSaveStatus({ type: 'error', message: 'Echec de la reinitialisation.' });
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
      {/* En-tête Épuré de la Section (Sans sous-titre) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '1.5rem',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--azura-border)'
      }}>
        <div style={{ width: '4px', height: '20px', backgroundColor: '#0284c7', borderRadius: '4px' }} />
        <h2 style={{
          fontSize: '1.1rem',
          fontWeight: 800,
          color: 'var(--azura-text)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          margin: 0
        }}>
          Seuils de Surveillance & Regles Metier
        </h2>
      </div>

      {/* Message Toast de Statut */}
      {saveStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 18px',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            backgroundColor: saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: saveStatus.type === 'success' ? '#15803d' : '#b91c1c',
            fontSize: '0.85rem',
            fontWeight: 750,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
          }}
        >
          <CheckCircle size={18} weight="fill" />
          <span>{saveStatus.message}</span>
        </motion.div>
      )}

      {/* Grille Simple & Épurée des 6 Cartes Métier */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        {metricKeys.map(key => {
          const item = thresholds[key];
          if (!item) return null;

          return (
            <div
              key={key}
              style={{
                backgroundColor: 'var(--azura-card-bg)',
                borderRadius: '16px',
                border: '1px solid var(--azura-border)',
                padding: '1.25rem 1.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
              }}
            >
              {/* En-tête Sobre de la Carte : Titre + Référence + Unité */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: 'var(--azura-text)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    {item.label}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
                    {item.standard_reference || 'Norme Industrielle AzurA'}
                  </span>
                </div>

                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--azura-text)',
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid var(--azura-border)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  {item.unit}
                </span>
              </div>

              {/* Formulaire des Bornes Min & Max */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: key === 'battery' ? '1fr' : '1fr 1fr',
                gap: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--azura-border)'
              }}>
                {/* Borne Minimale */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--azura-text-muted)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {key === 'battery' ? 'Seuil Critique' : `Seuil Min (${item.unit})`}
                  </label>
                  <input
                    type="number"
                    step={item.step || 0.1}
                    value={item.min}
                    onChange={(e) => handleValueChange(key, 'min', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--azura-border)',
                      backgroundColor: 'var(--azura-card-bg)',
                      color: 'var(--azura-text)',
                      fontWeight: 800,
                      fontSize: '1rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Borne Maximale (si non batterie) */}
                {key !== 'battery' && (
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: 'var(--azura-text-muted)',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Seuil Max ({item.unit})
                    </label>
                    <input
                      type="number"
                      step={item.step || 0.1}
                      value={item.max}
                      onChange={(e) => handleValueChange(key, 'max', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--azura-border)',
                        backgroundColor: 'var(--azura-card-bg)',
                        color: 'var(--azura-text)',
                        fontWeight: 800,
                        fontSize: '1rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Indicateurs de Plages & Statuts (Seuls éléments en couleurs pour clarté maximale) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{
                  color: '#0284c7',
                  backgroundColor: 'rgba(2, 132, 199, 0.08)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 700
                }}>
                  {key === 'battery' ? `Critique : < ${item.min}%` : `Bas : < ${item.min} ${item.unit}`}
                </span>

                <span style={{
                  color: '#15803d',
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 700
                }}>
                  {key === 'battery' ? `Nominal : >= ${item.min}%` : `Nominal : [${item.min} - ${item.max}]`}
                </span>

                {key !== 'battery' && (
                  <span style={{
                    color: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 700
                  }}>
                    Haut : &gt; {item.max} {item.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barre d'Actions Inférieure (Boutons en bas) */}
      <div style={{
        backgroundColor: 'var(--azura-card-bg)',
        border: '1px solid var(--azura-border)',
        borderRadius: '16px',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: hasChanges ? '#f59e0b' : '#10b981'
          }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--azura-text)' }}>
            {hasChanges ? 'Modifications en attente d enregistrement' : 'Seuils synchronises avec MongoDB'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Bouton 1 : Valeurs par Défaut */}
          <button
            onClick={promptReset}
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              border: '1px solid var(--azura-border)',
              color: 'var(--azura-text)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            Valeurs par Defaut
          </button>

          {/* Bouton 2 : Enregistrer les Modifications */}
          <button
            onClick={promptSave}
            disabled={!hasChanges || isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: '10px',
              backgroundColor: hasChanges ? '#0284c7' : 'rgba(0,0,0,0.06)',
              border: 'none',
              color: hasChanges ? '#ffffff' : 'var(--azura-text-muted)',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: hasChanges && !isSaving ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: hasChanges ? '0 4px 16px rgba(2, 132, 199, 0.3)' : 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <FloppyDisk size={16} weight="bold" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
          </button>
        </div>
      </div>

      {/* Pop-up Modale Interactive "Attention" (100% ROUGE pour les 2 actions) */}
      <AnimatePresence>
        {modalConfig.isOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                backgroundColor: 'var(--azura-card-bg)',
                borderRadius: '18px',
                border: '1.5px solid rgba(239, 68, 68, 0.35)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 30px rgba(239, 68, 68, 0.12)',
                maxWidth: '480px',
                width: '100%',
                overflow: 'hidden'
              }}
            >
              {/* En-tête Rouge de la Modale */}
              <div style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--azura-border)',
                backgroundColor: 'rgba(239, 68, 68, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.2)'
                  }}>
                    <WarningOctagon size={26} weight="fill" />
                  </div>

                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: '#ef4444',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      letterSpacing: '-0.01em'
                    }}>
                      Attention
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
                      Confirmation de Securite
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--azura-text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              {/* Corps de la Modale */}
              <div style={{ padding: '24px' }}>
                <p style={{
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  color: 'var(--azura-text)',
                  margin: 0,
                  fontWeight: 500,
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {modalConfig.message}
                </p>
              </div>

              {/* Pied de Modale : Bouton de Soumission 100% ROUGE */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderTop: '1px solid var(--azura-border)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px'
              }}>
                <button
                  onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--azura-border)',
                    color: 'var(--azura-text)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                >
                  Annuler
                </button>

                <button
                  onClick={modalConfig.type === 'reset' ? executeReset : executeSave}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: 'all 0.2s ease'
                  }}
                >
                  {modalConfig.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
