import { useEffect, useMemo, useState } from "react";
import { FileText, FileSpreadsheet, Download } from "lucide-react";

const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:5000");

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );

const peso = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const val = (row, keys) => {
  for (const k of keys) {
    if (row?.[k] !== null && row?.[k] !== undefined && row?.[k] !== "") {
      return Number(row[k]) || 0;
    }
  }
  return 0;
};

const forecastOf = (r) =>
  val(r, ["forecasted_revenue", "forecast_revenue", "predicted_revenue"]);
const collectedOf = (r) =>
  val(r, ["actual_collected", "actual_revenue", "collected_revenue"]);
const gapOf = (r) => val(r, ["actual_tax_gap", "tax_gap"]);

const risk = (gap) =>
  gap === 0
    ? ["No tax gap", "#16a34a"]
    : gap <= 2000000
    ? ["Tax gap", "#b45309"]
    : ["High tax gap", "#dc2626"];

const PRINT_CSS = `
  body{font-family:Segoe UI,Roboto,sans-serif;padding:40px;color:#0f172a}
  h1{font-size:22px;margin:0 0 4px} .sub{color:#64748b;font-size:13px;margin-bottom:24px}
  .cards{display:flex;gap:12px;margin-bottom:24px} .card{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
  .card small{color:#64748b;display:block;margin-bottom:4px} .card b{font-size:18px}
  table{width:100%;border-collapse:collapse;font-size:12px} th{text-align:left;color:#64748b;font-size:11px;background:#f8fafc}
  th,td{padding:9px 10px;border-bottom:1px solid #e2e8f0} .bar{height:8px;border-radius:4px;margin:3px 0}
  @media print{body{padding:16px}}`;

const CHART_CSS = `
  .rep-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:0 0 24px}
  .chart{border:1px solid #e2e8f0;border-radius:10px;padding:14px;break-inside:avoid;background:#fff}
  .chart.wide{grid-column:1/-1}
  .chart h3{font-size:13px;font-weight:700;margin:0 0 8px;color:#0f172a}
  .chart svg{width:100%;height:auto;display:block}
  @media(max-width:900px){.rep-charts{grid-template-columns:1fr}}`;

