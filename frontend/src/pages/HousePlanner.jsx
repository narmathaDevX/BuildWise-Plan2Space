import { useEffect, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Ruler,
  MapPin,
  Sparkles,
} from "lucide-react";
import { estimateAffordability } from "../services/api";

function HousePlanner({ onBack, onGenerate }) {
  const [step, setStep] = useState(1);

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

      <div className="planner-header">

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

      </div>


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
              <button
                className="primary-button generate-button"
                onClick={() => onGenerate(form)}
              >
                <Sparkles size={16} />
                Generate house plan
              </button>
            )}

          </div>

        </div>

      </div>

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