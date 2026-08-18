import React from 'react';

export default function StatsBatteryHealthTable({ batteryData = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div style={{
        height: '240px',
        borderRadius: '14px',
        backgroundColor: 'var(--azura-card-bg)',
        border: '1px solid var(--azura-border)',
        marginBottom: '1.75rem',
        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }} />
    );
  }

  if (!batteryData || batteryData.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '2rem', width: '100%' }}>
      {/* 1. Titre de Section Épuré */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
        <div style={{ width: '4px', height: '18px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
        <h2 style={{
          fontSize: '1rem',
          fontWeight: 800,
          color: 'var(--azura-text)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          margin: 0
        }}>
          Sante Materielle : Top 5 Capteurs a Batterie Critique
        </h2>
      </div>

      {/* 2. Tableau Réactif & Sobre */}
      <div style={{
        overflowX: 'auto',
        borderRadius: '14px',
        border: '1px solid var(--azura-border)',
        backgroundColor: 'var(--azura-card-bg)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.85rem',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <thead>
            <tr style={{
              backgroundColor: 'rgba(0, 0, 0, 0.025)',
              borderBottom: '1px solid var(--azura-border)',
              color: 'var(--azura-text-muted)',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.6px'
            }}>
              <th style={{ padding: '12px 16px' }}>Capteur ID</th>
              <th style={{ padding: '12px 16px' }}>Grandeur</th>
              <th style={{ padding: '12px 16px' }}>Emplacement</th>
              <th style={{ padding: '12px 16px', minWidth: '180px' }}>Niveau de Batterie</th>
              <th style={{ padding: '12px 16px' }}>Signal Radio</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Etat</th>
            </tr>
          </thead>
          <tbody>
            {batteryData.map((item, idx) => {
              const isCrit = item.battery_level < 20;
              const isWarning = item.battery_level >= 20 && item.battery_level < 50;
              const barColor = isCrit ? '#dc2626' : isWarning ? '#f59e0b' : '#2563eb';
              const badgeBg = isCrit ? 'rgba(220, 38, 38, 0.08)' : isWarning ? 'rgba(245, 158, 11, 0.08)' : 'rgba(37, 99, 235, 0.08)';
              const badgeBorder = isCrit ? 'rgba(220, 38, 38, 0.25)' : isWarning ? 'rgba(245, 158, 11, 0.25)' : 'rgba(37, 99, 235, 0.25)';

              return (
                <tr
                  key={item.device_id || idx}
                  style={{
                    borderBottom: idx === batteryData.length - 1 ? 'none' : '1px solid var(--azura-border)',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.015)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Capteur ID */}
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--azura-text)', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                    {item.device_id}
                  </td>

                  {/* Grandeur */}
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--azura-text)' }}>
                    {item.device_type}
                  </td>

                  {/* Emplacement */}
                  <td style={{ padding: '12px 16px', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
                    {item.location}
                  </td>

                  {/* Niveau de Batterie avec Barre Visuelle */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 850, color: barColor, minWidth: '45px', fontSize: '0.88rem' }}>
                        {item.battery_level}%
                      </span>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        backgroundColor: 'rgba(0, 0, 0, 0.06)',
                        borderRadius: '9999px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(100, Math.max(0, item.battery_level))}%`,
                          height: '100%',
                          backgroundColor: barColor,
                          borderRadius: '9999px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  </td>

                  {/* Signal Radio */}
                  <td style={{ padding: '12px 16px', color: 'var(--azura-text-muted)', fontWeight: 650 }}>
                    {item.signal_strength} dBm
                  </td>

                  {/* État */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: barColor,
                      backgroundColor: badgeBg,
                      border: `1px solid ${badgeBorder}`,
                      padding: '3px 9px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
