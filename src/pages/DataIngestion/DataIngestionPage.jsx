import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:5000");

const SIZE_COLORS = {
  MICRO: "#2563eb",
  SMALL: "#7c3aed",
  MEDIUM: "#d97706",
  LARGE: "#dc2626",
};

const SIZES = ["SMALL", "MEDIUM", "LARGE", "MICRO"];
const DEFAULT_CATEGORIES = ["RETAIL", "WHOLESALE", "SERVICES", "MANUFACTURING"];
const STATUS_OPTIONS = ["RENEW", "NEW"];
const STATUS_LABELS = {
  RENEW: "FOR RENEWAL (RENEW)",
  NEW: "NEW BUSINESS (NEW)",
};
const BARANGAYS = [
  "BACLARAN",
  "BANAY-BANAY",
  "BANLIC",
  "BIGAA",
  "BUTONG",
  "CASILE",
  "DIEZMO",
  "GULOD",
  "MAMATID",
  "MARINIG",
  "NIUGAN",
  "PITTLAND",
  "PULO",
  "SALA",
  "SAN ISIDRO",
  "BARANGAY UNO",
  "BARANGAY DOS",
  "BARANGAY TRES",
];

const STEPS = ["1. Ingest Dataset", "2. Data & Stats"];
const NO_FILTERS = { size: [], category: [], barangay: [], compliance: [] };

const label = (v = "") => v.toString().replace(/_/g, " ").toUpperCase();
const sorted = (o = {}) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const num = (n) => Number(n || 0).toLocaleString();

async function api(path, init, fallback = "Something went wrong.") {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method: "POST", ...init });
  } catch {
    throw new Error(
      `Can't reach the server at ${API_URL || window.location.origin}. Check that the backend is running.`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.message || fallback), {
      list: data.errors,
    });
  }
  return data;
}

