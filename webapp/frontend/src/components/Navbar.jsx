import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

  return (
    <>
      {/* 1. TOP HEADER : GAUCHE (LOGO PNG TRANSPARENT) — CENTRE (TITRE) — DROITE (CONTRÔLES) */}
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

          {/* Titre & Sous-titre au Centre */}
          <div className="top-title-center">
            <div className="brand-title">AZURA GROUP</div>
            <div className="brand-subtitle">Supervision IoT Temps Réel</div>
          </div>

          {/* Contrôles à l'extrême Droite */}
          <div className="top-controls-right">
            <AnimatedThemeToggler variant="circle" duration={400} />
            
            {/* Macaron Statut Unique (Phosphor Icons sans double-point superflu) */}
            <div className="system-status-badge">
              <WifiHigh size={16} weight="bold" className="wifi-icon" />
              <span className="status-text">Système En Ligne</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. BOTTOM FLOATING NAVIGATION MENU (MILIEU BAS DE L'ÉCRAN) */}
      <motion.nav 
        initial={{ y: 50, opacity: 0, x: "-50%" }}
        animate={{ y: 0, opacity: 1, x: "-50%" }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bottom-nav-container"
        role="navigation"
        aria-label="Menu de navigation principal"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <motion.button
              key={item.label}
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
    </>
  );
}
