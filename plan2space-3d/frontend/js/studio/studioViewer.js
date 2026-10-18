/**
 * Three.js 3D Viewport, Camera Controls, Lighting, and Walkthrough Mode for Interior Design Studio.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class StudioViewer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModel = null;
    this.grid = null;

    this.modelCenter = new THREE.Vector3(0, 0, 0);
    this.modelSize = new THREE.Vector3(10, 3, 8);

    // First-Person POV Walkthrough & Room Tour State
    this.isWalkthrough = false;
    this.povYaw = 0;
    this.povPitch = 0;
    this.eyeHeight = 1.6; // metres (human eye level)
    this.povSpeed = 2.8;  // m/s
    this.isSprinting = false;
    this.povCollision = true; // Slides along walls and enters through doors; toggleable for Ghost Mode
    this.headBobTimer = 0;
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

    // Layers
    this.walls = [];
    this.floors = [];
    this.roof = null;
    this.wallTransparency = false;

    // Room Labels State
    this.roomLabelsGroup = null;
    this.roomLabelsVisible = true;
    this.roomsData = [];

    // Roof & Ceiling Configuration
    this.roofConfig = {
      type: 'tiles',    // 'tiles' or 'plain'
      shape: 'gabled',  // 'gabled' or 'flat'
      color: '#C2410C', // Classic terracotta
      visible: false,   // Default to interior view
      finish: 'matte',
    };

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene
    this.scene = new THREE.Scene();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bgColor = isDark ? 0x171614 : 0xf5f1eb;
    this.scene.background = new THREE.Color(bgColor);
    this.scene.fog = new THREE.FogExp2(bgColor, 0.012);

    // Group for 3D Room Name Labels
    this.roomLabelsGroup = new THREE.Group();
    this.roomLabelsGroup.name = 'room_labels_group';
    this.scene.add(this.roomLabelsGroup);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(12, 10, 14);

    // 3. Renderer with Logarithmic Depth Buffer (Eliminates Z-fighting completely)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // 5. Realistic Warm Studio Lighting (BuildWise Palette)
    const ambientLight = new THREE.AmbientLight(0xfffdf9, 0.85);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfffdf9, 0x817a72, 0.65);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.35);
    dirLight.position.set(16, 26, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    this.scene.add(dirLight);

    // Soft fill light
    const fillLight = new THREE.DirectionalLight(0xdad3c8, 0.45);
    fillLight.position.set(-15, 18, -15);
    this.scene.add(fillLight);

    // Soft Ground Shadow Contact Plane
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.005;
    groundMesh.receiveShadow = true;
    groundMesh.userData.isHelper = true;
    this.scene.add(groundMesh);

    // 6. Architectural Grid
    const gridColor1 = isDark ? 0xb96848 : 0xb96848;
    const gridColor2 = isDark ? 0x2a2723 : 0xddd6cc;
    this.grid = new THREE.GridHelper(50, 50, gridColor1, gridColor2);
    this.grid.position.y = -0.006;
    this.grid.userData.isHelper = true;
    this.scene.add(this.grid);

    // Events
    window.addEventListener('resize', () => this.onResize());
    this.bindWalkthroughKeys();
    this.bindPovPointerEvents();

    // Animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    // Rotate active ceiling fan blades
    this.scene.traverse((child) => {
      if (child.userData && child.userData.isFanBlades) {
        child.rotation.y += delta * 12.0; // ~120 RPM smooth spin
      }
    });

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
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }
    this.walls = [];
    this.floors = [];
    this.roof = null;

    loader.load(
      url,
      (gltf) => {
        this.currentModel = gltf.scene;

        this.currentModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Clone materials so meshes NEVER share material instances
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((m) => m.clone());
              } else {
                child.material = child.material.clone();
              }
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.roughness = 0.85;
                m.polygonOffset = true;
                m.polygonOffsetFactor = 1;
                m.polygonOffsetUnits = 1;
              });
            }

            const meshName = (child.name || '').toLowerCase();
            const parentName = (child.parent ? child.parent.name : '').toLowerCase();
            const fullName = meshName.startsWith('wall') ? (child.name || '') : (child.parent ? child.parent.name : '');

            if (fullName.startsWith('wall:')) {
              child.userData.wallId = fullName.slice(5);
              this.walls.push(child);
            } else if (meshName.startsWith('floor') || parentName.startsWith('floor')) {
              this.floors.push(child);
            } else if (meshName === 'roof' || parentName === 'roof') {
              this.roof = child;
            } else if (fullName.toLowerCase().startsWith('wall')) {
              child.userData.wallId = fullName.replace(/^wall[:_]?/i, '');
              this.walls.push(child);
            } else {
              this.walls.push(child);
            }
          }
        });

        this.scene.add(this.currentModel);

        // Frame camera
        const bbox = new THREE.Box3().setFromObject(this.currentModel);
        this.modelCenter = bbox.getCenter(new THREE.Vector3());
        this.modelSize = bbox.getSize(new THREE.Vector3());

        this.setCameraPreset('perspective');

        if (onLoaded) {
          onLoaded({ bbox, center: this.modelCenter, size: this.modelSize, model: this.currentModel });
        }
      },
      undefined,
      (err) => {
        console.error('Error loading conversion GLB in Studio:', err);
      }
    );
  }

  // --- Camera Presets ---

  setCameraPreset(preset) {
    if (preset === 'walkthrough') {
      this.enableWalkthrough();
      return;
    }

    if (this.isWalkthrough) {
      this.disableWalkthrough();
    }

    this.controls.enabled = true;

    const c = this.modelCenter;
    const maxDim = Math.max(this.modelSize.x, this.modelSize.y, this.modelSize.z, 6.0);

    if (preset === 'perspective') {
      this.camera.position.set(c.x + maxDim * 1.1, c.y + maxDim * 0.9, c.z + maxDim * 1.3);
      this.controls.target.copy(c);
    } else if (preset === 'top') {
      this.camera.position.set(c.x, c.y + maxDim * 1.8, c.z + 0.001);
      this.controls.target.copy(c);
    } else if (preset === 'isometric') {
      const d = maxDim * 1.2;
      this.camera.position.set(c.x + d, c.y + d, c.z + d);
      this.controls.target.copy(c);
    }

    this.controls.update();
  }

  // --- First-Person POV Walkthrough & Room Tour Controller ---

  enableWalkthrough() {
    this.isWalkthrough = true;
    this.controls.enabled = false; // Disable OrbitControls so camera is driven purely by POV head & feet

    // Choose best starting location (prefers Living Room or first room center)
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

    // Update active button state
    document.querySelectorAll('.floating-viewport-bar button').forEach((b) => b.classList.remove('active'));
    document.getElementById('btn-cam-walk')?.classList.add('active');

    // Mount on-screen POV HUD
    this.mountPovHud();
    this.detectCurrentRoom();
  }

  disableWalkthrough() {
    if (!this.isWalkthrough) return;
    this.isWalkthrough = false;
    this.isPanoramaInspecting = false;
    this.controls.enabled = true;

    // Place OrbitControls target 4m in front of camera
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
      if (k === 'c') this.setEyeHeight(1.1); // Crouch / Seated view
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
            if (c.isMesh && c.visible && !c.userData.isHelper && !c.userData.isRoomLabel) {
              const n = (c.name || '').toLowerCase();
              if (n.includes('floor') || c.name === 'floor' || n.startsWith('floor:')) {
                floorCandidates.push(c);
              }
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

    // Turn head toward clicked spot
    const dir = new THREE.Vector3(targetX - startX, 0, targetZ - startZ).normalize();
    this.povYaw = Math.atan2(-dir.x, -dir.z);

    // If within 7 metres, step directly there
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
      this.povYaw += delta * 0.45; // ~14s for 360 rotation
    }

    // Keyboard rotation
    const turnSpeed = 2.2;
    if (this.keys.turnLeft) this.povYaw += turnSpeed * delta;
    if (this.keys.turnRight) this.povYaw -= turnSpeed * delta;

    this.povPitch = Math.max(-1.4, Math.min(1.4, this.povPitch));
    const euler = new THREE.Euler(this.povPitch, this.povYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // Forward and Right vectors on horizontal plane
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

    // Solid wall meshes (exclude openings/cutouts, floor, roofs, helpers)
    const solidWalls = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper && !child.userData.isArchitecturalOpening && !child.userData.isRoomLabel) {
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
      // Clear path (open space or door opening)
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
      this.setCameraPreset('perspective');
    });

    // Virtual D-pad listeners
    hud.querySelectorAll('[data-dpad]').forEach((btn) => {
      const keyName = btn.dataset.dpad;
      const activate = (e) => {
        e.preventDefault();
        this.keys[keyName] = true;
      };
      const deactivate = (e) => {
        e.preventDefault();
        this.keys[keyName] = false;
      };

      btn.addEventListener('pointerdown', activate);
      btn.addEventListener('pointerup', deactivate);
      btn.addEventListener('pointerleave', deactivate);
    });
  }

  // --- Room Labels Management ---

  setRoomLabels(rooms) {
    if (!rooms || !Array.isArray(rooms)) return;
    this.roomsData = rooms;

    // Clear existing label sprites
    while (this.roomLabelsGroup && this.roomLabelsGroup.children.length > 0) {
      const sp = this.roomLabelsGroup.children[0];
      this.roomLabelsGroup.remove(sp);
      if (sp.material) {
        if (sp.material.map) sp.material.map.dispose();
        sp.material.dispose();
      }
    }

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    rooms.forEach((rm) => {
      if (!rm.polygon || rm.polygon.length === 0) return;
      let sumX = 0, sumY = 0, count = 0;
      rm.polygon.forEach((pt) => {
        const px = Array.isArray(pt) ? pt[0] : (pt.x !== undefined ? pt.x : 0);
        const py = Array.isArray(pt) ? pt[1] : (pt.y !== undefined ? pt.y : 0);
        sumX += px;
        sumY += py;
        count++;
      });
      if (count === 0) return;
      const cx = sumX / count;
      const cz = -(sumY / count);

      const sprite = createRoomLabelSprite(rm, isDark);
      sprite.position.set(cx, 0.45, cz);
      this.roomLabelsGroup.add(sprite);
    });

    if (this.roomLabelsGroup) {
      this.roomLabelsGroup.visible = this.roomLabelsVisible;
    }
  }

  toggleRoomLabels(visible) {
    this.roomLabelsVisible = !!visible;
    if (this.roomLabelsGroup) {
      this.roomLabelsGroup.visible = this.roomLabelsVisible;
    }
  }

  // --- Procedural Roof Management (Tiles / Plain & Gabled / Flat) ---

  getHouseBounds() {
    const box = new THREE.Box3();
    let hasGeom = false;
    this.scene.traverse((child) => {
      if (child.isMesh && child.visible && !child.userData.isHelper && !child.userData.isRoomLabel && child.name !== 'roof') {
        const n = (child.name || '').toLowerCase();
        if (n.startsWith('wall') || n.startsWith('floor')) {
          box.expandByObject(child);
          hasGeom = true;
        }
      }
    });
    if (!hasGeom) {
      if (this.currentModel) box.setFromObject(this.currentModel);
      else box.set(new THREE.Vector3(-6, 0, -6), new THREE.Vector3(6, 2.8, 6));
    }
    return box;
  }

  createFlatRoofMesh(box, overhang = 0.35, thickness = 0.18) {
    const w = (box.max.x - box.min.x) + overhang * 2;
    const d = (box.max.z - box.min.z) + overhang * 2;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const y = Math.max(box.max.y, 2.7) + thickness / 2;

    const geom = new THREE.BoxGeometry(w, thickness, d);
    const mesh = new THREE.Mesh(geom);
    mesh.position.set(cx, y, cz);
    mesh.name = 'roof';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createGabledRoofMesh(box, overhang = 0.35, pitchDeg = 18.0) {
    const xMin = box.min.x - overhang;
    const xMax = box.max.x + overhang;
    const zMin = box.min.z - overhang;
    const zMax = box.max.z + overhang;
    const baseY = Math.max(box.max.y, 2.7);

    const width = xMax - xMin;
    const depth = zMax - zMin;
    const pitchRad = (pitchDeg * Math.PI) / 180;

    let vRaw, faces;
    if (width >= depth) {
      // Ridge runs along X
      const ridgeRise = (depth / 2.0) * Math.tan(pitchRad);
      const midZ = (zMin + zMax) / 2.0;
      vRaw = [
        [xMin, baseY, zMin],
        [xMin, baseY, zMax],
        [xMin, baseY + ridgeRise, midZ],
        [xMax, baseY, zMin],
        [xMax, baseY, zMax],
        [xMax, baseY + ridgeRise, midZ],
      ];
      faces = [
        0, 2, 1, // West gable
        3, 4, 5, // East gable
        0, 1, 4,  0, 4, 3, // Base
        0, 3, 5,  0, 5, 2, // South pitch
        1, 2, 5,  1, 5, 4, // North pitch
      ];
    } else {
      // Ridge runs along Z
      const ridgeRise = (width / 2.0) * Math.tan(pitchRad);
      const midX = (xMin + xMax) / 2.0;
      vRaw = [
        [xMin, baseY, zMin],
        [xMax, baseY, zMin],
        [midX, baseY + ridgeRise, zMin],
        [xMin, baseY, zMax],
        [xMax, baseY, zMax],
        [midX, baseY + ridgeRise, zMax],
      ];
      faces = [
        0, 1, 2, // North gable
        3, 5, 4, // South gable
        0, 4, 1,  0, 3, 4, // Base
        0, 2, 5,  0, 5, 3, // West pitch
        1, 4, 5,  1, 5, 2, // East pitch
      ];
    }

    const vertices = new Float32Array(faces.length * 3);
    const uvs = new Float32Array(faces.length * 2);
    for (let i = 0; i < faces.length; i++) {
      const pt = vRaw[faces[i]];
      vertices[i * 3] = pt[0];
      vertices[i * 3 + 1] = pt[1];
      vertices[i * 3 + 2] = pt[2];
      uvs[i * 2] = (pt[0] - xMin) * 0.8;
      uvs[i * 2 + 1] = (pt[2] - zMin) * 0.8;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom);
    mesh.name = 'roof';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  updateRoof(config = {}) {
    if (config.type !== undefined) this.roofConfig.type = config.type;
    if (config.shape !== undefined) this.roofConfig.shape = config.shape;
    if (config.color !== undefined) this.roofConfig.color = config.color;
    if (config.visible !== undefined) this.roofConfig.visible = !!config.visible;
    if (config.finish !== undefined) this.roofConfig.finish = config.finish;

    // Dispose existing roof mesh
    if (this.roof) {
      this.scene.remove(this.roof);
      if (this.roof.geometry) this.roof.geometry.dispose();
      if (this.roof.material) {
        if (Array.isArray(this.roof.material)) this.roof.material.forEach((m) => m.dispose());
        else this.roof.material.dispose();
      }
      this.roof = null;
    }

    const bounds = this.getHouseBounds();
    const isTiles = this.roofConfig.type === 'tiles';
    const isGabled = this.roofConfig.shape === 'gabled';

    let mesh = null;
    if (isGabled) {
      mesh = this.createGabledRoofMesh(bounds);
    } else {
      mesh = this.createFlatRoofMesh(bounds);
    }

    const tileTexture = isTiles ? createRoofTileTexture(this.roofConfig.color) : null;
    const roofMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.roofConfig.color),
      roughness: this.roofConfig.finish === 'gloss' ? 0.15 : (isTiles ? 0.55 : 0.82),
      metalness: 0.05,
      map: tileTexture,
    });
    roofMat.name = 'mat_roof';

    mesh.material = roofMat;
    mesh.visible = !!this.roofConfig.visible;
    mesh.name = 'roof';

    this.roof = mesh;
    this.scene.add(this.roof);
  }

  // --- View Toggles ---

  toggleRoof(visible) {
    this.roofConfig.visible = !!visible;
    if (!this.roof) {
      this.updateRoof({ visible });
    } else {
      this.roof.visible = !!visible;
    }
  }

  toggleGrid(visible) {
    if (this.grid) {
      this.grid.visible = visible;
    }
  }

  toggleWallTransparency(transparent) {
    this.wallTransparency = transparent;
    this.walls.forEach((wall) => {
      const applyMat = (m) => {
        m.transparent = transparent;
        m.opacity = transparent ? 0.38 : 1.0;
      };
      if (Array.isArray(wall.material)) {
        wall.material.forEach(applyMat);
      } else if (wall.material) {
        applyMat(wall.material);
      }
    });
  }

  setTheme(theme) {
    const isDark = theme !== 'light';
    const bgColor = isDark ? 0x171614 : 0xf5f1eb;
    if (this.scene) {
      this.scene.background = new THREE.Color(bgColor);
      if (this.scene.fog) {
        this.scene.fog.color = new THREE.Color(bgColor);
      }
    }
    if (this.grid) {
      this.scene.remove(this.grid);
      const gridColor1 = 0xb96848;
      const gridColor2 = isDark ? 0x2a2723 : 0xddd6cc;
      this.grid = new THREE.GridHelper(50, 50, gridColor1, gridColor2);
      this.grid.position.y = -0.006;
      this.grid.userData.isHelper = true;
      this.scene.add(this.grid);
    }
    // Refresh room label theme styling
    if (this.roomsData && this.roomsData.length > 0) {
      this.setRoomLabels(this.roomsData);
    }
  }

  captureSnapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

/**
 * Generates an interlocking Spanish / Terracotta clay tile texture procedurally.
 * Features 3D barrel ridges, highlight crests, and row shadow overlap.
 */
