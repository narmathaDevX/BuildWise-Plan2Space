/**
 * Saved Plans, History & Materials/Cost Estimation Controller.
 */

class HistoryApp {
  constructor() {
    this.plans = [];
    this.currency = localStorage.getItem('plan2space_currency') || 'INR';
    this.theme = localStorage.getItem('plan2space_theme') || 'dark';
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.sortBy = 'newest';

    this.init();
  }

  async init() {
    this.applyTheme(this.theme);
    this.bindEvents();
    await this.fetchPlans();
  }

  applyTheme(theme) {
    this.theme = theme;
    localStorage.setItem('plan2space_theme', theme);
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }

  formatCurrency(amountInr) {
    if (this.currency === 'USD') {
      const usd = amountInr / 82.5;
      return '$' + Math.round(usd).toLocaleString('en-US');
    }
    return '₹' + Math.round(amountInr).toLocaleString('en-IN');
  }

  async fetchPlans() {
    try {
      const res = await fetch('/api/v1/saved-plans');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.plans = await res.json();
      this.render();
    } catch (err) {
      console.error('Failed to fetch saved plans:', err);
    }
  }

  render() {
    this.renderStats();
    this.renderPlansGrid();
  }

  renderStats() {
    const totalPlans = this.plans.length;
    let totalAreaSqm = 0;
    let totalCostInr = 0;
    let totalFurniture = 0;

    this.plans.forEach((p) => {
      totalAreaSqm += p.plan_summary?.total_floor_area_sqm || 0;
      totalCostInr += p.cost_summary?.grand_total_inr || 0;
      totalFurniture += p.furniture_count || 0;
    });

    document.getElementById('total-plans-count').textContent = totalPlans;
    document.getElementById('total-area-display').textContent = `${Math.round(totalAreaSqm)} m²`;
    document.getElementById('total-area-sqft').textContent = `${Math.round(totalAreaSqm * 10.7639).toLocaleString()} sq.ft`;
    document.getElementById('total-cost-display').textContent = this.formatCurrency(totalCostInr);
    document.getElementById('total-furniture-count').textContent = totalFurniture;
  }

