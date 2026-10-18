"""Interior Design Studio furniture catalogue specifications and preset palettes."""

from app.schemas.design import (
    CatalogueResponse,
    FurnitureCategorySpec,
    FurnitureItemSpec,
    FurnitureVariantSpec,
    ColorPreset,
)

COLOR_PRESETS = [
    # Warm Whites & Creams
    ColorPreset(name="Pure White", hex="#FFFFFF", category="Whites & Creams"),
    ColorPreset(name="Soft Alabaster", hex="#F8F7F2", category="Whites & Creams"),
    ColorPreset(name="Warm Linen", hex="#EDE6D6", category="Whites & Creams"),
    ColorPreset(name="Cream White", hex="#F5F2EB", category="Whites & Creams"),
    # Greys & Neutrals
    ColorPreset(name="Pale Mist", hex="#E2E8F0", category="Greys & Neutrals"),
    ColorPreset(name="Modern Greige", hex="#D1CCC0", category="Greys & Neutrals"),
    ColorPreset(name="Charcoal Slate", hex="#334155", category="Greys & Neutrals"),
    ColorPreset(name="Midnight Black", hex="#1E293B", category="Greys & Neutrals"),
    # Blues
    ColorPreset(name="Coastal Sky", hex="#93C5FD", category="Blues"),
    ColorPreset(name="French Blue", hex="#3B82F6", category="Blues"),
    ColorPreset(name="Ocean Navy", hex="#1E3A8A", category="Blues"),
    ColorPreset(name="Slate Blue", hex="#475569", category="Blues"),
    # Greens
    ColorPreset(name="Sage Whisper", hex="#A7F3D0", category="Greens"),
    ColorPreset(name="Olive Grove", hex="#65A30D", category="Greens"),
    ColorPreset(name="Forest Green", hex="#166534", category="Greens"),
    ColorPreset(name="Mint Breeze", hex="#6EE7B7", category="Greens"),
    # Terracotta & Warm Earth
    ColorPreset(name="Terracotta Clay", hex="#C2410C", category="Warm & Earth"),
    ColorPreset(name="Warm Ochre", hex="#D97706", category="Warm & Earth"),
    ColorPreset(name="Desert Sand", hex="#E5C79E", category="Warm & Earth"),
    ColorPreset(name="Deep Espresso", hex="#451A03", category="Warm & Earth"),
    # Pastels & Accents
    ColorPreset(name="Dusty Rose", hex="#FDA4AF", category="Pastels & Accents"),
    ColorPreset(name="Muted Coral", hex="#FB7185", category="Pastels & Accents"),
    ColorPreset(name="Lavender Haze", hex="#C4B5FD", category="Pastels & Accents"),
    ColorPreset(name="Pale Primrose", hex="#FEF08A", category="Pastels & Accents"),
]

