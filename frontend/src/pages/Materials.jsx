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
} from "lucide-react";

const materials = [
  {
    name: "Cement",
    category: "Structure",
    quantity: "420",
    unit: "bags",
    rate: 420,
    purchased: true,
    icon: Layers3,
  },
  {
    name: "Steel",
    category: "Structure",
    quantity: "3.8",
    unit: "tons",
    rate: 68000,
    purchased: true,
    icon: Wrench,
  },
  {
    name: "M-Sand",
    category: "Masonry",
    quantity: "32",
    unit: "tons",
    rate: 1800,
    purchased: false,
    icon: Boxes,
  },
  {
    name: "Bricks",
    category: "Masonry",
    quantity: "18,000",
    unit: "nos",
    rate: 9,
    purchased: false,
    icon: Package,
  },
  {
    name: "Floor Tiles",
    category: "Finishing",
    quantity: "1,650",
    unit: "sq.ft",
    rate: 85,
    purchased: false,
    icon: Layers3,
  },
  {
    name: "Paint",
    category: "Finishing",
    quantity: "95",
    unit: "litres",
    rate: 260,
    purchased: false,
    icon: Paintbrush,
  },
];

const categories = [
  {
    name: "Structure",
    count: 2,
    icon: Layers3,
  },
  {
    name: "Masonry",
    count: 2,
    icon: Boxes,
  },
  {
    name: "Finishing",
    count: 2,
    icon: Paintbrush,
  },
];

function formatCurrency(value) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function Materials() {
  const totalCost = materials.reduce(
    (sum, material) => {
      const numericQuantity = parseFloat(
        material.quantity.replace(",", "")
      );

      return sum + numericQuantity * material.rate;
    },
    0
  );

  const purchasedCost = materials
    .filter((material) => material.purchased)
    .reduce((sum, material) => {
      const numericQuantity = parseFloat(
        material.quantity.replace(",", "")
      );

      return sum + numericQuantity * material.rate;
    }, 0);

  const purchasedCount = materials.filter(
    (material) => material.purchased
  ).length;

  const purchaseProgress = Math.round(
    (purchasedCount / materials.length) * 100
  );

  return (
    <main className="materials-page">

      {/* HEADER */}

      <section className="materials-header">

        <div>

          <span className="eyebrow">
            BUILDWISE / MATERIALS
          </span>

          <h1>
            Materials
          </h1>

          <p>
            Track the materials required for your house,
            estimated quantities and procurement progress.
          </p>

        </div>

        <button className="outline-button">
          <Package size={16} />
          Add material
        </button>

      </section>


      {/* SUMMARY */}

      <section className="materials-summary">

        <div className="material-summary-card">

          <div className="summary-icon">
            <IndianRupee size={20} />
          </div>

          <div>
            <span>
              Estimated material cost
            </span>

            <strong>
              {formatCurrency(totalCost)}
            </strong>

            <small>
              Based on current rates
            </small>
          </div>

        </div>


        <div className="material-summary-card">

          <div className="summary-icon">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <span>
              Purchased
            </span>

            <strong>
              {formatCurrency(purchasedCost)}
            </strong>

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

            <span>
              Procurement progress
            </span>

            <strong>
              {purchaseProgress}%
            </strong>

            <small>
              Materials purchased
            </small>

          </div>

        </div>

      </section>


      {/* PROGRESS */}

      <section className="materials-progress-panel">

        <div className="materials-progress-heading">

          <div>

            <span className="small-label">
              PROCUREMENT
            </span>

            <h2>
              Material readiness
            </h2>

          </div>

          <strong>
            {purchaseProgress}%
          </strong>

        </div>


        <div className="materials-progress-bar">
          <div
            style={{
              width: `${purchaseProgress}%`,
            }}
          />
        </div>


        <div className="materials-progress-footer">

          <span>
            {purchasedCount} materials purchased
          </span>

          <span>
            {materials.length - purchasedCount} remaining
          </span>

        </div>

      </section>


      {/* CATEGORY CARDS */}

      <section className="materials-section">

        <div className="materials-section-heading">

          <div>

            <span className="small-label">
              MATERIAL GROUPS
            </span>

            <h2>
              Construction categories
            </h2>

          </div>

        </div>


        <div className="material-categories">

          {categories.map((category) => {

            const CategoryIcon = category.icon;

            return (
              <div
                className="material-category"
                key={category.name}
              >

                <div className="category-icon">
                  <CategoryIcon size={19} />
                </div>

                <div>

                  <strong>
                    {category.name}
                  </strong>

                  <span>
                    {category.count} materials
                  </span>

                </div>

                <ChevronRight size={16} />

              </div>
            );

          })}

        </div>

      </section>


      {/* MATERIAL TABLE */}

      <section className="materials-section">

        <div className="materials-section-heading">

          <div>

            <span className="small-label">
              MATERIAL SCHEDULE
            </span>

            <h2>
              Required materials
            </h2>

          </div>

          <span className="material-count">
            {materials.length} items
          </span>

        </div>


        <div className="materials-table">

          <div className="material-table-header">

            <span>
              Material
            </span>

            <span>
              Quantity
            </span>

            <span>
              Rate
            </span>

            <span>
              Estimated cost
            </span>

            <span>
              Status
            </span>

          </div>


          {materials.map((material) => {

            const MaterialIcon = material.icon;

            const numericQuantity = parseFloat(
              material.quantity.replace(",", "")
            );

            const estimatedCost =
              numericQuantity * material.rate;

            return (
              <div
                className="material-row"
                key={material.name}
              >

                <div className="material-name">

                  <div className="material-icon">
                    <MaterialIcon size={17} />
                  </div>

                  <div>

                    <strong>
                      {material.name}
                    </strong>

                    <small>
                      {material.category}
                    </small>

                  </div>

                </div>


                <div className="material-quantity">

                  <strong>
                    {material.quantity}
                  </strong>

                  <span>
                    {material.unit}
                  </span>

                </div>


                <div className="material-rate">
                  {formatCurrency(material.rate)}
                </div>


                <div className="material-cost">
                  {formatCurrency(estimatedCost)}
                </div>


                <div>

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

                </div>

              </div>
            );

          })}

        </div>

      </section>


      {/* NOTE */}

      <section className="materials-note">

        <div className="materials-note-icon">
          <Circle size={18} />
        </div>

        <div>

          <strong>
            Material estimates are preliminary
          </strong>

          <p>
            Quantities and rates are estimated from the
            current house-plan requirements. Final quantities
            should be confirmed with the contractor before
            procurement.
          </p>

        </div>

      </section>

    </main>
  );
}

export default Materials;