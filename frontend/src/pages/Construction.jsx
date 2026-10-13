import { useEffect, useState } from "react";
import {
  HardHat,
  CheckCircle2,
  Circle,
  Clock3,
  CalendarDays,
  TrendingUp,
  Hammer,
  Zap,
  Droplets,
  Paintbrush,
  Home,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getProjectConstruction } from "../services/api";

const STAGE_ICONS = {
  site_prep: Hammer,
  foundation: HardHat,
  structure: Home,
  walls: Home,
  electrical: Zap,
  plumbing: Droplets,
  finishing: Paintbrush,
};

function Construction() {
  const [month, setMonth] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProjectConstruction(month)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month]);

  if (loading && !data) {
    return (
      <main className="construction-page">
        <section className="construction-header">
          <div>
            <span className="eyebrow">BUILDWISE / CONSTRUCTION</span>
            <h1>Track your build.</h1>
            <p>Loading construction schedule and projection...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!data?.has_project) {
    return (
      <main className="construction-page">
        <section className="construction-header">
          <div>
            <span className="eyebrow">BUILDWISE / CONSTRUCTION</span>
            <h1>No active construction project</h1>
            <p>Plan a home first in the House Planner to generate your projected construction timeline.</p>
          </div>
        </section>
      </main>
    );
  }

  const stages = (data.stages || []).map((stg) => ({
    ...stg,
    icon: STAGE_ICONS[stg.key] || HardHat,
  }));

  const completedStages = data.completed_stages || 0;
  const overallProgress = data.overall_progress || 0;
  const currentStage = stages.find((s) => s.status === "active") || (stages.length ? stages[0] : null);
  const totalMonths = data.total_months || 11;
  const insights = data.insights || [];

  return (
    <main className="construction-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <section className="construction-header">

        <div>
          <span className="eyebrow">
            BUILDWISE / CONSTRUCTION
          </span>

          <h1>
            Track your build.
          </h1>

          <p>
            Follow every stage of construction from
            foundation to final finishing.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
          <div className="construction-status">
            <div className="status-icon">
              <HardHat size={22} />
            </div>

            <div>
              <span>PROJECT STATUS</span>
              <strong>{data.status_text || "Planning projected progress"}</strong>
            </div>
          </div>

          {/* Month Stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-card, rgba(255,255,255,0.05))", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border-color, rgba(255,255,255,0.1))" }}>
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setMonth((m) => Math.max(1, m - 1))}
              disabled={month <= 1}
              style={{ padding: "4px", background: "none", border: "none", cursor: month <= 1 ? "not-allowed" : "pointer", opacity: month <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Month {data.month || month} of {totalMonths}
            </span>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setMonth((m) => Math.min(totalMonths, m + 1))}
              disabled={month >= totalMonths}
              style={{ padding: "4px", background: "none", border: "none", cursor: month >= totalMonths ? "not-allowed" : "pointer", opacity: month >= totalMonths ? 0.4 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </section>


      {/* ======================================================
          OVERVIEW
      ====================================================== */}

      <section className="construction-overview">

        <div className="construction-progress-card">

          <div className="progress-card-top">

            <div>
              <span className="eyebrow">
                OVERALL PROGRESS
              </span>

              <div className="big-progress">
                {overallProgress}%
              </div>

              <p>
                {completedStages} of {stages.length} major
                stages completed
              </p>
            </div>

            <div className="progress-ring">
              <svg viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  className="progress-ring-bg"
                />

                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  className="progress-ring-value"
                  strokeDasharray={`${overallProgress * 3.02} 302`}
                />
              </svg>

              <span>
                {overallProgress}%
              </span>
            </div>

          </div>

          <div className="overall-progress-bar">
            <div
              style={{
                width: `${overallProgress}%`,
              }}
            />
          </div>

        </div>


        <div className="construction-stat-card">

          <div className="construction-stat-icon">
            <Clock3 size={20} />
          </div>

          <span>ESTIMATED COMPLETION</span>

          <strong>
            {data.estimated_completion || "March 2027"}
          </strong>

          <small>
            Approximately {data.months_remaining ?? 6} months remaining
          </small>

        </div>


        <div className="construction-stat-card">

          <div className="construction-stat-icon">
            <CalendarDays size={20} />
          </div>

          <span>CURRENT PHASE</span>

          <strong>
            {currentStage?.name || "Structure"}
          </strong>

          <small>
            {data.current_phase_target || `Target completion: ${currentStage?.progress || 75}%`}
          </small>

        </div>

      </section>


      {/* ======================================================
          CURRENT STAGE
      ====================================================== */}

      {currentStage && (
        <section className="current-stage-card">

          <div className="current-stage-icon">
            <currentStage.icon size={24} />
          </div>

          <div className="current-stage-content">

            <span className="eyebrow">
              CURRENTLY IN PROGRESS
            </span>

            <h2>
              {currentStage.name}
            </h2>

            <p>
              {currentStage.description}
            </p>

          </div>

          <div className="current-stage-progress">

            <strong>
              {currentStage.progress}%
            </strong>

            <div className="stage-progress-bar">
              <div
                style={{
                  width: `${currentStage.progress}%`,
                }}
              />
            </div>

          </div>

        </section>
      )}


      {/* ======================================================
          CONSTRUCTION TIMELINE
      ====================================================== */}

      <section className="construction-section">

        <div className="section-heading">

          <div>
            <span className="eyebrow">
              PROJECT JOURNEY
            </span>

            <h2>
              Construction timeline
            </h2>
          </div>

          <span className="timeline-count">
            {completedStages}/{stages.length} complete
          </span>

        </div>


        <div className="construction-timeline">

          {stages.map((stage, index) => {

            const Icon = stage.icon;

            return (
              <div
                className={`construction-stage ${
                  stage.status
                }`}
                key={stage.name}
              >

                <div className="stage-marker">

                  {stage.progress === 100 ? (
                    <CheckCircle2 size={20} />
                  ) : stage.status === "active" ? (
                    <Icon size={19} />
                  ) : (
                    <Circle size={19} />
                  )}

                </div>


                <div className="stage-line" />


                <div className="stage-card">

                  <div className="stage-card-header">

                    <div>

                      <span className="stage-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <h3>
                        {stage.name}
                      </h3>

                    </div>

                    <span className="stage-status">

                      {stage.status === "completed"
                        ? "Completed"
                        : stage.status === "active"
                          ? "In progress"
                          : "Upcoming"}

                    </span>

                  </div>


                  <p className="stage-description">
                    {stage.description}
                  </p>


                  <div className="stage-footer">

                    <div className="stage-bar">
                      <div
                        style={{
                          width: `${stage.progress}%`,
                        }}
                      />
                    </div>

                    <span>
                      {stage.progress}%
                    </span>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </section>


      {/* ======================================================
          INSIGHTS
      ====================================================== */}

      <section className="construction-section">

        <div className="section-heading">

          <div>
            <span className="eyebrow">
              CONSTRUCTION INSIGHTS
            </span>

            <h2>
              What to watch next
            </h2>
          </div>

        </div>


        <div className="insight-grid">

          {insights.map((ins, i) => (
            <div className="insight-card" key={i}>

              <div className="insight-icon">
                {i === 0 ? <TrendingUp size={19} /> : i === 1 ? <Zap size={19} /> : <Droplets size={19} />}
              </div>

              <div>
                <span>
                  {ins.label}
                </span>

                <strong>
                  {ins.title}
                </strong>

                <p>
                  {ins.text}
                </p>
              </div>

              <ArrowUpRight size={17} />

            </div>
          ))}

        </div>

      </section>

    </main>
  );
}

export default Construction;