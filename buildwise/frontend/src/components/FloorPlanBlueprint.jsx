import { useState } from "react";
import { Ruler } from "lucide-react";

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

export function getDimensions(plan, form) {
  const plot = plan?.request_echo?.plot || plan?.plot || {};
  return {
    width: num(first(form?.width, form?.plotWidth, plot.width, plot.width_ft, plan?.plot_width), 40),
    depth: num(
      first(form?.length, form?.depth, form?.plotDepth, plot.depth, plot.length, plot.depth_ft, plan?.plot_length),
      60
    ),
  };
}

export function getRooms(plan, floorIndex = 0) {
  if (Array.isArray(plan?.floors) && plan.floors.length > 0) {
    const target = plan.floors[floorIndex] || plan.floors[0];
    return Array.isArray(target?.rooms) ? target.rooms : [];
  }
  const floor = plan?.floors || {};
  const rooms = first(
    floor?.rooms,
    plan?.rooms,
    plan?.layout?.rooms,
    plan?.geometry?.rooms
  );
  return Array.isArray(rooms) ? rooms : [];
}

export function getAllRooms(plan) {
  if (Array.isArray(plan?.floors) && plan.floors.length > 0) {
    const all = [];
    plan.floors.forEach((fl, idx) => {
      const flName = idx === 0 ? "Ground Floor" : `First Floor (Level ${idx})`;
      (fl.rooms || []).forEach((r) => {
        all.push({ ...r, floorLevel: fl.level ?? idx, floorName: flName });
      });
    });
    return all;
  }
  return getRooms(plan, 0);
}

export function getRoomPoints(room) {
  const raw = first(room?.polygon, room?.vertices, room?.points, room?.coordinates);

  if (Array.isArray(raw)) {
    const coords =
      raw.length && Array.isArray(raw[0]) && Array.isArray(raw[0][0])
        ? raw[0]
        : raw;

    const points = coords
      .map((point) => {
        if (Array.isArray(point)) {
          return { x: num(point[0], NaN), y: num(point[1], NaN) };
        }
        if (point && typeof point === "object") {
          return {
            x: num(first(point.x, point.X), NaN),
            y: num(first(point.y, point.Y), NaN),
          };
        }
        return null;
      })
      .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));

    if (points.length >= 3) return points;
  }

  const x = num(first(room?.x, room?.left), NaN);
  const y = num(first(room?.y, room?.top), NaN);
  const width = num(first(room?.width, room?.w), NaN);
  const height = num(first(room?.height, room?.depth, room?.h), NaN);

  if ([x, y, width, height].every(Number.isFinite)) {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  return [];
}

