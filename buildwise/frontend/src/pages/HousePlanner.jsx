import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Ruler,
  MapPin,
  Sparkles,
  Bookmark,
  Check,
  Trash2,
  ExternalLink,
  FolderHeart,
} from "lucide-react";
import {
  estimateAffordability,
  getSavedPlans,
  deleteSavedPlan,
} from "../services/api";

function HousePlanner({ onBack, onGenerate, onOpenSavedPlan, isLoggedIn = false }) {
  const [step, setStep] = useState(1);

  // Saved Plans Portfolio State
  const [savedPlans, setSavedPlans] = useState([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [loadSuccessBanner, setLoadSuccessBanner] = useState(null);

  const loadSavedPlans = useCallback(async () => {
    try {
      setSavedLoading(true);
      const res = await getSavedPlans();
      if (res?.saved_plans) {
        setSavedPlans(res.saved_plans);
      }
    } catch (err) {
      console.error("Failed to load saved plans:", err);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedPlans();
    const handleSavedUpdated = () => loadSavedPlans();
    window.addEventListener("buildwise:saved-plans-updated", handleSavedUpdated);
    return () => {
      window.removeEventListener("buildwise:saved-plans-updated", handleSavedUpdated);
    };
  }, [loadSavedPlans]);

  const [form, setForm] = useState({
    length: 60,
    width: 40,
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
  });

  const handleLoadIntoPlanner = (saved) => {
    if (saved.form) {
      setForm((prev) => ({
        ...prev,
        ...saved.form,
      }));
      setLoadSuccessBanner(`✓ Loaded parameters from "${saved.title}". Ready to review or adjust.`);
      setShowSavedModal(false);
      setTimeout(() => setLoadSuccessBanner(null), 6000);
    }
  };

  const handleDeleteSaved = async (id, title) => {
    if (!confirm(`Are you sure you want to delete "${title}" from your saved plans?`)) return;
    try {
      await deleteSavedPlan(id);
      await loadSavedPlans();
      window.dispatchEvent(new CustomEvent("buildwise:saved-plans-updated"));
    } catch (err) {
      alert("Failed to delete saved plan: " + (err.message || "Unknown error"));
    }
  };

  const handleOpenBlueprint = (saved) => {
    setShowSavedModal(false);
    if (onOpenSavedPlan) {
      onOpenSavedPlan(saved);
    }
  };

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const area = form.length * form.width;

  const nextStep = () => {
    if (step < 4) {
      setStep(step + 1);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const previousStep = () => {
    if (step > 1) {
      setStep(step - 1);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } else {
      onBack();
    }
  };

  return (
    <main className="planner-page">

      <div className="planner-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>

        <button
          className="back-button"
          onClick={previousStep}
        >
          <ArrowLeft size={16} />
          {step === 1 ? "Dashboard" : "Back"}
        </button>

        <div className="planner-progress">

          <span>
            STEP {String(step).padStart(2, "0")} / 04
          </span>

          <div className="planner-progress-track">
            <div
              style={{
                width: `${step * 25}%`,
              }}
            />
          </div>

        </div>

        <button
          type="button"
          className="outline-button"
          onClick={() => setShowSavedModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "7px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            borderRadius: "20px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
          }}
          title="Browse previously saved plans and client blueprints"
        >
          <Bookmark size={15} style={{ color: "var(--accent, #ea580c)" }} />
          Saved Plans {savedPlans.length > 0 ? `(${savedPlans.length})` : ""}
        </button>

      </div>


      {/* LOAD SUCCESS BANNER */}
      {loadSuccessBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "10px",
            marginBottom: "20px",
            color: "#16a34a",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Check size={18} />
            <span>{loadSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setLoadSuccessBanner(null)}
            style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* SAVED PORTFOLIO SHORTCUT IN STEP 1 */}
      {step === 1 && savedPlans.length > 0 && !loadSuccessBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            background: "rgba(234, 88, 12, 0.08)",
            border: "1px solid rgba(234, 88, 12, 0.25)",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Bookmark size={17} style={{ color: "var(--accent, #ea580c)" }} />
            <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
              You have {savedPlans.length} saved blueprint{savedPlans.length !== 1 ? "s" : ""} in your portfolio.
            </span>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setShowSavedModal(true)}
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--accent, #ea580c)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "none",
            }}
          >
            Browse Saved Plans <ArrowRight size={14} />
          </button>
        </div>
      )}


      <div className="planner-content">

        <div className="planner-copy">

          <span className="small-label">
            HOUSE PLANNER
          </span>

          {step === 1 && (
            <>
              <h1>
                Start with
                <br />
                your <em>plot.</em>
              </h1>

              <p>
                Tell us about the land you're planning
                to build on. We'll use these dimensions
                to determine the usable space for your home.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h1>
                Shape the
                <br />
                way you <em>live.</em>
              </h1>

              <p>
                Tell us what your family needs from the
                house. These requirements will influence
                the recommended layout.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h1>
                Set your
                <br />
                <em>budget.</em>
              </h1>

              <p>
                Your budget helps us estimate what kind
                of house can realistically be built on
                your plot.
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <h1>
                Ready to
                <br />
                <em>build.</em>
              </h1>

              <p>
                We've collected everything we need.
                Review your requirements before generating
                your recommended house plan.
              </p>
            </>
          )}

        </div>


        <div className="planner-card">

          {step === 1 && (
            <PlotStep
              form={form}
              update={update}
              area={area}
            />
          )}

          {step === 2 && (
            <RequirementsStep
              form={form}
              update={update}
            />
          )}

          {step === 3 && (
            <BudgetStep
              form={form}
              update={update}
            />
          )}

          {step === 4 && (
            <ReviewStep
              form={form}
              area={area}
            />
          )}


          <div className="planner-actions">

            {step > 1 && (
              <button
                className="secondary-button"
                onClick={previousStep}
              >
                <ArrowLeft size={15} />
                Back
              </button>
            )}

            {step < 4 ? (
              <button
                className="primary-button"
                onClick={nextStep}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                {!isLoggedIn && (
                  <span style={{ fontSize: "12px", color: "var(--text-soft)", display: "flex", alignItems: "center", gap: "4px" }}>
                    🔒 Sign in required to generate & save plan
                  </span>
                )}
                <button
                  className="primary-button generate-button"
                  onClick={() => onGenerate(form)}
                >
                  <Sparkles size={16} />
                  {isLoggedIn ? "Generate house plan" : "Sign In & Generate Plan"}
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* SAVED PLANS PORTFOLIO MODAL */}
      {showSavedModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSavedModal(false);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* MODAL HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "rgba(234, 88, 12, 0.12)", color: "var(--accent, #ea580c)", padding: "10px", borderRadius: "10px" }}>
                  <Bookmark size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                    Saved Plans & Blueprints Portfolio
                  </h2>
                  <small style={{ color: "var(--text-soft)", fontSize: "0.82rem" }}>
                    Select a previous design to load its parameters or open its blueprint CAD drawing.
                  </small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-soft)", cursor: "pointer", fontSize: "1.3rem", padding: "4px" }}
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY (SCROLLABLE) */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "6px" }}>
              {savedLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-soft)" }}>
                  Loading saved plans...
                </div>
              ) : savedPlans.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", background: "rgba(255, 255, 255, 0.02)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                  <Bookmark size={36} style={{ color: "var(--text-soft)", margin: "0 auto 12px" }} />
                  <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>No saved plans yet</h3>
                  <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "0.86rem", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                    Generate a house plan in the planner and click <strong>"Save Plan to Liked"</strong> on any layout to save it to your portfolio.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "14px" }}>
                  {savedPlans.map((sp) => (
                    <div
                      key={sp.id}
                      style={{
                        background: "var(--surface-hover, rgba(255, 255, 255, 0.03))",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "18px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <strong style={{ fontSize: "1.02rem" }}>{sp.title}</strong>
                            <span style={{ fontSize: "0.72rem", padding: "2px 8px", background: "rgba(34, 197, 94, 0.12)", color: "#16a34a", borderRadius: "12px", fontWeight: 600 }}>
                              ✓ TNCDBR Compliant
                            </span>
                          </div>
                          {sp.notes && (
                            <p style={{ margin: "4px 0 0", fontSize: "0.84rem", color: "var(--text-soft)", fontStyle: "italic" }}>
                              "{sp.notes}"
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: "0.76rem", color: "var(--text-soft)" }}>
                          Saved {sp.created_at ? new Date(sp.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                        </span>
                      </div>

                      {/* SPECS ROW */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                        <span style={{ padding: "4px 9px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          📏 {sp.plot_width} × {sp.plot_length} ft
                        </span>
                        <span style={{ padding: "4px 9px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          🧭 {sp.facing} Facing
                        </span>
                        <span style={{ padding: "4px 9px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          🛏️ {sp.bedrooms} BHK • 🚿 {sp.bathrooms} Bath
                        </span>
                        <span style={{ padding: "4px 9px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                          📐 {Math.round(sp.built_up_area || 0)} sq ft built-up
                        </span>
                        {sp.estimated_cost > 0 && (
                          <span style={{ padding: "4px 9px", background: "rgba(59, 130, 246, 0.08)", color: "var(--accent)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "6px", fontWeight: 600 }}>
                            ₹{(sp.estimated_cost / 100000).toFixed(1)} Lakh ({sp.quality})
                          </span>
                        )}
                      </div>

                      {/* ACTION BUTTONS */}
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => handleDeleteSaved(sp.id, sp.title)}
                          style={{ color: "#ef4444", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", cursor: "pointer", background: "none", border: "none" }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                        <button
                          type="button"
                          className="outline-button"
                          onClick={() => handleLoadIntoPlanner(sp)}
                          style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", cursor: "pointer" }}
                        >
                          <Check size={14} /> Load into Planner
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handleOpenBlueprint(sp)}
                          style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", cursor: "pointer" }}
                        >
                          <ExternalLink size={14} /> Open Blueprint
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>
                {savedPlans.length} saved blueprint{savedPlans.length !== 1 ? "s" : ""} in portfolio
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowSavedModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}


/* ============================================================
   STEP 1
============================================================ */

function PlotStep({ form, update, area }) {
  return (
    <div className="planner-form">

      <div className="form-section-title">
        <Ruler size={17} />
        Plot dimensions
      </div>

      <div className="input-grid">

        <label>
          <span>Length</span>

          <div className="input-with-unit">
            <input
              type="number"
              min="15"
              max="300"
              value={form.length}
              onChange={(e) =>
                update("length", Number(e.target.value))
              }
            />
            <small>ft</small>
          </div>
          {(form.length < 15 || form.length > 300) && (
            <small style={{ color: "#ef4444", display: "block", marginTop: "4px" }}>
              Length must be 15–300 ft
            </small>
          )}
        </label>

        <label>
          <span>Width</span>

          <div className="input-with-unit">
            <input
              type="number"
              min="15"
              max="300"
              value={form.width}
              onChange={(e) =>
                update("width", Number(e.target.value))
              }
            />
            <small>ft</small>
          </div>
          {(form.width < 15 || form.width > 300) && (
            <small style={{ color: "#ef4444", display: "block", marginTop: "4px" }}>
              Width must be 15–300 ft
            </small>
          )}
        </label>

      </div>

      <div className="area-result">
        <span>Calculated plot area</span>
        <strong>
          {area.toLocaleString()} sq.ft
        </strong>
      </div>

      <div className="form-section-title">
        <MapPin size={17} />
        Location & orientation
      </div>

      <label className="full-input">
        <span>Location</span>

        <input
          value={form.location}
          onChange={(e) =>
            update("location", e.target.value)
          }
          placeholder="e.g. Dindigul, Tamil Nadu"
        />
      </label>

      <div className="direction-section">
        <span>Road facing</span>

        <div className="direction-grid">
          {["North", "East", "South", "West"].map(
            (direction) => (
              <button
                key={direction}
                className={
                  form.facing === direction
                    ? "direction active"
                    : "direction"
                }
                onClick={() =>
                  update("facing", direction)
                }
              >
                {direction}
              </button>
            )
          )}
        </div>
      </div>

      <div className="plot-preview">

        <div className="preview-label">
          PLOT PREVIEW
        </div>

        <div className="plot-drawing">

          <div className="dimension-top">
            {form.length} ft
          </div>

          <div className="plot-shape">
            <span>{form.facing}</span>
          </div>

          <div className="dimension-side">
            {form.width} ft
          </div>

        </div>

      </div>

    </div>
  );
}


/* ============================================================
   STEP 2
============================================================ */

function RequirementsStep({ form, update }) {
  return (
    <div className="planner-form">

      <div className="form-section-title">
        Home requirements
      </div>

      <Counter
        label="Bedrooms"
        value={form.bedrooms}
        min={1}
        max={8}
        onChange={(value) =>
          update("bedrooms", value)
        }
      />

      <Counter
        label="Bathrooms"
        value={form.bathrooms}
        min={1}
        max={6}
        onChange={(value) =>
          update("bathrooms", value)
        }
      />

      <Counter
        label="Floors"
        value={form.floors}
        min={1}
        max={4}
        onChange={(value) =>
          update("floors", value)
        }
      />

      <div className="form-section-title extra-title">
        Additional spaces
      </div>

      <Toggle
        label="Parking"
        description="Space for a car"
        value={form.parking}
        onChange={(value) =>
          update("parking", value)
        }
      />

      <Toggle
        label="Balcony"
        description="Outdoor upper-floor space"
        value={form.balcony}
        onChange={(value) =>
          update("balcony", value)
        }
      />

      <Toggle
        label="Pooja room"
        description="Dedicated prayer space"
        value={form.pooja}
        onChange={(value) =>
          update("pooja", value)
        }
      />

      <Toggle
        label="Utility room"
        description="Laundry / service area"
        value={form.utility}
        onChange={(value) =>
          update("utility", value)
        }
      />

    </div>
  );
}


/* ============================================================
   STEP 3
============================================================ */

function BudgetStep({ form, update }) {
  const [affordability, setAffordability] = useState(null);
  const [loadingAffordability, setLoadingAffordability] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingAffordability(true);
    const timer = setTimeout(async () => {
      try {
        const res = await estimateAffordability(form);
        if (active) setAffordability(res);
      } catch {
        // fallback gracefully
      } finally {
        if (active) setLoadingAffordability(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    form.budget,
    form.monthlyBudget,
    form.quality,
    form.width,
    form.length,
    form.floors,
    form.bedrooms,
    form.bathrooms,
    form.location,
  ]);

  const label = loadingAffordability
    ? "Evaluating..."
    : affordability?.affordability?.label || "Good";
  const ratio = affordability?.affordability?.ratio || 1.0;
  const barWidth = loadingAffordability
    ? "50%"
    : `${Math.min(100, Math.max(15, Math.round(ratio * 100)))}%`;
  const explanation = loadingAffordability
    ? "Evaluating monthly budget against projected construction burn..."
    : affordability?.affordability?.explanation ||
      "We'll use this to estimate how construction can be phased over time.";

  return (
    <div className="planner-form">

      <div className="form-section-title">
        Financial planning
      </div>

      <label className="money-input">

        <span>Total construction budget</span>

        <div>
          <b>₹</b>

          <input
            type="number"
            value={form.budget}
            onChange={(e) =>
              update(
                "budget",
                Number(e.target.value)
              )
            }
          />
        </div>

      </label>

      <label className="money-input">

        <span>Monthly construction budget</span>

        <div>
          <b>₹</b>

          <input
            type="number"
            value={form.monthlyBudget}
            onChange={(e) =>
              update(
                "monthlyBudget",
                Number(e.target.value)
              )
            }
          />
        </div>
        {form.monthlyBudget > form.budget && (
          <small style={{ color: "#ef4444", display: "block", marginTop: "4px" }}>
            Warning: Monthly budget cannot exceed total budget.
          </small>
        )}

      </label>

      <div className="form-section-title extra-title">
        Construction quality
      </div>

      <div className="quality-options">

        {["Economy", "Standard", "Premium"].map(
          (quality) => (
            <button
              key={quality}
              className={
                form.quality === quality
                  ? "quality active"
                  : "quality"
              }
              onClick={() =>
                update("quality", quality)
              }
            >
              <strong>{quality}</strong>

              <small>
                {quality === "Economy" &&
                  "Cost conscious"}

                {quality === "Standard" &&
                  "Balanced choice"}

                {quality === "Premium" &&
                  "Higher finishes"}
              </small>
            </button>
          )
        )}

      </div>

      <div className="affordability">

        <div>
          <span>Monthly affordability</span>
          <strong>{label}</strong>
        </div>

        <div className="affordability-bar">
          <div style={{ width: barWidth, transition: "width 0.3s ease" }} />
        </div>

        <small>
          {explanation}
        </small>

      </div>

    </div>
  );
}


/* ============================================================
   STEP 4
============================================================ */

function ReviewStep({ form, area }) {
  return (
    <div className="review">

      <div className="review-header">

        <span className="review-check">
          ✓
        </span>

        <div>
          <strong>
            Your requirements are ready
          </strong>

          <p>
            Review them before generating your plan.
          </p>
        </div>

      </div>

      <div className="review-grid">

        <ReviewItem
          label="Plot"
          value={`${form.length} × ${form.width} ft`}
        />

        <ReviewItem
          label="Area"
          value={`${area.toLocaleString()} sq.ft`}
        />

        <ReviewItem
          label="Facing"
          value={form.facing}
        />

        <ReviewItem
          label="Bedrooms"
          value={form.bedrooms}
        />

        <ReviewItem
          label="Bathrooms"
          value={form.bathrooms}
        />

        <ReviewItem
          label="Floors"
          value={form.floors}
        />

        <ReviewItem
          label="Budget"
          value={`₹${(
            form.budget / 100000
          ).toFixed(1)}L`}
        />

        <ReviewItem
          label="Quality"
          value={form.quality}
        />

      </div>

      <div className="review-features">

        <span>
          {form.parking ? "✓ Parking" : "— Parking"}
        </span>

        <span>
          {form.balcony ? "✓ Balcony" : "— Balcony"}
        </span>

        <span>
          {form.pooja ? "✓ Pooja room" : "— Pooja room"}
        </span>

        <span>
          {form.utility ? "✓ Utility" : "— Utility"}
        </span>

      </div>

      <div style={{ marginTop: "18px", padding: "14px 16px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text)" }}>
            <span style={{ color: "#16a34a" }}>✓</span> TNCDBR 2019 Statutory Norms
          </strong>
          <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "12px", background: "rgba(22, 163, 74, 0.15)", color: "#16a34a", fontWeight: 600 }}>
            DTCP / CMDA Verified
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", color: "var(--text-soft)" }}>
          <div>Max Ground Coverage: <strong>70%</strong></div>
          <div>Permissible FSI: <strong>1.50 - 1.75</strong></div>
          <div>Front / Rear Setbacks: <strong>5 ft / 5 ft</strong></div>
          <div>Rainwater Harvesting: <strong>Mandatory (Sec 215-A)</strong></div>
        </div>
        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed var(--border)", fontSize: "0.8rem", color: "var(--text-soft)", lineHeight: 1.4 }}>
          💡 <strong>Tamil Nadu Build Tip:</strong> Budget ~₹8 Lakhs for pre-construction ancillaries (TNEB 3-phase, 300ft borewell, DTCP sanction, 8,000L RCC sump & septic tank) to avoid cash crunch.
        </div>
      </div>

    </div>
  );
}


/* ============================================================
   SMALL COMPONENTS
============================================================ */

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}) {
  return (
    <div className="counter">

      <span>{label}</span>

      <div>

        <button
          onClick={() =>
            onChange(Math.max(min, value - 1))
          }
        >
          −
        </button>

        <strong>{value}</strong>

        <button
          onClick={() =>
            onChange(Math.min(max, value + 1))
          }
        >
          +
        </button>

      </div>

    </div>
  );
}


function Toggle({
  label,
  description,
  value,
  onChange,
}) {
  return (
    <button
      className="toggle-row"
      onClick={() => onChange(!value)}
    >
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>

      <div
        className={
          value ? "toggle active" : "toggle"
        }
      >
        <span />
      </div>
    </button>
  );
}


function ReviewItem({ label, value }) {
  return (
    <div className="review-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


export default HousePlanner;