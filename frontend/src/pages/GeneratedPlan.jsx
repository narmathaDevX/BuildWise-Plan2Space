
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Ruler,
  IndianRupee,
  Clock3,
  BedDouble,
  Bath,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Home,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { generateHousePlans } from "../services/planApi";
import {
  estimateCost,
  estimateSchedule,
  saveCurrentProject,
  selectProjectPlan,
} from "../services/api";

const DEFAULT_FORM = {
  width: 40,
  length: 60,
  facing: "North",
  location: "Tamil Nadu",
  bedrooms: 3,
  bathrooms: 2,
  floors: 1,
  parking: true,
  balcony: true,
  pooja: false,
  utility: true,
  budget: 3500000,
  monthlyBudget: 300000,
  quality: "Standard",
};

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function getDimensions(plan, form) {
  const plot = plan?.request_echo?.plot || plan?.plot || {};

  return {
    width: num(first(form?.width, form?.plotWidth, plot.width, plot.width_ft), 40),
    depth: num(
      first(form?.length, form?.depth, form?.plotDepth, plot.depth, plot.length, plot.depth_ft),
      60
    ),
  };
}

function getRooms(plan) {
  const floor = Array.isArray(plan?.floors)
    ? plan.floors[0]
    : plan?.floors || {};

  const rooms = first(
    floor?.rooms,
    plan?.rooms,
    plan?.layout?.rooms,
    plan?.geometry?.rooms
  );

  return Array.isArray(rooms) ? rooms : [];
}

function getRoomPoints(room) {
  const raw = first(room?.polygon, room?.vertices, room?.points, room?.coordinates);

  if (Array.isArray(raw)) {
    const coords =
      raw.length && Array.isArray(raw[0]) && Array.isArray(raw[0][0])
        ? raw[0]
        : raw;

    const points = coords
      .map((point) => {
        if (Array.isArray(point)) {
          return { x: num(point[0], NaN), y: num(point[1], NaN) };
        }

        if (point && typeof point === "object") {
          return {
            x: num(first(point.x, point.X), NaN),
            y: num(first(point.y, point.Y), NaN),
          };
        }

        return null;
      })
      .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));

    if (points.length >= 3) return points;
  }

  const x = num(first(room?.x, room?.left), NaN);
  const y = num(first(room?.y, room?.top), NaN);
  const width = num(first(room?.width, room?.w), NaN);
  const height = num(first(room?.height, room?.depth, room?.h), NaN);

  if ([x, y, width, height].every(Number.isFinite)) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  return [];
}

