/**
 * Wall, Floor, and Ceiling Painter for Plan2Space 3D Design Studio.
 * Smooth, 60 FPS, glitch-free painting with independent face groups and material cloning.
 * Supports:
 * - Individual wall face painting (e.g. inside of Living Room vs Bedroom/Exterior)
 * - Whole wall painting
 * - Paint Whole Room (paints perimeter wall faces facing room + room floor)
 * - Paint All Walls (batch recolors all house walls)
 * - Floor & Ceiling Painting
 * - Drag-safe clicking (prevents accidental painting during camera orbit/pan)
 * - Emissive hover highlights per face with zero color corruption
 * - 24 curated architectural colors, custom picker, recent colors row, eyedropper
 * - Full Undo / Redo support (50 steps)
 */

import * as THREE from 'three';

export class WallPainter {
  constructor(scene, camera, domElement, historyManager, wallFacesLookup = {}) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.history = historyManager;
    this.wallFacesLookup = wallFacesLookup || {};

    this.activeColor = '#93C5FD';
    this.activeFinish = 'matte'; // 'matte', 'satin', 'gloss'
    this.recentColors = ['#93C5FD', '#F8F7F2', '#EDE6D6', '#E2E8F0', '#334155', '#3B82F6', '#166534', '#C2410C'];
    this.eyedropperActive = false;
    this.paintTarget = 'face'; // 'face' or 'wall'

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Hover Highlight State
    this.hoveredMesh = null;
    this.hoveredMatIndex = null;

    // Drag-protection tracking
    this.pointerDownPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;

    // Painted State Trackers: wallState[wallId][face] = { color, finish }
    this.wallState = {};
    this.floorState = {};
    this.ceilingState = { color: '#FFFFFF', finish: 'matte' };
    this.enabled = true;
    this.architecture = null;

    window.addEventListener('architecture-cutouts-updated', () => {
      this.setupAllWallFaceGroups();
    });

