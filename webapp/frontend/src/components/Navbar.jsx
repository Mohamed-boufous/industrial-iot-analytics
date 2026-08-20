import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  WarningOctagon, 
  Broadcast, 
  ChartLineUp, 
  GearSix, 
  WifiHigh,
  WifiSlash,
  Bell
} from '@phosphor-icons/react';
import { AnimatedThemeToggler } from './ui/AnimatedThemeToggler';
import AlertNotificationsModal from './ui/AlertNotificationsModal';
import { useWebSocket } from '../hooks/useWebSocket';

const navItems = [
  { label: "Alertes", icon: WarningOctagon, path: "/" },
  { label: "Capteurs Live", icon: Broadcast, path: "/sensors" },
  { label: "Statistiques", icon: ChartLineUp, path: "/stats" },
  { label: "Parametres", icon: GearSix, path: "/settings" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const { isConnected } = useWebSocket('/ws/alerts');

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 35;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* 1. TOP HEADER : GAUCHE (LOGO AZURA) — CENTRE (DYNAMIC SLOT) — DROITE (CONTRÔLES & ALERTES) */}
      <header className="top-header">
        <div className="top-header-container">
          {/* Logo à l'extrême Gauche */}
          <div className="top-brand-left">
            <img 
              src="/azura_logo.png" 
              alt="AzurA Group Logo" 
              className="top-logo-transparent" 
            />
          </div>

          {/* Slot Central : Transition Fluide entre Titre Header et Barre de Navigation */}
          <div className="top-title-center" style={{ minHeight: '46px', position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <AnimatePresence mode="wait">
              {isScrolled ? (
                <motion.div
                  key="header-title"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div className="brand-title">AZURA GROUP</div>
                  <div className="brand-subtitle">Supervision IoT Temps Réel</div>
                </motion.div>
              ) : (
                <motion.div
                  key="header-nav"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                    border: '1px solid var(--navbar-border)'
                  }}
                >
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                      <motion.button
                        key={`top-${item.label}`}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.02 }}
                        type="button"
                        className={`nav-item-btn ${isActive ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                        aria-label={item.label}
                        style={{ height: '36px', padding: '0.4rem 0.85rem' }}
                      >
                        <Icon size={18} weight={isActive ? "fill" : "regular"} />
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            userSelect: "none",
                            marginLeft: "6px"
                          }}
                        >
                          {item.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Contrôles à l'extrême Droite */}
          <div className="top-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AnimatedThemeToggler variant="circle" duration={400} />
            
            {/* BOUTON CLOCHE D'ALERTES & NOTIFICATIONS (NOIR & BLANC ADAPTATIF) */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              type="button"
              onClick={() => setIsNotifOpen(true)}
              style={{
                position: 'relative',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid var(--azura-border)',
                backgroundColor: 'var(--azura-card-bg)',
                color: 'var(--azura-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease'
              }}
              title="Centre de notifications et rapports d'alertes"
              aria-label="Centre de notifications"
            >
              <Bell size={18} weight={unreadAlertsCount > 0 ? "fill" : "regular"} />

              {/* Badge Compteur d'Alertes Non Vues */}
              {unreadAlertsCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    minWidth: '17px',
                    height: '17px',
                    padding: '0 4px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--azura-text)',
                    color: 'var(--azura-bg)',
                    border: '1.5px solid var(--azura-card-bg)',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                >
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </motion.span>
              )}
            </motion.button>

            {/* Macaron Statut Dynamique Réel */}
            <div
              className="system-status-badge"
              style={{
                backgroundColor: isConnected ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${isConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                transition: "all 0.3s ease"
              }}
            >
              <span style={{
                position: "relative",
                display: "flex",
                width: "7px",
                height: "7px"
              }}>
                {isConnected && (
                  <span style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    opacity: 0.75,
                    animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
                  }} />
                )}
                <span style={{
                  position: "relative",
                  display: "inline-flex",
                  borderRadius: "50%",
                  width: "7px",
                  height: "7px",
                  backgroundColor: isConnected ? "#22c55e" : "#ef4444",
                  boxShadow: isConnected ? "0 0 6px #22c55e" : "0 0 6px #ef4444"
                }} />
              </span>

              {isConnected ? (
                <WifiHigh size={15} weight="bold" style={{ color: "#22c55e" }} />
              ) : (
                <WifiSlash size={15} weight="bold" style={{ color: "#ef4444" }} />
              )}

              <span className="status-text" style={{ color: isConnected ? "var(--azura-text)" : "#ef4444", fontWeight: 700 }}>
                {isConnected ? "Systeme En Ligne" : "Connexion Perdue"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* POP-UP / DRAWER DE NOTIFICATIONS D'ALERTES */}
      <AlertNotificationsModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onUnreadChange={setUnreadAlertsCount}
      />

      {/* 2. BOTTOM FLOATING NAVIGATION MENU (APPARAÎT EN BAS UNIQUEMENT LORS DU SCROLL > 0) */}
      <AnimatePresence>
        {isScrolled && (
          <motion.nav 
            initial={{ y: 80, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 80, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="bottom-nav-container"
            role="navigation"
            aria-label="Menu de navigation principal"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

              return (
                <motion.button
                  key={`bottom-${item.label}`}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className={`nav-item-btn ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                >
                  <Icon size={20} weight={isActive ? "fill" : "regular"} />

                  <motion.div
                    initial={false}
                    animate={{
                      width: isActive ? "auto" : "0px",
                      opacity: isActive ? 1 : 0,
                      marginLeft: isActive ? "8px" : "0px",
                    }}
                    transition={{
                      width: { type: "spring", stiffness: 350, damping: 32 },
                      opacity: { duration: 0.18 },
                      marginLeft: { duration: 0.18 },
                    }}
                    style={{ overflow: "hidden", display: "flex", alignItems: "center" }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        userSelect: "none",
                      }}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                </motion.button>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
