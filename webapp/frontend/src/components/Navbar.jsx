import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  WarningOctagon, 
  Broadcast, 
  ChartLineUp, 
  GearSix, 
  WifiHigh 
} from '@phosphor-icons/react';
import { AnimatedThemeToggler } from './ui/AnimatedThemeToggler';

const navItems = [
  { label: "Alertes", icon: WarningOctagon, path: "/" },
  { label: "Capteurs Live", icon: Broadcast, path: "/sensors" },
  { label: "Statistiques", icon: ChartLineUp, path: "/stats" },
  { label: "Paramètres", icon: GearSix, path: "/settings" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Si scroll > 35px, la navbar descend en bas et le titre réapparaît dans le header
      const scrolled = window.scrollY > 35;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Vérification initiale
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* 1. TOP HEADER : GAUCHE (LOGO AZURA) — CENTRE (DYNAMIC SLOT: NAVBAR À SCROLL 0 / TITRE AU SCROLL) — DROITE (CONTRÔLES) */}
      <header className="top-header">
        <div className="top-header-container">
          {/* Logo à l'extrême Gauche (transparent) */}
          <div className="top-brand-left">
            <img 
              src="/azura_logo.png" 
              alt="AzurA Group Logo" 
              className="top-logo-transparent" 
            />
          </div>

          {/* Slot Central : Transition Fluide & Animée entre le Titre Header et la Barre de Navigation */}
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
          <div className="top-controls-right">
            <AnimatedThemeToggler variant="circle" duration={400} />
            
            {/* Macaron Statut Unique */}
            <div className="system-status-badge">
              <WifiHigh size={16} weight="bold" className="wifi-icon" />
              <span className="status-text">Système En Ligne</span>
            </div>
          </div>
        </div>
      </header>

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