function printReport(title, filterLabel, rows, bodyHtml) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return alert("Please allow pop-ups to export the report.");
  const totalF = rows.reduce((s, r) => s + forecastOf(r), 0);
  const totalC = rows.reduce((s, r) => s + collectedOf(r), 0);
  const totalG = rows.reduce((s, r) => s + gapOf(r), 0);
  win.document.write(`<html><head><title>${esc(title)}</title><style>${PRINT_CSS}${CHART_CSS}</style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">${esc(filterLabel)} · ${rows.length.toLocaleString()} prediction records · Generated ${new Date().toLocaleDateString("en-PH")}</div>
    <div class="cards">
      <div class="card"><small>Forecasted revenue</small><b>${peso(totalF)}</b></div>
      <div class="card"><small>Actual collected</small><b>${peso(totalC)}</b></div>
      <div class="card"><small>Tax gap</small><b>${peso(totalG)}</b></div>
    </div>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function byPeriod(rows) {
  const g = {};
  rows.forEach((r) => {
    const k = `${r.year} ${String(r.quarter).toUpperCase()}`;
    g[k] ||= { f: 0, c: 0, g: 0 };
    g[k].f += forecastOf(r);
    g[k].c += collectedOf(r);
    g[k].g += gapOf(r);
  });
  return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
}

function byBarangay(rows) {
  const g = {};
  rows.forEach((r) => {
    const k = String(r.barangay || "UNKNOWN").toUpperCase();
    g[k] ||= { n: 0, f: 0, c: 0, g: 0, p: [] };
    g[k].n += 1;
    g[k].f += forecastOf(r);
    g[k].c += collectedOf(r);
    g[k].g += gapOf(r);
    if (r.performance_score !== null && r.performance_score !== undefined) {
      g[k].p.push(Number(r.performance_score));
    }
  });
  return Object.entries(g).sort(([, a], [, b]) => b.g - a.g);
}

const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#db2777",
];
const BLUE = "#2563eb";
const GREEN = "#16a34a";
const RED = "#dc2626";
const short = (n) =>
  n >= 1e6
    ? `₱${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
    ? `₱${(n / 1e3).toFixed(0)}K`
    : `₱${Math.round(n)}`;
const box = (title, inner, wide) =>
  `<div class="chart${wide ? " wide" : ""}"><h3>${esc(title)}</h3>${inner}</div>`;
const empty =
  '<p style="color:#64748b;font-size:13px">Nothing to chart for this selection.</p>';

const legendSvg = (items, x0, y) =>
  items
    .map(
      ([t, c], i) =>
        `<rect x="${x0 + i * 112}" y="${y - 9}" width="10" height="10" rx="2" fill="${c}"/>` +
        `<text x="${x0 + i * 112 + 15}" y="${y}" font-size="11" fill="#475569">${esc(t)}</text>`
    )
    .join("");

function lineChart(periods) {
  if (!periods.length) return empty;
  const W = 640,
    H = 270,
    L = 66,
    R = 22,
    T = 40,
    B = 38;
  const max = Math.max(1, ...periods.flatMap(([, v]) => [v.f, v.c, v.g]));
  const x = (i) =>
    periods.length === 1
      ? (L + W - R) / 2
      : L + (i * (W - L - R)) / (periods.length - 1);
  const y = (n) => T + (H - T - B) * (1 - n / max);
  const series = [
    ["Forecasted", "f", BLUE],
    ["Collected", "c", GREEN],
    ["Tax gap", "g", RED],
  ];
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (s) =>
        `<line x1="${L}" x2="${W - R}" y1="${y(max * s)}" y2="${y(max * s)}" stroke="#e2e8f0"/>` +
        `<text x="${L - 8}" y="${y(max * s) + 4}" font-size="10" text-anchor="end" fill="#64748b">${short(max * s)}</text>`
    )
    .join("");
  const lines = series
    .map(
      ([, k, c]) =>
        `<polyline fill="none" stroke="${c}" stroke-width="2.5" points="${periods.map(([, v], i) => `${x(i)},${y(v[k])}`).join(" ")}"/>` +
        periods
          .map(
            ([, v], i) =>
              `<circle cx="${x(i)}" cy="${y(v[k])}" r="3.5" fill="${c}"/>`
          )
          .join("")
    )
    .join("");
  const labels = periods
    .map(
      ([k], i) =>
        `<text x="${x(i)}" y="${H - 14}" font-size="10" text-anchor="middle" fill="#64748b">${esc(k)}</text>`
    )
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}">${legendSvg(
    series.map(([t, , c]) => [t, c]),
    L,
    16
  )}${grid}${lines}${labels}</svg>`;
}

function periodBars(periods) {
  if (!periods.length) return empty;
  const W = 640,
    H = 270,
    L = 66,
    R = 22,
    T = 40,
    B = 38;
  const max = Math.max(1, ...periods.flatMap(([, v]) => [v.f, v.c]));
  const band = (W - L - R) / periods.length;
  const bw = Math.min(30, band * 0.3);
  const y = (n) => T + (H - T - B) * (1 - n / max);
  const grid = [0, 0.5, 1]
    .map(
      (s) =>
        `<line x1="${L}" x2="${W - R}" y1="${y(max * s)}" y2="${y(max * s)}" stroke="#e2e8f0"/>` +
        `<text x="${L - 8}" y="${y(max * s) + 4}" font-size="10" text-anchor="end" fill="#64748b">${short(max * s)}</text>`
    )
    .join("");
  const bars = periods
    .map(([k, v], i) => {
      const cx = L + band * i + band / 2;
      return (
        `<rect x="${cx - bw - 2}" y="${y(v.f)}" width="${bw}" height="${H - B - y(v.f)}" fill="${BLUE}" rx="2"/>` +
        `<rect x="${cx + 2}" y="${y(v.c)}" width="${bw}" height="${H - B - y(v.c)}" fill="${GREEN}" rx="2"/>` +
        `<text x="${cx}" y="${H - 14}" font-size="10" text-anchor="middle" fill="#64748b">${esc(k)}</text>`
      );
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}">${legendSvg(
    [
      ["Forecasted", BLUE],
      ["Collected", GREEN],
    ],
    L,
    16
  )}${grid}${bars}</svg>`;
}

