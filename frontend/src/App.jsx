import { useEffect, useState } from "react";
import { getProjectSummary } from "./services/api";

import {
  ArrowRight,
  Moon,
  Sun,
  MapPin,
  Ruler,
  Wallet,
  Clock3,
  House,
  LayoutDashboard,
  HardHat,
  Boxes,
  FileText,
} from "lucide-react";

import { useTheme } from "./context/ThemeContext";

import HousePlanner from "./pages/HousePlanner";
import GeneratedPlan from "./pages/GeneratedPlan";
import Construction from "./pages/Construction";
import Materials from "./pages/Materials";
import Reports from "./pages/Reports";


function App() {
  const { theme, toggleTheme } = useTheme();

  const [activePage, setActivePage] = useState("Dashboard");
  const [showGeneratedPlan, setShowGeneratedPlan] = useState(false);
  const [generatedForm, setGeneratedForm] = useState(null);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const navigation = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "House Planner",
      icon: House,
    },
    {
      name: "Construction",
      icon: HardHat,
    },
    {
      name: "Materials",
      icon: Boxes,
    },
    {
      name: "Reports",
      icon: FileText,
    },
  ];

  const openDashboard = () => {
    setShowGeneratedPlan(false);
    setActivePage("Dashboard");
  };

  const openPlanner = () => {
    setShowGeneratedPlan(false);
    setActivePage("House Planner");
  };

  const generatePlan = (form) => {
    setGeneratedForm(form);
    setShowGeneratedPlan(true);
  };

  return (
    <div className="app">

      {/* ============================================================
          NAVIGATION
      ============================================================ */}

      <header className="top-nav">

        <div className="logo">
          <span className="logo-mark">
            B
          </span>

          <div>
            <strong>
              BUILDWISE
            </strong>

            <small>
              HOME PLANNING
            </small>
          </div>
        </div>


        <nav className="desktop-nav">

          {navigation.map((item) => (
            <button
              key={item.name}
              className={
                activePage === item.name && !showGeneratedPlan
                  ? "nav-link active"
                  : "nav-link"
              }
              onClick={() => {
                setShowGeneratedPlan(false);
                setActivePage(item.name);
              }}
            >
              {item.name}
            </button>
          ))}

        </nav>


        <div className="nav-right">

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon size={17} />
            ) : (
              <Sun size={17} />
            )}
          </button>

          <div className="profile-circle">
            N
          </div>

        </div>

      </header>


      {/* ============================================================
          MAIN
      ============================================================ */}

      <main>

        {/* GENERATED HOUSE PLAN */}

        {showGeneratedPlan ? (

          <GeneratedPlan
            form={generatedForm}
            onBack={openPlanner}
          />

        ) : activePage === "Dashboard" ? (

          <Dashboard
            onStartPlanning={openPlanner}
          />

        ) : activePage === "House Planner" ? (

          <HousePlanner
            onBack={openDashboard}
            onGenerate={generatePlan}
          />

        ) : activePage === "Construction" ? (

          <Construction />

        ) : activePage === "Materials" ? (

          <Materials />

        ) : activePage === "Reports" ? (

          <Reports />

        ) : (

          <PlaceholderPage
            page={activePage}
          />

        )}

      </main>


      {/* ============================================================
          FOOTER
      ============================================================ */}

      <footer>

        <span>
          BUILDWISE
        </span>

        <span>
          Plan smarter. Build better.
        </span>

      </footer>

    </div>
  );
}


/* ================================================================
   DASHBOARD
================================================================ */

