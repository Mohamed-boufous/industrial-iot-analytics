import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Table, DownloadSimple, MagnifyingGlass, ShieldWarning, Database } from '@phosphor-icons/react';

export default function StatsDataTable({ alertsList = [], rawList = [] }) {
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' ou 'raw'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Filtrage selon la recherche utilisateur
  const currentData = activeTab === 'alerts' ? alertsList : rawList;
  const filteredData = currentData.filter((item) => {
    const text = `${item.device_id || ''} ${item.status || ''} ${item.location || ''} ${item.device_type || ''}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Export CSV
  const exportCSV = () => {
    if (!filteredData.length) return;
    const headers = Object.keys(filteredData[0]).join(',');
    const rows = filteredData.map((obj) =>
      Object.values(obj)
        .map((val) => `"${val}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `azura_export_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const exportJSON = () => {
    if (!filteredData.length) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(filteredData, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `azura_export_${activeTab}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--azura-card-bg)',
        border: '1px solid var(--azura-border)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* En-tete : Onglets, Recherche & Exportation 3D */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '16px'
        }}
      >
        {/* Onglets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('alerts');
              setCurrentPage(1);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'alerts' ? '1px solid #ef4444' : '1px solid var(--azura-border)',
              backgroundColor: activeTab === 'alerts' ? 'rgba(239, 68, 68, 0.09)' : 'transparent',
              color: activeTab === 'alerts' ? '#b91c1c' : 'var(--azura-text-muted)',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <ShieldWarning size={16} weight="bold" />
            <span>Registre des Alertes ({alertsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('raw');
              setCurrentPage(1);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: activeTab === 'raw' ? '1px solid #0284c7' : '1px solid var(--azura-border)',
              backgroundColor: activeTab === 'raw' ? 'rgba(2, 132, 199, 0.09)' : 'transparent',
              color: activeTab === 'raw' ? '#0369a1' : 'var(--azura-text-muted)',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <Database size={16} weight="bold" />
            <span>Telemetrie Brute ({rawList.length})</span>
          </button>
        </div>

        {/* Barre de Recherche & Boutons Export 3D Tactiles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Recherche */}
          <div style={{ position: 'relative', width: '200px' }}>
            <MagnifyingGlass
              size={15}
              weight="bold"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                border: '1px solid var(--azura-border)',
                backgroundColor: 'var(--azura-bg)',
                color: 'var(--azura-text)',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}
            />
          </div>

          {/* Export CSV */}
          <motion.button
            type="button"
            onClick={exportCSV}
            whileHover={{ y: -1.5, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.97 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 750,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 0 #cbd5e1, 0 3px 6px rgba(0,0,0,0.04)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <DownloadSimple size={15} weight="bold" />
            <span>Export CSV</span>
          </motion.button>

          {/* Export JSON */}
          <motion.button
            type="button"
            onClick={exportJSON}
            whileHover={{ y: -1.5, scale: 1.02 }}
            whileTap={{ y: 1, scale: 0.97 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 750,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 0 #cbd5e1, 0 3px 6px rgba(0,0,0,0.04)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}
          >
            <DownloadSimple size={15} weight="bold" />
            <span>JSON</span>
          </motion.button>
        </div>
      </div>

      {/* Tableau de Donnees */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--azura-border)', color: 'var(--azura-text-muted)' }}>
              <th style={{ padding: '10px 12px', fontWeight: 750 }}>Horodatage</th>
              <th style={{ padding: '10px 12px', fontWeight: 750 }}>Capteur ID</th>
              <th style={{ padding: '10px 12px', fontWeight: 750 }}>Type Equipement</th>
              <th style={{ padding: '10px 12px', fontWeight: 750 }}>Emplacement</th>
              <th style={{ padding: '10px 12px', fontWeight: 750 }}>Valeur</th>
              <th style={{ padding: '10px 12px', fontWeight: 750 }}>Statut / Anomalie</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--azura-text-muted)' }}>
                  Aucune donnee ne correspond aux filtres actuels.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const isAlert = row.status && row.status !== 'NORMAL';
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--azura-border)',
                      backgroundColor: isAlert ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--azura-text)' }}>
                      {row.device_id || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--azura-text-muted)' }}>
                      {row.device_type || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--azura-text-muted)' }}>
                      {row.location || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: isAlert ? '#ef4444' : '#15803d' }}>
                      {row.value != null ? `${Number(row.value).toFixed(2)} ${row.unit || ''}` : '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          backgroundColor: isAlert ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                          color: isAlert ? '#b91c1c' : '#15803d',
                          border: isAlert ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                      >
                        {row.status || 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--azura-border)',
          fontSize: '0.8rem',
          color: 'var(--azura-text-muted)'
        }}
      >
        <span>
          Page {currentPage} sur {totalPages} ({filteredData.length} enregistrements)
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid var(--azura-border)',
              backgroundColor: 'var(--azura-bg)',
              color: 'var(--azura-text)',
              fontSize: '0.78rem',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1
            }}
          >
            Precedent
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid var(--azura-border)',
              backgroundColor: 'var(--azura-bg)',
              color: 'var(--azura-text)',
              fontSize: '0.78rem',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages ? 0.5 : 1
            }}
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
