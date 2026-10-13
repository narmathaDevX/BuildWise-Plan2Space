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
            p["name"] = f"Layout {letter}"

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

        # Generate Ground Floor
        g_placed = self._slice_floor(rng, envelope, ground_rooms, is_ground=True)
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
            u_placed = self._slice_floor(rng, envelope, u_rooms, is_ground=False)
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
            "name": f"Layout Option {alt_index + 1}",
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

    def _slice_floor(
        self,
        rng: random.Random,
        envelope: Envelope,
        rooms_to_place: list[dict[str, Any]],
        is_ground: bool,
    ) -> list[RectRoom] | None:
        if not rooms_to_place:
            return []

        # Categorize rooms by functional zone
        # Public zone (living, dining, parking) -> closer to road
        # Service zone (kitchen, utility, pooja)
        # Private zone (master bedroom, bedrooms, bathrooms)
        # Staircase
        rooms = list(rooms_to_place)

        # Find master and master bath to keep them adjacent
        master = next((r for r in rooms if r.get("id") == "master" or r.get("type") == "master_bedroom"), None)
        master_bath = next((r for r in rooms if r.get("attached_to") == "master"), None)

        # Target areas
        total_min = sum(float(r.get("min_area", 100)) for r in rooms)
        avail_area = envelope.area
        scale = max(1.0, min(1.35, avail_area / (total_min * 1.15)))

        placed_rooms: list[RectRoom] = []

        # Divide envelope into 2 or 3 bands along depth or width depending on road_side
        # If road_side == N: top band = public, middle = circulation/services, bottom = private
        # If road_side == S: bottom = public, top = private
        # If road_side == W: left = public, right = private
        # If road_side == E: right = public, left = private
        split_vertical = envelope.width >= envelope.height

        # Group rooms
        public_list = [r for r in rooms if r.get("type") in {"living", "dining", "parking"}]
        service_list = [r for r in rooms if r.get("type") in {"kitchen", "utility", "pooja", "staircase"}]
        private_list = [r for r in rooms if r not in public_list and r not in service_list]

        # Order bands based on road_side
        road = self.road_side
        if road == "N":
            bands_order = [public_list, service_list, private_list]
            reverse_band = False
        elif road == "S":
            bands_order = [private_list, service_list, public_list]
            reverse_band = False
        elif road == "W":
            bands_order = [public_list, service_list, private_list]
            reverse_band = False
        else:
            bands_order = [private_list, service_list, public_list]
            reverse_band = False

        # Filter out empty bands
        active_bands = [b for b in bands_order if b]
        if not active_bands:
            active_bands = [rooms]

        num_bands = len(active_bands)
        curr_y = envelope.min_y
        band_height = envelope.height / num_bands

        for band_idx, band in enumerate(active_bands):
            b_y = envelope.min_y + band_idx * band_height
            b_h = band_height
            curr_x = envelope.min_x
            n_rooms = len(band)
            room_width = envelope.width / max(1, n_rooms)

            # Randomize slightly with rng
            widths = [room_width] * n_rooms
            if n_rooms > 1:
                jitter = rng.uniform(-1.0, 1.0)
                widths[0] = max(8.0, widths[0] + jitter)
                rem = (envelope.width - widths[0]) / (n_rooms - 1)
                for i in range(1, n_rooms):
                    widths[i] = rem

            for i, r in enumerate(band):
                rx = curr_x
                ry = b_y
                rw = widths[i]
                rh = b_h
                rname = r.get("name") or r.get("type", "").replace("_", " ").title()

                # Ensure minimum width
                min_w = 4.5 if "bath" in r.get("type", "") else 7.5
                if rw < min_w:
                    rw = min_w
                if rh < min_w:
                    rh = min_w

                placed = RectRoom(
                    id=r.get("id"),
                    type=r.get("type"),
                    name=rname,
                    x=rx,
                    y=ry,
                    width=rw,
                    height=rh,
                )
                placed_rooms.append(placed)
                curr_x += rw

        # Check attached bathroom adjacency
        if master and master_bath:
            mb_room = next((p for p in placed_rooms if p.id == master.get("id")), None)
            m_bath_room = next((p for p in placed_rooms if p.id == master_bath.get("id")), None)
            if mb_room and m_bath_room:
                # Pair them by sharing wall
                # Position bath adjacent to master
                m_bath_room.x = mb_room.x
                m_bath_room.y = mb_room.y + mb_room.height - m_bath_room.height

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