function barangayBars(list) {
  if (!list.length) return empty;
  const W = 640,
    L = 130,
    R = 78,
    T = 38,
    rowH = 30,
    H = T + list.length * rowH + 8;
  const max = Math.max(1, ...list.flatMap(([, v]) => [v.f, v.c]));
  const w = (n) => ((W - L - R) * n) / max;
  const rows = list
    .map(([k, v], i) => {
      const top = T + i * rowH;
      return (
        `<text x="${L - 8}" y="${top + 15}" font-size="11" text-anchor="end" fill="#334155">${esc(k)}</text>` +
        `<rect x="${L}" y="${top + 3}" width="${w(v.f)}" height="9" rx="2" fill="${BLUE}"/>` +
        `<rect x="${L}" y="${top + 14}" width="${w(v.c)}" height="9" rx="2" fill="${GREEN}"/>` +
        `<text x="${L + w(Math.max(v.f, v.c)) + 6}" y="${top + 21}" font-size="10" fill="#64748b">${short(v.c)}</text>`
      );
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}">${legendSvg(
    [
      ["Forecasted", BLUE],
      ["Collected", GREEN],
    ],
    L,
    16
  )}${rows}</svg>`;
}

function pie(items) {
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((s, i) => s + i.value, 0);
  if (!total) return empty;
  const cx = 100,
    cy = 105,
    r = 85;
  let a = -Math.PI / 2;
  const slices = data
    .map((i) => {
      if (data.length === 1) {
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${i.color}"/>`;
      }
      const ang = (i.value / total) * 2 * Math.PI;
      const [x1, y1] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      a += ang;
      const [x2, y2] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      return `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${x2},${y2} Z" fill="${i.color}" stroke="#fff" stroke-width="2"/>`;
    })
    .join("");
  const key = data
    .map(
      (i, n) =>
        `<rect x="215" y="${28 + n * 24}" width="11" height="11" rx="2" fill="${i.color}"/>` +
        `<text x="233" y="${38 + n * 24}" font-size="12" fill="#334155">${esc(i.label)} · ${Math.round((i.value / total) * 100)}%</text>`
    )
    .join("");
  return `<svg viewBox="0 0 470 ${Math.max(210, 40 + data.length * 24)}">${slices}${key}</svg>`;
}

function gapPie(list) {
  const withGap = list.filter(([, v]) => v.g > 0);
  const top = withGap
    .slice(0, 6)
    .map(([k, v], i) => ({ label: k, value: v.g, color: PALETTE[i] }));
  const rest = withGap.slice(6).reduce((s, [, v]) => s + v.g, 0);
  if (rest > 0) top.push({ label: "Others", value: rest, color: "#94a3b8" });
  return pie(top);
}

function riskPie(list) {
  const n = {};
  list.forEach(([, v]) => {
    const [label, color] = risk(v.g);
    (n[label] ||= { label, value: 0, color }).value += 1;
  });
  return pie(Object.values(n));
}

function analyticsCharts(rows) {
  const periods = byPeriod(rows);
  return (
    box("Revenue trend: all periods (summary)", lineChart(periods), true) +
    box("Forecast vs actual for each period", periodBars(periods)) +
    box("Tax gap share by barangay", gapPie(byBarangay(rows)))
  );
}

function districtCharts(rows) {
  const list = byBarangay(rows);
  return (
    box("Forecast vs actual for each barangay", barangayBars(list), true) +
    box("Barangays by risk level", riskPie(list))
  );
}

function analyticsHtml(rows) {
  const periods = byPeriod(rows);
  return (
    `<div class="rep-charts">${analyticsCharts(rows)}</div>` +
    `<table><thead><tr><th>Period</th><th>Forecasted</th><th>Collected</th><th>Tax gap</th></tr></thead><tbody>${periods
      .map(
        ([k, v]) =>
          `<tr><td><b>${esc(k)}</b></td><td>${peso(v.f)}</td><td>${peso(v.c)}</td><td>${peso(v.g)}</td></tr>`
      )
      .join("")}</tbody></table>`
  );
}

function districtsHtml(rows) {
  return (
    `<div class="rep-charts">${districtCharts(rows)}</div>` +
    `<table><thead><tr><th>Barangay</th><th>Records</th><th>Forecasted</th><th>Collected</th><th>Tax gap</th><th>Performance</th><th>Risk</th></tr></thead><tbody>${byBarangay(
      rows
    )
      .map(([k, v]) => {
        const [label, color] = risk(v.g);
        const perf = v.p.length
          ? `${Math.round(v.p.reduce((s, x) => s + x, 0) / v.p.length)}%`
          : "N/A";
        return `<tr><td><b>${esc(k)}</b></td><td>${v.n}</td><td>${peso(v.f)}</td><td>${peso(v.c)}</td><td>${peso(v.g)}</td><td>${perf}</td>
          <td style="color:${color};font-weight:700">${label}</td></tr>`;
      })
      .join("")}</tbody></table>`
  );
}

