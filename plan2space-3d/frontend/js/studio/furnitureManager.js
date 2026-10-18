/**
 * Furniture Placement, Gizmo, Snapping, and Collision Manager for Interior Design Studio.
 */

import * as THREE from 'three';
import { createFurnitureModel, updateFurnitureColors } from './furniture/procedural.js';

export class FurnitureManager {
  constructor(scene, camera, domElement, historyManager, viewer = null) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.history = historyManager;
    this.viewer = viewer;

    this.items = []; // Array of placed THREE.Group objects
    this.selectedItem = null;
    this.ghostPreview = null;
    this.placingSpec = null;

    // Reposition & Drag states
    this.isDraggingItem = false;
    this.dragStartPos = null;
    this.dragOffset = new THREE.Vector3();
    this.isRepositioning = false;
    this.repositionOriginalPos = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Selection Bounding Box Helper
    this.boxHelper = new THREE.BoxHelper(new THREE.Object3D(), 0x38bdf8);
    this.boxHelper.visible = false;
    this.scene.add(this.boxHelper);
    this.enabled = false;

    this.bindEvents();
  }

  setViewer(viewer) {
    this.viewer = viewer;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.cancelPlacing();
      if (this.isRepositioning) this.cancelRepositioning();
      this.deselect();
    }
  }

  startPlacing(spec) {
    this.cancelPlacing();
    this.deselect();

    this.placingSpec = spec;
    const ghost = createFurnitureModel(
      spec.type_id,
      spec.variant_id,
      spec.default_colors?.primary || '#EDE6D6',
      spec.default_colors?.secondary || '#334155'
    );

    // Make ghost semi-transparent
    ghost.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.55;
      }
    });

    ghost.userData = {
      isGhost: true,
      spec: spec,
    };

    this.ghostPreview = ghost;
    this.scene.add(this.ghostPreview);
    this.domElement.style.cursor = 'crosshair';
  }

  cancelPlacing() {
    if (this.ghostPreview) {
      this.scene.remove(this.ghostPreview);
      this.ghostPreview = null;
    }
    this.placingSpec = null;
    this.domElement.style.cursor = 'default';
  }

  onPointerMove(e) {
    if (!this.enabled || (this.viewer && this.viewer.isWalkthrough)) return;
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Ghost Placement Preview
    if (this.ghostPreview && this.placingSpec) {
      const isWallMounted = this.placingSpec.is_wall_mounted;
      const isCeilingMounted = this.placingSpec.is_ceiling_mounted;

      const planeIntersect = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.floorPlane, planeIntersect);

      if (planeIntersect) {
        let posX = planeIntersect.x;
        let posY = 0.0;
        let posZ = planeIntersect.z;

        if (isWallMounted) {
          posY = 1.2;
          if (this.placingSpec.type_id === 'air_conditioner') posY = 2.3;
        } else if (isCeilingMounted) {
          posY = 2.35;
        }

        const wallSnap = this.checkWallSnapping(posX, posZ);
        if (wallSnap.snapped) {
          posX = wallSnap.x;
          posZ = wallSnap.z;
          this.ghostPreview.rotation.y = wallSnap.rotationY;
        }

        this.ghostPreview.position.set(posX, posY, posZ);
      }
      return;
    }

    // 2. Active Repositioning Mode (User clicked "Reposition" in inspector)
    if (this.isRepositioning && this.selectedItem) {
      const planeIntersect = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.floorPlane, planeIntersect);
      if (planeIntersect) {
        let nx = planeIntersect.x;
        let nz = planeIntersect.z;
        const snap = this.checkWallSnapping(nx, nz);
        if (snap.snapped) {
          nx = snap.x;
          nz = snap.z;
          this.selectedItem.rotation.y = snap.rotationY;
        }
        this.selectedItem.position.x = nx;
        this.selectedItem.position.z = nz;
        this.updateBoxHelper();
        this.notifyItemUpdated();
      }
      return;
    }

    // 3. Mouse Click & Drag Selected Item
    if (this.isDraggingItem && this.selectedItem) {
      const planeIntersect = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.floorPlane, planeIntersect);
      if (planeIntersect) {
        let nx = planeIntersect.x + this.dragOffset.x;
        let nz = planeIntersect.z + this.dragOffset.z;
        const snap = this.checkWallSnapping(nx, nz);
        if (snap.snapped) {
          nx = snap.x;
          nz = snap.z;
        }
        this.selectedItem.position.x = nx;
        this.selectedItem.position.z = nz;
        this.updateBoxHelper();
        this.notifyItemUpdated();
      }
      return;
    }

    // 4. Hover State: highlight furniture under cursor with 'grab'
    if (!this.ghostPreview && !this.isRepositioning && !this.isDraggingItem) {
      const intersects = this.raycaster.intersectObjects(this.items, true);
      if (intersects.length > 0) {
        this.domElement.style.cursor = 'grab';
      } else {
        this.domElement.style.cursor = 'default';
      }
    }
  }

  checkWallSnapping(x, z, snapDist = 0.35) {
    let bestSnap = { snapped: false, x, z, rotationY: 0 };
    let minDist = snapDist;

    this.scene.traverse((child) => {
      if (child.isMesh && child.name.startsWith('wall:')) {
        const bbox = new THREE.Box3().setFromObject(child);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        // Simple AABB distance check for snapping
        const dx = Math.abs(x - center.x) - size.x / 2;
        const dz = Math.abs(z - center.z) - size.z / 2;
        const dist = Math.max(dx, dz);

        if (dist >= -0.1 && dist < minDist) {
          minDist = dist;
          bestSnap.snapped = true;
          // Align rotation to wall orientation (if wall is longer along X or Z)
          if (size.x > size.z) {
            bestSnap.rotationY = 0;
            bestSnap.z = z > center.z ? center.z + size.z / 2 + 0.05 : center.z - size.z / 2 - 0.05;
            bestSnap.x = x;
          } else {
            bestSnap.rotationY = Math.PI / 2;
            bestSnap.x = x > center.x ? center.x + size.x / 2 + 0.05 : center.x - size.x / 2 - 0.05;
            bestSnap.z = z;
          }
        }
      }
    });

    return bestSnap;
  }

  onPointerDown(e) {
    if (!this.enabled || (this.viewer && this.viewer.isWalkthrough)) return;
    if (e.button !== 0) return; // Left click only

    // 1. If currently in Repositioning Mode -> Drop & commit new position!
    if (this.isRepositioning && this.selectedItem) {
      this.finishRepositioning();
      return;
    }

    // 2. If currently placing a ghost item -> place it!
    if (this.ghostPreview && this.placingSpec) {
      this.placeCurrentGhost();
      return;
    }

    // 3. Raycast to select and drag existing placed furniture
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.items, true);

    if (intersects.length > 0) {
      let rootGroup = intersects[0].object;
      while (rootGroup.parent && rootGroup.parent !== this.scene && !this.items.includes(rootGroup)) {
        rootGroup = rootGroup.parent;
      }
      if (this.items.includes(rootGroup)) {
        this.selectItem(rootGroup);

        // Initiate interactive 3D drag
        this.isDraggingItem = true;
        this.dragStartPos = rootGroup.position.clone();

        // Calculate offset between object position and floor plane intersection
        const planeIntersect = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.floorPlane, planeIntersect);
        if (planeIntersect) {
          this.dragOffset.subVectors(rootGroup.position, planeIntersect);
          this.dragOffset.y = 0;
        }

        // Temporarily disable camera OrbitControls so mouse moves furniture instead of spinning camera
        if (this.viewer && this.viewer.controls) {
          this.viewer.controls.enabled = false;
        }
        this.domElement.style.cursor = 'grabbing';
      }
    } else {
      // Clicked empty space -> deselect
      this.deselect();
    }
  }

  onPointerUp(e) {
    if (this.isDraggingItem) {
      this.isDraggingItem = false;

      // Re-enable camera OrbitControls
      if (this.viewer && this.viewer.controls) {
        this.viewer.controls.enabled = true;
      }
      this.domElement.style.cursor = 'default';

      // If item moved significantly, record undo/redo history
      if (this.selectedItem && this.dragStartPos) {
        const dist = this.dragStartPos.distanceTo(this.selectedItem.position);
        if (dist > 0.02) {
          const item = this.selectedItem;
          const oldPos = this.dragStartPos.clone();
          const newPos = item.position.clone();
          if (this.history) {
            this.history.pushAction({
              description: `Move ${item.userData?.customLabel || 'furniture'}`,
              undo: () => {
                item.position.copy(oldPos);
                this.updateBoxHelper();
                this.notifyItemUpdated();
              },
              redo: () => {
                item.position.copy(newPos);
                this.updateBoxHelper();
                this.notifyItemUpdated();
              },
            });
          }
        }
      }
    }
  }

  startRepositioning() {
    if (!this.selectedItem) return;
    this.isRepositioning = true;
    this.repositionOriginalPos = this.selectedItem.position.clone();
    this.domElement.style.cursor = 'crosshair';
  }

  cancelRepositioning() {
    if (this.isRepositioning && this.selectedItem && this.repositionOriginalPos) {
      this.selectedItem.position.copy(this.repositionOriginalPos);
      this.updateBoxHelper();
      this.notifyItemUpdated();
    }
    this.isRepositioning = false;
    this.repositionOriginalPos = null;
    this.domElement.style.cursor = 'default';
  }

  finishRepositioning() {
    if (!this.selectedItem) {
      this.isRepositioning = false;
      return;
    }
    const item = this.selectedItem;
    const oldPos = this.repositionOriginalPos ? this.repositionOriginalPos.clone() : item.position.clone();
    const newPos = item.position.clone();

    this.isRepositioning = false;
    this.repositionOriginalPos = null;
    this.domElement.style.cursor = 'default';

    if (oldPos.distanceTo(newPos) > 0.02 && this.history) {
      this.history.pushAction({
        description: `Reposition ${item.userData?.customLabel || 'furniture'}`,
        undo: () => {
          item.position.copy(oldPos);
          this.updateBoxHelper();
          this.notifyItemUpdated();
        },
        redo: () => {
          item.position.copy(newPos);
          this.updateBoxHelper();
          this.notifyItemUpdated();
        },
      });
    }
  }

  notifyItemUpdated() {
    if (!this.selectedItem) return;
    const hasCollision = this.checkCollision(this.selectedItem);
    window.dispatchEvent(
      new CustomEvent('furniture-selected', {
        detail: {
          item: this.selectedItem,
          userData: this.selectedItem.userData,
          position: [this.selectedItem.position.x, this.selectedItem.position.y, this.selectedItem.position.z],
          rotationY: this.selectedItem.rotation.y,
          scale: [this.selectedItem.scale.x, this.selectedItem.scale.y, this.selectedItem.scale.z],
          hasCollision,
        },
      })
    );
  }

  placeCurrentGhost() {
    const spec = this.placingSpec;
    const pos = this.ghostPreview.position.clone();
    const rot = this.ghostPreview.rotation.clone();

    // Create real opaque model
    const realItem = createFurnitureModel(
      spec.type_id,
      spec.variant_id,
      spec.default_colors?.primary || '#EDE6D6',
      spec.default_colors?.secondary || '#334155'
    );

    realItem.position.copy(pos);
    realItem.rotation.copy(rot);

    const itemId = `furn_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    realItem.userData = {
      id: itemId,
      itemType: spec.type_id,
      variant: spec.variant_id,
      category: spec.category || 'decor',
      dimensions: spec.default_dimensions ? [...spec.default_dimensions] : [1, 1, 1],
      colors: {
        primary: spec.default_colors?.primary || '#EDE6D6',
        secondary: spec.default_colors?.secondary || '#334155',
      },
      customLabel: spec.name || spec.type_id,
    };

    const addAction = (item) => {
      this.scene.add(item);
      this.items.push(item);
      this.selectItem(item);
    };

    const removeAction = (item) => {
      this.scene.remove(item);
      const idx = this.items.indexOf(item);
      if (idx !== -1) this.items.splice(idx, 1);
      if (this.selectedItem === item) this.deselect();
    };

    addAction(realItem);

    if (this.history) {
      this.history.pushAction({
        description: `Place ${spec.name || spec.type_id}`,
        undo: () => removeAction(realItem),
        redo: () => addAction(realItem),
      });
    }

    this.cancelPlacing();
  }

  selectItem(item) {
    this.selectedItem = item;
    if (this.selectedItem) {
      this.boxHelper.setFromObject(this.selectedItem);
      this.boxHelper.visible = true;

      // Check collision
      const hasCollision = this.checkCollision(this.selectedItem);

      // Dispatch custom event to notify UI inspector
      window.dispatchEvent(
        new CustomEvent('furniture-selected', {
          detail: {
            item: this.selectedItem,
            userData: this.selectedItem.userData,
            position: [this.selectedItem.position.x, this.selectedItem.position.y, this.selectedItem.position.z],
            rotationY: this.selectedItem.rotation.y,
            scale: [this.selectedItem.scale.x, this.selectedItem.scale.y, this.selectedItem.scale.z],
            hasCollision,
          },
        })
      );
    }
  }

  deselect() {
    this.selectedItem = null;
    this.boxHelper.visible = false;
    window.dispatchEvent(new CustomEvent('furniture-deselected'));
  }

  checkCollision(item) {
    if (!item) return false;
    const itemBox = new THREE.Box3().setFromObject(item);
    // Shrink slightly to avoid touching surfaces triggering false positives
    itemBox.expandByScalar(-0.02);

    let collides = false;
    this.scene.traverse((child) => {
      if (child.isMesh && child.name.startsWith('wall:')) {
        const wallBox = new THREE.Box3().setFromObject(child);
        if (itemBox.intersectsBox(wallBox)) {
          collides = true;
        }
      }
    });
    return collides;
  }

  updateBoxHelper() {
    if (this.selectedItem && this.boxHelper.visible) {
      this.boxHelper.setFromObject(this.selectedItem);
    }
  }

  // --- Transform Operations with Undo/Redo ---

  rotateSelected(angleRad) {
    if (!this.selectedItem) return;
    const oldRot = this.selectedItem.rotation.y;
    const newRot = oldRot + angleRad;

    const apply = (r) => {
      this.selectedItem.rotation.y = r;
      this.updateBoxHelper();
      this.selectItem(this.selectedItem);
    };

    apply(newRot);

    if (this.history) {
      this.history.pushAction({
        description: 'Rotate furniture',
        undo: () => apply(oldRot),
        redo: () => apply(newRot),
      });
    }
  }

  moveSelected(dx, dy, dz) {
    if (!this.selectedItem) return;
    const oldPos = this.selectedItem.position.clone();
    const newPos = new THREE.Vector3(oldPos.x + dx, oldPos.y + dy, oldPos.z + dz);

    const apply = (p) => {
      this.selectedItem.position.copy(p);
      this.updateBoxHelper();
      this.selectItem(this.selectedItem);
    };

    apply(newPos);

    if (this.history) {
      this.history.pushAction({
        description: 'Move furniture',
        undo: () => apply(oldPos),
        redo: () => apply(newPos),
      });
    }
  }

  setPosition(x, y, z) {
    if (!this.selectedItem) return;
    const oldPos = this.selectedItem.position.clone();
    const newPos = new THREE.Vector3(x, y, z);

    const apply = (p) => {
      this.selectedItem.position.copy(p);
      this.updateBoxHelper();
      this.selectItem(this.selectedItem);
    };

    apply(newPos);

    if (this.history) {
      this.history.pushAction({
        description: 'Set furniture position',
        undo: () => apply(oldPos),
        redo: () => apply(newPos),
      });
    }
  }

  scaleSelected(sx, sy, sz) {
    if (!this.selectedItem) return;
    const oldScale = this.selectedItem.scale.clone();
    const newScale = new THREE.Vector3(Math.max(0.1, sx), Math.max(0.1, sy), Math.max(0.1, sz));

    const apply = (s) => {
      this.selectedItem.scale.copy(s);
      this.updateBoxHelper();
      this.selectItem(this.selectedItem);
    };

    apply(newScale);

    if (this.history) {
      this.history.pushAction({
        description: 'Resize furniture',
        undo: () => apply(oldScale),
        redo: () => apply(newScale),
      });
    }
  }

  recolorSelected(primaryHex, secondaryHex) {
    if (!this.selectedItem) return;
    const oldPrimary = this.selectedItem.userData.colors?.primary;
    const oldSecondary = this.selectedItem.userData.colors?.secondary;

    const apply = (p, s) => {
      updateFurnitureColors(this.selectedItem, p, s);
      this.selectedItem.userData.colors = { primary: p, secondary: s };
      this.selectItem(this.selectedItem);
    };

    apply(primaryHex, secondaryHex);

    if (this.history) {
      this.history.pushAction({
        description: 'Recolor furniture',
        undo: () => apply(oldPrimary, oldSecondary),
        redo: () => apply(primaryHex, secondaryHex),
      });
    }
  }

  duplicateSelected() {
    if (!this.selectedItem) return;
    const src = this.selectedItem;
    const dup = createFurnitureModel(
      src.userData.itemType,
      src.userData.variant,
      src.userData.colors?.primary,
      src.userData.colors?.secondary
    );

    dup.position.copy(src.position).add(new THREE.Vector3(0.5, 0, 0.5));
    dup.rotation.copy(src.rotation);
    dup.scale.copy(src.scale);

    const dupId = `furn_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    dup.userData = {
      ...JSON.parse(JSON.stringify(src.userData)),
      id: dupId,
      customLabel: (src.userData.customLabel || 'Item') + ' (Copy)',
    };

    const addAction = (item) => {
      this.scene.add(item);
      this.items.push(item);
      this.selectItem(item);
    };

    const removeAction = (item) => {
      this.scene.remove(item);
      const idx = this.items.indexOf(item);
      if (idx !== -1) this.items.splice(idx, 1);
      if (this.selectedItem === item) this.deselect();
    };

    addAction(dup);

    if (this.history) {
      this.history.pushAction({
        description: 'Duplicate furniture',
        undo: () => removeAction(dup),
        redo: () => addAction(dup),
      });
    }
  }

  deleteSelected() {
    if (!this.selectedItem) return;
    const item = this.selectedItem;

    const removeAction = (it) => {
      this.scene.remove(it);
      const idx = this.items.indexOf(it);
      if (idx !== -1) this.items.splice(idx, 1);
      this.deselect();
    };

    const restoreAction = (it) => {
      this.scene.add(it);
      this.items.push(it);
      this.selectItem(it);
    };

    removeAction(item);

    if (this.history) {
      this.history.pushAction({
        description: 'Delete furniture',
        undo: () => restoreAction(item),
        redo: () => removeAction(item),
      });
    }
  }

  // --- Serialization ---

  getSerializedItems() {
    return this.items.map((item) => {
      const u = item.userData || {};
      return {
        id: u.id || `furn_${Math.random().toString(36).substr(2, 8)}`,
        item_type: u.itemType || 'chair',
        variant: u.variant || 'dining_chair',
        category: u.category || 'seating',
        position: [
          parseFloat(item.position.x.toFixed(3)),
          parseFloat(item.position.y.toFixed(3)),
          parseFloat(item.position.z.toFixed(3)),
        ],
        rotation: [
          parseFloat(item.rotation.x.toFixed(3)),
          parseFloat(item.rotation.y.toFixed(3)),
          parseFloat(item.rotation.z.toFixed(3)),
        ],
        scale: [
          parseFloat(item.scale.x.toFixed(3)),
          parseFloat(item.scale.y.toFixed(3)),
          parseFloat(item.scale.z.toFixed(3)),
        ],
        dimensions: u.dimensions || [1.0, 1.0, 1.0],
        colors: u.colors || {},
        custom_label: u.customLabel || null,
      };
    });
  }

  loadSerializedItems(itemsList) {
    // Clear current items
    [...this.items].forEach((it) => this.scene.remove(it));
    this.items = [];
    this.deselect();

    if (!itemsList || !Array.isArray(itemsList)) return;

    itemsList.forEach((data) => {
      const pColor = data.colors?.primary || '#EDE6D6';
      const sColor = data.colors?.secondary || '#334155';
      const group = createFurnitureModel(data.item_type, data.variant, pColor, sColor);

      if (data.position && data.position.length === 3) {
        group.position.set(data.position[0], data.position[1], data.position[2]);
      }
      if (data.rotation && data.rotation.length >= 3) {
        group.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
      }
      if (data.scale && data.scale.length === 3) {
        group.scale.set(data.scale[0], data.scale[1], data.scale[2]);
      }

      group.userData = {
        id: data.id,
        itemType: data.item_type,
        variant: data.variant,
        category: data.category,
        dimensions: data.dimensions,
        colors: { primary: pColor, secondary: sColor },
        customLabel: data.custom_label,
      };

      this.scene.add(group);
      this.items.push(group);
    });
  }

  bindEvents() {
    this.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'Escape') {
        if (this.isRepositioning) {
          this.cancelRepositioning();
        } else if (this.ghostPreview) {
          this.cancelPlacing();
        } else if (this.selectedItem) {
          this.deselect();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedItem) {
          e.preventDefault();
          this.deleteSelected();
        }
      } else if (e.key.toLowerCase() === 'r') {
        if (this.selectedItem) {
          e.preventDefault();
          this.rotateSelected(Math.PI / 2); // 90 degrees
        }
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (this.selectedItem) {
          e.preventDefault();
          const step = e.shiftKey ? 0.5 : 0.1;
          if (e.key === 'ArrowLeft') this.moveSelected(-step, 0, 0);
          else if (e.key === 'ArrowRight') this.moveSelected(step, 0, 0);
          else if (e.key === 'ArrowUp') this.moveSelected(0, 0, -step);
          else if (e.key === 'ArrowDown') this.moveSelected(0, 0, step);
        }
      }
    });
  }
}
