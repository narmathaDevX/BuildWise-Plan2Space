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
} from "lucide-react";

function Construction() {
  const stages = [
    {
      name: "Site Preparation",
      description: "Land clearing, marking and excavation",
      progress: 100,
      status: "completed",
      icon: Hammer,
    },
    {
      name: "Foundation",
      description: "Footing, foundation and ground beam",
      progress: 100,
      status: "completed",
      icon: HardHat,
    },
    {
      name: "Structure",
      description: "Columns, beams and slab construction",
      progress: 75,
      status: "active",
      icon: Home,
    },
    {
      name: "Walls & Partitions",
      description: "Brickwork and internal partitions",
      progress: 35,
      status: "upcoming",
      icon: Home,
    },
    {
      name: "Electrical",
      description: "Wiring, switches and electrical points",
      progress: 10,
      status: "upcoming",
      icon: Zap,
    },
    {
      name: "Plumbing",
      description: "Water supply and drainage systems",
      progress: 10,
      status: "upcoming",
      icon: Droplets,
    },
    {
      name: "Flooring & Finishing",
      description: "Flooring, painting and final finishes",
      progress: 0,
      status: "upcoming",
      icon: Paintbrush,
    },
  ];

  const completedStages = stages.filter(
    (stage) => stage.progress === 100
  ).length;

  const overallProgress = Math.round(
    stages.reduce((sum, stage) => sum + stage.progress, 0) /
      stages.length
  );

  const currentStage =
    stages.find((stage) => stage.status === "active") ||
    stages[stages.length - 1];

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

        <div className="construction-status">

          <div className="status-icon">
            <HardHat size={22} />
          </div>

          <div>
            <span>PROJECT STATUS</span>
            <strong>Under construction</strong>
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
            March 2027
          </strong>

          <small>
            Approximately 6 months remaining
          </small>

        </div>


        <div className="construction-stat-card">

          <div className="construction-stat-icon">
            <CalendarDays size={20} />
          </div>

          <span>CURRENT PHASE</span>

          <strong>
            Structure
          </strong>

          <small>
            Target completion: 75%
          </small>

        </div>

      </section>


      {/* ======================================================
          CURRENT STAGE
      ====================================================== */}

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


                  <p>
                    {stage.description}
                  </p>


                  <div className="stage-bottom">

                    <div className="stage-progress-bar">

                      <div
                        style={{
                          width: `${stage.progress}%`,
                        }}
                      />

                    </div>

                    <strong>
                      {stage.progress}%
                    </strong>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </section>


      {/* ======================================================
          PROJECT INSIGHTS
      ====================================================== */}

      <section className="construction-insights">

        <div className="section-heading">

          <div>
            <span className="eyebrow">
              PROJECT INSIGHTS
            </span>

            <h2>
              What to watch next
            </h2>
          </div>

        </div>


        <div className="insight-grid">

          <div className="insight-card">

            <div className="insight-icon">
              <TrendingUp size={19} />
            </div>

            <div>
              <span>
                NEXT MILESTONE
              </span>

              <strong>
                Complete structure
              </strong>

              <p>
                Finish the remaining 25% of the structural
                work before moving into wall construction.
              </p>
            </div>

            <ArrowUpRight size={17} />

          </div>


          <div className="insight-card">

            <div className="insight-icon">
              <Zap size={19} />
            </div>

            <div>
              <span>
                UPCOMING
              </span>

              <strong>
                Electrical planning
              </strong>

              <p>
                Electrical points and wiring locations should
                be finalized before wall finishing begins.
              </p>
            </div>

            <ArrowUpRight size={17} />

          </div>


          <div className="insight-card">

            <div className="insight-icon">
              <Droplets size={19} />
            </div>

            <div>
              <span>
                UPCOMING
              </span>

              <strong>
                Plumbing work
              </strong>

              <p>
                Coordinate water supply and drainage routes
                with the bathroom and kitchen layout.
              </p>
            </div>

            <ArrowUpRight size={17} />

          </div>

        </div>

      </section>

    </main>
  );
}

export default Construction;