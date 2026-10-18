/**
 * Interactive 2D SVG Correction Editor.
 * Allows moving wall endpoints, adding walls, placing openings, and measuring scale.
 */

export class PlanEditor2D {
  constructor(svgElement, onGeometryChange) {
    this.svg = svgElement;
    this.onGeometryChange = onGeometryChange;

    this.geometry = null;
    this.imageUrl = null;
    this.activeTool = 'select'; // 'select', 'add-wall', 'add-door', 'add-window', 'calibrate-line'
    this.selectedWallId = null;

    // Viewport transform
    this.viewBox = { x: 0, y: 0, w: 1000, h: 800 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Interaction states
    this.dragTarget = null; // { wallId, handle: 'start' | 'end' }
    this.newWallStart = null;
    this.calibrationPoints = [];
    this.onCalibrationLineComplete = null;

    this.initEvents();
  }

  loadPlan(geometry, imageUrl = null) {
    this.geometry = JSON.parse(JSON.stringify(geometry));
    this.imageUrl = imageUrl;
    this.selectedWallId = null;

    // Set initial viewBox based on image dimensions or wall bounds
    if (this.geometry.image_width_px && this.geometry.image_height_px) {
      this.viewBox.w = this.geometry.image_width_px;
      this.viewBox.h = this.geometry.image_height_px;
      this.viewBox.x = 0;
      this.viewBox.y = 0;
    } else {
      const ppm = this.geometry.scale?.pixels_per_metre || 50;
      this.viewBox.w = 800;
      this.viewBox.h = 600;
    }

    this.updateViewBox();
    this.render();
  }

  setTool(tool) {
    this.activeTool = tool;
    this.newWallStart = null;
    if (tool !== 'calibrate-line') {
      this.calibrationPoints = [];
    }
    this.render();
  }

  updateViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
  }

  screenToSvg(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = this.svg.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
  }

  mathToSvg(mX, mY) {
    const ppm = this.geometry.scale.pixels_per_metre || 50;
    const imgH = this.viewBox.h;
    return {
      x: mX * ppm,
      y: imgH - (mY * ppm),
    };
  }

  svgToMath(svgX, svgY) {
    const ppm = this.geometry.scale.pixels_per_metre || 50;
    const imgH = this.viewBox.h;
    return {
      x: +(svgX / ppm).toFixed(4),
      y: +((imgH - svgY) / ppm).toFixed(4),
    };
  }

  initEvents() {
    // Mouse down
    this.svg.addEventListener('mousedown', (e) => {
      const pt = this.screenToSvg(e.clientX, e.clientY);

      // Handle Calibration mode
      if (this.activeTool === 'calibrate-line') {
        this.calibrationPoints.push({ x: pt.x, y: pt.y });
        this.render();
        if (this.calibrationPoints.length === 2) {
          if (this.onCalibrationLineComplete) {
            this.onCalibrationLineComplete(this.calibrationPoints[0], this.calibrationPoints[1]);
          }
        }
        return;
      }

      // Handle Add Wall mode
      if (this.activeTool === 'add-wall') {
        if (!this.newWallStart) {
          this.newWallStart = pt;
        } else {
          // Finish new wall
          const m1 = this.svgToMath(this.newWallStart.x, this.newWallStart.y);
          const m2 = this.svgToMath(pt.x, pt.y);
          const newWall = {
            id: `w_custom_${Date.now().toString(36)}`,
            start: m1,
            end: m2,
            thickness: 0.23,
            height: 2.7,
            is_exterior: true,
            source: 'user_provided',
          };
          this.geometry.walls.push(newWall);
          this.newWallStart = null;
          this.notifyChange();
          this.render();
        }
        return;
      }

      // Check if clicked a handle
      const target = e.target;
      if (target.dataset.handle) {
        this.dragTarget = {
          wallId: target.dataset.wallId,
          handle: target.dataset.handle,
        };
        return;
      }

      // Check if clicked a wall
      if (target.dataset.wallId) {
        this.selectedWallId = target.dataset.wallId;
        if (this.activeTool === 'add-door' || this.activeTool === 'add-window') {
          this.addOpeningToWall(this.selectedWallId, pt, this.activeTool === 'add-door' ? 'door' : 'window');
        }
        this.render();
        return;
      }

      // Clicked empty space
      this.selectedWallId = null;
      this.render();
    });

    // Mouse move
    this.svg.addEventListener('mousemove', (e) => {
      if (!this.dragTarget) return;

      const pt = this.screenToSvg(e.clientX, e.clientY);
      const wall = this.geometry.walls.find(w => w.id === this.dragTarget.wallId);
      if (!wall) return;

      const m = this.svgToMath(pt.x, pt.y);
      if (this.dragTarget.handle === 'start') {
        wall.start = m;
      } else {
        wall.end = m;
      }
      this.render();
    });

    // Mouse up
    window.addEventListener('mouseup', () => {
      if (this.dragTarget) {
        this.dragTarget = null;
        this.notifyChange();
      }
    });
  }

