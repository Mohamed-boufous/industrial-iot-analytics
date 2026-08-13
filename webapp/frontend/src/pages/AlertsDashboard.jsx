import React from 'react';
import { ShieldCheck, WarningOctagon, Radio } from '@phosphor-icons/react';
import { RealTimeAnalytics } from '../components/ui/real-time-analytics';

export default function AlertsDashboard() {
  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Entête Executive et Professionnel (Orienté Opérateur & Décideur) */}
      <div style={{
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          {/* Badge Catégorie */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: '0.75rem'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--azura-accent-red)',
              boxShadow: '0 0 6px var(--azura-accent-red)'
            }} />
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--azura-accent-red)'
            }}>
              Centre de Télémétrie & Incidents
            </span>
          </div>

          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--azura-text)',
            lineHeight: 1.2,
            margin: 0
          }}>
            Supervision des Dérives & Alertes
          </h1>

          <p style={{
            color: 'var(--azura-text-muted)',
            fontSize: '0.925rem',
            marginTop: '0.5rem',
            margin: 0,
            maxWidth: '680px'
          }}>
            Surveillance continue et analyse prédictive des seuils critiques sur les lignes de production automatisées du site industriel AzurA.
          </p>
        </div>

        {/* Puces d'État Système de Haut Niveau */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--azura-card-bg)',
            border: '1px solid var(--azura-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <Radio size={18} weight="bold" style={{ color: 'var(--azura-accent-green)' }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--azura-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Transmission
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--azura-text)' }}>
                Direct (Sub-seconde)
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--azura-card-bg)',
            border: '1px solid var(--azura-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <ShieldCheck size={18} weight="bold" style={{ color: 'var(--azura-accent-green)' }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--azura-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Norme de Sécurité
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--azura-text)' }}>
                ISO / IEC 10816
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intégration du Composant Graphique Temps Réel Épuré */}
      <RealTimeAnalytics />
    </div>
  );
}
