import { useState, useEffect, useMemo } from 'react';
import {
  BarChart2,
  MapPin,
  Database,
  LogOut,
  Map,
  FileOutput,
  Info,
  Users,
  ShieldAlert,
  Eye
} from 'lucide-react';

import { useApp } from '../../context/AppContext';

import AnalyticsPage from './AnalyticsPage';
import BarangaysPage from './BarangaysPage';
import DataIngestionPage from '../DataIngestion/DataIngestionPage';
import CabuyaoheatmapPage from '../HeatMap/CabuyaoheatmapPage';
import ResultExportPage from './ResultExportPage';
import AboutUsPage from './AboutUsPage';
import Create_Signup_Admin from '../Admin/Create_Signup_Admin';

const NAV = [
  {
    id: 'analytics',
    label: 'Revenue Analytics & Forecast',
    icon: BarChart2
  },
  {
    id: 'districts',
    label: 'District Performance',
    icon: MapPin
  },
  {
    id: 'ingestion',
    label: 'Data Ingestion & Prep',
    icon: Database
  },
  {
    id: 'heatmap',
    label: 'Cabuyao Heatmap',
    icon: Map
  },
  {
    id: 'reports',
    label: 'Reports & Export',
    icon: FileOutput
  },
  {
    id: 'about',
    label: 'About Us',
    icon: Info
  },
  {
    id: 'accounts',
    label: 'Account Management',
    icon: Users,
    adminOnly: true
  }
];

export default function LguLayout() {
  const { currentUser, role, isAdmin, isReadOnly, hasPermission, logout } = useApp();

  // Filter navigation items based on the user's role & user_permissions rows
  const allowedNav = useMemo(() => {
    return NAV.filter(item => {
      if (item.adminOnly && !isAdmin) return false;
      return hasPermission(item.id);
    });
  }, [isAdmin, hasPermission]);

  const [tab, setTab] = useState(() => allowedNav[0]?.id || 'analytics');

  // Ensure active tab is always permitted when switching users/permissions
  useEffect(() => {
    if (allowedNav.length > 0 && !allowedNav.some(n => n.id === tab)) {
      setTab(allowedNav[0].id);
    }
  }, [allowedNav, tab]);

  const roleMeta = {
    admin:   { portalLabel: 'System Admin Portal', badgeBg: '#dbeafe', badgeColor: '#1e40af', title: 'System Administrator' },
    officer: { portalLabel: 'BPLO Officer Portal', badgeBg: '#dcfce7', badgeColor: '#166534', title: 'BPLO Officer' },
    guest:   { portalLabel: 'Guest Viewer Portal', badgeBg: '#f1f5f9', badgeColor: '#475569', title: 'Guest Evaluator' },
  }[role] || { portalLabel: 'TaxPredict Portal', badgeBg: '#f1f5f9', badgeColor: '#475569', title: 'User' };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#f0f4f8'
      }}
    >
      {/* ==================== SIDEBAR ==================== */}
      <div className="sidebar">
        {/* Logo / Header */}
        <div
          style={{
            padding: '20px 16px 12px',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#2563eb', borderRadius: 8, padding: 7 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                TaxPredict
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {roleMeta.portalLabel}
              </div>
            </div>
          </div>
        </div>

        {/* ==================== NAVIGATION ==================== */}
        <nav style={{ padding: '12px 0', flex: 1 }}>
          {allowedNav.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        {/* ==================== SIDEBAR FOOTER ==================== */}
        <div style={{ padding: 16, borderTop: '1px solid #e2e8f0' }}>
          <div
            style={{
              fontSize: 10,
              color: '#94a3b8',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 600
            }}
          >
            Signed in as
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
            {currentUser?.full_name || roleMeta.title}
          </div>

          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, wordBreak: 'break-all' }}>
            {currentUser?.employee_id || currentUser?.email}
          </div>

          <div style={{ marginBottom: 14 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: roleMeta.badgeBg,
                color: roleMeta.badgeColor,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {currentUser?.position || roleMeta.title}
            </span>
          </div>

          {/* Sign Out */}
          <button
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
            onClick={logout}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* ==================== MAIN CONTENT ==================== */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* ==================== TOPBAR ==================== */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
              {NAV.find(n => n.id === tab)?.label}
            </div>
            {isReadOnly && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a'
                }}
              >
                <Eye size={12} /> Read-Only Guest View
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Allowed Views: <strong>{allowedNav.length}</strong>
            </div>
          </div>
        </div>

        {/* ==================== PAGE CONTENT ==================== */}
        <div className="main-area">
          {!hasPermission(tab) ? (
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 40,
                textAlign: 'center',
                maxWidth: 480,
                margin: '60px auto',
                border: '1px solid #e2e8f0'
              }}
            >
              <ShieldAlert size={40} color="#dc2626" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Access Restricted
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                Your account ({roleMeta.title}) does not have permission to view this module.
                Please contact a System Administrator if you require access.
              </p>
            </div>
          ) : (
            <>
              {tab === 'analytics' && <AnalyticsPage />}
              {tab === 'districts' && <BarangaysPage />}
              {tab === 'ingestion' && (
                <DataIngestionPage onVisualize={() => setTab('analytics')} />
              )}
              {tab === 'heatmap' && <CabuyaoheatmapPage variant="internal" />}
              {tab === 'reports' && <ResultExportPage />}
              {tab === 'about' && <AboutUsPage />}
              {tab === 'accounts' && isAdmin && <Create_Signup_Admin embedded />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}