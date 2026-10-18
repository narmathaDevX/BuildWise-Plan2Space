/**
 * Architecture Manager for Plan2Space 3D Design Studio.
 * Allows interactive 3D architectural editing:
 * - Demolishing / Removing any wall (knocking down walls)
 * - Adding Doors (Single, Double French, Sliding, Archway) to any wall
 * - Adding Windows (Standard, Picture Window) to any wall
 * - Selecting and inspecting walls and architectural openings
 * - Full Undo / Redo support (50 steps)
 */

import * as THREE from 'three';

export const OPENING_PRESETS = {
  standard_door: {
    id: 'standard_door',
    name: 'Standard Door',
    category: 'door',
    width: 0.9,
    height: 2.1,
    icon: '🚪',
    description: 'Single timber swing door with metal knob',
  },
  double_door: {
    id: 'double_door',
    name: 'French Double Door',
    category: 'door',
    width: 1.6,
    height: 2.1,
    icon: '🚪🚪',
    description: 'Classic double swing doors with brass handles',
  },
  sliding_door: {
    id: 'sliding_door',
    name: 'Sliding Glass Door',
    category: 'door',
    width: 2.0,
    height: 2.2,
    icon: '🪟',
    description: 'Modern aluminum patio sliding door with glass',
  },
  arch_opening: {
    id: 'arch_opening',
    name: 'Arched Walkway',
    category: 'door',
    width: 1.2,
    height: 2.3,
    icon: '🏛️',
    description: 'Open pass-through archway with rounded header',
  },
  standard_window: {
    id: 'standard_window',
    name: '2-Pane Window',
    category: 'window',
    width: 1.2,
    height: 1.2,
    sill_height: 0.9,
    icon: '🪟',
    description: 'Standard residential casement window with glass',
  },
  picture_window: {
    id: 'picture_window',
    name: 'Large Picture Window',
    category: 'window',
    width: 2.0,
    height: 1.5,
    sill_height: 0.7,
    icon: '🖼️',
    description: 'Expansive picture window for maximum natural light',
  },
};

export class ArchitectureManager {
  constructor(scene, camera, domElement, historyManager, viewer) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.history = historyManager;
    this.viewer = viewer;

    this.activeTool = 'inspect'; // 'inspect' | 'demolish' | 'door' | 'window'
    this.selectedOpeningPreset = 'standard_door';

    // State
    this.demolishedWallIds = new Set();
    this.openings = []; // Installed door/window groups
    this.selectedWallId = null;
    this.selectedOpening = null;

    this.baseWallMeshes = new Map(); // wallId -> original solid mesh
    this.wallCutoutGroups = new Map(); // wallId -> THREE.Group containing sliced submeshes
    this.geometryData = null;

    // Ghost preview for placing
    this.ghostPreview = null;
    this.currentWallTarget = null;

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;
    this.enabled = false;

