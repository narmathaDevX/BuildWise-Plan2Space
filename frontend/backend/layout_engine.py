from dataclasses import dataclass, asdict
from typing import Dict, Any


# ============================================================
# ROOM
# ============================================================

@dataclass
class Room:
    name: str
    type: str
    x: float
    y: float
    width: float
    height: float
    floor: int = 1
    parent: str = None

    @property
    def area(self):
        return round(self.width * self.height, 2)

    @property
    def center_x(self):
        return self.x + self.width / 2

    @property
    def center_y(self):
        return self.y + self.height / 2

    def to_dict(self):
        data = asdict(self)
        data["area"] = self.area
        return data


# ============================================================
# HOUSE PLAN GENERATOR
# ============================================================

class HousePlanGenerator:

    def __init__(self, data: Dict[str, Any]):

        self.length = float(data.get("length", 60))
        self.width = float(data.get("width", 40))
        self.facing = data.get("facing", "North")

        self.bedrooms = int(data.get("bedrooms", 3))
        self.bathrooms = int(data.get("bathrooms", 2))
        self.floors = int(data.get("floors", 1))

        self.parking = bool(data.get("parking", True))
        self.balcony = bool(data.get("balcony", False))
        self.pooja = bool(data.get("pooja", False))
        self.utility = bool(data.get("utility", True))

        self.budget = float(
            data.get("budget", 3500000)
        )

        self.quality = data.get(
            "quality",
            "Standard"
        )

        # Setbacks
        self.front_setback = 8
        self.rear_setback = 4
        self.side_setback = 4

        self.buildable_length = (
            self.length
            - 2 * self.side_setback
        )

        self.buildable_width = (
            self.width
            - self.front_setback
            - self.rear_setback
        )

    # ========================================================
    # ROOM CREATOR
    # ========================================================

    def room(
        self,
        name,
        room_type,
        x,
        y,
        width,
        height,
        parent=None
    ):

        return Room(
            name=name,
            type=room_type,
            x=round(x, 2),
            y=round(y, 2),
            width=round(width, 2),
            height=round(height, 2),
            parent=parent
        )

    # ========================================================
    # COST
    # ========================================================

    def rate(self):

        return {
            "Basic": 1800,
            "Standard": 2200,
            "Premium": 2800
        }.get(self.quality, 2200)

    def calculate_cost(self, rooms):

        area = sum(
            r.area
            for r in rooms
            if r.type not in [
                "parking",
                "circulation"
            ]
        )

        cost = area * self.rate()

        return {
            "built_up_area": round(area, 2),
            "rate_per_sqft": self.rate(),
            "construction_cost": round(cost, 2),
            "budget": self.budget,
            "within_budget": cost <= self.budget
        }

    # ========================================================
    # MAIN LAYOUT
    # ========================================================

    def create_layout(self):

        rooms = []

        x0 = self.side_setback
        y0 = self.front_setback

        # ====================================================
        # FRONT ZONE
        # ====================================================

        foyer = self.room(
            "Foyer",
            "common",
            x0,
            y0,
            6,
            5
        )

        living = self.room(
            "Living Room",
            "common",
            10,
            y0,
            12,
            12
        )

        dining = self.room(
            "Dining",
            "common",
            22,
            y0,
            14,
            12
        )

        kitchen = self.room(
            "Kitchen",
            "service",
            36,
            y0,
            12,
            10
        )

        rooms.extend([
            foyer,
            living,
            dining,
            kitchen
        ])

        # ====================================================
        # UTILITY
        # ====================================================

        if self.utility:

            utility = self.room(
                "Utility",
                "service",
                48,
                y0,
                8,
                6
            )

            rooms.append(utility)

        # ====================================================
        # PRIVATE ZONE
        # ====================================================

        private_y = 20

        # ----------------------------------------------------
        # MASTER
        # ----------------------------------------------------

        master = self.room(
            "Master Bedroom",
            "bedroom",
            4,
            private_y,
            16,
            12
        )

        rooms.append(master)

        # ----------------------------------------------------
        # ATTACHED BATHROOM
        #
        # It is intentionally marked as a child of the
        # master bedroom. Therefore its overlap is allowed.
        # ----------------------------------------------------

        master_bath = self.room(
            "Master Bathroom",
            "attached_bathroom",
            14,
            25,
            6,
            7,
            parent="Master Bedroom"
        )

        rooms.append(master_bath)

        # ----------------------------------------------------
        # CIRCULATION
        # ----------------------------------------------------

        corridor = self.room(
            "Circulation",
            "circulation",
            20,
            20,
            4,
            16
        )

        rooms.append(corridor)

        # ----------------------------------------------------
        # BEDROOM 2
        # ----------------------------------------------------

        bedroom2 = self.room(
            "Bedroom 2",
            "bedroom",
            24,
            20,
            14,
            8
        )

        rooms.append(bedroom2)

        # ----------------------------------------------------
        # BEDROOM 3
        # ----------------------------------------------------

        bedroom3 = self.room(
            "Bedroom 3",
            "bedroom",
            24,
            28,
            14,
            8
        )

        rooms.append(bedroom3)

        # ----------------------------------------------------
        # COMMON BATH
        # ----------------------------------------------------

        if self.bathrooms >= 2:

            common_bath = self.room(
                "Common Bathroom",
                "bathroom",
                38,
                20,
                8,
                7
            )

            rooms.append(common_bath)

        # ----------------------------------------------------
        # POOJA
        # ----------------------------------------------------

        if self.pooja:

            pooja = self.room(
                "Pooja Room",
                "common",
                31,
                15,
                5,
                5
            )

            rooms.append(pooja)

        # ----------------------------------------------------
        # PARKING
        # ----------------------------------------------------

        if self.parking:

            parking = self.room(
                "Parking",
                "parking",
                4,
                0,
                18,
                8
            )

            rooms.append(parking)

        return rooms

    # ========================================================
    # OVERLAP
    # ========================================================

    def overlaps(self, a, b):

        # Parking is outside building.
        if "parking" in [a.type, b.type]:
            return False

        # Attached bathroom is intentionally inside parent.
        if (
            a.parent == b.name
            or b.parent == a.name
        ):
            return False

        return not (
            a.x + a.width <= b.x
            or b.x + b.width <= a.x
            or a.y + a.height <= b.y
            or b.y + b.height <= a.y
        )

    def check_overlaps(self, rooms):

        problems = []

        for i in range(len(rooms)):

            for j in range(i + 1, len(rooms)):

                if self.overlaps(
                    rooms[i],
                    rooms[j]
                ):

                    problems.append(
                        f"{rooms[i].name} overlaps "
                        f"{rooms[j].name}"
                    )

        return problems

    # ========================================================
    # DIMENSION VALIDATION
    # ========================================================

    def check_dimensions(self, rooms):

        minimum = {

            "Foyer": 20,
            "Living Room": 120,
            "Dining": 90,
            "Kitchen": 80,
            "Utility": 30,
            "Master Bedroom": 120,
            "Bedroom 2": 90,
            "Bedroom 3": 90,
            "Master Bathroom": 30,
            "Common Bathroom": 30
        }

        problems = []

        for r in rooms:

            if r.type in [
                "parking",
                "circulation"
            ]:
                continue

            if r.area < minimum.get(
                r.name,
                25
            ):

                problems.append(
                    f"{r.name} is too small"
                )

            if min(
                r.width,
                r.height
            ) < 4:

                problems.append(
                    f"{r.name} is too narrow"
                )

        return problems

    # ========================================================
    # SETBACK VALIDATION
    # ========================================================

    def check_setbacks(self, rooms):

        problems = []

        left = self.side_setback
        right = (
            self.length
            - self.side_setback
        )

        front = self.front_setback
        rear = (
            self.width
            - self.rear_setback
        )

        for r in rooms:

            if r.type == "parking":
                continue

            if r.x < left:
                problems.append(
                    f"{r.name} crosses left setback"
                )

            if r.x + r.width > right:
                problems.append(
                    f"{r.name} crosses right setback"
                )

            if r.y < front:
                problems.append(
                    f"{r.name} crosses front setback"
                )

            if r.y + r.height > rear:
                problems.append(
                    f"{r.name} crosses rear setback"
                )

        return problems

    # ========================================================
    # ADJACENCY
    # ========================================================

    def distance(self, a, b):

        return (
            abs(
                a.center_x - b.center_x
            )
            +
            abs(
                a.center_y - b.center_y
            )
        )

    def check_adjacency(self, rooms):

        problems = []

        lookup = {
            r.name: r
            for r in rooms
        }

        kitchen = lookup.get("Kitchen")
        dining = lookup.get("Dining")
        utility = lookup.get("Utility")
        master = lookup.get("Master Bedroom")
        master_bath = lookup.get(
            "Master Bathroom"
        )

        # Kitchen ↔ Dining
        if kitchen and dining:

            if self.distance(
                kitchen,
                dining
            ) > 25:

                problems.append(
                    "Kitchen too far from dining"
                )

        # Kitchen ↔ Utility
        if kitchen and utility:

            if self.distance(
                kitchen,
                utility
            ) > 20:

                problems.append(
                    "Utility too far from kitchen"
                )

        # Master ↔ Attached Bath
        if master and master_bath:

            if self.distance(
                master,
                master_bath
            ) > 20:

                problems.append(
                    "Master bathroom too far "
                    "from master bedroom"
                )

        return problems

    # ========================================================
    # CIRCULATION
    # ========================================================

    def check_circulation(self, rooms):

        problems = []

        bedrooms = [
            r for r in rooms
            if r.type == "bedroom"
        ]

        corridor = next(
            (
                r for r in rooms
                if r.type == "circulation"
            ),
            None
        )

        if len(bedrooms) >= 2:

            if corridor is None:

                problems.append(
                    "Bedroom circulation missing"
                )

        return problems

    # ========================================================
    # VALIDATION
    # ========================================================

    def validate(self, rooms):

        problems = []

        problems.extend(
            self.check_overlaps(rooms)
        )

        problems.extend(
            self.check_dimensions(rooms)
        )

        problems.extend(
            self.check_setbacks(rooms)
        )

        problems.extend(
            self.check_adjacency(rooms)
        )

        problems.extend(
            self.check_circulation(rooms)
        )

        return problems

    # ========================================================
    # SCORE
    # ========================================================

    def score(self, rooms):

        issues = self.validate(rooms)

        score = 100

        score -= len(issues) * 15

        cost = self.calculate_cost(
            rooms
        )

        if cost["within_budget"]:
            score += 20
        else:
            score -= 20

        # Good kitchen/dining relationship
        lookup = {
            r.name: r
            for r in rooms
        }

        kitchen = lookup.get("Kitchen")
        dining = lookup.get("Dining")

        if kitchen and dining:

            if self.distance(
                kitchen,
                dining
            ) < self.buildable_length * 0.55:

                score += 10

        # Parking at front
        parking = lookup.get("Parking")

        if parking and parking.y == 0:
            score += 10

        return max(
            round(score, 2),
            0
        )

    # ========================================================
    # GENERATE
    # ========================================================

    def generate(self):

        rooms = self.create_layout()

        validation = self.validate(
            rooms
        )

        cost = self.calculate_cost(
            rooms
        )

        return {

            "status": (
                "valid"
                if not validation
                else "needs_review"
            ),

            "score": self.score(
                rooms
            ),

            "candidates_evaluated": 1,

            "plot": {

                "length": self.length,
                "width": self.width,
                "area": round(
                    self.length * self.width,
                    2
                ),
                "facing": self.facing
            },

            "setbacks": {

                "front": self.front_setback,
                "rear": self.rear_setback,
                "left": self.side_setback,
                "right": self.side_setback
            },

            "requirements": {

                "bedrooms": self.bedrooms,
                "bathrooms": self.bathrooms,
                "floors": self.floors,
                "parking": self.parking,
                "balcony": self.balcony,
                "pooja": self.pooja,
                "utility": self.utility,
                "quality": self.quality
            },

            "rooms": [
                r.to_dict()
                for r in rooms
            ],

            "cost": cost,

            "validation": {

                "valid": not validation,

                "issues": validation
            }
        }


# ============================================================
# PUBLIC FUNCTION
# ============================================================

def generate_house_plan(
    data: Dict[str, Any]
):

    generator = HousePlanGenerator(
        data
    )

    return generator.generate()


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    data = {

        "length": 60,
        "width": 40,
        "facing": "North",
        "location": "Tamil Nadu",

        "bedrooms": 3,
        "bathrooms": 2,
        "floors": 1,

        "parking": True,
        "balcony": True,
        "pooja": False,
        "utility": True,

        "budget": 3500000,
        "monthlyBudget": 300000,

        "quality": "Standard"
    }

    result = generate_house_plan(
        data
    )

    print("\n==============================")
    print("BUILDWISE HOUSE PLAN")
    print("==============================")

    print(
        "\nStatus:",
        result["status"]
    )

    print(
        "Score:",
        result["score"]
    )

    print(
        "Candidates:",
        result["candidates_evaluated"]
    )

    print("\nCost:")
    print(result["cost"])

    print("\nValidation:")
    print(result["validation"])

    print("\nRooms:")

    for r in result["rooms"]:

        print(
            f"{r['name']}: "
            f"{r['width']} x "
            f"{r['height']} = "
            f"{r['area']} sq.ft "
            f"at ({r['x']}, {r['y']})"
        )