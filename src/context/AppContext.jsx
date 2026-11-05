import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? ''
    : 'http://localhost:5000');

export const ALL_SYSTEM_PAGES = [
  { id: 'analytics', label: 'Revenue Analytics & Forecast', description: 'View ML revenue predictions and quarterly trends' },
  { id: 'districts', label: 'District Performance',         description: 'View barangay tax gap and collection performance' },
  { id: 'ingestion', label: 'Data Ingestion & Prep',        description: 'Upload datasets, clean records, and trigger ML training' },
  { id: 'heatmap',   label: 'Cabuyao Heatmap',              description: 'Interactive GIS spatial tax compliance map' },
  { id: 'reports',   label: 'Reports & Export',             description: 'Generate and export CSV/PDF assessment reports' },
  { id: 'about',     label: 'About Us',                     description: 'System documentation and project information' },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  admin:   ['analytics', 'districts', 'ingestion', 'heatmap', 'reports', 'about', 'accounts'],
  officer: ['analytics', 'districts', 'ingestion', 'heatmap', 'reports', 'about'],
  guest:   ['analytics', 'districts', 'heatmap', 'about'],
};

// Maps legacy or display names in user_permissions to LguLayout tab IDs
const PAGE_KEY_ALIASES = {
  analytics: 'analytics',
  dashboard: 'analytics',
  forecasting: 'analytics',
  districts: 'districts',
  compliance: 'districts',
  ingestion: 'ingestion',
  heatmap: 'heatmap',
  map: 'heatmap',
  reports: 'reports',
  about: 'about',
  accounts: 'accounts',
};

const INITIAL_APPS = [
  {
    id:'BP-2024-001', bname:'Dela Cruz Sari-Sari Store', owner:'Maria Dela Cruz',
    ownerId:'taxpayer-001',
    type:'New Permit', date:'Jun 2, 2024', status:'For Inspection',
    district:'District 3 – Langkaan', capital:125000, nature:'Retail Trade', phase:3,
    address:'Block 5 Lot 12, Langkaan I, Dasmariñas', contact:'09171234567',
    email:'mdelacruz@email.com', orgType:'Sole Proprietorship (DTI)',
    docs:{ dti_sec:true, bir:true, lease:true, site_photos:true, cedula:true },
    docStatus:{ dti_sec:'accepted', bir:'accepted', lease:'accepted', site_photos:'accepted', cedula:'accepted' },
    remarks:'', taxDue:null,
    inspectionDate:'2024-06-18', inspectionTime:'10:00 AM', inspectionResult:'',
    clearances:{ cenro:'Cleared', sanitary:'Cleared', building:'Pending' },
    phaseHistory:[
      { phase:0, label:'Submitted',        date:'Jun 2, 2024',  note:'Application received.' },
      { phase:1, label:'Compliance Check', date:'Jun 3, 2024',  note:'Documents forwarded to CENRO and Sanitary.' },
      { phase:2, label:'Compliance Check', date:'Jun 5, 2024',  note:'All clearances secured. Ready for inspection.' },
    ],
  },
  {
    id:'BP-2024-002', bname:'Santos Construction Supply', owner:'Jose Santos',
    ownerId:'taxpayer-002',
    type:'Renewal', date:'Jun 5, 2024', status:'Under Review',
    district:'District 1 – Paliparan', capital:850000, nature:'Construction & Contracting', phase:2,
    address:'Lot 3 Blk 8, Paliparan III, Dasmariñas', contact:'09189876543',
    email:'jsantos@email.com', orgType:'Corporation (SEC)',
    docs:{ dti_sec:true, bir:true, lease:false, site_photos:true, cedula:true },
    docStatus:{ dti_sec:'accepted', bir:'accepted', lease:'missing', site_photos:'pending', cedula:'pending' },
    remarks:'', taxDue:null, inspectionDate:'', inspectionTime:'', inspectionResult:'',
    clearances:{ cenro:'Cleared', sanitary:'Cleared', building:'Pending' },
    phaseHistory:[
      { phase:0, label:'Submitted', date:'Jun 5, 2024', note:'Application received.' },
    ],
  },
];