    this.bindEvents();
  }

  setGeometryData(geomData) {
    this.geometryData = geomData;
  }

  registerBaseWall(wallMesh) {
    if (!wallMesh) return;
    const wallId = this.getWallId(wallMesh);
    if (wallId && !this.baseWallMeshes.has(wallId)) {
      this.baseWallMeshes.set(wallId, wallMesh);
    }
  }

  registerAllBaseWalls() {
    this.scene.traverse((child) => {
      if (child.isMesh && !child.userData.isHelper && !child.userData.isArchitecturalOpening && !child.userData.isWallCutoutSegment) {
        const wallId = this.getWallId(child);
        if (wallId && !this.baseWallMeshes.has(wallId)) {
          this.baseWallMeshes.set(wallId, child);
        }
      }
    });
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.cancelPlacing();
      this.activeTool = 'inspect';
      this.deselectAll();
      if (this.hoveredObject) {
        this.setEmissive(this.hoveredObject, 0x000000, 0);
        this.hoveredObject = null;
      }
      this.domElement.style.cursor = 'default';
    } else {
      this.renderWallListUI();
    }
  }

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  getWallId(mesh) {
    if (!mesh) return null;
    if (mesh.userData && mesh.userData.wallId) return mesh.userData.wallId;
    const n = mesh.name || (mesh.parent ? mesh.parent.name : '') || '';
    if (n.startsWith('wall:')) return n.slice(5);
    if (n.startsWith('wall_')) return n.slice(5);
    if (n.toLowerCase().startsWith('wall')) return n.replace(/^wall[:_]?/i, '');
    return n;
  }

  findWallMesh(wallId) {
    if (!wallId) return null;
    if (this.baseWallMeshes && this.baseWallMeshes.has(wallId)) {
      return this.baseWallMeshes.get(wallId);
    }
    let found = null;
    this.scene.traverse((child) => {
      if (child.isMesh && !child.userData.isWallCutoutSegment) {
        const id = this.getWallId(child);
        if (id === wallId || child.name === `wall:${wallId}` || child.name === wallId) {
          found = child;
        }
      }
    });
    if (found) return found;

    this.scene.traverse((child) => {
      if (child.isMesh) {
        const id = this.getWallId(child);
        if (id === wallId || child.name === `wall:${wallId}` || child.name === wallId) {
          found = child;
        }
      }
    });
    return found;
  }

  getAllWallMeshes() {
    const walls = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper && !child.userData.isArchitecturalOpening) {
        const name = (child.name || (child.parent ? child.parent.name : '')).toLowerCase();
        if (name.includes('floor') || name.includes('roof') || name.startsWith('furn_') || name.startsWith('furniture:')) {
          return;
        }
        const wallId = this.getWallId(child);
        if (wallId || name.includes('wall') || name.includes('w_bw')) {
          walls.push(child);
        } else if (this.viewer && this.viewer.walls && this.viewer.walls.includes(child)) {
          walls.push(child);
        }
      }
    });
    return walls;
  }

  setActiveTool(tool) {
    if (tool !== 'door' && tool !== 'window') {
      this.cancelPlacing();
    }
    this.activeTool = tool;
    this.deselectAll();

    // Update UI active buttons
    document.querySelectorAll('.arch-tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    const hint = document.querySelector('.viewport-hint');
    if (hint) {
      if (tool === 'demolish') {
        hint.textContent = '🔨 Demolish Mode: Click on any wall to knock it down / remove it.';
      } else if (tool === 'door' || tool === 'window') {
        const p = OPENING_PRESETS[this.selectedOpeningPreset] || {};
        hint.textContent = `🚪 Placing ${p.name || 'Door'}: Hover over any wall in 3D and click to insert.`;
      } else {
        hint.textContent = '🧱 Inspect Mode: Click on any wall or door to inspect and edit.';
      }
    }
  }

  selectOpeningPreset(presetId) {
    this.selectedOpeningPreset = presetId;
    const p = OPENING_PRESETS[presetId];
    if (p) {
      this.setActiveTool(p.category === 'window' ? 'window' : 'door');
    }
  }

  // --- Procedural 3D Door & Window Generators ---

  createOpeningMesh(presetId, width, height, sillHeight = 0, customThick = 0.32) {
    const group = new THREE.Group();
    const thick = customThick || 0.32; // wall thickness span
    const frameThick = 0.05;
    const w = width;
    const h = height;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.65 }); // dark walnut
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.55 }); // warm timber
    const casingMat = new THREE.MeshStandardMaterial({ color: 0x2e1a12, roughness: 0.70 }); // dark wood trim
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true,
      opacity: 0.45,
    });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 }); // brass

    if (presetId === 'standard_door') {
      // 1. Jambs & Lintel Frame
      const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h, thick), frameMat);
      leftJamb.position.set(-w / 2 + frameThick / 2, h / 2, 0);
      const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h, thick), frameMat);
      rightJamb.position.set(w / 2 - frameThick / 2, h / 2, 0);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick, thick), frameMat);
      lintel.position.set(0, h - frameThick / 2, 0);
      group.add(leftJamb, rightJamb, lintel);

      // 2. Door Casings (Front and Back trims)
      const casingThick = 0.04;
      const casingDepth = 0.02;
      const fCasingLeft = new THREE.Mesh(new THREE.BoxGeometry(casingThick, h + 0.04, casingDepth), casingMat);
      fCasingLeft.position.set(-w / 2 - casingThick / 2, (h + 0.04) / 2, thick / 2 + casingDepth / 2);
      const fCasingRight = new THREE.Mesh(new THREE.BoxGeometry(casingThick, h + 0.04, casingDepth), casingMat);
      fCasingRight.position.set(w / 2 + casingThick / 2, (h + 0.04) / 2, thick / 2 + casingDepth / 2);
      const fCasingTop = new THREE.Mesh(new THREE.BoxGeometry(w + casingThick * 2, casingThick, casingDepth), casingMat);
      fCasingTop.position.set(0, h + casingThick / 2, thick / 2 + casingDepth / 2);

      const bCasingLeft = new THREE.Mesh(new THREE.BoxGeometry(casingThick, h + 0.04, casingDepth), casingMat);
      bCasingLeft.position.set(-w / 2 - casingThick / 2, (h + 0.04) / 2, -thick / 2 - casingDepth / 2);
      const bCasingRight = new THREE.Mesh(new THREE.BoxGeometry(casingThick, h + 0.04, casingDepth), casingMat);
      bCasingRight.position.set(w / 2 + casingThick / 2, (h + 0.04) / 2, -thick / 2 - casingDepth / 2);
      const bCasingTop = new THREE.Mesh(new THREE.BoxGeometry(w + casingThick * 2, casingThick, casingDepth), casingMat);
      bCasingTop.position.set(0, h + casingThick / 2, -thick / 2 - casingDepth / 2);

      group.add(fCasingLeft, fCasingRight, fCasingTop, bCasingLeft, bCasingRight, bCasingTop);

      // 3. Door Panel (swung wide open ~83 deg for walkthrough)
      const doorW = w - frameThick * 2;
      const doorH = h - frameThick;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.04), panelMat);
      panel.position.set(doorW / 2, doorH / 2, 0);
      const hingePivot = new THREE.Group();
      hingePivot.name = 'door_hinge_pivot';
      hingePivot.position.set(-w / 2 + frameThick, 0, 0);
      hingePivot.rotation.y = -1.45; // ~83 degrees swung wide open flat against wall
      hingePivot.add(panel);

      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12), handleMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(doorW - 0.08, 1.0, 0.035);
      hingePivot.add(handle);

      group.add(hingePivot);
    } else if (presetId === 'double_door') {
      // French Double Door (both leaves swung open wide)
      const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h, thick), frameMat);
      leftJamb.position.set(-w / 2 + frameThick / 2, h / 2, 0);
      const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h, thick), frameMat);
      rightJamb.position.set(w / 2 - frameThick / 2, h / 2, 0);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick, thick), frameMat);
      lintel.position.set(0, h - frameThick / 2, 0);
      group.add(leftJamb, rightJamb, lintel);

      const leafW = (w - frameThick * 2) / 2;
      const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, h - frameThick, 0.04), panelMat);
      leftLeaf.position.set(leafW / 2, h / 2, 0);
      const leftHinge = new THREE.Group();
      leftHinge.name = 'door_hinge_left';
      leftHinge.position.set(-w / 2 + frameThick, 0, 0);
      leftHinge.rotation.y = -1.40; // swung wide open
      leftHinge.add(leftLeaf);

      const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, h - frameThick, 0.04), panelMat);
      rightLeaf.position.set(-leafW / 2, h / 2, 0);
      const rightHinge = new THREE.Group();
      rightHinge.name = 'door_hinge_right';
      rightHinge.position.set(w / 2 - frameThick, 0, 0);
      rightHinge.rotation.y = 1.40; // swung wide open
      rightHinge.add(rightLeaf);

      // Handles
      const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14), handleMat);
      h1.rotation.z = Math.PI / 2;
      h1.position.set(leafW - 0.04, 1.0, 0.035);
      leftHinge.add(h1);

      const h2 = h1.clone();
      h2.position.set(-leafW + 0.04, 1.0, 0.035);
      rightHinge.add(h2);

      group.add(leftHinge, rightHinge);
    } else if (presetId === 'sliding_door') {
      // Sliding Glass Door with Aluminum Frame (slide open for walkthrough)
      const aluMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
      const frameBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, thick * 0.7), aluMat);
      frameBox.position.set(0, h / 2, 0);

      // Fixed Glass Pane on the right
      const glassFixed = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.04, h - 0.1, 0.02), glassMat);
      glassFixed.position.set(w / 4, h / 2, 0.02);

      // Slid-open Pane slid over behind fixed pane, leaving left half 100% open walkway
      const glassSlid = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.04, h - 0.1, 0.02), glassMat);
      glassSlid.name = 'door_sliding_pane';
      glassSlid.position.set(w / 4, h / 2, -0.02);

      group.add(frameBox, glassFixed, glassSlid);
    } else if (presetId === 'arch_opening') {
      // Arched Pass-through: completely open walkway
      const archMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
      const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick * 1.5, h - w / 2, thick), archMat);
      leftJamb.position.set(-w / 2 + frameThick * 0.75, (h - w / 2) / 2, 0);
      const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(frameThick * 1.5, h - w / 2, thick), archMat);
      rightJamb.position.set(w / 2 - frameThick * 0.75, (h - w / 2) / 2, 0);

      // Rounded Arch Header
      const archCurve = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - frameThick * 0.75, frameThick * 0.75, 8, 24, Math.PI), archMat);
      archCurve.position.set(0, h - w / 2, 0);

      group.add(leftJamb, rightJamb, archCurve);

    } else {
      // Standard / Picture Window
      const frameBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, thick * 0.8), frameMat);
      frameBox.position.set(0, h / 2 + sillHeight, 0);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w - frameThick * 2, h - frameThick * 2, 0.02), glassMat);
      glass.position.set(0, h / 2 + sillHeight, 0);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.04, thick + 0.08), panelMat);
      sill.position.set(0, sillHeight, 0);

      group.add(frameBox, glass, sill);
    }

    group.userData = {
      isArchitecturalOpening: true,
      presetId,
      width: w,
      height: h,
      sillHeight,
    };

    group.traverse((c) => {
      c.userData.isArchitecturalOpening = true;
    });

    return group;
  }

  toggleDoorOpen(opGroup) {
    if (!opGroup) return;
    const isCurrentlyOpen = opGroup.userData.isOpen !== false;
    const newOpen = !isCurrentlyOpen;
    opGroup.userData.isOpen = newOpen;

    const pivot = opGroup.getObjectByName('door_hinge_pivot');
    if (pivot) pivot.rotation.y = newOpen ? -1.45 : 0;

    const leftHinge = opGroup.getObjectByName('door_hinge_left');
    if (leftHinge) leftHinge.rotation.y = newOpen ? -1.40 : 0;

    const rightHinge = opGroup.getObjectByName('door_hinge_right');
    if (rightHinge) rightHinge.rotation.y = newOpen ? 1.40 : 0;

    const sliding = opGroup.getObjectByName('door_sliding_pane');
    if (sliding) {
      const w = opGroup.userData.width || 2.0;
      sliding.position.x = newOpen ? w / 4 : -w / 4;
    }

    this.showToast(newOpen ? '🚪 Door swung open' : '🚪 Door closed');
  }

  // --- Wall Cutout System: Wall Vanishes In Between Doors ---

  updateWallCutouts(wallId) {
    let baseMesh = this.baseWallMeshes.get(wallId);
    if (!baseMesh) {
      baseMesh = this.findWallMesh(wallId);
      if (baseMesh) this.baseWallMeshes.set(wallId, baseMesh);
    }
    if (!baseMesh) return;

    // 1. Remove previous cutout submeshes for this wall
    const existingGroup = this.wallCutoutGroups.get(wallId);
    if (existingGroup) {
      this.scene.remove(existingGroup);
      existingGroup.traverse((c) => {
        if (c.isMesh && c.geometry) c.geometry.dispose();
      });
      this.wallCutoutGroups.delete(wallId);
    }

    // 2. Filter active visible openings on this wall
    const wallOps = this.openings.filter((op) => op.userData.wallId === wallId && op.visible);

    // If wall is demolished, everything remains hidden
    if (this.demolishedWallIds.has(wallId)) {
      baseMesh.visible = false;
      return;
    }

    // If no openings exist on this wall, restore original solid wall
    if (wallOps.length === 0) {
      baseMesh.visible = true;
      return;
    }

    // 3. Generate sliced submeshes (left piece, right piece, top lintel header)
    const cutoutGroup = this.createWallCutoutGroup(baseMesh, wallId, wallOps);
    if (cutoutGroup && cutoutGroup.children.length > 0) {
      // Hide solid base wall ONLY when cutout group is verified and added!
      baseMesh.visible = false;
      this.scene.add(cutoutGroup);
      this.wallCutoutGroups.set(wallId, cutoutGroup);
    } else {
      // Safety fallback: Keep original wall visible so wall never disappears
      baseMesh.visible = true;
    }
    window.dispatchEvent(new CustomEvent('architecture-cutouts-updated', { detail: { wallId } }));
  }

  createWallCutoutGroup(baseMesh, wallId, wallOps) {
    const bbox = new THREE.Box3().setFromObject(baseMesh);
    const min = bbox.min;
    const max = bbox.max;
    const size = bbox.getSize(new THREE.Vector3());

    if (size.x < 0.05 && size.z < 0.05) return null;

    const isAlongX = size.x >= size.z;
    const wallHeight = Math.max(0.5, size.y);

    // Extract wall material properties
    let wallColor = 0xf8f7f2;
    let wallRoughness = 0.85;
    if (baseMesh.material) {
      if (Array.isArray(baseMesh.material)) {
        const m0 = baseMesh.material[0] || baseMesh.material[1];
        if (m0 && m0.color) wallColor = m0.color.getHex();
        if (m0 && m0.roughness !== undefined) wallRoughness = m0.roughness;
      } else {
        if (baseMesh.material.color) wallColor = baseMesh.material.color.getHex();
        if (baseMesh.material.roughness !== undefined) wallRoughness = baseMesh.material.roughness;
      }
    }

    const createCutoutMaterial = () => {
      if (Array.isArray(baseMesh.material)) {
        return baseMesh.material.map((m) =>
          m
            ? m.clone()
            : new THREE.MeshStandardMaterial({
                color: wallColor,
                roughness: wallRoughness,
                metalness: 0.05,
                side: THREE.DoubleSide,
              })
        );
      }
      return new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: wallRoughness,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
    };

    const cutoutGroup = new THREE.Group();
    cutoutGroup.name = `cutoutGroup_${wallId}`;
    cutoutGroup.userData = {
      wallId: wallId,
      isWallCutoutGroup: true,
    };

    if (isAlongX) {
      // --- Horizontal Wall (runs along X axis) ---
      const thick = Math.max(0.1, size.z);
      const cz = (min.z + max.z) / 2;

      // Filter and sort openings along X
      const sortedOps = wallOps.map((op) => {
        const w = op.userData.width || 0.9;
        const h = op.userData.height || 2.1;
        const s = op.userData.sillHeight || 0;
        const opMinX = Math.max(min.x, op.position.x - w / 2);
        const opMaxX = Math.min(max.x, op.position.x + w / 2);
        return {
          op,
          minX: opMinX,
          maxX: opMaxX,
          height: h,
          sillHeight: s,
        };
      }).filter((item) => item.maxX > item.minX + 0.02)
        .sort((a, b) => a.minX - b.minX);

      if (sortedOps.length === 0) return null;

      let currX = min.x;

      sortedOps.forEach((opItem) => {
        // 1. Wall portion to the left of the door (full height)
        if (opItem.minX > currX + 0.02) {
          const segW = opItem.minX - currX;
          const cx = currX + segW / 2;
          const cy = (min.y + max.y) / 2;
          const geo = new THREE.BoxGeometry(segW, wallHeight, thick);
          const m = new THREE.Mesh(geo, createCutoutMaterial());
          m.position.set(cx, cy, cz);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = `wall:${wallId}`;
          m.userData = { wallId, isWallCutoutSegment: true };
          cutoutGroup.add(m);
        }

        const opSpan = opItem.maxX - opItem.minX;
        const opCx = (opItem.minX + opItem.maxX) / 2;

        // 2a. Sill (if window or raised sill)
        if (opItem.sillHeight > 0.05) {
          const sillH = Math.min(opItem.sillHeight, wallHeight);
          const cySill = min.y + sillH / 2;
          const geo = new THREE.BoxGeometry(opSpan, sillH, thick);
          const m = new THREE.Mesh(geo, createCutoutMaterial());
          m.position.set(opCx, cySill, cz);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = `wall:${wallId}`;
          m.userData = { wallId, isWallCutoutSegment: true };
          cutoutGroup.add(m);
        }

        // 2b. DOORWAY OPENING: The space from (min.y + sillHeight) to (min.y + sillHeight + height)
        // ONLY THIS SPACE IS EMPTY!

        // 2c. Top Lintel portion above the door (from door top to wall ceiling)
        const lintelBottom = min.y + opItem.sillHeight + opItem.height;
        if (lintelBottom < max.y - 0.02) {
          const lintelH = max.y - lintelBottom;
          const cyLintel = lintelBottom + lintelH / 2;
          const geo = new THREE.BoxGeometry(opSpan, lintelH, thick);
          const m = new THREE.Mesh(geo, createCutoutMaterial());
          m.position.set(opCx, cyLintel, cz);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = `wall:${wallId}`;
          m.userData = { wallId, isWallCutoutSegment: true };
          cutoutGroup.add(m);
        }

        currX = Math.max(currX, opItem.maxX);
      });

      // 3. Wall portion to the right of the last door (full height)
      if (currX < max.x - 0.02) {
        const segW = max.x - currX;
        const cx = currX + segW / 2;
        const cy = (min.y + max.y) / 2;
        const geo = new THREE.BoxGeometry(segW, wallHeight, thick);
        const m = new THREE.Mesh(geo, createCutoutMaterial());
        m.position.set(cx, cy, cz);
        m.castShadow = true;
        m.receiveShadow = true;
        m.name = `wall:${wallId}`;
        m.userData = { wallId, isWallCutoutSegment: true };
        cutoutGroup.add(m);
      }
    } else {
      // --- Vertical Wall (runs along Z axis) ---
      const thick = Math.max(0.1, size.x);
      const cx = (min.x + max.x) / 2;

      // Filter and sort openings along Z
      const sortedOps = wallOps.map((op) => {
        const w = op.userData.width || 0.9;
        const h = op.userData.height || 2.1;
        const s = op.userData.sillHeight || 0;
        const opMinZ = Math.max(min.z, op.position.z - w / 2);
        const opMaxZ = Math.min(max.z, op.position.z + w / 2);
        return {
          op,
          minZ: opMinZ,
          maxZ: opMaxZ,
          height: h,
          sillHeight: s,
        };
      }).filter((item) => item.maxZ > item.minZ + 0.02)
        .sort((a, b) => a.minZ - b.minZ);

      if (sortedOps.length === 0) return null;

      let currZ = min.z;

      sortedOps.forEach((opItem) => {
        // 1. Wall portion before this door (full height)
        if (opItem.minZ > currZ + 0.02) {
          const segD = opItem.minZ - currZ;
          const cz = currZ + segD / 2;
          const cy = (min.y + max.y) / 2;
          const geo = new THREE.BoxGeometry(thick, wallHeight, segD);
          const m = new THREE.Mesh(geo, createCutoutMaterial());
          m.position.set(cx, cy, cz);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = `wall:${wallId}`;
          m.userData = { wallId, isWallCutoutSegment: true };
          cutoutGroup.add(m);
        }

        const opSpan = opItem.maxZ - opItem.minZ;
        const opCz = (opItem.minZ + opItem.maxZ) / 2;

        // 2a. Sill (if window or raised sill)
        if (opItem.sillHeight > 0.05) {
          const sillH = Math.min(opItem.sillHeight, wallHeight);
          const cySill = min.y + sillH / 2;
          const geo = new THREE.BoxGeometry(thick, sillH, opSpan);
          const m = new THREE.Mesh(geo, createCutoutMaterial());
          m.position.set(cx, cySill, opCz);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = `wall:${wallId}`;
          m.userData = { wallId, isWallCutoutSegment: true };
          cutoutGroup.add(m);
        }

        // 2b. DOORWAY OPENING: The space from (min.y + sillHeight) to (min.y + sillHeight + height)
        // ONLY THIS SPACE IS EMPTY!

        // 2c. Top Lintel portion above the door (from door top to wall ceiling)
        const lintelBottom = min.y + opItem.sillHeight + opItem.height;
        if (lintelBottom < max.y - 0.02) {
          const lintelH = max.y - lintelBottom;
          const cyLintel = lintelBottom + lintelH / 2;
          const geo = new THREE.BoxGeometry(thick, lintelH, opSpan);
          const m = new THREE.Mesh(geo, createCutoutMaterial());
          m.position.set(cx, cyLintel, opCz);
          m.castShadow = true;
          m.receiveShadow = true;
          m.name = `wall:${wallId}`;
          m.userData = { wallId, isWallCutoutSegment: true };
          cutoutGroup.add(m);
        }

        currZ = Math.max(currZ, opItem.maxZ);
      });

      // 3. Wall portion after the last door (full height)
      if (currZ < max.z - 0.02) {
        const segD = max.z - currZ;
        const cz = currZ + segD / 2;
        const cy = (min.y + max.y) / 2;
        const geo = new THREE.BoxGeometry(thick, wallHeight, segD);
        const m = new THREE.Mesh(geo, createCutoutMaterial());
        m.position.set(cx, cy, cz);
        m.castShadow = true;
        m.receiveShadow = true;
        m.name = `wall:${wallId}`;
        m.userData = { wallId, isWallCutoutSegment: true };
        cutoutGroup.add(m);
      }
    }

    return cutoutGroup;
  }

  // --- Wall Demolition (Knocking Down Walls) ---

  demolishWall(wallId, recordHistory = true) {
    if (!wallId) return;
    const mesh = this.findWallMesh(wallId);
    if (!mesh) {
      console.warn(`[ArchitectureManager] Cannot demolish wall: mesh not found for ${wallId}`);
      return;
    }

    this.registerBaseWall(mesh);
    mesh.visible = false;
    mesh.userData.isDemolished = true;
    this.demolishedWallIds.add(wallId);

    // Update cutouts for this wall (will hide cutouts while demolished)
    this.updateWallCutouts(wallId);

    // Also remove / hide any cutout group explicitly
    const cutoutGroup = this.wallCutoutGroups.get(wallId);
    if (cutoutGroup) {
      this.scene.remove(cutoutGroup);
      cutoutGroup.visible = false;
    }

    // Hide any doors attached to this wall
    this.openings.forEach((op) => {
      if (op.userData.wallId === wallId) {
        op.visible = false;
      }
    });

    if (this.hoveredObject) {
      this.setEmissive(this.hoveredObject, 0x000000, 0);
      this.hoveredObject = null;
    }
    if (this.selectedWallId === wallId) {
      this.deselectAll();
    }

    window.dispatchEvent(new CustomEvent('architecture-cutouts-updated', { detail: { wallId, demolished: true } }));

    this.showToast(`💥 Demolished Wall: ${wallId}`);
    this.renderWallListUI();
    this.updateInspectorUI();

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: `Demolish wall ${wallId}`,
        undo: () => this.restoreWall(wallId, false),
        redo: () => this.demolishWall(wallId, false),
      });
    }
  }

  restoreWall(wallId, recordHistory = true) {
    if (!wallId) return;
    const mesh = this.findWallMesh(wallId);
    if (!mesh) return;

    this.registerBaseWall(mesh);
    mesh.userData.isDemolished = false;
    this.demolishedWallIds.delete(wallId);

    // Restore doors
    this.openings.forEach((op) => {
      if (op.userData.wallId === wallId) {
        op.visible = true;
      }
    });

    // Recalculate cutouts (will hide base mesh and show cutouts if openings exist)
    this.updateWallCutouts(wallId);

    const wallOps = this.openings.filter((op) => op.userData.wallId === wallId && op.visible);
    if (wallOps.length === 0) {
      mesh.visible = true;
    }

    window.dispatchEvent(new CustomEvent('architecture-cutouts-updated', { detail: { wallId, restored: true } }));

    this.showToast(`🧱 Restored Wall: ${wallId}`);
    this.renderWallListUI();
    this.updateInspectorUI();

    if (recordHistory && this.history) {
      this.history.pushAction({
        description: `Restore wall ${wallId}`,
        undo: () => this.demolishWall(wallId, false),
        redo: () => this.restoreWall(wallId, false),
      });
    }
  }

  restoreAllWalls() {
    [...this.demolishedWallIds].forEach((wId) => this.restoreWall(wId, true));
    this.showToast('Restored all demolished walls');
  }

  // --- Door & Window Placement on Walls ---

  startPlacingOpening(presetId) {
    this.setEnabled(true);
    this.cancelPlacing();
    this.deselectAll();
    this.selectedOpeningPreset = presetId || 'standard_door';
    const p = OPENING_PRESETS[this.selectedOpeningPreset];
    if (!p) return;

    this.activeTool = p.category === 'window' ? 'window' : 'door';

    this.ghostPreview = this.createOpeningMesh(
      p.id,
      p.width,
      p.height,
      p.sill_height || 0,
      0.32
    );

    // Make ghost translucent sky-blue and always render on top
    this.ghostPreview.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.75,
          wireframe: true,
          depthTest: false,
        });
        child.renderOrder = 999;
        child.userData.isArchitecturalOpening = true;
      }
    });

    this.ghostPreview.visible = false;
    this.scene.add(this.ghostPreview);
    this.domElement.style.cursor = 'crosshair';

    // Update arch tool buttons
    document.querySelectorAll('.arch-tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === this.activeTool);
    });

    const hint = document.querySelector('.viewport-hint');
    if (hint) {
      hint.textContent = `🚪 Placing ${p.name}: Hover over any wall in 3D and click to insert.`;
    }
  }

  cancelPlacing() {
    if (this.ghostPreview) {
      this.scene.remove(this.ghostPreview);
      this.ghostPreview = null;
    }
    this.currentWallTarget = null;
    if (this.activeTool === 'door' || this.activeTool === 'window') {
      this.activeTool = 'inspect';
    }
    if (this.domElement) {
      this.domElement.style.cursor = 'default';
    }
  }

  insertOpeningOnWall(wallMesh, hitPoint, presetId) {
    const wallId = this.getWallId(wallMesh);
    const p = OPENING_PRESETS[presetId || this.selectedOpeningPreset];
    if (!p) return;

    this.registerBaseWall(wallMesh);
    const baseMesh = this.baseWallMeshes.get(wallId) || wallMesh;

    // Calculate wall bbox & orientation from baseMesh
    const bbox = new THREE.Box3().setFromObject(baseMesh);
    const size = bbox.getSize(new THREE.Vector3());
    const isLongerX = size.x > size.z;
    const wallThick = isLongerX ? size.z : size.x;
    const frameDepth = Math.max(0.30, wallThick + 0.06);

    const opMesh = this.createOpeningMesh(p.id, p.width, p.height, p.sill_height || 0, frameDepth);

    const halfW = (p.width || 0.9) / 2;
    let posX = hitPoint.x;
    let posZ = hitPoint.z;
    const posY = p.sill_height || 0;

    if (isLongerX) {
      opMesh.rotation.y = 0;
      posZ = (bbox.min.z + bbox.max.z) / 2;
      const minX = bbox.min.x + halfW;
      const maxX = bbox.max.x - halfW;
      if (minX <= maxX) {
        posX = Math.max(minX, Math.min(maxX, posX));
      } else {
        posX = (bbox.min.x + bbox.max.x) / 2;
      }
    } else {
      opMesh.rotation.y = Math.PI / 2;
      posX = (bbox.min.x + bbox.max.x) / 2;
      const minZ = bbox.min.z + halfW;
      const maxZ = bbox.max.z - halfW;
      if (minZ <= maxZ) {
        posZ = Math.max(minZ, Math.min(maxZ, posZ));
      } else {
        posZ = (bbox.min.z + bbox.max.z) / 2;
      }
    }

    opMesh.position.set(posX, posY, posZ);

    const opId = `op_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    opMesh.userData = {
      id: opId,
      wallId: wallId,
      presetId: p.id,
      presetName: p.name,
      category: p.category,
      width: p.width,
      height: p.height,
      sillHeight: p.sill_height || 0,
      position: [opMesh.position.x, opMesh.position.y, opMesh.position.z],
      rotationY: opMesh.rotation.y,
      isArchitecturalOpening: true,
      isOpen: true,
    };

    const addAction = (group) => {
      this.scene.add(group);
      this.openings.push(group);
      this.updateWallCutouts(wallId);
      this.selectOpening(group);
      this.showToast(`🚪 Added ${p.name} on Wall ${wallId} — Wall vanished for walkthrough!`);
    };

    const removeAction = (group) => {
      this.scene.remove(group);
      const idx = this.openings.indexOf(group);
      if (idx !== -1) this.openings.splice(idx, 1);
      this.updateWallCutouts(wallId);
      if (this.selectedOpening === group) this.deselectAll();
      this.showToast(`Removed ${p.name}`);
    };

    addAction(opMesh);

    if (this.history) {
      this.history.pushAction({
        description: `Add ${p.name} on ${wallId}`,
        undo: () => removeAction(opMesh),
        redo: () => addAction(opMesh),
      });
    }

    if (this.ghostPreview) {
      this.ghostPreview.visible = false;
    }
  }

  deleteOpening(opGroup) {
    if (!opGroup) return;
    const wallId = opGroup.userData.wallId;
    const removeAction = (g) => {
      this.scene.remove(g);
      const idx = this.openings.indexOf(g);
      if (idx !== -1) this.openings.splice(idx, 1);
      if (wallId) this.updateWallCutouts(wallId);
      this.deselectAll();
      this.showToast('Removed opening');
    };
    const restoreAction = (g) => {
      this.scene.add(g);
      this.openings.push(g);
      if (wallId) this.updateWallCutouts(wallId);
      this.selectOpening(g);
    };

    const target = opGroup;
    removeAction(target);

    if (this.history) {
      this.history.pushAction({
        description: 'Delete opening',
        undo: () => restoreAction(target),
        redo: () => removeAction(target),
      });
    }
  }


  // --- Selection & Inspector Integration ---

  selectWall(wallId) {
    this.deselectAll();
    this.selectedWallId = wallId;
    const mesh = this.findWallMesh(wallId);
    if (!mesh) return;

    // Emissive highlight on selected wall
    this.setEmissive(mesh, 0x8b5cf6, 0.4);
    this.updateInspectorUI();
    window.dispatchEvent(new CustomEvent('architecture-selected', { detail: { type: 'wall', wallId } }));
  }

  selectOpening(opGroup) {
    this.deselectAll();
    this.selectedOpening = opGroup;

    // Emissive highlight
    opGroup.traverse((c) => {
      if (c.isMesh && c.material && c.material.emissive) {
        c.material.emissive.setHex(0x38bdf8);
        c.material.emissiveIntensity = 0.35;
      }
    });

    this.updateInspectorUI();
    window.dispatchEvent(new CustomEvent('architecture-selected', { detail: { type: 'opening', opening: opGroup } }));
  }

  deselectAll() {
    // Clear wall highlight
    if (this.selectedWallId) {
      const mesh = this.findWallMesh(this.selectedWallId);
      if (mesh) this.setEmissive(mesh, 0x000000, 0);
    }
    // Clear opening highlight
    if (this.selectedOpening) {
      this.selectedOpening.traverse((c) => {
        if (c.isMesh && c.material && c.material.emissive) {
          c.material.emissive.setHex(0x000000);
          c.material.emissiveIntensity = 0;
        }
      });
    }

    this.selectedWallId = null;
    this.selectedOpening = null;
    this.updateInspectorUI();
  }

  setEmissive(mesh, hexColor, intensity) {
    if (!mesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (m && m.emissive) {
        m.emissive.setHex(hexColor);
        m.emissiveIntensity = intensity;
      }
    });
  }

  // --- Pointer Interaction ---

  onPointerMove(e) {
    if (!this.enabled || (this.viewer && this.viewer.isWalkthrough)) return;
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Ghost preview update when placing door/window
    if ((this.activeTool === 'door' || this.activeTool === 'window') && this.selectedOpeningPreset) {
      if (!this.ghostPreview) {
        const p = OPENING_PRESETS[this.selectedOpeningPreset || 'standard_door'];
        if (p) {
          this.ghostPreview = this.createOpeningMesh(p.id, p.width, p.height, p.sill_height || 0, 0.32);
          this.ghostPreview.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.75,
                wireframe: true,
                depthTest: false,
              });
              child.renderOrder = 999;
              child.userData.isArchitecturalOpening = true;
            }
          });
          this.ghostPreview.visible = false;
          this.scene.add(this.ghostPreview);
        }
      }

      const wallMeshes = this.getAllWallMeshes().filter((m) => m.visible && !m.userData.isDemolished);
      const intersects = this.raycaster.intersectObjects(wallMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const wallMesh = hit.object;
        this.currentWallTarget = wallMesh;

        const bbox = new THREE.Box3().setFromObject(wallMesh);
        const size = bbox.getSize(new THREE.Vector3());
        const isLongerX = size.x > size.z;

        const p = OPENING_PRESETS[this.selectedOpeningPreset] || { width: 0.9, height: 2.1 };
        const halfW = (p.width || 0.9) / 2;

        if (this.ghostPreview) {
          this.ghostPreview.visible = true;

          if (isLongerX) {
            const minX = bbox.min.x + halfW;
            const maxX = bbox.max.x - halfW;
            const clampedX = minX <= maxX ? Math.max(minX, Math.min(maxX, hit.point.x)) : (bbox.min.x + bbox.max.x) / 2;
            this.ghostPreview.position.set(clampedX, p.sill_height || 0, (bbox.min.z + bbox.max.z) / 2);
            this.ghostPreview.rotation.y = 0;
          } else {
            const minZ = bbox.min.z + halfW;
            const maxZ = bbox.max.z - halfW;
            const clampedZ = minZ <= maxZ ? Math.max(minZ, Math.min(maxZ, hit.point.z)) : (bbox.min.x + bbox.max.x) / 2;
            this.ghostPreview.position.set((bbox.min.x + bbox.max.x) / 2, p.sill_height || 0, clampedZ);
            this.ghostPreview.rotation.y = Math.PI / 2;
          }
        }

        this.domElement.style.cursor = 'crosshair';
        const hint = document.querySelector('.viewport-hint');
        if (hint) {
          hint.textContent = `🚪 Click to place ${p.name || 'Door'} on Wall ${this.getWallId(wallMesh)}`;
        }
        return;
      } else {
        if (this.ghostPreview) {
          this.ghostPreview.visible = false;
        }
        this.currentWallTarget = null;
        this.domElement.style.cursor = 'default';
        return;
      }
    }

    // 2. Hover highlights in demolish or inspect mode
    if (this.activeTool === 'demolish') {
      const wallMeshes = this.getAllWallMeshes().filter((m) => m.visible && !m.userData.isDemolished);
      const intersects = this.raycaster.intersectObjects(wallMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (this.hoveredObject !== hit) {
          if (this.hoveredObject) this.setEmissive(this.hoveredObject, 0x000000, 0);
          this.hoveredObject = hit;
          this.setEmissive(hit, 0xef4444, 0.45); // crimson warning
        }
        this.domElement.style.cursor = 'pointer';
      } else {
        if (this.hoveredObject) {
          this.setEmissive(this.hoveredObject, 0x000000, 0);
          this.hoveredObject = null;
        }
        this.domElement.style.cursor = 'default';
      }
    }
  }

  onPointerDown(e) {
    if (!this.enabled || (this.viewer && this.viewer.isWalkthrough)) return;
    if (e.button !== 0) return; // Left click only

    // 1. Placing active door/window
    if (this.activeTool === 'door' || this.activeTool === 'window') {
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const wallMeshes = this.getAllWallMeshes().filter((m) => m.visible && !m.userData.isDemolished);
      const intersects = this.raycaster.intersectObjects(wallMeshes, false);

      if (intersects.length > 0) {
        if (e.stopPropagation) e.stopPropagation();
        const hit = intersects[0];
        const targetWall = hit.object;
        const hitPoint = this.ghostPreview && this.ghostPreview.visible ? this.ghostPreview.position.clone() : hit.point;
        this.insertOpeningOnWall(targetWall, hitPoint, this.selectedOpeningPreset);
        return;
      }
    }

    // 2. Direct Raycast
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check Openings first
    const opIntersects = this.raycaster.intersectObjects(this.openings, true);
    if (opIntersects.length > 0) {
      if (e.stopPropagation) e.stopPropagation();
      let root = opIntersects[0].object;
      while (root.parent && !this.openings.includes(root)) root = root.parent;
      if (this.openings.includes(root)) {
        this.selectOpening(root);
        return;
      }
    }

    // Check Walls
    const wallMeshes = this.getAllWallMeshes().filter((m) => m.visible && !m.userData.isDemolished);
    const wallIntersects = this.raycaster.intersectObjects(wallMeshes, false);

    if (wallIntersects.length > 0) {
      if (e.stopPropagation) e.stopPropagation();
      const wallMesh = wallIntersects[0].object;
      const wallId = this.getWallId(wallMesh);

      if (this.activeTool === 'demolish') {
        this.demolishWall(wallId, true);
      } else {
        this.selectWall(wallId);
      }
    } else {
      if (this.activeTool === 'inspect') {
        this.deselectAll();
      }
    }
  }

  // --- Dynamic UI Rendering ---

  renderWallListUI() {
    const container = document.getElementById('arch-walls-list-container');
    if (!container) return;

    container.innerHTML = '';
    this.registerAllBaseWalls();

    const wallMap = new Map();
    this.baseWallMeshes.forEach((mesh, id) => {
      wallMap.set(id, mesh);
    });
    this.getAllWallMeshes().forEach((mesh) => {
      const id = this.getWallId(mesh);
      if (id && !wallMap.has(id)) {
        wallMap.set(id, mesh);
      }
    });

    if (wallMap.size === 0) {
      container.innerHTML = '<span class="panel-hint">No wall segments found.</span>';
      return;
    }

    wallMap.forEach((mesh, wId) => {
      const isDemolished = this.demolishedWallIds.has(wId) || !!mesh.userData.isDemolished;

      const item = document.createElement('div');
      item.className = `arch-wall-item ${isDemolished ? 'demolished' : ''} ${this.selectedWallId === wId ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="wall-info">
          <span class="wall-name">🧱 Wall <strong>${wId}</strong></span>
          <span class="wall-status">${isDemolished ? '💥 Demolished' : '🟢 Standing'}</span>
        </div>
        <button class="btn btn-sm ${isDemolished ? 'btn-primary' : 'btn-danger-outline'}" title="${isDemolished ? 'Restore Wall' : 'Remove Wall'}">
          ${isDemolished ? '↩️ Restore' : '🗑️ Remove'}
        </button>
      `;

      item.querySelector('button').addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (isDemolished) this.restoreWall(wId, true);
        else this.demolishWall(wId, true);
      });

      item.addEventListener('click', () => {
        if (!isDemolished) this.selectWall(wId);
      });

      container.appendChild(item);
    });
  }

  updateInspectorUI() {
    const wallInspector = document.getElementById('inspector-wall-view');
    const openingInspector = document.getElementById('inspector-opening-view');
    const furnInspector = document.getElementById('furniture-inspector');
    const emptyNotice = document.getElementById('inspector-empty-notice');

    if (wallInspector) wallInspector.style.display = 'none';
    if (openingInspector) openingInspector.style.display = 'none';
    if (furnInspector) furnInspector.style.display = 'none';
    if (emptyNotice) emptyNotice.style.display = 'block';

    if (this.selectedWallId) {
      if (emptyNotice) emptyNotice.style.display = 'none';
      if (wallInspector) {
        wallInspector.style.display = 'block';
        document.getElementById('insp-wall-id').textContent = this.selectedWallId;
        const mesh = this.findWallMesh(this.selectedWallId);
        if (mesh) {
          const bbox = new THREE.Box3().setFromObject(mesh);
          const size = bbox.getSize(new THREE.Vector3());
          document.getElementById('insp-wall-dims').textContent = `${Math.max(size.x, size.z).toFixed(2)}m (L) × ${size.y.toFixed(2)}m (H)`;
        }
      }
    } else if (this.selectedOpening) {
      if (emptyNotice) emptyNotice.style.display = 'none';
      if (openingInspector) {
        openingInspector.style.display = 'block';
        const u = this.selectedOpening.userData || {};
        document.getElementById('insp-opening-title').textContent = u.presetName || 'Door / Opening';
        document.getElementById('insp-opening-wall').textContent = u.wallId || 'Wall';
        document.getElementById('insp-opening-w').value = (u.width || 1.0).toFixed(2);
        document.getElementById('insp-opening-h').value = (u.height || 2.1).toFixed(2);
      }
    }
  }

  bindEvents() {
    this.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'Escape') {
        this.cancelPlacing();
        this.deselectAll();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedOpening) {
          this.deleteOpening(this.selectedOpening);
        } else if (this.selectedWallId) {
          this.demolishWall(this.selectedWallId, true);
        }
      }
    });
  }
}
