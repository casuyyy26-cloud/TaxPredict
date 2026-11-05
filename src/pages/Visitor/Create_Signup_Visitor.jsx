import { useState } from "react";
import { useApp, DEFAULT_ROLE_PERMISSIONS } from "../../context/AppContext";
import "../../index.css";

export default function Create_Signup_Visitor() {
  const { setScreen, registerAccount } = useApp();

  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    postal: "4025",
    brgy: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    if (e) e.preventDefault();
    setMessage("");

    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
      setMessage("❌ Please fill in Full Name, Email, and Password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setMessage("❌ Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await registerAccount(
        {
          role: "guest",
          full_name: form.name.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          postal_code: form.postal.trim() || "4025",
          barangay: form.brgy.trim(),
          position: "Guest Evaluator",
          password: form.password,
          permissions: DEFAULT_ROLE_PERMISSIONS.guest,
        },
        true // Automatically signs the guest into the portal after registration
      );
      setMessage(`✅ Guest account "${form.name}" created! Entering portal...`);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2 className="signup-title">Create Guest Account</h2>

        {[
          { name: "name", label: "Full Name *", type: "text" },
          { name: "email", label: "Email *", type: "email" },
          { name: "address", label: "Address", type: "text" },
          { name: "postal", label: "Postal Code", type: "text" },
          { name: "brgy", label: "Barangay", type: "text" },
          { name: "password", label: "Password *", type: "password" },
          { name: "confirmPassword", label: "Confirm Password *", type: "password" },
        ].map(({ name, label, type }) => (
          <div key={name} className="form-group">
            <label className="form-label">{label}</label>
            <input
              type={type}
              name={name}
              placeholder={`Enter ${label.replace(" *", "")}`}
              value={form[name]}
              onChange={handleChange}
              className="form-input"
              disabled={loading}
            />
          </div>
        ))}

        <button
          onClick={handleSignup}
          disabled={loading}
          className={`signup-button ${loading ? "loading" : ""}`}
        >
          {loading ? "Saving to Supabase..." : "Sign Up & Enter Portal"}
        </button>

        <button
          onClick={() => setScreen("login")}
          className="back-button"
          style={{ marginTop: "12px" }}
          disabled={loading}
        >
          ⬅ Back to Login
        </button>

        {message && (
          <div className={`signup-message ${message.includes("✅") ? "success" : "error"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}