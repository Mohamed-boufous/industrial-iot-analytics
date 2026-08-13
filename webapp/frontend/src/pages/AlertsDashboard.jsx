import React from 'react';
import { 
  WarningOctagon, 
  Waveform, 
  ShieldWarning, 
  ClockCounterClockwise,
  CheckCircle
} from '@phosphor-icons/react';
import { RealTimeAnalytics } from '../components/ui/real-time-analytics';
import { useWebSocket } from '../hooks/useWebSocket';

export default function AlertsDashboard() {
  const { messages, isConnected } = useWebSocket('/ws/alerts');

  // Filtrer les messages pour extraire la liste des alertes
  const alertList = messages
    .filter((m) => m.type === 'NEW_ALERT' || m.type === 'INITIAL_ALERTS_HISTORY')
    .flatMap((m) => (Array.isArray(m.data) ? m.data : [m.data]))
    .filter(Boolean);

  const totalAlerts = alertList.length;
  const criticalCount = alertList.filter((a) => a.status && a.status.startsWith('CRITICAL')).length;
  const uniqueSensorsCount = new Set(alertList.map((a) => a.device_id)).size;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Entête de la Page */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <WarningOctagon size={32} weight="fill" style={{ color: 'var(--azura-accent-red)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--azura-text)', margin: 0 }}>
              Supervision des Alertes Temps Réel
            </h1>
          </div>
          <p style={{ color: 'var(--azura-text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Plateforme industrielle AzurA — Flux d'anomalies filtré par Spark Streaming (topic Kafka: <code>iot-alerts</code>).
          </p>
        </div>
      </div>

      {/* Cartes KPI Synthétiques */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="azura-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
            <ShieldWarning size={28} weight="fill" style={{ color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ color: 'var(--azura-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>ALERTES CRITIQUES</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--azura-text)' }}>{criticalCount}</div>
          </div>
        </div>

        <div className="azura-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderRadius: '12px' }}>
            <Waveform size={28} weight="fill" style={{ color: '#f97316' }} />
          </div>
          <div>
            <div style={{ color: 'var(--azura-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>CAPTEURS AFFECTÉS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--azura-text)' }}>{uniqueSensorsCount}</div>
          </div>
        </div>

        <div className="azura-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: '12px' }}>
            <ClockCounterClockwise size={28} weight="fill" style={{ color: '#a855f7' }} />
          </div>
          <div>
            <div style={{ color: 'var(--azura-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>MESSAGES REÇUS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--azura-text)' }}>{totalAlerts}</div>
          </div>
        </div>

        <div className="azura-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
            <CheckCircle size={28} weight="fill" style={{ color: isConnected ? '#22c55e' : '#ef4444' }} />
          </div>
          <div>
            <div style={{ color: 'var(--azura-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>FLUX WEBSOCKET</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isConnected ? '#22c55e' : '#ef4444' }}>
              {isConnected ? 'Connecté' : 'En Reconnexion'}
            </div>
          </div>
        </div>
      </div>

      {/* Intégration du Composant Graphique Temps Réel */}
      <RealTimeAnalytics />

      {/* Tableau du Fil d'Actualité des Alertes Récentes */}
      <div className="azura-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--azura-text)', marginBottom: '1rem' }}>
          📋 Historique Récents des Alertes Transmises
        </h3>
        
        {alertList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--azura-text-muted)' }}>
            Aucune alerte reçue pour le moment. (Attente du franchissement de la 1ère minute).
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--azura-border)', textAlign: 'left', color: 'var(--azura-text-muted)' }}>
                  <th style={{ padding: '10px' }}>Horodatage</th>
                  <th style={{ padding: '10px' }}>Capteur ID</th>
                  <th style={{ padding: '10px' }}>Type</th>
                  <th style={{ padding: '10px' }}>Localisation</th>
                  <th style={{ padding: '10px' }}>Valeur Mesurée</th>
                  <th style={{ padding: '10px' }}>Code Statut</th>
                </tr>
              </thead>
              <tbody>
                {alertList.slice(0, 15).map((alert, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--azura-border)' }}>
                    <td style={{ padding: '10px', color: 'var(--azura-text-muted)', fontFamily: 'monospace' }}>
                      {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--azura-text)' }}>
                      {alert.device_id}
                    </td>
                    <td style={{ padding: '10px', textTransform: 'capitalize', color: 'var(--azura-text-muted)' }}>
                      {alert.device_type}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--azura-text-muted)' }}>
                      {alert.location}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700, color: '#ef4444' }}>
                      {alert.value} {alert.unit}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
