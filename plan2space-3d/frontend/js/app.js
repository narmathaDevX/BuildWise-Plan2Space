/**
 * Main application coordinator for Plan2Space 3D.
 */

import {
  fetchCapabilities,
  uploadFloorPlanImage,
  createFloorPlanJSON,
  getFloorPlan,
  updateFloorPlanGeometry,
  calibrateScale,
  startConversionJob,
  getConversionJob,
  getModelUrl,
} from './api.js';

import { PlanEditor2D } from './editor.js';
import { ModelViewer3D } from './viewer.js';

class App {
  constructor() {
    this.currentPlan = null;
    this.currentJob = null;
    this.editor = null;
    this.viewer = null;

    this.init();
  }

  async init() {
    // 1. Initialize 2D Editor
    const svgElem = document.getElementById('svg-editor-canvas');
    this.editor = new PlanEditor2D(svgElem, (updatedGeom) => {
      this.currentPlan.geometry = updatedGeom;
      this.updateStatsDisplay(this.currentPlan);
    });

    // 2. Initialize 3D Viewer
    const threeContainer = document.getElementById('three-canvas-container');
    this.viewer = new ModelViewer3D(threeContainer);

    // 3. Check capabilities
    try {
      const caps = await fetchCapabilities();
      const statusPill = document.getElementById('backend-status');
      statusPill.querySelector('.status-text').textContent = `FastAPI • ${caps.geometry_engine.split('+')[0].trim()}`;
    } catch (err) {
      console.warn('Backend not responding yet:', err);
    }

    // 4. Bind UI Event Handlers
    this.bindEvents();

    // 5. Auto-load first sample plan by default
    this.loadSample('simple_rect');
  }

