import { useState, useEffect } from "react";
import {
  Package,
  IndianRupee,
  CheckCircle2,
  Clock3,
  Circle,
  ChevronRight,
  TrendingUp,
  Boxes,
  Layers3,
  Wrench,
  Paintbrush,
  Plus,
  Zap,
  Home,
  Check,
  Database,
  Download,
  ExternalLink,
  X,
  FileSpreadsheet,
  Info,
  Users,
  MapPin,
} from "lucide-react";
import {
  getProjectMaterials,
  updateMaterial,
  addCustomMaterial,
  getMaterialsDataset,
  getMaterialsCsvUrl,
  getTnDistrictRates,
} from "../services/api";

function formatCurrency(value) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
}

function getCategoryIcon(name) {
  if (name === "Structure") return Layers3;
  if (name === "Masonry") return Boxes;
  if (name === "Finishing") return Paintbrush;
  if (name === "Electrical & Plumbing") return Zap;
  if (name === "Doors & Windows") return Home;
  return Package;
}

function getMaterialIcon(name, category) {
  if (name.includes("Cement") || name.includes("Concrete") || name.includes("Aggregate")) return Layers3;
  if (name.includes("Steel") || name.includes("Rebar")) return Wrench;
  if (name.includes("Sand") || name.includes("Brick") || name.includes("Block")) return Boxes;
  if (name.includes("Tile") || name.includes("Granite")) return Layers3;
  if (name.includes("Paint") || name.includes("Putty")) return Paintbrush;
  if (name.includes("Wiring") || name.includes("Electrical") || name.includes("Plumbing")) return Zap;
  if (name.includes("Door") || name.includes("Window")) return Home;
  return getCategoryIcon(category);
}

