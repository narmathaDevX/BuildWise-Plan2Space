/**
 * Interactive Three.js 3D Model Viewer with OrbitControls, GLTFLoader, layer toggles,
 * camera presets, and First-Person POV Walkthrough & Room Tour.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelViewer3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModel = null;
    this.initialCameraState = null;
    this.modelCenter = new THREE.Vector3(0, 0, 0);

    this.layers = {
      walls: [],
      floor: [],
      roof: [],
    };

    // First-Person POV Walkthrough state
    this.isWalkthrough = false;
    this.povYaw = 0;
    this.povPitch = 0;
    this.eyeHeight = 1.6; // 1.6m default human eye level
    this.povSpeed = 2.8; // 2.8 m/s walking speed
    this.isSprinting = false;
    this.povCollision = true; // Wall collision with door passing
    this.headBobTimer = 0;
    this.roomsData = [];
    this.currentRoom = null;
    this.isPanoramaInspecting = false;
    this.isDraggingLook = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.povHudElement = null;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      turnLeft: false,
      turnRight: false,
      sprint: false,
    };

    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(15, 12, 18);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Do not go below floor plane

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.6);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // 6. Ground Grid (in metres)
    const grid = new THREE.GridHelper(50, 50, 0x3b82f6, 0x1e293b);
    grid.position.y = -0.01;
    this.scene.add(grid);

    // Window resize handler
    window.addEventListener('resize', () => this.onResize());

    // Bind First-Person walkthrough inputs
    this.bindWalkthroughKeys();
    this.bindPovPointerEvents();

    // Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (this.isWalkthrough) {
      this.updateWalkthrough(delta);
    } else {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  loadGLB(url, onLoaded = null) {
    const loader = new GLTFLoader();

    // Remove previous model
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }
    this.layers = { walls: [], floor: [], roof: [] };

    loader.load(
      url,
      (gltf) => {
        this.currentModel = gltf.scene;

        // Traverse and classify meshes by name/layer
        this.currentModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const name = (child.name || '').toLowerCase();
            if (name.includes('wall')) this.layers.walls.push(child);
            else if (name.includes('floor')) this.layers.floor.push(child);
            else if (name.includes('roof')) this.layers.roof.push(child);
            else this.layers.walls.push(child);
          }
        });

        this.scene.add(this.currentModel);

        // Frame camera around model bounding box
        const bbox = new THREE.Box3().setFromObject(this.currentModel);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        this.modelCenter.copy(center);

        const maxDim = Math.max(size.x, size.y, size.z, 5.0);
        this.camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 1.0, center.z + maxDim * 1.5);
        this.controls.target.copy(center);
        this.controls.update();

        this.initialCameraState = {
          position: this.camera.position.clone(),
          target: this.controls.target.clone(),
        };

        if (onLoaded) {
          onLoaded({ bbox, center, size, scene: gltf.scene });
        }
      },
      undefined,
      (error) => {
        console.error('Failed to load GLB model:', error);
      }
    );
  }

  setLayerVisibility(layerName, visible) {
    const list = this.layers[layerName] || [];
    list.forEach((mesh) => {
      mesh.visible = visible;
    });
  }

  setWireframe(enabled) {
    if (!this.currentModel) return;
    this.currentModel.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => (m.wireframe = enabled));
        } else {
          child.material.wireframe = enabled;
        }
      }
    });
  }

  setCameraPreset(preset) {
    if (!this.controls || !this.currentModel) return;

    if (preset === 'walkthrough') {
      this.enableWalkthrough();
      return;
    } else if (this.isWalkthrough) {
      this.disableWalkthrough();
    }

    const bbox = new THREE.Box3().setFromObject(this.currentModel);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 5.0);

    this.controls.target.copy(center);

    if (preset === 'top') {
      this.camera.position.set(center.x, center.y + maxDim * 2.2, center.z + 0.001);
    } else if (preset === 'front') {
      this.camera.position.set(center.x, center.y + size.y / 2, center.z + maxDim * 1.8);
    } else if (preset === 'persp' || preset === 'reset') {
      if (this.initialCameraState) {
        this.camera.position.copy(this.initialCameraState.position);
        this.controls.target.copy(this.initialCameraState.target);
      } else {
        this.camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 1.0, center.z + maxDim * 1.5);
      }
    }
    this.controls.update();
  }

  captureScreenshot() {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  // --- First-Person POV Walkthrough & Room Tour Controller ---

  enableWalkthrough() {
    this.isWalkthrough = true;
    this.controls.enabled = false;

    // Pick starting point inside Living room or first room center, or model center
    let startPos = null;
    if (this.roomsData && this.roomsData.length > 0) {
      const living = this.roomsData.find((r) => {
        const n = (r.name || '').toLowerCase();
        return n.includes('living') || n.includes('hall');
      }) || this.roomsData[0];

      if (living && living.polygon && living.polygon.length >= 3) {
        let sumX = 0, sumY = 0, count = 0;
        living.polygon.forEach((pt) => {
          sumX += Array.isArray(pt) ? pt[0] : (pt.x !== undefined ? pt.x : 0);
          sumY += Array.isArray(pt) ? pt[1] : (pt.y !== undefined ? pt.y : 0);
          count++;
        });
        if (count > 0) {
          startPos = new THREE.Vector3(sumX / count, this.eyeHeight, -(sumY / count));
          this.currentRoom = living;
        }
      }
    }

    if (!startPos) {
      startPos = new THREE.Vector3(this.modelCenter.x, this.eyeHeight, this.modelCenter.z + 0.8);
    }

    this.camera.position.copy(startPos);
    this.povPitch = 0;
    this.povYaw = 0;
    const euler = new THREE.Euler(this.povPitch, this.povYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    document.querySelectorAll('.cam-presets button').forEach((b) => b.classList.remove('active'));
    document.getElementById('btn-cam-walk')?.classList.add('active');

    this.mountPovHud();
    this.detectCurrentRoom();
  }

  disableWalkthrough() {
    if (!this.isWalkthrough) return;
    this.isWalkthrough = false;
    this.isPanoramaInspecting = false;
    this.controls.enabled = true;

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.controls.target.copy(this.camera.position).add(fwd.multiplyScalar(4.0));
    this.controls.update();

    this.unmountPovHud();

    if (document.pointerLockElement === this.renderer?.domElement) {
      document.exitPointerLock?.();
    }

    document.getElementById('btn-cam-walk')?.classList.remove('active');
    document.getElementById('btn-cam-persp')?.classList.add('active');
  }

  bindWalkthroughKeys() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (!this.isWalkthrough) return;

      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') this.keys.forward = true;
      if (k === 's' || e.key === 'ArrowDown') this.keys.backward = true;
      if (k === 'a') this.keys.left = true;
      if (k === 'd') this.keys.right = true;
      if (k === 'q' || e.key === 'ArrowLeft') this.keys.turnLeft = true;
      if (k === 'e' || e.key === 'ArrowRight') this.keys.turnRight = true;
      if (e.key === 'Shift') this.keys.sprint = true;
      if (k === 'c') this.setEyeHeight(1.1); // Crouch
      if (e.key === ' ' || k === 'spacebar') {
        e.preventDefault();
        this.setEyeHeight(1.6); // Stand
      }
      if (k === 'g') {
        this.povCollision = !this.povCollision;
        const btn = document.getElementById('pov-btn-collision');
        if (btn) btn.textContent = this.povCollision ? '🛡️ Solid Walls' : '👻 Pass Walls';
      }
      if (e.key === 'Escape') {
        this.disableWalkthrough();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isWalkthrough) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') this.keys.forward = false;
      if (k === 's' || e.key === 'ArrowDown') this.keys.backward = false;
      if (k === 'a') this.keys.left = false;
      if (k === 'd') this.keys.right = false;
      if (k === 'q' || e.key === 'ArrowLeft') this.keys.turnLeft = false;
      if (k === 'e' || e.key === 'ArrowRight') this.keys.turnRight = false;
      if (e.key === 'Shift') this.keys.sprint = false;
    });
  }

  bindPovPointerEvents() {
    if (!this.renderer || !this.renderer.domElement) return;
    const dom = this.renderer.domElement;

    let downTime = 0;
    let downPos = { x: 0, y: 0 };

    dom.addEventListener('pointerdown', (e) => {
      if (!this.isWalkthrough) return;
      if (e.target.closest('#pov-walkthrough-hud')) return;

      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      downTime = performance.now();
      downPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isWalkthrough) return;

      if (document.pointerLockElement === dom) {
        const sens = 0.0022;
        this.povYaw -= e.movementX * sens;
        this.povPitch -= e.movementY * sens;
        this.povPitch = Math.max(-1.4, Math.min(1.4, this.povPitch));
        return;
      }

      if (this.isDraggingLook) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        const sens = 0.0035;
        this.povYaw -= dx * sens;
        this.povPitch -= dy * sens;
        this.povPitch = Math.max(-1.4, Math.min(1.4, this.povPitch));
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isWalkthrough) return;
      const wasDragging = this.isDraggingLook;
      this.isDraggingLook = false;

      // Click to step forward onto floor
      if (wasDragging && e.target === dom) {
        const elapsed = performance.now() - downTime;
        const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        if (elapsed < 300 && dist < 6) {
          const rect = dom.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, this.camera);

          const floorCandidates = [];
          this.scene.traverse((c) => {
            if (c.isMesh && c.visible) {
              const n = (c.name || '').toLowerCase();
              if (n.includes('floor')) floorCandidates.push(c);
            }
          });

          const hits = raycaster.intersectObjects(floorCandidates, false);
          if (hits.length > 0) {
            const pt = hits[0].point;
            this.stepToLocation(pt.x, pt.z);
          }
        }
      }
    });

    dom.addEventListener('dblclick', () => {
      if (this.isWalkthrough && dom.requestPointerLock) {
        dom.requestPointerLock();
      }
    });
  }

  stepToLocation(targetX, targetZ) {
    const startX = this.camera.position.x;
    const startZ = this.camera.position.z;
    const dist = Math.hypot(targetX - startX, targetZ - startZ);
    if (dist < 0.2) return;

    const dir = new THREE.Vector3(targetX - startX, 0, targetZ - startZ).normalize();
    this.povYaw = Math.atan2(-dir.x, -dir.z);

    if (dist <= 7.0) {
      if (this.povCollision) {
        const moveVec = new THREE.Vector3(targetX - startX, 0, targetZ - startZ);
        const newPos = this.testWallCollision(this.camera.position, moveVec);
        this.camera.position.set(newPos.x, this.eyeHeight, newPos.z);
      } else {
        this.camera.position.set(targetX, this.eyeHeight, targetZ);
      }
      this.detectCurrentRoom();
    }
  }

  updateWalkthrough(delta) {
    if (this.isPanoramaInspecting) {
      this.povYaw += delta * 0.45;
    }

    const turnSpeed = 2.2;
    if (this.keys.turnLeft) this.povYaw += turnSpeed * delta;
    if (this.keys.turnRight) this.povYaw -= turnSpeed * delta;

    this.povPitch = Math.max(-1.4, Math.min(1.4, this.povPitch));
    const euler = new THREE.Euler(this.povPitch, this.povYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    const forward = new THREE.Vector3(-Math.sin(this.povYaw), 0, -Math.cos(this.povYaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.povYaw), 0, -Math.sin(this.povYaw)).normalize();

    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.add(forward);
    if (this.keys.backward) moveDir.sub(forward);
    if (this.keys.left) moveDir.sub(right);
    if (this.keys.right) moveDir.add(right);

    const isMoving = moveDir.lengthSq() > 0.0001;
    if (isMoving) {
      const curSpeed = (this.keys.sprint || this.isSprinting ? 5.5 : this.povSpeed) * delta;
      moveDir.normalize().multiplyScalar(curSpeed);

      if (this.povCollision) {
        const newPos = this.testWallCollision(this.camera.position, moveDir);
        this.camera.position.copy(newPos);
      } else {
        this.camera.position.add(moveDir);
      }

      this.headBobTimer += delta * (this.keys.sprint || this.isSprinting ? 14.0 : 9.0);
      this.camera.position.y = this.eyeHeight + Math.sin(this.headBobTimer) * 0.022;
    } else {
      this.camera.position.y = this.eyeHeight;
    }

    this.detectCurrentRoom();
  }

  testWallCollision(currentPos, deltaVec) {
    const playerRadius = 0.35;
    const waistY = 0.9;
    const rayOrigin = new THREE.Vector3(currentPos.x, waistY, currentPos.z);
    const moveDir = deltaVec.clone().normalize();
    const moveDist = deltaVec.length();

    // Solid wall meshes (exclude doorways/openings, floors, roofs)
    const solidWalls = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper && !child.userData.isArchitecturalOpening) {
        const n = (child.name || '').toLowerCase();
        if (n.startsWith('wall') || n.includes('wall') || child.userData.wallId) {
          solidWalls.push(child);
        }
      }
    });

    if (solidWalls.length === 0) {
      return currentPos.clone().add(deltaVec);
    }

    const ray = new THREE.Raycaster(rayOrigin, moveDir, 0, moveDist + playerRadius);
    const hits = ray.intersectObjects(solidWalls, false);

    if (hits.length === 0) {
      return currentPos.clone().add(deltaVec);
    }

    // Sliding collision along wall surface
    const hit = hits[0];
    const normal = hit.face ? hit.face.normal.clone().applyQuaternion(hit.object.quaternion) : new THREE.Vector3(0, 0, 1);
    normal.y = 0;
    normal.normalize();

    const dot = deltaVec.dot(normal);
    if (dot < 0) {
      const slideVec = deltaVec.clone().sub(normal.clone().multiplyScalar(dot));
      const slideRay = new THREE.Raycaster(rayOrigin, slideVec.clone().normalize(), 0, slideVec.length() + playerRadius);
      const slideHits = slideRay.intersectObjects(solidWalls, false);
      if (slideHits.length === 0) {
        return currentPos.clone().add(slideVec);
      }
    }

    return currentPos.clone();
  }

  detectCurrentRoom() {
    if (!this.roomsData || this.roomsData.length === 0) return;
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    const planY = -pz;

    let foundRoom = null;
    for (const rm of this.roomsData) {
      if (rm.polygon && rm.polygon.length >= 3) {
        if (this.pointInPolygon(px, planY, rm.polygon)) {
          foundRoom = rm;
          break;
        }
      }
    }

    if (foundRoom !== this.currentRoom) {
      this.currentRoom = foundRoom;
      const badge = document.getElementById('pov-hud-room-name');
      if (badge) {
        badge.textContent = `📍 ${foundRoom ? foundRoom.name + (foundRoom.area_sqm ? ` (${Math.round(foundRoom.area_sqm)} m²)` : '') : 'Hallway / Corridor'}`;
      }
    }
  }

  pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = Array.isArray(poly[i]) ? poly[i][0] : poly[i].x;
      const yi = Array.isArray(poly[i]) ? poly[i][1] : poly[i].y;
      const xj = Array.isArray(poly[j]) ? poly[j][0] : poly[j].x;
      const yj = Array.isArray(poly[j]) ? poly[j][1] : poly[j].y;

      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  teleportToRoom(roomId) {
    const rm = this.roomsData?.find((r) => r.id === roomId);
    if (!rm || !rm.polygon || rm.polygon.length === 0) return;

    let sumX = 0, sumY = 0, count = 0;
    rm.polygon.forEach((pt) => {
      sumX += Array.isArray(pt) ? pt[0] : (pt.x !== undefined ? pt.x : 0);
      sumY += Array.isArray(pt) ? pt[1] : (pt.y !== undefined ? pt.y : 0);
      count++;
    });
    if (count === 0) return;

    const cx = sumX / count;
    const cz = -(sumY / count);

    this.camera.position.set(cx, this.eyeHeight, cz);
    this.povPitch = 0;
    this.povYaw = 0;
    this.currentRoom = rm;
    this.detectCurrentRoom();
  }

  inspectCorner(cornerIndex) {
    const rm = this.currentRoom || this.roomsData?.[0];
    if (!rm || !rm.polygon || rm.polygon.length < 3) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rm.polygon.forEach((pt) => {
      const px = Array.isArray(pt) ? pt[0] : (pt.x !== undefined ? pt.x : 0);
      const py = Array.isArray(pt) ? pt[1] : (pt.y !== undefined ? pt.y : 0);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });

    const offset = 0.7; // 0.7m inward from wall corner
    let targetX = minX + offset, targetZ = -(minY + offset);
    let lookX = (minX + maxX) / 2, lookZ = -((minY + maxY) / 2);

    if (cornerIndex === 0) { // NW
      targetX = minX + offset;
      targetZ = -(maxY - offset);
    } else if (cornerIndex === 1) { // NE
      targetX = maxX - offset;
      targetZ = -(maxY - offset);
    } else if (cornerIndex === 2) { // SE
      targetX = maxX - offset;
      targetZ = -(minY + offset);
    } else if (cornerIndex === 3) { // SW
      targetX = minX + offset;
      targetZ = -(minY + offset);
    }

    this.camera.position.set(targetX, this.eyeHeight, targetZ);
    const lookDir = new THREE.Vector3(lookX - targetX, 0, lookZ - targetZ).normalize();
    this.povYaw = Math.atan2(-lookDir.x, -lookDir.z);
    this.povPitch = -0.06;
  }

  startPanoramaTour() {
    this.isPanoramaInspecting = !this.isPanoramaInspecting;
    const btn = document.getElementById('pov-btn-panorama');
    if (btn) {
      btn.textContent = this.isPanoramaInspecting ? '⏹️ Stop 360°' : '🔄 360°';
      btn.classList.toggle('active', this.isPanoramaInspecting);
    }
  }

  setEyeHeight(height) {
    this.eyeHeight = height;
    this.camera.position.y = height;
    const select = document.getElementById('pov-select-height');
    if (select) select.value = height.toString();
  }

  mountPovHud() {
    this.unmountPovHud();

    const hud = document.createElement('div');
    hud.className = 'pov-hud-overlay';
    hud.id = 'pov-walkthrough-hud';

    let roomOptionsHtml = '<option value="">🚪 Jump to Room...</option>';
    if (this.roomsData && this.roomsData.length > 0) {
      this.roomsData.forEach((r) => {
        const areaStr = r.area_sqm ? ` (${Math.round(r.area_sqm)} m²)` : '';
        roomOptionsHtml += `<option value="${r.id}">${r.name || 'Room'}${areaStr}</option>`;
      });
    }

    hud.innerHTML = `
      <div class="pov-hud-topbar">
        <div class="pov-badge-group">
          <span class="pov-live-badge"><span class="pulse-dot"></span> POV Walkthrough</span>
          <span class="pov-room-badge" id="pov-hud-room-name">📍 ${this.currentRoom?.name || 'Exploring Interior'}</span>
        </div>

        <div class="pov-controls-group">
          <select id="pov-select-room" class="pov-hud-select" title="Instantly step into any room at eye level">
            ${roomOptionsHtml}
          </select>

          <div class="pov-corner-group" title="Inspect every corner of the current room">
            <span class="pov-btn-label">Corners:</span>
            <button type="button" class="pov-hud-btn" data-corner="0" title="Inspect North-West Corner">NW</button>
            <button type="button" class="pov-hud-btn" data-corner="1" title="Inspect North-East Corner">NE</button>
            <button type="button" class="pov-hud-btn" data-corner="2" title="Inspect South-East Corner">SE</button>
            <button type="button" class="pov-hud-btn" data-corner="3" title="Inspect South-West Corner">SW</button>
            <button type="button" class="pov-hud-btn" id="pov-btn-panorama" title="360° Automatic Panoramic Room Tour">🔄 360°</button>
          </div>

          <button type="button" class="pov-hud-btn" id="pov-btn-collision" title="Toggle between Solid Walls (walk through doors) and Ghost Mode (pass through any wall)">
            ${this.povCollision ? '🛡️ Solid Walls' : '👻 Pass Walls'}
          </button>

          <button type="button" class="pov-hud-btn" id="pov-btn-speed" title="Toggle walk/run speed (or hold Shift)">
            ${this.isSprinting ? '🏃 Fast' : '🚶 Normal'}
          </button>

          <select id="pov-select-height" class="pov-hud-select" title="Eye-level elevation">
            <option value="1.6" ${this.eyeHeight === 1.6 ? 'selected' : ''}>👁️ Eye Level (1.6m)</option>
            <option value="1.1" ${this.eyeHeight === 1.1 ? 'selected' : ''}>🪑 Seated (1.1m)</option>
            <option value="2.1" ${this.eyeHeight === 2.1 ? 'selected' : ''}>📐 High View (2.1m)</option>
          </select>

          <button type="button" class="pov-hud-btn exit-btn" id="pov-btn-exit" title="Exit Walkthrough and return to Orbit Camera">
            ✕ Exit POV
          </button>
        </div>
      </div>

      <div class="pov-crosshair"></div>

      <div class="pov-virtual-dpad">
        <div class="dpad-row">
          <button type="button" class="dpad-btn" data-dpad="turnLeft" title="Turn Left (Q)">🔄</button>
          <button type="button" class="dpad-btn" data-dpad="forward" title="Walk Forward (W / ⬆️)">⬆️</button>
          <button type="button" class="dpad-btn" data-dpad="turnRight" title="Turn Right (E)">🔁</button>
        </div>
        <div class="dpad-row">
          <button type="button" class="dpad-btn" data-dpad="left" title="Strafe Left (A / ⬅️)">⬅️</button>
          <button type="button" class="dpad-btn" data-dpad="backward" title="Walk Backward (S / ⬇️)">⬇️</button>
          <button type="button" class="dpad-btn" data-dpad="right" title="Strafe Right (D / ➡️)">➡️</button>
        </div>
      </div>

      <div class="pov-hud-bottombar">
        <span>🎮 <strong>Controls:</strong> WASD / Arrows to Walk • Shift to Run • Click & Drag to Look • Q/E to Turn • Click Floor to Step • G for Ghost Mode</span>
      </div>
    `;

    this.container.appendChild(hud);
    this.povHudElement = hud;

    this.bindPovHudEvents(hud);
  }

  unmountPovHud() {
    if (this.povHudElement && this.povHudElement.parentNode) {
      this.povHudElement.parentNode.removeChild(this.povHudElement);
      this.povHudElement = null;
    }
  }

  bindPovHudEvents(hud) {
    hud.querySelector('#pov-select-room')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) this.teleportToRoom(val);
    });

    hud.querySelectorAll('[data-corner]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.corner, 10);
        this.inspectCorner(cIdx);
      });
    });

    hud.querySelector('#pov-btn-panorama')?.addEventListener('click', () => {
      this.startPanoramaTour();
    });

    hud.querySelector('#pov-btn-collision')?.addEventListener('click', () => {
      this.povCollision = !this.povCollision;
      const b = hud.querySelector('#pov-btn-collision');
      if (b) b.textContent = this.povCollision ? '🛡️ Solid Walls' : '👻 Pass Walls';
    });

    hud.querySelector('#pov-btn-speed')?.addEventListener('click', () => {
      this.isSprinting = !this.isSprinting;
      const b = hud.querySelector('#pov-btn-speed');
      if (b) b.textContent = this.isSprinting ? '🏃 Fast' : '🚶 Normal';
    });

    hud.querySelector('#pov-select-height')?.addEventListener('change', (e) => {
      this.setEyeHeight(parseFloat(e.target.value));
    });

    hud.querySelector('#pov-btn-exit')?.addEventListener('click', () => {
      this.setCameraPreset('persp');
    });

    // Virtual D-pad listeners
    hud.querySelectorAll('[data-dpad]').forEach((btn) => {
      const keyName = btn.dataset.dpad;
      const press = (ev) => {
        ev.preventDefault();
        this.keys[keyName] = true;
      };
      const release = (ev) => {
        ev.preventDefault();
        this.keys[keyName] = false;
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });
  }
}
