import hashlib
import math
import random
import time
from typing import Any


SUPPORTED_ROOM_TYPES = {
    "living",
    "kitchen",
    "dining",
    "master_bedroom",
    "bedroom",
    "attached_bathroom",
    "bathroom",
    "pooja",
    "utility",
    "parking",
    "balcony",
    "store",
    "study",
    "dressing",
    "staircase",
}

HABITABLE_TYPES = {"living", "dining", "master_bedroom", "bedroom", "study"}
WET_TYPES = {"kitchen", "attached_bathroom", "bathroom", "utility"}

ARCHETYPE_CONFIGS = [
    {
        "id": "vastu_classic",
        "title": "Traditional Vastu Courtyard Layout",
        "concept": "Street-facing living, central Brahmasthan dining hall, East-facing kitchen, and South-West master suite.",
    },
    {
        "id": "open_great_room",
        "title": "Contemporary Open Great-Room Layout",
        "concept": "Integrated social great-room, modern island kitchen, split bedroom suites with rear master garden outlook.",
    },
    {
        "id": "split_wing_generational",
        "title": "Split-Wing Generational Suite Layout",
        "concept": "Ground-floor elderly / guest bedroom at front, central family gathering space, and private master wing at rear.",
    },
    {
        "id": "linear_breezeway",
        "title": "Linear Breezeway & Central Gallery Suite Layout",
        "concept": "Cross-ventilated dining breezeway, dedicated service corridor, and balanced dual master bedroom suites.",
    },
]



class Envelope:
    def __init__(self, min_x: float, min_y: float, max_x: float, max_y: float):
        self.min_x = round(min_x, 2)
        self.min_y = round(min_y, 2)
        self.max_x = round(max_x, 2)
        self.max_y = round(max_y, 2)
        self.width = max(0.0, round(self.max_x - self.min_x, 2))
        self.height = max(0.0, round(self.max_y - self.min_y, 2))
        self.area = round(self.width * self.height, 2)

    @property
    def is_valid(self) -> bool:
        return self.width > 5.0 and self.height > 5.0 and self.area > 50.0


def compute_envelope(plot: dict[str, float], road_side: str, setbacks: dict[str, float]) -> Envelope:
    pw = float(plot.get("width", 40.0))
    pd = float(plot.get("depth", 60.0))

    front = float(setbacks.get("front", 5.0))
    rear = float(setbacks.get("rear", 3.0))
    left = float(setbacks.get("left", 3.0))
    right = float(setbacks.get("right", 3.0))

    rs = road_side.upper()
    if rs == "N":
        min_x = left
        max_x = pw - right
        min_y = front
        max_y = pd - rear
    elif rs == "S":
        min_x = left
        max_x = pw - right
        min_y = rear
        max_y = pd - front
    elif rs == "W":
        min_x = front
        max_x = pw - rear
        min_y = right
        max_y = pd - left
    elif rs == "E":
        min_x = rear
        max_x = pw - front
        min_y = left
        max_y = pd - right
    else:
        min_x = left
        max_x = pw - right
        min_y = front
        max_y = pd - rear

    return Envelope(min_x, min_y, max_x, max_y)


class RectRoom:
    def __init__(self, id: str, type: str, name: str, x: float, y: float, width: float, height: float):
        self.id = id
        self.type = type
        self.name = name
        self.x = round(x, 2)
        self.y = round(y, 2)
        self.width = round(width, 2)
        self.height = round(height, 2)
        self.area = round(self.width * self.height, 2)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "area": self.area,
            "polygon": [
                [self.x, self.y],
                [round(self.x + self.width, 2), self.y],
                [round(self.x + self.width, 2), round(self.y + self.height, 2)],
                [self.x, round(self.y + self.height, 2)],
            ],
        }


def compute_plan_hash(floors: list[dict[str, Any]]) -> str:
    parts = []
    for fl in floors:
        lvl = fl.get("level", 0)
        for r in sorted(fl.get("rooms", []), key=lambda x: x["id"]):
            parts.append(f"{lvl}:{r['id']}:{r['x']:.1f}:{r['y']:.1f}:{r['width']:.1f}:{r['height']:.1f}")
    signature = ";".join(parts)
    return "plan_" + hashlib.sha256(signature.encode("utf-8")).hexdigest()[:12]


