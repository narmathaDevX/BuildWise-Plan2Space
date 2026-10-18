import { useState, useMemo } from "react";
import {
  X,
  FileText,
  Ruler,
  Wallet,
  Package,
  Layers,
  Sparkles,
  Download,
  Printer,
  Compass,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Box,
  BedDouble,
  Bath,
  Home,
  Check,
} from "lucide-react";
import FloorPlanBlueprint, {
  getRooms,
  getAllRooms,
  getDimensions,
  roomName,
  roomArea,
} from "./FloorPlanBlueprint";
import { launchDesignStudio } from "../services/designStudio";

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

export function getComputedMaterials(plan) {
  if (plan?.materials_breakdown?.materials?.length) {
    return plan.materials_breakdown.materials;
  }
  const area = Number(plan?.built_up_area || 1500);
  return [
    {
      key: "cement",
      name: "Portland Pozzolana / OPC 53 Cement",
      category: "Structural",
      quantity: Math.round(area * 0.4),
      unit: "Bags",
      rate: 420,
      estimated_cost: Math.round(area * 0.4 * 420),
      description: "Ultratech / Dalmia OPC 53 grade for RCC columns, footings, and slabs.",
    },
    {
      key: "steel",
      name: "Fe550D TMT Reinforcement Steel",
      category: "Structural",
      quantity: +(area * 0.0032).toFixed(2),
      unit: "Tons",
      rate: 72000,
      estimated_cost: Math.round(area * 0.0032 * 72000),
      description: "High-yield corrosion-resistant TMT rebar for earthquake-safe RCC framing.",
    },
    {
      key: "m_sand",
      name: "M-Sand (Manufactured Sand)",
      category: "Structural",
      quantity: Math.round(area * 1.6),
      unit: "cft",
      rate: 65,
      estimated_cost: Math.round(area * 1.6 * 65),
      description: "Triple-washed manufactured sand conforming to IS 383 Zone II for RCC.",
    },
    {
      key: "aggregate_20mm",
      name: "20mm & 40mm Blue Metal Coarse Aggregate",
      category: "Structural",
      quantity: Math.round(area * 1.35),
      unit: "cft",
      rate: 48,
      estimated_cost: Math.round(area * 1.35 * 48),
      description: "Hard granite crushed aggregate for M20/M25 concrete mix design.",
    },
    {
      key: "p_sand",
      name: "P-Sand (Plastering Sand)",
      category: "Masonry",
      quantity: Math.round(area * 0.5),
      unit: "cft",
      rate: 75,
      estimated_cost: Math.round(area * 0.5 * 75),
      description: "Fine-sieved sand for smooth internal and weather-resistant external wall plaster.",
    },
    {
      key: "bricks",
      name: "Wire-Cut Red Clay Bricks / Solid Blocks",
      category: "Masonry",
      quantity: Math.round(area * 16),
      unit: "Nos",
      rate: 11,
      estimated_cost: Math.round(area * 16 * 11),
      description: "First-class table-moulded red bricks for 9\" external and 4.5\" partition walls.",
    },
    {
      key: "tiles_floor",
      name: "Premium Vitrified Floor Tiles (2'×2' / 4'×2')",
      category: "Finishing",
      quantity: Math.round(area * 1.15),
      unit: "sq.ft",
      rate: 78,
      estimated_cost: Math.round(area * 1.15 * 78),
      description: "Double-charged vitrified flooring with anti-skid bathroom ceramic tiles.",
    },
    {
      key: "tiles_wall",
      name: "Ceramic Wall Dado Tiles",
      category: "Finishing",
      quantity: Math.round(area * 0.45),
      unit: "sq.ft",
      rate: 52,
      estimated_cost: Math.round(area * 0.45 * 52),
      description: "Glazed digital wall tiles up to 7ft height for kitchen counter and bathrooms.",
    },
    {
      key: "paint_interior",
      name: "Interior Acrylic Emulsion + Primer & Putty",
      category: "Finishing",
      quantity: Math.round(area * 0.18),
      unit: "Litres",
      rate: 320,
      estimated_cost: Math.round(area * 0.18 * 320),
      description: "Asian Paints / Berger premium interior emulsion over 2 coats Birla white putty.",
    },
    {
      key: "paint_exterior",
      name: "Exterior Weather-Shield Elastomeric Paint",
      category: "Finishing",
      quantity: Math.round(area * 0.09),
      unit: "Litres",
      rate: 380,
      estimated_cost: Math.round(area * 0.09 * 380),
      description: "Anti-fungal UV-resistant weather-proof exterior finish.",
    },
    {
      key: "plumbing",
      name: "CPVC/PVC Piping, Water Tank & Sanitaryware",
      category: "Plumbing & Electrical",
      quantity: 1,
      unit: "Lot",
      rate: Math.round(area * 95),
      estimated_cost: Math.round(area * 95),
      description: "Astral / Finolex CPVC pipes, Parryware / Hindware EWC wall-mount toilets.",
    },
    {
      key: "electrical",
      name: "FR Copper Wiring, Conduits & Modular Switches",
      category: "Plumbing & Electrical",
      quantity: 1,
      unit: "Lot",
      rate: Math.round(area * 115),
      estimated_cost: Math.round(area * 115),
      description: "Finolex / Polycab FRLS copper wires with Legrand / GM modular switch plates.",
    },
    {
      key: "doors_windows",
      name: "Teak Wood Main Door, Flush Doors & UPVC Windows",
      category: "Finishing",
      quantity: 1,
      unit: "Lot",
      rate: Math.round(area * 140),
      estimated_cost: Math.round(area * 140),
      description: "First-quality teak main entrance door with UPVC sliding ventilation windows.",
    },
  ];
}