  addOpeningToWall(wallId, clickSvgPt, type) {
    const wall = this.geometry.walls.find(w => w.id === wallId);
    if (!wall) return;

    const p1 = this.mathToSvg(wall.start.x, wall.start.y);
    const p2 = this.mathToSvg(wall.end.x, wall.end.y);
    const wallPxLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (wallPxLen < 1) return;

    // Project click onto wall segment
    const t = Math.max(0.1, Math.min(0.9, (
      (clickSvgPt.x - p1.x) * (p2.x - p1.x) + (clickSvgPt.y - p1.y) * (p2.y - p1.y)
    ) / (wallPxLen * wallPxLen)));

    const wallLenM = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    const offsetM = +(t * wallLenM).toFixed(3);
    const widthM = type === 'door' ? 0.9 : 1.2;

    const op = {
      id: `op_${Date.now().toString(36)}`,
      wall_id: wallId,
      type: type,
      position_along_wall: Math.min(offsetM, Math.max(0, wallLenM - widthM)),
      width: widthM,
      height: type === 'door' ? 2.1 : 1.2,
      sill_height: type === 'door' ? 0.0 : 0.9,
      source: 'user_provided',
    };

    if (!this.geometry.openings) this.geometry.openings = [];
    this.geometry.openings.push(op);
    this.notifyChange();
    this.render();
  }

  deleteSelectedWall() {
    if (!this.selectedWallId) return;
    this.geometry.walls = this.geometry.walls.filter(w => w.id !== this.selectedWallId);
    this.geometry.openings = (this.geometry.openings || []).filter(o => o.wall_id !== this.selectedWallId);
    this.selectedWallId = null;
    this.notifyChange();
    this.render();
  }

  notifyChange() {
    if (this.onGeometryChange && this.geometry) {
      this.onGeometryChange(this.geometry);
    }
  }

  render() {
    if (!this.geometry) return;
    const svg = this.svg;
    svg.innerHTML = '';

    // 1. Background image
    if (this.imageUrl) {
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.setAttribute('href', this.imageUrl);
      img.setAttribute('x', '0');
      img.setAttribute('y', '0');
      img.setAttribute('width', this.viewBox.w);
      img.setAttribute('height', this.viewBox.h);
      img.setAttribute('opacity', '0.6');
      svg.appendChild(img);
    }

    // 2. Render Walls
    const wallGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    (this.geometry.walls || []).forEach(wall => {
      const p1 = this.mathToSvg(wall.start.x, wall.start.y);
      const p2 = this.mathToSvg(wall.end.x, wall.end.y);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
      line.setAttribute('class', `svg-wall ${wall.is_exterior ? '' : 'svg-wall-interior'} ${wall.id === this.selectedWallId ? 'selected' : ''}`);
      line.dataset.wallId = wall.id;
      wallGroup.appendChild(line);

      // Render Handles for active or selected walls
      ['start', 'end'].forEach(handle => {
        const hPt = handle === 'start' ? p1 : p2;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', hPt.x);
        circle.setAttribute('cy', hPt.y);
        circle.setAttribute('r', '7');
        circle.setAttribute('class', 'svg-handle');
        circle.dataset.wallId = wall.id;
        circle.dataset.handle = handle;
        wallGroup.appendChild(circle);
      });
    });
    svg.appendChild(wallGroup);

    // 3. Render Openings
    const opGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const ppm = this.geometry.scale?.pixels_per_metre || 50;

    (this.geometry.openings || []).forEach(op => {
      const wall = this.geometry.walls.find(w => w.id === op.wall_id);
      if (!wall) return;

      const p1 = this.mathToSvg(wall.start.x, wall.start.y);
      const p2 = this.mathToSvg(wall.end.x, wall.end.y);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const wallLenPx = Math.hypot(dx, dy);
      if (wallLenPx < 1) return;

      const ux = dx / wallLenPx;
      const uy = dy / wallLenPx;

      const startPx = op.position_along_wall * ppm;
      const widthPx = op.width * ppm;

      const ox1 = p1.x + startPx * ux;
      const oy1 = p1.y + startPx * uy;
      const ox2 = p1.x + (startPx + widthPx) * ux;
      const oy2 = p1.y + (startPx + widthPx) * uy;

      const opLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      opLine.setAttribute('x1', ox1);
      opLine.setAttribute('y1', oy1);
      opLine.setAttribute('x2', ox2);
      opLine.setAttribute('y2', oy2);
      opLine.setAttribute('class', op.type === 'door' ? 'svg-opening-door' : 'svg-opening-window');
      opGroup.appendChild(opLine);
    });
    svg.appendChild(opGroup);

    // 4. Calibration visual overlay
    if (this.calibrationPoints.length > 0) {
      const calGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.calibrationPoints.forEach(pt => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', pt.x);
        c.setAttribute('cy', pt.y);
        c.setAttribute('r', '5');
        c.setAttribute('class', 'svg-cal-point');
        calGroup.appendChild(c);
      });
      if (this.calibrationPoints.length === 2) {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', this.calibrationPoints[0].x);
        l.setAttribute('y1', this.calibrationPoints[0].y);
        l.setAttribute('x2', this.calibrationPoints[1].x);
        l.setAttribute('y2', this.calibrationPoints[1].y);
        l.setAttribute('class', 'svg-cal-line');
        calGroup.appendChild(l);
      }
      svg.appendChild(calGroup);
    }
  }
}
