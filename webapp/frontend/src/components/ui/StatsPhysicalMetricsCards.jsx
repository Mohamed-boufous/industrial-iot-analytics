import React from 'react';

export default function StatsPhysicalMetricsCards({ metrics = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        {[1, 2, 3, 4, 5].map((idx) => {
          const colSpan = idx === 1 ? '1 / span 2' :
                          idx === 2 ? '3 / span 2' :
                          idx === 3 ? '5 / span 2' :
                          idx === 4 ? '2 / span 2' : '4 / span 2';
          return (
            <div
              key={idx}
              style={{
                gridColumn: colSpan,
                height: '210px',
                borderRadius: '14px',
                backgroundColor: 'var(--azura-card-bg)',
                border: '1px solid var(--azura-border)',
                animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            />
          );
        })}
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Titre de la Section 2 : Statistiques des Grandeurs Physiques */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            Statistiques des Grandeurs Physiques (Moyenne, Min, Max)
          </h2>
        </div>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--azura-text-muted)',
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          padding: '3px 10px',
          borderRadius: '9999px'
        }}>
          5 Types Metier
        </span>
      </div>

      {/* Grille Géométrique : Ligne 1 (3 cartes) + Ligne 2 (2 cartes centrées sous les espaces) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '1.25rem',
        width: '100%'
      }}>
        {metrics.map((item, idx) => {
          const hasAlerts = item.total_alerts > 0;
          // Positionnement précis en grille de 6 colonnes
          const colPlacement = idx === 0 ? '1 / span 2' :
                               idx === 1 ? '3 / span 2' :
                               idx === 2 ? '5 / span 2' :
                               idx === 3 ? '2 / span 2' : '4 / span 2';

          return (
            <div
              key={item.type || idx}
              style={{
                gridColumn: colPlacement,
                position: 'relative',
                padding: '1.25rem',
                backgroundColor: 'var(--azura-card-bg)',
                borderRadius: '14px',
                border: '1px solid var(--azura-border)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'center',
                gap: '1rem',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.borderColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.03)';
                e.currentTarget.style.borderColor = 'var(--azura-border)';
              }}
            >
              {/* 1. Titre du Type en Haut au Centre */}
              <div style={{ width: '100%', textAlign: 'center', borderBottom: '1px solid var(--azura-border)', paddingBottom: '0.65rem' }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--azura-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  margin: 0,
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {item.label}
                </h3>
              </div>

              {/* 2. Moyenne Globale au Centre */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem 0'
              }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--azura-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Moyenne Globale
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px'
                }}>
                  <span style={{
                    fontSize: '1.9rem',
                    fontWeight: 850,
                    color: 'var(--azura-text)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    letterSpacing: '-0.5px'
                  }}>
                    {typeof item.avg === 'number' ? item.avg.toLocaleString() : item.avg}
                  </span>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: '#2563eb',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    {item.unit}
                  </span>
                </div>
              </div>

              {/* 3. Badges Min (Bleu) & Max (Rouge) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                width: '100%'
              }}>
                {/* Min en Bleu */}
                <div style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 750,
                    color: '#2563eb',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}>
                    Min
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: 'var(--azura-text)',
                    marginTop: '1px'
                  }}>
                    {item.min} <span style={{ fontSize: '0.72rem', color: 'var(--azura-text-muted)' }}>{item.unit}</span>
                  </span>
                </div>

                {/* Max en Rouge */}
                <div style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(220, 38, 38, 0.05)',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 750,
                    color: '#dc2626',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}>
                    Max
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: 'var(--azura-text)',
                    marginTop: '1px'
                  }}>
                    {item.max} <span style={{ fontSize: '0.72rem', color: 'var(--azura-text-muted)' }}>{item.unit}</span>
                  </span>
                </div>
              </div>

              {/* 4. Pied de Carte : Total Mesures & Alertes */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid var(--azura-border)',
                fontSize: '0.75rem',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                <span style={{ color: 'var(--azura-text-muted)', fontWeight: 650 }}>
                  {item.total_measurements.toLocaleString()} mesures
                </span>

                {hasAlerts ? (
                  <span style={{
                    color: '#dc2626',
                    fontWeight: 800,
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {item.total_alerts} alertes
                  </span>
                ) : (
                  <span style={{
                    color: 'var(--azura-text-muted)',
                    fontWeight: 700,
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    0 alerte
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