export const CURRENT_TAXPAYER = {
  id: 'taxpayer-001',
  name: 'Maria Dela Cruz',
};

const AppContext = createContext(null);

function roleToScreen(role) {
  if (role === 'admin') return 'admin';
  if (role === 'officer' || role === 'lgu') return 'lgu';
  return 'guest';
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('taxpredict_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [screen, setScreen] = useState(() => {
    try {
      const saved = localStorage.getItem('taxpredict_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return roleToScreen(parsed.role);
      }
    } catch {}
    return 'login';
  });

  const [apps, setApps] = useState(INITIAL_APPS);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('taxpredict_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('taxpredict_user');
      }
    } catch {}
  }, [currentUser]);

  function updateApp(id, changes) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a));
  }

  function addApp(app) {
    setApps(prev => [app, ...prev]);
  }

  async function login({ identifier, password, role }) {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role }),
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      throw new Error(data.message || 'Authentication failed.');
    }
    const userObj = data.user;
    setCurrentUser(userObj);
    setScreen(roleToScreen(userObj.role));
    return userObj;
  }

  async function loginAsGuest() {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'guest', identifier: '', password: '' }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        setScreen('guest');
        return data.user;
      }
    } catch {}
    const fallbackGuest = {
      user_id: 0,
      role: 'guest',
      full_name: 'Guest Evaluator',
      email: 'guest@taxpredict.local',
      employee_id: 'GUEST',
      position: 'Public / Guest Viewer',
      barangay: 'All',
      permissions: DEFAULT_ROLE_PERMISSIONS.guest,
    };
    setCurrentUser(fallbackGuest);
    setScreen('guest');
    return fallbackGuest;
  }

  async function registerAccount(payload, autoLogin = false) {
    const res = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
      throw new Error(data.message || 'Registration failed.');
    }
    if (autoLogin && data.user) {
      setCurrentUser(data.user);
      setScreen(roleToScreen(data.user.role));
    }
    return data.user;
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem('taxpredict_user');
    setScreen('login');
  }

  const hasPermission = useCallback((pageKey) => {
    if (!currentUser) return false;
    const role = currentUser.role || 'guest';
    if (role === 'admin') return true;

    const rawKey = String(pageKey || '').trim().toLowerCase();
    const canonicalKey = PAGE_KEY_ALIASES[rawKey] || rawKey;

    // Hard security restrictions by role
    if (role === 'guest' && ['ingestion', 'reports', 'accounts'].includes(canonicalKey)) {
      return false;
    }
    if (role === 'officer' && canonicalKey === 'accounts') {
      return false;
    }

    const rawPerms = Array.isArray(currentUser.permissions) && currentUser.permissions.length > 0
      ? currentUser.permissions
      : DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.guest;

    const normalizedPerms = rawPerms.map(
      p => PAGE_KEY_ALIASES[String(p).trim().toLowerCase()] || String(p).trim().toLowerCase()
    );

    return normalizedPerms.includes(canonicalKey) || normalizedPerms.includes(rawKey);
  }, [currentUser]);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/users`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load users.');
    return data.users || [];
  }, []);

  const updateUserAccount = useCallback(async (userId, updates) => {
    const res = await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update user.');
    if (currentUser && currentUser.user_id === userId && data.user) {
      setCurrentUser(data.user);
    }
    return data.user;
  }, [currentUser]);

  const deleteUserAccount = useCallback(async (userId) => {
    const res = await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete user.');
    return true;
  }, []);

  const role = currentUser?.role || 'guest';
  const isReadOnly = role === 'guest';
  const isAdmin = role === 'admin';
  const isOfficer = role === 'officer' || role === 'lgu';

  return (
    <AppContext.Provider value={{
      screen,
      setScreen,
      apps,
      updateApp,
      addApp,
      currentUser,
      setCurrentUser,
      role,
      isAdmin,
      isOfficer,
      isReadOnly,
      permissions: currentUser?.permissions || DEFAULT_ROLE_PERMISSIONS[role] || [],
      hasPermission,
      login,
      loginAsGuest,
      registerAccount,
      logout,
      fetchUsers,
      updateUserAccount,
      deleteUserAccount,
      API_BASE,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}