import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EnvelopeSimple,
  PaperPlaneRight,
  CheckCircle,
  X,
  WarningCircle,
  ArrowClockwise,
  ShieldCheck,
  LockKey,
  ArrowsLeftRight
} from '@phosphor-icons/react';

export default function SettingsEmailManager({ emailConfig, onEmailConfigChange, isGateMode = false }) {
  const [inputEmail, setInputEmail] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Modale OTP (Noir et Blanc avec logo entreprise)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('verify_new'); // 'verify_new' | 'confirm_change'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  // 1. Demande d'envoi du code OTP pour un NOUVEL email
  const handleSendNewOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = inputEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir une adresse email valide.' });
      return;
    }

    setIsSendingOtp(true);
    setStatusMessage(null);
    setOtpError('');
    setOtpCode('');

    try {
      const res = await fetch('/api/settings/send-verification-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();

      if (res.ok) {
        setModalMode('verify_new');
        setIsModalOpen(true);
        setStatusMessage({ type: 'success', text: `Code de verification envoye a ${cleanEmail}` });
      } else {
        setStatusMessage({ type: 'error', text: data.detail || 'Echec de l envoi de l email.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Erreur de communication avec le serveur.' });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Demande de code OTP pour CHANGER l'email actuel (Révocation)
  const handleRequestChangeEmail = async () => {
    setIsSendingOtp(true);
    setStatusMessage(null);
    setOtpError('');
    setOtpCode('');

    try {
      const res = await fetch('/api/settings/request-email-change-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (res.ok) {
        setModalMode('confirm_change');
        setIsModalOpen(true);
        setStatusMessage({
          type: 'success',
          text: `Code de confirmation de changement envoye a ${emailConfig.email}`
        });
      } else {
        setStatusMessage({ type: 'error', text: data.detail || 'Impossible d initier le changement.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Erreur de connexion au serveur.' });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 3. Soumission et validation du code OTP (6 chiffres)
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = otpCode.trim();
    if (cleanCode.length < 6) {
      setOtpError('Le code doit comporter 6 chiffres.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      if (modalMode === 'verify_new') {
        // Validation d'une nouvelle adresse
        const res = await fetch('/api/settings/verify-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inputEmail.trim(),
            code: cleanCode
          })
        });
        const data = await res.json();

        if (res.ok) {
          setIsModalOpen(false);
          setOtpCode('');
          setInputEmail('');
          if (onEmailConfigChange) {
            onEmailConfigChange({
              email: data.email,
              is_verified: true,
              verified_at: data.verified_at
            });
          }
          setStatusMessage({
            type: 'success',
            text: 'Adresse email validee avec succes !'
          });
        } else {
          setOtpError(data.detail || 'Code invalide ou expire.');
        }
      } else {
        // Confirmation de suppression / changement d'adresse
        const res = await fetch('/api/settings/confirm-email-change-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanCode })
        });
        const data = await res.json();

        if (res.ok) {
          setIsModalOpen(false);
          setOtpCode('');
          setInputEmail('');
          if (onEmailConfigChange) {
            onEmailConfigChange({
              email: '',
              is_verified: false,
              verified_at: null
            });
          }
          setStatusMessage({
            type: 'success',
            text: 'Email reinitialise. Veuillez configurer votre nouvelle adresse.'
          });
        } else {
          setOtpError(data.detail || 'Code invalide ou expire.');
        }
      }
    } catch (err) {
      setOtpError('Erreur de verification.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDU 1 : MODALE DE VERROUILLAGE D'ACCÈS (GATE ONBOARDING NOIR & BLANC)
  // ══════════════════════════════════════════════════════════════════════════════
  if (isGateMode || !emailConfig?.is_verified) {
    return (
      <div style={{
        minHeight: '75vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        width: '100%'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'var(--azura-card-bg)',
            border: '1px solid var(--azura-border)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08)',
            padding: '36px 32px',
            textAlign: 'center'
          }}
        >
          {/* Logo AzurA Officiel */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <img
              src="/azura_logo.png"
              alt="Logo AzurA"
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Badge Noir & Blanc */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid var(--azura-border)',
            color: 'var(--azura-text)',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px'
          }}>
            <LockKey size={14} weight="bold" />
            <span>Acces Securise Requis</span>
          </div>

          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: 'var(--azura-text)',
            margin: '0 0 10px 0',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}>
            Ajouter et Verifier un Email
          </h2>

          <p style={{
            fontSize: '0.88rem',
            lineHeight: '1.5',
            color: 'var(--azura-text-muted)',
            margin: '0 0 24px 0',
            fontWeight: 500
          }}>
            Pour acceder aux parametres et seuils industriels, vous devez associer et valider une adresse email de reception des alertes.
          </p>

          {/* Message de statut */}
          {statusMessage && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              marginBottom: '18px',
              backgroundColor: statusMessage.type === 'success' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${statusMessage.type === 'success' ? 'var(--azura-border)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: statusMessage.type === 'success' ? 'var(--azura-text)' : '#b91c1c',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              {statusMessage.type === 'success' ? <CheckCircle size={16} weight="bold" /> : <WarningCircle size={16} weight="bold" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Formulaire Saisie Nouvel Email */}
          <form onSubmit={handleSendNewOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: 'var(--azura-text-muted)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Adresse Email Professionnelle
              </label>
              <input
                type="email"
                placeholder="votre.email@domaine.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--azura-border)',
                  backgroundColor: 'var(--azura-card-bg)',
                  color: 'var(--azura-text)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSendingOtp || !inputEmail}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '13px 24px',
                borderRadius: '10px',
                backgroundColor: 'var(--azura-text)',
                border: 'none',
                color: 'var(--azura-card-bg)',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: isSendingOtp ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: 'all 0.2s ease',
                marginTop: '6px'
              }}
            >
              {isSendingOtp ? (
                <>
                  <ArrowClockwise size={18} weight="bold" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Envoi du Code...</span>
                </>
              ) : (
                <>
                  <PaperPlaneRight size={18} weight="bold" />
                  <span>Envoyer le Code de Verification</span>
                </>
              )}
            </button>
          </form>

          {/* Modal OTP Popup */}
          <OtpModal
            isOpen={isModalOpen}
            mode={modalMode}
            email={modalMode === 'verify_new' ? inputEmail : emailConfig?.email}
            otpCode={otpCode}
            setOtpCode={setOtpCode}
            otpError={otpError}
            isVerifyingOtp={isVerifyingOtp}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleVerifyOtp}
            onResend={modalMode === 'verify_new' ? handleSendNewOtp : handleRequestChangeEmail}
            isSendingOtp={isSendingOtp}
          />
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDU 2 : CARTE PARAMÈTRES (EMAIL ACTIF & LECTURE SEULE EN NOIR ET BLANC)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      backgroundColor: 'var(--azura-card-bg)',
      borderRadius: '16px',
      border: '1px solid var(--azura-border)',
      padding: '24px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
      marginBottom: '2rem'
    }}>
      {/* En-tête Épuré Noir & Blanc */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--azura-border)',
        paddingBottom: '16px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            color: 'var(--azura-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--azura-border)'
          }}>
            <EnvelopeSimple size={22} weight="bold" />
          </div>

          <div>
            <h3 style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--azura-text)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              Destinataire des Notifications d'Alerte
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
              Diffusion automatique des rapports d'incidents et pannes critiques
            </span>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          border: '1px solid var(--azura-border)',
          color: 'var(--azura-text)',
          fontSize: '0.8rem',
          fontWeight: 750
        }}>
          <ShieldCheck size={16} weight="bold" />
          <span>Email Verifie & Actif</span>
        </div>
      </div>

      {/* Message Toast de Statut */}
      {statusMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          backgroundColor: statusMessage.type === 'success' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${statusMessage.type === 'success' ? 'var(--azura-border)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: statusMessage.type === 'success' ? 'var(--azura-text)' : '#b91c1c',
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle size={18} weight="bold" /> : <WarningCircle size={18} weight="bold" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Formulaire avec Champ en Lecture Seule & Bouton Changer l'Email */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1', minWidth: '280px' }}>
          <label style={{
            display: 'block',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--azura-text-muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Adresse Email Enregistree (Lecture Seule)
          </label>
          <input
            type="email"
            value={emailConfig.email}
            disabled
            readOnly
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--azura-border)',
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              color: 'var(--azura-text)',
              fontSize: '0.95rem',
              fontWeight: 700,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              boxSizing: 'border-box',
              cursor: 'not-allowed',
              opacity: 0.85
            }}
          />
        </div>

        <div style={{ paddingTop: '20px' }}>
          <button
            type="button"
            onClick={handleRequestChangeEmail}
            disabled={isSendingOtp}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 22px',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              border: '1px solid var(--azura-border)',
              color: 'var(--azura-text)',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: isSendingOtp ? 'not-allowed' : 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'all 0.2s ease'
            }}
          >
            {isSendingOtp ? (
              <>
                <ArrowClockwise size={16} weight="bold" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Envoi du Code...</span>
              </>
            ) : (
              <>
                <ArrowsLeftRight size={16} weight="bold" />
                <span>Changer l'Email</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal OTP Popup */}
      <OtpModal
        isOpen={isModalOpen}
        mode={modalMode}
        email={emailConfig.email}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        otpError={otpError}
        isVerifyingOtp={isVerifyingOtp}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleVerifyOtp}
        onResend={handleRequestChangeEmail}
        isSendingOtp={isSendingOtp}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT MODALE OTP ÉPURÉ NOIR ET BLANC AVEC LOGO (STYLE SHADCN / MAGIC UI)
// ══════════════════════════════════════════════════════════════════════════════
function OtpModal({
  isOpen,
  mode,
  email,
  otpCode,
  setOtpCode,
  otpError,
  isVerifyingOtp,
  onClose,
  onSubmit,
  onResend,
  isSendingOtp
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              border: '1px solid var(--azura-border)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
              maxWidth: '440px',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            {/* En-tête Sobre Noir & Blanc avec Logo */}
            <div style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--azura-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src="/azura_logo.png"
                  alt="Logo AzurA"
                  style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: 'var(--azura-text)',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}>
                    {mode === 'verify_new' ? 'Verification de Securite' : 'Confirmation de Changement'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--azura-text-muted)', fontWeight: 600 }}>
                    Code de securite a 6 chiffres
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--azura-text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px'
                }}
              >
                <X size={20} weight="bold" />
              </button>
            </div>

            {/* Corps de la Modale */}
            <form onSubmit={onSubmit} style={{ padding: '24px' }}>
              <p style={{
                fontSize: '0.88rem',
                lineHeight: '1.5',
                color: 'var(--azura-text)',
                margin: '0 0 18px 0',
                fontWeight: 500
              }}>
                {mode === 'verify_new' ? (
                  <>
                    Un code de verification a 6 chiffres a ete envoye a :<br />
                    <strong style={{ color: 'var(--azura-text)', fontWeight: 800 }}>{email}</strong>
                  </>
                ) : (
                  <>
                    Un code de securite a ete envoye a votre adresse actuelle :<br />
                    <strong style={{ color: 'var(--azura-text)', fontWeight: 800 }}>{email}</strong>.<br />
                    <span style={{ fontSize: '0.8rem', color: 'var(--azura-text-muted)' }}>
                      La saisie de ce code confirmera la suppression de cette adresse.
                    </span>
                  </>
                )}
              </p>

              {/* Champ Code OTP Grand Format */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--azura-text-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  textAlign: 'center'
                }}>
                  Saisissez le code a 6 chiffres
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: otpError ? '2px solid #ef4444' : '1px solid var(--azura-border)',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    color: 'var(--azura-text)',
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    textAlign: 'center',
                    fontFamily: "'Courier New', Courier, monospace",
                    letterSpacing: '8px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              {otpError && (
                <div style={{
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  marginBottom: '14px'
                }}>
                  {otpError}
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '20px'
              }}>
                <button
                  type="button"
                  onClick={onResend}
                  disabled={isSendingOtp}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--azura-text-muted)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Renvoyer un code
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '10px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--azura-border)',
                      color: 'var(--azura-text)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpCode.length < 6}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--azura-text)',
                      border: 'none',
                      color: 'var(--azura-card-bg)',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: isVerifyingOtp || otpCode.length < 6 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isVerifyingOtp ? 'Verification...' : 'Confirmer le Code'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