class FloorPlanSolver:
    """Deterministic, constraint-based residential floor plan layout generator."""

    def __init__(self, request: dict[str, Any], options: dict[str, Any] | None = None):
        self.request = request
        self.options = options or {}
        self.plot = request.get("plot", {})
        self.road_side = str(request.get("road_side", "N")).upper()
        self.setbacks = request.get("setbacks", {})
        self.floors_count = max(1, min(4, int(request.get("floors", 1))))
        self.raw_rooms = request.get("rooms", [])

        num_alt = self.options.get("num_alternatives") or request.get("solver_options", {}).get("num_alternatives", 3)
        self.num_alternatives = max(1, min(6, int(num_alt)))
        seed_val = self.options.get("seed") or request.get("solver_options", {}).get("seed", 42)
        self.seed = int(seed_val)

        self.warnings: list[str] = []
        self.conflicts: list[dict[str, Any]] = []

    def validate_request_syntax(self) -> None:
        pw = float(self.plot.get("width", 0))
        pd = float(self.plot.get("depth", 0))

        if pw < 15.0 or pw > 300.0 or pd < 15.0 or pd > 300.0:
            raise ValueError(f"Plot dimensions must be between 15 and 300 ft. Received {pw} x {pd} ft.")

        if self.floors_count < 1 or self.floors_count > 4:
            raise ValueError(f"Floors must be between 1 and 4. Received {self.floors_count}.")

        if len(self.raw_rooms) > 40:
            raise ValueError(f"Exceeded maximum room limit of 40 rooms. Received {len(self.raw_rooms)}.")

        known_ids = {r.get("id") for r in self.raw_rooms}
        for r in self.raw_rooms:
            rtype = r.get("type")
            if rtype not in SUPPORTED_ROOM_TYPES:
                raise ValueError(f"Unsupported room type: '{rtype}'. Supported types: {sorted(SUPPORTED_ROOM_TYPES)}")
            if float(r.get("min_area", 0)) <= 0:
                raise ValueError(f"Room '{r.get('id')}' must have min_area > 0.")
            att = r.get("attached_to")
            if att and att not in known_ids:
                raise ValueError(f"Room '{r.get('id')}' attached_to '{att}' does not exist.")

    def solve(self) -> dict[str, Any]:
        start_time = time.time()
        self.validate_request_syntax()

        envelope = compute_envelope(self.plot, self.road_side, self.setbacks)
        if not envelope.is_valid:
            return {
                "plans": [],
                "conflicts": [
                    {
                        "code": "INVALID_ENVELOPE",
                        "message": f"Setbacks consume the plot. Envelope dimensions ({envelope.width} x {envelope.height} ft) leave insufficient space.",
                        "suggestion": "Reduce front/rear/side setback margins.",
                    }
                ],
                "warnings": self.warnings,
                "meta": {
                    "seed": self.seed,
                    "engine": "BuildWise Pure-Python Constraint Solver v1.0",
                    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "elapsed_ms": int((time.time() - start_time) * 1000),
                },
            }

        # Distribute rooms across floors
        ground_rooms, upper_rooms = self._partition_rooms()

        # Check feasibility
        total_ground_req = sum(float(r.get("min_area", 100)) for r in ground_rooms)
        # Wall allowance (8-12% internal wall and circulation)
        wall_factor = 1.12
        required_ground_envelope = total_ground_req * wall_factor

        if required_ground_envelope > envelope.area:
            shortfall = int(required_ground_envelope - envelope.area)
            msg = (
                f"Required rooms need at least {int(required_ground_envelope)} sq ft (including wall allowance), "
                f"but buildable envelope is only {int(envelope.area)} sq ft (shortfall: {shortfall} sq ft). "
                "Reduce bedrooms, add a floor, or enlarge the plot."
            )
            return {
                "plans": [],
                "conflicts": [
                    {
                        "code": "AREA_SHORTFALL",
                        "message": msg,
                        "suggestion": "Increase plot size or distribute bedrooms to upper floors.",
                    }
                ],
                "warnings": self.warnings,
                "meta": {
                    "seed": self.seed,
                    "engine": "BuildWise Pure-Python Constraint Solver v1.0",
                    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "elapsed_ms": int((time.time() - start_time) * 1000),
                },
            }

        # Generate candidate layouts across the 4 archetypes
        candidate_plans: list[dict[str, Any]] = []
        seen_hashes = set()

        # Try all 4 archetypes, cycling starting from (self.seed - 42)
        base_offset = (self.seed - 42) % len(ARCHETYPE_CONFIGS)
        for i in range(len(ARCHETYPE_CONFIGS)):
            alt_idx = (base_offset + i) % len(ARCHETYPE_CONFIGS)
            alt_seed = self.seed + alt_idx * 19
            plan = self._generate_single_plan(alt_seed, envelope, ground_rooms, upper_rooms, alt_idx)
            if plan:
                pid = plan["plan_id"]
                if pid not in seen_hashes:
                    seen_hashes.add(pid)
                    candidate_plans.append(plan)

        # Fallback if any archetype failed to generate
        if len(candidate_plans) < 3:
            for extra_idx in range(len(ARCHETYPE_CONFIGS), len(ARCHETYPE_CONFIGS) + 4):
                alt_seed = self.seed + extra_idx * 23
                plan = self._generate_single_plan(alt_seed, envelope, ground_rooms, upper_rooms, extra_idx)
                if plan:
                    pid = plan["plan_id"]
                    if pid not in seen_hashes:
                        seen_hashes.add(pid)
                        candidate_plans.append(plan)
                if len(candidate_plans) >= 3:
                    break

        if not candidate_plans:
            return {
                "plans": [],
                "conflicts": [
                    {
                        "code": "UNSATISFIABLE_CONSTRAINTS",
                        "message": "Could not place all required rooms while satisfying minimum width and non-overlap constraints.",
                        "suggestion": "Enlarge envelope or relax room requirements.",
                    }
                ],
                "warnings": self.warnings,
                "meta": {
                    "seed": self.seed,
                    "engine": "BuildWise Pure-Python Constraint Solver v2.0",
                    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "elapsed_ms": int((time.time() - start_time) * 1000),
                },
            }

        # Apply deterministic Multi-Criteria Decision Analysis ranking and select the 3 best-fitting plans
        try:
            from backend.app.services.ranking import rank_plans
            form_context = {
                "budget": float(self.request.get("budget") or 3500000.0),
                "monthlyBudget": float(self.request.get("monthlyBudget") or 300000.0),
                "width": float(self.plot.get("width") or 40.0),
                "length": float(self.plot.get("depth") or 60.0),
                "facing": self.request.get("facing") or ("North" if self.road_side == "N" else "East" if self.road_side == "E" else "South" if self.road_side == "S" else "West"),
                "quality": self.request.get("quality") or "Standard",
                "location": self.request.get("location") or "Tamil Nadu",
                "floors": self.floors_count,
            }
            rank_plans(candidate_plans, form_context=form_context, preset="Balanced")
            plans = candidate_plans[:3]
        except Exception:
            # Fallback sort by score if ranking calculation encounters unexpected error
            candidate_plans.sort(key=lambda p: p["score"], reverse=True)
            plans = candidate_plans[:3]

        for idx, p in enumerate(plans):
            letter = chr(ord("A") + idx)
            arch_title = p.get("archetype_name", "Architectural Plan")
            p["name"] = f"Layout {letter}: {arch_title}"

        return {
            "plans": plans,
            "ranking": [p.get("ranking") for p in plans if p.get("ranking")],
            "conflicts": [],
            "warnings": self.warnings,
            "meta": {
                "seed": self.seed,
                "engine": "BuildWise Pure-Python Constraint Solver v2.0",
                "ranking_methodology": "TNCDBR-MCDA-v2.0 (Oct 2026)",
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "elapsed_ms": int((time.time() - start_time) * 1000),
            },
        }

    def _partition_rooms(self) -> tuple[list[dict[str, Any]], dict[int, list[dict[str, Any]]]]:
        ground_types = {"living", "kitchen", "dining", "pooja", "utility", "parking", "master_bedroom", "attached_bathroom"}
        ground = []
        upper: dict[int, list[dict[str, Any]]] = {lvl: [] for lvl in range(1, self.floors_count)}

        extra_beds = []
        extra_baths = []
        balconies = []

        for r in self.raw_rooms:
            rtype = r.get("type")
            rid = r.get("id", "")

            if rtype == "balcony":
                ground.append(r)
                if self.floors_count > 1:
                    balconies.append(r)
                continue

            if rtype == "attached_bathroom" and r.get("attached_to") == "master":
                ground.append(r)
            elif rid == "master" or rtype == "master_bedroom":
                ground.append(r)
            elif rtype in ground_types:
                ground.append(r)
            elif "bed" in rtype:
                extra_beds.append(r)
            elif "bath" in rtype:
                extra_baths.append(r)
            else:
                ground.append(r)

        if self.floors_count == 1:
            ground.extend(extra_beds)
            ground.extend(extra_baths)
        else:
            # Distribute upper rooms evenly
            fl_idx = 1
            for b in extra_beds:
                upper[fl_idx].append(b)
                fl_idx = 1 if fl_idx >= self.floors_count - 1 else fl_idx + 1

            fl_idx = 1
            for ba in extra_baths:
                upper[fl_idx].append(ba)
                fl_idx = 1 if fl_idx >= self.floors_count - 1 else fl_idx + 1

            for bal in balconies:
                upper[1].append(bal)

            # Add staircase core on ground and each upper floor
            stair = {"id": "staircase", "type": "staircase", "name": "Staircase Core", "min_area": 90.0}
            ground.append(stair)
            for fl in upper:
                upper[fl].append(stair.copy())

        return ground, upper

    def _generate_single_plan(
        self,
        seed: int,
        envelope: Envelope,
        ground_rooms: list[dict[str, Any]],
        upper_rooms: dict[int, list[dict[str, Any]]],
        alt_index: int,
    ) -> dict[str, Any] | None:
        rng = random.Random(seed)
        arch_index = (alt_index + (self.seed - 42)) % len(ARCHETYPE_CONFIGS)
        arch_cfg = ARCHETYPE_CONFIGS[arch_index]

        # Generate Ground Floor
        g_placed = self._layout_floor(rng, envelope, ground_rooms, is_ground=True, alt_index=alt_index, arch_idx=arch_index)
        if not g_placed:
            return None

        floors_data = [
            {
                "level": 0,
                "rooms": [r.to_dict() for r in g_placed],
                "circulation": [],
            }
        ]

        # Generate Upper Floors (if any)
        for fl_level, u_rooms in upper_rooms.items():
            u_placed = self._layout_floor(rng, envelope, u_rooms, is_ground=False, alt_index=alt_index, arch_idx=arch_index)
            if u_placed:
                floors_data.append(
                    {
                        "level": fl_level,
                        "rooms": [r.to_dict() for r in u_placed],
                        "circulation": [],
                    }
                )

        # Metrics calculation
        g_area = sum(r.area for r in g_placed)
        total_built_up = sum(
            sum(rm["area"] for rm in fl["rooms"]) for fl in floors_data
        )
        # Apply external wall footprint allowance (5% thickness)
        ground_built_up = round(g_area * 1.05, 1)
        total_built_up_adj = round(total_built_up * 1.05, 1)
        plot_area = float(self.plot.get("width", 40)) * float(self.plot.get("depth", 60))
        coverage_pct = round((ground_built_up / plot_area) * 100.0, 1)

        plan_hash = compute_plan_hash(floors_data)
        score_breakdown = self._calculate_scores(g_placed, envelope)

        return {
            "plan_id": plan_hash,
            "name": f"Layout Option {alt_index + 1}: {arch_cfg['title']}",
            "archetype_id": arch_cfg["id"],
            "archetype_name": arch_cfg["title"],
            "archetype_concept": arch_cfg["concept"],
            "score": score_breakdown["total"],
            "score_breakdown": score_breakdown,
            "request_echo": {
                "plot": self.plot,
                "road_side": self.road_side,
                "floors": self.floors_count,
            },
            "floors": floors_data,
            "details": {
                "ground_built_up": ground_built_up,
                "total_built_up": total_built_up_adj,
                "built_up_area": total_built_up_adj,
                "plot_coverage_pct": coverage_pct,
                "circulation_area": round(envelope.area - g_area, 1),
                "room_count": sum(len(fl["rooms"]) for fl in floors_data),
            },
        }

    def _layout_floor(
        self,
        rng: random.Random,
        envelope: Envelope,
        rooms_to_place: list[dict[str, Any]],
        is_ground: bool,
        alt_index: int = 0,
        arch_idx: int = 0,
    ) -> list[RectRoom] | None:
        if not rooms_to_place:
            return []

        rs = self.road_side.upper()
        if rs in ("E", "W"):
            W = envelope.height
            D = envelope.width
        else:
            W = envelope.width
            D = envelope.height

        jitter = round(rng.uniform(-0.25, 0.25), 2)
        r = self._extract_room_specs(rooms_to_place)

        raw_boxes: list[tuple[str, str, str, float, float, float, float]] = []

        if not is_ground:
            # UPPER FLOOR LAYOUT: Professional Duplex Living
            h_front = round(min(16.0, max(12.0, D * 0.35 + jitter)), 2)
            h_rear = round(D - h_front, 2)
            balcony = r.get("balcony")
            staircase = r.get("staircase")

            # Front social & circulation zone: Balcony + Family Lounge + Staircase Core
            cur_x = 0.0
            w_bal = round(min(10.0, max(6.5, W * 0.28)), 2) if balcony else 0.0
            w_stair = round(min(9.0, max(7.0, W * 0.22)), 2) if staircase else 0.0
            w_lounge = round(W - w_bal - w_stair, 2)

            if balcony:
                raw_boxes.append((balcony["id"], balcony.get("name", "Upper View Balcony"), "balcony", cur_x, 0.0, w_bal, h_front))
                cur_x = round(cur_x + w_bal, 2)

            raw_boxes.append(("family_lounge", "Upper Family Lounge", "living", cur_x, 0.0, w_lounge, h_front))
            cur_x = round(cur_x + w_lounge, 2)

            if staircase:
                raw_boxes.append((staircase["id"], staircase.get("name", "Staircase Core"), "staircase", cur_x, 0.0, w_stair, h_front))

            # Rear sleeping zone: All upper bedrooms and dedicated bathrooms
            all_upper_beds = r["other_beds"] if r["other_beds"] else ([r["master"]] if r["master"] else [])
            all_upper_baths = r["other_baths"]

            n_beds = len(all_upper_beds)
            if n_beds == 2:
                # 2 Upper Bedrooms: Left Wing (e.g. Guest Suite) & Right Wing (e.g. Children's Suite)
                w_wing1 = round(W * 0.50, 2)
                w_wing2 = round(W - w_wing1, 2)

                # Bedroom 2 (Left Wing)
                if len(all_upper_baths) >= 1:
                    wb1 = round(min(6.5, max(5.5, w_wing1 * 0.34)), 2)
                    wbed1 = round(w_wing1 - wb1, 2)
                    hb1 = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
                    raw_boxes.append((all_upper_beds[0]["id"], all_upper_beds[0].get("name", "Bedroom 2 (Guest Suite)"), "bedroom", 0.0, h_front, wbed1, h_rear))
                    raw_boxes.append((all_upper_baths[0]["id"], all_upper_baths[0].get("name", "Attached Bath 2"), "bathroom", wbed1, h_front, wb1, hb1))
                    raw_boxes.append(("bed2_dress", "Bed 2 Dressing Alcove", "dressing", wbed1, round(h_front + hb1, 2), wb1, round(h_rear - hb1, 2)))
                else:
                    raw_boxes.append((all_upper_beds[0]["id"], all_upper_beds[0].get("name", "Bedroom 2 (Guest Suite)"), "bedroom", 0.0, h_front, w_wing1, h_rear))

                # Bedroom 3 (Right Wing)
                if len(all_upper_baths) >= 2:
                    wb2 = round(min(6.5, max(5.5, w_wing2 * 0.34)), 2)
                    wbed2 = round(w_wing2 - wb2, 2)
                    hb2 = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
                    raw_boxes.append((all_upper_baths[1]["id"], all_upper_baths[1].get("name", "Attached Bath 3"), "bathroom", w_wing1, h_front, wb2, hb2))
                    raw_boxes.append(("bed3_study", "Study Alcove", "study", w_wing1, round(h_front + hb2, 2), wb2, round(h_rear - hb2, 2)))
                    raw_boxes.append((all_upper_beds[1]["id"], all_upper_beds[1].get("name", "Bedroom 3 (Children's Suite)"), "bedroom", round(w_wing1 + wb2, 2), h_front, wbed2, h_rear))
                else:
                    raw_boxes.append((all_upper_beds[1]["id"], all_upper_beds[1].get("name", "Bedroom 3 (Children's Suite)"), "bedroom", w_wing1, h_front, w_wing2, h_rear))

            elif n_beds == 1:
                # 1 Upper Bedroom
                if len(all_upper_baths) >= 1:
                    wb = round(min(7.0, max(5.5, W * 0.28)), 2)
                    wbed = round(W - wb, 2)
                    hb = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
                    raw_boxes.append((all_upper_beds[0]["id"], all_upper_beds[0].get("name", "Upper Primary Suite"), "bedroom", 0.0, h_front, wbed, h_rear))
                    raw_boxes.append((all_upper_baths[0]["id"], all_upper_baths[0].get("name", "Ensuite Bathroom"), "bathroom", wbed, h_front, wb, hb))
                    raw_boxes.append(("upper_dress", "Walk-in Dressing", "dressing", wbed, round(h_front + hb, 2), wb, round(h_rear - hb, 2)))
                else:
                    raw_boxes.append((all_upper_beds[0]["id"], all_upper_beds[0].get("name", "Upper Primary Suite"), "bedroom", 0.0, h_front, W, h_rear))

            elif n_beds > 2:
                # 3+ Upper Bedrooms: distribute columns
                w_col = round(W / n_beds, 2)
                for i, bed in enumerate(all_upper_beds):
                    bx = round(i * w_col, 2)
                    bw = round(W - bx if i == n_beds - 1 else w_col, 2)
                    bname = bed.get("name") or f"Bedroom {i+2}"
                    raw_boxes.append((bed["id"], bname, "bedroom", bx, h_front, bw, h_rear))
                for i, bath in enumerate(all_upper_baths):
                    wb = 5.5
                    hb = 7.0
                    ux = round(min(W - wb, i * wb), 2)
                    raw_boxes.append((bath["id"], bath.get("name") or f"Bathroom {i+1}", "bathroom", ux, h_front, wb, hb))

            raw_boxes = self._ensure_all_rooms_placed(raw_boxes, r, W, D)

        else:
            # GROUND FLOOR: 4 DIVERSE ARCHITECTURAL TYPOLOGIES
            if arch_idx == 0:
                raw_boxes = self._layout_archetype_0(W, D, r, jitter)
            elif arch_idx == 1:
                raw_boxes = self._layout_archetype_1(W, D, r, jitter)
            elif arch_idx == 2:
                raw_boxes = self._layout_archetype_2(W, D, r, jitter)
            else:
                raw_boxes = self._layout_archetype_3(W, D, r, jitter)

            raw_boxes = self._ensure_all_rooms_placed(raw_boxes, r, W, D)

        # Convert normalized coordinates (u, v) into global plot envelope coordinates (x, y)
        placed_rooms: list[RectRoom] = []
        for rid, rname, rtype, u, v, w, h in raw_boxes:
            if w <= 0.0 or h <= 0.0:
                continue

            if rs == "N":
                rx = envelope.min_x + u
                ry = envelope.min_y + v
                rw = w
                rh = h
            elif rs == "S":
                rx = envelope.min_x + (W - u - w)
                ry = envelope.max_y - v - h
                rw = w
                rh = h
            elif rs == "W":
                rx = envelope.min_x + v
                ry = envelope.min_y + u
                rw = h
                rh = w
            elif rs == "E":
                rx = envelope.max_x - v - h
                ry = envelope.min_y + u
                rw = h
                rh = w
            else:
                rx = envelope.min_x + u
                ry = envelope.min_y + v
                rw = w
                rh = h

            placed_rooms.append(
                RectRoom(
                    id=rid,
                    type=rtype,
                    name=rname,
                    x=round(rx, 2),
                    y=round(ry, 2),
                    width=round(rw, 2),
                    height=round(rh, 2),
                )
            )

        return placed_rooms

    def _extract_room_specs(self, rooms_to_place: list[dict[str, Any]]) -> dict[str, Any]:
        parking = next((r for r in rooms_to_place if r.get("type") == "parking"), None)
        balcony = next((r for r in rooms_to_place if r.get("type") == "balcony"), None)
        living = next((r for r in rooms_to_place if r.get("type") == "living"), None)
        dining = next((r for r in rooms_to_place if r.get("type") == "dining"), None)
        kitchen = next((r for r in rooms_to_place if r.get("type") == "kitchen"), None)
        utility = next((r for r in rooms_to_place if r.get("type") == "utility"), None)
        pooja = next((r for r in rooms_to_place if r.get("type") == "pooja"), None)
        staircase = next((r for r in rooms_to_place if r.get("type") == "staircase" or r.get("id") == "staircase"), None)

        master = next((r for r in rooms_to_place if r.get("id") == "master" or r.get("type") == "master_bedroom"), None)
        other_beds = [r for r in rooms_to_place if "bed" in r.get("type", "") and r != master]

        master_bath = next((r for r in rooms_to_place if r.get("attached_to") == "master" or r.get("id") == "master_bath"), None)
        other_baths = [r for r in rooms_to_place if "bath" in r.get("type", "") and r != master_bath]

        return {
            "parking": parking,
            "balcony": balcony,
            "living": living,
            "dining": dining,
            "kitchen": kitchen,
            "utility": utility,
            "pooja": pooja,
            "staircase": staircase,
            "master": master,
            "other_beds": other_beds,
            "master_bath": master_bath,
            "other_baths": other_baths,
            "all_rooms": rooms_to_place,
        }

    def _layout_archetype_0(self, W: float, D: float, r: dict[str, Any], jitter: float) -> list[tuple[str, str, str, float, float, float, float]]:
        """Archetype 0: Traditional Vastu Courtyard Flow (Quadrant Zoned)."""
        raw = []
        h_front = round(min(17.0, max(13.5, D * 0.31 + jitter)), 2)
        h_mid = round(min(18.0, max(14.0, D * 0.35 - jitter)), 2)
        h_rear = round(D - h_front - h_mid, 2)

        # FRONT
        w_park = round(min(12.0, max(9.5, W * 0.27)), 2) if r["parking"] else 0.0
        w_bal = round(min(8.5, max(6.5, W * 0.18)), 2) if r["balcony"] else 0.0
        w_pooja = round(min(6.5, max(5.0, W * 0.14)), 2) if r["pooja"] else 0.0
        w_liv = round(W - w_park - w_bal - w_pooja, 2)

        cur_x = 0.0
        if r["parking"]:
            raw.append((r["parking"]["id"], r["parking"].get("name", "Car Parking"), "parking", cur_x, 0.0, w_park, h_front))
            cur_x = round(cur_x + w_park, 2)
        if r["balcony"]:
            raw.append((r["balcony"]["id"], "Front Balcony / Sit-Out", "balcony", cur_x, 0.0, w_bal, h_front))
            cur_x = round(cur_x + w_bal, 2)
        if r["living"]:
            raw.append((r["living"]["id"], r["living"].get("name", "Family Living Room"), "living", cur_x, 0.0, w_liv, h_front))
            cur_x = round(cur_x + w_liv, 2)
        if r["pooja"]:
            raw.append((r["pooja"]["id"], r["pooja"].get("name", "Pooja Room"), "pooja", cur_x, 0.0, w_pooja, h_front))

        # MID
        y_mid = h_front
        w_left = round(min(7.5, max(5.5, W * 0.16)), 2) if (r["other_baths"] or r["pooja"]) else 0.0
        w_din = round(min(15.0, max(12.0, W * 0.33)), 2) if r["dining"] else 0.0
        w_kzone = round(W - w_left - w_din, 2)

        if w_left > 0:
            if len(r["other_baths"]) >= 2:
                hb1 = round(min(8.5, max(7.0, h_mid * 0.5)), 2)
                hb2 = round(h_mid - hb1, 2)
                raw.append((r["other_baths"][1]["id"], "Common Bathroom", "bathroom", 0.0, y_mid, w_left, hb1))
                raw.append((r["other_baths"][0]["id"], "Attached Bath 2", "bathroom", 0.0, round(y_mid + hb1, 2), w_left, hb2))
            elif len(r["other_baths"]) == 1:
                hb = round(min(8.5, max(7.0, h_mid * 0.52)), 2)
                raw.append((r["other_baths"][0]["id"], "Common Bathroom", "bathroom", 0.0, y_mid, w_left, hb))
                raw.append(("wash_alcove", "Handwash & Linen Alcove", "utility", 0.0, round(y_mid + hb, 2), w_left, round(h_mid - hb, 2)))
            elif r["pooja"] and not (w_pooja > 0):
                raw.append((r["pooja"]["id"], "Pooja Room", "pooja", 0.0, y_mid, w_left, h_mid))

        if r["dining"]:
            raw.append((r["dining"]["id"], r["dining"].get("name", "Family Dining Hall"), "dining", w_left, y_mid, w_din, h_mid))

        x_kzone = round(w_left + w_din, 2)
        if r["kitchen"] and r["utility"]:
            w_kit = round(w_kzone * 0.64, 2)
            w_util = round(w_kzone - w_kit, 2)
            raw.append((r["kitchen"]["id"], "Modular Kitchen", "kitchen", x_kzone, y_mid, w_kit, h_mid))
            raw.append((r["utility"]["id"], "Utility Area", "utility", round(x_kzone + w_kit, 2), y_mid, w_util, h_mid))
        elif r["kitchen"]:
            raw.append((r["kitchen"]["id"], "Modular Kitchen", "kitchen", x_kzone, y_mid, w_kzone, h_mid))
        elif r["utility"]:
            raw.append((r["utility"]["id"], "Utility Area", "utility", x_kzone, y_mid, w_kzone, h_mid))

        # REAR
        y_rear = round(h_front + h_mid, 2)
        w_mzone = round(W * 0.50, 2)
        w_ozone = round(W - w_mzone, 2)

        # Master Suite
        if r["master_bath"]:
            w_mb = 6.0
            w_mbed = round(w_mzone - w_mb, 2)
            if r["master"]:
                raw.append((r["master"]["id"], "Master Bedroom", "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
            hmb = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
            raw.append((r["master_bath"]["id"], "Master Attached Bath", "attached_bathroom", w_mbed, y_rear, w_mb, hmb))
            if len(r["other_baths"]) >= 3:
                raw.append((r["other_baths"][2]["id"], "Attached Bath 3", "bathroom", w_mbed, round(y_rear + hmb, 2), w_mb, round(h_rear - hmb, 2)))
            else:
                raw.append(("master_dress", "Master Dressing Suite", "dressing", w_mbed, round(y_rear + hmb, 2), w_mb, round(h_rear - hmb, 2)))
        elif r["master"]:
            raw.append((r["master"]["id"], "Master Bedroom", "master_bedroom", 0.0, y_rear, w_mzone, h_rear))

        beds = r["other_beds"]
        if beds:
            n_beds = len(beds)
            w_col = round(w_ozone / n_beds, 2)
            for i, b in enumerate(beds):
                bx = round(w_mzone + i * w_col, 2)
                bw = round(W - bx if i == n_beds - 1 else w_col, 2)
                raw.append((b["id"], b.get("name", f"Bedroom {i+2}"), "bedroom", bx, y_rear, bw, h_rear))

        return raw

    def _layout_archetype_1(self, W: float, D: float, r: dict[str, Any], jitter: float) -> list[tuple[str, str, str, float, float, float, float]]:
        """Archetype 1: Contemporary Open Great-Room & Garden Pavilion."""
        raw = []
        h_front = round(min(17.5, max(14.0, D * 0.33 + jitter)), 2)
        h_mid = round(min(17.0, max(13.5, D * 0.33 - jitter)), 2)
        h_rear = round(D - h_front - h_mid, 2)

        w_social = round(W * 0.56, 2)
        w_priv = round(W - w_social, 2)

        # FRONT
        w_bal = round(min(9.0, max(6.5, w_social * 0.35)), 2) if r["balcony"] else 0.0
        w_liv = round(w_social - w_bal, 2)
        if r["balcony"]:
            raw.append((r["balcony"]["id"], "Front Garden Balcony", "balcony", 0.0, 0.0, w_bal, h_front))
        if r["living"]:
            raw.append((r["living"]["id"], "Sunlit Living Lounge", "living", w_bal, 0.0, w_liv, h_front))

        if r["parking"]:
            raw.append((r["parking"]["id"], "Car Parking Porch", "parking", w_social, 0.0, w_priv, h_front))
        else:
            raw.append(("front_verandah", "Entrance Foyer", "living", w_social, 0.0, w_priv, h_front))

        # MID
        y_mid = h_front
        w_din = round(w_social * 0.50, 2)
        w_kit = round(w_social - w_din, 2)
        if r["dining"]:
            raw.append((r["dining"]["id"], "Open Dining Pavilion", "dining", 0.0, y_mid, w_din, h_mid))

        if r["kitchen"] and r["utility"]:
            hk = round(h_mid * 0.65, 2)
            hu = round(h_mid - hk, 2)
            raw.append((r["kitchen"]["id"], "Gourmet Island Kitchen", "kitchen", w_din, y_mid, w_kit, hk))
            raw.append((r["utility"]["id"], "Walk-in Utility & Pantry", "utility", w_din, round(y_mid + hk, 2), w_kit, hu))
        elif r["kitchen"]:
            raw.append((r["kitchen"]["id"], "Gourmet Island Kitchen", "kitchen", w_din, y_mid, w_kit, h_mid))

        # Mid Right
        w_serv = round(min(7.0, max(5.5, w_priv * 0.35)), 2)
        w_b2 = round(w_priv - w_serv, 2)
        if r["other_baths"]:
            h_cb = round(min(8.5, max(7.0, h_mid * 0.52)), 2)
            raw.append((r["other_baths"][0]["id"], "Common Bathroom", "bathroom", w_social, y_mid, w_serv, h_cb))
            if len(r["other_baths"]) >= 3:
                raw.append((r["other_baths"][2]["id"], "Attached Bath 3", "bathroom", w_social, round(y_mid + h_cb, 2), w_serv, round(h_mid - h_cb, 2)))
            else:
                raw.append(("foyer_powder", "Wash & Powder Alcove", "utility", w_social, round(y_mid + h_cb, 2), w_serv, round(h_mid - h_cb, 2)))
        elif r["pooja"]:
            raw.append((r["pooja"]["id"], "Pooja Room", "pooja", w_social, y_mid, w_serv, h_mid))

        bed2 = r["other_beds"][0] if r["other_beds"] else None
        if bed2:
            raw.append((bed2["id"], "Bedroom 2 (Guest Suite)", "bedroom", round(w_social + w_serv, 2), y_mid, w_b2, h_mid))

        # REAR
        y_rear = round(h_front + h_mid, 2)
        if r["master_bath"]:
            w_mb = 6.0
            w_mbed = round(w_social - w_mb, 2)
            if r["master"]:
                raw.append((r["master"]["id"], "Master Bedroom Suite", "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
            hmb = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
            raw.append((r["master_bath"]["id"], "Ensuite Master Bath", "attached_bathroom", w_mbed, y_rear, w_mb, hmb))
            raw.append(("garden_dressing", "Garden Dressing Alcove", "dressing", w_mbed, round(y_rear + hmb, 2), w_mb, round(h_rear - hmb, 2)))
        elif r["master"]:
            raw.append((r["master"]["id"], "Master Bedroom Suite", "master_bedroom", 0.0, y_rear, w_social, h_rear))

        # Rear Right: Bedroom 3 + Attached Bath 2
        if len(r["other_baths"]) >= 2:
            w_b2bath = 6.0
            w_b3 = round(w_priv - w_b2bath, 2)
            hb2 = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
            raw.append((r["other_baths"][1]["id"], "Ensuite Bath 2", "bathroom", w_social, y_rear, w_b2bath, hb2))
            raw.append(("linen_store", "Linen & Study Store", "store", w_social, round(y_rear + hb2, 2), w_b2bath, round(h_rear - hb2, 2)))
            bed3 = r["other_beds"][1] if len(r["other_beds"]) > 1 else (r["other_beds"][0] if len(r["other_beds"]) == 1 else None)
            if bed3:
                raw.append((bed3["id"], "Bedroom 3", "bedroom", round(w_social + w_b2bath, 2), y_rear, w_b3, h_rear))
        else:
            bed3 = r["other_beds"][1] if len(r["other_beds"]) > 1 else None
            if bed3:
                raw.append((bed3["id"], "Bedroom 3", "bedroom", w_social, y_rear, w_priv, h_rear))

        return raw

    def _layout_archetype_2(self, W: float, D: float, r: dict[str, Any], jitter: float) -> list[tuple[str, str, str, float, float, float, float]]:
        """Archetype 2: Split-Wing Generational Suite Layout."""
        raw = []
        h_front = round(min(17.0, max(13.5, D * 0.32 + jitter)), 2)
        h_mid = round(min(17.5, max(13.5, D * 0.34 - jitter)), 2)
        h_rear = round(D - h_front - h_mid, 2)

        w_park = round(min(11.5, max(9.5, W * 0.26)), 2) if r["parking"] else 0.0
        w_fbed = round(min(14.0, max(11.0, W * 0.32)), 2)
        w_bal = round(min(8.0, max(6.0, W * 0.16)), 2) if r["balcony"] else 0.0
        w_liv = round(W - w_fbed - w_bal - w_park, 2)

        bed2 = r["other_beds"][0] if r["other_beds"] else None
        if bed2 and len(r["other_baths"]) >= 2:
            hb = 6.5
            h_bed = round(h_front - hb, 2)
            raw.append((bed2["id"], "Step-Free Senior Suite", "bedroom", 0.0, 0.0, w_fbed, h_bed))
            w_sbath = round(min(7.5, max(6.0, w_fbed * 0.5)), 2)
            w_sward = round(w_fbed - w_sbath, 2)
            raw.append((r["other_baths"][0]["id"], "Senior Ensuite Bath", "bathroom", 0.0, h_bed, w_sbath, hb))
            raw.append(("senior_wardrobe", "Senior Wardrobe Alcove", "dressing", w_sbath, h_bed, w_sward, hb))
        elif bed2:
            raw.append((bed2["id"], "Step-Free Senior Suite", "bedroom", 0.0, 0.0, w_fbed, h_front))

        cur_x = w_fbed
        if r["balcony"]:
            raw.append((r["balcony"]["id"], "Front Entrance Balcony", "balcony", cur_x, 0.0, w_bal, h_front))
            cur_x = round(cur_x + w_bal, 2)
        if r["living"]:
            raw.append((r["living"]["id"], "Family Living Room", "living", cur_x, 0.0, w_liv, h_front))
            cur_x = round(cur_x + w_liv, 2)
        if r["parking"]:
            raw.append((r["parking"]["id"], "Car Parking Porch", "parking", cur_x, 0.0, w_park, h_front))

        # MID
        y_mid = h_front
        w_left = round(min(7.5, max(5.5, W * 0.16)), 2)
        w_din = round(min(15.0, max(12.0, W * 0.33)), 2)
        w_kzone = round(W - w_left - w_din, 2)

        common_b = r["other_baths"][1] if len(r["other_baths"]) >= 2 else (r["other_baths"][0] if r["other_baths"] else None)
        if common_b and r["pooja"]:
            hb = round(h_mid * 0.55, 2)
            hp = round(h_mid - hb, 2)
            raw.append((common_b["id"], "Common Bathroom", "bathroom", 0.0, y_mid, w_left, hb))
            raw.append((r["pooja"]["id"], "Pooja Room", "pooja", 0.0, round(y_mid + hb, 2), w_left, hp))
        elif common_b:
            hb = round(min(8.5, max(7.0, h_mid * 0.52)), 2)
            raw.append((common_b["id"], "Common Bathroom", "bathroom", 0.0, y_mid, w_left, hb))
            if len(r["other_baths"]) >= 3:
                raw.append((r["other_baths"][2]["id"], "Guest Powder Bath", "bathroom", 0.0, round(y_mid + hb, 2), w_left, round(h_mid - hb, 2)))
            else:
                raw.append(("linen_alcove", "Dining Linen Alcove", "utility", 0.0, round(y_mid + hb, 2), w_left, round(h_mid - hb, 2)))
        elif r["pooja"]:
            raw.append((r["pooja"]["id"], "Pooja Room", "pooja", 0.0, y_mid, w_left, h_mid))

        if r["dining"]:
            raw.append((r["dining"]["id"], "Family Dining Hall", "dining", w_left, y_mid, w_din, h_mid))

        x_kzone = round(w_left + w_din, 2)
        if r["kitchen"] and r["utility"]:
            hk = round(h_mid * 0.65, 2)
            hu = round(h_mid - hk, 2)
            raw.append((r["kitchen"]["id"], "Family Kitchen", "kitchen", x_kzone, y_mid, w_kzone, hk))
            raw.append((r["utility"]["id"], "Utility Area", "utility", x_kzone, round(y_mid + hk, 2), w_kzone, hu))
        elif r["kitchen"]:
            raw.append((r["kitchen"]["id"], "Family Kitchen", "kitchen", x_kzone, y_mid, w_kzone, h_mid))

        # REAR
        y_rear = round(h_front + h_mid, 2)
        w_mzone = round(W * 0.52, 2)
        w_b3zone = round(W - w_mzone, 2)

        if r["master_bath"]:
            w_mb = 6.0
            w_mbed = round(w_mzone - w_mb, 2)
            if r["master"]:
                raw.append((r["master"]["id"], "Master Suite", "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
            hmb = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
            raw.append((r["master_bath"]["id"], "Master Attached Bath", "attached_bathroom", w_mbed, y_rear, w_mb, hmb))
            raw.append(("master_wardrobe", "Master Walk-in Wardrobe", "dressing", w_mbed, round(y_rear + hmb, 2), w_mb, round(h_rear - hmb, 2)))
        elif r["master"]:
            raw.append((r["master"]["id"], "Master Suite", "master_bedroom", 0.0, y_rear, w_mzone, h_rear))

        bed3 = r["other_beds"][1] if len(r["other_beds"]) > 1 else None
        if bed3:
            if len(r["other_baths"]) >= 3:
                w_b3bath = 6.0
                w_b3 = round(w_b3zone - w_b3bath, 2)
                hb3 = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
                raw.append((bed3["id"], "Bedroom 3 (Children's Suite)", "bedroom", w_mzone, y_rear, w_b3, h_rear))
                raw.append((r["other_baths"][2]["id"], "Attached Bath 3", "bathroom", round(w_mzone + w_b3, 2), y_rear, w_b3bath, hb3))
                raw.append(("bed3_study", "Children's Study Alcove", "study", round(w_mzone + w_b3, 2), round(y_rear + hb3, 2), w_b3bath, round(h_rear - hb3, 2)))
            else:
                raw.append((bed3["id"], "Bedroom 3 (Children's Suite)", "bedroom", w_mzone, y_rear, w_b3zone, h_rear))

        return raw

    def _layout_archetype_3(self, W: float, D: float, r: dict[str, Any], jitter: float) -> list[tuple[str, str, str, float, float, float, float]]:
        """Archetype 3: Linear Breezeway & Central Gallery Suite Layout."""
        raw = []
        h_front = round(min(16.5, max(13.0, D * 0.30 + jitter)), 2)
        h_mid = round(min(18.0, max(14.0, D * 0.35 - jitter)), 2)
        h_rear = round(D - h_front - h_mid, 2)

        w_left = round(W * 0.48, 2)
        w_right = round(W - w_left, 2)

        # Front Left: Bedroom 3
        bed3 = r["other_beds"][1] if len(r["other_beds"]) > 1 else None
        if bed3:
            raw.append((bed3["id"], "Bedroom 3", "bedroom", 0.0, 0.0, w_left, h_front))
        else:
            raw.append(("guest_study", "Guest Study Alcove", "study", 0.0, 0.0, w_left, h_front))

        # Mid Left: Bed 2 + Ensuite Bath 2
        bed2 = r["other_beds"][0] if r["other_beds"] else None
        bath2 = r["other_baths"][0] if r["other_baths"] else None
        if bath2:
            w_b2bath = 6.0
            w_b2 = round(w_left - w_b2bath, 2)
            if bed2:
                raw.append((bed2["id"], "Primary Suite 2", "bedroom", 0.0, h_front, w_b2, h_mid))
            hb2 = round(min(8.5, max(7.0, h_mid * 0.52)), 2)
            raw.append((bath2["id"], "Ensuite Bath 2", "bathroom", w_b2, h_front, w_b2bath, hb2))
            raw.append(("suite2_wardrobe", "Suite 2 Wardrobe", "dressing", w_b2, round(h_front + hb2, 2), w_b2bath, round(h_mid - hb2, 2)))
        elif bed2:
            raw.append((bed2["id"], "Primary Suite 2", "bedroom", 0.0, h_front, w_left, h_mid))

        # Rear Left: Master Suite 1
        if r["master_bath"]:
            w_mb = 6.0
            w_mbed = round(w_left - w_mb, 2)
            if r["master"]:
                raw.append((r["master"]["id"], "Primary Master Suite", "master_bedroom", 0.0, round(h_front + h_mid, 2), w_mbed, h_rear))
            hmb = round(min(8.5, max(7.0, h_rear * 0.52)), 2)
            raw.append((r["master_bath"]["id"], "Master Ensuite Bath", "attached_bathroom", w_mbed, round(h_front + h_mid, 2), w_mb, hmb))
            if len(r["other_baths"]) >= 3:
                raw.append((r["other_baths"][2]["id"], "Attached Bath 3", "bathroom", w_mbed, round(h_front + h_mid + hmb, 2), w_mb, round(h_rear - hmb, 2)))
            else:
                raw.append(("master_gallery_robe", "Master Walk-in Wardrobe", "dressing", w_mbed, round(h_front + h_mid + hmb, 2), w_mb, round(h_rear - hmb, 2)))
        elif r["master"]:
            raw.append((r["master"]["id"], "Primary Master Suite", "master_bedroom", 0.0, round(h_front + h_mid, 2), w_left, h_rear))

        # RIGHT WING
        w_park = round(min(12.0, max(9.5, w_right * 0.58)), 2) if r["parking"] else 0.0
        w_bal = round(w_right - w_park, 2)
        if r["parking"]:
            raw.append((r["parking"]["id"], "Car Parking Porch", "parking", w_left, 0.0, w_park, h_front))
        if r["balcony"]:
            raw.append((r["balcony"]["id"], "Front Balcony Verandah", "balcony", round(w_left + w_park, 2), 0.0, w_bal, h_front))
        elif not r["parking"]:
            raw.append(("entrance_porch", "Covered Entrance Porch", "living", w_left, 0.0, w_right, h_front))

        # Mid Right: Living Hall + Common Bath / Pooja
        y_mid = h_front
        w_serv = round(min(7.5, max(5.5, w_right * 0.28)), 2)
        w_liv = round(w_right - w_serv, 2)
        if r["living"]:
            raw.append((r["living"]["id"], "Formal Living Hall", "living", w_left, y_mid, w_liv, h_mid))

        common_b = r["other_baths"][1] if len(r["other_baths"]) >= 2 else None
        if common_b and r["pooja"]:
            hb = round(h_mid * 0.55, 2)
            hp = round(h_mid - hb, 2)
            raw.append((common_b["id"], "Common Bathroom", "bathroom", round(w_left + w_liv, 2), y_mid, w_serv, hb))
            raw.append((r["pooja"]["id"], "Pooja Room", "pooja", round(w_left + w_liv, 2), round(y_mid + hb, 2), w_serv, hp))
        elif common_b:
            hb = round(min(8.5, max(7.0, h_mid * 0.52)), 2)
            raw.append((common_b["id"], "Common Bathroom", "bathroom", round(w_left + w_liv, 2), y_mid, w_serv, hb))
            raw.append(("hall_wash", "Foyer Handwash Alcove", "utility", round(w_left + w_liv, 2), round(y_mid + hb, 2), w_serv, round(h_mid - hb, 2)))
        elif r["pooja"]:
            raw.append((r["pooja"]["id"], "Pooja Room", "pooja", round(w_left + w_liv, 2), y_mid, w_serv, h_mid))

        # Rear Right: Dining, Kitchen, Utility
        y_rear = round(h_front + h_mid, 2)
        w_din = round(w_right * 0.44, 2)
        w_kit = round(w_right * 0.36, 2)
        w_util = round(w_right - w_din - w_kit, 2)

        if r["dining"]:
            raw.append((r["dining"]["id"], "Breezeway Dining", "dining", w_left, y_rear, w_din, h_rear))
        if r["kitchen"]:
            raw.append((r["kitchen"]["id"], "Linear Chef Kitchen", "kitchen", round(w_left + w_din, 2), y_rear, w_kit, h_rear))
        if r["utility"]:
            raw.append((r["utility"]["id"], "Service Utility", "utility", round(w_left + w_din + w_kit, 2), y_rear, w_util, h_rear))

        return raw

    def _ensure_all_rooms_placed(
        self,
        raw: list[tuple[str, str, str, float, float, float, float]],
        r: dict[str, Any],
        W: float,
        D: float,
    ) -> list[tuple[str, str, str, float, float, float, float]]:
        placed_ids = {box[0] for box in raw}

        # Ensure all requested bathrooms are placed
        unplaced_baths = [b for b in r.get("other_baths", []) if b["id"] not in placed_ids]
        if unplaced_baths:
            wb = 6.0
            hb = 7.5
            for i, ub in enumerate(unplaced_baths):
                ux = round(max(0.0, W - wb * (i + 1)), 2)
                uy = round(max(0.0, D * 0.38 + i * 2.0), 2)
                raw.append((ub["id"], ub.get("name") or f"Attached Bath {i+2}", "bathroom", ux, uy, wb, hb))
                placed_ids.add(ub["id"])

        # Ensure all requested bedrooms are placed
        unplaced_beds = [b for b in r.get("other_beds", []) if b["id"] not in placed_ids]
        if unplaced_beds:
            w_bed = round(min(14.0, max(10.0, W / (len(unplaced_beds) + 1))), 2)
            h_bed = 11.0
            for i, ubed in enumerate(unplaced_beds):
                ux = round(i * w_bed, 2)
                uy = round(max(0.0, D - h_bed), 2)
                raw.append((ubed["id"], ubed.get("name") or f"Bedroom {i+2}", "bedroom", ux, uy, w_bed, h_bed))
                placed_ids.add(ubed["id"])

        # Ensure master suite is placed if requested
        if r.get("master") and r["master"]["id"] not in placed_ids:
            raw.append((r["master"]["id"], "Master Bedroom", "master_bedroom", 0.0, round(D * 0.65, 2), round(W * 0.45, 2), round(D * 0.35, 2)))
            placed_ids.add(r["master"]["id"])
        if r.get("master_bath") and r["master_bath"]["id"] not in placed_ids:
            raw.append((r["master_bath"]["id"], "Master Attached Bath", "attached_bathroom", round(W * 0.45, 2), round(D * 0.65, 2), 6.0, 7.5))
            placed_ids.add(r["master_bath"]["id"])

        # Ensure staircase is placed if present
        if r.get("staircase") and r["staircase"]["id"] not in placed_ids:
            w_stair = round(min(9.0, max(7.0, W * 0.22)), 2)
            raw.append((r["staircase"]["id"], "Staircase Core", "staircase", round(W - w_stair, 2), 0.0, w_stair, round(D * 0.30, 2)))
            placed_ids.add(r["staircase"]["id"])

        # Ensure balcony is placed if present
        if r.get("balcony") and r["balcony"]["id"] not in placed_ids:
            w_bal = round(min(10.0, max(6.5, W * 0.28)), 2)
            raw.append((r["balcony"]["id"], "Front Balcony", "balcony", 0.0, 0.0, w_bal, round(D * 0.25, 2)))
            placed_ids.add(r["balcony"]["id"])

        # Check any remaining unplaced rooms from input
        for rm in r.get("all_rooms", []):
            rm_id = rm.get("id")
            if rm_id and rm_id not in placed_ids:
                rtype = rm.get("type", "utility")
                raw.append((rm_id, rm.get("name") or rm_id.title(), rtype, 0.0, round(D * 0.35, 2), 7.0, 8.0))
                placed_ids.add(rm_id)

        return raw

    def _calculate_scores(self, rooms: list[RectRoom], envelope: Envelope) -> dict[str, float]:
        if not rooms:
            return {"total": 50.0}

        # 1. Aspect Ratio Score: penalize narrow ratios > 2.0 or < 0.5
        aspect_scores = []
        for r in rooms:
            ratio = max(r.width / max(1.0, r.height), r.height / max(1.0, r.width))
            if ratio <= 1.5:
                aspect_scores.append(100.0)
            elif ratio <= 2.0:
                aspect_scores.append(85.0)
            else:
                aspect_scores.append(60.0)
        aspect_avg = sum(aspect_scores) / len(aspect_scores)

        # 2. Daylight Score: percentage of rooms touching envelope boundary
        daylight_count = 0
        for r in rooms:
            touches_ext = (
                abs(r.x - envelope.min_x) < 0.5
                or abs(r.x + r.width - envelope.max_x) < 0.5
                or abs(r.y - envelope.min_y) < 0.5
                or abs(r.y + r.height - envelope.max_y) < 0.5
            )
            if touches_ext:
                daylight_count += 1
        daylight_pct = (daylight_count / len(rooms)) * 100.0

        # 3. Public-Private Zoning Score
        # Living room should be closest to road_side
        zoning_score = 90.0
        living = next((r for r in rooms if r.type == "living"), None)
        if living:
            if self.road_side == "N" and abs(living.y - envelope.min_y) < 1.0:
                zoning_score = 95.0
            elif self.road_side == "S" and abs(living.y + living.height - envelope.max_y) < 1.0:
                zoning_score = 95.0

        # 4. Circulation / Efficiency
        utilization = min(100.0, (sum(r.area for r in rooms) / envelope.area) * 100.0)

        total = round(
            aspect_avg * 0.30 + daylight_pct * 0.30 + zoning_score * 0.25 + utilization * 0.15,
            1,
        )
        total = max(70.0, min(98.5, total))

        return {
            "total": total,
            "aspect_ratio": round(aspect_avg, 1),
            "daylight": round(daylight_pct, 1),
            "zoning": round(zoning_score, 1),
            "efficiency": round(utilization, 1),
        }
