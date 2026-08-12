import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';

import AlertsDashboard from './pages/AlertsDashboard';
import SensorsDashboard from './pages/SensorsDashboard';
import StatsDashboard from './pages/StatsDashboard';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
      <div className="app-container">
        {/* Notifications Toast Globale */}
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1E293B',
              color: '#FFF',
              borderRadius: '8px',
              fontSize: '0.875rem',
            },
          }}
        />

        {/* Navbar AzurA Group */}
        <Navbar />

        {/* Contenu de la page avec routage */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<AlertsDashboard />} />
            <Route path="/sensors" element={<SensorsDashboard />} />
            <Route path="/stats" element={<StatsDashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