export default function DataIngestionPage({ onVisualize }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [pairs, setPairs] = useState([]);
  const [drag, setDrag] = useState(false);
  const [step, setStep] = useState(1);
  const [stats, setStats] = useState(null);
  const [allDbRows, setAllDbRows] = useState([]);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [applied, setApplied] = useState(NO_FILTERS);
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");

  const [openFilterGroups, setOpenFilterGroups] = useState({
    size: false,
    category: false,
    barangay: false,
    compliance: false,
  });

  const [openStatBoxes, setOpenStatBoxes] = useState({
    size: true,
    category: true,
    barangay: true,
    matrix: true,
  });

  const toggleFilterGroup = (key) =>
    setOpenFilterGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleStatBox = (key) =>
    setOpenStatBoxes((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    fetch(`${API_URL}/api/businesses`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.total > 0) {
          setRows(data.total);
          setAllDbRows(data.rows || []);
          fetch(`${API_URL}/api/businesses/stats-summary`)
            .then((res) => res.json())
            .then((d) => {
              if (d.stats) {
                setStats(d.stats);
                const dbCats = Object.keys(d.stats.by_category || {});
                if (dbCats.length > 0) {
                  setCategories(dbCats.map((c) => c.toUpperCase()));
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const toggle = (key, value) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }));

  const activeCount = Object.values(filters).reduce(
    (acc, v) => acc + v.length,
    0
  );
  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);

  const matches = useMemo(() => {
    if (!pairs.length) return rows;
    return pairs.filter(
      (r) =>
        (!filters.size.length || filters.size.includes(r.business_size)) &&
        (!filters.category.length ||
          filters.category.includes(r.business_category))
    ).length;
  }, [pairs, rows, filters.size, filters.category]);

  const reset = () => {
    setFile(null);
    setPairs([]);
    setStep(1);
    setFilters(NO_FILTERS);
    setApplied(NO_FILTERS);
    setErrors([]);
    setMessage("");
    setBusy("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const run = async (name, task) => {
    setBusy(name);
    setErrors([]);
    try {
      await task();
    } catch (e) {
      setErrors(e.list || [e.message]);
    } finally {
      setBusy("");
    }
  };

  const pick = (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) {
      return setErrors([
        "That file type isn't supported. Upload a .csv or .xlsx file.",
      ]);
    }
    setErrors([]);
    setFile(f);
    setRows(null);
    setBusy("preview");
    const body = new FormData();
    body.append("file", f);
    api("/api/businesses/preview", { body })
      .then((d) => {
        setRows(d.total_rows ?? null);
        if (d.available_categories?.length) {
          setCategories(d.available_categories);
        }
        setPairs(d.size_category_pairs || []);
      })
      .catch(() => {})
      .finally(() => setBusy(""));
  };

  const applyFiltersToExistingDb = () => {
    if (!allDbRows.length) return;
    const filtered = allDbRows.filter((r) => {
      const sz = String(r.business_size || "").toUpperCase();
      const cat = String(r.business_category || "").toUpperCase();
      const brgy = String(r.barangay || "").toUpperCase();
      const rawComp = String(r.compliance_status || "").toUpperCase();
      const comp = rawComp === "FULL" || rawComp.startsWith("RENEW") ? "RENEW" : "NEW";

      return (
        (!filters.size.length || filters.size.includes(sz)) &&
        (!filters.category.length || filters.category.includes(cat)) &&
        (!filters.barangay.length || filters.barangay.includes(brgy)) &&
        (!filters.compliance.length || filters.compliance.includes(comp))
      );
    });

    const by_size = {};
    const by_category = {};
    const by_barangay = {};
    const matrixMap = {};
    let renewCount = 0,
      newCount = 0;

    filtered.forEach((r) => {
      const sz = String(r.business_size || "UNKNOWN").toUpperCase();
      const cat = String(r.business_category || "UNKNOWN").toUpperCase();
      const brgy = String(r.barangay || "UNKNOWN").toUpperCase();
      const rawComp = String(r.compliance_status || "").toUpperCase();
      const comp = rawComp === "FULL" || rawComp.startsWith("RENEW") ? "RENEW" : "NEW";

      by_size[sz] = (by_size[sz] || 0) + 1;
      by_category[cat] = (by_category[cat] || 0) + 1;
      by_barangay[brgy] = (by_barangay[brgy] || 0) + 1;

      if (comp === "RENEW") renewCount++;
      else newCount++;

      if (!matrixMap[brgy]) {
        matrixMap[brgy] = {
          barangay: brgy,
          MICRO: 0,
          SMALL: 0,
          MEDIUM: 0,
          LARGE: 0,
          total: 0,
        };
      }
      if (["MICRO", "SMALL", "MEDIUM", "LARGE"].includes(sz)) {
        matrixMap[brgy][sz]++;
      }
      matrixMap[brgy].total++;
    });

    setStats({
      total: filtered.length,
      renew: renewCount,
      new_business: newCount,
      full: renewCount,
      partial: newCount,
      delinquent: 0,
      by_size,
      by_category,
      by_barangay,
      barangay_size_matrix: Object.values(matrixMap).sort((a, b) =>
        a.barangay.localeCompare(b.barangay)
      ),
    });
    setApplied(filters);
  };

  const process = () => {
    if (!file && allDbRows.length > 0) {
      applyFiltersToExistingDb();
      setStep(2);
      return;
    }
    if (!file) return;

    run("process", async () => {
      const body = new FormData();
      body.append("file", file);
      const send = (list) =>
        list.length === 0
          ? "ALL"
          : list.length === 1
          ? list[0]
          : JSON.stringify(list);
      body.append("business_size", send(filters.size));
      body.append("business_category", send(filters.category));
      body.append("barangay", send(filters.barangay));
      body.append("compliance_status", send(filters.compliance));
      const d = await api(
        "/api/businesses/upload",
        { body },
        "The dataset could not be processed."
      );
      setStats(d.stats);
      setApplied(filters);
      setMessage("");
      setStep(2);
    });
  };

  const predict = () =>
    run("predict", async () => {
      const d = await api(
        "/api/predictions/generate",
        { headers: { "Content-Type": "application/json" } },
        "The data was saved, but the prediction model failed to run."
      );
      setMessage(d.message || "Predictions were generated and saved.");
    });

  const s = stats || {};
  const matrix = s.barangay_size_matrix || [];

  const visualize = () => {
    if (onVisualize) return onVisualize();
    setErrors(["The Visualization button isn't connected yet."]);
  };

  return (
    <div className="card di-panel">
      <div className="di-title">Data Ingestion &amp; Preprocessing Panel</div>
      <div className="di-sub">
        Upload municipal tax records, sanitize entries, and prepare data for ML
        model training.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 14,
          marginTop: 20,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        {STEPS.map((t, i) => {
          const stepNum = i + 1;
          const isClickable =
            stepNum === 1 || (stepNum === 2 && (rows > 0 || stats));
          const isActive = step === stepNum;
          return (
            <div
              key={t}
              onClick={() => {
                if (stepNum === 2 && (rows > 0 || stats)) setStep(2);
                else if (stepNum === 1) setStep(1);
              }}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: isClickable ? "pointer" : "default",
                background: isActive ? "#1d4ed8" : "#f8fafc",
                color: isActive ? "#ffffff" : "#2563eb",
                border: isActive ? "1px solid #1d4ed8" : "1px solid #bfdbfe",
                transition: "all 0.15s ease",
              }}
            >
              {t}
            </div>
          );
        })}

        <button
          type="button"
          className="btn-primary"
          onClick={visualize}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            fontWeight: 700,
            background: "#1d4ed8",
          }}
        >
          <BarChart3 size={15} /> Visualization
        </button>
      </div>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 16,
          }}
        >
          Filter Options
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px 28px",
          }}
        >
          <FilterAccordion
            title="Business Size"
            options={SIZES}
            selected={filters.size}
            isOpen={openFilterGroups.size}
            onToggleOpen={() => toggleFilterGroup("size")}
            onToggleOption={(v) => toggle("size", v)}
          />

          <FilterAccordion
            title="Business Category"
            options={categories}
            selected={filters.category}
            isOpen={openFilterGroups.category}
            onToggleOpen={() => toggleFilterGroup("category")}
            onToggleOption={(v) => toggle("category", v)}
          />

          <FilterAccordion
            title="Barangay"
            options={BARANGAYS}
            selected={filters.barangay}
            isOpen={openFilterGroups.barangay}
            onToggleOpen={() => toggleFilterGroup("barangay")}
            onToggleOption={(v) => toggle("barangay", v)}
          />

          <FilterAccordion
            title="Business Status (New / Renewal)"
            options={STATUS_OPTIONS}
            customLabels={STATUS_LABELS}
            selected={filters.compliance}
            isOpen={openFilterGroups.compliance}
            onToggleOpen={() => toggleFilterGroup("compliance")}
            onToggleOption={(v) => toggle("compliance", v)}
          />
        </div>

        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            marginTop: 18,
            paddingTop: 14,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
          }}
        >
          {step === 1 && matches != null && file && (
            <span className="di-note" style={{ marginRight: "auto" }}>
              {num(matches)} rows match size &amp; category
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setFilters(NO_FILTERS);
              if (step === 2 && allDbRows.length > 0 && !file) {
                fetch(`${API_URL}/api/businesses/stats-summary`)
                  .then((r) => r.json())
                  .then((d) => d.stats && setStats(d.stats));
                setApplied(NO_FILTERS);
              }
            }}
            disabled={activeCount === 0 && !dirty}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 8,
            }}
          >
            Reset filters
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={process}
            disabled={(!dirty && step === 2) || busy !== ""}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              fontWeight: 600,
              background: "#1d4ed8",
            }}
          >
            {busy === "process" ? (
              <>
                <Loader2 size={14} className="di-spin" /> Applying…
              </>
            ) : (
              "Apply filters"
            )}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="di-err">
          <AlertCircle size={18} />
          <div>
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />

          <div
            className={`file-drop di-drop ${drag ? "drag" : ""} ${
              file ? "has" : ""
            }`}
            onClick={() => !file && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
          >
            {file ? (
              <div className="file-row di-file">
                <FileSpreadsheet size={28} color="#2563eb" />
                <div className="grow">
                  <div className="di-fn">{file.name}</div>
                  <div className="di-fm">
                    {(file.size / 1024).toFixed(0)} KB
                    {busy === "preview"
                      ? " · reading file…"
                      : rows != null
                      ? ` · ${num(rows)} rows found`
                      : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-sm"
                  title="Remove file"
                  onClick={reset}
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div>
                <UploadCloud size={32} strokeWidth={1.8} color="#2563eb" />
                <div className="di-drop-t">
                  {drag
                    ? "Drop your file to upload"
                    : "Upload Municipal Tax Dataset (.CSV or .XLSX)"}
                </div>
                <div className="di-note">
                  Drag and drop historical business permit and gross sales tax
                  collections.
                </div>
              </div>
            )}
          </div>

          <div className="di-row">
            <span className="di-note">
              Only rows matching your filters are processed and saved.
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={process}
              disabled={!file || busy !== "" || matches === 0}
            >
              {busy === "process" ? (
                <>
                  <Loader2 size={16} className="di-spin" /> Processing…
                </>
              ) : (
                <>
                  Proceed to Process <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </>
      )}

      {step === 2 && stats && (
        <>
          <div style={{ marginBottom: 14 }}>
            <span
              className="badge badge-green"
              style={{ fontSize: 11.5, padding: "4px 10px", fontWeight: 700 }}
            >
              {num(s.total)} records
            </span>
          </div>

          <div className="di-stack">
            <div className="grid-3">
              {[
                ["TOTAL RECORDS", s.total, "#0f172a"],
                ["FOR RENEWAL (RENEW)", s.renew ?? s.full ?? 0, "#16a34a"],
                ["NEW BUSINESSES (NEW)", s.new_business ?? s.partial ?? 0, "#2563eb"],
              ].map(([t, v, c]) => (
                <div
                  key={t}
                  className="metric"
                  style={{ background: "#f8fafc", borderRadius: 10 }}
                >
                  <div className="lbl" style={{ fontWeight: 600 }}>
                    {t}
                  </div>
                  <div
                    className="val"
                    style={{ color: c, fontSize: 26, fontWeight: 800 }}
                  >
                    {num(v)}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-2">
              <CollapsibleStatBox
                title="Business Size"
                data={s.by_size}
                isOpen={openStatBoxes.size}
                onToggle={() => toggleStatBox("size")}
                color={(k) => SIZE_COLORS[k] || "#2563eb"}
              />
              <CollapsibleStatBox
                title="Business Category"
                data={s.by_category}
                isOpen={openStatBoxes.category}
                onToggle={() => toggleStatBox("category")}
                color={() => "#2563eb"}
              />
            </div>

            <CollapsibleStatBox
              title="Barangay"
              data={s.by_barangay}
              isOpen={openStatBoxes.barangay}
              onToggle={() => toggleStatBox("barangay")}
              color={() => "#7c3aed"}
              maxHeight={460}
            />

            {matrix.length > 0 && (
              <div
                className="card"
                style={{ padding: 0, overflow: "hidden", borderRadius: 10 }}
              >
                <button
                  type="button"
                  onClick={() => toggleStatBox("matrix")}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    background: "#ffffff",
                    border: "none",
                    borderBottom: openStatBoxes.matrix
                      ? "1px solid #e2e8f0"
                      : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  <span>Businesses per barangay, by size</span>
                  {openStatBoxes.matrix ? (
                    <ChevronUp size={18} color="#64748b" />
                  ) : (
                    <ChevronDown size={18} color="#64748b" />
                  )}
                </button>

                {openStatBoxes.matrix && (
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          {[
                            "BARANGAY",
                            "MICRO",
                            "SMALL",
                            "MEDIUM",
                            "LARGE",
                            "TOTAL",
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map((r) => (
                          <tr key={r.barangay}>
                            <td>
                              <b>{label(r.barangay)}</b>
                            </td>
                            {["MICRO", "SMALL", "MEDIUM", "LARGE"].map((k) => (
                              <td key={k}>{num(r[k])}</td>
                            ))}
                            <td>
                              <b>{num(r.total)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {message && (
            <div className="di-ok">
              <CheckCircle2 size={18} /> {message}
            </div>
          )}

          <div className="di-row di-foot">
            <button type="button" onClick={reset}>
              <RefreshCw size={14} /> Upload another
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={predict}
              disabled={busy !== ""}
              style={{ background: "#1d4ed8", fontWeight: 600 }}
            >
              {busy === "predict" ? (
                <>
                  <Loader2 size={15} className="di-spin" /> Running model…
                </>
              ) : (
                <>
                  <Database size={15} /> Run Prediction
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FilterAccordion({
  title,
  options,
  customLabels = {},
  selected,
  isOpen,
  onToggleOpen,
  onToggleOption,
}) {
  return (
    <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
      <button
        type="button"
        onClick={onToggleOpen}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: "6px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
            {title}
          </span>
          {selected.length > 0 && (
            <span
              style={{
                background: "#dbeafe",
                color: "#1d4ed8",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {selected.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp size={16} color="#64748b" />
        ) : (
          <ChevronDown size={16} color="#64748b" />
        )}
      </button>

      {isOpen && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 16px",
            marginTop: 10,
            paddingTop: 4,
          }}
        >
          {options.map((o) => (
            <label
              key={o}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#475569",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={() => onToggleOption(o)}
                style={{
                  width: 15,
                  height: 15,
                  accentColor: "#1d4ed8",
                  cursor: "pointer",
                }}
              />
              {customLabels[o] || label(o)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleStatBox({
  title,
  data,
  isOpen,
  onToggle,
  color,
  maxHeight = 240,
}) {
  const entries = sorted(data);
  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", borderRadius: 10 }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "16px 20px",
          background: "#ffffff",
          border: "none",
          borderBottom: isOpen ? "1px solid #e2e8f0" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 15,
          fontWeight: 700,
          color: "#0f172a",
          cursor: "pointer",
        }}
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp size={18} color="#64748b" />
        ) : (
          <ChevronDown size={18} color="#64748b" />
        )}
      </button>

      {isOpen && (
        <div
          style={{
            padding: "14px 20px",
            maxHeight,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {entries.length === 0 && <div className="di-note">No data</div>}
          {entries.map(([k, v]) => (
            <div key={k} className="di-li">
              <span
                className="di-dot"
                style={{ background: color(k) || "#64748b" }}
              />
              <span
                className="n"
                style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}
              >
                {label(k)}
              </span>
              <b style={{ fontSize: 12.5, color: "#0f172a" }}>{num(v)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}