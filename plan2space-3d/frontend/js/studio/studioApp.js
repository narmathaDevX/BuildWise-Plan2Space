/**
 * Main Coordinator for Interior Design Studio (studio.html).
 * Orchestrates API calls, 3D viewport, wall painter, furniture placement, and exports.
 */

import { HistoryManager } from './history.js';
import { StudioViewer } from './studioViewer.js';
import { WallPainter } from './wallPainter.js';
import { FurnitureManager } from './furnitureManager.js';
import { StudioExporter } from './exporter.js';
import { ArchitectureManager } from './architectureManager.js';

class StudioApp {
  constructor() {
    this.conversionId = null;
    this.conversionJob = null;
    this.catalogue = null;
    this.geometryData = null;

    this.history = null;
    this.viewer = null;
    this.painter = null;
    this.architecture = null;
    this.furniture = null;
    this.exporter = null;

    this.activeMode = 'paint'; // 'paint', 'architecture', or 'furniture'
    this.currentTheme = 'dark';
  }

  async init() {
    // 0. Initialize Theme matching BuildWise (light / dark)
    const savedTheme = localStorage.getItem('theme') || localStorage.getItem('buildwise_theme') || 'dark';
    this.currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    // 1. Parse conversion ID from URL parameters
    const params = new URLSearchParams(window.location.search);
    this.conversionId = params.get('conversion');

    if (!this.conversionId) {
      this.showFatalError(
        'Missing Conversion ID',
        'No conversion ID was provided in the URL. Please return to the 3D model viewer and open Design Studio from a completed conversion.'
      );
      return;
    }

    // 2. Validate conversion status via API
    try {
      const resJob = await fetch(`/api/v1/conversions/${encodeURIComponent(this.conversionId)}`);
      if (!resJob.ok) {
        throw new Error(`Conversion '${this.conversionId}' does not exist (HTTP ${resJob.status}).`);
      }
      this.conversionJob = await resJob.json();

      if (this.conversionJob.status !== 'completed') {
        this.showFatalError(
          'Conversion Not Ready',
          `Conversion '${this.conversionId}' is currently in '${this.conversionJob.status}' state (progress: ${Math.round(
            (this.conversionJob.progress || 0) * 100
          )}%). Design Studio is only available for completed models.`
        );
        return;
      }
    } catch (err) {
      this.showFatalError('Failed to Load Conversion', err.message);
      return;
    }

    // Update Header Badge
    const badge = document.getElementById('conversion-id-badge');
    if (badge) badge.textContent = `ID: ${this.conversionId}`;

    // 3. Initialize Core Subsystems
    const container = document.getElementById('studio-canvas-container');
    this.viewer = new StudioViewer(container);
    this.viewer.setTheme(this.currentTheme);

    this.history = new HistoryManager(50, (state) => {
      const btnUndo = document.getElementById('btn-undo');
      const btnRedo = document.getElementById('btn-redo');
      if (btnUndo) btnUndo.disabled = !state.canUndo;
      if (btnRedo) btnRedo.disabled = !state.canRedo;
    });

    this.painter = new WallPainter(this.viewer.scene, this.viewer.camera, container, this.history);
    this.painter.setViewer(this.viewer);
    this.architecture = new ArchitectureManager(this.viewer.scene, this.viewer.camera, container, this.history, this.viewer);
    this.painter.setArchitecture(this.architecture);
    this.furniture = new FurnitureManager(this.viewer.scene, this.viewer.camera, container, this.history, this.viewer);
    this.exporter = new StudioExporter(this.viewer, this.painter, this.furniture, this.architecture);

    // 4. Fetch Catalogue and Conversion Geometry in parallel
    try {
      const [resCat, resGeom] = await Promise.all([
        fetch('/api/v1/design-catalogue'),
        fetch(`/api/v1/conversions/${encodeURIComponent(this.conversionId)}/geometry`),
      ]);

      if (resCat.ok) {
        this.catalogue = await resCat.json();
        this.renderCatalogueUI(this.catalogue);
        this.renderColorPresets(this.catalogue.color_presets);
      }

      if (resGeom.ok) {
        this.geometryData = await resGeom.json();
        const rooms = this.geometryData.geometry?.rooms || [];
        this.viewer.setRoomLabels(rooms);
        if (this.architecture) {
          this.architecture.setGeometryData(this.geometryData);
        }
        if (this.geometryData.wall_faces_lookup) {
          this.painter.setWallFacesLookup(this.geometryData.wall_faces_lookup);
          this.renderRoomPaintList(rooms);
        }
      }
    } catch (e) {
      console.warn('Failed fetching ancillary data:', e);
    }

    // 5. Load GLB Model into Viewport
    const glbUrl = `/api/v1/conversions/${encodeURIComponent(this.conversionId)}/model?format=glb`;
    this.viewer.loadGLB(glbUrl, async () => {
      // Register base walls for opening cutouts
      this.architecture.registerAllBaseWalls();
      // Refresh wall list for architecture manager
      this.architecture.renderWallListUI();
      // Setup wall face groups for painter
      this.painter.setupAllWallFaceGroups();
      // 6. Restore previously saved design (if any)
      await this.loadSavedDesign();
      this.showToast('3D Model loaded successfully');
    });

    // 7. Bind UI Events
    this.bindUIEvents();

    // Default to paint mode
    this.setInteractionMode('paint');
  }