function Dashboard({ onStartPlanning }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProjectSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>

      {/* ==========================================================
          HERO
      ========================================================== */}

      <section className="hero">

        <div className="hero-content">

          <div className="eyebrow">
            <span></span>
            SMART HOUSE PLANNING
          </div>


          <h1>
            Build a home
            <br />

            <em>
              that fits your life.
            </em>
          </h1>


          <p>
            Plan your house around your plot, lifestyle and budget.
            BuildWise turns your requirements into a practical
            construction plan.
          </p>


          <div className="hero-actions">

            <button
              className="primary-button"
              onClick={onStartPlanning}
            >
              Start planning
              <ArrowRight size={17} />
            </button>


            <button className="text-button">
              Explore how it works
              <ArrowRight size={15} />
            </button>

          </div>

        </div>


        {/* ========================================================
            HOUSE VISUAL
        ======================================================== */}

        <div className="hero-visual">

          <div className="visual-label top-label">
            YOUR FUTURE HOME
          </div>


          <div className="house-drawing">

            <div className="roof"></div>


            <div className="house-body">

              <div className="window window-one"></div>

              <div className="window window-two"></div>

              <div className="door"></div>


              <div className="balcony">

                <span></span>
                <span></span>
                <span></span>
                <span></span>

              </div>

            </div>

          </div>


          <div className="visual-label bottom-label">

            <span>
              01
            </span>

            <span>
              RESIDENTIAL / CONCEPT
            </span>

          </div>

        </div>

      </section>


      {/* ==========================================================
          PROJECT SNAPSHOT
      ========================================================== */}

      {loading ? (
        <section className="section">
          <div className="section-heading-row">
            <div>
              <span className="small-label">CURRENT PROJECT</span>
              <h2>Loading project...</h2>
              <p>Fetching your latest construction plan details.</p>
            </div>
          </div>
        </section>
      ) : !summary?.has_project ? (
        <section className="section">
          <div className="section-heading-row">
            <div>
              <span className="small-label">NO ACTIVE PROJECT</span>
              <h2>Start your first house plan</h2>
              <p>Configure plot dimensions, room schedule, and budget to begin.</p>
            </div>
            <button className="primary-button" onClick={onStartPlanning}>
              Start planning
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="section">

            <div className="section-heading-row">

              <div>

                <span className="small-label">
                  CURRENT PROJECT
                </span>


                <h2>
                  {summary.name}
                </h2>


                <p>
                  <MapPin size={14} />
                  {summary.location}
                </p>

              </div>


              <span className="planning-badge">
                {summary.status || "Planning"}
              </span>

            </div>


            <div className="stats-row">

              <Stat
                icon={<Ruler size={18} />}
                label="Plot area"
                value={Number(summary.plot_area || 2400).toLocaleString()}
                unit="sq.ft"
              />


              <Stat
                icon={<House size={18} />}
                label="Built-up area"
                value={Number(summary.built_up_area || 1850).toLocaleString()}
                unit="sq.ft"
              />


              <Stat
                icon={<Wallet size={18} />}
                label="Estimated cost"
                value={summary.cost_formatted || `₹${((summary.estimated_cost || 3250000) / 100000).toFixed(1)}L`}
                unit={summary.budget_status || "within budget"}
              />


              <Stat
                icon={<Clock3 size={18} />}
                label="Estimated duration"
                value={String(summary.estimated_months || 10)}
                unit="months"
              />

            </div>

          </section>


          {/* ==========================================================
              PROJECT PROGRESS
          ========================================================== */}

          <section className="section progress-section">

            <div className="section-heading-row">

              <div>

                <span className="small-label">
                  PROJECT JOURNEY
                </span>


                <h2>
                  From plot to home
                </h2>

              </div>


              <span className="progress-number">
                {summary.progress_percent || 0}%
              </span>

            </div>


            <div className="timeline">

              <div className="timeline-line">

                <div
                  style={{
                    width: `${summary.progress_percent || 0}%`,
                  }}
                />

              </div>


              {(summary.timeline_steps || []).map((step, idx) => (
                <TimelineItem
                  key={step.name}
                  number={String(idx + 1).padStart(2, "0")}
                  title={step.name}
                  active={step.status === "active"}
                />
              ))}

            </div>

          </section>
        </>
      )}


      {/* ==========================================================
          QUICK START
      ========================================================== */}

      <section className="section quick-start-section">

        <div className="section-heading-row">

          <div>

            <span className="small-label">
              QUICK START
            </span>

            <h2>
              Ready to plan your home?
            </h2>

          </div>

        </div>


        <div className="quick-start-card">

          <div>

            <span className="small-label">
              HOUSE PLANNER
            </span>

            <h3>
              Start with your plot.
            </h3>

            <p>
              Enter your plot dimensions, requirements,
              number of bedrooms and budget to generate
              a suitable house plan.
            </p>

          </div>


          <button
            className="primary-button"
            onClick={onStartPlanning}
          >
            Start planning
            <ArrowRight size={17} />
          </button>

        </div>

      </section>

    </>
  );
}


/* ================================================================
   STAT CARD
================================================================ */

function Stat({
  icon,
  label,
  value,
  unit,
}) {

  return (
    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>


      <div className="stat-content">

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {unit}
        </small>

      </div>

    </div>
  );
}


/* ================================================================
   TIMELINE ITEM
================================================================ */

function TimelineItem({
  number,
  title,
  active = false,
}) {

  return (
    <div
      className={
        active
          ? "timeline-item active"
          : "timeline-item"
      }
    >

      <div className="timeline-number">
        {number}
      </div>


      <div className="timeline-title">
        {title}
      </div>

    </div>
  );
}


/* ================================================================
   PLACEHOLDER
================================================================ */

function PlaceholderPage({ page }) {

  const icons = {
    Construction: <HardHat size={42} />,
    Materials: <Boxes size={42} />,
    Reports: <FileText size={42} />,
  };


  return (
    <section className="placeholder">

      <span className="placeholder-number">
        {icons[page]}
      </span>


      <span className="small-label">
        BUILDWISE / {page.toUpperCase()}
      </span>


      <h1>
        {page}
      </h1>


      <p>
        We're building this part of BuildWise next.
      </p>

    </section>
  );
}


export default App;