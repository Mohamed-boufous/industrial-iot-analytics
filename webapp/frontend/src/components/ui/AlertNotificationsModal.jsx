import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  EnvelopeSimple, 
  CheckCircle, 
  X, 
  WarningCircle, 
  Clock, 
  ArrowsClockwise,
  ShieldWarning
} from '@phosphor-icons/react';

export default function AlertNotificationsModal({ isOpen, onClose, onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/settings/notifications-log');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        const unread = data.unread_count || 0;
        setUnreadCount(unread);
        if (onUnreadChange) {
          onUnreadChange(unread);
        }
      }
    } catch (err) {
      console.error('Erreur chargement notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000); // Polling toutes les 8s
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/settings/notifications-log/mark-read', { method: 'POST' });
      setUnreadCount(0);
      if (onUnreadChange) onUnreadChange(0);
      // Mettre à jour l'état local
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Erreur acquittement:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fermeture avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '70px 24px 24px 24px',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)'
      }} onClick={onClose}>
        
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '460px',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--azura-card-bg)',
            border: '1px solid var(--azura-border)',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden'
          }}
        >
          {/* EN-TÊTE NOIR & BLANC */}
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--azura-border)',
            backgroundColor: 'var(--azura-card-bg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--azura-text)',
                color: 'var(--azura-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bell size={18} weight="fill" />
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: 'var(--azura-text)',
                  letterSpacing: '-0.3px'
                }}>
                  Rapports & Alertes Email
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--azura-text-muted)', fontWeight: 500 }}>
                  Historique des envois officiels
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isLoading}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid var(--azura-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--azura-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s'
                  }}
                  title="Marquer toutes les notifications comme lues"
                >
                  <CheckCircle size={13} weight="bold" />
                  Tout marquer lu
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--azura-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Fermer"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* LISTE DES NOTIFICATIONS */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}>
                <ShieldWarning size={36} weight="duotone" style={{ color: 'var(--azura-text-muted)', opacity: 0.6 }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--azura-text-muted)' }}>
                  Aucun rapport d incident envoye pour le moment
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--azura-text-muted)', maxWidth: '280px', lineHeight: 1.4 }}>
                  Les emails envoyes suite aux anomalies continues (plus de 5 min ou 10 min hors ligne) apparaitront ici.
                </span>
              </div>
            ) : (
              notifications.map((item, idx) => {
                const dateStr = item.timestamp 
                  ? new Date(item.timestamp).toLocaleString('fr-FR', { 
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                    })
                  : 'Recent';

                return (
                  <div
                    key={`notif-${idx}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: item.read ? '1px solid var(--azura-border)' : '1.5px solid var(--azura-text)',
                      backgroundColor: item.read ? 'rgba(128, 128, 128, 0.04)' : 'rgba(128, 128, 128, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      position: 'relative'
                    }}
                  >
                    {/* Header Item */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--azura-text)',
                          backgroundColor: 'var(--azura-text)',
                          color: 'var(--azura-bg)',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}>
                          <EnvelopeSimple size={12} weight="bold" />
                          Email Envoyé
                        </span>

                        {!item.read && (
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#ef4444'
                          }} />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
                        <Clock size={12} />
                        {dateStr}
                      </div>
                    </div>

                    {/* Objet & Destinataire */}
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--azura-text)' }}>
                        {item.subject}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--azura-text-muted)', marginTop: '2px' }}>
                        Destinataire : <strong style={{ color: 'var(--azura-text)' }}>{item.recipient}</strong>
                      </div>
                    </div>

                    {/* Liste des équipements impactés */}
                    {item.alerts && item.alerts.length > 0 && (
                      <div style={{
                        marginTop: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        borderTop: '1px dashed var(--azura-border)',
                        paddingTop: '6px'
                      }}>
                        {item.alerts.map((al, aIdx) => (
                          <div key={`al-${aIdx}`} style={{
                            fontSize: '0.74rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: 'var(--azura-text)'
                          }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              • {al.device_id}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              border: '1px solid var(--azura-border)',
                              color: 'var(--azura-text-muted)',
                              fontWeight: 600
                            }}>
                              {al.category} ({al.duration_str})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* PIED DE PAGE MODALE */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--azura-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--azura-text-muted)',
            backgroundColor: 'var(--azura-card-bg)'
          }}>
            <span>Moteur Anti-Spam (1h cooldown)</span>
            <button
              type="button"
              onClick={fetchNotifications}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--azura-text)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ArrowsClockwise size={12} weight="bold" />
              Actualiser
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