  showFatalError(title, message) {
    const errorOverlay = document.getElementById('error-overlay');
    const errorTitle = document.getElementById('error-title');
    const errorMsg = document.getElementById('error-message');
    if (errorOverlay && errorTitle && errorMsg) {
      errorTitle.textContent = title;
      errorMsg.textContent = message;
      errorOverlay.style.display = 'flex';
    }
  }

  showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    try {
      localStorage.setItem('theme', this.currentTheme);
      localStorage.setItem('buildwise_theme', this.currentTheme);
    } catch (e) {
      // ignore
    }
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
    if (this.viewer) this.viewer.setTheme(this.currentTheme);
    this.showToast(`Switched to ${this.currentTheme} mode`);
  }

  // --- Render Dynamic Catalogue UI ---

  renderCatalogueUI(catalogue) {
    const catContainer = document.getElementById('furniture-categories-container');
    if (!catContainer || !catalogue.categories) return;

    const getCategoryIcon = (catId, catName) => {
      const lower = ((catId || '') + ' ' + (catName || '')).toLowerCase();
      if (lower.includes('fan')) return '🌀';
      if (lower.includes('light') || lower.includes('lamp')) return '💡';
      if (lower.includes('bed')) return '🛏️';
      if (lower.includes('seat') || lower.includes('sofa') || lower.includes('chair')) return '🛋️';
      if (lower.includes('storage') || lower.includes('wardrobe')) return '🚪';
      if (lower.includes('table') || lower.includes('desk')) return '🪵';
      if (lower.includes('electronic') || lower.includes('appliance') || lower.includes('tv')) return '📺';
      if (lower.includes('bath')) return '🚿';
      if (lower.includes('decor')) return '🪴';
      return '📦';
    };

    const getItemIcon = (typeId, name, category) => {
      const lower = ((typeId || '') + ' ' + (name || '') + ' ' + (category || '')).toLowerCase();
      if (lower.includes('fan')) return '🌀';
      if (lower.includes('chandelier')) return '✨';
      if (lower.includes('pendant') || lower.includes('spotlight') || lower.includes('lamp') || lower.includes('light')) return '💡';
      if (lower.includes('bed')) return '🛏️';
      if (lower.includes('sofa') || lower.includes('couch')) return '🛋️';
      if (lower.includes('chair') || lower.includes('stool')) return '🪑';
      if (lower.includes('wardrobe') || lower.includes('cupboard') || lower.includes('cabinet') || lower.includes('drawer') || lower.includes('bookshelf')) return '🚪';
      if (lower.includes('table') || lower.includes('desk')) return '🪵';
      if (lower.includes('tv') || lower.includes('television')) return '📺';
      if (lower.includes('refrigerator') || lower.includes('fridge')) return '🧊';
      if (lower.includes('washing')) return '🧺';
      if (lower.includes('air_conditioner') || lower.includes('ac')) return '❄️';
      if (lower.includes('toilet')) return '🚽';
      if (lower.includes('shower')) return '🚿';
      if (lower.includes('basin') || lower.includes('sink')) return '🚰';
      if (lower.includes('bath')) return '🛁';
      if (lower.includes('plant')) return '🪴';
      if (lower.includes('rug')) return '🧶';
      if (lower.includes('curtain')) return '🪟';
      if (lower.includes('mirror') || lower.includes('frame')) return '🖼️';
      return '✨';
    };

    catContainer.innerHTML = '';
    catalogue.categories.forEach((cat, idx) => {
      const catBlock = document.createElement('div');
      catBlock.className = 'catalogue-category';

      const catIcon = getCategoryIcon(cat.id, cat.name);
      const catHeader = document.createElement('div');
      catHeader.className = 'category-header';
      catHeader.innerHTML = `<span><strong>${catIcon} ${cat.name}</strong></span> <span class="arrow">${idx === 0 ? '▼' : '▶'}</span>`;

      const itemsGrid = document.createElement('div');
      itemsGrid.className = 'items-grid';
      itemsGrid.style.display = idx === 0 ? 'grid' : 'none';

      cat.items.forEach((item) => {
        item.variants.forEach((v) => {
          const card = document.createElement('div');
          card.className = 'furniture-card';
          const dims = v.default_dimensions;
          const dimLabel = dims ? `${dims[0]}×${dims[1]}×${dims[2]}m` : '';
          const itemIcon = getItemIcon(item.type_id, v.name, item.category);

          card.innerHTML = `
            <div class="card-icon">${itemIcon}</div>
            <div class="card-title">${v.name}</div>
            <div class="card-sub">${dimLabel}</div>
          `;

          card.addEventListener('click', () => {
            this.setInteractionMode('furniture');
            this.furniture.startPlacing({
              ...v,
              type_id: item.type_id,
              category: item.category,
            });
            this.showToast(`Placing ${v.name} — Click in 3D scene to place`);
          });

          itemsGrid.appendChild(card);
        });
      });

      catHeader.addEventListener('click', () => {
        const isOpen = itemsGrid.style.display === 'grid';
        itemsGrid.style.display = isOpen ? 'none' : 'grid';
        catHeader.querySelector('.arrow').textContent = isOpen ? '▶' : '▼';
      });

      catBlock.appendChild(catHeader);
      catBlock.appendChild(itemsGrid);
      catContainer.appendChild(catBlock);
    });
  }

  renderColorPresets(presets) {
    const grid = document.getElementById('preset-colors-grid');
    if (!grid || !presets) return;

    grid.innerHTML = '';
    presets.forEach((cp) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = cp.hex;
      swatch.title = `${cp.name} (${cp.hex}) - ${cp.category}`;
      swatch.addEventListener('click', () => {
        this.selectColor(cp.hex);
      });
      grid.appendChild(swatch);
    });
  }

  renderRecentColors() {
    const container = document.getElementById('recent-colors-row');
    if (!container) return;
    container.innerHTML = '';
    this.painter.recentColors.forEach((hex) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch small';
      swatch.style.backgroundColor = hex;
      swatch.title = hex;
      swatch.addEventListener('click', () => this.selectColor(hex));
      container.appendChild(swatch);
    });
  }

  renderRoomPaintList(rooms) {
    const select = document.getElementById('select-paint-room');
    if (!select || !rooms) return;
    select.innerHTML = '<option value="">-- Select Room --</option>';
    rooms.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (${Math.round(r.area_sqm)} m²)`;
      select.appendChild(opt);
    });
  }

  selectColor(hex) {
    const formatted = hex.toUpperCase();
    this.painter.setActiveColor(formatted);

    const inputColor = document.getElementById('custom-color-picker');
    const inputHex = document.getElementById('custom-hex-input');
    const preview = document.getElementById('active-color-preview');

    if (inputColor) inputColor.value = formatted;
    if (inputHex) inputHex.value = formatted;
    if (preview) preview.style.backgroundColor = formatted;

    this.renderRecentColors();
  }

  setInteractionMode(mode) {
    this.activeMode = mode;
    document.querySelectorAll('.tab-switcher-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const tabPaint = document.getElementById('panel-tab-paint');
    const tabArch = document.getElementById('panel-tab-architecture');
    const tabFurn = document.getElementById('panel-tab-furniture');

    if (tabPaint) tabPaint.style.display = mode === 'paint' ? 'block' : 'none';
    if (tabArch) tabArch.style.display = mode === 'architecture' ? 'block' : 'none';
    if (tabFurn) tabFurn.style.display = mode === 'furniture' ? 'block' : 'none';

    if (this.architecture) {
      this.architecture.setEnabled(mode === 'architecture');
      if (mode !== 'architecture') {
        this.architecture.cancelPlacing();
        this.architecture.activeTool = 'inspect';
      }
    }

    if (this.furniture) {
      this.furniture.setEnabled(mode === 'furniture');
      if (mode !== 'furniture') {
        this.furniture.cancelPlacing();
        this.furniture.deselect();
      }
    }

    if (this.painter) {
      this.painter.setEnabled(mode === 'paint');
      if (mode === 'paint') {
        this.painter.setupAllWallFaceGroups();
      }
    }
  }

  // --- Design Persistence (Save / Load / Reset) ---

  async loadSavedDesign() {
    try {
      const res = await fetch(`/api/v1/conversions/${encodeURIComponent(this.conversionId)}/design`);
      if (res.ok) {
        const designData = await res.json();
        this.painter.loadSerializedState(designData);
        this.furniture.loadSerializedItems(designData.furniture);
        this.showToast('Restored saved interior design');
      }
    } catch (e) {
      console.log('No prior saved design found, starting fresh');
    }
  }

  async saveDesign() {
    const paintState = this.painter.getSerializedState();
    const furnitureItems = this.furniture.getSerializedItems();

    const payload = {
      conversion_id: this.conversionId,
      walls: paintState.walls,
      floors: paintState.floors,
      ceiling: paintState.ceiling,
      furniture: furnitureItems,
    };

    const btnSave = document.getElementById('btn-save-design');
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';
    }

    try {
      const res = await fetch(`/api/v1/conversions/${encodeURIComponent(this.conversionId)}/design`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save design');
      }

      this.showToast('Design saved! 💾 View updated estimates in Saved Plans');
    } catch (err) {
      alert(`Save error: ${err.message}`);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = '💾 Save Design';
      }
    }
  }

  async resetDesign() {
    if (!confirm('Are you sure you want to reset all wall paint and furniture back to blank model?')) {
      return;
    }

    try {
      await fetch(`/api/v1/conversions/${encodeURIComponent(this.conversionId)}/design`, {
        method: 'DELETE',
      });
      // Re-load blank GLB
      const glbUrl = `/api/v1/conversions/${encodeURIComponent(this.conversionId)}/model?format=glb`;
      this.viewer.loadGLB(glbUrl, () => {
        this.furniture.loadSerializedItems([]);
        this.history.clear();
        this.showToast('Design reset to default blank model');
      });
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  }

  // --- UI Event Bindings ---

  bindUIEvents() {
    // Mode Switcher Tabs
    document.querySelectorAll('.tab-switcher-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setInteractionMode(btn.dataset.mode);
      });
    });

    // Undo / Redo
    document.getElementById('btn-undo')?.addEventListener('click', () => this.history.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.history.redo());

    // Save & Reset
    document.getElementById('btn-save-design')?.addEventListener('click', () => this.saveDesign());
    document.getElementById('btn-reset-design')?.addEventListener('click', () => this.resetDesign());

    // Back to Model / Back to BuildWise
    document.getElementById('btn-back-to-model')?.addEventListener('click', () => {
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('return_url');
      if (returnUrl) {
        window.location.href = decodeURIComponent(returnUrl);
        return;
      }
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
      if (document.referrer && (document.referrer.includes('5173') || document.referrer.includes('buildwise'))) {
        window.location.href = document.referrer;
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = 'http://localhost:5173';
    });

    // Color Inputs
    const picker = document.getElementById('custom-color-picker');
    const hexInput = document.getElementById('custom-hex-input');
    if (picker) {
      picker.addEventListener('input', (e) => this.selectColor(e.target.value));
    }
    if (hexInput) {
      hexInput.addEventListener('change', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          this.selectColor(val);
        } else {
          alert('Please enter a valid 6-digit hex code e.g. #3B82F6');
        }
      });
    }

    // Finishes (Matte / Satin / Gloss)
    document.querySelectorAll('.finish-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.finish-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.painter.setActiveFinish(btn.dataset.finish);
      });
    });

    // Paint Target (Single Face / Whole Wall)
    document.querySelectorAll('.target-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.target-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.painter.setPaintTarget(btn.dataset.target);
      });
    });

    // Eyedropper
    const btnEye = document.getElementById('btn-eyedropper');
    if (btnEye) {
      btnEye.addEventListener('click', () => {
        this.painter.eyedropperActive = !this.painter.eyedropperActive;
        btnEye.classList.toggle('active', this.painter.eyedropperActive);
        this.showToast(this.painter.eyedropperActive ? 'Eyedropper: Click any wall or floor to sample' : 'Eyedropper cancelled');
      });
      window.addEventListener('eyedropper-done', (e) => {
        btnEye.classList.remove('active');
        this.selectColor(e.detail.color);
        this.showToast(`Sampled ${e.detail.color}`);
      });
    }

    // Room Actions
    document.getElementById('btn-paint-room')?.addEventListener('click', () => {
      const roomId = document.getElementById('select-paint-room')?.value;
      if (!roomId) {
        alert('Please choose a room from the dropdown list first.');
        return;
      }
      this.painter.paintWholeRoom(roomId, this.painter.activeColor, this.painter.activeFinish, true);
      this.showToast(`Painted entire room: ${roomId}`);
    });

    document.getElementById('btn-paint-all-walls')?.addEventListener('click', () => {
      this.painter.paintAllWalls(this.painter.activeColor, this.painter.activeFinish, true);
      this.showToast('Painted all walls');
    });

    // Camera Presets
    document.getElementById('btn-cam-persp')?.addEventListener('click', () => this.viewer.setCameraPreset('perspective'));
    document.getElementById('btn-cam-top')?.addEventListener('click', () => this.viewer.setCameraPreset('top'));
    document.getElementById('btn-cam-iso')?.addEventListener('click', () => this.viewer.setCameraPreset('isometric'));
    document.getElementById('btn-cam-walk')?.addEventListener('click', () => {
      this.viewer.setCameraPreset('walkthrough');
      this.showToast('Eye-level walkthrough: Use WASD / Arrow keys to walk');
    });

    // View Toggles: Room Labels
    document.getElementById('toggle-room-labels')?.addEventListener('change', (e) => {
      this.viewer.toggleRoomLabels(e.target.checked);
      this.showToast(e.target.checked ? '🏷️ Room labels enabled' : 'Room labels hidden');
    });

    // Roof Toggles (Top bar & Panel synchronized)
    const syncRoofToggle = (checked) => {
      const cb1 = document.getElementById('toggle-roof');
      const cb2 = document.getElementById('panel-toggle-roof');
      if (cb1) cb1.checked = checked;
      if (cb2) cb2.checked = checked;
      this.viewer.toggleRoof(checked);
    };

    document.getElementById('toggle-roof')?.addEventListener('change', (e) => {
      syncRoofToggle(e.target.checked);
    });

    document.getElementById('panel-toggle-roof')?.addEventListener('change', (e) => {
      syncRoofToggle(e.target.checked);
    });

    // Roof Surface Texture (Clay Tiles vs Plain Smooth)
    document.querySelectorAll('.roof-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.roof-type-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const roofType = btn.dataset.roof;
        this.viewer.updateRoof({ type: roofType, visible: true });
        syncRoofToggle(true);
        this.showToast(`Roof texture: ${roofType === 'tiles' ? 'Clay Tiles' : 'Plain Smooth'}`);
      });
    });

    // Roof Geometry (Gabled / Sloped vs Flat Slab)
    document.querySelectorAll('.roof-shape-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.roof-shape-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const shape = btn.dataset.shape;
        this.viewer.updateRoof({ shape, visible: true });
        syncRoofToggle(true);
        this.showToast(`Roof geometry: ${shape === 'gabled' ? 'Gabled Sloped' : 'Flat Slab'}`);
      });
    });

    // Paint Roof Button
    document.getElementById('btn-paint-roof')?.addEventListener('click', () => {
      this.painter.paintRoof(this.painter.activeColor, this.painter.activeFinish, true);
      syncRoofToggle(true);
    });

    // Quick Roof Color Buttons
    document.querySelectorAll('.roof-color-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        if (color) {
          this.painter.paintRoof(color, 'matte', true);
          syncRoofToggle(true);
        }
      });
    });

    document.getElementById('toggle-wall-transparency')?.addEventListener('change', (e) => {
      this.viewer.toggleWallTransparency(e.target.checked);
    });
    document.getElementById('toggle-grid')?.addEventListener('change', (e) => {
      this.viewer.toggleGrid(e.target.checked);
    });

    // Export Handlers
    document.getElementById('btn-export-glb')?.addEventListener('click', async () => {
      try {
        await this.exporter.downloadGLB(this.conversionId, (step) => this.showToast(step));
        this.showToast('Exported GLB downloaded! 💾');
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('btn-export-png')?.addEventListener('click', () => {
      this.exporter.downloadSnapshot(this.conversionId);
      this.showToast('Snapshot PNG downloaded! 📸');
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const paintState = this.painter.getSerializedState();
      const furnitureItems = this.furniture.getSerializedItems();
      this.exporter.downloadJSON(
        {
          conversion_id: this.conversionId,
          ...paintState,
          furniture: furnitureItems,
        },
        this.conversionId
      );
      this.showToast('Design JSON downloaded! 📋');
    });

    // Furniture Inspector Events
    window.addEventListener('furniture-selected', (e) => {
      this.updateInspectorUI(e.detail);
    });

    window.addEventListener('furniture-deselected', () => {
      this.clearInspectorUI();
    });

    // Inspector Transform Handlers
    document.getElementById('insp-rot-90')?.addEventListener('click', () => {
      this.furniture.rotateSelected(Math.PI / 2);
    });

    // 🎯 Reposition tool button
    document.getElementById('insp-btn-reposition')?.addEventListener('click', () => {
      this.furniture.startRepositioning();
      this.showToast('🎯 Repositioning: Move cursor across the room and click to place');
    });

    // Numeric Position Inputs
    const applyPosFromInputs = () => {
      const x = parseFloat(document.getElementById('insp-input-pos-x')?.value);
      const y = parseFloat(document.getElementById('insp-input-pos-y')?.value);
      const z = parseFloat(document.getElementById('insp-input-pos-z')?.value);
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        this.furniture.setPosition(x, y, z);
      }
    };
    document.getElementById('insp-input-pos-x')?.addEventListener('change', applyPosFromInputs);
    document.getElementById('insp-input-pos-y')?.addEventListener('change', applyPosFromInputs);
    document.getElementById('insp-input-pos-z')?.addEventListener('change', applyPosFromInputs);

    // Nudge Pad Buttons (⬅️, ➡️, ⬆️, ⬇️, 🔼, 🔽)
    document.getElementById('insp-nudge-fwd')?.addEventListener('click', (e) => {
      this.furniture.moveSelected(0, 0, e.shiftKey ? -0.5 : -0.1);
    });
    document.getElementById('insp-nudge-back')?.addEventListener('click', (e) => {
      this.furniture.moveSelected(0, 0, e.shiftKey ? 0.5 : 0.1);
    });
    document.getElementById('insp-nudge-left')?.addEventListener('click', (e) => {
      this.furniture.moveSelected(e.shiftKey ? -0.5 : -0.1, 0, 0);
    });
    document.getElementById('insp-nudge-right')?.addEventListener('click', (e) => {
      this.furniture.moveSelected(e.shiftKey ? 0.5 : 0.1, 0, 0);
    });
    document.getElementById('insp-nudge-up')?.addEventListener('click', (e) => {
      this.furniture.moveSelected(0, e.shiftKey ? 0.5 : 0.1, 0);
    });
    document.getElementById('insp-nudge-down')?.addEventListener('click', (e) => {
      this.furniture.moveSelected(0, e.shiftKey ? -0.5 : -0.1, 0);
    });

    document.getElementById('insp-btn-duplicate')?.addEventListener('click', () => {
      this.furniture.duplicateSelected();
    });

    document.getElementById('insp-btn-delete')?.addEventListener('click', () => {
      this.furniture.deleteSelected();
    });

    document.getElementById('insp-color-primary')?.addEventListener('input', (e) => {
      const s = document.getElementById('insp-color-secondary')?.value;
      this.furniture.recolorSelected(e.target.value, s);
    });

    document.getElementById('insp-color-secondary')?.addEventListener('input', (e) => {
      const p = document.getElementById('insp-color-primary')?.value;
      this.furniture.recolorSelected(p, e.target.value);
    });

    document.getElementById('insp-scale-w')?.addEventListener('change', () => this.applyInspectorScale());
    document.getElementById('insp-scale-d')?.addEventListener('change', () => this.applyInspectorScale());
    document.getElementById('insp-scale-h')?.addEventListener('change', () => this.applyInspectorScale());

    // --- Architecture Editing Event Bindings ---
    document.getElementById('btn-tool-inspect')?.addEventListener('click', () => {
      this.setInteractionMode('architecture');
      document.querySelectorAll('.opening-preset-card').forEach((c) => c.classList.remove('active'));
      this.architecture.setActiveTool('inspect');
    });

    document.getElementById('btn-tool-demolish')?.addEventListener('click', () => {
      this.setInteractionMode('architecture');
      document.querySelectorAll('.opening-preset-card').forEach((c) => c.classList.remove('active'));
      if (this.architecture.selectedWallId) {
        this.architecture.demolishWall(this.architecture.selectedWallId, true);
      }
      this.architecture.setActiveTool('demolish');
    });

    document.querySelectorAll('.opening-preset-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.opening-preset-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const preset = card.dataset.preset;
        this.setInteractionMode('architecture');
        this.architecture.startPlacingOpening(preset);
        const title = card.querySelector('.preset-title')?.textContent || preset;
        this.showToast(`Placing ${title} — Click on any wall in 3D to insert`);
      });
    });

    document.getElementById('btn-restore-all-walls')?.addEventListener('click', () => {
      this.architecture.restoreAllWalls();
    });

    // Wall Inspector Actions
    document.getElementById('insp-wall-btn-door')?.addEventListener('click', () => {
      this.setInteractionMode('architecture');
      const defaultPreset = 'standard_door';
      document.querySelectorAll('.opening-preset-card').forEach((c) => {
        c.classList.toggle('active', c.dataset.preset === defaultPreset);
      });
      this.architecture.startPlacingOpening(defaultPreset);
      this.showToast('Click along the wall in 3D to insert the door');
    });

    document.getElementById('insp-wall-btn-paint')?.addEventListener('click', () => {
      if (this.architecture.selectedWallId) {
        this.painter.paintWallFace(this.architecture.selectedWallId, 'all', this.painter.activeColor, this.painter.activeFinish, true);
        this.showToast(`Painted wall ${this.architecture.selectedWallId}`);
      }
    });

    document.getElementById('insp-wall-btn-demolish')?.addEventListener('click', () => {
      if (this.architecture.selectedWallId) {
        this.architecture.demolishWall(this.architecture.selectedWallId, true);
      }
    });

    // Opening Inspector Actions
    document.getElementById('insp-opening-btn-toggle')?.addEventListener('click', () => {
      if (this.architecture.selectedOpening) {
        this.architecture.toggleDoorOpen(this.architecture.selectedOpening);
      }
    });

    document.getElementById('insp-opening-btn-delete')?.addEventListener('click', () => {
      if (this.architecture.selectedOpening) {
        this.architecture.deleteOpening(this.architecture.selectedOpening);
      }
    });

    // Theme Toggle
    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Light mood preset buttons
    document.querySelectorAll('.light-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        if (color) {
          const inputPrimary = document.getElementById('insp-color-primary');
          if (inputPrimary) inputPrimary.value = color;
          const s = document.getElementById('insp-color-secondary')?.value;
          this.furniture.recolorSelected(color, s);
          this.showToast(`Set lighting mood: ${btn.textContent.trim()}`);
        }
      });
    });

    // Mutual deselection between furniture and architecture
    window.addEventListener('architecture-selected', () => {
      this.furniture?.deselect();
    });
  }

  updateInspectorUI(detail) {
    if (this.architecture) this.architecture.deselectAll();
    const insp = document.getElementById('furniture-inspector');
    const wallInsp = document.getElementById('inspector-wall-view');
    const opInsp = document.getElementById('inspector-opening-view');
    const emptyNotice = document.getElementById('inspector-empty-notice');

    if (wallInsp) wallInsp.style.display = 'none';
    if (opInsp) opInsp.style.display = 'none';
    if (insp) insp.style.display = 'block';
    if (emptyNotice) emptyNotice.style.display = 'none';

    document.getElementById('insp-title').textContent = detail.userData.customLabel || detail.userData.itemType;
    document.getElementById('insp-variant').textContent = `Variant: ${detail.userData.variant}`;

    // Collision warning banner
    const warnBanner = document.getElementById('insp-collision-warning');
    if (warnBanner) {
      warnBanner.style.display = detail.hasCollision ? 'block' : 'none';
    }

    // Coordinates
    const posX = detail.position[0].toFixed(2);
    const posY = detail.position[1].toFixed(2);
    const posZ = detail.position[2].toFixed(2);
    const posXSpan = document.getElementById('insp-pos-x');
    const posZSpan = document.getElementById('insp-pos-z');
    if (posXSpan) posXSpan.textContent = posX + 'm';
    if (posZSpan) posZSpan.textContent = posZ + 'm';

    const inputX = document.getElementById('insp-input-pos-x');
    const inputY = document.getElementById('insp-input-pos-y');
    const inputZ = document.getElementById('insp-input-pos-z');
    if (inputX && document.activeElement !== inputX) inputX.value = posX;
    if (inputY && document.activeElement !== inputY) inputY.value = posY;
    if (inputZ && document.activeElement !== inputZ) inputZ.value = posZ;

    // Scale
    document.getElementById('insp-scale-w').value = detail.scale[0].toFixed(2);
    document.getElementById('insp-scale-d').value = detail.scale[2].toFixed(2);
    document.getElementById('insp-scale-h').value = detail.scale[1].toFixed(2);

    // Dynamic Labels & Light Mood Presets
    const itemType = detail.userData.itemType || '';
    const variant = detail.userData.variant || '';
    const isLighting = itemType.includes('lamp') || variant.includes('light');
    const isFan = itemType === 'ceiling_fan';

    const lightPresets = document.getElementById('insp-light-presets');
    const labelPrimary = document.getElementById('insp-label-primary');
    const labelSecondary = document.getElementById('insp-label-secondary');

    if (lightPresets) {
      lightPresets.style.display = isLighting ? 'block' : 'none';
    }

    if (labelPrimary) {
      if (isLighting) labelPrimary.textContent = '💡 Light Glow:';
      else if (isFan) labelPrimary.textContent = '🌀 Blades:';
      else labelPrimary.textContent = 'Primary:';
    }

    if (labelSecondary) {
      if (isLighting) labelSecondary.textContent = 'Stand/Base:';
      else if (isFan) labelSecondary.textContent = 'Motor/Accent:';
      else labelSecondary.textContent = 'Secondary:';
    }

    // Colors
    if (detail.userData.colors?.primary) {
      document.getElementById('insp-color-primary').value = detail.userData.colors.primary;
    }
    if (detail.userData.colors?.secondary) {
      document.getElementById('insp-color-secondary').value = detail.userData.colors.secondary;
    }
  }

  clearInspectorUI() {
    const insp = document.getElementById('furniture-inspector');
    const wallInsp = document.getElementById('inspector-wall-view');
    const opInsp = document.getElementById('inspector-opening-view');
    const emptyNotice = document.getElementById('inspector-empty-notice');
    const lightPresets = document.getElementById('insp-light-presets');

    if (lightPresets) lightPresets.style.display = 'none';
    if (insp) insp.style.display = 'none';
    if (!this.architecture?.selectedWallId && !this.architecture?.selectedOpening) {
      if (wallInsp) wallInsp.style.display = 'none';
      if (opInsp) opInsp.style.display = 'none';
      if (emptyNotice) emptyNotice.style.display = 'block';
    }
  }

  applyInspectorScale() {
    const w = parseFloat(document.getElementById('insp-scale-w')?.value || 1.0);
    const d = parseFloat(document.getElementById('insp-scale-d')?.value || 1.0);
    const h = parseFloat(document.getElementById('insp-scale-h')?.value || 1.0);
    this.furniture.scaleSelected(w, h, d);
  }
}

// Instantiate and initialize studio app immediately or on DOM ready
function startStudioApp() {
  const app = new StudioApp();
  app.init().catch((err) => {
    console.error('Fatal error during StudioApp init:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startStudioApp);
} else {
  startStudioApp();
}
