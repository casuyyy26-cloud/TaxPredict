import { useState, useEffect } from "react";
import { UserPlus, Trash2, Save, RefreshCw, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { useApp, ALL_SYSTEM_PAGES, DEFAULT_ROLE_PERMISSIONS } from "../../context/AppContext";
import "../../index.css";

export default function AdminCreateBPLO({ embedded = false }) {
  const {
    setScreen,
    registerAccount,
    fetchUsers,
    updateUserAccount,
    deleteUserAccount,
    currentUser,
  } = useApp();

  const [form, setForm] = useState({
    role: "officer",
    full_name: "",
    email: "",
    employee_id: "",
    position: "BPLO Assessment Officer",
    barangay: "Poblacion Uno",
    password: "",
    confirmPassword: "",
    permissions: DEFAULT_ROLE_PERMISSIONS.officer,
  });

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, []);

  const handleRoleSelect = (newRole) => {
    const defaultPos =
      newRole === "admin"
        ? "IT / System Administrator"
        : newRole === "officer"
        ? "BPLO Assessment Officer"
        : "Guest Evaluator";
    setForm((prev) => ({
      ...prev,
      role: newRole,
      position: defaultPos,
      permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS.guest,
    }));
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleFormPage = (pageId) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(pageId)
        ? prev.permissions.filter((p) => p !== pageId)
        : [...prev.permissions, pageId],
    }));
  };

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!form.full_name.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
      setMessage({ type: "error", text: "Please fill in Full Name, Email, and Password." });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (form.permissions.length === 0) {
      setMessage({ type: "error", text: "Please grant access to at least one page." });
      return;
    }

    setCreating(true);
    try {
      await registerAccount(
        {
          role: form.role,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          employee_id: form.employee_id.trim() || null,
          position: form.position.trim(),
          barangay: form.barangay.trim(),
          password: form.password,
          permissions: form.permissions,
        },
        false
      );

      setMessage({
        type: "success",
        text: `Account "${form.full_name}" (${form.role.toUpperCase()}) created in Supabase!`,
      });

      setForm({
        role: "officer",
        full_name: "",
        email: "",
        employee_id: "",
        position: "BPLO Assessment Officer",
        barangay: "Poblacion Uno",
        password: "",
        confirmPassword: "",
        permissions: DEFAULT_ROLE_PERMISSIONS.officer,
      });

      await loadAllUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const toggleExistingUserPerm = (userId, pageId) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.user_id !== userId) return u;
        const currentPerms = u.permissions || [];
        const updated = currentPerms.includes(pageId)
          ? currentPerms.filter((p) => p !== pageId)
          : [...currentPerms, pageId];
        return { ...u, permissions: updated, _dirty: true };
      })
    );
  };

  const handleRoleChangeExisting = (userId, newRole) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.user_id !== userId) return u;
        return {
          ...u,
          role: newRole,
          permissions: DEFAULT_ROLE_PERMISSIONS[newRole] || DEFAULT_ROLE_PERMISSIONS.guest,
          _dirty: true,
        };
      })
    );
  };

  const handleSaveUser = async (u) => {
    setSavingId(u.user_id);
    setMessage({ type: "", text: "" });
    try {
      await updateUserAccount(u.user_id, {
        role: u.role,
        full_name: u.full_name,
        email: u.email,
        employee_id: u.employee_id,
        position: u.position,
        barangay: u.barangay,
        permissions: u.permissions,
      });
      setMessage({ type: "success", text: `Updated permissions for ${u.full_name}.` });
      await loadAllUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (u) => {
    if (currentUser && u.user_id === currentUser.user_id) {
      setMessage({ type: "error", text: "You cannot delete your own active Admin account." });
      return;
    }
    if (!window.confirm(`Delete account "${u.full_name}" (${u.email})?`)) return;

    try {
      await deleteUserAccount(u.user_id);
      setMessage({ type: "success", text: `Deleted account ${u.full_name}.` });
      await loadAllUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  };

  return (
    <div style={{ padding: embedded ? "8px 4px" : "32px", maxWidth: 1200, margin: "0 auto" }}>
      {!embedded && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setScreen("admin")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ⬅ Back to Dashboard
          </button>
        </div>
      )}

      {/* Status Alert */}
      {message.text && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 20,
            background: message.type === "success" ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            color: message.type === "success" ? "#065f46" : "#dc2626",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>
        {/* LEFT CARD: CREATE ACCOUNT */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <UserPlus size={20} color="#2563eb" />
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Create User Account
            </h3>
          </div>

          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Account Role</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { id: "officer", label: "BPLO Officer" },
                  { id: "admin", label: "Admin" },
                  { id: "guest", label: "Guest" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRoleSelect(r.id)}
                    style={{
                      padding: "8px 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 8,
                      cursor: "pointer",
                      border: form.role === r.id ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      background: form.role === r.id ? "#eff6ff" : "#fff",
                      color: form.role === r.id ? "#1d4ed8" : "#475569",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                name="full_name"
                placeholder="e.g. Juan Dela Cruz"
                value={form.full_name}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                name="email"
                placeholder="e.g. officer@cabuyao.gov.ph"
                value={form.email}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label className="form-label">Employee ID</label>
                <input
                  type="text"
                  name="employee_id"
                  placeholder="BPLO-2026-002"
                  value={form.employee_id}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Position / Title</label>
                <input
                  type="text"
                  name="position"
                  placeholder="BPLO Officer"
                  value={form.position}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Confirm *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            {/* Allowed Pages Checkboxes */}
            <div style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ marginBottom: 6, display: "block" }}>
                Allowed Views (`user_permissions`)
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  background: "#f8fafc",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                {ALL_SYSTEM_PAGES.map((page) => {
                  const isRestrictedForGuest =
                    form.role === "guest" && (page.id === "ingestion" || page.id === "reports");
                  return (
                    <label
                      key={page.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        color: isRestrictedForGuest ? "#94a3b8" : "#1e293b",
                        cursor: isRestrictedForGuest ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={isRestrictedForGuest || form.role === "admin"}
                        checked={
                          form.role === "admin"
                            ? true
                            : form.permissions.includes(page.id) && !isRestrictedForGuest
                        }
                        onChange={() => toggleFormPage(page.id)}
                      />
                      <span>{page.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: 11 }}
            >
              {creating ? "Saving to Supabase..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* RIGHT CARD: EXISTING ACCOUNTS & PERMISSIONS MATRIX */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={20} color="#2563eb" />
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Active Accounts & View Permissions ({users.length})
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  Toggle checkboxes to grant or revoke views per account in real time
                </p>
              </div>
            </div>

            <button
              onClick={loadAllUsers}
              disabled={loadingUsers}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>User / ID</th>
                  <th style={{ padding: "10px 8px" }}>Role</th>
                  {ALL_SYSTEM_PAGES.map((p) => (
                    <th key={p.id} style={{ padding: "10px 6px", textAlign: "center", fontSize: 11 }}>
                      {p.id.charAt(0).toUpperCase() + p.id.slice(1)}
                    </th>
                  ))}
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isRowAdmin = u.role === "admin";
                  const isRowGuest = u.role === "guest";
                  return (
                    <tr key={u.user_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {u.employee_id ? `${u.employee_id} · ` : ""}
                          {u.email}
                        </div>
                      </td>

                      <td style={{ padding: "10px 8px" }}>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChangeExisting(u.user_id, e.target.value)}
                          style={{
                            padding: "4px 6px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="officer">BPLO Officer</option>
                          <option value="guest">Guest</option>
                        </select>
                      </td>

                      {ALL_SYSTEM_PAGES.map((page) => {
                        const blockedForGuest =
                          isRowGuest && (page.id === "ingestion" || page.id === "reports");
                        const checked = isRowAdmin
                          ? true
                          : (u.permissions || []).includes(page.id) && !blockedForGuest;
                        return (
                          <td key={page.id} style={{ padding: "10px 6px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              disabled={isRowAdmin || blockedForGuest}
                              checked={checked}
                              onChange={() => toggleExistingUserPerm(u.user_id, page.id)}
                            />
                          </td>
                        );
                      })}

                      <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => handleSaveUser(u)}
                          disabled={savingId === u.user_id}
                          title="Save Changes"
                          style={{
                            padding: "5px 10px",
                            marginRight: 6,
                            borderRadius: 6,
                            border: "none",
                            background: u._dirty ? "#2563eb" : "#e2e8f0",
                            color: u._dirty ? "#fff" : "#475569",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Save size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                          {savingId === u.user_id ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete Account"
                          style={{
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={13} style={{ verticalAlign: "middle" }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && !loadingUsers && (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                      No accounts found in Supabase.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}