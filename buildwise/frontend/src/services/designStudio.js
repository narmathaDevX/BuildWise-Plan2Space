/**
 * Service to bridge BuildWise 2D architectural plans with Plan2Space 3D Design Studio.
 */

let rawStudioUrl = import.meta.env.VITE_DESIGN_STUDIO_URL || "http://localhost:8001";
if (rawStudioUrl && !rawStudioUrl.includes(".") && !rawStudioUrl.includes("localhost")) {
  rawStudioUrl = `${rawStudioUrl}.onrender.com`;
}
if (!rawStudioUrl.startsWith("http://") && !rawStudioUrl.startsWith("https://")) {
  rawStudioUrl = `https://${rawStudioUrl}`;
}
export const DESIGN_STUDIO_BASE_URL = rawStudioUrl;

const FT_TO_M = 0.3048;

/**
 * Converts a BuildWise plan into Plan2Space 3D geometry and opens the Design Studio.
 */
export async function launchDesignStudio(plan) {
  if (!plan) {
    alert("No plan selected to open in Design Studio.");
    return;
  }

  const roomsRaw = plan?.floors?.[0]?.rooms || plan?.rooms || [];
  if (!roomsRaw.length) {
    alert("This plan does not have drawable room geometry.");
    return;
  }

  const walls = [];
  const rooms = [];

  const rects = [];
  roomsRaw.forEach((r, idx) => {
    const rx = +(Number(r.x || 0) * FT_TO_M).toFixed(3);
    const ry = +(Number(r.y || 0) * FT_TO_M).toFixed(3);
    const rw = +(Number(r.width || 0) * FT_TO_M).toFixed(3);
    const rh = +(Number(r.height || 0) * FT_TO_M).toFixed(3);

    if (rw <= 0 || rh <= 0) return;

    const minX = +rx;
    const maxX = +(+rx + +rw).toFixed(3);
    const minY = +ry;
    const maxY = +(+ry + +rh).toFixed(3);

    rects.push({ minX, maxX, minY, maxY, name: r.name || `Room ${idx + 1}` });

    rooms.push({
      id: `rm_${r.id || idx}`,
      name: r.name || `Room ${idx + 1}`,
      polygon: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
      area_sqm: +(rw * rh).toFixed(2),
    });
  });

  // Extract non-overlapping, deduplicated wall segments along horizontal and vertical lines
  let wallCounter = 0;

  // 1. Horizontal lines
  const ySet = new Set();
  rects.forEach((r) => { ySet.add(r.minY); ySet.add(r.maxY); });
  const yCoords = Array.from(ySet).sort((a, b) => a - b);

  yCoords.forEach((y) => {
    const xSet = new Set();
    rects.forEach((r) => {
      if (Math.abs(r.minY - y) < 0.01 || Math.abs(r.maxY - y) < 0.01) {
        xSet.add(r.minX);
        xSet.add(r.maxX);
      }
    });
    const xs = Array.from(xSet).sort((a, b) => a - b);

    for (let i = 0; i < xs.length - 1; i++) {
      const x1 = xs[i];
      const x2 = xs[i + 1];
      if (x2 - x1 < 0.05) continue;

      const midX = (x1 + x2) / 2.0;
      let touchCount = 0;
      rects.forEach((r) => {
        if (r.minX <= midX && midX <= r.maxX) {
          if (Math.abs(r.minY - y) < 0.01 || Math.abs(r.maxY - y) < 0.01) {
            touchCount++;
          }
        }
      });

      if (touchCount > 0) {
        const isExterior = (touchCount === 1);
        walls.push({
          id: `w_bw_${wallCounter++}`,
          start: { x: x1, y: y },
          end: { x: x2, y: y },
          thickness: isExterior ? 0.23 : 0.15,
          height: 2.8,
          is_exterior: isExterior,
          source: "measured",
        });
      }
    }
  });

  // 2. Vertical lines
  const xSet = new Set();
  rects.forEach((r) => { xSet.add(r.minX); xSet.add(r.maxX); });
  const xCoords = Array.from(xSet).sort((a, b) => a - b);

  xCoords.forEach((x) => {
    const ySet = new Set();
    rects.forEach((r) => {
      if (Math.abs(r.minX - x) < 0.01 || Math.abs(r.maxX - x) < 0.01) {
        ySet.add(r.minY);
        ySet.add(r.maxY);
      }
    });
    const ys = Array.from(ySet).sort((a, b) => a - b);

    for (let i = 0; i < ys.length - 1; i++) {
      const y1 = ys[i];
      const y2 = ys[i + 1];
      if (y2 - y1 < 0.05) continue;

      const midY = (y1 + y2) / 2.0;
      let touchCount = 0;
      rects.forEach((r) => {
        if (r.minY <= midY && midY <= r.maxY) {
          if (Math.abs(r.minX - x) < 0.01 || Math.abs(r.maxX - x) < 0.01) {
            touchCount++;
          }
        }
      });

      if (touchCount > 0) {
        const isExterior = (touchCount === 1);
        walls.push({
          id: `w_bw_${wallCounter++}`,
          start: { x: x, y: y1 },
          end: { x: x, y: y2 },
          thickness: isExterior ? 0.23 : 0.15,
          height: 2.8,
          is_exterior: isExterior,
          source: "measured",
        });
      }
    }
  });

  const geom = {
    name: `BuildWise: ${plan.name || plan.title || "Architectural Plan"}`,
    walls: walls,
    openings: walls.length > 0 ? [
      {
        id: "op_main",
        wall_id: walls[0].id,
        type: "door",
        position_along_wall: 0.5,
        width: 0.9,
        height: 2.1,
        sill_height: 0.0,
      }
    ] : [],
    rooms: rooms,
    scale: { pixels_per_metre: 50.0, source: "measured", confidence: 1.0 },
  };

  try {
    // 1. Create floor plan in Plan2Space 3D
    const resPlan = await fetch(`${DESIGN_STUDIO_BASE_URL}/api/v1/floor-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: geom.name,
        geometry: geom,
      }),
    });

    if (!resPlan.ok) {
      const err = await resPlan.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned HTTP ${resPlan.status}`);
    }

    const savedPlan = await resPlan.json();

    // 2. Start 3D conversion job
    const resConv = await fetch(`${DESIGN_STUDIO_BASE_URL}/api/v1/conversions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floor_plan_id: savedPlan.id,
        parameters: {
          default_wall_height: 2.8,
          exterior_wall_thickness: 0.23,
          include_floor: true,
          include_roof: true,
          export_formats: ["glb"],
        },
      }),
    });

    if (!resConv.ok) {
      const err = await resConv.json().catch(() => ({}));
      throw new Error(err.detail || `Conversion start returned HTTP ${resConv.status}`);
    }

    const job = await resConv.json();

    // 3. Poll briefly for job completion (typically takes ~200-400ms)
    let isComplete = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const resCheck = await fetch(`${DESIGN_STUDIO_BASE_URL}/api/v1/conversions/${job.id}`);
      if (resCheck.ok) {
        const checkData = await resCheck.json();
        if (checkData.status === "completed") {
          isComplete = true;
          break;
        }
      }
    }

    // 4. Open Design Studio in a new tab with return_url
    const returnUrl = encodeURIComponent(window.location.href);
    const studioUrl = `${DESIGN_STUDIO_BASE_URL}/studio.html?conversion=${encodeURIComponent(job.id)}&return_url=${returnUrl}`;
    window.open(studioUrl, "_blank");
  } catch (err) {
    console.error("Failed to launch Design Studio:", err);
    alert(
      `Could not open Design Studio:\n${err.message}\n\nPlease verify Plan2Space 3D is running on port 8001.`
    );
  }
}
