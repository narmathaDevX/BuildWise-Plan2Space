import { useState, useEffect, useMemo } from "react";
import {
  BookmarkCheck,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Box,
  Layers,
  Download,
  Calendar,
  Ruler,
  Wallet,
  Home,
  CheckCircle2,
  Edit3,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Maximize2,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Package,
  FileText,
} from "lucide-react";
import { getSavedPlans, updateSavedPlan, deleteSavedPlan } from "../services/api";
import FloorPlanBlueprint from "../components/FloorPlanBlueprint";
import PlanDossierModal from "../components/PlanDossierModal";

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "₹0";
  const num = Math.round(Number(amount));
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString("en-IN")}`;
}

export default function SavedPlans({ onOpenPlan, onNavigatePlanner }) {
  const [savedPlans, setSavedPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected Plan for Detail Inspector
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activeTab, setActiveTab] = useState("materials"); // "materials" | "cost" | "specs" | "notes"
  const [dossierPlan, setDossierPlan] = useState(null); // Plan for full details dossier modal

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [bhkFilter, setBhkFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "cost_desc" | "cost_asc" | "area_desc"

  // Editing notes/title
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Fetch saved plans
  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSavedPlans();
      const list = res?.saved_plans || [];
      setSavedPlans(list);
      if (list.length > 0 && !selectedPlanId) {
        setSelectedPlanId(list[0].id);
        setNotesText(list[0].notes || "");
      }
    } catch (err) {
      console.error("Failed to fetch saved plans:", err);
      setError(err.message || "Failed to load saved plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();

    const handleSavedUpdated = () => {
      fetchPlans();
    };
    window.addEventListener("buildwise:saved-plans-updated", handleSavedUpdated);
    return () => {
      window.removeEventListener("buildwise:saved-plans-updated", handleSavedUpdated);
    };
  }, []);

  // Sync selected plan details
  const selectedPlan = useMemo(() => {
    return savedPlans.find((p) => p.id === selectedPlanId) || savedPlans[0] || null;
  }, [savedPlans, selectedPlanId]);

  useEffect(() => {
    if (selectedPlan) {
      setNotesText(selectedPlan.notes || "");
      setTempTitle(selectedPlan.title || "");
    }
  }, [selectedPlanId, selectedPlan]);

  // Filtered & Sorted list
  const filteredPlans = useMemo(() => {
    return savedPlans
      .filter((p) => {
        if (bhkFilter !== "all") {
          const beds = Number(p.bedrooms || 0);
          if (bhkFilter === "2" && beds !== 2) return false;
          if (bhkFilter === "3" && beds !== 3) return false;
          if (bhkFilter === "4" && beds < 4) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (p.title || "").toLowerCase().includes(q);
          const matchNotes = (p.notes || "").toLowerCase().includes(q);
          const matchFacing = (p.facing || "").toLowerCase().includes(q);
          return matchTitle || matchNotes || matchFacing;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        if (sortBy === "cost_desc") {
          return (b.estimated_cost || 0) - (a.estimated_cost || 0);
        }
        if (sortBy === "cost_asc") {
          return (a.estimated_cost || 0) - (b.estimated_cost || 0);
        }
        if (sortBy === "area_desc") {
          return (b.built_up_area || 0) - (a.built_up_area || 0);
        }
        return 0;
      });
  }, [savedPlans, bhkFilter, searchQuery, sortBy]);

  // Overall portfolio stats
  const portfolioStats = useMemo(() => {
    if (!savedPlans.length) return { totalPlans: 0, totalVal: 0, avgArea: 0, avgScore: 0 };
    const totalVal = savedPlans.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
    const totalArea = savedPlans.reduce((sum, p) => sum + (p.built_up_area || 0), 0);
    const totalScore = savedPlans.reduce((sum, p) => sum + (p.score || 0), 0);
    return {
      totalPlans: savedPlans.length,
      totalVal,
      avgArea: Math.round(totalArea / savedPlans.length),
      avgScore: Math.round((totalScore / savedPlans.length) * 10) / 10,
    };
  }, [savedPlans]);

  // Actions
  const handleDeletePlan = async (id, title) => {
    if (!confirm(`Are you sure you want to delete "${title || "this plan"}" from your saved history?`)) {
      return;
    }
    try {
      await deleteSavedPlan(id);
      window.dispatchEvent(new CustomEvent("buildwise:saved-plans-updated"));
      if (selectedPlanId === id) {
        const remaining = savedPlans.filter((p) => p.id !== id);
        setSelectedPlanId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      alert("Failed to delete plan: " + (err.message || "Unknown error"));
    }
  };

  const handleSaveTitle = async () => {
    if (!selectedPlan || !tempTitle.trim()) return;
    try {
      await updateSavedPlan(selectedPlan.id, { title: tempTitle.trim(), notes: notesText });
      setEditingTitle(false);
      setFeedbackMsg("Title updated successfully!");
      setTimeout(() => setFeedbackMsg(null), 3000);
      fetchPlans();
    } catch (err) {
      alert("Failed to update title: " + err.message);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedPlan) return;
    setSavingNotes(true);
    try {
      await updateSavedPlan(selectedPlan.id, { title: selectedPlan.title, notes: notesText });
      setFeedbackMsg("Notes saved to database!");
      setTimeout(() => setFeedbackMsg(null), 3000);
      fetchPlans();
    } catch (err) {
      alert("Failed to save notes: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedPlan) return;
    const mats = selectedPlan.materials_breakdown?.materials || [];
    if (!mats.length) {
      alert("No material schedule available for this plan.");
      return;
    }

    const headers = ["Item Name", "Category", "Quantity", "Unit", "Unit Rate (INR)", "Estimated Cost (INR)", "Description"];
    const rows = mats.map((m) => [
      `"${m.name || ""}"`,
      `"${m.category || ""}"`,
      m.quantity || 0,
      `"${m.unit || ""}"`,
      m.rate || 0,
      m.estimated_cost || 0,
      `"${(m.description || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BuildWise_Materials_${(selectedPlan.title || "Plan").replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInViewer = (planObj) => {
    if (onOpenPlan) {
      onOpenPlan(planObj);
    }
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>
      {/* 1. Header Banner & KPI Summary */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "24px 28px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--accent)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
              <BookmarkCheck size={18} />
              Saved Plans & Cost History
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
              Architectural Portfolio & Material Schedules
            </h1>
            <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--text-soft)", maxWidth: "680px" }}>
              Access all your saved client floor plans, itemized Tamil Nadu PWD material requirements, and estimated project construction budgets in one place.
            </p>
          </div>

          <button
            onClick={onNavigatePlanner}
            className="primary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px", fontSize: "0.88rem", fontWeight: 700 }}
          >
            <Sparkles size={16} />
            Generate New Plan
          </button>
        </div>

        {/* Portfolio Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ background: "var(--surface-2)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Total Saved Plans</span>
            <strong style={{ fontSize: "1.4rem", color: "var(--text)", fontWeight: 800 }}>{portfolioStats.totalPlans}</strong>
          </div>
          <div style={{ background: "var(--surface-2)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Total Portfolio Value</span>
            <strong style={{ fontSize: "1.4rem", color: "var(--accent)", fontWeight: 800 }}>{formatCurrency(portfolioStats.totalVal)}</strong>
          </div>
          <div style={{ background: "var(--surface-2)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Average Built-up Area</span>
            <strong style={{ fontSize: "1.4rem", color: "var(--text)", fontWeight: 800 }}>{portfolioStats.avgArea.toLocaleString("en-IN")} <small style={{ fontSize: "0.75rem", fontWeight: 500 }}>sq.ft</small></strong>
          </div>
          <div style={{ background: "var(--surface-2)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Average Design Score</span>
            <strong style={{ fontSize: "1.4rem", color: "#16a34a", fontWeight: 800 }}>{portfolioStats.avgScore} <small style={{ fontSize: "0.75rem", fontWeight: 500 }}>/ 100</small></strong>
          </div>
        </div>
      </div>

      {/* 2. Loading / Empty State */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <p>Loading your saved portfolio...</p>
        </div>
      ) : savedPlans.length === 0 ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: "16px",
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <Home size={48} color="var(--accent)" style={{ margin: "0 auto 16px", opacity: 0.8 }} />
          <h3 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "var(--text)" }}>No saved plans in history yet</h3>
          <p style={{ margin: "0 0 20px", color: "var(--text-soft)", fontSize: "0.92rem", maxWidth: "480px", marginInline: "auto" }}>
            Generate a floor plan using the House Planner, and click the bookmark button to save it along with its full materials schedule and cost breakdown.
          </p>
          <button
            onClick={onNavigatePlanner}
            className="primary-button"
            style={{ padding: "10px 20px", fontSize: "0.9rem" }}
          >
            Start Planning Now
          </button>
        </div>
      ) : (
        /* 3. Main Master-Detail Workspace */
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "20px", alignItems: "start" }}>
          {/* Left Column: Filterable List of Saved Plans */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Search & Filters */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search saved plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 32px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Filter Pills */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[
                    { id: "all", label: "All" },
                    { id: "2", label: "2BHK" },
                    { id: "3", label: "3BHK" },
                    { id: "4", label: "4+ BHK" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setBhkFilter(f.id)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        fontWeight: bhkFilter === f.id ? 700 : 500,
                        background: bhkFilter === f.id ? "var(--accent)" : "var(--surface-2)",
                        color: bhkFilter === f.id ? "#fff" : "var(--text)",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    fontSize: "0.72rem",
                    padding: "3px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                  }}
                >
                  <option value="newest">Newest First</option>
                  <option value="cost_desc">Cost: High to Low</option>
                  <option value="cost_asc">Cost: Low to High</option>
                  <option value="area_desc">Largest Area</option>
                </select>
              </div>
            </div>

            {/* Plans List Scrollbox */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "780px", overflowY: "auto", paddingRight: "4px" }}>
              {filteredPlans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    style={{
                      background: "var(--surface)",
                      border: "2px solid",
                      borderColor: isSelected ? "var(--accent)" : "var(--border)",
                      borderRadius: "12px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 16px rgba(185, 104, 72, 0.15)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "0.94rem", color: "var(--text)", lineHeight: 1.3 }}>
                        {plan.title || "Untitled House Plan"}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(22, 163, 74, 0.12)",
                          color: "#16a34a",
                        }}
                      >
                        ★ {Math.round(plan.score || 90)}
                      </span>
                    </div>

                    {/* Specs Badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>
                        🛏️ {plan.bedrooms || 3} BHK
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>
                        🚿 {plan.bathrooms || 2} Bath
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>
                        🧭 {plan.facing || "North"}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-soft)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>
                        📏 {Math.round(plan.built_up_area || 1500)} sq.ft
                      </span>
                    </div>

                    {/* Cost & Date Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent)" }}>
                        {formatCurrency(plan.estimated_cost)}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInViewer(plan);
                          }}
                          title="Open Blueprint & 3D Model"
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.72rem",
                            borderRadius: "4px",
                            background: "var(--accent)",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLink size={12} />
                          Editor
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlan(plan.id, plan.title);
                          }}
                          title="Delete from saved history"
                          style={{
                            padding: "4px 6px",
                            borderRadius: "4px",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* High-Visibility Primary Action: View All Information (Plan, Budget & Materials) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDossierPlan(plan);
                      }}
                      title="View complete dossier including 2D floor plan, budget breakdown and material schedule"
                      style={{
                        width: "100%",
                        marginTop: "10px",
                        padding: "8px 12px",
                        background: "linear-gradient(135deg, var(--accent), #c25e36)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        boxShadow: "0 2px 6px rgba(185, 104, 72, 0.25)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <FileText size={14} />
                      View Plan, Budget & Materials
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Plan Inspector */}
          {selectedPlan && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 6px 24px rgba(0,0,0,0.05)",
              }}
            >
              {/* Header Bar */}
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  {editingTitle ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid var(--accent)",
                          background: "var(--surface)",
                          color: "var(--text)",
                        }}
                      />
                      <button
                        onClick={handleSaveTitle}
                        style={{ padding: "5px 10px", borderRadius: "6px", background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>
                        {selectedPlan.title}
                      </h2>
                      <button
                        onClick={() => setEditingTitle(true)}
                        title="Edit Plan Title"
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px", fontSize: "0.78rem", color: "var(--text-soft)" }}>
                    <span>Saved on: {selectedPlan.created_at ? new Date(selectedPlan.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}</span>
                    <span>•</span>
                    <span>Plot: {selectedPlan.plot_width || 40}' × {selectedPlan.plot_length || 60}'</span>
                    <span>•</span>
                    <span>Built-up: {Math.round(selectedPlan.built_up_area || 1500)} sq.ft</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setDossierPlan(selectedPlan)}
                    title="View complete dossier including 2D floor plan, budget breakdown and material schedule"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: "linear-gradient(135deg, var(--accent), #c25e36)",
                      color: "#ffffff",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(185, 104, 72, 0.25)",
                    }}
                  >
                    <FileText size={15} />
                    View Plan, Budget & Materials
                  </button>

                  <button
                    onClick={handleExportCSV}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      fontSize: "0.8rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} />
                    Export Materials (CSV)
                  </button>

                  <button
                    onClick={() => handleOpenInViewer(selectedPlan)}
                    className="primary-button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                    }}
                  >
                    <Box size={15} />
                    Open in Planner Editor
                  </button>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border)",
                  padding: "0 24px",
                  background: "var(--surface)",
                  gap: "18px",
                }}
              >
                {[
                  { id: "materials", label: "🧱 Materials Required", icon: Package },
                  { id: "cost", label: "💰 Cost Breakdown", icon: Wallet },
                  { id: "specs", label: "📐 2D Blueprint & Specs", icon: Ruler },
                  { id: "notes", label: "📝 Notes & Remarks", icon: Edit3 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "12px 4px",
                      border: "none",
                      borderBottom: activeTab === tab.id ? "3px solid var(--accent)" : "3px solid transparent",
                      background: "transparent",
                      color: activeTab === tab.id ? "var(--accent)" : "var(--text-soft)",
                      fontWeight: activeTab === tab.id ? 700 : 500,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {feedbackMsg && (
                <div style={{ background: "rgba(22, 163, 74, 0.12)", color: "#16a34a", padding: "8px 24px", fontSize: "0.82rem", fontWeight: 600 }}>
                  ✓ {feedbackMsg}
                </div>
              )}

              {/* Tab Contents */}
              <div style={{ padding: "24px" }}>
                {/* ========================================================
                    TAB 1: MATERIALS REQUIRED
                ======================================================== */}
                {activeTab === "materials" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "var(--text)" }}>
                          Itemized Material Schedule for "{selectedPlan.title}"
                        </h3>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Computed specifically for {Math.round(selectedPlan.built_up_area || 1500)} sq.ft built-up area under Tamil Nadu PWD / BAI 2025-26 rates.
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Materials Subtotal</span>
                        <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--accent)" }}>
                          {formatCurrency(selectedPlan.materials_breakdown?.total_cost || selectedPlan.estimated_cost * 0.65)}
                        </div>
                      </div>
                    </div>

                    {/* Materials Table */}
                    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "10px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                            <th style={{ padding: "10px 14px", color: "var(--text)" }}>Material Item</th>
                            <th style={{ padding: "10px 14px", color: "var(--text)" }}>Category</th>
                            <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>Quantity Required</th>
                            <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>Standard Rate</th>
                            <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>Estimated Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedPlan.materials_breakdown?.materials || []).map((m, idx) => (
                            <tr
                              key={m.key || idx}
                              style={{
                                borderBottom: "1px solid var(--border)",
                                background: idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                              }}
                            >
                              <td style={{ padding: "10px 14px" }}>
                                <strong style={{ color: "var(--text)" }}>{m.name}</strong>
                                {m.description && (
                                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    {m.description}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    background: "rgba(185, 104, 72, 0.12)",
                                    color: "var(--accent)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {m.category}
                                </span>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                                {m.quantity?.toLocaleString("en-IN")} <span style={{ fontSize: "0.74rem", fontWeight: 500, color: "var(--text-soft)" }}>{m.unit}</span>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-soft)" }}>
                                ₹{m.rate?.toLocaleString("en-IN")}/{m.unit}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>
                                ₹{m.estimated_cost?.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================
                    TAB 2: COST BREAKDOWN
                ======================================================== */}
                {activeTab === "cost" && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                      <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Total Estimated Project Cost</span>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent)", marginTop: "4px" }}>
                          {formatCurrency(selectedPlan.estimated_cost)}
                        </div>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                          Rate: ₹{selectedPlan.cost_breakdown?.effective_rate_per_sqft || "2,080"} per sq.ft • {selectedPlan.quality || "Standard"} Quality
                        </span>
                      </div>

                      <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Uncertainty / Tolerance Band (±5%)</span>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", marginTop: "4px" }}>
                          {formatCurrency(selectedPlan.cost_breakdown?.uncertainty_range?.low || selectedPlan.estimated_cost * 0.95)} — {formatCurrency(selectedPlan.cost_breakdown?.uncertainty_range?.high || selectedPlan.estimated_cost * 1.05)}
                        </div>
                        <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                          Accounts for market fluctuation in cement, steel, and fuel transport.
                        </span>
                      </div>
                    </div>

                    <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", color: "var(--text)" }}>5-Category Stage Cost Distribution:</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(selectedPlan.cost_breakdown?.category_breakdown || [
                        { name: "Structure (RCC Foundation & Columns)", percentage: 34, amount: selectedPlan.estimated_cost * 0.34 },
                        { name: "Masonry & Plastering", percentage: 22, amount: selectedPlan.estimated_cost * 0.22 },
                        { name: "Flooring & Finishing", percentage: 18, amount: selectedPlan.estimated_cost * 0.18 },
                        { name: "Electrical & Plumbing", percentage: 16, amount: selectedPlan.estimated_cost * 0.16 },
                        { name: "Doors & Windows", percentage: 10, amount: selectedPlan.estimated_cost * 0.10 },
                      ]).map((cat) => (
                        <div key={cat.name} style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.84rem" }}>
                            <strong style={{ color: "var(--text)" }}>{cat.name}</strong>
                            <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                              {cat.percentage}% • {formatCurrency(cat.amount)}
                            </span>
                          </div>
                          <div style={{ width: "100%", height: "8px", background: "var(--surface)", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{ width: `${cat.percentage}%`, height: "100%", background: "var(--accent)", borderRadius: "4px" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========================================================
                    TAB 3: 2D BLUEPRINT & ROOM SPECIFICATIONS
                ======================================================== */}
                {activeTab === "specs" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "var(--text)" }}>
                          2D Floor Plan Blueprint & Room Dimensions
                        </h3>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Facing: {selectedPlan.facing} • Bedrooms: {selectedPlan.bedrooms} • Bathrooms: {selectedPlan.bathrooms} • Floors: {selectedPlan.floors}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => setDossierPlan(selectedPlan)}
                          className="primary-button"
                          style={{ padding: "8px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <FileText size={14} /> View Full Plan Dossier
                        </button>
                        <button
                          onClick={() => handleOpenInViewer(selectedPlan)}
                          style={{
                            padding: "8px 14px",
                            fontSize: "0.8rem",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--text)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontWeight: 600,
                          }}
                        >
                          <Box size={14} /> Open in 3D
                        </button>
                      </div>
                    </div>

                    {/* Visual 2D Floor Plan SVG Blueprint */}
                    <div style={{ background: "var(--surface-2)", borderRadius: "12px", border: "1px solid var(--border)", padding: "16px", marginBottom: "20px" }}>
                      <FloorPlanBlueprint
                        plan={selectedPlan.plan || selectedPlan}
                        form={selectedPlan.form || {}}
                        compact={false}
                        showMeta={true}
                      />
                    </div>

                    <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", color: "var(--text)" }}>
                      Individual Room Dimensions & Carpet Areas
                    </h4>

                    {/* Room Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                      {(selectedPlan.plan?.floors?.[0]?.rooms || selectedPlan.plan?.rooms || []).map((rm) => (
                        <div
                          key={rm.id}
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            padding: "12px",
                          }}
                        >
                          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
                            {rm.name}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>
                            {rm.width}′ × {rm.height}′
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            Area: {Math.round(rm.width * rm.height)} sq.ft
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========================================================
                    TAB 4: NOTES & REMARKS
                ======================================================== */}
                {activeTab === "notes" && (
                  <div>
                    <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", color: "var(--text)" }}>
                      Client & Architectural Remarks
                    </h3>
                    <p style={{ margin: "0 0 14px", fontSize: "0.82rem", color: "var(--text-soft)" }}>
                      Keep client design requirements, DTCP sanction status, contractor notes, or customization ideas linked with this plan.
                    </p>

                    <textarea
                      rows={6}
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="e.g. Client requested teak wood doors, puja room facing east, and tiles roof option for front elevation..."
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        color: "var(--text)",
                        fontSize: "0.88rem",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        marginBottom: "12px",
                      }}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="primary-button"
                        style={{ padding: "8px 18px", fontSize: "0.84rem", fontWeight: 700 }}
                      >
                        {savingNotes ? "Saving..." : "Save Notes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Complete Project Dossier Modal (2D Floor Plan, Budget & Materials) */}
      {dossierPlan && (
        <PlanDossierModal
          plan={dossierPlan}
          onClose={() => setDossierPlan(null)}
          onOpenInViewer={onOpenPlan}
        />
      )}
    </div>
  );
}
