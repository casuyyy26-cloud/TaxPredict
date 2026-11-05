import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import cabuyaoGeojson from "./cabuyao-barangays.geojson.json";
import cabuyaoMask from "./cabuyao-mask.geojson.json";

const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? ""
    : "http://localhost:5000");

const COLORS = {
  none: {
    fill: "#86efac",
    border: "#22c55e",
    badge: "#dcfce7",
    text: "#15803d",
    label: "NO TAX GAP",
  },
  gap: {
    fill: "#fcd34d",
    border: "#f59e0b",
    badge: "#fef3c7",
    text: "#b45309",
    label: "TAX GAP",
  },
  high: {
    fill: "#fca5a5",
    border: "#ef4444",
    badge: "#fee2e2",
    text: "#dc2626",
    label: "HIGH TAX GAP",
  },
  noData: {
    fill: "#e2e8f0",
    border: "#cbd5e1",
    badge: "#f1f5f9",
    text: "#64748b",
    label: "NO DATA",
  },
};

function normalizeName(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/^barangay\s+/i, "")
    .replace(/^brgy\.\s*/i, "")
    .replace(/^brgy\s+/i, "")
    .replace(/\s+/g, " ");
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `₱${number.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatMillions(value) {
  const number = Number(value || 0);
  if (number >= 1000000) {
    return `₱${(number / 1000000).toFixed(2)}M`;
  }
  if (number >= 1000) {
    return `₱${(number / 1000).toFixed(1)}K`;
  }
  return `₱${number.toLocaleString("en-PH")}`;
}

function getStatus(gap) {
  const value = Number(gap || 0);
  if (value === 0) return "none";
  if (value <= 2000000) return "gap";
  return "high";
}

function getBarangayName(feature) {
  const properties = feature?.properties || {};
  return (
    properties.adm4_en ||
    properties.brgy_name ||
    properties.BRGY_NAME ||
    properties.barangay ||
    properties.BARANGAY ||
    properties.name ||
    "Unknown Barangay"
  );
}

function FitBounds({ geojson }) {
  const map = useMap();

  useEffect(() => {
    if (!geojson) return;
    try {
      const layer = L.geoJSON(geojson);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          paddingTopLeft: [25, 40],
          paddingBottomRight: [25, 40],
          maxZoom: 13,
        });
      } else {
        map.setView([14.275, 121.125], 12);
      }

      map.setMaxBounds([
        [14.17, 121.05],
        [14.35, 121.2],
      ]);
      map.setMinZoom(11);
    } catch (error) {
      console.error("Unable to fit Cabuyao map bounds:", error);
      map.setView([14.275, 121.125], 12);
    }
  }, [geojson, map]);

  return null;
}

export default function CabuyaoheatmapPage() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    let mounted = true;

    async function loadPredictions() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/api/predictions?limit=10000`);
        if (!response.ok) {
          throw new Error(`Prediction API returned ${response.status}`);
        }

        const result = await response.json();
        const rows = Array.isArray(result)
          ? result
          : result?.predictions || result?.rows || result?.data || [];

        if (mounted) {
          setPredictions(Array.isArray(rows) ? rows : []);
        }
      } catch (err) {
        console.error("Prediction loading error:", err);
        if (mounted) {
          setPredictions([]);
          setError(
            "Prediction data could not be loaded. Showing the Cabuyao map without prediction values."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPredictions();
    return () => {
      mounted = false;
    };
  }, []);

  const barangayLookup = useMemo(() => {
    const grouped = {};

    predictions.forEach((row) => {
      const barangay =
        row?.barangay ||
        row?.barangay_name ||
        row?.brgy_name ||
        row?.BRGY_NAME ||
        row?.Barangay ||
        "";

      const key = normalizeName(barangay);
      if (!key) return;

      if (!grouped[key]) {
        grouped[key] = {
          barangay: barangay || key,
          actualGap: 0,
          historicalGap: 0,
          forecastedRevenue: 0,
          actualCollected: 0,
          performanceValues: [],
          recordCount: 0,
        };
      }

      const item = grouped[key];
      item.actualGap += Number(
        row?.actual_tax_gap ?? row?.tax_gap ?? row?.taxGap ?? 0
      );
      item.historicalGap += Number(
        row?.previous_tax_gap ??
          row?.previous_actual_tax_gap ??
          row?.historical_tax_gap ??
          row?.prior_tax_gap ??
          0
      );
      item.forecastedRevenue += Number(
        row?.forecasted_revenue ??
          row?.forecast_revenue ??
          row?.predicted_revenue ??
          row?.forecast ??
          0
      );
      item.actualCollected += Number(
        row?.actual_collected ??
          row?.actual_revenue ??
          row?.collected_revenue ??
          row?.revenue_collected ??
          0
      );

      const performance =
        row?.performance_score ?? row?.performance ?? row?.performanceScore;
      if (
        performance !== null &&
        performance !== undefined &&
        performance !== ""
      ) {
        item.performanceValues.push(Number(performance));
      }

      item.recordCount += 1;
    });

    Object.values(grouped).forEach((item) => {
      if (item.performanceValues.length > 0) {
        const total = item.performanceValues.reduce((s, v) => s + v, 0);
        item.performance = Math.round(total / item.performanceValues.length);
      } else {
        item.performance = null;
      }
      delete item.performanceValues;
      item.status = getStatus(item.actualGap);
    });

    return grouped;
  }, [predictions]);

  const geojson = useMemo(() => cabuyaoGeojson, []);

  const barangays = useMemo(() => {
    if (!geojson?.features) return [];

    return geojson.features
      .map((feature) => {
        const name = getBarangayName(feature);
        const key = normalizeName(name);
        const data = barangayLookup[key];

        return {
          feature,
          name,
          key,
          actualGap: data?.actualGap || 0,
          historicalGap: data?.historicalGap || 0,
          forecastedRevenue: data?.forecastedRevenue || 0,
          actualCollected: data?.actualCollected || 0,
          performance: data?.performance ?? null,
          status: data?.status || "noData",
          recordCount: data?.recordCount || 0,
        };
      })
      .sort((a, b) => b.actualGap - a.actualGap);
  }, [geojson, barangayLookup]);

  const filteredBarangays = useMemo(() => {
    return barangays.filter(
      (item) => statusFilter === "ALL" || item.status === statusFilter
    );
  }, [barangays, statusFilter]);

  const summary = useMemo(() => {
    const tracked = barangays.filter((item) => item.status !== "noData");
    const totalTaxGap = tracked.reduce((sum, item) => sum + item.actualGap, 0);
    const highTaxGap = tracked.filter((item) => item.status === "high").length;

    const performanceValues = tracked
      .map((item) => item.performance)
      .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));

    const averagePerformance =
      performanceValues.length > 0
        ? Math.round(
            performanceValues.reduce((s, v) => s + Number(v), 0) /
              performanceValues.length
          )
        : 0;

    const forecastedRevenue = tracked.reduce(
      (sum, item) => sum + item.forecastedRevenue,
      0
    );
    const actualCollected = tracked.reduce(
      (sum, item) => sum + item.actualCollected,
      0
    );

    return {
      totalBarangays: barangays.length,
      trackedBarangays: tracked.length,
      totalTaxGap,
      highTaxGap,
      averagePerformance,
      forecastedRevenue,
      actualCollected,
    };
  }, [barangays]);

  function getStyle(feature) {
    const name = getBarangayName(feature);
    const key = normalizeName(name);
    const data = barangayLookup[key];
    const status = data?.status || "noData";
    const color = COLORS[status];

    return {
      fillColor: color.fill,
      color: color.border,
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.55,
      lineJoin: "round",
      lineCap: "round",
    };
  }

  function onEachBarangay(feature, layer) {
    const name = getBarangayName(feature);
    const key = normalizeName(name);
    const data = barangayLookup[key];

    layer.on({
      mouseover: (event) => {
        const target = event.target;
        const st = data?.status || "noData";
        target.setStyle({
          weight: 3.5,
          color: COLORS[st].border,
          fillColor: COLORS[st].fill,
          fillOpacity: 0.75,
        });
        if (target.bringToFront) target.bringToFront();
      },
      mouseout: (event) => {
        event.target.setStyle(getStyle(feature));
      },
    });

    if (!data) {
      layer.bindTooltip(
        `<div style="min-width:190px;font-family:Inter,Arial,sans-serif;">
          <div style="font-size:15px;font-weight:700;margin-bottom:8px;color:#111827;">${name}</div>
          <div style="display:inline-block;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;margin-bottom:8px;">NO DATA</div>
          <div style="font-size:12.5px;color:#334155;font-weight:500;">No prediction data is currently available for this barangay.</div>
        </div>`,
        { sticky: true, direction: "top", opacity: 1 }
      );
      return;
    }

    const status = data.status || "noData";
    const statusColor = COLORS[status];
    const performance =
      data.performance !== null && data.performance !== undefined
        ? `${Math.round(data.performance)}%`
        : "N/A";

    layer.bindTooltip(
      `<div style="min-width:235px;font-family:Inter,Arial,sans-serif;padding:4px;">
        <div style="font-size:16px;font-weight:800;color:#111827;margin-bottom:6px;">${name}</div>
        <div style="display:inline-block;padding:3px 9px;border-radius:999px;background:${statusColor.badge};color:${statusColor.text};font-size:10.5px;font-weight:800;margin-bottom:10px;">${statusColor.label}</div>
        <div style="border-top:1px solid #e5e7eb;padding-top:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12.5px;">
            <span style="color:#475569;font-weight:600;">Performance</span>
            <strong style="color:#111827;">${performance}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12.5px;">
            <span style="color:#475569;font-weight:600;">Actual Tax Gap</span>
            <strong style="color:${statusColor.text};">${formatMoney(data.actualGap)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12.5px;">
            <span style="color:#475569;font-weight:600;">Forecasted Revenue</span>
            <strong style="color:#111827;">${formatMoney(data.forecastedRevenue)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span style="color:#475569;font-weight:600;">Actual Collected</span>
            <strong style="color:#111827;">${formatMoney(data.actualCollected)}</strong>
          </div>
        </div>
      </div>`,
      { sticky: true, direction: "top", opacity: 1 }
    );
  }

  return (
    <div>
      {/* SECTION 1: KEY PERFORMANCE STATISTICS OVERVIEW (3x2 Grid with Hover Covers) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 16.5,
            fontWeight: 800,
            color: "#0f172a",
            marginBottom: 16,
          }}
        >
          Key Performance Statistics Overview
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          <OverviewCard
            title="Barangays Tracked"
            value={`${summary.trackedBarangays}/${summary.totalBarangays}`}
            valueColor="#1e293b"
            borderColor="#3b82f6"
            coverColor="#1d4ed8"
            subtitle="Cabuyao barangays actively monitored."
            hoverDescription="Total number of Cabuyao barangays with active business tax records and ML predictions mapped in the GIS system."
          />
          <OverviewCard
            title="Total Tax Gap"
            value={formatMillions(summary.totalTaxGap)}
            valueColor="#dc2626"
            borderColor="#ef4444"
            coverColor="#dc2626"
            subtitle={`Full amount: ${formatMoney(summary.totalTaxGap)} based on current prediction data.`}
            hoverDescription="Cumulative revenue shortfall across all barangays between the ML-forecasted tax target and actual tax collections."
          />
          <OverviewCard
            title="High Tax Gap"
            value={summary.highTaxGap}
            valueColor="#b91c1c"
            borderColor="#b91c1c"
            coverColor="#991b1b"
            subtitle="Number of barangays with gap exceeding ₱2,000,000."
            hoverDescription="Count of high-risk barangays where the uncollected tax gap exceeds ₱2,000,000 and requires priority BPLO field inspection."
          />
          <OverviewCard
            title="Average Performance"
            value={`${summary.averagePerformance}%`}
            valueColor="#0d9488"
            borderColor="#14b8a6"
            coverColor="#0f766e"
            subtitle="Overall collection performance average across tracked barangays."
            hoverDescription="Average business tax compliance and collection efficiency score computed across all monitored barangays."
          />
          <OverviewCard
            title="Forecasted Revenue"
            value={formatMoney(summary.forecastedRevenue)}
            valueColor="#1d4ed8"
            borderColor="#2563eb"
            coverColor="#1e40af"
            subtitle="Total expected tax revenue calculated across all barangays."
            hoverDescription="Total expected business tax revenue predicted by the Gradient Boosting model across all Cabuyao barangays."
          />
          <OverviewCard
            title="Actual Collected"
            value={formatMoney(summary.actualCollected)}
            valueColor="#15803d"
            borderColor="#22c55e"
            coverColor="#15803d"
            subtitle="Total tax revenue successfully collected to date."
            hoverDescription="Total verified business tax revenue remitted and recorded across all Cabuyao barangays."
          />
        </div>
      </div>

      {/* SECTION 2: CABUYAO TAX GAP ANALYSIS & BARANGAY BREAKDOWN (SIDE-BY-SIDE) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Cabuyao Tax Gap Analysis &amp; Barangay Breakdown
            </h2>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "#334155",
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              Interactive heatmap view alongside granular barangay tax
              predictions.
            </p>
          </div>

          <Legend />
        </div>

        {loading && (
          <div
            style={{
              padding: "12px 24px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 13.5,
              fontWeight: 600,
              borderBottom: "1px solid #dbeafe",
            }}
          >
            Loading prediction data...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 24px",
              background: "#fff7ed",
              color: "#c2410c",
              fontSize: 13.5,
              fontWeight: 600,
              borderBottom: "1px solid #fed7aa",
            }}
          >
            {error}
          </div>
        )}

        {/* SPLIT BODY: LEFT MAP | RIGHT BARANGAY BREAKDOWN TABLE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(380px, 48%) 1fr",
            minHeight: 680,
          }}
        >
          {/* LEFT: LEAFLET MAP */}
          <div
            style={{
              borderRight: "1px solid #e2e8f0",
              position: "relative",
              minHeight: 680,
              isolation: "isolate",
            }}
          >
            <MapContainer
              center={[14.275, 121.125]}
              zoom={12}
              scrollWheelZoom={true}
              zoomControl={false}
              style={{
                height: "100%",
                minHeight: 680,
                width: "100%",
                background: "#f8fafc",
              }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
                maxZoom={19}
              />

              <GeoJSON
                data={cabuyaoMask}
                interactive={false}
                style={{
                  fillColor: "#f8fafc",
                  fillOpacity: 0.92,
                  color: "#f8fafc",
                  weight: 0,
                  opacity: 0,
                  fillRule: "evenodd",
                }}
              />

              <GeoJSON
                key={`cabuyao-${loading ? "loading" : "ready"}-${predictions.length}-${Object.keys(barangayLookup).length}`}
                data={geojson}
                style={getStyle}
                onEachFeature={onEachBarangay}
              />

              <ZoomControl position="topright" />
              <FitBounds geojson={geojson} />
            </MapContainer>
          </div>

          {/* RIGHT: BARANGAY BREAKDOWN TABLE */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Barangay Breakdown ({filteredBarangays.length})
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: 195,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  color: "#0f172a",
                  background: "#ffffff",
                }}
              >
                <option value="ALL">Filter Status (All)</option>
                <option value="high">High Tax Gap</option>
                <option value="gap">Tax Gap</option>
                <option value="none">No Tax Gap</option>
                <option value="noData">No Data</option>
              </select>
            </div>

            <div style={{ overflowX: "auto", flex: 1 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>BARANGAY</th>
                    <th style={thStyle}>TAX GAP</th>
                    <th style={thStyle}>PERFORMANCE</th>
                    <th style={thStyle}>COLLECTED</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBarangays.map((item) => {
                    const statusColor = COLORS[item.status];
                    return (
                      <tr key={item.key}>
                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {item.name}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 700,
                            color: statusColor.text,
                          }}
                        >
                          {formatMoney(item.actualGap)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "#334155",
                            fontWeight: 600,
                          }}
                        >
                          {item.performance !== null &&
                          item.performance !== undefined
                            ? `${Math.round(item.performance)}%`
                            : "N/A"}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "#1e293b",
                            fontWeight: 600,
                          }}
                        >
                          {formatMoney(item.actualCollected)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: statusColor.badge,
                              color: statusColor.text,
                              fontSize: 10,
                              fontWeight: 800,
                              lineHeight: 1.15,
                              textAlign: "center",
                              maxWidth: 72,
                              whiteSpace: "normal",
                            }}
                          >
                            {statusColor.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  title,
  value,
  valueColor = "#0f172a",
  borderColor = "#cbd5e1",
  coverColor = "#1d4ed8",
  subtitle,
  hoverDescription,
}) {
  return (
    <div
      className="metric metric-hover-card"
      style={{
        background: "#ffffff",
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        padding: "16px 18px",
        minHeight: 128,
        cursor: "help",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span style={{ color: "#334155", fontSize: 13, fontWeight: 700 }}>
          {title}
        </span>
        <span style={{ color: "#475569", fontSize: 11 }}>▲</span>
      </div>

      <div
        style={{
          color: valueColor,
          fontSize: 25,
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>

      <div
        style={{
          color: "#475569",
          fontSize: 12.5,
          fontWeight: 600,
          marginTop: 6,
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </div>

      {/* SOLID HOVER COVER */}
      <div className="metric-cover" style={{ background: coverColor }}>
        <div className="metric-cover-title">{title}</div>
        <div className="metric-cover-text">
          {hoverDescription || subtitle}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    {
      key: "none",
      title: "No Tax Gap",
      description: "No recorded tax gap in the current prediction data.",
    },
    {
      key: "gap",
      title: "Tax Gap",
      description: "A recorded tax gap of up to ₱2M.",
    },
    {
      key: "high",
      title: "High Tax Gap",
      description:
        "A recorded tax gap above ₱2M that needs closer attention.",
    },
    {
      key: "noData",
      title: "No Data",
      description:
        "No prediction data is currently available for this barangay.",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        padding: "6px 10px",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#f8fafc",
      }}
    >
      {items.map((item) => {
        const color = COLORS[item.key];
        return (
          <div key={item.key} className="legend-hover" tabIndex={0}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: color.fill,
                border: `1px solid ${color.border}`,
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
              {item.title}
            </span>
            <div className="legend-cover" style={{ background: color.text }}>
              <div className="metric-cover-title">{item.title}</div>
              <div className="metric-cover-text">{item.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const thStyle = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 800,
  color: "#334155",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#1e293b",
  borderBottom: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
};