CATALOGUE_CATEGORIES = [
    # 1. Beds
    FurnitureCategorySpec(
        category_id="beds",
        name="Beds",
        icon="bed",
        items=[
            FurnitureItemSpec(
                type_id="bed",
                name="Bed",
                category="beds",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="single",
                        name="Single Bed",
                        default_dimensions=[0.9, 1.9, 0.9],
                        default_colors={"primary": "#EDE6D6", "secondary": "#475569"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="double",
                        name="Double Bed",
                        default_dimensions=[1.5, 2.0, 1.0],
                        default_colors={"primary": "#EDE6D6", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="king",
                        name="King Bed",
                        default_dimensions=[1.8, 2.0, 1.1],
                        default_colors={"primary": "#F8F7F2", "secondary": "#1E293B"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="bunk_bed",
                name="Bunk Bed",
                category="beds",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="bunk",
                        name="Bunk Bed",
                        default_dimensions=[0.9, 1.9, 1.6],
                        default_colors={"primary": "#D1CCC0", "secondary": "#3B82F6"},
                    ),
                ],
            ),
        ],
    ),
    # 2. Seating
    FurnitureCategorySpec(
        category_id="seating",
        name="Seating",
        icon="sofa",
        items=[
            FurnitureItemSpec(
                type_id="sofa",
                name="Sofa",
                category="seating",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="2-seater",
                        name="2-Seater Sofa",
                        default_dimensions=[1.5, 0.85, 0.8],
                        default_colors={"primary": "#475569", "secondary": "#E2E8F0"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="3-seater",
                        name="3-Seater Sofa",
                        default_dimensions=[2.1, 0.9, 0.85],
                        default_colors={"primary": "#334155", "secondary": "#F8F7F2"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="l-shaped",
                        name="L-Shaped Sectional",
                        default_dimensions=[2.4, 1.8, 0.85],
                        default_colors={"primary": "#1E293B", "secondary": "#93C5FD"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="armchair",
                name="Armchair",
                category="seating",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="armchair",
                        name="Lounge Armchair",
                        default_dimensions=[0.85, 0.85, 0.8],
                        default_colors={"primary": "#C2410C", "secondary": "#1E293B"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="chair",
                name="Chair",
                category="seating",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="dining_chair",
                        name="Dining Chair",
                        default_dimensions=[0.5, 0.5, 0.9],
                        default_colors={"primary": "#D1CCC0", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="office_chair",
                        name="Office Chair",
                        default_dimensions=[0.6, 0.6, 1.0],
                        default_colors={"primary": "#1E293B", "secondary": "#3B82F6"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="stool",
                name="Stool",
                category="seating",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="stool",
                        name="Bar Stool",
                        default_dimensions=[0.4, 0.4, 0.75],
                        default_colors={"primary": "#334155", "secondary": "#D97706"},
                    ),
                ],
            ),
        ],
    ),
    # 3. Storage
    FurnitureCategorySpec(
        category_id="storage",
        name="Storage",
        icon="archive",
        items=[
            FurnitureItemSpec(
                type_id="wardrobe",
                name="Wardrobe",
                category="storage",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="2-door",
                        name="2-Door Wardrobe",
                        default_dimensions=[1.0, 0.6, 2.1],
                        default_colors={"primary": "#EDE6D6", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="3-door",
                        name="3-Door Wardrobe",
                        default_dimensions=[1.5, 0.6, 2.1],
                        default_colors={"primary": "#F5F2EB", "secondary": "#1E293B"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="sliding",
                        name="Sliding Door Wardrobe",
                        default_dimensions=[1.8, 0.65, 2.1],
                        default_colors={"primary": "#E2E8F0", "secondary": "#475569"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="chest_drawers",
                name="Chest of Drawers",
                category="storage",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="chest_drawers",
                        name="4-Drawer Chest",
                        default_dimensions=[0.9, 0.5, 1.0],
                        default_colors={"primary": "#EDE6D6", "secondary": "#334155"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="bookshelf",
                name="Bookshelf",
                category="storage",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="bookshelf",
                        name="Tall Bookshelf",
                        default_dimensions=[0.8, 0.35, 1.8],
                        default_colors={"primary": "#451A03", "secondary": "#EDE6D6"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="shoe_rack",
                name="Shoe Rack",
                category="storage",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="shoe_rack",
                        name="3-Tier Shoe Rack",
                        default_dimensions=[0.8, 0.3, 0.7],
                        default_colors={"primary": "#334155", "secondary": "#D1CCC0"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="kitchen_cabinet",
                name="Kitchen Cabinet",
                category="storage",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="base_unit",
                        name="Kitchen Base Unit",
                        default_dimensions=[0.9, 0.6, 0.85],
                        default_colors={"primary": "#F8F7F2", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="wall_unit",
                        name="Kitchen Wall Unit",
                        default_dimensions=[0.9, 0.35, 0.7],
                        default_colors={"primary": "#F8F7F2", "secondary": "#475569"},
                        is_wall_mounted=True,
                    ),
                ],
            ),
        ],
    ),
    # 4. Tables
    FurnitureCategorySpec(
        category_id="tables",
        name="Tables",
        icon="table",
        items=[
            FurnitureItemSpec(
                type_id="dining_table",
                name="Dining Table",
                category="tables",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="4-seat",
                        name="4-Seat Dining Table",
                        default_dimensions=[1.2, 0.8, 0.75],
                        default_colors={"primary": "#451A03", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="6-seat",
                        name="6-Seat Dining Table",
                        default_dimensions=[1.8, 0.9, 0.75],
                        default_colors={"primary": "#451A03", "secondary": "#1E293B"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="coffee_table",
                name="Coffee Table",
                category="tables",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="rectangular",
                        name="Rectangular Coffee Table",
                        default_dimensions=[1.1, 0.6, 0.45],
                        default_colors={"primary": "#D1CCC0", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="round",
                        name="Round Coffee Table",
                        default_dimensions=[0.8, 0.8, 0.45],
                        default_colors={"primary": "#EDE6D6", "secondary": "#1E293B"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="desk",
                name="Study Desk",
                category="tables",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="study_desk",
                        name="Study Desk",
                        default_dimensions=[1.2, 0.6, 0.75],
                        default_colors={"primary": "#EDE6D6", "secondary": "#334155"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="side_table",
                name="Side Table",
                category="tables",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="bedside_table",
                        name="Bedside Table",
                        default_dimensions=[0.45, 0.4, 0.5],
                        default_colors={"primary": "#EDE6D6", "secondary": "#451A03"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="side_table",
                        name="Sofa Side Table",
                        default_dimensions=[0.5, 0.5, 0.55],
                        default_colors={"primary": "#334155", "secondary": "#D1CCC0"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="dressing_table",
                name="Dressing Table",
                category="tables",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="vanity",
                        name="Vanity Dressing Table",
                        default_dimensions=[1.0, 0.45, 1.4],
                        default_colors={"primary": "#F8F7F2", "secondary": "#FDA4AF"},
                    ),
                ],
            ),
        ],
    ),
    # 5. Electronics and Appliances
    FurnitureCategorySpec(
        category_id="electronics",
        name="Electronics & Appliances",
        icon="tv",
        items=[
            FurnitureItemSpec(
                type_id="tv",
                name="Television",
                category="electronics",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="wall-mounted",
                        name="TV (Wall-Mounted)",
                        default_dimensions=[1.2, 0.08, 0.7],
                        default_colors={"primary": "#1E293B", "secondary": "#334155"},
                        is_wall_mounted=True,
                    ),
                    FurnitureVariantSpec(
                        variant_id="on_stand",
                        name="TV on Stand",
                        default_dimensions=[1.2, 0.3, 0.75],
                        default_colors={"primary": "#1E293B", "secondary": "#475569"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="tv_unit",
                name="TV Media Console",
                category="electronics",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="tv_unit",
                        name="TV Console Unit",
                        default_dimensions=[1.6, 0.45, 0.5],
                        default_colors={"primary": "#334155", "secondary": "#EDE6D6"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="refrigerator",
                name="Refrigerator",
                category="electronics",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="double_door",
                        name="Double Door Fridge",
                        default_dimensions=[0.8, 0.75, 1.8],
                        default_colors={"primary": "#E2E8F0", "secondary": "#334155"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="single_door",
                        name="Single Door Fridge",
                        default_dimensions=[0.6, 0.65, 1.6],
                        default_colors={"primary": "#E2E8F0", "secondary": "#475569"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="washing_machine",
                name="Washing Machine",
                category="electronics",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="front_load",
                        name="Front Load Washer",
                        default_dimensions=[0.6, 0.6, 0.85],
                        default_colors={"primary": "#FFFFFF", "secondary": "#334155"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="air_conditioner",
                name="Air Conditioner",
                category="electronics",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="wall-mounted",
                        name="Wall Split AC",
                        default_dimensions=[0.9, 0.25, 0.3],
                        default_colors={"primary": "#FFFFFF", "secondary": "#E2E8F0"},
                        is_wall_mounted=True,
                    ),
                ],
            ),
        ],
    ),
    # 6. Bathroom
    FurnitureCategorySpec(
        category_id="bathroom",
        name="Bathroom",
        icon="bath",
        items=[
            FurnitureItemSpec(
                type_id="toilet",
                name="Toilet",
                category="bathroom",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="commode",
                        name="Ceramic Toilet",
                        default_dimensions=[0.4, 0.65, 0.75],
                        default_colors={"primary": "#FFFFFF", "secondary": "#E2E8F0"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="wash_basin",
                name="Wash Basin",
                category="bathroom",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="vanity_sink",
                        name="Vanity Sink",
                        default_dimensions=[0.6, 0.5, 0.85],
                        default_colors={"primary": "#FFFFFF", "secondary": "#334155"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="shower",
                name="Shower",
                category="bathroom",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="shower_cabin",
                        name="Shower Enclosure",
                        default_dimensions=[0.9, 0.9, 2.1],
                        default_colors={"primary": "#93C5FD", "secondary": "#E2E8F0"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="bathtub",
                name="Bathtub",
                category="bathroom",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="freestanding",
                        name="Freestanding Bathtub",
                        default_dimensions=[1.7, 0.75, 0.6],
                        default_colors={"primary": "#FFFFFF", "secondary": "#D1CCC0"},
                    ),
                ],
            ),
        ],
    ),
    # 7. Decor and Extras
    FurnitureCategorySpec(
        category_id="decor",
        name="Decor & Extras",
        icon="image",
        items=[
            FurnitureItemSpec(
                type_id="rug",
                name="Rug",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="rectangular",
                        name="Area Rug (Rect)",
                        default_dimensions=[2.0, 1.5, 0.02],
                        default_colors={"primary": "#EDE6D6", "secondary": "#C2410C"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="round",
                        name="Round Area Rug",
                        default_dimensions=[1.6, 1.6, 0.02],
                        default_colors={"primary": "#D1CCC0", "secondary": "#3B82F6"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="potted_plant",
                name="Potted Plant",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="floor_plant",
                        name="Tall Floor Plant",
                        default_dimensions=[0.4, 0.4, 1.1],
                        default_colors={"primary": "#166534", "secondary": "#C2410C"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="table_plant",
                        name="Small Desk Plant",
                        default_dimensions=[0.25, 0.25, 0.4],
                        default_colors={"primary": "#65A30D", "secondary": "#FFFFFF"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="ceiling_fan",
                name="Ceiling Fan",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="modern_fan",
                        name="Modern 3-Blade Wood Fan",
                        default_dimensions=[1.2, 1.2, 0.45],
                        default_colors={"primary": "#5C4033", "secondary": "#1E293B"},
                        is_ceiling_mounted=True,
                    ),
                    FurnitureVariantSpec(
                        variant_id="light_fan",
                        name="Ceiling Fan with LED Light",
                        default_dimensions=[1.2, 1.2, 0.48],
                        default_colors={"primary": "#FEF08A", "secondary": "#1E293B"},
                        is_ceiling_mounted=True,
                    ),
                    FurnitureVariantSpec(
                        variant_id="metal_fan",
                        name="4-Blade Metal Industrial Fan",
                        default_dimensions=[1.3, 1.3, 0.45],
                        default_colors={"primary": "#D1D5DB", "secondary": "#111827"},
                        is_ceiling_mounted=True,
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="ceiling_lamp",
                name="Ceiling & Pendant Lamp",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="pendant",
                        name="Warm Pendant Lamp",
                        default_dimensions=[0.4, 0.4, 0.6],
                        default_colors={"primary": "#FEF08A", "secondary": "#B96848"},
                        is_ceiling_mounted=True,
                    ),
                    FurnitureVariantSpec(
                        variant_id="chandelier",
                        name="Ring Chandelier (Multi-Light)",
                        default_dimensions=[0.8, 0.8, 0.7],
                        default_colors={"primary": "#FEF08A", "secondary": "#D97706"},
                        is_ceiling_mounted=True,
                    ),
                    FurnitureVariantSpec(
                        variant_id="spotlight",
                        name="Recessed Ceiling Spotlights",
                        default_dimensions=[0.25, 0.25, 0.15],
                        default_colors={"primary": "#FFFFFF", "secondary": "#1E293B"},
                        is_ceiling_mounted=True,
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="floor_lamp",
                name="Floor & Corner Lamp",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="standing",
                        name="Warm Arc Floor Lamp",
                        default_dimensions=[0.4, 0.4, 1.5],
                        default_colors={"primary": "#FEF08A", "secondary": "#B96848"},
                    ),
                    FurnitureVariantSpec(
                        variant_id="corner_ambient",
                        name="Ambient Mood Corner Lamp",
                        default_dimensions=[0.25, 0.25, 1.4],
                        default_colors={"primary": "#93C5FD", "secondary": "#1E293B"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="table_lamp",
                name="Table & Bedside Lamp",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="bedside_lamp",
                        name="Cozy Bedside Lamp",
                        default_dimensions=[0.28, 0.28, 0.45],
                        default_colors={"primary": "#FEF08A", "secondary": "#EDE6D6"},
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="curtains",
                name="Curtains",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="curtains",
                        name="Draped Curtains",
                        default_dimensions=[1.4, 0.1, 2.2],
                        default_colors={"primary": "#EDE6D6", "secondary": "#334155"},
                        is_wall_mounted=True,
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="mirror",
                name="Mirror",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="wall_mirror",
                        name="Wall Mirror",
                        default_dimensions=[0.6, 0.04, 0.9],
                        default_colors={"primary": "#93C5FD", "secondary": "#334155"},
                        is_wall_mounted=True,
                    ),
                ],
            ),
            FurnitureItemSpec(
                type_id="wall_frame",
                name="Wall Art Frame",
                category="decor",
                variants=[
                    FurnitureVariantSpec(
                        variant_id="artwork",
                        name="Framed Artwork",
                        default_dimensions=[0.7, 0.04, 0.5],
                        default_colors={"primary": "#C2410C", "secondary": "#1E293B"},
                        is_wall_mounted=True,
                    ),
                ],
            ),
        ],
    ),
]


def get_catalogue() -> CatalogueResponse:
    """Returns the full static catalogue response."""
    return CatalogueResponse(
        categories=CATALOGUE_CATEGORIES,
        color_presets=COLOR_PRESETS,
        finishes=["matte", "satin", "gloss"],
    )
