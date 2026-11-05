import { Check } from 'lucide-react';
import { PHASES } from '../data/mockData';

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Approved':          'badge-green',
  'Released':          'badge-green',
  'Under Review':      'badge-blue',
  'For Inspection':    'badge-amber',
  'Pending Documents': 'badge-red',
  'Assessment':        'badge-purple',
  'Rejected':          'badge-gray',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] || 'badge-gray'}`}>
      {status}
    </span>
  );
}

// ── Phase Tracker ─────────────────────────────────────────────────────────────
export function PhaseTracker({ phase }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:0, margin:'18px 0' }}>
      {PHASES.map((label, i) => {
        const done   = i < phase;
        const active = i === phase;
        return (
          <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
            {i < PHASES.length - 1 && (
              <div style={{
                position:'absolute', top:13, left:'50%', width:'100%', height:2,
                background: done ? '#16a34a' : '#e2e8f0', zIndex:0,
              }} />
            )}
            <div style={{
              width:28, height:28, borderRadius:'50%', zIndex:1,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700,
              background: done ? '#16a34a' : active ? '#2563eb' : '#e2e8f0',
              color:       done || active ? '#fff' : '#94a3b8',
              border: active ? '2px solid #2563eb' : done ? '2px solid #16a34a' : '2px solid #e2e8f0',
            }}>
              {done ? <Check size={12} /> : i + 1}
            </div>
            <div style={{
              fontSize:10, marginTop:6, textAlign:'center', maxWidth:64,
              color:      done ? '#16a34a' : active ? '#2563eb' : '#94a3b8',
              fontWeight: active ? 600 : 500,
            }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Risk Badge ────────────────────────────────────────────────────────────────
export function RiskBadge({ risk }) {
  const map = { low:'badge-green', medium:'badge-amber', high:'badge-red' };
  return <span className={`badge ${map[risk]}`}>{risk.toUpperCase()}</span>;
}

// ── Sidebar Layout ────────────────────────────────────────────────────────────
export function SidebarLayout({ navItems, activeTab, onTabChange, role, userName, notifications, children }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f0f4f8' }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ padding:'20px 16px 12px', borderBottom:'1px solid #e2e8f0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ background:'#2563eb', borderRadius:8, padding:7 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>TaxPredict</div>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                {role === 'lgu' ? 'LGU Officer Portal' : 'Taxpayer Portal'}
              </div>
            </div>
          </div>
        </div>

        <nav style={{ padding:'12px 0', flex:1 }}>
          {navItems.map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => onTabChange(id)}>
              <Icon size={17} />
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding:16, borderTop:'1px solid #e2e8f0' }}>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600 }}>Signed in as</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{userName}</div>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:12 }}>
            {role === 'lgu' ? 'BPLO Officer' : 'Business Taxpayer'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div className="topbar">
          <div style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>
            {navItems.find(n => n.id === activeTab)?.label}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {role === 'lgu' && (
              <span className="badge badge-blue" style={{ fontSize:11 }}>ML Active · 92.4% accuracy</span>
            )}
            <div style={{ position:'relative', cursor:'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {notifications > 0 && (
                <span style={{ position:'absolute', top:-5, right:-5, width:17, height:17, background:'#dc2626', borderRadius:'50%', fontSize:10, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                  {notifications}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="main-area">{children}</div>
      </div>
    </div>
  );
}
