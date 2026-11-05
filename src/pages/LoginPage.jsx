import { useState } from 'react';
import { ShieldCheck, FileText, BarChart2, AlertCircle, Eye, EyeOff, UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { setScreen, login, loginAsGuest } = useApp();
  const [tab, setTab]         = useState('lgu');
  const [user, setUser]       = useState('');
  const [pass, setPass]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const switchTab = (newTab) => {
    setTab(newTab);
    setError('');
    setUser('');
    setPass('');
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const trimmedUser = user.trim();
    if (!trimmedUser || !pass) {
      setError(
        tab === 'guest'
          ? 'Please enter your registered guest email and password.'
          : 'Please enter your employee ID or official email and password.'
      );
      return;
    }

    setLoading(true);
    try {
      const targetRole = tab === 'lgu' ? 'officer' : tab;
      await login({
        identifier: trimmedUser,
        password: pass,
        role: targetRole,
      });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantGuest = async () => {
    setError('');
    setLoading(true);
    try {
      await loginAsGuest();
    } catch (err) {
      console.error('Guest login error:', err);
      setError('Unable to start guest session. Please ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#f0f4f8' }}>
      {/* Left branding panel */}
      <div style={{
        flex:1, background:'linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)',
        display:'flex', flexDirection:'column', justifyContent:'center',
        padding:'60px 56px', color:'#fff',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:48 }}>
          <div style={{ background:'rgba(255,255,255,.15)', borderRadius:12, padding:10 }}>
            <BarChart2 size={28} />
          </div>
          <div>
            <div style={{ fontSize:22, fontWeight:700 }}>TaxPredict</div>
            <div style={{ fontSize:13, opacity:.75 }}>City of Cabuyao — BPLO</div>
          </div>
        </div>
        <h1 style={{ fontSize:32, fontWeight:700, lineHeight:1.25, marginBottom:16 }}>
          Business Tax Portal
        </h1>
        <p style={{ fontSize:15, opacity:.85, lineHeight:1.6, marginBottom:36, maxWidth:420 }}>
          Secure AI-powered business tax compliance tracking, spatial tax gap analysis,
          and machine learning revenue forecasting for the Local Government Unit.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:420, background:'rgba(255,255,255,0.08)', padding:20, borderRadius:12, border:'1px solid rgba(255,255,255,0.14)' }}>
          <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, opacity:0.8 }}>
            Role-Based Access Control (RBAC)
          </div>
          <div style={{ fontSize:13, lineHeight:1.5, opacity:0.9 }}>
            <strong>• Admin:</strong> Full revenue analytics, ML data ingestion, and secure user permission management.<br/>
            <strong>• BPLO Officer:</strong> Operational tax assessments, spatial GIS maps, and dataset management.<br/>
            <strong>• Guest:</strong> Read-only evaluation access to aggregated dashboards and forecasts.
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{ width:480, display:'flex', flexDirection:'column', justifyContent:'center', padding:'48px 48px', background:'#fff' }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:24, fontWeight:700, color:'#0f172a', marginBottom:6 }}>Sign in</h2>
          <p style={{ fontSize:14, color:'#64748b' }}>Select your portal and enter your secure credentials</p>
        </div>

        {/* Portal toggle */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, background:'#f1f5f9', borderRadius:10, padding:4, marginBottom:24 }}>
          {[
            { id:'lgu',   label:'BPLO Officer', icon:ShieldCheck },
            { id:'admin', label:'Admin',        icon:FileText },
            { id:'guest', label:'Guest',        icon:BarChart2 },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => switchTab(id)} style={{
              border:'none', borderRadius:8, padding:'10px 10px', cursor:'pointer',
              background: tab === id ? '#fff' : 'transparent',
              color:      tab === id ? '#2563eb' : '#64748b',
              fontWeight: tab === id ? 600 : 500,
              boxShadow:  tab === id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontSize:13, transition:'all .15s',
            }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Error Validation Banner */}
        {error && (
          <div style={{
            display:'flex', alignItems:'flex-start', gap:10, background:'#fef2f2',
            border:'1px solid #fecaca', color:'#dc2626', borderRadius:8,
            padding:'12px 14px', marginBottom:18, fontSize:13, lineHeight:1.4,
          }}>
            <AlertCircle size={18} style={{ flexShrink:0, marginTop:1 }} />
            <div style={{ fontWeight: 500 }}>{error}</div>
          </div>
        )}

        {/* Forms per tab */}
        <form onSubmit={handleSignIn}>
          {tab === 'lgu' && (
            <>
              <div className="form-full" style={{ marginBottom:14 }}>
                <div className="form-label">Employee ID or Official Email</div>
                <input
                  type="text"
                  placeholder="e.g. BPLO-2024-001 or officer@cabuyao.gov.ph"
                  value={user}
                  onChange={e => { setUser(e.target.value); setError(''); }}
                  disabled={loading}
                />
              </div>
              <div className="form-full" style={{ marginBottom:20 }}>
                <div className="form-label">Password</div>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => { setPass(e.target.value); setError(''); }}
                    disabled={loading}
                    style={{ width:'100%', paddingRight:38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:4,
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width:'100%', justifyContent:'center', padding:12, opacity: loading ? 0.7 : 1, display:'flex', alignItems:'center', gap:8 }}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Verifying Credentials...' : 'Sign in as BPLO Officer'}
              </button>
            </>
          )}

          {tab === 'admin' && (
            <>
              <div className="form-full" style={{ marginBottom:14 }}>
                <div className="form-label">Admin Employee ID or Email</div>
                <input
                  type="text"
                  placeholder="e.g. ADM-2026-001 or admin@cabuyao.gov.ph"
                  value={user}
                  onChange={e => { setUser(e.target.value); setError(''); }}
                  disabled={loading}
                />
              </div>
              <div className="form-full" style={{ marginBottom:20 }}>
                <div className="form-label">Password</div>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => { setPass(e.target.value); setError(''); }}
                    disabled={loading}
                    style={{ width:'100%', paddingRight:38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:4,
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width:'100%', justifyContent:'center', padding:12, opacity: loading ? 0.7 : 1, display:'flex', alignItems:'center', gap:8 }}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Verifying Credentials...' : 'Sign in as System Admin'}
              </button>
            </>
          )}

          {tab === 'guest' && (
            <>
              <div className="form-full" style={{ marginBottom:14 }}>
                <div className="form-label">Registered Guest Email</div>
                <input
                  type="email"
                  placeholder="e.g. guest@email.com"
                  value={user}
                  onChange={e => { setUser(e.target.value); setError(''); }}
                  disabled={loading}
                />
              </div>
              <div className="form-full" style={{ marginBottom:20 }}>
                <div className="form-label">Password</div>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => { setPass(e.target.value); setError(''); }}
                    disabled={loading}
                    style={{ width:'100%', paddingRight:38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:4,
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width:'100%', justifyContent:'center', padding:12, opacity: loading ? 0.7 : 1, display:'flex', alignItems:'center', gap:8 }}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Authenticating...' : 'Sign in with Guest Account'}
              </button>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
                <button
                  type="button"
                  onClick={() => setScreen('signup')}
                  disabled={loading}
                  style={{
                    width:'100%', justifyContent:'center', padding:'10px 12px',
                    background:'#f8fafc', color:'#1e40af', border:'1px solid #bfdbfe',
                    borderRadius:8, fontWeight:600, fontSize:12, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6,
                  }}
                >
                  <UserPlus size={14} /> Register Guest
                </button>
                <button
                  type="button"
                  onClick={handleInstantGuest}
                  disabled={loading}
                  style={{
                    width:'100%', justifyContent:'center', padding:'10px 12px',
                    background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe',
                    borderRadius:8, fontWeight:600, fontSize:12, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6,
                  }}
                >
                  Quick Guest View <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </form>

        <div style={{ marginTop:32, fontSize:12, color:'#94a3b8', textAlign:'center' }}>
          Business Permits & Licensing Office · City of Cabuyao
        </div>
      </div>
    </div>
  );
}