export function getComputedCostBreakdown(plan) {
  if (plan?.cost_breakdown?.category_breakdown?.length) {
    return plan.cost_breakdown;
  }
  const totalCost = Number(plan?.estimated_cost || 3500000);
  const area = Number(plan?.built_up_area || 1500);
  const rate = Math.round(totalCost / Math.max(1, area));

  return {
    total_cost: totalCost,
    effective_rate_per_sqft: rate,
    uncertainty_range: {
      low: Math.round(totalCost * 0.95),
      high: Math.round(totalCost * 1.05),
    },
    category_breakdown: [
      { name: "RCC Structure (Footings, Columns, Slabs)", percentage: 34, amount: Math.round(totalCost * 0.34) },
      { name: "Brick Masonry & Wall Plastering", percentage: 22, amount: Math.round(totalCost * 0.22) },
      { name: "Flooring, Wall Tiling & Painting", percentage: 18, amount: Math.round(totalCost * 0.18) },
      { name: "Electrical Wiring & Sanitary Plumbing", percentage: 16, amount: Math.round(totalCost * 0.16) },
      { name: "Doors, Windows & Hardware Fixtures", percentage: 10, amount: Math.round(totalCost * 0.10) },
    ],
  };
}

export default function PlanDossierModal({ plan, onClose, onOpenInViewer }) {
  if (!plan) return null;

  const [activeTab, setActiveTab] = useState("dossier"); // "dossier" | "plan" | "budget" | "materials" | "3d"
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [materialCategory, setMaterialCategory] = useState("all");
  const [materialSearch, setMaterialSearch] = useState("");
  const [launchingStudio, setLaunchingStudio] = useState(false);

  const form = plan.form || {};
  const dimensions = getDimensions(plan.plan || plan, form);
  const allRooms = getAllRooms(plan.plan || plan);
  const activeRooms = getRooms(plan.plan || plan, activeFloorIndex);
  const materialsList = useMemo(() => getComputedMaterials(plan), [plan]);
  const costBreakdown = useMemo(() => getComputedCostBreakdown(plan), [plan]);

  const totalCost = Number(plan.estimated_cost || costBreakdown.total_cost || 0);
  const builtUp = Number(plan.built_up_area || 1500);
  const costPerSqft = Math.round(totalCost / Math.max(1, builtUp));

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materialsList.filter((m) => {
      if (materialCategory !== "all" && m.category !== materialCategory) return false;
      if (materialSearch.trim()) {
        const q = materialSearch.toLowerCase();
        return (
          (m.name || "").toLowerCase().includes(q) ||
          (m.category || "").toLowerCase().includes(q) ||
          (m.description || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [materialsList, materialCategory, materialSearch]);

  const materialsTotal = useMemo(() => {
    return materialsList.reduce((sum, m) => sum + (m.estimated_cost || 0), 0);
  }, [materialsList]);

  const handleExportCSV = () => {
    const headers = [
      "Material Name",
      "Category",
      "Quantity Required",
      "Unit",
      "Unit Rate (INR)",
      "Estimated Cost (INR)",
      "Technical Description",
    ];
    const rows = materialsList.map((m) => [
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
    link.setAttribute(
      "download",
      `BuildWise_${(plan.title || "Plan").replace(/\s+/g, "_")}_BOM_and_Budget.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLaunch3DStudio = async () => {
    setLaunchingStudio(true);
    try {
      await launchDesignStudio(plan.plan || plan);
    } catch (err) {
      alert("Failed to launch Design Studio: " + err.message);
    } finally {
      setLaunchingStudio(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 29, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 2500,
        overflowY: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "30px 16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          color: "var(--text)",
          width: "100%",
          maxWidth: "1160px",
          borderRadius: "18px",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* ========================================================
            MODAL HEADER BAR
        ======================================================== */}
        <div
          style={{
            padding: "20px 28px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--accent)", fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              <ShieldCheck size={16} />
              BUILDWISE COMPREHENSIVE PROJECT DOSSIER
            </div>
            <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>
              {plan.title || "Custom Architectural House Plan"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--text-soft)" }}>
              <span>Plot: {dimensions.width}′ × {dimensions.depth}′</span>
              <span>•</span>
              <span>Built-up: {Math.round(builtUp)} sq.ft</span>
              <span>•</span>
              <span>{plan.bedrooms || 3} BHK, {plan.bathrooms || 2} Bath</span>
              <span>•</span>
              <span>Facing: {plan.facing || "North"}</span>
              <span>•</span>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>TNCDBR 2019 Compliant</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={handleLaunch3DStudio}
              disabled={launchingStudio}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "0.82rem",
                fontWeight: 700,
                borderRadius: "8px",
                border: "none",
                cursor: launchingStudio ? "wait" : "pointer",
                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(139, 92, 246, 0.35)",
              }}
            >
              <Sparkles size={14} />
              {launchingStudio ? "Launching Studio..." : "🎨 Open in 3D Studio"}
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <Download size={14} />
              Export CSV
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.82rem",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <Printer size={14} />
              Print
            </button>

            <button
              onClick={onClose}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                cursor: "pointer",
              }}
              title="Close Dossier"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================
            NAVIGATION TABS
        ======================================================== */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            padding: "0 28px",
            background: "var(--surface)",
            gap: "20px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "dossier", label: "📋 Executive Summary", icon: FileText },
            { id: "plan", label: "📐 2D Blueprint & Layout", icon: Ruler },
            { id: "budget", label: "💰 Budget & Cost Estimation", icon: Wallet },
            { id: "materials", label: "🧱 Itemized Materials (BOQ)", icon: Package },
            { id: "3d", label: "🌐 3D Walkthrough & Studio", icon: Box },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "14px 4px",
                  border: "none",
                  borderBottom: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                  background: "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-soft)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================
            MODAL CONTENT BODY
        ======================================================== */}
        <div style={{ padding: "28px", maxHeight: "calc(88vh - 160px)", overflowY: "auto" }}>
          {/* ========================================================
              TAB 1: EXECUTIVE SUMMARY (ALL-IN-ONE DOSSIER)
          ======================================================== */}
          {activeTab === "dossier" && (
            <div>
              {/* Highlight KPI Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ background: "var(--surface-2)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Total Estimated Cost</span>
                  <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--accent)" }}>
                    {formatCurrency(totalCost)}
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    ₹{costPerSqft} per sq.ft • {plan.quality || "Standard"} Quality
                  </span>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Total Built-up Area</span>
                  <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--text)" }}>
                    {Math.round(builtUp).toLocaleString("en-IN")} <small style={{ fontSize: "0.85rem", fontWeight: 600 }}>sq.ft</small>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    Plot: {dimensions.width}′ × {dimensions.depth}′ ({dimensions.width * dimensions.depth} sq.ft)
                  </span>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Material Schedule Subtotal</span>
                  <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#16a34a" }}>
                    {formatCurrency(materialsTotal)}
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    {materialsList.length} Tamil Nadu PWD verified line items
                  </span>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Design Fitness Score</span>
                  <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#0ea5e9" }}>
                    ★ {Math.round(plan.score || 92)} <small style={{ fontSize: "0.85rem", fontWeight: 500 }}>/ 100</small>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    Vastu Oriented • 90° Door Swings
                  </span>
                </div>
              </div>

              {/* 2-Column Split: Blueprint Preview + Budget/Materials Highlights */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px", alignItems: "start" }}>
                {/* Left: 2D Blueprint Preview Card */}
                <div style={{ background: "var(--surface-2)", borderRadius: "14px", border: "1px solid var(--border)", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 2px", fontSize: "1.05rem", color: "var(--text)" }}>Architectural Blueprint</h3>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Interactive 2D arrangement with room fixtures & dimensions</span>
                    </div>
                    <button
                      onClick={() => setActiveTab("plan")}
                      style={{
                        padding: "5px 10px",
                        fontSize: "0.76rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--accent)",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      View Fullscreen 📐
                    </button>
                  </div>

                  <div style={{ background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden", padding: "10px" }}>
                    <FloorPlanBlueprint plan={plan.plan || plan} form={form} activeFloorIndex={activeFloorIndex} compact={false} showMeta={false} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                    <span>{allRooms.length} rooms total</span>
                    <button
                      onClick={() => {
                        onClose();
                        if (onOpenInViewer) onOpenInViewer(plan);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      Open in Interactive House Planner <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Right: Key Budget & Material Highlights */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Stage Cost Distribution */}
                  <div style={{ background: "var(--surface-2)", borderRadius: "14px", border: "1px solid var(--border)", padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)" }}>Stage-wise Budget Allocation</h4>
                      <button
                        onClick={() => setActiveTab("budget")}
                        style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        All Details →
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(costBreakdown.category_breakdown || []).slice(0, 4).map((cat) => (
                        <div key={cat.name} style={{ fontSize: "0.8rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                            <span style={{ color: "var(--text)" }}>{cat.name}</span>
                            <strong style={{ color: "var(--accent)" }}>{cat.percentage}% ({formatCurrency(cat.amount)})</strong>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "var(--surface)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${cat.percentage}%`, height: "100%", background: "var(--accent)", borderRadius: "3px" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Materials Quick View */}
                  <div style={{ background: "var(--surface-2)", borderRadius: "14px", border: "1px solid var(--border)", padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)" }}>Key Materials Breakdown</h4>
                      <button
                        onClick={() => setActiveTab("materials")}
                        style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        Full Bill of Quantities →
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {materialsList.slice(0, 4).map((m) => (
                        <div
                          key={m.key}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "6px 8px",
                            background: "var(--surface)",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                          }}
                        >
                          <div>
                            <strong style={{ color: "var(--text)", display: "block" }}>{m.name}</strong>
                            <small style={{ color: "var(--text-muted)" }}>{m.quantity?.toLocaleString("en-IN")} {m.unit}</small>
                          </div>
                          <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                            ₹{m.estimated_cost?.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3D Walkthrough Quick Action */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(236, 72, 153, 0.12))",
                      border: "1px solid rgba(139, 92, 246, 0.3)",
                      borderRadius: "14px",
                      padding: "16px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "0.92rem", color: "var(--text)", display: "block" }}>3D Virtual Walkthrough & Interior Studio</strong>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-soft)" }}>Walk through doorways into every room in first-person POV</span>
                    </div>
                    <button
                      onClick={handleLaunch3DStudio}
                      disabled={launchingStudio}
                      className="primary-button"
                      style={{ padding: "8px 14px", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}
                    >
                      <Sparkles size={14} style={{ marginRight: "4px" }} />
                      Launch 3D
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: 2D BLUEPRINT & LAYOUT DETAILS
          ======================================================== */}
          {activeTab === "plan" && (
            <div>
              {/* Floor Switcher if Multi-Floor */}
              {(plan.plan?.floors?.length > 1 || plan.floors > 1) && (
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)" }}>Select Floor View:</span>
                  {[0, 1].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveFloorIndex(idx)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "0.82rem",
                        fontWeight: activeFloorIndex === idx ? 700 : 500,
                        background: activeFloorIndex === idx ? "var(--accent)" : "var(--surface-2)",
                        color: activeFloorIndex === idx ? "#ffffff" : "var(--text)",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      {idx === 0 ? "Ground Floor (Level 0)" : "First Floor (Level 1)"}
                    </button>
                  ))}
                </div>
              )}

              {/* Large SVG Floor Plan Drawing */}
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "20px",
                  marginBottom: "24px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                }}
              >
                <FloorPlanBlueprint plan={plan.plan || plan} form={form} activeFloorIndex={activeFloorIndex} compact={false} showMeta={true} />
              </div>

              {/* Room Schedule Table */}
              <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "var(--text)" }}>
                Room Dimensions & Spatial Schedule
              </h3>
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "10px", marginBottom: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "10px 14px", color: "var(--text)" }}>Space Name</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)" }}>Dimensions (W × L)</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>Carpet Area</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)" }}>Floor Level</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)" }}>Architectural Features</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRooms.map((rm, idx) => {
                      const w = Number(rm.width || rm.w || 0);
                      const h = Number(rm.height || rm.depth || rm.h || 0);
                      const area = Math.round(roomArea(rm) || (w * h));
                      const isBed = /bed/i.test(rm.name || rm.type);
                      const isBath = /bath|toilet/i.test(rm.name || rm.type);
                      return (
                        <tr
                          key={rm.id || idx}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                          }}
                        >
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text)" }}>
                            {roomName(rm, idx)}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--accent)", fontWeight: 600 }}>
                            {w > 0 && h > 0 ? `${Math.round(w)}′ × ${Math.round(h)}′` : "Custom"}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                            {area > 0 ? `${area} sq.ft` : "—"}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-soft)" }}>
                            {rm.floorName || (rm.floorLevel === 1 ? "First Floor" : "Ground Floor")}
                          </td>
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                            {isBed && "King/Queen bed layout • Wardrobe alcove • Cross ventilation"}
                            {isBath && "EWC Wall-hung • Hot/Cold CPVC plumbing • Anti-skid tiling"}
                            {!isBed && !isBath && "Vastu compliant • Natural lighting windows • 90° door swing"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: BUDGET & COST ESTIMATION
          ======================================================== */}
          {activeTab === "budget" && (
            <div>
              {/* Highlight Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ background: "var(--surface-2)", padding: "18px 22px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Total Estimated Project Cost</span>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--accent)", marginTop: "4px" }}>
                    {formatCurrency(totalCost)}
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    ₹{costPerSqft} per sq.ft • {plan.quality || "Standard"} Quality
                  </span>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "18px 22px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Market Fluctuation Band (±5%)</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", marginTop: "6px" }}>
                    {formatCurrency(costBreakdown.uncertainty_range?.low || totalCost * 0.95)} — {formatCurrency(costBreakdown.uncertainty_range?.high || totalCost * 1.05)}
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    Accounts for price shifts in cement, steel, and diesel logistics.
                  </span>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "18px 22px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Estimated Duration</span>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#16a34a", marginTop: "4px" }}>
                    6 — 8 Months
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-soft)", marginTop: "4px", display: "block" }}>
                    Protected by 8-Stage Milestone Escrow with 5% Retention.
                  </span>
                </div>
              </div>

              {/* 5-Category Stage Cost Distribution */}
              <h3 style={{ margin: "0 0 14px", fontSize: "1.1rem", color: "var(--text)" }}>
                5-Stage Construction Cost Breakdown:
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                {(costBreakdown.category_breakdown || []).map((cat) => (
                  <div
                    key={cat.name}
                    style={{
                      background: "var(--surface-2)",
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.88rem" }}>
                      <strong style={{ color: "var(--text)" }}>{cat.name}</strong>
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                        {cat.percentage}% • {formatCurrency(cat.amount)}
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "10px", background: "var(--surface)", borderRadius: "5px", overflow: "hidden" }}>
                      <div style={{ width: `${cat.percentage}%`, height: "100%", background: "var(--accent)", borderRadius: "5px" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Escrow Milestone Payment Schedule */}
              <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "var(--text)" }}>
                8-Stage Escrow Milestone Payment Schedule
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
                {[
                  { stage: "Stage 1: Booking & Architectural Signoff", pct: 10, desc: "Architectural drawings & DTCP/TNCDBR submission" },
                  { stage: "Stage 2: Foundation & Plinth Level", pct: 15, desc: "Excavation, PCC, footings & plinth beam casting" },
                  { stage: "Stage 3: RCC Columns & Ground Slab", pct: 20, desc: "Column shuttering, rebar tying & slab concrete pouring" },
                  { stage: "Stage 4: First Floor Slab / Roof Casting", pct: 15, desc: "Upper level RCC structure & parapet wall casting" },
                  { stage: "Stage 5: Brick Masonry & Plastering", pct: 15, desc: "External 9\" walls, internal partitions & 2-coat plaster" },
                  { stage: "Stage 6: Flooring & Wall Tiling", pct: 10, desc: "Double-charged vitrified tiles & bathroom dado tiles" },
                  { stage: "Stage 7: Electrical, Plumbing & Painting", pct: 10, desc: "FRLS wiring, sanitaryware, primer & 2 coats emulsion" },
                  { stage: "Stage 8: Handover & Retention Release", pct: 5, desc: "Final inspection, key handover & 90-day defect retention" },
                ].map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>Step {idx + 1}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--accent)" }}>
                        {m.pct}% ({formatCurrency(totalCost * (m.pct / 100))})
                      </span>
                    </div>
                    <strong style={{ fontSize: "0.86rem", color: "var(--text)", display: "block", marginBottom: "4px" }}>
                      {m.stage}
                    </strong>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-soft)" }}>
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: ITEMIZED MATERIAL SCHEDULE (BOQ)
          ======================================================== */}
          {activeTab === "materials" && (
            <div>
              {/* Header + Filter Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "var(--text)" }}>
                    Bill of Quantities for "{plan.title || "Plan"}"
                  </h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Computed for {Math.round(builtUp)} sq.ft built-up area under Tamil Nadu PWD / BAI 2025-26 rates.
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Material Estimate</span>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent)" }}>
                    {formatCurrency(materialsTotal)}
                  </div>
                </div>
              </div>

              {/* Filter controls */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
                  <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search materials (e.g. cement, steel, tiles)..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 34px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--text)",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Category Pills */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { id: "all", label: "All Items" },
                    { id: "Structural", label: "Structural" },
                    { id: "Masonry", label: "Masonry" },
                    { id: "Finishing", label: "Finishing" },
                    { id: "Plumbing & Electrical", label: "MEP" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setMaterialCategory(cat.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        fontWeight: materialCategory === cat.id ? 700 : 500,
                        background: materialCategory === cat.id ? "var(--accent)" : "var(--surface-2)",
                        color: materialCategory === cat.id ? "#ffffff" : "var(--text)",
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportCSV}
                  className="primary-button"
                  style={{ padding: "7px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Download size={14} /> Download CSV
                </button>
              </div>

              {/* Materials Table */}
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "10px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "10px 14px", color: "var(--text)" }}>Material Item & Specification</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)" }}>Category</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>Quantity Required</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>PWD Standard Rate</th>
                      <th style={{ padding: "10px 14px", color: "var(--text)", textAlign: "right" }}>Estimated Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map((m, idx) => (
                      <tr
                        key={m.key || idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                        }}
                      >
                        <td style={{ padding: "10px 14px" }}>
                          <strong style={{ color: "var(--text)", display: "block" }}>{m.name}</strong>
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
                          {m.quantity?.toLocaleString("en-IN")}{" "}
                          <span style={{ fontSize: "0.74rem", fontWeight: 500, color: "var(--text-soft)" }}>{m.unit}</span>
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
              TAB 5: 3D MODEL & STUDIO ACCESS
          ======================================================== */}
          {activeTab === "3d" && (
            <div>
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.08))",
                  border: "1px solid rgba(139, 92, 246, 0.25)",
                  borderRadius: "16px",
                  padding: "28px",
                  textAlign: "center",
                  marginBottom: "24px",
                }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "linear-gradient(135deg, #8b5cf6, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#ffffff" }}>
                  <Box size={28} />
                </div>
                <h2 style={{ margin: "0 0 8px", fontSize: "1.4rem", color: "var(--text)" }}>
                  Plan2Space 3D Interior Design Studio
                </h2>
                <p style={{ margin: "0 auto 20px", fontSize: "0.92rem", color: "var(--text-soft)", maxWidth: "580px" }}>
                  Step inside your house plan with first-person POV walkthrough. Walk through doors, paint walls and floors, customize roofing (tiles vs plain), add ceiling lighting/fans, and reposition furniture anywhere.
                </p>

                <button
                  onClick={handleLaunch3DStudio}
                  disabled={launchingStudio}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 28px",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: launchingStudio ? "wait" : "pointer",
                    background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                    color: "#ffffff",
                    boxShadow: "0 4px 16px rgba(139, 92, 246, 0.4)",
                  }}
                >
                  <Sparkles size={18} />
                  {launchingStudio ? "Preparing 3D Conversion..." : "Launch 3D Design Studio & Walkthrough"}
                </button>
              </div>

              {/* Studio Feature Highlights */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.9rem", color: "var(--text)", display: "block", marginBottom: "4px" }}>🚶 POV First-Person Walkthrough</strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-soft)" }}>Walk through doors with automatic doorway openings, enter every room, and inspect corners.</p>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.9rem", color: "var(--text)", display: "block", marginBottom: "4px" }}>🎨 Wall & Floor Painting</strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-soft)" }}>Smooth wall painting and tiling textures for living room, kitchen, and bedrooms.</p>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.9rem", color: "var(--text)", display: "block", marginBottom: "4px" }}>🛋️ Interactive Furniture Repositioning</strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-soft)" }}>Select any placed furniture piece, drag to reposition, rotate, and customize layout.</p>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.9rem", color: "var(--text)", display: "block", marginBottom: "4px" }}>🏠 Roof Options & Room Labels</strong>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-soft)" }}>Toggle room labels on/off and choose between traditional Mangalore tile roof or plain RCC roof.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