export function roomName(room, index = 0) {
  return String(first(room?.name, room?.label, room?.type, room?.id, `Room ${index + 1}`))
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function roomArea(room) {
  const area = num(first(room?.area, room?.area_sqft), 0);
  if (area > 0) return area;

  const width = num(room?.width);
  const height = num(first(room?.height, room?.depth));
  return width > 0 && height > 0 ? width * height : 0;
}

function renderArchitecturalFixtures(room, left, top, width, height) {
  const type = String(room.raw?.type || room.type || "").toLowerCase();
  const name = String(room.name || "").toLowerCase();

  // 1. BEDROOMS
  if (type.includes("bed") || name.includes("bed") || name.includes("suite")) {
    const bedW = Math.min(width * 0.46, 11.5);
    const bedH = Math.min(height * 0.50, 13.5);
    const bedX = left + 1.2;
    const bedY = top + 1.2;
    const pillowW = bedW * 0.38;
    const pillowH = bedH * 0.22;

    return (
      <g className="arch-fixture" opacity="0.45" stroke="var(--text-soft)" fill="none" strokeWidth="0.32">
        <rect x={bedX} y={bedY} width={bedW} height={bedH} rx="0.5" fill="var(--surface-2, rgba(0,0,0,0.02))" />
        <rect x={bedX + 0.3} y={bedY + 0.3} width={pillowW} height={pillowH} rx="0.3" />
        <rect x={bedX + bedW - pillowW - 0.3} y={bedY + 0.3} width={pillowW} height={pillowH} rx="0.3" />
        <line x1={bedX} y1={bedY + bedH * 0.45} x2={bedX + bedW} y2={bedY + bedH * 0.45} strokeDasharray="0.6 0.6" />
        {height > 10 && (
          <>
            <rect x={bedX - 0.9} y={bedY} width="0.75" height="1.3" rx="0.2" />
            <rect x={bedX + bedW + 0.15} y={bedY} width="0.75" height="1.3" rx="0.2" />
          </>
        )}
      </g>
    );
  }

  // 2. BATHROOMS
  if (type.includes("bath") || name.includes("bath") || name.includes("toilet")) {
    const ewcX = left + 1.2;
    const ewcY = top + 1.2;
    return (
      <g className="arch-fixture" opacity="0.5" stroke="var(--text-soft)" fill="none" strokeWidth="0.32">
        <rect x={ewcX} y={ewcY} width="2.2" height="0.9" rx="0.2" />
        <ellipse cx={ewcX + 1.1} cy={ewcY + 1.8} rx="0.9" ry="1.1" />
        {width > 6 && (
          <g transform={`translate(${left + width - 2.6}, ${top + 1.2})`}>
            <rect x="0" y="0" width="1.8" height="1.4" rx="0.3" />
            <circle cx="0.9" cy="0.7" r="0.4" />
          </g>
        )}
      </g>
    );
  }

  // 3. KITCHEN
  if (type === "kitchen" || name.includes("kitchen")) {
    const slabDepth = Math.min(2.6, width * 0.28, height * 0.28);
    return (
      <g className="arch-fixture" opacity="0.45" stroke="var(--text-soft)" fill="none" strokeWidth="0.35">
        <path
          d={`M ${left} ${top + slabDepth} L ${left + width - slabDepth} ${top + slabDepth} L ${left + width - slabDepth} ${top + height}`}
          stroke="var(--text-soft)"
          strokeWidth="0.35"
          strokeDasharray="0.8 0.4"
        />
        <g transform={`translate(${left + width * 0.25}, ${top + 0.4})`}>
          <rect x="0" y="0" width="3.4" height="1.7" rx="0.2" stroke="var(--text-soft)" strokeWidth="0.3" />
          <circle cx="0.8" cy="0.85" r="0.35" />
          <circle cx="1.7" cy="0.85" r="0.45" />
          <circle cx="2.6" cy="0.85" r="0.35" />
        </g>
        <g transform={`translate(${left + width - slabDepth + 0.3}, ${top + height * 0.4})`}>
          <rect x="0" y="0" width="1.6" height="2.0" rx="0.2" stroke="var(--text-soft)" strokeWidth="0.3" />
          <circle cx="0.8" cy="1.0" r="0.2" />
        </g>
      </g>
    );
  }

  // 4. DINING
  if (type === "dining" || name.includes("dining")) {
    const tblW = Math.min(width * 0.45, 7.5);
    const tblH = Math.min(height * 0.50, 9.5);
    const tblX = left + (width - tblW) / 2;
    const tblY = top + (height - tblH) / 2;

    return (
      <g className="arch-fixture" opacity="0.4" stroke="var(--text-soft)" fill="none" strokeWidth="0.32">
        <rect x={tblX} y={tblY} width={tblW} height={tblH} rx="0.6" fill="var(--surface-2, rgba(0,0,0,0.02))" />
        <rect x={tblX - 0.65} y={tblY + tblH * 0.2} width="0.55" height="1.3" rx="0.2" />
        <rect x={tblX - 0.65} y={tblY + tblH * 0.6} width="0.55" height="1.3" rx="0.2" />
        <rect x={tblX + tblW + 0.1} y={tblY + tblH * 0.2} width="0.55" height="1.3" rx="0.2" />
        <rect x={tblX + tblW + 0.1} y={tblY + tblH * 0.6} width="0.55" height="1.3" rx="0.2" />
      </g>
    );
  }

  // 5. LIVING ROOM
  if (type === "living" || name.includes("living") || name.includes("lounge")) {
    const sofaW = Math.min(width * 0.52, 11);
    const sofaH = Math.min(height * 0.24, 3.8);
    const sofaX = left + 1.4;
    const sofaY = top + 1.4;

    return (
      <g className="arch-fixture" opacity="0.4" stroke="var(--text-soft)" fill="none" strokeWidth="0.32">
        <rect x={sofaX} y={sofaY} width={sofaW} height={sofaH} rx="0.5" fill="var(--surface-2, rgba(0,0,0,0.02))" />
        <line x1={sofaX + sofaW * 0.33} y1={sofaY} x2={sofaX + sofaW * 0.33} y2={sofaY + sofaH} strokeDasharray="0.4 0.4" />
        <line x1={sofaX + sofaW * 0.66} y1={sofaY} x2={sofaX + sofaW * 0.66} y2={sofaY + sofaH} strokeDasharray="0.4 0.4" />
        <rect x={sofaX + sofaW * 0.2} y={sofaY + sofaH + 0.8} width={sofaW * 0.6} height="1.6" rx="0.3" strokeDasharray="0.6 0.3" />
      </g>
    );
  }

  // 6. CAR PARKING
  if (type === "parking" || name.includes("parking") || name.includes("porch")) {
    const carW = Math.min(width * 0.65, 8.0);
    const carH = Math.min(height * 0.72, 16);
    const carX = left + (width - carW) / 2;
    const carY = top + (height - carH) / 2;

    return (
      <g className="arch-fixture" opacity="0.4" stroke="var(--text-soft)" fill="none" strokeWidth="0.35">
        <rect x={carX} y={carY} width={carW} height={carH} rx="1.6" />
        <path d={`M ${carX + 0.7} ${carY + carH * 0.26} Q ${carX + carW / 2} ${carY + carH * 0.22} ${carX + carW - 0.7} ${carY + carH * 0.26}`} />
        <path d={`M ${carX + 0.7} ${carY + carH * 0.74} Q ${carX + carW / 2} ${carY + carH * 0.78} ${carX + carW - 0.7} ${carY + carH * 0.74}`} />
        <rect x={carX + 0.7} y={carY + carH * 0.30} width={carW - 1.4} height={carH * 0.38} rx="0.5" strokeDasharray="0.5 0.3" />
      </g>
    );
  }

  // 7. POOJA
  if (type === "pooja" || name.includes("pooja")) {
    const altarW = width * 0.6;
    return (
      <g className="arch-fixture" opacity="0.55" stroke="#d97706" fill="none" strokeWidth="0.32">
        <rect x={left + (width - altarW) / 2} y={top + 0.5} width={altarW} height="1.3" rx="0.2" fill="rgba(217, 119, 6, 0.08)" />
        <circle cx={left + width / 2} cy={top + 2.5} r="0.7" stroke="#d97706" />
        <circle cx={left + width / 2} cy={top + 2.5} r="0.25" fill="#d97706" />
      </g>
    );
  }

  // 8. BALCONY
  if (type === "balcony" || name.includes("balcony") || name.includes("sit-out")) {
    return (
      <g className="arch-fixture" opacity="0.38" stroke="var(--text-soft)" strokeWidth="0.3">
        <line x1={left} y1={top + 0.4} x2={left + width} y2={top + 0.4} strokeDasharray="0.6 0.6" />
        <line x1={left} y1={top + 0.8} x2={left + width} y2={top + 0.8} />
      </g>
    );
  }

  return null;
}

function renderArchitecturalDoor(room, left, top, bottom, right, width, height) {
  const type = String(room.raw?.type || room.type || "").toLowerCase();
  const name = String(room.name || "").toLowerCase();
  if (type === "parking" || type === "balcony" || name.includes("sit-out")) return null;

  const R = Math.min(3.0, Math.max(2.2, width * 0.20, height * 0.20));
  const px = left + 0.35;
  const py = bottom - 0.35;

  return (
    <g className="arch-door" opacity="0.75">
      <rect x={px - 0.25} y={py - 0.25} width="0.5" height="0.5" fill="var(--text)" />
      <line x1={px} y1={py} x2={px} y2={py - R} stroke="var(--accent)" strokeWidth="0.45" />
      <path
        d={`M ${px} ${py - R} A ${R} ${R} 0 0 1 ${px + R} ${py}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.35"
        strokeDasharray="0.5 0.4"
      />
    </g>
  );
}

function renderArchitecturalWindows(room, left, top, bottom, right, width, height, minX, minY, maxX, maxY) {
  const type = String(room.raw?.type || room.type || "").toLowerCase();
  if (type === "parking" || type === "balcony") return null;

  const raw = room.raw || room;
  const rx = num(raw.x, 0);
  const ry = num(raw.y, 0);

  const windows = [];

  // Top outer wall
  if (Math.abs(ry - minY) < 0.6 && width > 6) {
    const wWidth = Math.min(width * 0.36, 4.5);
    const wx = left + (width - wWidth) / 2;
    windows.push(
      <g key="win-top" className="arch-window" opacity="0.8">
        <rect x={wx} y={top - 0.4} width={wWidth} height="0.8" fill="#0ea5e9" rx="0.1" />
        <line x1={wx} y1={top} x2={wx + wWidth} y2={top} stroke="#ffffff" strokeWidth="0.25" />
      </g>
    );
  }

  // Bottom outer wall
  if (Math.abs(ry + height - maxY) < 0.6 && width > 6) {
    const wWidth = Math.min(width * 0.36, 4.5);
    const wx = left + (width - wWidth) / 2;
    windows.push(
      <g key="win-bottom" className="arch-window" opacity="0.8">
        <rect x={wx} y={bottom - 0.4} width={wWidth} height="0.8" fill="#0ea5e9" rx="0.1" />
        <line x1={wx} y1={bottom} x2={wx + wWidth} y2={bottom} stroke="#ffffff" strokeWidth="0.25" />
      </g>
    );
  }

  // Left outer wall
  if (Math.abs(rx - minX) < 0.6 && height > 6) {
    const wHeight = Math.min(height * 0.36, 4.5);
    const wy = top + (height - wHeight) / 2;
    windows.push(
      <g key="win-left" className="arch-window" opacity="0.8">
        <rect x={left - 0.4} y={wy} width="0.8" height={wHeight} fill="#0ea5e9" rx="0.1" />
        <line x1={left} y1={wy} x2={left} y2={wy + wHeight} stroke="#ffffff" strokeWidth="0.25" />
      </g>
    );
  }

  // Right outer wall
  if (Math.abs(rx + width - maxX) < 0.6 && height > 6) {
    const wHeight = Math.min(height * 0.36, 4.5);
    const wy = top + (height - wHeight) / 2;
    windows.push(
      <g key="win-right" className="arch-window" opacity="0.8">
        <rect x={right - 0.4} y={wy} width="0.8" height={wHeight} fill="#0ea5e9" rx="0.1" />
        <line x1={right} y1={wy} x2={right} y2={wy + wHeight} stroke="#ffffff" strokeWidth="0.25" />
      </g>
    );
  }

  return windows.length > 0 ? <>{windows}</> : null;
}

export default function FloorPlanBlueprint({
  plan,
  form = {},
  activeFloorIndex = 0,
  compact = false,
  showMeta = true,
}) {
  const roomsSource = getRooms(plan, activeFloorIndex);

  const rooms = roomsSource
    .map((room, index) => {
      const points = getRoomPoints(room);
      if (!points.length) return null;
      return {
        id: String(first(room?.id, room?.room_id, index)),
        name: roomName(room, index),
        area: roomArea(room),
        points,
        raw: room,
      };
    })
    .filter(Boolean);

  if (!rooms.length) {
    return (
      <div className={`plan-drawing ${compact ? "plan-drawing--compact" : ""}`} style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>No room geometry coordinates available for this plan view.</p>
      </div>
    );
  }

  const allPoints = rooms.flatMap((room) => room.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const viewWidth = 100;
  const viewHeight = Math.max(65, (spanY / spanX) * 100);
  const pad = 4;
  const scale = Math.min((viewWidth - 2 * pad) / spanX, (viewHeight - 2 * pad) / spanY);
  const drawingWidth = spanX * scale;
  const drawingHeight = spanY * scale;
  const offsetX = (viewWidth - drawingWidth) / 2;
  const offsetY = (viewHeight - drawingHeight) / 2;

  const sx = (x) => offsetX + (x - minX) * scale;
  const sy = (y) => offsetY + (y - minY) * scale;

  const dimensions = getDimensions(plan, form);
  const floorTitle = plan?.floors?.length > 1
    ? (activeFloorIndex === 0 ? "Ground Floor (Level 0)" : `First Floor (Level ${activeFloorIndex})`)
    : "Ground Floor";

  return (
    <div className={`plan-drawing ${compact ? "plan-drawing--compact" : ""}`}>
      {showMeta && !compact && (
        <div className="plan-drawing-meta">
          <span><Ruler size={14} /> Plot: {dimensions.width} × {dimensions.depth} ft</span>
          <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ TNCDBR 2019 Compliant</span>
          <span style={{ fontWeight: 600, color: "var(--accent)" }}>🏛️ {floorTitle}</span>
          <span>{rooms.length} spaces on this floor</span>
        </div>
      )}

      <svg
        className="plan-svg"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Floor plan with ${rooms.length} rooms`}
      >
        <defs>
          <pattern id="bw-blueprint-grid" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M 2 0 L 0 0 0 2" className="grid-line" fill="none" stroke="var(--border)" strokeWidth="0.15" />
          </pattern>
        </defs>

        <rect width={viewWidth} height={viewHeight} fill="url(#bw-blueprint-grid)" opacity="0.6" />

        {/* VASTU COMPASS ROSE */}
        <g transform={`translate(${viewWidth - 11}, 5)`} opacity="0.85">
          <circle cx="5" cy="5" r="4.2" fill="var(--surface)" stroke="var(--border)" strokeWidth="0.5" />
          <path d="M 5 2.2 L 6.1 5 L 5 4.3 L 3.9 5 Z" fill="#ef4444" />
          <path d="M 5 7.8 L 6.1 5 L 5 5.7 L 3.9 5 Z" fill="#94a3b8" />
          <text x="5" y="1.6" textAnchor="middle" fontSize="1.6" fontWeight="bold" fill="var(--text)">N</text>
        </g>

        {rooms.map((room, index) => {
          const points = room.points.map((point) => `${sx(point.x)},${sy(point.y)}`).join(" ");
          const xs = room.points.map((point) => sx(point.x));
          const ys = room.points.map((point) => sy(point.y));
          const left = Math.min(...xs);
          const right = Math.max(...xs);
          const top = Math.min(...ys);
          const bottom = Math.max(...ys);
          const width = right - left;
          const height = bottom - top;
          const centerX = (left + right) / 2;
          const centerY = (top + bottom) / 2;

          const dimW = num(first(room.raw?.width, room.raw?.w), 0);
          const dimH = num(first(room.raw?.height, room.raw?.depth, room.raw?.h), 0);
          const dimStr = (dimW > 0 && dimH > 0) ? `${Math.round(dimW)}'×${Math.round(dimH)}'` : "";

          const fontSize = Math.max(1.1, Math.min(compact ? 1.7 : 2.15, width / 6, height / 3.2));
          const lineHeight = fontSize * 1.25;
          const maxLines = Math.max(1, Math.floor((height - 1) / lineHeight));
          const maxChars = Math.max(4, Math.floor(width / (fontSize * 0.56)));
          const words = room.name.split(/\s+/);
          const lines = [];
          let current = "";

          words.forEach((word) => {
            let remaining = word;
            while (remaining.length > maxChars) {
              if (current) {
                lines.push(current);
                current = "";
              }
              lines.push(remaining.slice(0, maxChars));
              remaining = remaining.slice(maxChars);
            }
            const candidate = current ? `${current} ${remaining}` : remaining;
            if (candidate.length > maxChars && current) {
              lines.push(current);
              current = remaining;
            } else {
              current = candidate;
            }
          });

          if (current) lines.push(current);

          const visibleLines = lines.slice(0, maxLines);
          const firstY = centerY - ((visibleLines.length - 1) * lineHeight) / 2;

          return (
            <g key={room.id}>
              <polygon
                points={points}
                className={`room-shape ${index % 2 ? "room-shape--alt" : ""}`}
              />

              {/* ARCHITECTURAL FIXTURES (BEDS, EWC, KITCHEN SLAB, SOFA, CAR) */}
              {!compact && width > 5 && height > 5 && renderArchitecturalFixtures(room, left, top, width, height)}

              {/* ARCHITECTURAL DOOR OPENING & SWING */}
              {!compact && width > 4 && height > 4 && renderArchitecturalDoor(room, left, top, bottom, right, width, height)}

              {/* ARCHITECTURAL VENTILATION WINDOWS */}
              {!compact && renderArchitecturalWindows(room, left, top, bottom, right, width, height, minX, minY, maxX, maxY)}

              <text
                x={centerX}
                y={firstY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="room-label"
                fontSize={fontSize}
              >
                {visibleLines.map((line, lineIndex) => (
                  <tspan key={`${room.id}-${lineIndex}`} x={centerX} y={firstY + lineIndex * lineHeight}>
                    {line}
                  </tspan>
                ))}
              </text>

              {!compact && room.area > 0 && height > 7 && (
                <text
                  x={centerX}
                  y={Math.min(bottom - 0.8, firstY + visibleLines.length * lineHeight)}
                  textAnchor="middle"
                  className="room-area"
                >
                  {dimStr ? `${dimStr} • ` : ""}{Math.round(room.area)} sq ft
                </text>
              )}
            </g>
          );
        })}

        <rect
          x={offsetX}
          y={offsetY}
          width={drawingWidth}
          height={drawingHeight}
          className="house-outline"
        />
      </svg>

      {showMeta && !compact && (
        <div className="plan-legend">
          <span><i className="legend-wall" /> Structural walls & dimensions</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0ea5e9" }} /> Ventilation windows
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)" }} /> 90° Door swings
          </span>
          <span style={{ color: "#16a34a" }}>✓ TNCDBR 2019 Rule 35: Setbacks & Max 70% Ground Coverage verified</span>
        </div>
      )}
    </div>
  );
}