function Materials({ projectVersion }) {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [ratesAsOf, setRatesAsOf] = useState("October 2026");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add Material inline form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    category: "Structure",
    quantity: "",
    unit: "bags",
    rate: "",
  });

  // Materials Provenance Dataset State
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);
  const [provenanceData, setProvenanceData] = useState(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetFilter, setDatasetFilter] = useState("All");

  // Tamil Nadu District Rates & Wage Schedule State
  const [districtsData, setDistrictsData] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState("coimbatore");
  const [showWagesModal, setShowWagesModal] = useState(false);

  useEffect(() => {
    async function loadDistricts() {
      try {
        const res = await getTnDistrictRates();
        if (res) setDistrictsData(res);
      } catch (err) {
        console.error("Failed to load district rates:", err);
      }
    }
    loadDistricts();
  }, []);

  const loadProvenanceDataset = async () => {
    if (provenanceData) return;
    try {
      setDatasetLoading(true);
      const res = await getMaterialsDataset();
      if (res) {
        setProvenanceData(res);
      }
    } catch (err) {
      console.error("Failed to load materials dataset:", err);
    } finally {
      setDatasetLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjectMaterials();
      if (data) {
        setMaterials(data.materials || []);
        setCategories(data.categories || []);
        if (data.rates_as_of) {
          setRatesAsOf(data.rates_as_of);
        }
      }
    } catch (err) {
      console.error("Failed to load materials:", err);
      setError("Unable to load materials schedule. Using cached data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [projectVersion]);

  useEffect(() => {
    const handleSync = () => {
      loadMaterials();
    };
    window.addEventListener("buildwise:project-updated", handleSync);
    return () => {
      window.removeEventListener("buildwise:project-updated", handleSync);
    };
  }, []);

  const handleTogglePurchased = async (material) => {
    const updatedStatus = !material.purchased;
    const oldStatus = material.purchased;

    // Optimistic local update
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === material.id || m.key === material.key
          ? { ...m, purchased: updatedStatus }
          : m
      )
    );

    try {
      if (material.id) {
        await updateMaterial(material.id, { purchased: updatedStatus });
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      // Revert optimistic update on failure
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === material.id || m.key === material.key
            ? { ...m, purchased: oldStatus }
            : m
        )
      );
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newMaterial.name || !newMaterial.quantity || !newMaterial.rate) {
      return;
    }

    try {
      setFormSubmitting(true);
      const payload = {
        name: newMaterial.name.trim(),
        category: newMaterial.category,
        quantity: parseFloat(newMaterial.quantity) || 1,
        unit: newMaterial.unit.trim() || "nos",
        rate: parseFloat(newMaterial.rate) || 0,
        purchased: false,
      };

      await addCustomMaterial(payload);
      setShowAddForm(false);
      setNewMaterial({
        name: "",
        category: "Structure",
        quantity: "",
        unit: "bags",
        rate: "",
      });
      // Refresh list to update counts & categories
      await loadMaterials();
    } catch (err) {
      console.error("Failed to add custom material:", err);
      alert("Failed to add material. Please check inputs and try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Calculations with numeric quantities
  const totalCost = materials.reduce((sum, mat) => {
    const qty = Number(mat.quantity) || 0;
    const rate = Number(mat.rate) || 0;
    return sum + qty * rate;
  }, 0);

  const purchasedCost = materials
    .filter((mat) => mat.purchased)
    .reduce((sum, mat) => {
      const qty = Number(mat.quantity) || 0;
      const rate = Number(mat.rate) || 0;
      return sum + qty * rate;
    }, 0);

  const purchasedCount = materials.filter((mat) => mat.purchased).length;
  const purchaseProgress =
    materials.length > 0 ? Math.round((purchasedCount / materials.length) * 100) : 0;

  // Categories list fallback if backend categories list is empty
  const activeCategories =
    categories.length > 0
      ? categories
      : ["Structure", "Masonry", "Finishing", "Electrical & Plumbing", "Doors & Windows"].map((catName) => ({
          name: catName,
          count: materials.filter((m) => m.category === catName).length,
        }));

  const displayedMaterials =
    selectedCategory === "All"
      ? materials
      : materials.filter((m) => m.category === selectedCategory);

  return (
    <main className="materials-page">
      {/* HEADER */}
      <section className="materials-header">
        <div>
          <span className="eyebrow">BUILDWISE / MATERIALS</span>
          <h1>Materials</h1>
          <p>
            Track the materials required for your house, estimated quantities and
            procurement progress.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="outline-button"
            onClick={() => {
              setShowProvenanceModal(true);
              loadProvenanceDataset();
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Database size={16} />
            Price Sources & Dataset
          </button>

          <button
            className="outline-button"
            onClick={() => setShowAddForm((prev) => !prev)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {showAddForm ? <Package size={16} /> : <Plus size={16} />}
            {showAddForm ? "Close Form" : "Add material"}
          </button>
        </div>
      </section>

      {/* INLINE ADD MATERIAL FORM */}
      {showAddForm && (
        <section
          className="material-summary-card"
          style={{
            display: "block",
            marginBottom: "32px",
            background: "var(--surface)",
            borderColor: "var(--accent)",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <span style={{ fontSize: "11px", letterSpacing: "1px", color: "var(--accent)" }}>
              NEW MATERIAL SCHEDULE ITEM
            </span>
            <h3 style={{ margin: "6px 0 0", fontSize: "18px" }}>Add Project Material</h3>
          </div>

          <form onSubmit={handleAddSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-soft)",
                    marginBottom: "6px",
                  }}
                >
                  Material Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. River Sand, Teak Wood"
                  value={newMaterial.name}
                  onChange={(e) =>
                    setNewMaterial({ ...newMaterial, name: e.target.value })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-soft)",
                    marginBottom: "6px",
                  }}
                >
                  Category
                </label>
                <select
                  value={newMaterial.category}
                  onChange={(e) =>
                    setNewMaterial({ ...newMaterial, category: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value="Structure">Structure</option>
                  <option value="Masonry">Masonry</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Electrical & Plumbing">Electrical & Plumbing</option>
                  <option value="Doors & Windows">Doors & Windows</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-soft)",
                    marginBottom: "6px",
                  }}
                >
                  Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder="e.g. 50"
                  value={newMaterial.quantity}
                  onChange={(e) =>
                    setNewMaterial({ ...newMaterial, quantity: e.target.value })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-soft)",
                    marginBottom: "6px",
                  }}
                >
                  Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. bags, tons, sq.ft, litres, nos"
                  value={newMaterial.unit}
                  onChange={(e) =>
                    setNewMaterial({ ...newMaterial, unit: e.target.value })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "var(--text-soft)",
                    marginBottom: "6px",
                  }}
                >
                  Rate (₹ per unit)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 450"
                  value={newMaterial.rate}
                  onChange={(e) =>
                    setNewMaterial({ ...newMaterial, rate: e.target.value })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                type="submit"
                className="primary-button"
                disabled={formSubmitting}
              >
                {formSubmitting ? "Saving..." : "Save Material"}
              </button>
              <button
                type="button"
                className="outline-button"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAMIL NADU DISTRICT PRICING & LABOR WAGE RATES */}
      {districtsData?.districts && (
        <section
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--accent)" }}>
                TAMIL NADU REGIONAL RATES & WAGES (SOR 2025–2026)
              </span>
              <h3 style={{ margin: "4px 0 0", fontSize: "16px", color: "var(--text)" }}>
                District Pricing & Daily Labor Wage Schedule
              </h3>
            </div>

            <button
              type="button"
              className="outline-button"
              onClick={() => setShowWagesModal(true)}
              style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
            >
              <Users size={14} />
              View Daily Wage Schedule
            </button>
          </div>

          {/* DISTRICT BUTTONS */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(districtsData.districts).map(([dKey, dObj]) => {
              const isSelected = selectedDistrict === dKey;
              return (
                <button
                  key={dKey}
                  type="button"
                  onClick={() => setSelectedDistrict(dKey)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: isSelected ? "rgba(2, 132, 199, 0.12)" : "var(--surface-2)",
                    color: isSelected ? "var(--accent)" : "var(--text)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: isSelected ? 700 : 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <MapPin size={13} />
                  <span>{dObj.name}</span>
                  <span style={{ fontSize: "11px", opacity: 0.8, padding: "1px 5px", borderRadius: "4px", background: isSelected ? "rgba(2, 132, 199, 0.2)" : "var(--surface)" }}>
                    {dObj.multiplier}x
                  </span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE DISTRICT HIGHLIGHTS */}
          {districtsData.districts[selectedDistrict] && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                background: "var(--surface-2)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-soft)",
                lineHeight: 1.5,
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <div>
                <strong>Zone:</strong> {districtsData.districts[selectedDistrict].zone}
              </div>
              <div style={{ flex: 1 }}>
                <strong>Logistics Note:</strong> {districtsData.districts[selectedDistrict].description}
              </div>
              <div>
                <strong>Mason:</strong> ₹{districtsData.districts[selectedDistrict].labor_wages_per_day.head_mason}/day •{" "}
                <strong>Helper:</strong> ₹{districtsData.districts[selectedDistrict].labor_wages_per_day.general_helper}/day
              </div>
            </div>
          )}
        </section>
      )}

      {/* SUMMARY */}
      <section className="materials-summary">
        <div className="material-summary-card">
          <div className="summary-icon">
            <IndianRupee size={20} />
          </div>
          <div>
            <span>Estimated material cost</span>
            <strong>{formatCurrency(totalCost)}</strong>
            <small>Based on rates as of {ratesAsOf}</small>
          </div>
        </div>

        <div className="material-summary-card">
          <div className="summary-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Purchased</span>
            <strong>{formatCurrency(purchasedCost)}</strong>
            <small>
              {purchasedCount} of {materials.length} materials
            </small>
          </div>
        </div>

        <div className="material-summary-card">
          <div className="summary-icon">
            <TrendingUp size={20} />
          </div>
          <div>
            <span>Procurement progress</span>
            <strong>{purchaseProgress}%</strong>
            <small>Materials purchased</small>
          </div>
        </div>
      </section>

      {/* PROGRESS */}
      <section className="materials-progress-panel">
        <div className="materials-progress-heading">
          <div>
            <span className="small-label">PROCUREMENT</span>
            <h2>Material readiness</h2>
          </div>
          <strong>{purchaseProgress}%</strong>
        </div>

        <div className="materials-progress-bar">
          <div style={{ width: `${purchaseProgress}%` }} />
        </div>

        <div className="materials-progress-footer">
          <span>{purchasedCount} materials purchased</span>
          <span>{Math.max(0, materials.length - purchasedCount)} remaining</span>
        </div>
      </section>

      {/* CATEGORY CARDS */}
      <section className="materials-section">
        <div className="materials-section-heading">
          <div>
            <span className="small-label">MATERIAL GROUPS</span>
            <h2>Construction categories</h2>
          </div>
        </div>

        <div className="material-categories">
          <div
            className={`material-category ${selectedCategory === "All" ? "is-active" : ""}`}
            key="All"
            onClick={() => setSelectedCategory("All")}
            style={{ cursor: "pointer", border: selectedCategory === "All" ? "2px solid var(--accent)" : undefined }}
          >
            <div className="category-icon">
              <Package size={19} />
            </div>
            <div>
              <strong>All Materials</strong>
              <span>{materials.length} items</span>
            </div>
            {selectedCategory === "All" ? <Check size={16} /> : <ChevronRight size={16} />}
          </div>

          {activeCategories.map((category) => {
            const CategoryIcon = getCategoryIcon(category.name);
            const isSelected = selectedCategory === category.name;
            return (
              <div
                className={`material-category ${isSelected ? "is-active" : ""}`}
                key={category.name}
                onClick={() => setSelectedCategory(isSelected ? "All" : category.name)}
                style={{ cursor: "pointer", border: isSelected ? "2px solid var(--accent)" : undefined }}
              >
                <div className="category-icon">
                  <CategoryIcon size={19} />
                </div>
                <div>
                  <strong>{category.name}</strong>
                  <span>{category.count} materials</span>
                </div>
                {isSelected ? <Check size={16} /> : <ChevronRight size={16} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* MATERIAL TABLE */}
      <section className="materials-section">
        <div className="materials-section-heading">
          <div>
            <span className="small-label">MATERIAL SCHEDULE</span>
            <h2>Required materials {selectedCategory !== "All" ? `— ${selectedCategory}` : ""}</h2>
          </div>
          <span className="material-count">{displayedMaterials.length} of {materials.length} items</span>
        </div>

        <div className="materials-table">
          <div className="material-table-header">
            <span>Material</span>
            <span>Quantity</span>
            <span>Rate</span>
            <span>Estimated cost</span>
            <span>Status</span>
          </div>

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-soft)" }}>
              Loading materials schedule...
            </div>
          ) : displayedMaterials.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-soft)" }}>
              No materials found in this category.
            </div>
          ) : (
            displayedMaterials.map((material) => {
              const MaterialIcon = getMaterialIcon(material.name, material.category);
              const numericQuantity = Number(material.quantity) || 0;
              const numericRate = Number(material.rate) || 0;
              const estimatedCost = numericQuantity * numericRate;

              return (
                <div className="material-row" key={material.id || material.name}>
                  <div className="material-name">
                    <div className="material-icon">
                      <MaterialIcon size={17} />
                    </div>
                    <div>
                      <strong>{material.name}</strong>
                      <small>{material.category}</small>
                    </div>
                  </div>

                  <div className="material-quantity">
                    <strong>
                      {typeof numericQuantity === "number"
                        ? numericQuantity.toLocaleString("en-IN")
                        : material.quantity}
                    </strong>
                    <span>{material.unit}</span>
                  </div>

                  <div className="material-rate">
                    {formatCurrency(numericRate)}
                  </div>

                  <div className="material-cost">
                    {formatCurrency(estimatedCost)}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleTogglePurchased(material)}
                      title="Click to toggle purchased status"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        font: "inherit",
                      }}
                    >
                      {material.purchased ? (
                        <span className="material-status purchased">
                          <CheckCircle2 size={14} />
                          Purchased
                        </span>
                      ) : (
                        <span className="material-status pending">
                          <Clock3 size={14} />
                          Pending
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* NOTE */}
      <section className="materials-note">
        <div className="materials-note-icon">
          <Circle size={18} />
        </div>
        <div>
          <strong>Material estimates are preliminary</strong>
          <p>
            Quantities and rates are estimated from the current house-plan requirements.
            Final quantities should be confirmed with the contractor before procurement.
          </p>
        </div>
      </section>

      {/* PROVENANCE DATASET MODAL */}
      {showProvenanceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProvenanceModal(false);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              maxWidth: "1000px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 28px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "var(--surface)",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    color: "var(--accent)",
                    textTransform: "uppercase",
                  }}
                >
                  TAMIL NADU CONSTRUCTION COST REPOSITORY
                </span>
                <h2 style={{ fontSize: "22px", margin: "6px 0 4px", fontWeight: 700 }}>
                  Government PWD Schedule of Rates (SOR) & BAI Market Dataset
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-soft)" }}>
                  Verified price benchmarks from Tamil Nadu PWD 2025–2026 SOR (G.O. Ms No. 142/PWD) and Builders Association of India state indices.
                </p>
              </div>

              <button
                onClick={() => setShowProvenanceModal(false)}
                aria-label="Close dataset dialog"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-soft)",
                  cursor: "pointer",
                  padding: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Citations Grid */}
            <div
              style={{
                padding: "16px 28px",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "12px",
              }}
            >
              <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
                  1. TN PWD SOR 2025–2026
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-soft)", lineHeight: 1.4 }}>
                  Official Buildings & Structural Works rate schedule approved by the Engineer-in-Chief, PWD Tamil Nadu (G.O. Ms No. 142/PWD).
                </div>
              </div>

              <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--green)", marginBottom: "4px" }}>
                  2. BUILDERS ASSOCIATION (BAI)
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-soft)", lineHeight: 1.4 }}>
                  Quarterly Material Cost Index published by BAI Tamil Nadu State Centre for Chennai, Coimbatore, Madurai, Trichy & Salem.
                </div>
              </div>

              <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
                  3. WHOLESALE HUB QUOTATIONS
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-soft)", lineHeight: 1.4 }}>
                  Ground wholesale rates from Koyambedu Steel Yard, Sriperumbudur Corridor, Karur Quarry Belt & Parrys Tiles Depot.
                </div>
              </div>
            </div>

            {/* Filter & Download Controls */}
            <div
              style={{
                padding: "12px 28px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["All", "Structure", "Masonry", "Finishing", "Electrical & Plumbing", "Doors & Windows"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setDatasetFilter(cat)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      border: datasetFilter === cat ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: datasetFilter === cat ? "var(--accent)" : "var(--surface)",
                      color: datasetFilter === cat ? "#fff" : "var(--text)",
                      cursor: "pointer",
                      fontWeight: datasetFilter === cat ? 600 : 400,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <a
                href={getMaterialsCsvUrl()}
                download="tamilnadu_pwd_bai_materials_2026.csv"
                className="outline-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  padding: "6px 12px",
                  textDecoration: "none",
                }}
              >
                <Download size={14} /> Download CSV Dataset
              </a>
            </div>

            {/* Table Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 20px" }}>
              {datasetLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-soft)" }}>
                  Loading Tamil Nadu PWD & BAI dataset...
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "12px",
                    marginTop: "16px",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-soft)" }}>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Code</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Material Name & Specification</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Category</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Unit</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600, textAlign: "right" }}>PWD SOR Rate</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600, textAlign: "right" }}>Model Market Rate</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Primary Source Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((provenanceData?.items || []).filter(
                      (item) => datasetFilter === "All" || item.category === datasetFilter
                    )).map((item, idx) => (
                      <tr
                        key={item.item_code || idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 0 ? "transparent" : "var(--surface-2)",
                        }}
                      >
                        <td style={{ padding: "10px", fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>
                          {item.item_code}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <strong style={{ display: "block", color: "var(--text)" }}>{item.name}</strong>
                          <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>{item.specification}</span>
                        </td>
                        <td style={{ padding: "10px", color: "var(--text-soft)" }}>{item.category}</td>
                        <td style={{ padding: "10px", color: "var(--text-soft)" }}>{item.unit}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "monospace" }}>
                          ₹{item.pwd_sor_rate.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
                          ₹{item.effective_model_rate.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "10px", fontSize: "11px", color: "var(--text-soft)", maxWidth: "260px" }}>
                          <div>{item.source_citation}</div>
                          <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>📍 {item.market_hub}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 28px",
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                color: "var(--text-soft)",
              }}
            >
              <span>Verified for Tamil Nadu residential builds • Schedule Year 2025–2026</span>
              <button
                onClick={() => setShowProvenanceModal(false)}
                className="outline-button"
                style={{ padding: "5px 14px", fontSize: "12px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAGES SCHEDULE MODAL */}
      {showWagesModal && districtsData?.districts && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--accent)" }}>
                  TAMIL NADU PWD SCHEDULE OF RATES (SOR) 2025–2026
                </span>
                <h2 style={{ margin: "4px 0 0", fontSize: "20px", color: "var(--text)" }}>
                  Daily Labor Wage Schedule by District
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-soft)" }}>
                  Mandatory PWD minimum daily wage schedule across the 5 primary construction zones in Tamil Nadu.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowWagesModal(false)}
                className="icon-button"
                style={{ padding: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--text-soft)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div style={{ padding: "12px 16px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: "16px", fontSize: "12px", color: "var(--text)", lineHeight: 1.5 }}>
                💡 <strong>Labor Cost Advisory:</strong> Direct site labor comprises <strong>30% to 35%</strong> of residential build costs in Tamil Nadu. Rates reflect standard 8:30 AM to 5:30 PM working shifts including morning and afternoon tea breaks.
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", color: "var(--text-soft)" }}>
                    <th style={{ padding: "10px", fontWeight: 600 }}>Construction Trade / Craft</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Chennai</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Coimbatore</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Madurai</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Trichy</th>
                    <th style={{ padding: "10px", textAlign: "right" }}>Salem</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Head Mason (Maistry)", key: "head_mason" },
                    { label: "Assistant Mason", key: "assistant_mason" },
                    { label: "Barbender (Rebar Specialist)", key: "barbender" },
                    { label: "Shuttering Carpenter", key: "shuttering_carpenter" },
                    { label: "Licensed Plumber", key: "licensed_plumber" },
                    { label: "Licensed Electrician", key: "licensed_electrician" },
                    { label: "General Helper (Male/Female)", key: "general_helper" },
                  ].map((trade, idx) => (
                    <tr
                      key={trade.key}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: idx % 2 === 0 ? "transparent" : "var(--surface-2)",
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: 600, color: "var(--text)" }}>
                        {trade.label}
                      </td>
                      {["chennai", "coimbatore", "madurai", "trichy", "salem"].map((dId) => {
                        const wage = districtsData.districts[dId]?.labor_wages_per_day?.[trade.key];
                        return (
                          <td key={dId} style={{ padding: "10px", textAlign: "right", fontFamily: "monospace", color: dId === selectedDistrict ? "var(--accent)" : "var(--text)", fontWeight: dId === selectedDistrict ? 700 : 400 }}>
                            ₹{wage ? wage.toLocaleString("en-IN") : "—"}/day
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                color: "var(--text-soft)",
              }}
            >
              <span>Source: Government of Tamil Nadu PWD Schedule of Rates (SOR) 2025–2026</span>
              <button
                type="button"
                onClick={() => setShowWagesModal(false)}
                className="outline-button"
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Materials;