  bindEvents() {
    // Sample buttons
    document.getElementById('btn-sample-rect').addEventListener('click', () => this.loadSample('simple_rect'));
    document.getElementById('btn-sample-l').addEventListener('click', () => this.loadSample('l_shaped'));
    document.getElementById('btn-sample-noisy').addEventListener('click', () => this.loadSample('noisy'));
    document.getElementById('btn-import-buildwise').addEventListener('click', () => this.importFromBuildWise());

    // File Upload & Drag-and-drop
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileUpload(e.target.files[0]);
      }
    });

    // Scale Tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((c) => (c.style.display = 'none'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.style.display = 'block';
      });
    });

    // Line Calibration
    const btnStartLineCal = document.getElementById('btn-start-line-cal');
    const lineCalInputs = document.getElementById('line-cal-inputs');
    btnStartLineCal.addEventListener('click', () => {
      this.editor.setTool('calibrate-line');
      lineCalInputs.style.display = 'block';
      document.getElementById('editor-hint').textContent = '📏 Click two points on the 2D plan to measure a known reference line.';
    });

    this.editor.onCalibrationLineComplete = (ptA, ptB) => {
      this.calPtA = ptA;
      this.calPtB = ptB;
      const pxDist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
      document.getElementById('editor-hint').textContent = `Line drawn: ${pxDist.toFixed(1)} px. Enter real-world length below and click Apply.`;
    };

    document.getElementById('btn-apply-line-cal').addEventListener('click', async () => {
      if (!this.calPtA || !this.calPtB || !this.currentPlan) return;
      const knownM = parseFloat(document.getElementById('cal-line-m').value) || 5.0;

      try {
        const updated = await calibrateScale(this.currentPlan.id, {
          method: 'line',
          point_a_px: [this.calPtA.x, this.calPtA.y],
          point_b_px: [this.calPtB.x, this.calPtB.y],
          known_length_m: knownM,
        });
        this.applyPlanUpdate(updated);
        this.editor.setTool('select');
        lineCalInputs.style.display = 'none';
        document.getElementById('editor-hint').textContent = 'Scale calibrated successfully!';
      } catch (err) {
        alert('Calibration error: ' + err.message);
      }
    });

    // Dimensions Calibration
    document.getElementById('btn-apply-dim-cal').addEventListener('click', async () => {
      if (!this.currentPlan) return;
      const widthM = parseFloat(document.getElementById('cal-dim-width').value);
      if (!widthM || widthM <= 0) return alert('Enter a valid width in metres.');

      try {
        const updated = await calibrateScale(this.currentPlan.id, {
          method: 'dimensions',
          known_width_m: widthM,
        });
        this.applyPlanUpdate(updated);
        alert('Plan scale updated.');
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // 2D Editor Tools
    const toolBtns = {
      'tool-select': 'select',
      'tool-add-wall': 'add-wall',
      'tool-add-door': 'add-door',
      'tool-add-window': 'add-window',
    };
    Object.entries(toolBtns).forEach(([btnId, toolName]) => {
      document.getElementById(btnId).addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
        document.getElementById(btnId).classList.add('active');
        this.editor.setTool(toolName);
      });
    });

    document.getElementById('tool-delete-selected').addEventListener('click', () => {
      this.editor.deleteSelectedWall();
    });

    document.getElementById('tool-save-geom').addEventListener('click', async () => {
      if (!this.currentPlan) return;
      try {
        const updated = await updateFloorPlanGeometry(this.currentPlan.id, this.currentPlan.geometry);
        this.applyPlanUpdate(updated);
        alert('Floor plan geometry saved!');
      } catch (err) {
        alert('Failed to save geometry: ' + err.message);
      }
    });

    // View Mode Switching
    document.getElementById('btn-view-2d').addEventListener('click', () => this.setViewMode('2d'));
    document.getElementById('btn-view-3d').addEventListener('click', () => this.setViewMode('3d'));
    document.getElementById('btn-view-split').addEventListener('click', () => this.setViewMode('split'));

    // 3D Viewer controls
    document.getElementById('toggle-layer-walls').addEventListener('change', (e) => {
      this.viewer.setLayerVisibility('walls', e.target.checked);
    });
    document.getElementById('toggle-layer-floor').addEventListener('change', (e) => {
      this.viewer.setLayerVisibility('floor', e.target.checked);
    });
    document.getElementById('toggle-layer-roof').addEventListener('change', (e) => {
      this.viewer.setLayerVisibility('roof', e.target.checked);
    });
    document.getElementById('toggle-wireframe').addEventListener('change', (e) => {
      this.viewer.setWireframe(e.target.checked);
    });

    document.getElementById('btn-cam-persp').addEventListener('click', () => this.viewer.setCameraPreset('persp'));
    document.getElementById('btn-cam-top').addEventListener('click', () => this.viewer.setCameraPreset('top'));
    document.getElementById('btn-cam-front').addEventListener('click', () => this.viewer.setCameraPreset('front'));
    document.getElementById('btn-cam-walk')?.addEventListener('click', () => this.viewer.setCameraPreset('walkthrough'));
    document.getElementById('btn-cam-reset').addEventListener('click', () => this.viewer.setCameraPreset('reset'));


    // 3D Generation Trigger
    document.getElementById('btn-generate-3d').addEventListener('click', () => this.generate3DModel());

    // Export buttons
    document.getElementById('btn-download-glb').addEventListener('click', () => {
      if (!this.currentJob) return;
      window.location.href = getModelUrl(this.currentJob.id, 'glb');
    });
    document.getElementById('btn-download-obj').addEventListener('click', () => {
      if (!this.currentJob) return;
      window.location.href = getModelUrl(this.currentJob.id, 'obj');
    });
    document.getElementById('btn-download-json').addEventListener('click', () => {
      if (!this.currentPlan) return;
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.currentPlan.geometry, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute('href', dataStr);
      dl.setAttribute('download', `${this.currentPlan.name || 'floorplan'}.json`);
      dl.click();
    });
    document.getElementById('btn-screenshot-png').addEventListener('click', () => {
      const dataUrl = this.viewer.captureScreenshot();
      if (!dataUrl) return;
      const dl = document.createElement('a');
      dl.setAttribute('href', dataUrl);
      dl.setAttribute('download', 'plan2space_3d_viewport.png');
      dl.click();
    });
  }

  async loadSample(sampleName) {
    try {
      // Create sample plan via JSON
      let geom;
      if (sampleName === 'simple_rect') {
        geom = {
          name: 'Clean Rectangle Sample',
          walls: [
            { id: 'w1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w2', start: { x: 10, y: 0 }, end: { x: 10, y: 8 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w3', start: { x: 10, y: 8 }, end: { x: 0, y: 8 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w4', start: { x: 0, y: 8 }, end: { x: 0, y: 0 }, thickness: 0.23, height: 2.7, is_exterior: true },
          ],
          openings: [
            { id: 'd1', wall_id: 'w1', type: 'door', position_along_wall: 4.0, width: 1.0, height: 2.1, sill_height: 0.0 },
            { id: 'win1', wall_id: 'w3', type: 'window', position_along_wall: 3.0, width: 1.5, height: 1.2, sill_height: 0.9 },
          ],
          rooms: [
            { id: 'r1', name: 'Main Living Room', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }], area_sqm: 80.0 },
          ],
          scale: { pixels_per_metre: 50.0, source: 'measured', confidence: 1.0 },
        };
      } else if (sampleName === 'l_shaped') {
        geom = {
          name: 'L-Shaped Multi-Room Sample',
          walls: [
            { id: 'w1', start: { x: 0, y: 0 }, end: { x: 12, y: 0 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w2', start: { x: 12, y: 0 }, end: { x: 12, y: 5 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w3', start: { x: 12, y: 5 }, end: { x: 7, y: 5 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w4', start: { x: 7, y: 5 }, end: { x: 7, y: 10 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w5', start: { x: 7, y: 10 }, end: { x: 0, y: 10 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w6', start: { x: 0, y: 10 }, end: { x: 0, y: 0 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w7_part', start: { x: 7, y: 0 }, end: { x: 7, y: 5 }, thickness: 0.15, height: 2.7, is_exterior: false },
          ],
          openings: [
            { id: 'd_main', wall_id: 'w6', type: 'door', position_along_wall: 2.0, width: 1.0, height: 2.1, sill_height: 0.0 },
            { id: 'd_bed', wall_id: 'w7_part', type: 'door', position_along_wall: 1.5, width: 0.9, height: 2.1, sill_height: 0.0 },
          ],
          rooms: [
            { id: 'r_living', name: 'Living Hall', polygon: [{ x: 0, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 10 }, { x: 0, y: 10 }], area_sqm: 70.0 },
            { id: 'r_bed', name: 'Master Bed', polygon: [{ x: 7, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 5 }, { x: 7, y: 5 }], area_sqm: 25.0 },
          ],
          scale: { pixels_per_metre: 50.0, source: 'measured', confidence: 1.0 },
        };
      } else {
        geom = {
          name: 'Noisy Plan Sample',
          walls: [
            { id: 'w1', start: { x: 0, y: 0 }, end: { x: 9, y: 0 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w2', start: { x: 9, y: 0 }, end: { x: 9, y: 7 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w3', start: { x: 9, y: 7 }, end: { x: 0, y: 7 }, thickness: 0.23, height: 2.7, is_exterior: true },
            { id: 'w4', start: { x: 0, y: 7 }, end: { x: 0, y: 0 }, thickness: 0.23, height: 2.7, is_exterior: true },
          ],
          openings: [
            { id: 'd1', wall_id: 'w1', type: 'door', position_along_wall: 3.5, width: 1.0, height: 2.1, sill_height: 0.0 },
          ],
          rooms: [],
          scale: { pixels_per_metre: 45.0, source: 'estimated', confidence: 0.6 },
        };
      }

      const plan = await createFloorPlanJSON({
        name: geom.name,
        geometry: geom,
      });

      this.applyPlanUpdate(plan);
      // Auto-trigger 3D generation for instantaneous preview
      this.generate3DModel();
    } catch (err) {
      console.error('Failed to load sample:', err);
    }
  }

  async handleFileUpload(file) {
    try {
      const plan = await uploadFloorPlanImage(file, file.name);
      this.applyPlanUpdate(plan);
      this.setViewMode('2d');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  }

  applyPlanUpdate(plan) {
    this.currentPlan = plan;
    this.editor.loadPlan(plan.geometry, plan.image_url);
    this.updateStatsDisplay(plan);
  }

  updateStatsDisplay(plan) {
    const geom = plan.geometry;
    document.getElementById('stat-walls').textContent = (geom.walls || []).length;
    document.getElementById('stat-openings').textContent = (geom.openings || []).length;
    document.getElementById('stat-rooms').textContent = (geom.rooms || []).length;

    const conf = geom.metadata?.confidence_score ?? (geom.scale?.confidence ?? 1.0);
    document.getElementById('stat-confidence').textContent = `${Math.round(conf * 100)}%`;

    // Scale card
    const ppm = geom.scale?.pixels_per_metre || 50;
    document.getElementById('scale-display').textContent = `${ppm.toFixed(1)} px/m`;
    const provBadge = document.getElementById('scale-provenance');
    provBadge.textContent = geom.scale?.source || 'default';
    provBadge.style.color = geom.scale?.source === 'user_provided' ? '#10b981' : '#f59e0b';

    // Warnings
    const warnBox = document.getElementById('warnings-container');
    const warnList = document.getElementById('warnings-list');
    warnList.innerHTML = '';
    const warnings = plan.warnings || [];
    if (warnings.length > 0) {
      warnBox.style.display = 'block';
      warnings.forEach((w) => {
        const li = document.createElement('li');
        li.textContent = w;
        warnList.appendChild(li);
      });
    } else {
      warnBox.style.display = 'none';
    }
  }

  async generate3DModel() {
    if (!this.currentPlan) return;

    const progressSection = document.getElementById('section-progress');
    const fill = document.getElementById('job-progress-fill');
    const stepLabel = document.getElementById('job-step-label');
    const pctLabel = document.getElementById('job-pct-label');
    const errBox = document.getElementById('job-error');

    progressSection.style.display = 'block';
    errBox.style.display = 'none';
    fill.style.width = '10%';
    stepLabel.textContent = 'Submitting 3D job...';
    pctLabel.textContent = '10%';

    const wallHeight = parseFloat(document.getElementById('param-wall-height').value) || 2.7;
    const extThick = parseFloat(document.getElementById('param-ext-thick').value) || 0.23;
    const includeFloor = document.getElementById('param-include-floor').value === 'true';
    const roofType = document.getElementById('param-roof-type').value;

    const params = {
      default_wall_height: wallHeight,
      exterior_wall_thickness: extThick,
      interior_wall_thickness: 0.115,
      floor_thickness: 0.15,
      include_floor: includeFloor,
      roof: { type: roofType, thickness: 0.15, pitch_deg: 20.0, overhang: 0.3 },
      export_formats: ['glb', 'obj'],
    };

    try {
      const job = await startConversionJob(this.currentPlan.id, params);
      this.currentJob = job;

      // Poll until done
      const pollInterval = setInterval(async () => {
        try {
          const poll = await getConversionJob(job.id);
          this.currentJob = poll;
          const pct = Math.round((poll.progress || 0.1) * 100);
          fill.style.width = `${pct}%`;
          stepLabel.textContent = poll.current_step || 'Processing...';
          pctLabel.textContent = `${pct}%`;

          if (poll.status === 'completed') {
            clearInterval(pollInterval);
            stepLabel.textContent = 'Conversion complete!';
            this.onConversionSuccess(poll);
          } else if (poll.status === 'failed') {
            clearInterval(pollInterval);
            errBox.style.display = 'block';
            errBox.textContent = poll.error || 'Conversion failed.';
          }
        } catch (e) {
          clearInterval(pollInterval);
          errBox.style.display = 'block';
          errBox.textContent = e.message;
        }
      }, 300);
    } catch (err) {
      errBox.style.display = 'block';
      errBox.textContent = err.message;
    }
  }

  onConversionSuccess(job) {
    // Enable export downloads
    document.getElementById('btn-download-glb').disabled = false;
    document.getElementById('btn-download-obj').disabled = false;
    document.getElementById('btn-download-json').disabled = false;

    // Enable Design Studio buttons
    document.querySelectorAll('.btn-open-studio').forEach((btn) => {
      btn.disabled = false;
      btn.onclick = () => {
        window.location.href = `/studio.html?conversion=${encodeURIComponent(job.id)}`;
      };
    });

    // Load GLB model in 3D viewer
    const glbUrl = getModelUrl(job.id, 'glb');
    if (this.currentPlan?.geometry?.rooms) {
      this.viewer.roomsData = this.currentPlan.geometry.rooms;
    }
    this.viewer.loadGLB(glbUrl, (info) => {
      // Update stats badge
      const statsBadge = document.getElementById('model-stats-badge');
      statsBadge.style.display = 'block';
      if (job.mesh_stats) {
        document.getElementById('badge-verts').textContent = `${job.mesh_stats.vertex_count} vertices`;
        document.getElementById('badge-faces').textContent = `${job.mesh_stats.face_count} faces`;
      }
    });

    // Switch view to 3D
    this.setViewMode('3d');
  }

  async importFromBuildWise() {
    const hint = document.getElementById('editor-hint');
    if (hint) hint.textContent = 'Connecting to BuildWise API on port 8000...';
    try {
      let planData = null;
      try {
        const savedRes = await fetch('http://localhost:8000/api/plans/saved');
        if (savedRes.ok) {
          const list = await savedRes.json();
          if (list && list.length > 0) {
            planData = list[0].plan;
          }
        }
      } catch (e) {
        console.warn('Could not fetch saved plans from BuildWise:', e);
      }

      if (!planData) {
        // Generate live plan from BuildWise
        const genRes = await fetch('http://localhost:8000/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request: {
              plot: { width: 40, depth: 60 },
              road_side: 'N',
              setbacks: { front: 5, rear: 3, left: 3, right: 3 },
              floors: 1,
              rooms: [
                { id: 'living', name: 'Living Room', type: 'living', target_area: 240 },
                { id: 'kitchen', name: 'Kitchen', type: 'kitchen', target_area: 120 },
                { id: 'dining', name: 'Dining Room', type: 'dining', target_area: 140 },
                { id: 'master', name: 'Master Bedroom', type: 'master_bedroom', target_area: 180 },
                { id: 'master_bath', name: 'Master Bath', type: 'attached_bathroom', target_area: 60 },
                { id: 'bed_2', name: 'Bedroom 2', type: 'bedroom', target_area: 150 },
                { id: 'common_bath', name: 'Common Bath', type: 'bathroom', target_area: 50 },
              ],
            },
          }),
        });
        if (!genRes.ok) throw new Error('Could not connect to BuildWise API on port 8000.');
        const genData = await genRes.json();
        planData = genData.plans[0];
      }

      // Convert BuildWise rooms (feet) to Plan2Space geometry (metres)
      const FT_TO_M = 0.3048;
      const roomsRaw = planData.floors?.[0]?.rooms || planData.rooms || [];
      const walls = [];
      const rooms = [];

      roomsRaw.forEach((r, idx) => {
        const rx = +(r.x * FT_TO_M).toFixed(3);
        const ry = +(r.y * FT_TO_M).toFixed(3);
        const rw = +(r.width * FT_TO_M).toFixed(3);
        const rh = +(r.height * FT_TO_M).toFixed(3);

        rooms.push({
          id: `rm_${r.id || idx}`,
          name: r.name || 'Room',
          polygon: [
            { x: rx, y: ry },
            { x: +(rx + rw).toFixed(3), y: ry },
            { x: +(rx + rw).toFixed(3), y: +(ry + rh).toFixed(3) },
            { x: rx, y: +(ry + rh).toFixed(3) },
          ],
          area_sqm: +(rw * rh).toFixed(2),
        });

        // 4 boundary segments
        [
          [{ x: rx, y: ry }, { x: +(rx + rw).toFixed(3), y: ry }],
          [{ x: +(rx + rw).toFixed(3), y: ry }, { x: +(rx + rw).toFixed(3), y: +(ry + rh).toFixed(3) }],
          [{ x: +(rx + rw).toFixed(3), y: +(ry + rh).toFixed(3) }, { x: rx, y: +(ry + rh).toFixed(3) }],
          [{ x: rx, y: +(ry + rh).toFixed(3) }, { x: rx, y: ry }],
        ].forEach((seg, sIdx) => {
          walls.push({
            id: `w_bw_${idx}_${sIdx}`,
            start: seg[0],
            end: seg[1],
            thickness: 0.23,
            height: 2.8,
            is_exterior: true,
            source: 'measured',
          });
        });
      });

      const geom = {
        name: `BuildWise: ${planData.archetype_name || 'Architectural Plan'}`,
        walls: walls,
        openings: [
          { id: 'op_main', wall_id: walls[0]?.id || 'w_bw_0_0', type: 'door', position_along_wall: 1.5, width: 1.0, height: 2.1, sill_height: 0.0 },
        ],
        rooms: rooms,
        scale: { pixels_per_metre: 50.0, source: 'measured', confidence: 1.0 },
      };

      const plan = await createFloorPlanJSON({
        name: geom.name,
        geometry: geom,
      });

      this.applyPlanUpdate(plan);
      if (hint) hint.textContent = 'Plan imported from BuildWise! Generating 3D model...';
      this.generate3DModel();
    } catch (err) {
      alert('BuildWise Connection: ' + err.message);
    }
  }

  setViewMode(mode) {
    const p2d = document.getElementById('panel-2d');
    const p3d = document.getElementById('panel-3d');
    const vControls = document.getElementById('viewer-controls');

    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));

    if (mode === '2d') {
      document.getElementById('btn-view-2d').classList.add('active');
      p2d.style.display = 'flex';
      p3d.style.display = 'none';
      vControls.style.display = 'none';
    } else if (mode === '3d') {
      document.getElementById('btn-view-3d').classList.add('active');
      p2d.style.display = 'none';
      p3d.style.display = 'flex';
      vControls.style.display = 'flex';
      this.viewer.onResize();
    } else if (mode === 'split') {
      document.getElementById('btn-view-split').classList.add('active');
      p2d.style.display = 'flex';
      p3d.style.display = 'flex';
      vControls.style.display = 'flex';
      this.viewer.onResize();
    }
  }
}

// Start app once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
