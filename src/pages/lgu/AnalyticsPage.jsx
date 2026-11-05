import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:5000");

const COLORS = {
  actual: "#15803d",
  actualBorder: "#15803d",
  forecast: "#1d4ed8",
  forecastBorder: "#1d4ed8",
  taxGap: "#dc2626",
  taxGapBorder: "#dc2626",
  highRisk: "#b91c1c",
};

const SIZE_ORDER = ["MICRO", "SMALL", "MEDIUM", "LARGE"];

const PIE_COLOR_MAP = {
  Micro: "#2563eb",
  Small: "#0d9488",
  Medium: "#d97706",
  Large: "#7c3aed",
};

const FALLBACK_PIE_COLORS = ["#2563eb", "#0d9488", "#d97706", "#7c3aed"];

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatMillion = (value) => `₱${toNumber(value).toFixed(1)}M`;

const formatSizeLabel = (raw = "") => {
  const s = String(raw).trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
};

const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "#ffffff",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.14)",
  padding: "12px 16px",
};

const TOOLTIP_LABEL_STYLE = {
  fontSize: "16px",
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: "8px",
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: "6px",
};

const TOOLTIP_ITEM_STYLE = {
  fontSize: "14px",
  fontWeight: 700,
  padding: "3px 0",
};

export default function AnalyticsPage() {
  const [predictions, setPredictions] = useState([]);
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("");
  const [quarter, setQuarter] = useState("SUMMARY");
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingPredictions, setLoadingPredictions] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAnalyticsData = async () => {
      setLoadingYears(true);
      setLoadingPredictions(true);
      setError(null);

      try {
        const [businessesResponse, predictionsResponse] = await Promise.all([
          fetch(`${API_URL}/api/businesses`, { signal: controller.signal }),
          fetch(`${API_URL}/api/predictions?page=1&limit=10000`, {
            signal: controller.signal,
          }),
        ]);

        if (!businessesResponse.ok) {
          throw new Error(`Years request failed: ${businessesResponse.status}`);
        }

        const businessesData = await businessesResponse.json();
        const uniqueYears = [
          ...new Set(
            (businessesData.rows || [])
              .map((row) => Number(row.year))
              .filter((value) => !Number.isNaN(value))
          ),
        ].sort((a, b) => b - a);

        setYears(uniqueYears);

        if (uniqueYears.length > 0) {
          setYear((currentYear) => {
            if (currentYear && uniqueYears.includes(Number(currentYear))) {
              return Number(currentYear);
            }
            return uniqueYears[0];
          });
        }

        if (!predictionsResponse.ok) {
          throw new Error(
            `Predictions request failed: ${predictionsResponse.status}`
          );
        }

        const predictionsData = await predictionsResponse.json();
        setPredictions(predictionsData.rows || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Analytics fetch error:", err);
          setError("Could not load analytics data.");
          setPredictions([]);
        }
      } finally {
        setLoadingYears(false);
        setLoadingPredictions(false);
      }
    };

    fetchAnalyticsData();
    return () => controller.abort();
  }, []);

  const yearPredictions = useMemo(() => {
    return predictions.filter(
      (prediction) => Number(prediction.year) === Number(year)
    );
  }, [predictions, year]);

  const activePredictions = useMemo(() => {
    if (quarter === "SUMMARY") {
      return yearPredictions;
    }
    return yearPredictions.filter(
      (prediction) => prediction.quarter === quarter
    );
  }, [yearPredictions, quarter]);

  const actualRevenue = useMemo(() => {
    return activePredictions.reduce(
      (total, prediction) => total + toNumber(prediction.actual_collected),
      0
    );
  }, [activePredictions]);

  const forecastRevenue = useMemo(() => {
    return activePredictions.reduce(
      (total, prediction) => total + toNumber(prediction.forecasted_revenue),
      0
    );
  }, [activePredictions]);

  const totalGap = useMemo(() => {
    return activePredictions.reduce(
      (total, prediction) => total + toNumber(prediction.actual_tax_gap),
      0
    );
  }, [activePredictions]);

  const taxGapBySize = useMemo(() => {
    const result = {};

    activePredictions.forEach((prediction) => {
      const rawKey = String(prediction.business_size || "UNKNOWN")
        .trim()
        .toUpperCase();
      const displaySize = formatSizeLabel(rawKey);

      if (!result[rawKey]) {
        result[rawKey] = {
          rawKey,
          size: displaySize,
          gap: 0,
          collected: 0,
          forecast: 0,
        };
      }

      result[rawKey].gap += toNumber(prediction.actual_tax_gap) / 1_000_000;
      result[rawKey].collected +=
        toNumber(prediction.actual_collected) / 1_000_000;
      result[rawKey].forecast +=
        toNumber(prediction.forecasted_revenue) / 1_000_000;
    });

    return Object.values(result).sort((a, b) => {
      const idxA = SIZE_ORDER.indexOf(a.rawKey);
      const idxB = SIZE_ORDER.indexOf(b.rawKey);
      if (idxA === -1 && idxB === -1) return a.size.localeCompare(b.size);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [activePredictions]);

  const highRisk = taxGapBySize.filter((item) => item.gap >= 2).length;

  const yearlyRevenue = useMemo(() => {
    return years
      .slice()
      .sort((a, b) => a - b)
      .map((selectedYear) => {
        const rows = predictions.filter(
          (prediction) => Number(prediction.year) === Number(selectedYear)
        );

        const actual = rows.reduce(
          (total, prediction) => total + toNumber(prediction.actual_collected),
          0
        );
        const forecast = rows.reduce(
          (total, prediction) =>
            total + toNumber(prediction.forecasted_revenue),
          0
        );

        return {
          year: selectedYear,
          actual: actual / 1_000_000,
          forecast: forecast / 1_000_000,
        };
      });
  }, [years, predictions]);

  const revenueBySize = useMemo(() => {
    return taxGapBySize
      .filter((item) => item.collected > 0)
      .map((item) => ({
        name: item.size,
        value: Number(item.collected.toFixed(2)),
      }));
  }, [taxGapBySize]);

  const loading = loadingYears || loadingPredictions;
  const periodDisplay = quarter === "SUMMARY" ? `${year}` : `${quarter} ${year}`;

  return (
    <div className="taxpredict-analytics" style={{ position: "relative" }}>
      <style>
        {`
          .taxpredict-analytics .metric-hover-card .metric-cover {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 20px 22px;
            color: #ffffff;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity 0.18s ease, transform 0.18s ease;
            pointer-events: none;
            z-index: 5;
            border-radius: inherit;
          }
          .taxpredict-analytics .metric-hover-card:hover .metric-cover {
            opacity: 1;
            transform: translateY(0);
          }
          .taxpredict-analytics .metric-cover-title {
            font-size: 17px;
            font-weight: 800;
            line-height: 1.25;
            margin-bottom: 8px;
          }
          .taxpredict-analytics .metric-cover-text {
            font-size: 13.5px;
            line-height: 1.5;
            font-weight: 500;
            max-width: 290px;
          }
        `}
      </style>

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
          marginBottom: 20,
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
            onChange={(event) => {
              setYear(Number(event.target.value));
              setQuarter("SUMMARY");
            }}
            disabled={loadingYears || years.length === 0}
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
            {years.map((selectedYear) => (
              <option key={selectedYear} value={selectedYear}>
                {selectedYear}
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
          {["SUMMARY", ...QUARTERS].map((buttonQuarter) => {
            const active = quarter === buttonQuarter;
            return (
              <button
                key={buttonQuarter}
                onClick={() => setQuarter(buttonQuarter)}
                style={{
                  minWidth: 88,
                  justifyContent: "center",
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                  background: active ? "#1d4ed8" : "#ffffff",
                  color: active ? "#ffffff" : "#0f172a",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                {buttonQuarter === "SUMMARY" ? "All" : buttonQuarter}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: "30px 0",
            color: "#334155",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Loading analytics...
        </div>
      ) : (
        <>
          {/* 4 METRIC CARDS */}
          <div className="grid-4" style={{ marginBottom: 22 }}>
            {/* ACTUAL REVENUE */}
            <div
              className="metric metric-hover-card"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                padding: "18px 20px",
                minHeight: 136,
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
                ACTUAL REVENUE
              </div>
              <div
                className="val"
                style={{ color: "#15803d", fontSize: 30, fontWeight: 800 }}
              >
                ₱{(actualRevenue / 1_000_000).toFixed(1)}M
              </div>
              <div
                className="sub"
                style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
              >
                {quarter === "SUMMARY"
                  ? `Annual actual — ${year}`
                  : `Actual collections — ${quarter} ${year}`}
              </div>
              <div className="metric-cover" style={{ background: "#15803d" }}>
                <div className="metric-cover-title">Actual Revenue</div>
                <div className="metric-cover-text">
                  Revenue recorded as actually collected for{" "}
                  {quarter === "SUMMARY" ? `Year ${year}` : `${quarter} ${year}`}.
                </div>
              </div>
            </div>

            {/* FORECAST REVENUE */}
            <div
              className="metric metric-hover-card"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                padding: "18px 20px",
                minHeight: 136,
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
                FORECAST REVENUE
              </div>
              <div
                className="val"
                style={{ color: "#1d4ed8", fontSize: 30, fontWeight: 800 }}
              >
                ₱{(forecastRevenue / 1_000_000).toFixed(1)}M
              </div>
              <div
                className="sub"
                style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
              >
                {quarter === "SUMMARY"
                  ? `Annual forecast — ${year}`
                  : `Forecast — ${quarter} ${year}`}
              </div>
              <div className="metric-cover" style={{ background: "#1d4ed8" }}>
                <div className="metric-cover-title">Forecast Revenue</div>
                <div className="metric-cover-text">
                  Estimated revenue generated by the system's predictive model
                  for {quarter === "SUMMARY" ? `Year ${year}` : `${quarter} ${year}`}.
                </div>
              </div>
            </div>

            {/* TOTAL BUSINESS TAX GAP */}
            <div
              className="metric metric-hover-card"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                padding: "18px 20px",
                minHeight: 136,
                border: "1.5px solid #ef4444",
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
                TOTAL BUSINESS TAX GAP
              </div>
              <div
                className="val"
                style={{ color: "#dc2626", fontSize: 30, fontWeight: 800 }}
              >
                ₱{(totalGap / 1_000_000).toFixed(1)}M
              </div>
              <div
                className="sub"
                style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
              >
                {quarter === "SUMMARY"
                  ? `Annual gap — ${year}`
                  : `${quarter} ${year} potential shortfall`}
              </div>
              <div className="metric-cover" style={{ background: "#dc2626" }}>
                <div className="metric-cover-title">Total Business Tax Gap</div>
                <div className="metric-cover-text">
                  The difference identified by the system between the expected
                  tax amount and the amount actually collected.
                </div>
              </div>
            </div>

            {/* HIGH-RISK SIZES */}
            <div
              className="metric metric-hover-card"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                padding: "18px 20px",
                minHeight: 136,
                border: "1.5px solid #ef4444",
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
                HIGH-RISK SIZES
              </div>
              <div
                className="val"
                style={{ color: "#b91c1c", fontSize: 30, fontWeight: 800 }}
              >
                {highRisk}
              </div>
              <div
                className="sub"
                style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}
              >
                Gap ≥ ₱2M ({periodDisplay})
              </div>
              <div className="metric-cover" style={{ background: "#b91c1c" }}>
                <div className="metric-cover-title">High-Risk Sizes</div>
                <div className="metric-cover-text">
                  Number of business-size categories where the identified tax
                  gap reaches at least ₱2M.
                </div>
              </div>
            </div>
          </div>

          {/* SECTION TITLE */}
          <div
            style={{
              marginBottom: 14,
              fontSize: 16,
              color: "#0f172a",
              fontWeight: 800,
            }}
          >
            {quarter === "SUMMARY"
              ? `Revenue Analysis — ${year}`
              : `Revenue Analysis — ${quarter} ${year}`}
          </div>

          {/* CHART 1: LINE CHART (SUMMARY) OR BAR CHART (QUARTER) */}
          {quarter === "SUMMARY" ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div
                  className="section-title"
                  style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 4 }}
                >
                  Business Tax Revenue — Actual vs Forecast (₱M)
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Yearly revenue performance ({year})
                </div>
              </div>

              <ResponsiveContainer width="100%" height={310}>
                <LineChart data={yearlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 13.5, fontWeight: 700, fill: "#1e293b" }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tick={{ fontSize: 13, fontWeight: 600, fill: "#334155" }}
                    stroke="#94a3b8"
                    label={{
                      value: "₱ Million",
                      angle: -90,
                      position: "insideLeft",
                      style: {
                        fontSize: 13,
                        fontWeight: 700,
                        fill: "#334155",
                      },
                    }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={(label) => `Year ${label}`}
                    formatter={(value, name) => [
                      `₱${toNumber(value).toFixed(1)}M`,
                      name,
                    ]}
                  />
                  <Legend
                    iconType="square"
                    wrapperStyle={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      paddingTop: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={COLORS.actual}
                    strokeWidth={3}
                    dot={{
                      r: 5,
                      fill: COLORS.actual,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 7 }}
                    name="Actual Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke={COLORS.forecast}
                    strokeWidth={3}
                    dot={{
                      r: 5,
                      fill: COLORS.forecast,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 7 }}
                    name="Forecast Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div
                  className="section-title"
                  style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 4 }}
                >
                  {quarter} {year} Revenue — Actual vs Forecast (₱M)
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Quarterly revenue comparison for {quarter} {year}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={310}>
                <BarChart
                  data={[
                    {
                      category: `${quarter} ${year}`,
                      actual: actualRevenue / 1_000_000,
                      forecast: forecastRevenue / 1_000_000,
                    },
                  ]}
                  barCategoryGap="25%"
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 14, fontWeight: 800, fill: "#0f172a" }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tick={{ fontSize: 13, fontWeight: 600, fill: "#334155" }}
                    stroke="#94a3b8"
                    label={{
                      value: "₱ Million",
                      angle: -90,
                      position: "insideLeft",
                      style: {
                        fontSize: 13,
                        fontWeight: 700,
                        fill: "#334155",
                      },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.16)" }}
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={(label) => `${label} Revenue Summary`}
                    formatter={(value, name) => [
                      `₱${toNumber(value).toFixed(1)}M`,
                      name,
                    ]}
                  />
                  <Legend
                    iconType="square"
                    wrapperStyle={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      paddingTop: 8,
                    }}
                  />
                  <Bar
                    dataKey="actual"
                    fill={COLORS.actual}
                    name="Actual Revenue"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="forecast"
                    fill={COLORS.forecast}
                    name="Forecast Revenue"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* CHART 2: TAX GAP VS ACTUAL COLLECTED BY BUSINESS SIZE */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div
                className="section-title"
                style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 4 }}
              >
                Tax Gap vs Actual Collected by Business Size (₱M)
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                {quarter === "SUMMARY"
                  ? `Annual business-size tax gap and collection breakdown for ${year}`
                  : `Business-size tax gap and collection breakdown for ${quarter} ${year}`}
              </div>
            </div>

            {taxGapBySize.length === 0 ? (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#475569",
                  padding: "24px 0",
                  textAlign: "center",
                }}
              >
                No business-size data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={taxGapBySize} barCategoryGap="28%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="size"
                    tick={{ fontSize: 13.5, fontWeight: 700, fill: "#1e293b" }}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    tick={{ fontSize: 13, fontWeight: 600, fill: "#334155" }}
                    stroke="#94a3b8"
                    label={{
                      value: "₱ Million",
                      angle: -90,
                      position: "insideLeft",
                      style: {
                        fontSize: 13,
                        fontWeight: 700,
                        fill: "#334155",
                      },
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.16)" }}
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={(sizeLabel) =>
                      `${sizeLabel} Businesses — ${periodDisplay}`
                    }
                    formatter={(value, name) => [formatMillion(value), name]}
                  />
                  <Legend
                    iconType="square"
                    wrapperStyle={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      paddingTop: 8,
                    }}
                  />
                  <Bar
                    dataKey="collected"
                    fill={COLORS.actual}
                    name="Actual Collected"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="gap"
                    fill={COLORS.taxGap}
                    name="Tax Gap"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* CHART 3: PIE CHART OF ACTUAL REVENUE BY BUSINESS SIZE */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div
                className="section-title"
                style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 4 }}
              >
                {quarter === "SUMMARY"
                  ? `${year} Actual Revenue by Business Size`
                  : `${quarter} ${year} Actual Revenue by Business Size`}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                {quarter === "SUMMARY"
                  ? `Share of actual collected revenue by business size for ${year}`
                  : `Share of actual collected revenue by business size for ${quarter} ${year}`}
              </div>
            </div>

            {revenueBySize.length === 0 ? (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#475569",
                  padding: "24px 0",
                  textAlign: "center",
                }}
              >
                No revenue data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie
                    data={revenueBySize}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={115}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(1)}%`
                    }
                  >
                    {revenueBySize.map((entry, index) => {
                      const fill =
                        PIE_COLOR_MAP[entry.name] ||
                        FALLBACK_PIE_COLORS[index % FALLBACK_PIE_COLORS.length];
                      return (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={fill}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    formatter={(value, name) => [
                      `₱${toNumber(value).toFixed(1)}M (${periodDisplay})`,
                      name,
                    ]}
                  />
                  <Legend
                    iconType="square"
                    wrapperStyle={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      paddingTop: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}