export function createRoofTileTexture(tileColorHex = '#C2410C') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base background
  ctx.fillStyle = '#a63404';
  ctx.fillRect(0, 0, 512, 512);

  const numRows = 8;
  const numCols = 8;
  const rowHeight = 512 / numRows;
  const colWidth = 512 / numCols;

  for (let r = 0; r < numRows; r++) {
    const y = r * rowHeight;
    const isOdd = r % 2 === 1;
    const xOffset = isOdd ? colWidth / 2 : 0;

    for (let c = -1; c <= numCols + 1; c++) {
      const x = c * colWidth + xOffset;

      // Rounded S-tile barrel shape with highlights and shadow troughs
      const grad = ctx.createLinearGradient(x, y, x + colWidth, y);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.32)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, colWidth, rowHeight - 2);

      // Overlap horizontal shadow line at bottom of each tile row
      ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
      ctx.fillRect(x, y + rowHeight - 3.5, colWidth, 3.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.fillRect(x, y, colWidth, 1.5);
    }
  }

  // Ceramic subtle grain
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

/**
 * Creates a high-DPI 3D Billboard Sprite displaying room icon, name, and area.
 * Configured with depthTest: false so it floats clearly above rooms and never gets hidden by walls.
 */
export function createRoomLabelSprite(room, isDark = true) {
  if (typeof document === 'undefined') return new THREE.Sprite();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  const pillW = 460;
  const pillH = 120;
  const pillX = 26;
  const pillY = 20;
  const r = 28;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pillX + r, pillY);
  ctx.lineTo(pillX + pillW - r, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
  ctx.lineTo(pillX + pillW, pillY + pillH - r);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
  ctx.lineTo(pillX + r, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
  ctx.lineTo(pillX, pillY + r);
  ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
  ctx.closePath();

  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = isDark ? 'rgba(23, 22, 20, 0.92)' : 'rgba(255, 253, 249, 0.95)';
  ctx.fill();

  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#b96848'; // BuildWise signature terracotta
  ctx.stroke();
  ctx.restore();

  const nameLower = (room.name || '').toLowerCase();
  let icon = '🏠';
  if (nameLower.includes('living') || nameLower.includes('hall')) icon = '🛋️';
  else if (nameLower.includes('bed')) icon = '🛏️';
  else if (nameLower.includes('kitchen') || nameLower.includes('dining')) icon = '🍳';
  else if (nameLower.includes('bath') || nameLower.includes('toilet') || nameLower.includes('wc')) icon = '🚿';
  else if (nameLower.includes('park') || nameLower.includes('garage')) icon = '🚗';
  else if (nameLower.includes('balcony') || nameLower.includes('sit') || nameLower.includes('patio')) icon = '🌿';
  else if (nameLower.includes('study') || nameLower.includes('office')) icon = '📚';
  else if (nameLower.includes('pooja') || nameLower.includes('prayer')) icon = '🪔';
  else if (nameLower.includes('utility') || nameLower.includes('store')) icon = '🧺';

  ctx.font = '40px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, pillX + 28, pillY + pillH / 2);

  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isDark ? '#FFFDF9' : '#171614';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const rawName = room.name || 'Room';
  const displayName = rawName.length > 18 ? rawName.slice(0, 16) + '...' : rawName;
  ctx.fillText(displayName, pillX + 88, pillY + 54);

  ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#b96848';
  const areaText = room.area_sqm ? `${Math.round(room.area_sqm * 10) / 10} m²` : 'Room Area';
  ctx.fillText(areaText, pillX + 88, pillY + 92);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.5, 1);
  sprite.userData = { isRoomLabel: true, roomId: room.id, roomName: room.name };
  return sprite;
}
