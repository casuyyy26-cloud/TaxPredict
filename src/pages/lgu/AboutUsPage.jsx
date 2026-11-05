import {
  Building2,
  TrendingUp,
  MapPinned,
  Layers,
  ShieldCheck,
  Users,
  MapPin,
  Mail,
} from "lucide-react";

const MODULES = [
  {
    n: "1.",
    icon: TrendingUp,
    title: "Revenue Forecasting",
    desc: "Machine learning models applied to LGU datasets to predict monthly and annual business tax collections for Cabuyao.",
  },
  {
    n: "2.",
    icon: MapPinned,
    title: "Spatial Analytics",
    desc: "Barangay-level visualization of compliance gaps and localized revenue discrepancies across Cabuyao districts.",
  },
  {
    n: "3.",
    icon: Layers,
    title: "Dual-Platform System",
    desc: "Role-based responsive Web UI for BPLO administrators and guest taxpayers, localized for Cabuyao.",
  },
  {
    n: "4.",
    icon: ShieldCheck,
    title: "System Quality & Security",
    desc: "Evaluation under ISO/IEC 25010, usability audits, and compliance with RA 10173 (Data Privacy Act).",
  },
];

const SCOPE_ITEMS = [
  {
    label: "Target Entity",
    text: "City of Cabuyao Business Permit & Licensing Office (BPLO).",
  },
  {
    label: "Geographic Scope",
    text: "All barangays within the City of Cabuyao municipal boundary.",
  },
  {
    label: "Target Users",
    text: "BPLO office administrators and guest taxpayers.",
  },
  {
    label: "Deployment Platforms",
    text: "Responsive Web Dashboard (Admin/Guest portals).",
  },
];

const COMPLIANCE_ITEMS = [
  {
    label: "RA 10173 (Data Privacy Act)",
    text: "Anonymization of sensitive taxpayer records in public-facing analytics.",
  },
  {
    label: "Local Tax Code Compliance",
    text: "Aligned with Cabuyao municipal ordinance schedules and assessment workflows.",
  },
  {
    label: "Role-Based Access Control (RBAC)",
    text: "Separation of guest taxpayer views and BPLO administrator audit data.",
  },
  {
    label: "Audit Logging",
    text: "System-wide tracking of activities and verification for transparency.",
  },
];

const cardStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 24,
};

export default function AboutUsPage() {
  return (
    <div>
      {/* Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)",
          borderRadius: 14,
          padding: "30px 32px",
          color: "#fff",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.16)",
              borderRadius: 8,
              padding: 7,
              display: "flex",
            }}
          >
            <Building2 size={16} color="#fff" />
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              opacity: 0.9,
            }}
          >
            CITY GOVERNMENT OF CABUYAO — TAXPREDICT FRAMEWORK
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
          Predictive Revenue Analytics &amp; Spatial Insights
        </div>
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.65,
            opacity: 0.92,
            maxWidth: 820,
          }}
        >
          TaxPredict focuses on predictive revenue forecasting and
          barangay-level spatial analytics to help the City of Cabuyao
          transition from static record-keeping to proactive, data-driven
          revenue governance. The system is designed specifically for BPLO
          administrators and guest taxpayers in Cabuyao.
        </div>
      </div>

      {/* Core Modules */}
      <div
        style={{
          fontSize: 14.5,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 14,
        }}
      >
        System Architecture &amp; Core Modules
      </div>
      <div className="grid-4" style={{ gap: 16, marginBottom: 24 }}>
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title} style={cardStyle}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Icon size={17} color="#2563eb" />
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                {m.n} {m.title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "#64748b",
                  lineHeight: 1.55,
                }}
              >
                {m.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scope + Compliance */}
      <div className="grid-2" style={{ gap: 16, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 16,
            }}
          >
            Project Scope &amp; Boundaries
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {SCOPE_ITEMS.map((item) => (
              <li
                key={item.label}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 12.5,
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "#2563eb", marginTop: 1 }}>•</span>
                <span>
                  <strong style={{ color: "#0f172a" }}>{item.label}:</strong>{" "}
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 16,
            }}
          >
            Statutory Compliance &amp; Data Privacy
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {COMPLIANCE_ITEMS.map((item) => (
              <li
                key={item.label}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 12.5,
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "#2563eb", marginTop: 1 }}>•</span>
                <span>
                  <strong style={{ color: "#0f172a" }}>{item.label}:</strong>{" "}
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Governance & Contact */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 18,
          }}
        >
          Project Governance &amp; BPLO Contact
        </div>
        <div className="grid-3" style={{ gap: 24 }}>
          <ContactBlock icon={Users} title="Research & Engineering Team">
            <div style={{ color: "#334155" }}>Zen D. Velasquez</div>
            <div style={{ color: "#334155" }}>John Casey S. Sumaoang</div>
            <div style={{ color: "#334155" }}>Reynald L. Landicho</div>
            <div style={{ color: "#94a3b8", marginTop: 4 }}>
              Adviser: Prof. Jonalyn G. Ebron
            </div>
          </ContactBlock>

          <ContactBlock icon={MapPin} title="Office Address">
            <div style={{ color: "#334155" }}>
              Business Permit &amp; Licensing Office
            </div>
            <div style={{ color: "#334155" }}>
              City Hall Building, F. Bailon St.
            </div>
            <div style={{ color: "#334155" }}>
              City of Cabuyao, Laguna 4025
            </div>
          </ContactBlock>

          <ContactBlock icon={Mail} title="Support Channels">
            <div style={{ color: "#334155" }}>bplo@cabuyao.gov.ph</div>
            <div style={{ color: "#334155" }}>
              Mon – Fri 8:00 AM – 5:00 PM
            </div>
          </ContactBlock>
        </div>
      </div>
    </div>
  );
}

function ContactBlock({ icon: Icon, title, children }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 10,
        }}
      >
        <Icon size={15} color="#2563eb" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}