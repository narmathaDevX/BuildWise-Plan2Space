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
  CheckSquare,
  Square,
  Plus,
  FastForward,
} from "lucide-react";
import {
  getProjectConstruction,
  getProjectTasks,
  updateProjectTask,
  postponeProjectTask,
  createProjectTask,
} from "../services/api";

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

  // Daily Tasks Checklist State
  const [currentDay, setCurrentDay] = useState(1);
  const [tasksData, setTasksData] = useState(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    trade: "General Masonry",
    stage_key: "foundation",
    is_critical: false,
  });

  const loadTasks = async (dayToLoad) => {
    try {
      setTasksLoading(true);
      const res = await getProjectTasks(dayToLoad);
      if (res) {
        setTasksData(res);
        if (dayToLoad === null || dayToLoad === undefined) {
          setCurrentDay(res.selected_day || 1);
        }
      }
    } catch (err) {
      console.error("Failed to load daily tasks:", err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadTasks(currentDay);
  }, [currentDay]);

  const handleToggleTask = async (task) => {
    const updatedStatus = !task.completed;
    setTasksData((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id ? { ...t, completed: updatedStatus } : t
      );
      const diff = updatedStatus ? 1 : -1;
      return {
        ...prev,
        tasks: updatedTasks,
        completed_tasks: Math.max(0, prev.completed_tasks + diff),
        day_completed_tasks: Math.max(0, prev.day_completed_tasks + diff),
      };
    });

    try {
      await updateProjectTask(task.id, { completed: updatedStatus });
    } catch (err) {
      console.error("Failed to update task status:", err);
      loadTasks(currentDay);
    }
  };

  const handlePostponeTask = async (task) => {
    try {
      setTasksLoading(true);
      await postponeProjectTask(task.id);
      await loadTasks(currentDay);
    } catch (err) {
      console.error("Failed to postpone task:", err);
      alert("Unable to postpone task. Please try again.");
      setTasksLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      setTaskSubmitting(true);
      await createProjectTask({
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        trade: newTask.trade,
        stage_key: newTask.stage_key,
        day_number: currentDay,
        is_critical: newTask.is_critical,
      });
      setShowAddTask(false);
      setNewTask({
        title: "",
        description: "",
        trade: "General Masonry",
        stage_key: "foundation",
        is_critical: false,
      });
      await loadTasks(currentDay);
    } catch (err) {
      console.error("Failed to create task:", err);
      alert("Failed to add task.");
    } finally {
      setTaskSubmitting(false);
    }
  };

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

  const activeDay = currentDay ?? tasksData?.selected_day ?? 1;

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
          DAY-TO-DAY WORK CHECKLIST
      ====================================================== */}

      <section className="construction-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              DAILY SITE EXECUTION CHECKLIST
            </span>
            <h2>
              Day {activeDay} of {tasksData?.max_day || 40} Site Tasks
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <button
                type="button"
                className="icon-button"
                aria-label="Previous day"
                onClick={() => setCurrentDay(Math.max(1, activeDay - 1))}
                disabled={activeDay <= 1}
                style={{ padding: "4px", background: "none", border: "none", cursor: activeDay <= 1 ? "not-allowed" : "pointer", opacity: activeDay <= 1 ? 0.3 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, minWidth: "70px", textAlign: "center" }}>
                Day {activeDay}
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="Next day"
                onClick={() => setCurrentDay(Math.min(tasksData?.max_day || 40, activeDay + 1))}
                disabled={activeDay >= (tasksData?.max_day || 40)}
                style={{ padding: "4px", background: "none", border: "none", cursor: activeDay >= (tasksData?.max_day || 40) ? "not-allowed" : "pointer", opacity: activeDay >= (tasksData?.max_day || 40) ? 0.3 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              type="button"
              className="outline-button"
              style={{ fontSize: "0.85rem", padding: "6px 12px" }}
              onClick={() => setShowAddTask((prev) => !prev)}
            >
              <Plus size={15} />
              {showAddTask ? "Cancel" : "Add Site Task"}
            </button>
          </div>
        </div>

        {/* DAY PROGRESS SUMMARY BANNER */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", background: "var(--surface-2)", color: "var(--accent)" }}>
              Stage: {tasksData?.stage_key?.replace("_", " ").toUpperCase() || "CONSTRUCTION"}
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>
              <strong>{tasksData?.day_completed_tasks || 0}</strong> of <strong>{tasksData?.day_total_tasks || 0}</strong> tasks completed today
            </span>
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>
            Overall Site Checklist: <strong>{tasksData?.completed_tasks || 0}/{tasksData?.total_tasks || 0}</strong> ({tasksData?.overall_completion_pct || 0}%)
          </div>
        </div>

        {/* INLINE ADD TASK FORM */}
        {showAddTask && (
          <form onSubmit={handleCreateTask} style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: "10px", padding: "18px", marginBottom: "20px" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)", letterSpacing: "1px", marginBottom: "12px" }}>
              ADD NEW WORK ITEM FOR DAY {activeDay}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "14px" }}>
              <input
                type="text"
                placeholder="Work title (e.g. Shuttering alignment check)"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
                style={{ padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", borderRadius: "6px", fontSize: "13px" }}
              />
              <input
                type="text"
                placeholder="Trade (e.g. Shuttering Carpenter, Mason)"
                value={newTask.trade}
                onChange={(e) => setNewTask({ ...newTask, trade: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", borderRadius: "6px", fontSize: "13px" }}
              />
              <select
                value={newTask.stage_key}
                onChange={(e) => setNewTask({ ...newTask, stage_key: e.target.value })}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", borderRadius: "6px", fontSize: "13px" }}
              >
                <option value="site_prep">Site Preparation</option>
                <option value="foundation">Foundation</option>
                <option value="structure">Structure</option>
                <option value="walls">Walls & Partitions</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="finishing">Finishing</option>
              </select>
            </div>
            <textarea
              placeholder="Task instructions, specification notes, inspection checklist..."
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={2}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", borderRadius: "6px", fontSize: "13px", marginBottom: "12px" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="primary-button" disabled={taskSubmitting} style={{ fontSize: "13px", padding: "6px 14px" }}>
                {taskSubmitting ? "Adding..." : "Add to Day Schedule"}
              </button>
              <button type="button" className="outline-button" onClick={() => setShowAddTask(false)} style={{ fontSize: "13px", padding: "6px 14px" }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* TASKS LIST */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {tasksLoading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-soft)", background: "var(--surface)", borderRadius: "10px" }}>
              Loading tasks for Day {activeDay}...
            </div>
          ) : !tasksData?.tasks?.length ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-soft)", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "14px" }}>No tasks scheduled for Day {activeDay}.</p>
              <p style={{ margin: "6px 0 0", fontSize: "12px" }}>You can add a custom work item above or check other days.</p>
            </div>
          ) : (
            tasksData.tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "14px",
                  padding: "16px",
                  borderRadius: "10px",
                  background: task.completed ? "var(--surface-2)" : "var(--surface)",
                  border: task.completed ? "1px solid var(--border)" : "1px solid var(--border)",
                  opacity: task.completed ? 0.8 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1 }}>
                  {/* CHECKBOX */}
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task)}
                    title={task.completed ? "Mark incomplete" : "Click to mark completed"}
                    style={{ background: "none", border: "none", padding: "2px 0 0", cursor: "pointer", color: task.completed ? "#22c55e" : "var(--text-soft)" }}
                  >
                    {task.completed ? <CheckSquare size={22} /> : <Square size={22} />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "15px", textDecoration: task.completed ? "line-through" : "none", color: task.completed ? "var(--text-soft)" : "var(--text)" }}>
                        {task.title}
                      </strong>

                      {task.trade && (
                        <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "4px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-soft)" }}>
                          {task.trade}
                        </span>
                      )}

                      {task.is_critical && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                          CRITICAL PATH
                        </span>
                      )}

                      {task.postponed_count > 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                          Postponed +{task.postponed_count} {task.postponed_count === 1 ? "day" : "days"}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-soft)", lineHeight: 1.4 }}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* POSTPONE BUTTON & STATUS */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {task.completed ? (
                    <span style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={14} /> Done
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="outline-button"
                      onClick={() => handlePostponeTask(task)}
                      title="Postpone this work to the next construction day"
                      style={{ fontSize: "12px", padding: "5px 10px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
                    >
                      <FastForward size={13} />
                      Postpone (+1 Day)
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
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