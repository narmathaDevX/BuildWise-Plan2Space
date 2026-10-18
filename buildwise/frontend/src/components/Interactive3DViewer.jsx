import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Box,
  Layers,
  RefreshCw,
  Download,
  Eye,
  Camera,
  Tag,
  Home,
  CheckCircle2,
  ChevronRight,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { API_BASE_URL } from "../services/api";
import { launchDesignStudio } from "../services/designStudio";

// Icon mapping based on room type
function getRoomEmoji(type = "") {
  const t = type.toLowerCase();
  if (t.includes("bed")) return "🛏️";
  if (t.includes("bath")) return "🚿";
  if (t.includes("kitchen")) return "🍳";
  if (t.includes("dining")) return "🍽️";
  if (t.includes("living") || t.includes("hall")) return "🛋️";
  if (t.includes("pooja")) return "🪔";
  if (t.includes("balcony")) return "🌅";
  if (t.includes("parking")) return "🚗";
  if (t.includes("utility")) return "🧺";
  return "🏛️";
}

// Generate sharp 2D Canvas billboard sprite for 3D room labels
function createRoomLabelSprite(name, dimStr, isDark) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  // Draw pill background with border
  const r = 28;
  const x = 16, y = 16, w = 480, h = 128;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  ctx.fillStyle = isDark ? "rgba(23, 22, 20, 0.92)" : "rgba(255, 253, 249, 0.94)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#b96848"; // BuildWise signature terracotta
  ctx.stroke();

  // Draw Text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Name
  ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = isDark ? "#f4efe7" : "#24221f";
  ctx.fillText(name, 256, 62);

  // Dimensions
  if (dimStr) {
    ctx.font = "600 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#b96848";
    ctx.fillText(dimStr, 256, 104);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(3.0, 0.95, 1.0);
  return sprite;
}

