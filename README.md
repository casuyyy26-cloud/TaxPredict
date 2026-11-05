# TaxPredict — LGU Business Tax Portal

AI-powered business permit application, document tracking, and revenue forecasting
for the City of Dasmariñas Business Permit & Licensing Office (BPLO).

---

## File Structure

```
taxpredict/
├── public/
│   └── index.html                        # HTML entry point
├── src/
│   ├── index.js                          # React entry point
│   ├── index.css                         # Global styles
│   ├── App.jsx                           # Root router (login / taxpayer / lgu)
│   │
│   ├── context/
│   │   └── AppContext.jsx                # Global state (apps, screen, updateApp)
│   │
│   ├── data/
│   │   └── mockData.js                   # All mock data (collections, sectors, districts)
│   │
│   ├── components/
│   │   └── Shared.jsx                    # StatusBadge, PhaseTracker, RiskBadge
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx                 # Shared login (taxpayer / LGU toggle)
│   │   │
│   │   ├── taxpayer/                     # ── TAXPAYER PORTAL ──
│   │   │   ├── TaxpayerLayout.jsx        # Sidebar + nav wrapper
│   │   │   ├── TaxpayerDashboard.jsx     # Dashboard: status cards, notifications
│   │   │   ├── ApplyPermit.jsx           # 4-step permit application form
│   │   │   ├── MyApplications.jsx        # Application list + detail view
│   │   │   └── RevenueTransparency.jsx   # Public revenue charts (read-only)
│   │   │
│   │   └── lgu/                          # ── LGU OFFICER PORTAL ──
│   │       ├── LguLayout.jsx             # Sidebar + nav wrapper
│   │       ├── ApplicationsPage.jsx      # App table + review/approve/reject
│   │       ├── AnalyticsPage.jsx         # Forecast chart, tax gap, what-if calc
│   │       ├── AnomalyPage.jsx           # ML anomaly detection alerts
│   │       └── DistrictsPage.jsx         # District performance table
│
└── package.json
```

---

## Setup & Run

### Requirements

- Node.js v16 or higher
- npm v8 or higher

### Install & Start

```bash
cd taxpredict
npm install
npm start
```

The app opens at **http://localhost:3000**

### Build for Production

```bash
npm run build
```

Output goes to the `build/` folder — deploy to any static host (Nginx, Vercel, Netlify).

---

## Demo Credentials

No real authentication — click **Sign In** on either portal to enter.

| Portal            | Use case                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| Business Taxpayer | Apply for permits, upload documents, track status                         |
| LGU Officer       | Review applications, schedule inspections, approve/reject, view analytics |

---

## Features

### Taxpayer Portal

- Dashboard with live application status tracker
- 4-step Unified Application Form (permit type → business info → document upload → review)
- Document uploads: DTI/SEC, BIR Form 2303, Lease Contract, Site Photos, CTC
- My Applications with per-phase tracker and BPLO remarks
- Revenue Transparency page (public business tax data)

### LGU Officer Portal

- Application management table with search & filter
- Per-application review panel: schedule inspection, set tax assessment, update clearances, approve/reject
- Revenue Analytics: ML forecast vs actual, tax gap by sector, what-if policy simulator
- AI Anomaly Detection: ML-flagged business tax irregularities
- District Performance: collection rates, compliance, risk levels

---

## Tech Stack

| Library       | Purpose              |
| ------------- | -------------------- |
| React 18      | UI framework         |
| Recharts      | Revenue & gap charts |
| Lucide React  | Icons                |
| react-scripts | CRA build toolchain  |

No backend required — all state is managed in React context with mock data.

Package Version

---

blinker 1.9.0
click 8.5.0
cloudpickle 3.1.2
et_xmlfile 2.0.0
Flask 3.1.3
flask-cors 6.0.5
itsdangerous 2.2.0
Jinja2 3.1.6
joblib 1.6.0
MarkupSafe 3.0.4
narwhals 2.27.1
numpy 2.5.4
openpyxl 3.1.5
pandas 3.0.6
pip 26.2.1
psycopg2-binary 2.9.13
python-dateutil 2.9.0.post0
python-dotenv 1.2.4
scikit-learn 1.9.1
scipy 1.18.1
six 1.17.0
SQLAlchemy 2.1.4
threadpoolctl 3.7.0
typing_extensions 4.16.0
tzdata 2026.5
Werkzeug 3.1.9