export default function ResultExportPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState("ALL");
  const [quarter, setQuarter] = useState("ALL");

  useEffect(() => {
    let live = true;
    fetch(`${API_URL}/api/predictions?limit=10000`)
      .then((res) => {
        if (!res.ok) throw new Error(`Prediction API returned ${res.status}`);
        return res.json();
      })
      .then((result) => {
        const rows = Array.isArray(result)
          ? result
          : result?.predictions || result?.rows || result?.data || [];
        if (live) setData(Array.isArray(rows) ? rows : []);
      })
      .catch(
        (e) =>
          live && setError(`Prediction data could not be loaded. ${e.message}`)
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const years = useMemo(
    () => [...new Set(data.map((r) => r.year).filter(Boolean))].sort((a, b) => b - a),
    [data]
  );

  const rows = useMemo(
    () =>
      data.filter(
        (r) =>
          (year === "ALL" || String(r.year) === year) &&
          (quarter === "ALL" || String(r.quarter).toUpperCase() === quarter)
      ),
    [data, year, quarter]
  );

  const filterLabel = `Year: ${year === "ALL" ? "All" : year} · Quarter: ${
    quarter === "ALL" ? "All" : quarter
  }`;
  const ready = !loading && rows.length > 0;

  const DOCUMENTS = [
    {
      title: "Analytics_Graphs.pdf",
      format: "PDF Report",
      description:
        "Line, bar and pie graphs: forecast vs actual and tax gap.",
      icon: FileText,
      iconBg: "#eff6ff",
      iconColor: "#2563eb",
      onExport: () =>
        printReport("Analytics Graphs", filterLabel, rows, analyticsHtml(rows)),
    },
    {
      title: "Districts_Table.pdf",
      format: "PDF Report",
      description:
        "Bar and pie graphs plus the district compliance and risk table.",
      icon: FileSpreadsheet,
      iconBg: "#dcfce7",
      iconColor: "#16a34a",
      onExport: () =>
        printReport("Districts Table", filterLabel, rows, districtsHtml(rows)),
    },
  ];

  const cell = { padding: "16px 12px", borderBottom: "1px solid #f1f5f9" };
  const head = {
    padding: "12px 12px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        padding: 28,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
        Reports &amp; Export Center
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
        Generate and download statutory fiscal reports and spatial analytics
        documents.
      </div>

      {/* Year / Quarter Filter Box */}
      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginTop: 20,
          padding: 18,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
        }}
      >
        <div style={{ width: 200 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 6,
            }}
          >
            Year
          </div>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={loading}
          >
            <option value="ALL">All years</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: 200 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 6,
            }}
          >
            Quarter
          </div>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            disabled={loading}
          >
            <option value="ALL">All quarters</option>
            {QUARTERS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 13, color: "#64748b", paddingBottom: 9 }}>
          {loading ? (
            <span>Loading prediction data…</span>
          ) : (
            <>
              <b style={{ color: "#0f172a" }}>{rows.length.toLocaleString()}</b>{" "}
              prediction records match
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#fff7ed",
            color: "#c2410c",
            fontSize: 13,
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#b45309" }}>
          No predictions for this selection. Choose another year or quarter, or
          run the prediction first.
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 22 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <th style={head}>DOCUMENT TITLE</th>
              <th style={head}>FORMAT</th>
              <th style={head}>COVERS</th>
              <th style={head}>DESCRIPTION</th>
              <th style={head}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENTS.map((doc) => {
              const Icon = doc.icon;
              return (
                <tr key={doc.title}>
                  <td style={cell}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: doc.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={15} color={doc.iconColor} />
                      </div>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>
                        {doc.title}
                      </span>
                    </div>
                  </td>
                  <td style={cell}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "#dbeafe",
                        color: "#2563eb",
                      }}
                    >
                      {doc.format}
                    </span>
                  </td>
                  <td style={{ ...cell, color: "#64748b" }}>{filterLabel}</td>
                  <td style={{ ...cell, color: "#475569" }}>
                    {doc.description}
                  </td>
                  <td style={cell}>
                    <button
                      onClick={doc.onExport}
                      disabled={!ready}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: ready ? "#1d4ed8" : "#93c5fd",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: ready ? "pointer" : "not-allowed",
                      }}
                    >
                      <Download size={14} /> Export
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}