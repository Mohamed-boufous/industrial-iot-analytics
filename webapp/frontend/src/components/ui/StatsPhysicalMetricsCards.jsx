import React, { useState, useRef, useEffect } from 'react';
import { MapPin, CaretDown, Check, Buildings } from '@phosphor-icons/react';

const SITES_LIST = [
  { id: 'ALL', label: 'Tous les 4 Sites', city: 'Global', color: '#2563eb' },
  { id: 'agadir_serre_1', label: 'Agadir - Serre 1', city: 'Agadir', color: '#06b6d4' },
  { id: 'dakhla_station_emballage', label: 'Dakhla - Station Emballage', city: 'Dakhla', color: '#a855f7' },
  { id: 'kenitra_station_filtrage', label: 'Kenitra - Station Filtrage', city: 'Kenitra', color: '#f59e0b' },
  { id: 'tangier_med_hub', label: 'Tanger Med - Hub Logistique', city: 'Tanger Med', color: '#10b981' }
];

export default function StatsPhysicalMetricsCards({
  metrics = [],
  isLoading = false,
  selectedLocation = 'ALL',
  onLocationChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fermeture automatique au clic en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSite = SITES_LIST.find(s => s.id === selectedLocation) || SITES_LIST[0];

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
    <div style={{ marginBottom: '1.75rem', position: 'relative' }}>
      {/* Titre de la Section 2 avec Menu Deroulant Moderne de Selection de Site */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '4px', height: '18px', backgroundColor: currentSite.color, borderRadius: '2px', transition: 'background-color 0.3s ease' }} />
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

        {/* Menu Deroulant Selecteur de Site Moderne */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--azura-card-bg)',
              border: `1.5px solid ${isOpen ? currentSite.color : 'var(--azura-border)'}`,
              boxShadow: isOpen ? `0 0 12px ${currentSite.color}30` : '0 2px 6px rgba(0, 0, 0, 0.04)',
              cursor: 'pointer',
              color: 'var(--azura-text)',
              fontSize: '0.82rem',
              fontWeight: 750,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: currentSite.color,
              boxShadow: `0 0 6px ${currentSite.color}`
            }} />
            <MapPin size={15} weight="bold" style={{ color: currentSite.color }} />
            <span>{currentSite.label}</span>
            <CaretDown
              size={13}
              weight="bold"
              style={{
                color: 'var(--azura-text-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          {/* Panneau Flottant du Menu Deroulant */}
          {isOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '260px',
              backgroundColor: 'var(--azura-card-bg)',
              border: '1px solid var(--azura-border)',
              borderRadius: '12px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
              backdropFilter: 'blur(16px)',
              zIndex: 100,
              overflow: 'hidden',
              padding: '6px'
            }}>
              <div style={{
                padding: '6px 10px 4px 10px',
                fontSize: '0.68rem',
                fontWeight: 800,
                color: 'var(--azura-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Filtrer par Emplacement AzurA
              </div>

              {SITES_LIST.map((site) => {
                const isSelected = site.id === selectedLocation;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      if (onLocationChange) onLocationChange(site.id);
                      setIsOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? `${site.color}15` : 'transparent',
                      border: isSelected ? `1px solid ${site.color}40` : '1px solid transparent',
                      color: isSelected ? site.color : 'var(--azura-text)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 800 : 650,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: site.color,
                        boxShadow: `0 0 6px ${site.color}`
                      }} />
                      <span>{site.label}</span>
                    </div>
                    {isSelected && <Check size={14} weight="bold" style={{ color: site.color }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grille Geometrique : Ligne 1 (3 cartes) + Ligne 2 (2 cartes centrees sous les espaces) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '1.25rem',
        width: '100%'
      }}>
        {metrics.map((item, idx) => {
          const hasAlerts = item.total_alerts > 0;
          // Positionnement precis en grille de 6 colonnes
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
                e.currentTarget.style.borderColor = currentSite.color;
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

              {/* 2. Moyenne Calculee au Centre (Globale ou par Site) */}
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
                  {currentSite.id === 'ALL' ? 'Moyenne Globale' : `Moyenne : ${currentSite.city}`}
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
                    color: currentSite.color,
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
                {/* Min */}
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

                {/* Max */}
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

