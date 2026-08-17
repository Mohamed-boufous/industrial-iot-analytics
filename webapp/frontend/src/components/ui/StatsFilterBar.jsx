import React from 'react';
import { motion } from 'framer-motion';
import { Funnel, ArrowClockwise, Check } from '@phosphor-icons/react';

const SENSORS_LIST = [
  { id: 'ALL', label: 'Tous les 15 capteurs' },
  { id: 'sensor_temp_001', label: 'Capteur Temp 001 (Ligne A)' },
  { id: 'sensor_temp_002', label: 'Capteur Temp 002 (Ligne B)' },
  { id: 'sensor_temp_003', label: 'Capteur Temp 003 (Ligne C)' },
  { id: 'sensor_vib_001', label: 'Capteur Vib 001 (Moteur 1)' },
  { id: 'sensor_vib_002', label: 'Capteur Vib 002 (Moteur 2)' },
  { id: 'sensor_vib_003', label: 'Capteur Vib 003 (Moteur 3)' },
  { id: 'sensor_pres_001', label: 'Capteur Pression 001' },
  { id: 'sensor_pres_002', label: 'Capteur Pression 002' },
  { id: 'sensor_pres_003', label: 'Capteur Pression 003' },
  { id: 'sensor_hum_001', label: 'Capteur Humidite 001' },
  { id: 'sensor_hum_002', label: 'Capteur Humidite 002' },
  { id: 'sensor_hum_003', label: 'Capteur Humidite 003' },
  { id: 'sensor_pow_001', label: 'Capteur Puissance 001' },
  { id: 'sensor_pow_002', label: 'Capteur Puissance 002' },
  { id: 'sensor_pow_003', label: 'Capteur Puissance 003' }
];

const PRESETS = [
  { id: '1h', label: '1 Heure' },
  { id: '24h', label: '24 Heures' },
  { id: '7d', label: '7 Jours' },
  { id: '30d', label: '30 Jours' },
  { id: 'ALL', label: 'Tout' }
];

export default function StatsFilterBar({
  selectedPreset,
  setSelectedPreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedSensor,
  setSelectedSensor,
  onApply,
  onReset,
  isLoading
}) {
  const handlePresetClick = (presetId) => {
    setSelectedPreset(presetId);
    const now = new Date();
    let start = new Date();

    if (presetId === '1h') {
      start.setHours(now.getHours() - 1);
    } else if (presetId === '24h') {
      start.setHours(now.getHours() - 24);
    } else if (presetId === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (presetId === '30d') {
      start.setDate(now.getDate() - 30);
    } else {
      setStartDate('');
      setEndDate('');
      return;
    }

    setStartDate(start.toISOString().slice(0, 16));
    setEndDate(now.toISOString().slice(0, 16));
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--azura-card-bg)',
        border: '1px solid var(--azura-border)',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {/* Ligne Superieure : Titre & Boutons de Raccourcis Temporels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Funnel size={20} weight="bold" style={{ color: 'var(--azura-primary)' }} />
          <span
            style={{
              fontSize: '0.92rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              letterSpacing: '0.01em',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            Filtres Temporels & Perimetre Metier
          </span>
        </div>

        {/* Boutons de Presets Temporels 3D Tactiles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => {
            const isActive = selectedPreset === preset.id;
            return (
              <motion.button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ y: 1, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  cursor: 'pointer',
                  userSelect: 'none',
                  outline: 'none',
                  border: isActive ? '1px solid #0284c7' : '1px solid var(--azura-border)',
                  background: isActive
                    ? 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%)'
                    : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                  color: isActive ? '#0369a1' : 'var(--azura-text-muted)',
                  boxShadow: isActive
                    ? 'inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 2px 0 #38bdf8, 0 4px 10px rgba(2, 132, 199, 0.18)'
                    : 'inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 2px 0 #e2e8f0, 0 3px 6px rgba(0, 0, 0, 0.03)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              >
                {preset.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--azura-border)', margin: 0 }} />

      {/* Ligne Inferieure : Dates Personnalisees, Selecteur de Capteurs & Boutons d'Action */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          alignItems: 'end'
        }}
      >
        {/* Date de Debut */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.76rem',
              fontWeight: 750,
              color: 'var(--azura-text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            Date & Heure Debut
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                setSelectedPreset('custom');
                setStartDate(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--azura-border)',
                backgroundColor: 'var(--azura-bg)',
                color: 'var(--azura-text)',
                fontSize: '0.82rem',
                fontWeight: 650,
                outline: 'none',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            />
          </div>
        </div>

        {/* Date de Fin */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.76rem',
              fontWeight: 750,
              color: 'var(--azura-text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            Date & Heure Fin
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                setSelectedPreset('custom');
                setEndDate(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--azura-border)',
                backgroundColor: 'var(--azura-bg)',
                color: 'var(--azura-text)',
                fontSize: '0.82rem',
                fontWeight: 650,
                outline: 'none',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            />
          </div>
        </div>

        {/* Selecteur de Capteur */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.76rem',
              fontWeight: 750,
              color: 'var(--azura-text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            Capteur Specifique
          </label>
          <select
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(e.target.value)}
            style={{
              width: '100%',
              padding: '8.5px 12px',
              borderRadius: '10px',
              border: '1px solid var(--azura-border)',
              backgroundColor: 'var(--azura-bg)',
              color: 'var(--azura-text)',
              fontSize: '0.82rem',
              fontWeight: 650,
              outline: 'none',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            {SENSORS_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Groupe de Boutons 3D Tactiles : Appliquer & Reinitialiser */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <motion.button
            type="button"
            onClick={onApply}
            disabled={isLoading}
            whileHover={{ y: isLoading ? 0 : -2, scale: isLoading ? 1 : 1.02 }}
            whileTap={{ y: isLoading ? 0 : 1.5, scale: isLoading ? 1 : 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '10px',
              border: '1px solid #86efac',
              background: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)',
              color: '#15803d',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 3px 0 #4ade80, 0 6px 12px rgba(34, 197, 94, 0.18)',
              outline: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <Check size={16} weight="bold" />
            <span>{isLoading ? 'Calcul...' : 'Appliquer'}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={onReset}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ y: 1.5, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              color: '#64748b',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 3px 0 #94a3b8, 0 5px 10px rgba(0, 0, 0, 0.05)',
              outline: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <ArrowClockwise size={16} weight="bold" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