    this.bindEvents();
  }

  setArchitecture(arch) {
    this.architecture = arch;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.clearHoverHighlight();
      this.eyedropperActive = false;
      this.domElement.style.cursor = 'default';
    } else {
      this.setupAllWallFaceGroups();
    }
  }

  setPaintTarget(target) {
    this.paintTarget = target === 'wall' ? 'wall' : 'face';
    this.showToast(`Painting mode: ${this.paintTarget === 'face' ? 'Individual Face Side' : 'Whole Wall'}`);
  }

  setWallFacesLookup(lookup) {
    this.wallFacesLookup = lookup || {};
    this.setupAllWallFaceGroups();
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  getRoughness(finish) {
    if (finish === 'gloss') return 0.12;
    if (finish === 'satin') return 0.45;
    return 0.85; // matte
  }

  getWallId(mesh) {
    if (!mesh) return null;
    if (mesh.userData && mesh.userData.wallId) return mesh.userData.wallId;
    let n = mesh.name || '';
    if (!n.toLowerCase().startsWith('wall') && mesh.parent && mesh.parent.name) {
      if (mesh.parent.name.toLowerCase().startsWith('wall')) {
        n = mesh.parent.name;
      }
    }
    if (n.startsWith('wall:')) return n.slice(5);
    if (n.startsWith('wall_')) return n.slice(5);
    if (n.toLowerCase().startsWith('wall')) return n.replace(/^wall[:_]?/i, '');
    return n;
  }

  findWallMesh(wallId) {
    let found = null;
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper && !this.isFurnitureOrOpening(child)) {
        const id = this.getWallId(child);
        if (id === wallId || child.name === `wall:${wallId}` || child.name === wallId) {
          found = child;
        }
      }
    });
    return found;
  }

  // --- Geometry Face Group Setup for Individual Wall Faces ---

  /**
   * Configures a wall mesh's BufferGeometry into 4 distinct face groups:
   * Group 0: pos_normal face (e.g. inner room A face)
   * Group 1: neg_normal face (e.g. inner room B or exterior face)
   * Group 2: top face (top edge)
   * Group 3: caps (side ends, door/window jambs)
   */
  setupWallGeometryGroups(mesh, wallId, wallInfo) {
    if (!mesh || !mesh.geometry) return;
    if (mesh.userData.hasWallGroups) return;

    let geom = mesh.geometry;
    if (geom.index) {
      geom = geom.toNonIndexed();
    }
    geom.computeVertexNormals();

    const posAttr = geom.attributes.position;
    const normAttr = geom.attributes.normal;
    if (!posAttr) return;

    const totalVerts = posAttr.count;
    const numTris = Math.floor(totalVerts / 3);
    if (numTris === 0) return;

    const posNormal = wallInfo?.faces?.pos_normal?.normal_3d
      ? new THREE.Vector3(...wallInfo.faces.pos_normal.normal_3d).normalize()
      : new THREE.Vector3(0, 0, 1);
    const negNormal = wallInfo?.faces?.neg_normal?.normal_3d
      ? new THREE.Vector3(...wallInfo.faces.neg_normal.normal_3d).normalize()
      : new THREE.Vector3(0, 0, -1);

    const groupTris = [[], [], [], []]; // 0: pos, 1: neg, 2: top, 3: caps
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3(), triNormal = new THREE.Vector3();

    for (let i = 0; i < numTris; i++) {
      const idx = i * 3;
      vA.fromBufferAttribute(posAttr, idx);
      vB.fromBufferAttribute(posAttr, idx + 1);
      vC.fromBufferAttribute(posAttr, idx + 2);

      cb.subVectors(vC, vB);
      ab.subVectors(vA, vB);
      cb.cross(ab).normalize();
      triNormal.copy(cb);

      if (triNormal.y > 0.6) {
        groupTris[2].push(i); // top
      } else {
        const dotPos = triNormal.dot(posNormal);
        const dotNeg = triNormal.dot(negNormal);
        if (dotPos > 0.42) {
          groupTris[0].push(i); // pos_normal
        } else if (dotNeg > 0.42) {
          groupTris[1].push(i); // neg_normal
        } else {
          groupTris[3].push(i); // caps / jambs / bottom
        }
      }
    }

    const newPositions = new Float32Array(totalVerts * 3);
    const newNormals = new Float32Array(totalVerts * 3);
    let vertOffset = 0;
    const groupRanges = [];

    for (let g = 0; g < 4; g++) {
      const startVert = vertOffset;
      const tris = groupTris[g];
      for (const t of tris) {
        const srcIdx = t * 3;
        for (let k = 0; k < 3; k++) {
          const s = (srcIdx + k) * 3;
          const d = vertOffset * 3;
          newPositions[d] = posAttr.array[s];
          newPositions[d + 1] = posAttr.array[s + 1];
          newPositions[d + 2] = posAttr.array[s + 2];

          newNormals[d] = normAttr.array[s];
          newNormals[d + 1] = normAttr.array[s + 1];
          newNormals[d + 2] = normAttr.array[s + 2];
          vertOffset++;
        }
      }
      const countVerts = vertOffset - startVert;
      groupRanges.push({ start: startVert, count: countVerts, materialIndex: g });
    }

    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    newGeom.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));

    newGeom.clearGroups();
    for (const r of groupRanges) {
      if (r.count > 0) {
        newGeom.addGroup(r.start, r.count, r.materialIndex);
      }
    }

    mesh.geometry.dispose();
    mesh.geometry = newGeom;
    mesh.userData.hasWallGroups = true;

    // Create 4 distinct materials so each face is painted and highlighted independently
    const baseColor = (mesh.material && mesh.material.color) ? mesh.material.color.clone() : new THREE.Color(0xF8F7F2);
    const baseRoughness = mesh.material ? (mesh.material.roughness || 0.85) : 0.85;

    const createFaceMat = (name) => {
      const m = new THREE.MeshStandardMaterial({
        color: baseColor.clone(),
        roughness: baseRoughness,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      m.name = name;
      return m;
    };

    mesh.material = [
      createFaceMat('pos_normal'),
      createFaceMat('neg_normal'),
      createFaceMat('top'),
      createFaceMat('caps'),
    ];
  }

  setupAllWallFaceGroups() {
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper && !this.isFurnitureOrOpening(child)) {
        const wallId = this.getWallId(child);
        const name = (child.name || '').toLowerCase();
        if (wallId || name.startsWith('wall') || child.userData.isWallCutoutSegment) {
          const wInfo = this.wallFacesLookup[wallId];
          this.setupWallGeometryGroups(child, wallId, wInfo);
        }
      }
    });
  }

  // --- Smooth Emissive Hover Highlighting ---

  setHoverHighlight(mesh, matIndex = 0) {
    if (this.hoveredMesh === mesh && this.hoveredMatIndex === matIndex) return;
    this.clearHoverHighlight();

    if (!mesh || !mesh.material || !mesh.visible) return;
    this.hoveredMesh = mesh;
    this.hoveredMatIndex = matIndex;

    if (Array.isArray(mesh.material)) {
      const idx = Math.max(0, Math.min(matIndex, mesh.material.length - 1));
      const mat = mesh.material[idx];
      if (mat && mat.emissive) {
        mat.userData._preHoverEmissive = mat.emissive.getHex();
        mat.userData._preHoverIntensity = mat.emissiveIntensity || 0;
        mat.emissive.setHex(0x38bdf8); // sky blue glow
        mat.emissiveIntensity = 0.28;
      }
    } else if (mesh.material && mesh.material.emissive) {
      mesh.material.userData._preHoverEmissive = mesh.material.emissive.getHex();
      mesh.material.userData._preHoverIntensity = mesh.material.emissiveIntensity || 0;
      mesh.material.emissive.setHex(0x38bdf8);
      mesh.material.emissiveIntensity = 0.28;
    }
  }

  clearHoverHighlight() {
    if (!this.hoveredMesh) return;
    if (Array.isArray(this.hoveredMesh.material)) {
      this.hoveredMesh.material.forEach((m) => {
        if (m && m.emissive) {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        }
      });
    } else if (this.hoveredMesh.material && this.hoveredMesh.material.emissive) {
      this.hoveredMesh.material.emissive.setHex(0x000000);
      this.hoveredMesh.material.emissiveIntensity = 0;
    }
    this.hoveredMesh = null;
    this.hoveredMatIndex = null;
  }

  isFurnitureOrOpening(child) {
    let p = child;
    while (p && p !== this.scene) {
      if (
        p.userData?.isArchitecturalOpening ||
        p.userData?.isOpening ||
        p.userData?.isGhost ||
        p.userData?.isFurniture ||
        p.userData?.itemType ||
        (p.name && (
          p.name.startsWith('furniture') ||
          p.name.startsWith('furn_') ||
          p.name.startsWith('op_') ||
          p.name.startsWith('door_') ||
          p.name.startsWith('window_')
        ))
      ) {
        return true;
      }
      p = p.parent;
    }
    return false;
  }

  getPaintableCandidates() {
    const candidates = [];
    this.scene.traverse((child) => {
      if (
        child.isMesh &&
        child.visible &&
        !child.userData.isHelper &&
        !child.userData.isGizmo &&
        !this.isFurnitureOrOpening(child)
      ) {
        const wallId = this.getWallId(child);
        const name = (child.name || '').toLowerCase();
        if (
          wallId ||
          child.userData.isWallCutoutSegment ||
          name.includes('wall') ||
          name.includes('floor') ||
          name.includes('roof') ||
          name.includes('ceiling')
        ) {
          candidates.push(child);
        }
      }
    });
    return candidates;
  }

  // --- Pointer Events with Drag Protection ---

  isArchitectureBusy() {
    // If wall painter is enabled (user clicked Paint tab), NEVER block painting!
    if (this.enabled) {
      // Only block if a door/window ghost preview is actively visible right under the cursor
      if (this.architecture && this.architecture.ghostPreview && this.architecture.ghostPreview.visible) {
        return true;
      }
      return false;
    }
    return true;
  }

  onPointerDown(e) {
    if (!this.enabled || e.button !== 0) return;
    if (this.viewer && this.viewer.isWalkthrough) return;
    if (this.isArchitectureBusy()) return;

    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.pointerDownTime = performance.now();
  }

  onPointerUp(e) {
    if (!this.enabled || e.button !== 0) return;
    if (this.viewer && this.viewer.isWalkthrough) return;
    if (this.isArchitectureBusy()) return;

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    const dist = Math.hypot(dx, dy);
    const elapsed = performance.now() - this.pointerDownTime;

    // Ignore drags / camera orbit (> 5px or > 600ms)
    if (dist > 5 || elapsed > 600) return;

    this.executePaintAt(e.clientX, e.clientY);
  }

  onPointerMove(e) {
    if (!this.enabled || this.isArchitectureBusy() || (this.viewer && this.viewer.isWalkthrough)) {
      this.clearHoverHighlight();
      return;
    }
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const candidates = this.getPaintableCandidates();
    const intersects = this.raycaster.intersectObjects(candidates, false);

    const hintEl = document.querySelector('.viewport-hint');

    if (intersects.length > 0) {
      const hit = intersects[0];
      const obj = hit.object;
      const name = (obj.name || (obj.parent ? obj.parent.name : '')).toLowerCase();
      const wallId = this.getWallId(obj);
      const matIdx = hit.face ? (hit.face.materialIndex ?? 0) : 0;

      this.setHoverHighlight(obj, matIdx);
      this.domElement.style.cursor = this.eyedropperActive ? 'crosshair' : 'pointer';

      if (name.includes('floor')) {
        const roomId = obj.name.includes(':') ? obj.name.split(':')[1] : 'Floor';
        if (hintEl) hintEl.textContent = `🎯 Hovering: Floor (${roomId}) — Click to paint with ${this.activeColor}`;
      } else if (name.includes('roof') || name.includes('ceiling')) {
        if (hintEl) hintEl.textContent = `🎯 Hovering: Ceiling / Roof — Click to paint with ${this.activeColor}`;
      } else {
        const wInfo = this.wallFacesLookup[wallId];
        let faceName = 'Wall Segment';
        if (matIdx === 0 && wInfo?.faces?.pos_normal) {
          faceName = `Inner Face (${wInfo.faces.pos_normal.room_name || 'Room'})`;
        } else if (matIdx === 1 && wInfo?.faces?.neg_normal) {
          faceName = `Opposite Face (${wInfo.faces.neg_normal.room_name || 'Room/Exterior'})`;
        } else if (matIdx === 2) {
          faceName = 'Top Edge';
        } else if (matIdx === 3) {
          faceName = 'End / Frame';
        }
        if (hintEl) hintEl.textContent = `🎯 Hovering: ${faceName} (${wallId}) — Click to paint with ${this.activeColor}`;
      }
    } else {
      this.clearHoverHighlight();
      this.domElement.style.cursor = 'default';
      if (hintEl) hintEl.textContent = '💡 Click any wall face or floor to paint it with the chosen color. Press Esc to deselect.';
    }
  }

  executePaintAt(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const candidates = this.getPaintableCandidates();
    const intersects = this.raycaster.intersectObjects(candidates, false);

    if (!intersects || intersects.length === 0) return;

    const hit = intersects[0];
    const obj = hit.object;

    // Eyedropper mode
    if (this.eyedropperActive) {
      this.sampleColorFromObject(hit);
      this.eyedropperActive = false;
      window.dispatchEvent(new CustomEvent('eyedropper-done', { detail: { color: this.activeColor } }));
      return;
    }

    const name = (obj.name || (obj.parent ? obj.parent.name : '')).toLowerCase();
    const wallId = this.getWallId(obj);

    if (name.includes('floor')) {
      const roomId = obj.name.includes(':') ? obj.name.split(':')[1] : 'floor';
      this.paintFloor(roomId, this.activeColor, this.activeFinish, true);
    } else if (name.includes('roof') || name.includes('ceiling')) {
      this.paintCeiling(this.activeColor, this.activeFinish, true);
    } else {
      const wId = wallId || obj.name;
      const matIdx = hit.face ? (hit.face.materialIndex ?? 0) : 0;

      let faceSide = 'all';
      if (this.paintTarget === 'face') {
        if (matIdx === 0) faceSide = 'pos_normal';
        else if (matIdx === 1) faceSide = 'neg_normal';
        else if (matIdx === 2) faceSide = 'top';
        else if (matIdx === 3) faceSide = 'caps';
      }

      this.paintWallFace(wId, faceSide, this.activeColor, this.activeFinish, true);
    }
  }

  sampleColorFromObject(hit) {
    let sampledColor = '#93C5FD';
    const obj = hit.object || hit;
    const matIdx = hit.face ? (hit.face.materialIndex ?? 0) : 0;

    if (obj.material) {
      if (Array.isArray(obj.material)) {
        const mat = obj.material[matIdx] || obj.material[0];
        if (mat && mat.color) sampledColor = '#' + mat.color.getHexString().toUpperCase();
      } else if (obj.material.color) {
        sampledColor = '#' + obj.material.color.getHexString().toUpperCase();
      }
    }
    this.setActiveColor(sampledColor);
    this.showToast(`Sampled color: ${sampledColor}`);
  }

  setActiveColor(hex) {
    if (!hex) return;
    this.activeColor = hex.toUpperCase();
    if (!this.recentColors.includes(this.activeColor)) {
      this.recentColors.unshift(this.activeColor);
      if (this.recentColors.length > 8) this.recentColors.pop();
    }
  }

  setActiveFinish(finish) {
    this.activeFinish = finish || 'matte';
  }

  // --- Core Painting Methods ---

  paintWallFace(wallId, face, hex, finish, recordHistory = true) {
    this.clearHoverHighlight();
    const mesh = this.findWallMesh(wallId);
    if (!mesh) {
      // Fallback search across scene
      this.scene.traverse((child) => {
        if (child.isMesh && (child.name.includes(wallId) || this.getWallId(child) === wallId)) {
          this.applyFaceColor(child, face, hex, finish);
        }
      });
      return;
    }

    const col = new THREE.Color(hex);
    const roughness = this.getRoughness(finish);

    // Save previous state for undo
    const oldState = this.wallState[wallId] ? JSON.parse(JSON.stringify(this.wallState[wallId])) : {};

    // Apply color to target mesh and any cutout submeshes of this wall
    this.applyFaceColor(mesh, face, hex, finish);
    this.scene.traverse((child) => {
      if (child.isMesh && child !== mesh && this.getWallId(child) === wallId) {
        this.applyFaceColor(child, face, hex, finish);
      }
    });

    this.wallState[wallId] = this.wallState[wallId] || {};
    if (face === 'all') {
      this.wallState[wallId] = {
        pos_normal: { color: hex, finish },
        neg_normal: { color: hex, finish },
        top: { color: hex, finish },
        caps: { color: hex, finish },
        all: { color: hex, finish },
      };
    } else {
      this.wallState[wallId][face] = { color: hex, finish };
    }

    this.showToast(`🎨 Wall painted: ${hex}`);

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: `Paint wall ${wallId} (${face})`,
        undo: () => {
          this.clearHoverHighlight();
          const targetMeshes = [];
          this.scene.traverse((c) => {
            if (c.isMesh && this.getWallId(c) === wallId) targetMeshes.push(c);
          });
          if (targetMeshes.length === 0) targetMeshes.push(mesh);
          targetMeshes.forEach((m) => {
            if (Object.keys(oldState).length === 0) {
              this.applyFaceColor(m, 'all', '#F8F7F2', 'matte');
            } else {
              for (const [f, s] of Object.entries(oldState)) {
                this.applyFaceColor(m, f, s.color, s.finish);
              }
            }
          });
          if (Object.keys(oldState).length === 0) delete this.wallState[wallId];
          else this.wallState[wallId] = oldState;
        },
        redo: () => {
          this.clearHoverHighlight();
          this.scene.traverse((c) => {
            if (c.isMesh && this.getWallId(c) === wallId) {
              this.applyFaceColor(c, face, hex, finish);
            }
          });
          if (face === 'all') {
            this.wallState[wallId] = {
              pos_normal: { color: hex, finish },
              neg_normal: { color: hex, finish },
              top: { color: hex, finish },
              caps: { color: hex, finish },
              all: { color: hex, finish },
            };
          } else {
            this.wallState[wallId][face] = { color: hex, finish };
          }
        },
      });
    }
  }

  applyFaceColor(mesh, face, hex, finish) {
    if (!mesh || !mesh.visible) return;
    const col = new THREE.Color(hex);
    const roughness = this.getRoughness(finish);

    if (Array.isArray(mesh.material)) {
      const applyToMat = (mat) => {
        if (!mat) return;
        mat.color.copy(col);
        mat.roughness = roughness;
        mat.vertexColors = false;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.needsUpdate = true;
      };

      if (face === 'all') {
        mesh.material.forEach(applyToMat);
      } else if (face === 'pos_normal' && mesh.material[0]) {
        applyToMat(mesh.material[0]);
      } else if (face === 'neg_normal' && mesh.material[1]) {
        applyToMat(mesh.material[1]);
      } else if (face === 'top' && mesh.material[2]) {
        applyToMat(mesh.material[2]);
      } else if (face === 'caps' && mesh.material[3]) {
        applyToMat(mesh.material[3]);
      } else {
        mesh.material.forEach(applyToMat);
      }
    } else if (mesh.material) {
      if (!mesh.userData.isClonedMaterial) {
        mesh.material = mesh.material.clone();
        mesh.userData.isClonedMaterial = true;
      }
      mesh.material.color.copy(col);
      mesh.material.roughness = roughness;
      mesh.material.vertexColors = false;
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
      mesh.material.needsUpdate = true;
    }
  }

  paintAllWalls(hex, finish, recordHistory = true) {
    this.clearHoverHighlight();
    const oldStates = JSON.parse(JSON.stringify(this.wallState));

    const apply = (c, f) => {
      this.scene.traverse((child) => {
        if (child.isMesh && child.visible && !child.userData.isHelper && !child.userData.isArchitecturalOpening) {
          const wallId = this.getWallId(child);
          const name = (child.name || '').toLowerCase();
          if (wallId || name.startsWith('wall')) {
            this.applyFaceColor(child, 'all', c, f);
            const wId = wallId || child.name;
            this.wallState[wId] = {
              pos_normal: { color: c, finish: f },
              neg_normal: { color: c, finish: f },
              top: { color: c, finish: f },
              caps: { color: c, finish: f },
              all: { color: c, finish: f },
            };
          }
        }
      });
    };

    apply(hex, finish);
    this.showToast(`🧱 Painted all walls: ${hex}`);

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: 'Paint all walls',
        undo: () => {
          this.clearHoverHighlight();
          this.restoreWallState(oldStates);
        },
        redo: () => {
          this.clearHoverHighlight();
          apply(hex, finish);
        },
      });
    }
  }

  paintWholeRoom(roomId, hex, finish, recordHistory = true) {
    this.clearHoverHighlight();
    const oldStates = JSON.parse(JSON.stringify(this.wallState));
    const oldFloor = this.floorState[roomId] ? { ...this.floorState[roomId] } : null;

    const apply = (c, f) => {
      let facesPainted = 0;
      for (const [wId, wInfo] of Object.entries(this.wallFacesLookup)) {
        if (wInfo.faces?.pos_normal?.room_id === roomId) {
          this.paintWallFace(wId, 'pos_normal', c, f, false);
          facesPainted++;
        }
        if (wInfo.faces?.neg_normal?.room_id === roomId) {
          this.paintWallFace(wId, 'neg_normal', c, f, false);
          facesPainted++;
        }
      }

      if (facesPainted === 0) {
        // Fallback: match walls that contain roomId in name
        this.scene.traverse((child) => {
          if (child.isMesh && child.visible && !child.userData.isHelper && !child.userData.isArchitecturalOpening) {
            const name = (child.name || '').toLowerCase();
            if (name.includes(roomId.toLowerCase())) {
              this.applyFaceColor(child, 'all', c, f);
            }
          }
        });
      }

      // Paint floor for this room
      this.paintFloor(roomId, c, f, false);
    };

    apply(hex, finish);
    this.showToast(`🏠 Painted room faces & floor: ${hex}`);

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: `Paint whole room ${roomId}`,
        undo: () => {
          this.clearHoverHighlight();
          this.restoreWallState(oldStates);
          if (oldFloor) {
            this.paintFloor(roomId, oldFloor.color, oldFloor.finish, false);
          }
        },
        redo: () => {
          this.clearHoverHighlight();
          apply(hex, finish);
        },
      });
    }
  }

  resetWall(wallId, recordHistory = true) {
    this.clearHoverHighlight();
    const old = this.wallState[wallId] ? JSON.parse(JSON.stringify(this.wallState[wallId])) : null;

    const applyReset = () => {
      const mesh = this.findWallMesh(wallId);
      if (mesh) {
        this.applyFaceColor(mesh, 'all', '#F8F7F2', 'matte');
      }
      delete this.wallState[wallId];
    };

    applyReset();
    this.showToast(`Wall reset to default: ${wallId}`);

    if (recordHistory && old && this.history) {
      this.history.pushAction({
        description: `Reset wall ${wallId}`,
        undo: () => {
          this.clearHoverHighlight();
          for (const [face, s] of Object.entries(old)) {
            this.paintWallFace(wallId, face, s.color, s.finish, false);
          }
        },
        redo: () => {
          this.clearHoverHighlight();
          applyReset();
        },
      });
    }
  }

  paintFloor(roomId, hex, finish, recordHistory = true) {
    this.clearHoverHighlight();
    let mesh = null;
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper) {
        const name = (child.name || (child.parent ? child.parent.name : '')).toLowerCase();
        if (name === `floor:${roomId}` || name.includes(roomId) || name.includes('floor')) {
          if (!mesh) mesh = child;
        }
      }
    });

    if (!mesh) return;

    const oldColor = this.floorState[roomId]?.color || '#CBD5E1';
    const oldFinish = this.floorState[roomId]?.finish || 'matte';

    const apply = (c, f) => {
      this.applyFaceColor(mesh, 'all', c, f);
      this.floorState[roomId] = { color: c, finish: f };
    };

    apply(hex, finish);
    this.showToast(`Floor painted: ${hex}`);

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: `Paint floor ${roomId}`,
        undo: () => {
          this.clearHoverHighlight();
          apply(oldColor, oldFinish);
        },
        redo: () => {
          this.clearHoverHighlight();
          apply(hex, finish);
        },
      });
    }
  }

  setViewer(viewer) {
    this.viewer = viewer;
  }

  paintRoof(hex, finish = 'matte', recordHistory = true) {
    this.clearHoverHighlight();
    const oldColor = this.ceilingState.color || '#C2410C';
    const oldFinish = this.ceilingState.finish || 'matte';

    const apply = (c, f) => {
      if (this.viewer && this.viewer.updateRoof) {
        this.viewer.updateRoof({ color: c, finish: f });
      } else {
        let mesh = null;
        this.scene.traverse((child) => {
          if (child.isMesh && child.visible && !child.userData.isHelper) {
            const name = (child.name || '').toLowerCase();
            if (name === 'roof' || name.includes('roof')) mesh = child;
          }
        });
        if (mesh) this.applyFaceColor(mesh, 'all', c, f);
      }

      this.ceilingState = {
        color: c,
        finish: f,
        roof_type: this.viewer?.roofConfig?.type || 'tiles',
        roof_shape: this.viewer?.roofConfig?.shape || 'gabled',
        roof_visible: this.viewer?.roofConfig?.visible !== undefined ? this.viewer.roofConfig.visible : false,
      };
    };

    apply(hex, finish);
    this.showToast(`🏠 Roof painted: ${hex}`);

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: 'Paint roof',
        undo: () => {
          this.clearHoverHighlight();
          apply(oldColor, oldFinish);
        },
        redo: () => {
          this.clearHoverHighlight();
          apply(hex, finish);
        },
      });
    }
  }

  paintCeiling(hex, finish = 'matte', recordHistory = true) {
    this.paintRoof(hex, finish, recordHistory);
  }

  restoreWallState(savedWallState) {
    this.clearHoverHighlight();
    this.wallState = JSON.parse(JSON.stringify(savedWallState || {}));
    for (const [wId, faces] of Object.entries(this.wallState)) {
      for (const [face, s] of Object.entries(faces)) {
        this.paintWallFace(wId, face, s.color, s.finish, false);
      }
    }
  }

  getSerializedState() {
    const wallsList = [];
    for (const [wId, faces] of Object.entries(this.wallState)) {
      for (const [face, s] of Object.entries(faces)) {
        if (s && s.color) {
          wallsList.push({
            wall_id: wId,
            face: face,
            color: s.color,
            finish: s.finish || 'matte',
          });
        }
      }
    }

    const floorsList = [];
    for (const [roomId, s] of Object.entries(this.floorState)) {
      if (s && s.color) {
        floorsList.push({
          room_id: roomId,
          color: s.color,
          finish: s.finish,
        });
      }
    }

    return {
      walls: wallsList,
      floors: floorsList,
      ceiling: this.ceilingState,
    };
  }

  loadSerializedState(designData) {
    if (!designData) return;
    if (designData.walls && Array.isArray(designData.walls)) {
      designData.walls.forEach((w) => {
        this.paintWallFace(w.wall_id, w.face || 'all', w.color, w.finish || 'matte', false);
      });
    }
    if (designData.floors && Array.isArray(designData.floors)) {
      designData.floors.forEach((f) => {
        this.paintFloor(f.room_id, f.color, f.finish || 'matte', false);
      });
    }
    if (designData.ceiling && designData.ceiling.color) {
      if (this.viewer && this.viewer.updateRoof) {
        this.viewer.updateRoof({
          color: designData.ceiling.color,
          finish: designData.ceiling.finish || 'matte',
          type: designData.ceiling.roof_type || 'tiles',
          shape: designData.ceiling.roof_shape || 'gabled',
          visible: !!designData.ceiling.roof_visible,
        });
      }
      this.ceilingState = {
        color: designData.ceiling.color,
        finish: designData.ceiling.finish || 'matte',
        roof_type: designData.ceiling.roof_type || 'tiles',
        roof_shape: designData.ceiling.roof_shape || 'gabled',
        roof_visible: !!designData.ceiling.roof_visible,
      };
    }
  }

  bindEvents() {
    this.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }
}