  getFilteredAndSortedPlans() {
    let result = [...this.plans];

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const idMatch = (p.id || '').toLowerCase().includes(q);
        const roomMatch = (p.rooms || []).some((r) => (r.name || '').toLowerCase().includes(q));
        return nameMatch || idMatch || roomMatch;
      });
    }

    // Filter
    if (this.activeFilter === '3d') {
      result = result.filter((p) => p.has_conversion);
    } else if (this.activeFilter === 'designed') {
      result = result.filter((p) => p.has_design || p.furniture_count > 0);
    }

    // Sort
    result.sort((a, b) => {
      if (this.sortBy === 'newest') {
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
      } else if (this.sortBy === 'area_desc') {
        return (b.plan_summary?.total_floor_area_sqm || 0) - (a.plan_summary?.total_floor_area_sqm || 0);
      } else if (this.sortBy === 'cost_desc') {
        return (b.cost_summary?.grand_total_inr || 0) - (a.cost_summary?.grand_total_inr || 0);
      } else if (this.sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return result;
  }

  renderPlansGrid() {
    const container = document.getElementById('plans-grid-container');
    const emptyState = document.getElementById('plans-empty-state');
    const filtered = this.getFilteredAndSortedPlans();

    if (filtered.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    filtered.forEach((plan) => {
      const card = document.createElement('div');
      card.className = 'plan-card';

      const areaSqm = plan.plan_summary?.total_floor_area_sqm || 0;
      const areaSqft = Math.round(areaSqm * 10.7639);
      const grandTotalInr = plan.cost_summary?.grand_total_inr || 0;
      const unitRateSqm = Math.round(grandTotalInr / Math.max(1, areaSqm));

      const isTiled = plan.plan_summary?.roof?.is_tiled;
      const roofLabel = isTiled ? '🏠 Spanish Clay Tiles' : '🏢 Plain Smooth Slab';
      const roofClass = isTiled ? 'roof-tiles' : 'roof-plain';

      const hasStudioLink = plan.latest_conversion_id;

      card.innerHTML = `
        <div class="plan-card-header">
          <div class="plan-title-area">
            <h3>${escapeHtml(plan.name || 'Floor Plan')}</h3>
            <span class="plan-id-badge">${plan.id}</span>
          </div>
          <span style="font-size:1.4rem;">🏛️</span>
        </div>

        <div class="plan-cost-banner">
          <div class="cost-main">
            <span class="cost-label">Est. Construction Cost</span>
            <div class="cost-figure">${this.formatCurrency(grandTotalInr)}</div>
          </div>
          <div class="cost-unit-rate">
            <div>${this.formatCurrency(unitRateSqm)} / m²</div>
            <div style="font-size:0.7rem; color:var(--text-sec);">${this.formatCurrency(Math.round(unitRateSqm / 10.7639))} / sq.ft</div>
          </div>
        </div>

        <div class="plan-specs-grid">
          <div class="spec-item">
            <span class="spec-val">${areaSqm.toFixed(1)} m²</span>
            <span class="spec-lbl">${areaSqft} sq.ft</span>
          </div>
          <div class="spec-item">
            <span class="spec-val">${plan.plan_summary?.rooms_count || 0}</span>
            <span class="spec-lbl">Rooms</span>
          </div>
          <div class="spec-item">
            <span class="spec-val">${plan.plan_summary?.walls_count || 0}</span>
            <span class="spec-lbl">Walls</span>
          </div>
        </div>

        <div class="badges-row">
          <span class="tag-badge ${roofClass}">${roofLabel}</span>
          <span class="tag-badge ${plan.furniture_count > 0 ? 'furniture-active' : ''}">
            🛋️ ${plan.furniture_count || 0} Furniture Items
          </span>
          ${plan.has_conversion ? '<span class="tag-badge" style="color:#10b981; border-color:rgba(16,185,129,0.3);">🌐 3D Ready</span>' : ''}
        </div>

        <div class="plan-actions-footer">
          <button type="button" class="btn-estimate" data-id="${plan.id}">
            📊 Materials & Cost
          </button>
          ${
            hasStudioLink
              ? `<a href="/studio.html?conversion=${encodeURIComponent(plan.latest_conversion_id)}" class="btn-studio">🛋️ Studio</a>`
              : `<a href="/index.html" class="btn-studio" style="opacity:0.7;">🚀 Build 3D</a>`
          }
          <button type="button" class="btn-del" data-id="${plan.id}" title="Delete Plan">
            🗑️
          </button>
        </div>
      `;

      // Bind estimate button
      card.querySelector('.btn-estimate').addEventListener('click', () => {
        this.openEstimateModal(plan.id);
      });

      // Bind delete button
      card.querySelector('.btn-del').addEventListener('click', async () => {
        if (confirm(`Delete plan "${plan.name || plan.id}" permanently?`)) {
          await this.deletePlan(plan.id);
        }
      });

      container.appendChild(card);
    });
  }

  async openEstimateModal(planId) {
    try {
      const res = await fetch(`/api/v1/saved-plans/${encodeURIComponent(planId)}/estimate`);
      if (!res.ok) throw new Error('Failed to load estimate');
      const data = await res.json();

      document.getElementById('modal-plan-title').textContent = `${data.plan_name || 'Floor Plan'} — Materials & Cost Estimate`;
      document.getElementById('modal-plan-subtitle').textContent = `Plan ID: ${data.plan_id} • Area: ${data.plan_summary.total_floor_area_sqm} m² (${data.plan_summary.total_floor_area_sqft} sq.ft) • Roof: ${data.plan_summary.roof.type.toUpperCase()}`;

      // Populate BoQ Table
      const boqBody = document.getElementById('boq-table-body');
      boqBody.innerHTML = '';
      (data.bill_of_materials || []).forEach((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><span class="cat-badge">${escapeHtml(item.category)}</span></td>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td style="font-weight:600;">${item.quantity.toLocaleString()}</td>
          <td style="color:var(--text-sec);">${escapeHtml(item.unit)}</td>
          <td>${this.formatCurrency(item.rate_inr)}</td>
          <td style="font-weight:700; color:var(--text-pri);">${this.formatCurrency(item.total_inr)}</td>
        `;
        boqBody.appendChild(row);
      });

      // Populate Breakdown
      document.getElementById('breakdown-materials').textContent = this.formatCurrency(data.cost_summary.materials_cost_inr);
      document.getElementById('breakdown-labor').textContent = this.formatCurrency(data.cost_summary.labor_cost_inr);
      document.getElementById('breakdown-furniture').textContent = this.formatCurrency(data.cost_summary.furniture_cost_inr);
      document.getElementById('breakdown-grand-total').textContent = this.formatCurrency(data.cost_summary.grand_total_inr);

      const specsList = document.getElementById('breakdown-specs-list');
      specsList.innerHTML = `
        <div>🧱 Total Bricks Required: <strong>${(data.bill_of_materials.find(m => m.name.includes('Bricks'))?.quantity || 0).toLocaleString()} pcs</strong></div>
        <div>🏗️ Total Cement Bags: <strong>${(data.bill_of_materials.find(m => m.name.includes('Cement'))?.quantity || 0).toLocaleString()} bags (50kg)</strong></div>
        <div>🔩 Reinforcement Steel: <strong>${(data.bill_of_materials.find(m => m.name.includes('Steel'))?.quantity || 0).toLocaleString()} kg</strong></div>
        <div>🎨 Paint Required: <strong>${(data.bill_of_materials.find(m => m.name.includes('Interior Acrylic'))?.quantity || 0).toLocaleString()} Litres</strong></div>
        <div>🚪 Doors & Windows: <strong>${data.plan_summary.doors_count} Doors, ${data.plan_summary.windows_count} Windows</strong></div>
        <div>🏠 Roof Style: <strong>${data.plan_summary.roof.is_tiled ? 'Spanish Clay Tiles' : 'Plain Concrete Slab'}</strong></div>
      `;

      // Populate Rooms
      const roomsContainer = document.getElementById('modal-rooms-container');
      roomsContainer.innerHTML = '';
      (data.rooms || []).forEach((r) => {
        const box = document.createElement('div');
        box.style.background = 'var(--bg-page)';
        box.style.padding = '10px';
        box.style.borderRadius = '6px';
        box.style.border = '1px solid var(--border-card)';
        box.innerHTML = `
          <strong style="display:block; font-size:0.85rem;">${escapeHtml(r.name)}</strong>
          <span style="font-size:0.75rem; color:var(--text-sec);">${r.area_sqm} m² (${r.area_sqft} sq.ft)</span>
        `;
        roomsContainer.appendChild(box);
      });

      // Populate Furniture
      const furnContainer = document.getElementById('modal-furniture-container');
      if (data.placed_furniture && data.placed_furniture.length > 0) {
        furnContainer.innerHTML = `
          <table class="boq-table">
            <thead>
              <tr>
                <th>Piece Name</th>
                <th>Category / Type</th>
                <th>Est. Retail Cost</th>
              </tr>
            </thead>
            <tbody>
              ${data.placed_furniture.map(f => `
                <tr>
                  <td><strong>${escapeHtml(f.name)}</strong></td>
                  <td>${escapeHtml(f.type)} (${escapeHtml(f.variant)})</td>
                  <td>${this.formatCurrency(f.estimated_cost_inr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        furnContainer.innerHTML = `
          <div style="font-size:0.85rem; color:var(--text-sec); padding:12px; background:var(--bg-page); border-radius:6px;">
            No furniture placed in this plan yet. Customize and place items in the <a href="/studio.html?conversion=${encodeURIComponent(data.conversion_id || '')}" style="color:var(--accent);">Interior Design Studio</a>.
          </div>
        `;
      }

      // Show modal
      document.getElementById('estimate-modal').style.display = 'flex';
    } catch (err) {
      alert('Error loading estimate: ' + err.message);
    }
  }

  async deletePlan(planId) {
    try {
      const res = await fetch(`/api/v1/saved-plans/${encodeURIComponent(planId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      this.plans = this.plans.filter((p) => p.id !== planId);
      this.render();
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  }

  bindEvents() {
    // Search input
    document.getElementById('input-search-plans')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderPlansGrid();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.renderPlansGrid();
      });
    });

    // Sort select
    document.getElementById('select-sort')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.renderPlansGrid();
    });

    // Currency toggle
    document.querySelectorAll('.currency-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.currency-toggle-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currency = btn.dataset.curr;
        localStorage.setItem('plan2space_currency', this.currency);
        this.render();
      });
    });

    // Theme toggle
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
    });

    // Modal tabs
    document.querySelectorAll('.modal-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach((c) => (c.style.display = 'none'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.style.display = 'block';
      });
    });

    // Modal close
    const closeModal = () => {
      document.getElementById('estimate-modal').style.display = 'none';
    };
    document.getElementById('modal-btn-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-btn-done')?.addEventListener('click', closeModal);
    document.getElementById('estimate-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'estimate-modal') closeModal();
    });

    // Print
    document.getElementById('modal-btn-print')?.addEventListener('click', () => {
      window.print();
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.addEventListener('DOMContentLoaded', () => {
  new HistoryApp();
});