export default function Interactive3DViewer({ plan, activeFloorIndex = 0 }) {
  const { theme } = useTheme();
  const mountRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [modelUrl, setModelUrl] = useState(null);

  // Layer and Feature Toggles
  const [showWalls, setShowWalls] = useState(true);
  const [showFloor, setShowFloor] = useState(true);
  const [roofMode, setRoofMode] = useState("none"); // "none" | "tiles" | "flat"
  const [showLabels, setShowLabels] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  // Selected Room in 3D
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomFilter, setRoomFilter] = useState("all");
  const [openingStudio, setOpeningStudio] = useState(false);

  const handleOpenDesignStudio = async () => {
    setOpeningStudio(true);
    try {
      await launchDesignStudio(plan);
    } finally {
      setOpeningStudio(false);
    }
  };

  // Three.js instances ref
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    model: null,
    layers: { walls: [], floor: [], roof_flat: [], roof_tiles: [], roof: [] },
    roomMeshes: {}, // rm_id -> Mesh
    labelsGroup: null,
    initialCamera: null,
  });

  // 1. Fetch / Generate 3D Model from API (Generates walls, floor slabs, and both roof variants)
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    async function load3D() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/3d/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: plan,
            options: {
              include_floor: true,
              include_roof: true,
              wall_height_m: 2.8,
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(errData.detail || "Failed to generate 3D model");
        }

        const data = await res.json();
        if (!isCancelled) {
          const fullModelUrl = data.model_url.startsWith("http") ? data.model_url : `${API_BASE_URL}${data.model_url}`;
          setModelUrl(fullModelUrl);
          setStats(data.stats);
          loadGLBModel(fullModelUrl, data.stats);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    if (plan) {
      load3D();
    }

    return () => {
      isCancelled = true;
    };
  }, [plan]);

  // 2. Initialize Three.js Viewport
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = 540;

    const isDark = theme === "dark";
    const bgColor = isDark ? 0x171614 : 0xf5f1eb;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.015);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(16, 14, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xfffbf5, isDark ? 0.9 : 1.15);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, isDark ? 0x24221f : 0xddd6cc, 0.5);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Ground Grid in metres
    const gridColor = isDark ? 0x3a3631 : 0xddd6cc;
    const grid = new THREE.GridHelper(50, 50, 0xb96848, gridColor);
    grid.position.y = -0.01;
    scene.add(grid);

    // Group for 3D room label billboard sprites
    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);

    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      model: null,
      layers: { walls: [], floor: [], roof: [] },
      roomMeshes: {},
      labelsGroup,
      initialCamera: null,
    };

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [theme]);

  // 3. Load GLB and Build 3D Labels
  const loadGLBModel = (url, meshStats) => {
    const { scene, camera, controls, labelsGroup } = threeRef.current;
    if (!scene) return;

    if (threeRef.current.model) {
      scene.remove(threeRef.current.model);
      threeRef.current.model = null;
    }
    if (labelsGroup) {
      labelsGroup.clear();
    }

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        threeRef.current.model = model;
        threeRef.current.layers = { walls: [], floor: [], roof_flat: [], roof_tiles: [], roof: [] };
        threeRef.current.roomMeshes = {};

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const name = (child.name || "").toLowerCase();

            if (name.includes("wall")) {
              threeRef.current.layers.walls.push(child);
            } else if (name.includes("roof_tiles")) {
              child.visible = roofMode === "tiles";
              threeRef.current.layers.roof_tiles.push(child);
              threeRef.current.layers.roof.push(child);
            } else if (name.includes("roof_flat") || name === "roof") {
              child.visible = roofMode === "flat";
              threeRef.current.layers.roof_flat.push(child);
              threeRef.current.layers.roof.push(child);
            } else {
              threeRef.current.layers.floor.push(child);
              // Track individual room meshes
              if (name.startsWith("room_")) {
                const rmId = name.replace("room_", "");
                threeRef.current.roomMeshes[rmId] = child;
              }
            }
          }
        });

        scene.add(model);

        // Add 3D Room Billboard Labels
        const roomsInfo = meshStats?.rooms_info || [];
        const isDark = theme === "dark";

        roomsInfo.forEach((rm) => {
          const dimText = `${rm.width_ft}′ × ${rm.height_ft}′`;
          const sprite = createRoomLabelSprite(rm.name, dimText, isDark);
          sprite.position.set(rm.center_m[0], rm.center_m[1] + 0.1, rm.center_m[2]);
          sprite.name = `label_${rm.id}`;
          labelsGroup.add(sprite);
        });

        // Frame camera
        const bbox = new THREE.Box3().setFromObject(model);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 6.0);

        camera.position.set(center.x + maxDim * 1.1, center.y + maxDim * 0.9, center.z + maxDim * 1.3);
        controls.target.copy(center);
        controls.update();

        threeRef.current.initialCamera = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };

        setLoading(false);
      },
      undefined,
      (err) => {
        console.error("3D model load error:", err);
        setError("Could not load 3D model artifact.");
        setLoading(false);
      }
    );
  };

  // 4. Focus and Highlight Selected Room
  const handleSelectRoom = (room) => {
    if (!room) {
      // Reset view to full plan
      setSelectedRoomId(null);
      handleCameraPreset("reset");

      // Reset room floor colors
      Object.values(threeRef.current.roomMeshes).forEach((mesh) => {
        if (mesh.material) {
          mesh.material.color.setHex(0xdad2c6);
          mesh.material.opacity = 1.0;
        }
      });
      return;
    }

    setSelectedRoomId(room.id);

    const { camera, controls, roomMeshes } = threeRef.current;
    if (!controls) return;

    // Highlight target room mesh with BuildWise terracotta glow
    Object.entries(roomMeshes).forEach(([id, mesh]) => {
      if (mesh.material) {
        if (id === room.id) {
          mesh.material.color.setHex(0xb96848); // Glowing terracotta
          mesh.material.opacity = 1.0;
        } else {
          mesh.material.color.setHex(0xdad2c6);
          mesh.material.opacity = 0.55;
        }
      }
    });

    // Smoothly focus camera on room center
    const [cx, cy, cz] = room.center_m;
    controls.target.set(cx, 0.5, cz);
    camera.position.set(cx + 4.5, 4.0, cz + 5.5);
    controls.update();
  };

  // Layer toggles
  const handleToggleLayer = (layerName, currentVal, setter) => {
    const newVal = !currentVal;
    setter(newVal);
    const meshes = threeRef.current.layers[layerName] || [];
    meshes.forEach((m) => (m.visible = newVal));
  };

  const handleSetRoofMode = (mode) => {
    setRoofMode(mode);
    const flatMeshes = threeRef.current.layers.roof_flat || [];
    const tileMeshes = threeRef.current.layers.roof_tiles || [];

    flatMeshes.forEach((m) => (m.visible = mode === "flat"));
    tileMeshes.forEach((m) => (m.visible = mode === "tiles"));
  };

  const handleToggleLabels = () => {
    const newVal = !showLabels;
    setShowLabels(newVal);
    if (threeRef.current.labelsGroup) {
      threeRef.current.labelsGroup.visible = newVal;
    }
  };

  const handleToggleWireframe = () => {
    const newVal = !wireframe;
    setWireframe(newVal);
    if (!threeRef.current.model) return;
    threeRef.current.model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => (m.wireframe = newVal));
        } else {
          child.material.wireframe = newVal;
        }
      }
    });
  };

  const handleCameraPreset = (preset) => {
    const { camera, controls, model, initialCamera } = threeRef.current;
    if (!controls || !model) return;

    const bbox = new THREE.Box3().setFromObject(model);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 6.0);

    controls.target.copy(center);

    if (preset === "top") {
      camera.position.set(center.x, center.y + maxDim * 2.0, center.z + 0.001);
    } else if (preset === "front") {
      camera.position.set(center.x, center.y + size.y * 0.5, center.z + maxDim * 1.6);
    } else if (preset === "reset" && initialCamera) {
      camera.position.copy(initialCamera.position);
      controls.target.copy(initialCamera.target);
    }
    controls.update();
  };

  const roomsList = stats?.rooms_info || [];
  const filteredRooms = roomsList.filter((r) => {
    if (roomFilter === "all") return true;
    if (roomFilter === "bed") return r.type.includes("bed");
    if (roomFilter === "living") return r.type.includes("living") || r.type.includes("hall") || r.type.includes("dining");
    if (roomFilter === "service") return r.type.includes("kitchen") || r.type.includes("bath") || r.type.includes("utility");
    return true;
  });

  const selectedRoomObj = roomsList.find((r) => r.id === selectedRoomId);

  return (
    <div className="bw-3d-wrapper" style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "14px",
      overflow: "hidden",
      position: "relative",
      boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    }}>
      {/* 3D Header Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        {/* Left: Title & Layers */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--text)",
          }}>
            <Box size={16} color="var(--accent)" />
            Interactive 3D Architectural Model
          </span>

          <div style={{ display: "flex", gap: "5px" }}>
            <button
              onClick={() => handleToggleLayer("walls", showWalls, setShowWalls)}
              style={{
                fontSize: "0.74rem",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: showWalls ? "var(--accent)" : "var(--surface)",
                color: showWalls ? "#fff" : "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Walls
            </button>
            <button
              onClick={() => handleToggleLayer("floor", showFloor, setShowFloor)}
              style={{
                fontSize: "0.74rem",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: showFloor ? "var(--accent)" : "var(--surface)",
                color: showFloor ? "#fff" : "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Floor
            </button>
            {/* Segmented Roof Type Selector */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => handleSetRoofMode("none")}
                title="Remove roof to view interior rooms"
                style={{
                  fontSize: "0.72rem",
                  padding: "4px 8px",
                  border: "none",
                  background: roofMode === "none" ? "var(--accent)" : "transparent",
                  color: roofMode === "none" ? "#fff" : "var(--text)",
                  cursor: "pointer",
                  fontWeight: roofMode === "none" ? 700 : 500,
                }}
              >
                Roof Off
              </button>
              <button
                onClick={() => handleSetRoofMode("tiles")}
                title="Traditional South Indian Mangalore terracotta clay tiles roof"
                style={{
                  fontSize: "0.72rem",
                  padding: "4px 8px",
                  border: "none",
                  borderLeft: "1px solid var(--border)",
                  background: roofMode === "tiles" ? "var(--accent)" : "transparent",
                  color: roofMode === "tiles" ? "#fff" : "var(--text)",
                  cursor: "pointer",
                  fontWeight: roofMode === "tiles" ? 700 : 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                🏡 Tiles
              </button>
              <button
                onClick={() => handleSetRoofMode("flat")}
                title="Simple flat concrete terrace roof with parapet"
                style={{
                  fontSize: "0.72rem",
                  padding: "4px 8px",
                  border: "none",
                  borderLeft: "1px solid var(--border)",
                  background: roofMode === "flat" ? "var(--accent)" : "transparent",
                  color: roofMode === "flat" ? "#fff" : "var(--text)",
                  cursor: "pointer",
                  fontWeight: roofMode === "flat" ? 700 : 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                🏢 Flat
              </button>
            </div>
            <button
              onClick={handleToggleLabels}
              style={{
                fontSize: "0.74rem",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: showLabels ? "var(--accent)" : "var(--surface)",
                color: showLabels ? "#fff" : "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Tag size={12} /> Labels
            </button>
            <button
              onClick={handleToggleWireframe}
              style={{
                fontSize: "0.74rem",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: wireframe ? "var(--accent)" : "var(--surface)",
                color: wireframe ? "#fff" : "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Wireframe
            </button>
          </div>
        </div>

        {/* Right: Camera Presets & Download */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => handleCameraPreset("reset")}
            title="Perspective View"
            style={{
              fontSize: "0.74rem",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Perspective
          </button>
          <button
            onClick={() => handleCameraPreset("top")}
            title="Top Floorplan View"
            style={{
              fontSize: "0.74rem",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Top View
          </button>
          <button
            onClick={() => handleCameraPreset("front")}
            title="Front Facade View"
            style={{
              fontSize: "0.74rem",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            Front View
          </button>

          {modelUrl && (
            <a
              href={modelUrl}
              download={`${plan?.title || "buildwise_plan"}.glb`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.74rem",
                padding: "4px 10px",
                borderRadius: "6px",
                background: "var(--accent)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              <Download size={13} />
              GLB
            </a>
          )}

          {/* 🎨 Open Design Studio Button */}
          <button
            onClick={handleOpenDesignStudio}
            disabled={openingStudio}
            title="Open Interactive Interior Design Studio (Wall Painting & Furniture Placement)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.74rem",
              padding: "4px 12px",
              borderRadius: "6px",
              border: "none",
              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
              color: "#fff",
              cursor: openingStudio ? "wait" : "pointer",
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(139, 92, 246, 0.35)",
              transition: "transform 0.15s ease",
            }}
          >
            <Sparkles size={13} />
            {openingStudio ? "Opening Studio..." : "🎨 Open Design Studio"}
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div style={{ position: "relative", width: "100%", height: "540px" }}>
        {/* Three.js Canvas */}
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* CORNER ROOM SELECTOR PANEL ("Options in the corner for what kind of room you want") */}
        {roomsList.length > 0 && !loading && (
          <div style={{
            position: "absolute",
            top: "14px",
            left: "14px",
            background: "rgba(var(--surface-rgb, 33, 31, 28), 0.88)",
            backgroundColor: "var(--surface)",
            backdropFilter: "blur(10px)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "10px",
            width: "240px",
            maxHeight: "360px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            zIndex: 5,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "6px",
            }}>
              <span style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}>
                <Sparkles size={14} color="var(--accent)" />
                Select Room to View in 3D:
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                {roomsList.length} rooms
              </span>
            </div>

            {/* Room Category Quick Filters */}
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { id: "all", label: "All" },
                { id: "bed", label: "Beds" },
                { id: "living", label: "Living" },
                { id: "service", label: "Kitchen/Bath" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRoomFilter(f.id)}
                  style={{
                    flex: 1,
                    fontSize: "0.66rem",
                    padding: "3px 4px",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: roomFilter === f.id ? "var(--accent)" : "var(--surface-2)",
                    color: roomFilter === f.id ? "#fff" : "var(--text-soft)",
                    fontWeight: roomFilter === f.id ? 700 : 500,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Corner Roof Type Switcher */}
            <div
              style={{
                background: "var(--surface-2)",
                borderRadius: "8px",
                padding: "6px 8px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text)" }}>Roof Type:</span>
                <span style={{ fontSize: "0.62rem", color: "var(--accent)", fontWeight: 600 }}>Try both & choose</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                <button
                  onClick={() => handleSetRoofMode("none")}
                  style={{
                    padding: "4px 2px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: roofMode === "none" ? "var(--accent)" : "transparent",
                    background: roofMode === "none" ? "var(--accent)" : "var(--surface)",
                    color: roofMode === "none" ? "#fff" : "var(--text)",
                    fontSize: "0.65rem",
                    cursor: "pointer",
                    fontWeight: roofMode === "none" ? 700 : 500,
                  }}
                >
                  No Roof
                </button>
                <button
                  onClick={() => handleSetRoofMode("tiles")}
                  title="Traditional Mangalore clay tiles roof"
                  style={{
                    padding: "4px 2px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: roofMode === "tiles" ? "var(--accent)" : "transparent",
                    background: roofMode === "tiles" ? "var(--accent)" : "var(--surface)",
                    color: roofMode === "tiles" ? "#fff" : "var(--text)",
                    fontSize: "0.65rem",
                    cursor: "pointer",
                    fontWeight: roofMode === "tiles" ? 700 : 500,
                  }}
                >
                  🏡 Tiles
                </button>
                <button
                  onClick={() => handleSetRoofMode("flat")}
                  title="Simple flat terrace roof with parapet"
                  style={{
                    padding: "4px 2px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: roofMode === "flat" ? "var(--accent)" : "transparent",
                    background: roofMode === "flat" ? "var(--accent)" : "var(--surface)",
                    color: roofMode === "flat" ? "#fff" : "var(--text)",
                    fontSize: "0.65rem",
                    cursor: "pointer",
                    fontWeight: roofMode === "flat" ? 700 : 500,
                  }}
                >
                  🏢 Flat
                </button>
              </div>
            </div>

            {/* Room List Buttons */}
            <div style={{
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              paddingRight: "2px",
            }}>
              <button
                onClick={() => handleSelectRoom(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: selectedRoomId === null ? "var(--accent)" : "transparent",
                  background: selectedRoomId === null ? "rgba(185, 104, 72, 0.15)" : "var(--surface-2)",
                  color: "var(--text)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.74rem",
                  fontWeight: selectedRoomId === null ? 700 : 500,
                }}
              >
                <span>🏠 Full House Overview</span>
                {selectedRoomId === null && <CheckCircle2 size={13} color="var(--accent)" />}
              </button>

              {filteredRooms.map((rm) => {
                const isSelected = selectedRoomId === rm.id;
                return (
                  <button
                    key={rm.id}
                    onClick={() => handleSelectRoom(rm)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--accent)" : "transparent",
                      background: isSelected ? "var(--accent)" : "var(--surface-2)",
                      color: isSelected ? "#ffffff" : "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.74rem",
                      fontWeight: isSelected ? 700 : 500,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{getRoomEmoji(rm.type)}</span>
                      <span>{rm.name}</span>
                    </div>
                    <span style={{
                      fontSize: "0.68rem",
                      color: isSelected ? "rgba(255,255,255,0.85)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono, monospace)",
                    }}>
                      {rm.width_ft}′×{rm.height_ft}′
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Room Info Badge */}
        {selectedRoomObj && (
          <div style={{
            position: "absolute",
            bottom: "14px",
            left: "14px",
            background: "var(--surface)",
            border: "2px solid var(--accent)",
            borderRadius: "10px",
            padding: "8px 14px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            zIndex: 5,
          }}>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
                {getRoomEmoji(selectedRoomObj.type)} {selectedRoomObj.name}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-soft)", marginTop: "2px" }}>
                Dimensions: <strong>{selectedRoomObj.width_ft} ft × {selectedRoomObj.height_ft} ft</strong> • Area: <strong>{selectedRoomObj.area_sqft} sq.ft</strong>
              </div>
            </div>
            <button
              onClick={() => handleSelectRoom(null)}
              style={{
                fontSize: "0.7rem",
                padding: "4px 8px",
                borderRadius: "6px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Reset View
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            zIndex: 10,
          }}>
            <RefreshCw size={28} style={{ animation: "spin 1s linear infinite", marginBottom: "8px" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Building 3D Architectural Model with Room Labels...</span>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(239, 68, 68, 0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            padding: "20px",
            zIndex: 10,
          }}>
            <strong>Error Generating 3D Model</strong>
            <span style={{ fontSize: "0.8rem", marginTop: "4px" }}>{error}</span>
          </div>
        )}

        {/* Hint Pill */}
        <div style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "3px 10px",
          fontSize: "0.68rem",
          color: "var(--text-muted)",
          pointerEvents: "none",
        }}>
          Left-click: Rotate • Right-click: Pan • Scroll: Zoom • Click Room on Left to Inspect
        </div>
      </div>
    </div>
  );
}
