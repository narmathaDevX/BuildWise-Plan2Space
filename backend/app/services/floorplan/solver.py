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
        "title": "Linear Breezeway & Dual Master Suite Layout",
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

        # Check single-floor balcony request
        has_balcony = any(r.get("type") == "balcony" for r in self.raw_rooms)
        if self.floors_count == 1 and has_balcony:
            self.warnings.append(
                "Balcony requested on a single-floor plan was omitted. Balconies require an upper floor."
            )

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

        # Generate alternative layouts using seeded deterministic slicing
        plans: list[dict[str, Any]] = []
        seen_hashes = set()

        for alt_idx in range(self.num_alternatives * 2):
            if len(plans) >= self.num_alternatives:
                break

            alt_seed = self.seed + alt_idx * 17
            plan = self._generate_single_plan(alt_seed, envelope, ground_rooms, upper_rooms, alt_idx)
            if plan:
                pid = plan["plan_id"]
                if pid not in seen_hashes:
                    seen_hashes.add(pid)
                    plans.append(plan)

        if not plans:
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
                    "engine": "BuildWise Pure-Python Constraint Solver v1.0",
                    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "elapsed_ms": int((time.time() - start_time) * 1000),
                },
            }

        # Rank plans by score
        plans.sort(key=lambda p: p["score"], reverse=True)
        for idx, p in enumerate(plans):
            letter = chr(ord("A") + idx)
            arch_title = p.get("archetype_name", "Architectural Plan")
            p["name"] = f"Layout {letter}: {arch_title}"

        return {
            "plans": plans[: self.num_alternatives],
            "conflicts": [],
            "warnings": self.warnings,
            "meta": {
                "seed": self.seed,
                "engine": "BuildWise Pure-Python Constraint Solver v1.0",
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
        arch_index = (self.seed + alt_index) % len(ARCHETYPE_CONFIGS)
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

        W = envelope.width
        D = envelope.height
        jitter = round(rng.uniform(-0.35, 0.35), 2)

        # Categorize rooms
        living = next((r for r in rooms_to_place if r.get("type") == "living"), None)
        dining = next((r for r in rooms_to_place if r.get("type") == "dining"), None)
        kitchen = next((r for r in rooms_to_place if r.get("type") == "kitchen"), None)
        utility = next((r for r in rooms_to_place if r.get("type") == "utility"), None)
        pooja = next((r for r in rooms_to_place if r.get("type") == "pooja"), None)
        parking = next((r for r in rooms_to_place if r.get("type") == "parking"), None)

        master = next((r for r in rooms_to_place if r.get("id") == "master" or r.get("type") == "master_bedroom"), None)
        other_beds = [r for r in rooms_to_place if "bed" in r.get("type", "") and r != master]
        master_bath = next((r for r in rooms_to_place if r.get("attached_to") == "master"), None)
        common_baths = [r for r in rooms_to_place if "bath" in r.get("type", "") and r != master_bath]

        # Upper floor specific
        balcony = next((r for r in rooms_to_place if r.get("type") == "balcony"), None)
        staircase = next((r for r in rooms_to_place if r.get("type") == "staircase"), None)

        raw_boxes: list[tuple[str, str, str, float, float, float, float]] = []

        if not is_ground:
            # UPPER FLOOR LAYOUT
            h_front = round(min(16.0, max(12.0, D * 0.35 + jitter)), 2)
            h_rear = round(D - h_front, 2)

            if balcony:
                w_bal = round(min(10.0, max(6.0, W * 0.3)), 2)
                w_lounge = round(W - w_bal, 2)
                raw_boxes.append((balcony["id"], balcony.get("name", "Balcony"), "balcony", 0.0, 0.0, w_bal, h_front))
                raw_boxes.append(("family_lounge", "Family Lounge", "living", w_bal, 0.0, w_lounge, h_front))
            else:
                raw_boxes.append(("family_lounge", "Family Lounge", "living", 0.0, 0.0, W, h_front))

            all_upper_beds = other_beds if other_beds else ([master] if master else [])
            n_beds = max(1, len(all_upper_beds))
            w_col = round(W / n_beds, 2)
            for i, bed in enumerate(all_upper_beds):
                bx = round(i * w_col, 2)
                bw = round(W - bx if i == n_beds - 1 else w_col, 2)
                bname = bed.get("name") or f"Bedroom {i+2}"
                raw_boxes.append((bed["id"], bname, "bedroom", bx, h_front, bw, h_rear))

            if common_baths:
                cb = common_baths[0]
                raw_boxes.append((cb["id"], cb.get("name", "Bathroom"), "bathroom", 0.0, h_front, 6.0, 8.0))

        else:
            # GROUND FLOOR ARCHETYPES

            # ARCHETYPE 0: Traditional Vastu Classic (Central Courtyard / Brahmasthan Core)
            if arch_idx == 0:
                h_front = round(min(17.0, max(13.0, D * 0.32 + jitter)), 2)
                h_mid = round(min(18.0, max(13.0, D * 0.35 - jitter)), 2)
                h_rear = round(D - h_front - h_mid, 2)

                # Front: Parking Left, Formal Living Right (North-East entry quadrant)
                if parking:
                    w_park = round(min(12.0, max(9.5, W * 0.32)), 2)
                    w_liv = round(W - w_park, 2)
                    raw_boxes.append((parking["id"], parking.get("name", "Car Parking"), "parking", 0.0, 0.0, w_park, h_front))
                    if living:
                        raw_boxes.append((living["id"], living.get("name", "Living Room"), "living", w_park, 0.0, w_liv, h_front))
                elif living:
                    raw_boxes.append((living["id"], living.get("name", "Living Room"), "living", 0.0, 0.0, W, h_front))

                # Mid: Left (Pooja/Bath), Center (Dining Brahmasthan), Right (Kitchen/Utility Agni)
                w_left = round(min(7.5, max(5.5, W * 0.20)), 2) if (pooja or common_baths) else 0.0
                w_right = round(min(12.0, max(9.0, W * 0.30)), 2) if (kitchen or utility) else 0.0
                w_din = round(W - w_left - w_right, 2)
                y_mid = h_front

                if pooja and common_baths:
                    hp = round(h_mid * 0.45, 2)
                    hb = round(h_mid - hp, 2)
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", 0.0, y_mid, w_left, hp))
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", 0.0, round(y_mid + hp, 2), w_left, hb))
                elif pooja:
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", 0.0, y_mid, w_left, h_mid))
                elif common_baths:
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", 0.0, y_mid, w_left, h_mid))

                if dining:
                    raw_boxes.append((dining["id"], dining.get("name", "Dining Hall"), "dining", w_left, y_mid, w_din, h_mid))

                if kitchen and utility:
                    hk = round(h_mid * 0.65, 2)
                    hu = round(h_mid - hk, 2)
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Kitchen"), "kitchen", round(w_left + w_din, 2), y_mid, w_right, hk))
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", round(w_left + w_din, 2), round(y_mid + hk, 2), w_right, hu))
                elif kitchen:
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Kitchen"), "kitchen", round(w_left + w_din, 2), y_mid, w_right, h_mid))
                elif utility:
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", round(w_left + w_din, 2), y_mid, w_right, h_mid))

                # Rear: Master Suite on Left (SW Niruthi corner), Other Beds on Right
                y_rear = round(y_mid + h_mid, 2)
                if other_beds:
                    w_mzone = round(W * 0.52, 2)
                    w_ozone = round(W - w_mzone, 2)
                    if master_bath:
                        w_mb = 5.5
                        w_mbed = round(w_mzone - w_mb, 2)
                        if master:
                            raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
                        raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom"), "attached_bathroom", w_mbed, y_rear, w_mb, h_rear))
                    elif master:
                        raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, w_mzone, h_rear))

                    n_ob = len(other_beds)
                    w_ob_col = round(w_ozone / n_ob, 2)
                    for i, bed in enumerate(other_beds):
                        bx = round(w_mzone + i * w_ob_col, 2)
                        bw = round(W - bx if i == n_ob - 1 else w_ob_col, 2)
                        bname = bed.get("name") or f"Bedroom {i+2}"
                        raw_boxes.append((bed["id"], bname, "bedroom", bx, y_rear, bw, h_rear))
                else:
                    if master_bath:
                        w_mb = 6.0
                        w_mbed = round(W - w_mb, 2)
                        if master:
                            raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
                        raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom"), "attached_bathroom", w_mbed, y_rear, w_mb, h_rear))
                    elif master:
                        raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, W, h_rear))

            # ARCHETYPE 1: Contemporary Open Great-Room Layout
            elif arch_idx == 1:
                h_front = round(min(18.0, max(14.0, D * 0.35 + jitter)), 2)
                h_mid = round(min(16.0, max(12.0, D * 0.30 - jitter)), 2)
                h_rear = round(D - h_front - h_mid, 2)

                # Front: Open Living Lounge Left, Parking Right
                if parking:
                    w_park = round(min(12.0, max(9.5, W * 0.32)), 2)
                    w_liv = round(W - w_park, 2)
                    if living:
                        raw_boxes.append((living["id"], living.get("name", "Living Lounge"), "living", 0.0, 0.0, w_liv, h_front))
                    raw_boxes.append((parking["id"], parking.get("name", "Car Parking"), "parking", w_liv, 0.0, w_park, h_front))
                elif living:
                    raw_boxes.append((living["id"], living.get("name", "Living Lounge"), "living", 0.0, 0.0, W, h_front))

                # Mid: Left (Island Kitchen & Utility), Center (Open Dining), Right (Pooja & Bath)
                y_mid = h_front
                w_kit_zone = round(min(12.0, max(9.0, W * 0.32)), 2) if (kitchen or utility) else 0.0
                w_right = round(min(8.0, max(6.0, W * 0.22)), 2) if (pooja or common_baths) else 0.0
                w_din = round(W - w_kit_zone - w_right, 2)

                if kitchen and utility:
                    hk = round(h_mid * 0.68, 2)
                    hu = round(h_mid - hk, 2)
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Island Kitchen"), "kitchen", 0.0, y_mid, w_kit_zone, hk))
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", 0.0, round(y_mid + hk, 2), w_kit_zone, hu))
                elif kitchen:
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Island Kitchen"), "kitchen", 0.0, y_mid, w_kit_zone, h_mid))
                elif utility:
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", 0.0, y_mid, w_kit_zone, h_mid))

                if dining:
                    raw_boxes.append((dining["id"], dining.get("name", "Dining Area"), "dining", w_kit_zone, y_mid, w_din, h_mid))

                x_right = round(w_kit_zone + w_din, 2)
                if pooja and common_baths:
                    hp = round(h_mid * 0.45, 2)
                    hb = round(h_mid - hp, 2)
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", x_right, y_mid, w_right, hp))
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", x_right, round(y_mid + hp, 2), w_right, hb))
                elif pooja:
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", x_right, y_mid, w_right, h_mid))
                elif common_baths:
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", x_right, y_mid, w_right, h_mid))

                # Rear: Bed 2 on Left, Master Suite on Right with garden outlook
                y_rear = round(y_mid + h_mid, 2)
                if other_beds:
                    w_b2 = round(W * 0.46, 2)
                    w_msuite = round(W - w_b2, 2)
                    bed2 = other_beds[0]
                    raw_boxes.append((bed2["id"], bed2.get("name", "Bedroom 2"), "bedroom", 0.0, y_rear, w_b2, h_rear))

                    if master_bath:
                        w_mb = 5.5
                        w_mbed = round(w_msuite - w_mb, 2)
                        if master:
                            raw_boxes.append((master["id"], master.get("name", "Master Suite"), "master_bedroom", w_b2, y_rear, w_mbed, h_rear))
                        raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom"), "attached_bathroom", round(w_b2 + w_mbed, 2), y_rear, w_mb, h_rear))
                    elif master:
                        raw_boxes.append((master["id"], master.get("name", "Master Suite"), "master_bedroom", w_b2, y_rear, w_msuite, h_rear))
                else:
                    if master_bath:
                        w_mb = 6.0
                        w_mbed = round(W - w_mb, 2)
                        if master:
                            raw_boxes.append((master["id"], master.get("name", "Master Suite"), "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
                        raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom"), "attached_bathroom", w_mbed, y_rear, w_mb, h_rear))
                    elif master:
                        raw_boxes.append((master["id"], master.get("name", "Master Suite"), "master_bedroom", 0.0, y_rear, W, h_rear))

            # ARCHETYPE 2: Split-Wing Generational Suite Layout
            elif arch_idx == 2:
                h_front = round(min(17.0, max(13.0, D * 0.33 + jitter)), 2)
                h_mid = round(min(17.0, max(13.0, D * 0.33 - jitter)), 2)
                h_rear = round(D - h_front - h_mid, 2)

                # Front: Step-Free Bedroom Suite Left, Family Living Center, Parking Right
                y_front = 0.0
                w_park = round(min(11.5, max(9.5, W * 0.30)), 2) if parking else 0.0
                front_bed = other_beds[0] if other_beds else None
                w_fbed = round(min(13.0, max(10.0, W * 0.35)), 2) if front_bed else 0.0
                w_liv = round(W - w_fbed - w_park, 2)

                if front_bed:
                    raw_boxes.append((front_bed["id"], front_bed.get("name", "Guest / Elderly Suite"), "bedroom", 0.0, y_front, w_fbed, h_front))
                if living:
                    raw_boxes.append((living["id"], living.get("name", "Family Living Room"), "living", w_fbed, y_front, w_liv, h_front))
                if parking:
                    raw_boxes.append((parking["id"], parking.get("name", "Car Parking"), "parking", round(w_fbed + w_liv, 2), y_front, w_park, h_front))

                # Mid: Left (Common Bath & Pooja), Center (Family Dining), Right (Kitchen & Utility)
                y_mid = h_front
                w_left = round(min(8.0, max(6.0, W * 0.22)), 2) if (common_baths or pooja) else 0.0
                w_right = round(min(12.0, max(9.0, W * 0.30)), 2) if (kitchen or utility) else 0.0
                w_din = round(W - w_left - w_right, 2)

                if common_baths and pooja:
                    hb = round(h_mid * 0.55, 2)
                    hp = round(h_mid - hb, 2)
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", 0.0, y_mid, w_left, hb))
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", 0.0, round(y_mid + hb, 2), w_left, hp))
                elif common_baths:
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", 0.0, y_mid, w_left, h_mid))
                elif pooja:
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", 0.0, y_mid, w_left, h_mid))

                if dining:
                    raw_boxes.append((dining["id"], dining.get("name", "Family Dining"), "dining", w_left, y_mid, w_din, h_mid))

                x_right = round(w_left + w_din, 2)
                if kitchen and utility:
                    hk = round(h_mid * 0.65, 2)
                    hu = round(h_mid - hk, 2)
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Kitchen"), "kitchen", x_right, y_mid, w_right, hk))
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", x_right, round(y_mid + hk, 2), w_right, hu))
                elif kitchen:
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Kitchen"), "kitchen", x_right, y_mid, w_right, h_mid))
                elif utility:
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", x_right, y_mid, w_right, h_mid))

                # Rear: Master Suite on Left, Additional Bedroom (if any) on Right
                y_rear = round(y_mid + h_mid, 2)
                rear_beds = other_beds[1:] if len(other_beds) > 1 else []
                if rear_beds:
                    w_b3 = round(W * 0.45, 2)
                    w_mzone = round(W - w_b3, 2)
                    if master_bath:
                        w_mb = 5.5
                        w_mbed = round(w_mzone - w_mb, 2)
                        if master:
                            raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
                        raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom"), "attached_bathroom", w_mbed, y_rear, w_mb, h_rear))
                    elif master:
                        raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, w_mzone, h_rear))

                    raw_boxes.append((rear_beds[0]["id"], rear_beds[0].get("name", "Bedroom 3"), "bedroom", w_mzone, y_rear, w_b3, h_rear))
                else:
                    if master_bath:
                        w_mb = 6.0
                        w_mbed = round(W - w_mb, 2)
                        if master:
                            raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
                        raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom"), "attached_bathroom", w_mbed, y_rear, w_mb, h_rear))
                    elif master:
                        raw_boxes.append((master["id"], master.get("name", "Master Bedroom"), "master_bedroom", 0.0, y_rear, W, h_rear))

            # ARCHETYPE 3: Linear Breezeway & Dual Master Suite Layout
            else:
                h_front = round(min(16.0, max(12.0, D * 0.29 + jitter)), 2)
                h_mid = round(min(18.0, max(14.0, D * 0.35 - jitter)), 2)
                h_rear = round(D - h_front - h_mid, 2)

                # Front: Parking Left, Formal Living Right
                if parking:
                    w_park = round(min(12.0, max(9.5, W * 0.32)), 2)
                    w_liv = round(W - w_park, 2)
                    raw_boxes.append((parking["id"], parking.get("name", "Car Parking"), "parking", 0.0, 0.0, w_park, h_front))
                    if living:
                        raw_boxes.append((living["id"], living.get("name", "Formal Living"), "living", w_park, 0.0, w_liv, h_front))
                elif living:
                    raw_boxes.append((living["id"], living.get("name", "Formal Living"), "living", 0.0, 0.0, W, h_front))

                # Mid: Linear Breezeway Dining & Kitchen
                y_mid = h_front
                w_din = round(min(14.0, max(10.0, W * 0.38)), 2) if dining else 0.0
                w_kit = round(min(12.0, max(9.0, W * 0.32)), 2) if kitchen else 0.0
                w_serv = round(W - w_din - w_kit, 2)

                if dining:
                    raw_boxes.append((dining["id"], dining.get("name", "Breezeway Dining"), "dining", 0.0, y_mid, w_din, h_mid))

                x_kit = w_din
                if kitchen and utility:
                    hk = round(h_mid * 0.65, 2)
                    hu = round(h_mid - hk, 2)
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Linear Kitchen"), "kitchen", x_kit, y_mid, w_kit, hk))
                    raw_boxes.append((utility["id"], utility.get("name", "Utility Area"), "utility", x_kit, round(y_mid + hk, 2), w_kit, hu))
                elif kitchen:
                    raw_boxes.append((kitchen["id"], kitchen.get("name", "Linear Kitchen"), "kitchen", x_kit, y_mid, w_kit, h_mid))

                x_serv = round(w_din + w_kit, 2)
                if pooja and common_baths:
                    hp = round(h_mid * 0.45, 2)
                    hb = round(h_mid - hp, 2)
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", x_serv, y_mid, w_serv, hp))
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", x_serv, round(y_mid + hp, 2), w_serv, hb))
                elif pooja:
                    raw_boxes.append((pooja["id"], pooja.get("name", "Pooja Room"), "pooja", x_serv, y_mid, w_serv, h_mid))
                elif common_baths:
                    raw_boxes.append((common_baths[0]["id"], common_baths[0].get("name", "Common Bathroom"), "bathroom", x_serv, y_mid, w_serv, h_mid))

                # Rear: Dual Primary Suites
                y_rear = round(y_mid + h_mid, 2)
                w_m1 = round(W * 0.5, 2)
                w_m2 = round(W - w_m1, 2)

                # Primary Suite 1
                if master_bath:
                    w_mb = 5.5
                    w_mbed = round(w_m1 - w_mb, 2)
                    if master:
                        raw_boxes.append((master["id"], master.get("name", "Primary Suite 1"), "master_bedroom", 0.0, y_rear, w_mbed, h_rear))
                    raw_boxes.append((master_bath["id"], master_bath.get("name", "Attached Bathroom 1"), "attached_bathroom", w_mbed, y_rear, w_mb, h_rear))
                elif master:
                    raw_boxes.append((master["id"], master.get("name", "Primary Suite 1"), "master_bedroom", 0.0, y_rear, w_m1, h_rear))

                # Suite 2
                bed2 = other_beds[0] if other_beds else None
                if bed2:
                    raw_boxes.append((bed2["id"], bed2.get("name", "Primary Suite 2"), "bedroom", w_m1, y_rear, w_m2, h_rear))
                elif not master:
                    raw_boxes.append(("extra_suite", "Suite 2", "bedroom", w_m1, y_rear, w_m2, h_rear))

        # Convert normalized coordinates (u, v) into global plot envelope coordinates (x, y)
        placed_rooms: list[RectRoom] = []
        rs = self.road_side.upper()

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

        return placed_rooms

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
