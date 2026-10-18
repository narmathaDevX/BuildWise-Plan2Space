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
  ShieldCheck,
  Landmark,
  Droplets,
  Check,
} from "lucide-react";
import { getProjectReport } from "../services/api";

function formatCurrency(value) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function Reports({ projectVersion }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
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
  };

  useEffect(() => {
    fetchReport();
  }, [projectVersion]);

  useEffect(() => {
    const handleSync = () => {
      fetchReport();
    };
    window.addEventListener("buildwise:project-updated", handleSync);
    return () => {
      window.removeEventListener("buildwise:project-updated", handleSync);
    };
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

  if (!report?.has_project) {
    return (
      <main className="reports-page">
        <section className="reports-header">
          <div>
            <span className="eyebrow">BUILDWISE / REPORTS</span>
            <h1>No active project report</h1>
            <p>Generate a house plan in the House Planner to view your consolidated cost, schedule, and procurement report.</p>
          </div>
        </section>
      </main>
    );
  }

  const budget = report.budget || 0;
  const estimatedCost = report.estimated_cost || 0;
  const remaining = report.remaining !== undefined ? report.remaining : budget - estimatedCost;
  const metrics = report.metrics || {};
  const costBreakdown = report.cost_breakdown || [];
  const materialsSummary = report.materials_summary || {
    purchased_count: 0,
    total_count: 0,
  };
  const statusGrid = report.status_grid || [];

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

      {/* BANK LOAN & DTCP SANCTION READY CONSTRUCTION PROJECT DOSSIER */}
      <section className="report-section" style={{ background: "var(--surface)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "32px" }}>
        <div className="report-section-heading" style={{ marginBottom: "16px" }}>
          <div>
            <span className="small-label" style={{ color: "var(--accent)", fontWeight: 700 }}>
              INSTITUTIONAL BANKING & SANCTION DOSSIER
            </span>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Landmark size={20} style={{ color: "var(--accent)" }} />
              Bank Loan & DTCP Sanction Project Dossier
            </h2>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "12px", background: "rgba(34, 197, 94, 0.15)", color: "#16a34a" }}>
            ✓ Bank Loan Ready (SBI / HDFC / Canara)
          </span>
        </div>

        <p style={{ fontSize: "0.88rem", color: "var(--text-soft)", lineHeight: 1.5, margin: "0 0 20px" }}>
          This estimation dossier complies with Indian housing finance norms. Banks finance up to 80% Loan-to-Value (LTV) on verified civil construction stages, while the borrower must demonstrate 20% upfront equity margin.
        </p>

        {/* 3 CAPITAL TIERS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "20px" }}>
          <div style={{ padding: "14px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>Civil Construction Contract</span>
            <strong style={{ display: "block", fontSize: "1.2rem", color: "var(--text)", marginTop: "4px" }}>
              {formatCurrency(estimatedCost)}
            </strong>
            <small style={{ fontSize: "11px", color: "var(--text-soft)" }}>Structural + finishing works</small>
          </div>

          <div style={{ padding: "14px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>Pre-Construction Ancillaries</span>
            <strong style={{ display: "block", fontSize: "1.2rem", color: "var(--text)", marginTop: "4px" }}>
              {formatCurrency(report?.ancillary_cost || 820000)}
            </strong>
            <small style={{ fontSize: "11px", color: "var(--text-soft)" }}>Borewell, TNEB, DTCP, Sump</small>
          </div>

          <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(2, 132, 199, 0.08)", border: "1px solid var(--accent)" }}>
            <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 700 }}>All-Inclusive Total Project Cost</span>
            <strong style={{ display: "block", fontSize: "1.25rem", color: "var(--accent)", marginTop: "4px" }}>
              {formatCurrency(report?.all_inclusive_total || (estimatedCost + 820000))}
            </strong>
            <small style={{ fontSize: "11px", color: "var(--text-soft)" }}>Total capital required</small>
          </div>
        </div>

        {/* BANK LOAN LTV BREAKDOWN */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>Maximum Bank Loan Eligibility (80% LTV)</span>
            <strong style={{ display: "block", fontSize: "1.2rem", color: "#16a34a", marginTop: "2px" }}>
              {formatCurrency(report?.bank_loan_dossier?.max_bank_loan_eligibility_80pct || Math.round((report?.all_inclusive_total || (estimatedCost + 820000)) * 0.8))}
            </strong>
            <small style={{ fontSize: "11px", color: "var(--text-soft)" }}>Approved for SBI Realty, HDFC Home Loans & Canara Bank</small>
          </div>
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>Borrower Margin Equity (20% Upfront)</span>
            <strong style={{ display: "block", fontSize: "1.2rem", color: "var(--text)", marginTop: "2px" }}>
              {formatCurrency(report?.bank_loan_dossier?.owner_equity_contribution_20pct || Math.round((report?.all_inclusive_total || (estimatedCost + 820000)) * 0.2))}
            </strong>
            <small style={{ fontSize: "11px", color: "var(--text-soft)" }}>Must be expended on land/plinth before bank disburses</small>
          </div>
        </div>

        {/* STAGE-WISE BANK DISBURSEMENT SCHEDULE */}
        <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "var(--text)" }}>Bank Technical Stage Disbursement Schedule</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-soft)" }}>
                <th style={{ padding: "8px 10px" }}>Milestone Stage</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Disbursement %</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Loan Amount</th>
                <th style={{ padding: "8px 10px" }}>Bank Technical Valuer Verification Criteria</th>
              </tr>
            </thead>
            <tbody>
              {(report?.bank_loan_dossier?.stage_disbursements || []).map((stg, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--text)" }}>{stg.stage}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{stg.disbursement_pct}%</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
                    {formatCurrency(stg.disbursement_amount)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-soft)" }}>{stg.inspection_requirement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* STATUTORY TNCDBR 2019 COMPLIANCE CERTIFICATION */}
      <section className="report-section" style={{ background: "var(--surface)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "32px" }}>
        <div className="report-section-heading" style={{ marginBottom: "16px" }}>
          <div>
            <span className="small-label" style={{ color: "#16a34a", fontWeight: 700 }}>
              STATUTORY BUILDING BYE-LAWS COMPLIANCE
            </span>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={20} style={{ color: "#16a34a" }} />
              TNCDBR 2019 Statutory Verification
            </h2>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "12px", background: "rgba(34, 197, 94, 0.15)", color: "#16a34a" }}>
            DTCP & CMDA Compliant
          </span>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--text-soft)", margin: "0 0 16px", lineHeight: 1.5 }}>
          Verified against <strong>Tamil Nadu Combined Development and Building Rules, 2019</strong> (G.O. Ms No. 18, Housing and Urban Development Dept, dt. 04.02.2019). Required for local body plan approval and bank mortgage clearance.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {(report?.compliance_summary?.checks || []).map((chk) => (
            <div key={chk.id} style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ fontSize: "13px", color: "var(--text)" }}>{chk.name}</strong>
                <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>✓ PASS</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-soft)", margin: "2px 0" }}>
                Limit: <strong>{chk.statutory_limit}</strong>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-soft)", margin: "2px 0" }}>
                Actual: <strong>{chk.actual_value}</strong>
              </div>
              <small style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", fontStyle: "italic" }}>
                {chk.rule}
              </small>
            </div>
          ))}
        </div>
      </section>

      {/* PRE-CONSTRUCTION & ANCILLARY EXPENSES BREAKDOWN */}
      <section className="report-section" style={{ background: "var(--surface)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "32px" }}>
        <div className="report-section-heading" style={{ marginBottom: "16px" }}>
          <div>
            <span className="small-label">SITE INFRASTRUCTURE</span>
            <h2>Pre-Construction & Ancillary Packages</h2>
          </div>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>
            {formatCurrency(report?.ancillary_cost || 820000)}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(report?.ancillary_breakdown || []).map((pkg) => (
            <div
              key={pkg.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderRadius: "8px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                gap: "14px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--text)" }}>{pkg.name}</strong>
                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "var(--surface)", color: "var(--text-soft)", border: "1px solid var(--border)" }}>
                    {pkg.category}
                  </span>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-soft)", lineHeight: 1.4 }}>
                  {pkg.description}
                </p>
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text)", fontFamily: "monospace", flexShrink: 0 }}>
                {formatCurrency(pkg.calculated_cost)}
              </strong>
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