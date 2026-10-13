import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  IndianRupee,
  House,
  Ruler,
  HardHat,
  Package,
  CheckCircle2,
  Clock3,
  TrendingUp,
} from "lucide-react";
import { getProjectReport } from "../services/api";

function formatCurrency(value) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        const data = await getProjectReport();
        setReport(data);
      } catch (err) {
        console.error("Failed to load project report:", err);
        setError("Unable to load project report from server.");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, []);

  if (loading) {
    return (
      <main className="reports-page">
        <section className="reports-header">
          <div>
            <span className="eyebrow">BUILDWISE / REPORTS</span>
            <h1>Project Report</h1>
            <p>Loading consolidated project report...</p>
          </div>
        </section>
      </main>
    );
  }

  // Fallbacks if data is not available yet
  const budget = report?.budget || 3500000;
  const estimatedCost = report?.estimated_cost || 3250000;
  const remaining = report?.remaining !== undefined ? report.remaining : budget - estimatedCost;
  const metrics = report?.metrics || {
    plot_area: 2400,
    built_up_area: 1850,
    overall_progress_pct: 18,
    completed_stages: 2,
    current_phase: "Structure",
  };
  const costBreakdown = report?.cost_breakdown || [
    { name: "Structure", amount: 1120000, percentage: 34 },
    { name: "Masonry", amount: 585000, percentage: 18 },
    { name: "Electrical & Plumbing", amount: 487500, percentage: 15 },
    { name: "Flooring & Finishing", amount: 682500, percentage: 21 },
    { name: "Doors & Windows", amount: 325000, percentage: 10 },
  ];
  const materialsSummary = report?.materials_summary || {
    purchased_count: 2,
    total_count: 6,
  };
  const statusGrid = report?.status_grid || [
    {
      title: "Planning",
      subtitle: "Requirements and house plan prepared",
      value: "Complete",
      status: "completed",
    },
    {
      title: "Foundation",
      subtitle: "Foundation stage completed",
      value: "Complete",
      status: "completed",
    },
    {
      title: "Structure",
      subtitle: "Structural work currently underway",
      value: "75%",
      status: "active",
    },
    {
      title: "Finishing",
      subtitle: "Yet to begin",
      value: "Pending",
      status: "upcoming",
    },
  ];

  const budgetUsedPct = budget > 0 ? Math.round((estimatedCost / budget) * 100) : 0;

  return (
    <main className="reports-page">
      {/* HEADER */}
      <section className="reports-header">
        <div>
          <span className="eyebrow">BUILDWISE / REPORTS</span>
          <h1>Project Report</h1>
          <p>
            A consolidated overview of your house plan, budget, construction progress
            and materials.
          </p>
        </div>

        <button className="primary-button" onClick={() => window.print()}>
          <Download size={16} />
          Print / Save Report
        </button>
      </section>

      {/* PROJECT IDENTITY */}
      <section className="report-project-card">
        <div className="report-project-main">
          <div className="report-house-icon">
            <House size={25} />
          </div>
          <div>
            <span className="small-label">RESIDENTIAL PROJECT</span>
            <h2>{report?.project_name || "My Dream Home"}</h2>
            <p>{report?.location || "Tamil Nadu"} · Preliminary planning report</p>
          </div>
        </div>

        <div className="report-status">
          <CheckCircle2 size={15} />
          {report?.status_label || "Planning active"}
        </div>
      </section>

      {/* KEY METRICS */}
      <section className="report-metrics">
        <div className="report-metric">
          <div className="report-metric-icon">
            <Ruler size={19} />
          </div>
          <span>Plot area</span>
          <strong>{metrics.plot_area?.toLocaleString("en-IN")} sq.ft</strong>
        </div>

        <div className="report-metric">
          <div className="report-metric-icon">
            <House size={19} />
          </div>
          <span>Built-up area</span>
          <strong>{metrics.built_up_area?.toLocaleString("en-IN")} sq.ft</strong>
        </div>

        <div className="report-metric">
          <div className="report-metric-icon">
            <HardHat size={19} />
          </div>
          <span>Construction progress</span>
          <strong>{metrics.overall_progress_pct}%</strong>
        </div>

        <div className="report-metric">
          <div className="report-metric-icon">
            <Package size={19} />
          </div>
          <span>Materials purchased</span>
          <strong>
            {materialsSummary.purchased_count} / {materialsSummary.total_count}
          </strong>
        </div>
      </section>

      {/* MAIN REPORT GRID */}
      <section className="reports-grid">
        {/* BUDGET REPORT */}
        <div className="report-panel budget-report">
          <div className="report-panel-header">
            <div>
              <span className="small-label">COST SUMMARY</span>
              <h2>Budget overview</h2>
            </div>
            <IndianRupee size={20} />
          </div>

          <div className="report-budget-main">
            <span>Estimated construction cost</span>
            <strong>{formatCurrency(estimatedCost)}</strong>
            <small>of {formatCurrency(budget)} planned budget</small>
          </div>

          <div className="report-budget-bar">
            <div
              style={{
                width: `${Math.min(100, budgetUsedPct)}%`,
              }}
            />
          </div>

          <div className="report-budget-footer">
            <span>
              Used
              <strong>{budgetUsedPct}%</strong>
            </span>
            <span>
              Remaining
              <strong>{formatCurrency(remaining)}</strong>
            </span>
          </div>
        </div>

        {/* CONSTRUCTION REPORT */}
        <div className="report-panel">
          <div className="report-panel-header">
            <div>
              <span className="small-label">CONSTRUCTION</span>
              <h2>Project progress</h2>
            </div>
            <TrendingUp size={20} />
          </div>

          <div className="construction-report-progress">
            <div className="progress-circle">
              <strong>{metrics.overall_progress_pct}%</strong>
              <span>complete</span>
            </div>

            <div className="construction-report-info">
              <div>
                <span>Completed</span>
                <strong>{metrics.completed_stages} stages</strong>
              </div>
              <div>
                <span>Current phase</span>
                <strong>{metrics.current_phase}</strong>
              </div>
              <div>
                <span>Expected completion</span>
                <strong>{report?.expected_completion || "March 2027"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COST BREAKDOWN */}
      <section className="report-section">
        <div className="report-section-heading">
          <div>
            <span className="small-label">ESTIMATE</span>
            <h2>Cost breakdown</h2>
          </div>
          <span>{formatCurrency(estimatedCost)}</span>
        </div>

        <div className="cost-breakdown">
          {costBreakdown.map((item) => (
            <div className="cost-row" key={item.name}>
              <div className="cost-name">
                <span>{item.name}</span>
                <small>{item.percentage}% of estimated cost</small>
              </div>

              <div className="cost-bar">
                <div
                  style={{
                    width: `${item.percentage * 2.5}%`,
                  }}
                />
              </div>

              <strong>{formatCurrency(item.amount)}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* PROJECT STATUS */}
      <section className="report-section">
        <div className="report-section-heading">
          <div>
            <span className="small-label">PROJECT STATUS</span>
            <h2>Current position</h2>
          </div>
        </div>

        <div className="report-status-grid">
          {statusGrid.map((card, idx) => (
            <div
              className={`report-status-card ${card.status === "active" ? "active" : ""}`}
              key={card.title || idx}
            >
              {card.status === "completed" ? (
                <CheckCircle2 size={19} />
              ) : (
                <Clock3 size={19} />
              )}
              <div>
                <strong>{card.title}</strong>
                <span>{card.subtitle}</span>
              </div>
              <b>{card.value}</b>
            </div>
          ))}
        </div>
      </section>

      {/* REPORT FOOTNOTE */}
      <section className="report-disclaimer">
        <FileText size={18} />
        <div>
          <strong>Preliminary project report</strong>
          <p>
            This report uses the current planning estimates and sample construction
            data. Final costs, quantities, schedules and structural decisions should be
            verified by qualified professionals before construction.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Reports;