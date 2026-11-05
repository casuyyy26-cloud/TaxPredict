import { useState, useEffect } from "react";

export default function DistrictsPage() {
  const [districts, setDistricts] = useState([]);
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("ALL");
  const [quarter, setQuarter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const API_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
    process.env.REACT_APP_API_URL ||
    (typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? ""
      : "http://localhost:5000");

  const fetchYears = async () => {
    try {
      const res = await fetch(`${API_URL}/api/businesses`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const uniqueYears = [
        ...new Set(
          (data.rows || [])
            .map((r) => Number(r.year))
            .filter((y) => Number.isFinite(y))
        ),
      ].sort((a, b) => b - a);

      setYears(uniqueYears);
      if (uniqueYears.length > 0 && year === "ALL") {
        setYear(String(uniqueYears[0]));
      }
    } catch (err) {
      console.error("Year fetch error:", err);
      setYears([]);
    }
  };

  const fetchDistricts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "1000");

      if (year !== "ALL") params.set("year", year);
      if (quarter !== "ALL") params.set("quarter", quarter);

      const res = await fetch(`${API_URL}/api/districts?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setDistricts(data.rows || []);
    } catch (err) {
      console.error("District fetch error:", err);
      setDistricts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    fetchDistricts();
  }, [year, quarter]);

  const total = districts.reduce(
    (sum, d) => sum + Number(d.actual_collected || 0),
    0
  );

  const totalBiz = districts.reduce(
    (sum, d) => sum + Number(d.businesses || 0),
    0
  );

  const avgComp = districts.length
    ? (
        districts.reduce(
          (sum, d) => sum + Number(d.performance_score || 0),
          0
        ) / districts.length
      ).toFixed(1)
    : "0.0";

  let periodLabel = "Overall";
  if (year !== "ALL" && quarter !== "ALL") {
    periodLabel = `${year} ${quarter}`;
  } else if (year !== "ALL" && quarter === "ALL") {
    periodLabel = `${year} — All Quarters`;
  } else if (year === "ALL" && quarter !== "ALL") {
    periodLabel = `${quarter} — All Years`;
  }

  return (
    <div className="taxpredict-districts">
      {/* TOP FILTER CARD */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "#0f172a",
            }}
          >
            Year:
          </label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{
              width: 120,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <option value="ALL">Overall</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {["ALL", "Q1", "Q2", "Q3", "Q4"].map((q) => {
            const active = quarter === q;
            return (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                style={{
                  minWidth: 88,
                  justifyContent: "center",
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
                  background: active ? "#2563eb" : "#ffffff",
                  color: active ? "#ffffff" : "#0f172a",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                {q === "ALL" ? "All" : q}
              </button>
            );
          })}
        </div>
      </div>

      {/* PERIOD LABEL */}
      <div
        style={{
          marginBottom: 16,
          color: "#334155",
          fontSize: 14.5,
          fontWeight: 500,
        }}
      >
        Showing district analytics for{" "}
        <strong style={{ color: "#0f172a", fontWeight: 800 }}>
          {periodLabel}
        </strong>
      </div>

      {/* 3 SUMMARY METRICS WITH HOVER COVERS */}
      <div className="grid-3" style={{ marginBottom: 18 }}>
        {/* TOTAL BUSINESS TAX */}
        <div
          className="metric metric-hover-card"
          style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: "18px 22px",
            minHeight: 132,
            border: "1.5px solid #2563eb",
            cursor: "help",
          }}
        >
          <div
            className="lbl"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#334155",
              letterSpacing: "0.04em",
            }}
          >
            TOTAL BUSINESS TAX
          </div>
          <div
            className="val"
            style={{ color: "#2563eb", fontSize: 30, fontWeight: 800 }}
          >
            ₱{total.toFixed(1)}M
          </div>
          <div
            className="sub"
            style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
          >
            Collected across districts ({periodLabel})
          </div>
          <div className="metric-cover" style={{ background: "#1d4ed8" }}>
            <div className="metric-cover-title">Total Business Tax</div>
            <div className="metric-cover-text">
              Total business tax revenue actually collected across all Cabuyao
              districts for {periodLabel}.
            </div>
          </div>
        </div>

        {/* TOTAL REGISTERED BUSINESSES */}
        <div
          className="metric metric-hover-card"
          style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: "18px 22px",
            minHeight: 132,
            border: "1.5px solid #334155",
            cursor: "help",
          }}
        >
          <div
            className="lbl"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#334155",
              letterSpacing: "0.04em",
            }}
          >
            TOTAL REGISTERED BUSINESSES
          </div>
          <div
            className="val"
            style={{ color: "#0f172a", fontSize: 30, fontWeight: 800 }}
          >
            {totalBiz.toLocaleString()}
          </div>
          <div
            className="sub"
            style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
          >
            Active establishments ({periodLabel})
          </div>
          <div className="metric-cover" style={{ background: "#1e293b" }}>
            <div className="metric-cover-title">
              Total Registered Businesses
            </div>
            <div className="metric-cover-text">
              Total number of active registered business establishments tracked
              across all Cabuyao barangays.
            </div>
          </div>
        </div>

        {/* AVERAGE COMPLIANCE RATE */}
        <div
          className="metric metric-hover-card"
          style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: "18px 22px",
            minHeight: 132,
            border: "1.5px solid #22c55e",
            cursor: "help",
          }}
        >
          <div
            className="lbl"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#334155",
              letterSpacing: "0.04em",
            }}
          >
            AVERAGE COMPLIANCE RATE
          </div>
          <div
            className="val"
            style={{ color: "#16a34a", fontSize: 30, fontWeight: 800 }}
          >
            {avgComp}%
          </div>
          <div
            className="sub"
            style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
          >
            District performance average
          </div>
          <div className="metric-cover" style={{ background: "#15803d" }}>
            <div className="metric-cover-title">Average Compliance Rate</div>
            <div className="metric-cover-text">
              Mean tax compliance and collection performance score across all
              monitored Cabuyao districts.
            </div>
          </div>
        </div>
      </div>

      {/* COLLECTION RATE INTERPRETATION */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div
          className="section-title"
          style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}
        >
          Collection Rate Interpretation
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          {[
            {
              color: "#4ade80",
              label: "On Target (≥ 90%)",
              desc: "Business tax collection is meeting or exceeding the ML-predicted target.",
            },
            {
              color: "#fbbf24",
              label: "Below Target (75–89%)",
              desc: "Moderate risk — enforcement follow-up recommended for underperforming sectors.",
            },
            {
              color: "#f87171",
              label: "At Risk (< 75%)",
              desc: "High risk — priority audit and field inspection required in this district.",
            },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                gap: 10,
                padding: "14px 16px",
                background: "#f8fafc",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  width: 13,
                  height: 13,
                  background: c.color,
                  borderRadius: 3,
                  flexShrink: 0,
                  marginTop: 3,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 4,
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#475569",
                    lineHeight: 1.5,
                  }}
                >
                  {c.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DISTRICT TABLE */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "#334155",
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            Loading district analytics…
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>DISTRICT</th>
                  <th style={{ textAlign: "right" }}>BUSINESSES</th>
                  <th style={{ textAlign: "right" }}>ACTUAL REVENUE</th>
                  <th style={{ textAlign: "right" }}>ML TARGET</th>
                  <th>COLLECTION RATE</th>
                  <th style={{ textAlign: "right" }}>COMPLIANCE SCORE</th>
                  <th style={{ textAlign: "center" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {districts.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={{
                        textAlign: "center",
                        padding: 40,
                        color: "#475569",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      No district data available for this selection.
                    </td>
                  </tr>
                ) : (
                  districts.map((d) => {
                    const actual = Number(d.actual_collected || 0);
                    const forecast = Number(d.forecasted_revenue || 0);
                    const performance = Number(d.performance_score || 0);

                    const pct =
                      forecast > 0 ? Math.round((actual / forecast) * 100) : 0;
                    const safePct = Math.max(0, Math.min(100, pct));

                    const barColor =
                      safePct >= 90
                        ? "#22c55e"
                        : safePct >= 75
                        ? "#eab308"
                        : "#ef4444";

                    const compColor =
                      performance >= 90
                        ? "#16a34a"
                        : performance >= 75
                        ? "#d97706"
                        : "#dc2626";

                    const status =
                      performance >= 90
                        ? "ON TARGET"
                        : performance >= 75
                        ? "BELOW TARGET"
                        : "AT RISK";

                    const riskCls =
                      status === "ON TARGET"
                        ? "badge-green"
                        : status === "BELOW TARGET"
                        ? "badge-amber"
                        : "badge-red";

                    const isMeetingTarget = actual >= forecast || pct >= 100;

                    return (
                      <tr key={d.barangay}>
                        <td style={{ fontWeight: 700, color: "#0f172a" }}>
                          {d.barangay}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: "#1e293b",
                            fontWeight: 600,
                          }}
                        >
                          {Number(d.businesses || 0).toLocaleString()}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          ₱
                          {actual.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          <span
                            style={{
                              fontSize: 10.5,
                              color: isMeetingTarget ? "#16a34a" : "#dc2626",
                              marginLeft: 3,
                            }}
                          >
                            {isMeetingTarget ? "▲" : "▼"}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: "#334155",
                            fontWeight: 600,
                          }}
                        >
                          ₱
                          {forecast.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </td>
                        <td style={{ minWidth: 170 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                height: 7,
                                background: "#e2e8f0",
                                borderRadius: 999,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${safePct}%`,
                                  background: barColor,
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: "#334155",
                                minWidth: 40,
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: compColor,
                          }}
                        >
                          {performance.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge ${riskCls}`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}