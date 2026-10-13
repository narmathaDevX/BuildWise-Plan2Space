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
} from "lucide-react";
import {
  getProjectMaterials,
  updateMaterial,
  addCustomMaterial,
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

function Materials() {
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

        <button
          className="outline-button"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? <Package size={16} /> : <Plus size={16} />}
          {showAddForm ? "Close Form" : "Add material"}
        </button>
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
    </main>
  );
}

export default Materials;