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

function Reports() {
  const budget = 3500000;
  const estimatedCost = 3250000;
  const remaining = budget - estimatedCost;

  const costBreakdown = [
    {
      name: "Structure",
      amount: 1120000,
      percentage: 34,
    },
    {
      name: "Masonry",
      amount: 585000,
      percentage: 18,
    },
    {
      name: "Electrical & Plumbing",
      amount: 487500,
      percentage: 15,
    },
    {
      name: "Flooring & Finishing",
      amount: 682500,
      percentage: 21,
    },
    {
      name: "Doors & Windows",
      amount: 325000,
      percentage: 10,
    },
  ];

  const formatCurrency = (value) =>
    `₹${value.toLocaleString("en-IN")}`;

  return (
    <main className="reports-page">

      {/* HEADER */}

      <section className="reports-header">

        <div>

          <span className="eyebrow">
            BUILDWISE / REPORTS
          </span>

          <h1>
            Project Report
          </h1>

          <p>
            A consolidated overview of your house plan,
            budget, construction progress and materials.
          </p>

        </div>

        <button
          className="primary-button"
          onClick={() => window.print()}
        >
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

            <span className="small-label">
              RESIDENTIAL PROJECT
            </span>

            <h2>
              My Dream Home
            </h2>

            <p>
              Tamil Nadu · Preliminary planning report
            </p>

          </div>

        </div>


        <div className="report-status">
          <CheckCircle2 size={15} />
          Planning active
        </div>

      </section>


      {/* KEY METRICS */}

      <section className="report-metrics">

        <div className="report-metric">

          <div className="report-metric-icon">
            <Ruler size={19} />
          </div>

          <span>
            Plot area
          </span>

          <strong>
            2,400 sq.ft
          </strong>

        </div>


        <div className="report-metric">

          <div className="report-metric-icon">
            <House size={19} />
          </div>

          <span>
            Built-up area
          </span>

          <strong>
            1,850 sq.ft
          </strong>

        </div>


        <div className="report-metric">

          <div className="report-metric-icon">
            <HardHat size={19} />
          </div>

          <span>
            Construction progress
          </span>

          <strong>
            18%
          </strong>

        </div>


        <div className="report-metric">

          <div className="report-metric-icon">
            <Package size={19} />
          </div>

          <span>
            Materials purchased
          </span>

          <strong>
            2 / 6
          </strong>

        </div>

      </section>


      {/* MAIN REPORT GRID */}

      <section className="reports-grid">

        {/* BUDGET REPORT */}

        <div className="report-panel budget-report">

          <div className="report-panel-header">

            <div>

              <span className="small-label">
                COST SUMMARY
              </span>

              <h2>
                Budget overview
              </h2>

            </div>

            <IndianRupee size={20} />

          </div>


          <div className="report-budget-main">

            <span>
              Estimated construction cost
            </span>

            <strong>
              {formatCurrency(estimatedCost)}
            </strong>

            <small>
              of {formatCurrency(budget)} planned budget
            </small>

          </div>


          <div className="report-budget-bar">

            <div
              style={{
                width: `${(estimatedCost / budget) * 100}%`,
              }}
            />

          </div>


          <div className="report-budget-footer">

            <span>
              Used
              <strong>
                {Math.round((estimatedCost / budget) * 100)}%
              </strong>
            </span>

            <span>
              Remaining
              <strong>
                {formatCurrency(remaining)}
              </strong>
            </span>

          </div>

        </div>


        {/* CONSTRUCTION REPORT */}

        <div className="report-panel">

          <div className="report-panel-header">

            <div>

              <span className="small-label">
                CONSTRUCTION
              </span>

              <h2>
                Project progress
              </h2>

            </div>

            <TrendingUp size={20} />

          </div>


          <div className="construction-report-progress">

            <div className="progress-circle">

              <strong>
                18%
              </strong>

              <span>
                complete
              </span>

            </div>


            <div className="construction-report-info">

              <div>
                <span>Completed</span>
                <strong>2 stages</strong>
              </div>

              <div>
                <span>Current phase</span>
                <strong>Structure</strong>
              </div>

              <div>
                <span>Expected completion</span>
                <strong>March 2027</strong>
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* COST BREAKDOWN */}

      <section className="report-section">

        <div className="report-section-heading">

          <div>

            <span className="small-label">
              ESTIMATE
            </span>

            <h2>
              Cost breakdown
            </h2>

          </div>

          <span>
            {formatCurrency(estimatedCost)}
          </span>

        </div>


        <div className="cost-breakdown">

          {costBreakdown.map((item) => (

            <div
              className="cost-row"
              key={item.name}
            >

              <div className="cost-name">

                <span>
                  {item.name}
                </span>

                <small>
                  {item.percentage}% of estimated cost
                </small>

              </div>


              <div className="cost-bar">

                <div
                  style={{
                    width: `${item.percentage * 2.5}%`,
                  }}
                />

              </div>


              <strong>
                {formatCurrency(item.amount)}
              </strong>

            </div>

          ))}

        </div>

      </section>


      {/* PROJECT STATUS */}

      <section className="report-section">

        <div className="report-section-heading">

          <div>

            <span className="small-label">
              PROJECT STATUS
            </span>

            <h2>
              Current position
            </h2>

          </div>

        </div>


        <div className="report-status-grid">

          <div className="report-status-card">

            <CheckCircle2 size={19} />

            <div>

              <strong>
                Planning
              </strong>

              <span>
                Requirements and house plan prepared
              </span>

            </div>

            <b>
              Complete
            </b>

          </div>


          <div className="report-status-card">

            <CheckCircle2 size={19} />

            <div>

              <strong>
                Foundation
              </strong>

              <span>
                Foundation stage completed
              </span>

            </div>

            <b>
              Complete
            </b>

          </div>


          <div className="report-status-card active">

            <Clock3 size={19} />

            <div>

              <strong>
                Structure
              </strong>

              <span>
                Structural work currently underway
              </span>

            </div>

            <b>
              75%
            </b>

          </div>


          <div className="report-status-card">

            <Clock3 size={19} />

            <div>

              <strong>
                Finishing
              </strong>

              <span>
                Yet to begin
              </span>

            </div>

            <b>
              Pending
            </b>

          </div>

        </div>

      </section>


      {/* REPORT FOOTNOTE */}

      <section className="report-disclaimer">

        <FileText size={18} />

        <div>

          <strong>
            Preliminary project report
          </strong>

          <p>
            This report uses the current planning estimates
            and sample construction data. Final costs,
            quantities, schedules and structural decisions
            should be verified by qualified professionals
            before construction.
          </p>

        </div>

      </section>

    </main>
  );
}

export default Reports;