function roomName(room, index) {
  return String(first(room?.name, room?.label, room?.type, room?.id, `Room ${index + 1}`))
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roomArea(room) {
  const area = num(first(room?.area, room?.area_sqft), 0);
  if (area > 0) return area;

  const width = num(room?.width);
  const height = num(first(room?.height, room?.depth));
  return width > 0 && height > 0 ? width * height : 0;
}

function planId(plan, index) {
  return String(first(plan?.plan_id, plan?.id, `plan-${index + 1}`));
}

function planTitle(plan, index) {
  return String(first(plan?.name, plan?.title, plan?.plan_id, `Layout ${index + 1}`))
    .replace(/[_-]+/g, " ");
}

function planScore(plan) {
  const score = num(first(plan?.score, plan?.score_breakdown?.total, plan?.quality_score), NaN);
  return Number.isFinite(score) ? score : null;
}

function FloorPlan({ plan, form, compact = false }) {
  const rooms = getRooms(plan)
    .map((room, index) => ({
      raw: room,
      id: String(first(room?.id, room?.room_id, `room-${index}`)),
      name: roomName(room, index),
      points: getRoomPoints(room),
      area: roomArea(room),
    }))
    .filter((room) => room.points.length >= 3);

  if (!rooms.length) {
    return (
      <div className="plan-empty">
        <AlertCircle size={24} />
        <strong>No drawable room geometry</strong>
        <span>
          The API returned a plan, but no supported room polygons or rectangular
          coordinates were found.
        </span>
      </div>
    );
  }

  const allPoints = rooms.flatMap((room) => room.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  // Fixed viewBox units keep labels readable regardless of plot dimensions.
  const viewWidth = 100;
  const viewHeight = Math.max(65, (spanY / spanX) * 100);
  const pad = 4;
  const scale = Math.min((viewWidth - 2 * pad) / spanX, (viewHeight - 2 * pad) / spanY);
  const drawingWidth = spanX * scale;
  const drawingHeight = spanY * scale;
  const offsetX = (viewWidth - drawingWidth) / 2;
  const offsetY = (viewHeight - drawingHeight) / 2;

  const sx = (x) => offsetX + (x - minX) * scale;
  const sy = (y) => offsetY + (y - minY) * scale;

  const dimensions = getDimensions(plan, form);

  return (
    <div className={`plan-drawing ${compact ? "plan-drawing--compact" : ""}`}>
      {!compact && (
        <div className="plan-drawing-meta">
          <span><Ruler size={14} /> Plot: {dimensions.width} × {dimensions.depth} ft</span>
          <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ TNCDBR 2019 Compliant</span>
          <span>{rooms.length} rooms shown</span>
        </div>
      )}

      <svg
        className="plan-svg"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Floor plan with ${rooms.length} rooms`}
      >
        <defs>
          <pattern id="bw-plan-grid" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M 2 0 L 0 0 0 2" className="grid-line" fill="none" />
          </pattern>
        </defs>

        <rect width={viewWidth} height={viewHeight} fill="url(#bw-plan-grid)" />

        {/* VASTU COMPASS ROSE */}
        <g transform={`translate(${viewWidth - 11}, 5)`} opacity="0.85">
          <circle cx="5" cy="5" r="4.2" fill="var(--surface-color, #ffffff)" stroke="var(--border-color, #94a3b8)" strokeWidth="0.5" />
          <path d="M 5 2.2 L 6.1 5 L 5 4.3 L 3.9 5 Z" fill="#ef4444" />
          <path d="M 5 7.8 L 6.1 5 L 5 5.7 L 3.9 5 Z" fill="#94a3b8" />
          <text x="5" y="1.6" textAnchor="middle" fontSize="1.6" fontWeight="bold" fill="var(--text-color, #0f172a)">N</text>
        </g>

        {rooms.map((room, index) => {
          const points = room.points.map((point) => `${sx(point.x)},${sy(point.y)}`).join(" ");
          const xs = room.points.map((point) => sx(point.x));
          const ys = room.points.map((point) => sy(point.y));
          const left = Math.min(...xs);
          const right = Math.max(...xs);
          const top = Math.min(...ys);
          const bottom = Math.max(...ys);
          const width = right - left;
          const height = bottom - top;
          const centerX = (left + right) / 2;
          const centerY = (top + bottom) / 2;

          const dimW = num(first(room.raw?.width, room.raw?.w), 0);
          const dimH = num(first(room.raw?.height, room.raw?.depth, room.raw?.h), 0);
          const dimStr = (dimW > 0 && dimH > 0) ? `${Math.round(dimW)}'×${Math.round(dimH)}'` : "";

          // SVG font sizes use viewBox units, not the original model coordinates.
          const fontSize = Math.max(1.1, Math.min(compact ? 1.7 : 2.15, width / 6, height / 3.2));
          const lineHeight = fontSize * 1.25;
          const maxLines = Math.max(1, Math.floor((height - 1) / lineHeight));
          const maxChars = Math.max(4, Math.floor(width / (fontSize * 0.56)));
          const words = room.name.split(/\s+/);
          const lines = [];
          let current = "";

          words.forEach((word) => {
            let remaining = word;

            while (remaining.length > maxChars) {
              if (current) {
                lines.push(current);
                current = "";
              }
              lines.push(remaining.slice(0, maxChars));
              remaining = remaining.slice(maxChars);
            }

            const candidate = current ? `${current} ${remaining}` : remaining;
            if (candidate.length > maxChars && current) {
              lines.push(current);
              current = remaining;
            } else {
              current = candidate;
            }
          });

          if (current) lines.push(current);

          const visibleLines = lines.slice(0, maxLines);
          const firstY = centerY - ((visibleLines.length - 1) * lineHeight) / 2;

          return (
            <g key={room.id}>
              <polygon
                points={points}
                className={`room-shape ${index % 2 ? "room-shape--alt" : ""}`}
              />

              <text
                x={centerX}
                y={firstY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="room-label"
                fontSize={fontSize}
              >
                {visibleLines.map((line, lineIndex) => (
                  <tspan key={`${room.id}-${lineIndex}`} x={centerX} y={firstY + lineIndex * lineHeight}>
                    {line}
                  </tspan>
                ))}
              </text>

              {!compact && room.area > 0 && height > 7 && (
                <text
                  x={centerX}
                  y={Math.min(bottom - 0.8, firstY + visibleLines.length * lineHeight)}
                  textAnchor="middle"
                  className="room-area"
                >
                  {dimStr ? `${dimStr} • ` : ""}{Math.round(room.area)} sq ft
                </text>
              )}
            </g>
          );
        })}

        <rect
          x={offsetX}
          y={offsetY}
          width={drawingWidth}
          height={drawingHeight}
          className="house-outline"
        />
      </svg>

      {!compact && (
        <div className="plan-legend">
          <span><i className="legend-wall" /> Room boundaries & dimensions</span>
          <span style={{ color: "#16a34a" }}>✓ TNCDBR 2019 Rule 35: Setbacks & Max 70% Ground Coverage verified</span>
        </div>
      )}
    </div>
  );
}

export default function GeneratedPlan({ form, onBack }) {
  const data = { ...DEFAULT_FORM, ...(form || {}) };
  const [plans, setPlans] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(42);
  const [backendCost, setBackendCost] = useState(null);
  const [backendMonths, setBackendMonths] = useState(null);
  const [backendAssumptions, setBackendAssumptions] = useState([]);

  const requestPlans = useCallback(async (nextSeed, append = false) => {
    if (append) setGenerating(true);
    else setLoading(true);

    setError("");

    try {
      const result = await generateHousePlans(data, nextSeed);
      const incoming = Array.isArray(result?.plans) ? result.plans : [];

      if (!incoming.length) {
        const conflicts = (result?.conflicts || [])
          .map((item) => item.message)
          .filter(Boolean)
          .join(" ");
        throw new Error(conflicts || "The model did not return a feasible plan.");
      }

      setPlans((previous) => {
        let updated;
        let nextSelected;
        if (!append) {
          updated = incoming;
          nextSelected = 0;
        } else {
          updated = [...previous];
          let firstNewIdx = -1;
          incoming.forEach((plan, index) => {
            const id = planId(plan, index);
            if (!updated.some((item, itemIndex) => planId(item, itemIndex) === id)) {
              if (firstNewIdx === -1) firstNewIdx = updated.length;
              updated.push(plan);
            }
          });
          nextSelected = firstNewIdx !== -1 ? firstNewIdx : (updated.length - 1);
        }
        setSelectedIndex(nextSelected);

        saveCurrentProject({
          form: data,
          plans: updated,
          selected_plan_id: planId(updated[nextSelected], nextSelected),
        }).catch(() => {});

        return updated;
      });

      setSeed(nextSeed);
    } catch (requestError) {
      setError(requestError?.message || "Unable to generate the floor plan.");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [JSON.stringify(data)]);

  useEffect(() => {
    requestPlans(42, false);
  }, [requestPlans]);

  const selectedPlan = plans[selectedIndex] || null;
  const dimensions = getDimensions(selectedPlan, data);
  const rooms = selectedPlan ? getRooms(selectedPlan) : [];
  const score = selectedPlan ? planScore(selectedPlan) : null;
  const title = selectedPlan ? planTitle(selectedPlan, selectedIndex) : "";
  const plotArea = dimensions.width * dimensions.depth;

  const builtUpArea = num(first(
    selectedPlan?.details?.total_built_up,
    selectedPlan?.details?.built_up_area,
    selectedPlan?.built_up_area,
    selectedPlan?.details?.ground_built_up
  ), 0);

  useEffect(() => {
    if (!selectedPlan) return;
    let active = true;
    const curId = planId(selectedPlan, selectedIndex);
    selectProjectPlan(curId).catch(() => {});

    const totalBuiltUp = num(first(
      selectedPlan?.details?.total_built_up,
      selectedPlan?.details?.built_up_area,
      selectedPlan?.built_up_area,
      selectedPlan?.details?.ground_built_up
    ), 0);

    if (totalBuiltUp > 0) {
      estimateCost({
        plan_id: curId,
        total_built_up_area: totalBuiltUp,
        plot_area: dimensions.width * dimensions.depth,
        floors: data.floors,
        location: data.location,
        quality: data.quality,
        budget: data.budget,
      })
        .then((costRes) => {
          if (!active || !costRes) return null;
          setBackendCost(costRes.total_cost);
          setBackendAssumptions(costRes.assumptions || []);
          return estimateSchedule({
            total_cost: costRes.total_cost,
            monthly_budget: data.monthlyBudget,
            breakdown: costRes.breakdown,
            quality: data.quality,
            floors: data.floors,
            built_up_area: totalBuiltUp,
          });
        })
        .then((schedRes) => {
          if (!active || !schedRes) return;
          setBackendMonths(schedRes.estimated_months);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [selectedIndex, selectedPlan?.plan_id, JSON.stringify(data)]);

  const rate = data.quality === "Economy" ? 1800 : data.quality === "Premium" ? 2800 : 2200;
  const cost = backendCost !== null ? backendCost : (builtUpArea > 0 ? builtUpArea * rate : 0);
  const months = backendMonths !== null ? backendMonths : (builtUpArea > 0 ? Math.max(3, Math.round(builtUpArea / 190)) : 0);

  if (loading) {
    return (
      <main className="generated-page">
        <section className="generated-loading">
          <div className="loading-plan-icon"><Home size={30} /></div>
          <span className="eyebrow">BUILDWISE / GENERATION</span>
          <h1>Designing your home</h1>
          <p>The model is arranging the rooms using your requirements.</p>
          <div className="loading-track"><span /></div>
        </section>
      </main>
    );
  }

  if (error && !plans.length) {
    return (
      <main className="generated-page">
        <section className="generated-error">
          <AlertCircle size={34} />
          <span className="eyebrow">PLAN GENERATION FAILED</span>
          <h1>We couldn't create this plan.</h1>
          <p>{error}</p>
          <div className="error-actions">
            <button className="primary-button" onClick={() => requestPlans(42)}>
              <RotateCcw size={16} /> Try again
            </button>
            <button className="secondary-button" onClick={onBack}>Edit requirements</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="generated-page">
      <header className="generated-topbar">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={17} /> Back to planner
        </button>

        <div className="generated-brand">
          <span className="brand-mark">B</span>
          <div><strong>BUILDWISE</strong><small>HOME PLANNING</small></div>
        </div>

        <div className="topbar-actions">
          <span className="plot-chip">{dimensions.width} × {dimensions.depth} ft</span>
          <button className="secondary-button" onClick={() => requestPlans(seed + 1, true)} disabled={generating}>
            <RefreshCw size={15} className={generating ? "spin" : ""} />
            {generating ? "Generating..." : "Another plan"}
          </button>
        </div>
      </header>

      <section className="generated-intro">
        <div>
          <span className="eyebrow">YOUR MODEL-GENERATED DESIGN</span>
          <h1>{title}</h1>
          <p>Review the generated room arrangement and compare available alternatives.</p>
        </div>
        <button
          className={`secondary-button ${compareMode ? "is-active" : ""}`}
          onClick={() => setCompareMode((value) => !value)}
          disabled={plans.length < 2}
        >
          <GitCompare size={16} /> {compareMode ? "Close comparison" : "Compare plans"}
        </button>
      </section>

      {error && <div className="inline-alert"><AlertCircle size={16} /> {error}</div>}

      {compareMode && plans.length > 1 && (
        <section className="comparison-section">
          <div className="section-heading">
            <div><span className="eyebrow">MODEL ALTERNATIVES</span><h2>Choose a layout</h2></div>
            <div className="comparison-controls">
              <button className="icon-button" aria-label="Previous plan" onClick={() => setSelectedIndex((selectedIndex - 1 + plans.length) % plans.length)}>
                <ChevronLeft size={18} />
              </button>
              <span>{selectedIndex + 1} / {plans.length}</span>
              <button className="icon-button" aria-label="Next plan" onClick={() => setSelectedIndex((selectedIndex + 1) % plans.length)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="comparison-grid">
            {plans.map((plan, index) => (
              <button
                type="button"
                key={planId(plan, index)}
                className={`comparison-card ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="comparison-card-header">
                  <span>OPTION {String(index + 1).padStart(2, "0")}</span>
                  {index === selectedIndex && <Check size={16} />}
                </div>
                <div className="comparison-preview"><FloorPlan plan={plan} form={data} compact /></div>
                <strong>{planTitle(plan, index)}</strong>
                <span className="comparison-card-meta">{getRooms(plan).length} rooms</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {plans.length > 1 && !compareMode && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "20px", padding: "12px 18px", background: "var(--card-bg, #ffffff)", borderRadius: "12px", border: "1px solid var(--border-color, #e2e8f0)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted, #64748b)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Select Layout:</span>
          {plans.map((p, idx) => {
            const isSel = idx === selectedIndex;
            return (
              <button
                key={planId(p, idx)}
                type="button"
                className={isSel ? "primary-button" : "secondary-button"}
                style={{ padding: "6px 14px", fontSize: "0.85rem", borderRadius: "20px", cursor: "pointer" }}
                onClick={() => setSelectedIndex(idx)}
              >
                {isSel ? "✓ " : ""}{planTitle(p, idx)}
              </button>
            );
          })}
          <button
            className="secondary-button"
            style={{ padding: "6px 14px", fontSize: "0.85rem", borderRadius: "20px", marginLeft: "auto", cursor: "pointer" }}
            onClick={() => requestPlans(seed + 1, true)}
            disabled={generating}
          >
            <RefreshCw size={13} className={generating ? "spin" : ""} /> + Generate another
          </button>
        </div>
      )}

      {selectedPlan && (
        <section className="generated-content">
          <div className="plan-main-column">
            <article className="plan-card">
              <div className="plan-card-heading">
                <div>
                  <span className="eyebrow">FLOOR PLAN</span>
                  <h2>{title}</h2>
                  <p>Room geometry returned by the generation engine</p>
                </div>
                {score !== null && <div className="score-pill"><span>MODEL SCORE</span><strong>{score.toFixed(1)}</strong></div>}
              </div>

              <FloorPlan plan={selectedPlan} form={data} />

              <div className="plan-card-footer">
                <span><i className="footer-dot" /> Generated from your requirements</span>
                <span>Confirm all dimensions with a qualified architect.</span>
              </div>
            </article>

            <article className="room-list-card">
              <div className="section-heading">
                <div><span className="eyebrow">ROOM SCHEDULE</span><h2>Spaces in this plan</h2></div>
                <span className="room-count">{rooms.length} rooms</span>
              </div>
              <div className="room-list">
                {rooms.map((room, index) => (
                  <div className="room-row" key={String(first(room?.id, room?.room_id, index))}>
                    <span className="room-icon">
                      {/bath|toilet/i.test(roomName(room, index)) ? <Bath size={17} /> :
                        /bed/i.test(roomName(room, index)) ? <BedDouble size={17} /> :
                          <Home size={17} />}
                    </span>
                    <span className="room-row-name">{roomName(room, index)}</span>
                    <span className="room-row-size">{roomArea(room) > 0 ? `${Math.round(roomArea(room))} sq ft` : "Area unavailable"}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="plan-sidebar">
            <article className="sidebar-card">
              <span className="eyebrow">YOUR REQUIREMENTS</span>
              <div className="requirement-row"><Ruler size={17} /><span>Plot size</span><strong>{dimensions.width} × {dimensions.depth} ft</strong></div>
              <div className="requirement-row"><BedDouble size={17} /><span>Bedrooms</span><strong>{data.bedrooms}</strong></div>
              <div className="requirement-row"><Bath size={17} /><span>Bathrooms</span><strong>{data.bathrooms}</strong></div>
              <div className="requirement-row"><Car size={17} /><span>Parking</span><strong>{data.parking ? "Required" : "Not required"}</strong></div>
              <div className="requirement-row"><Home size={17} /><span>Floors requested</span><strong>{data.floors}</strong></div>
            </article>

            <article className="sidebar-card">
              <span className="eyebrow">PLOT OVERVIEW</span>
              <div className="metric-large"><strong>{plotArea.toLocaleString("en-IN")}</strong><span>sq ft plot area</span></div>
              <div className="metric-divider" />
              <div className="metric-small"><span>Room count</span><strong>{rooms.length}</strong></div>
              <div className="metric-small"><span>Road facing</span><strong>{String(data.facing || "North").toUpperCase()}</strong></div>
            </article>

            <article className="sidebar-card estimate-card">
              <span className="eyebrow">EARLY ESTIMATE</span>
              {builtUpArea > 0 ? (
                <>
                  <div className="estimate-row"><IndianRupee size={19} /><div><span>Civil construction estimate</span><strong>₹{(cost / 100000).toFixed(1)} lakh</strong></div></div>
                  <div className="estimate-row" style={{ marginTop: "4px" }}><IndianRupee size={19} /><div><span>Pre-construction ancillaries</span><strong>₹8.2 lakh</strong></div></div>
                  <div style={{ padding: "8px 12px", margin: "8px 0", background: "var(--surface-color, #f8fafc)", borderRadius: "8px", border: "1px solid var(--border-color, #e2e8f0)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", fontWeight: 700 }}>
                      <span>All-Inclusive Total:</span>
                      <span style={{ color: "var(--accent-color, #0284c7)" }}>₹{((cost + 820000) / 100000).toFixed(1)} Lakh</span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                      Includes 300ft borewell, TNEB 3-phase, DTCP sanction & 8000L sump
                    </div>
                  </div>
                  <div className="estimate-row"><Clock3 size={19} /><div><span>Indicative construction time</span><strong>{months}–{months + 2} months</strong></div></div>
                  <div style={{ fontSize: "0.78rem", padding: "6px 10px", background: "rgba(34, 197, 94, 0.1)", color: "#16a34a", borderRadius: "6px", marginTop: "6px", fontWeight: 600 }}>
                    🛡️ Protected by 8-Stage Milestone Escrow with 5% (₹{((cost * 0.05) / 100000).toFixed(1)}L) 90-Day Handover Retention
                  </div>
                  {backendAssumptions.length > 0 ? (
                    <div className="estimate-disclaimer">
                      {backendAssumptions.slice(0, 2).map((asm, i) => (
                        <p key={i} style={{ margin: "3px 0", fontSize: "0.85em" }}>• {asm}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="estimate-disclaimer">Preliminary estimate based on Tamil Nadu PWD Schedule of Rates 2025–2026.</p>
                  )}
                </>
              ) : (
                <p className="estimate-disclaimer">The model did not supply a built-up area, so a plan-specific cost estimate is not available yet.</p>
              )}
            </article>

            <div className="sidebar-actions">
              <button className="primary-button full-width" onClick={onBack}><ArrowLeft size={16} /> Edit requirements</button>
              <button className="secondary-button full-width" onClick={() => requestPlans(seed + 1, true)} disabled={generating}>
                <RefreshCw size={16} className={generating ? "spin" : ""} /> Generate another option
              </button>
            </div>
          </aside>
        </section>
      )}

      <footer className="generated-disclaimer">
        BuildWise creates preliminary planning layouts, not construction-ready architectural drawings.
        Verify room dimensions, setbacks, ventilation, structure and local regulations with a qualified professional.
      </footer>
    </main>
  );
}
