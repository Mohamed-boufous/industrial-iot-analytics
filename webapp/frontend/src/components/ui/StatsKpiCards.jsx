import React from 'react';
import { motion } from 'framer-motion';
import { Database, WarningOctagon, ShieldCheck, Cpu } from '@phosphor-icons/react';

export default function StatsKpiCards({ kpis = {}, isLoading = false }) {
  const cards = [
    {
      title: 'TELEMETRIE BRUTE (RAW)',
      value: kpis.total_raw_measurements != null ? kpis.total_raw_measurements.toLocaleString() : '0',
      subtitle: 'Documents dans raw_measurements',
      icon: Database,
      accentColor: '#0284c7',
      bgColor: 'rgba(2, 132, 199, 0.08)',
      borderColor: 'rgba(2, 132, 199, 0.25)',
      boxShadow: '0 4px 18px rgba(2, 132, 199, 0.12)'
    },
    {
      title: 'INCIDENTS ET DERIVES',
      value: kpis.total_alerts != null ? kpis.total_alerts.toLocaleString() : '0',
      subtitle: 'Enregistres dans alerts_history',
      icon: WarningOctagon,
      accentColor: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.25)',
      boxShadow: '0 4px 18px rgba(239, 68, 68, 0.12)'
    },
    {
      title: 'TAUX DE CONFORMITE',
      value: kpis.compliance_rate != null ? `${kpis.compliance_rate}%` : '100%',
      subtitle: 'Mesures en statut NORMAL',
      icon: ShieldCheck,
      accentColor: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.08)',
      borderColor: 'rgba(34, 197, 94, 0.25)',
      boxShadow: '0 4px 18px rgba(34, 197, 94, 0.12)'
    },
    {
      title: 'CAPTEUR LE PLUS INSTABLE',
      value: kpis.top_problematic_sensor || 'Aucun',
      subtitle: 'Top generateur d anomalies',
      icon: Cpu,
      accentColor: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: 'rgba(139, 92, 246, 0.25)',
      boxShadow: '0 4px 18px rgba(139, 92, 246, 0.12)'
    }
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}
    >
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.08 }}
            whileHover={{ y: -3, scale: 1.015 }}
            style={{
              backgroundColor: 'var(--azura-card-bg)',
              border: `1px solid ${card.borderColor}`,
              borderRadius: '16px',
              padding: '18px 20px',
              boxShadow: card.boxShadow,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Arriere-plan subtil avec gradient */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '100px',
                height: '100px',
                background: `radial-gradient(circle at top right, ${card.bgColor} 0%, transparent 70%)`,
                pointerEvents: 'none'
              }}
            />

            {/* En-tete Carte */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--azura-text-muted)',
                  letterSpacing: '0.05em',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              >
                {card.title}
              </span>
              <div
                style={{
                  padding: '8px',
                  borderRadius: '10px',
                  backgroundColor: card.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <IconComponent size={20} weight="bold" style={{ color: card.accentColor }} />
              </div>
            </div>

            {/* Valeur Principale */}
            <div style={{ marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: 'var(--azura-text)',
                  letterSpacing: '-0.02em',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              >
                {isLoading ? '...' : card.value}
              </span>
            </div>

            {/* Sous-titre */}
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--azura-text-muted)',
                fontWeight: 600,
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            >
              {card.subtitle}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
