"""Daily construction site task templates and helpers for Tamil Nadu residential builds."""

from typing import Any

DEFAULT_SITE_TASKS: list[dict[str, Any]] = [
    # Stage 1: Site Preparation (Days 1–3)
    {
        "day_number": 1,
        "stage_key": "site_prep",
        "title": "Site clearing and boundary benchmark setup",
        "description": "Clear wild vegetation, roots, and debris. Fix permanent benchmark level pillars at the plot corner.",
        "trade": "Survey & Earthwork",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 1,
        "stage_key": "site_prep",
        "title": "Plot setback and road margin verification",
        "description": "Cross-check CMDA / DTCP setback compliance (5 ft front, 3 ft sides and rear) using steel measuring tape.",
        "trade": "Site Engineer",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 2,
        "stage_key": "site_prep",
        "title": "Temporary site shed and storage setup",
        "description": "Erect cement storage godown (dry platform raised 6 inches off ground) and temporary watchman shed.",
        "trade": "Carpentry & Helpers",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 2,
        "stage_key": "site_prep",
        "title": "Temporary construction water and power connection",
        "description": "Install temporary 5HP submersible borewell pump connection and TNEB temporary single-phase meter board.",
        "trade": "Electrical & Plumbing",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 3,
        "stage_key": "site_prep",
        "title": "Column grid layout centerline marking",
        "description": "Drive timber batter boards, stretch nylon mason strings along grid axes, and mark column footing pits with white lime powder.",
        "trade": "Head Mason",
        "is_critical": True,
        "completed": False,
    },

    # Stage 2: Foundation (Days 4–10)
    {
        "day_number": 4,
        "stage_key": "foundation",
        "title": "Earthwork excavation for isolated column footings",
        "description": "Excavate 5 ft x 5 ft x 5 ft footing pits in hard red gravel soil; stack excavated soil 3 ft away from pit edges.",
        "trade": "Earthwork JCB / Labours",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 5,
        "stage_key": "foundation",
        "title": "Pit bottom ramming and anti-termite soil treatment",
        "description": "Mechanically tamp pit beds and spray Chlorpyrifos 20% EC emulsifiable concentrate @ 5 litres per sq.m.",
        "trade": "Pest Control Specialist",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 6,
        "stage_key": "foundation",
        "title": "Plain Cement Concrete (PCC 1:4:8) sub-base bed laying",
        "description": "Lay 4-inch thick PCC mud mat bed using 40mm blue metal aggregate to provide a rigid level surface for footing mats.",
        "trade": "Concreting Team",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 7,
        "stage_key": "foundation",
        "title": "Footing rebar cage fabrication and cover block fixing",
        "description": "Tie 12mm Fe 550D TMT reinforcement meshes with 18-gauge binding wire and tie 50mm precast concrete cover blocks.",
        "trade": "Steel Fitter / Bar Bender",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 8,
        "stage_key": "foundation",
        "title": "Column starter shuttering and footing concrete pour (M20)",
        "description": "Erect column base formwork and pour M20 design mix concrete compacted thoroughly with 40mm pin needle vibrator.",
        "trade": "Concreting Team",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 9,
        "stage_key": "foundation",
        "title": "Pond curing of footings and plinth beam rebar tying",
        "description": "Keep column footings submerged under water ponding and tie 4-bar 16mm TMT plinth beam reinforcement cage with 8mm stirrups.",
        "trade": "Masonry & Steel Fitters",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 10,
        "stage_key": "foundation",
        "title": "Plinth beam casting and pit soil backfilling",
        "description": "Cast continuous RCC plinth beam at +1.5 ft road level; backfill gravel inside basement with thorough water jetting and compaction.",
        "trade": "Concreting & Earthwork",
        "is_critical": True,
        "completed": False,
    },

    # Stage 3: Structure (Days 11–18)
    {
        "day_number": 11,
        "stage_key": "structure",
        "title": "Ground floor RCC column formwork erection",
        "description": "Assemble steel column shuttering boxes with plumb bob plumb check, support diagonal MS pipe props, and apply mold release oil.",
        "trade": "Shuttering Carpentry",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 12,
        "stage_key": "structure",
        "title": "Column concrete casting up to beam bottom level",
        "description": "Pour M25 concrete in 1-foot lifts up to lintel / ceiling bottom; tap formwork and consolidate with needle vibrator to avoid honeycombing.",
        "trade": "Concreting Team",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 13,
        "stage_key": "structure",
        "title": "De-shuttering column forms and wet hessian curing",
        "description": "Strip column formwork after 24 hours, wrap columns with thick jute gunny bags, and spray continuous water curing 3 times daily.",
        "trade": "Curing & Masonry",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 14,
        "stage_key": "structure",
        "title": "Roof beam centering and slab bottom staging",
        "description": "Erect telescopic MS acrow props, H-frames, and lay 12mm film-faced marine ply boards with zero gap alignment.",
        "trade": "Centering Carpentry",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 15,
        "stage_key": "structure",
        "title": "Concealed electrical conduit placement on roof deck",
        "description": "Lay heavy duty 25mm PVC conduits, MS ceiling fan junction hook boxes, and LED downlight spot box housings.",
        "trade": "Electrician",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 16,
        "stage_key": "structure",
        "title": "Roof slab reinforcement mesh tying (Fe 550D TMT)",
        "description": "Tie main 10mm bars @ 6-inch c/c and distribution 8mm bars; place chair rebars for top negative moments and 20mm PVC cover blocks.",
        "trade": "Bar Bending Team",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 17,
        "stage_key": "structure",
        "title": "Roof slab RCC casting (M20/M25 RMC) & surface finishing",
        "description": "Continuous monolithic concrete pour using boom pump; screed and finish surface with wooden floats; ensure minimum 5-inch slab thickness.",
        "trade": "Concreting & Site Incharge",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 18,
        "stage_key": "structure",
        "title": "Water bund construction on roof slab for pond curing",
        "description": "Construct 3-inch mortar bunds across roof grid; flood entire slab with 2-inch standing water for 21-day continuous pond curing.",
        "trade": "Masonry Team",
        "is_critical": False,
        "completed": False,
    },

    # Stage 4: Walls & Partitions (Days 19–25)
    {
        "day_number": 19,
        "stage_key": "walls",
        "title": "External 9-inch brickwork masonry baseline setup",
        "description": "Lay first-class red chamber bricks in 1:6 cement-sand mortar; check right angles with 3-4-5 rule and plumb line every course.",
        "trade": "Bricklayer Masons",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 20,
        "stage_key": "walls",
        "title": "RCC lintel band and window sunshade (chajja) casting",
        "description": "Cast 6-inch continuous lintel beams with 4 rebars and 1.5 ft projection cantilever sunshades over all external window openings.",
        "trade": "Masonry & Concreting",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 21,
        "stage_key": "walls",
        "title": "Internal 4.5-inch partition wall construction",
        "description": "Construct partition walls dividing bedrooms, kitchen, utility, and bathrooms with hoop iron / wire mesh reinforcement every 3rd course.",
        "trade": "Bricklayer Masons",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 22,
        "stage_key": "walls",
        "title": "Teak main door and bedroom door frames fixing",
        "description": "Fix first quality teak wood and country wood frames with 6 holdfasts per frame embedded in concrete pockets.",
        "trade": "Carpentry Specialist",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 23,
        "stage_key": "walls",
        "title": "Ceiling rough plastering (1:3 cement mortar)",
        "description": "Hack concrete ceiling surface for keying, wet thoroughly, and apply 6mm thick cement mortar plaster with sponge float finish.",
        "trade": "Plastering Team",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 24,
        "stage_key": "walls",
        "title": "Internal wall 12mm single-coat smooth plastering",
        "description": "Fix mortar button pads, apply 1:4 cement-sand mortar, and rule out with aluminium straight edge for plumb plumb-line finish.",
        "trade": "Plastering Team",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 25,
        "stage_key": "walls",
        "title": "External wall 20mm two-coat waterproof sand-face plastering",
        "description": "Apply 14mm base coat and 6mm finish coat with water repellent chemical additive (Dr. Fixit LW+) and textured sponge finish.",
        "trade": "Plastering Team",
        "is_critical": False,
        "completed": False,
    },

    # Stage 5: Electrical (Days 26–29)
    {
        "day_number": 26,
        "stage_key": "electrical",
        "title": "Wall wall-chasing (grooving) and metal switch box embedding",
        "description": "Cut wall chases using dual-blade electric wall chaser; fix GI modular conceal switch boxes at standard ergonomic heights.",
        "trade": "Electrician",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 27,
        "stage_key": "electrical",
        "title": "Electrical wire pulling through concealed conduits",
        "description": "Draw Polycab FRLS copper multi-strand wires (1.5 sq.mm lighting, 2.5 sq.mm power sockets, 4.0 sq.mm AC points) using nylon fish tape.",
        "trade": "Electrician",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 28,
        "stage_key": "electrical",
        "title": "Distribution board (DB) dressing and MCB/RCCB mounting",
        "description": "Mount 8-way double-door distribution board; wire individual circuit breakers, 30mA RCCB for human safety, and phase splitters.",
        "trade": "Electrician",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 29,
        "stage_key": "electrical",
        "title": "Earthing copper plate pit digging and earth resistance test",
        "description": "Install 600x600x3mm copper earth plate embedded in charcoal & salt pit; measure ground resistance using earth tester (< 2 ohms).",
        "trade": "Electrical Contractor",
        "is_critical": True,
        "completed": False,
    },

    # Stage 6: Plumbing (Days 30–33)
    {
        "day_number": 30,
        "stage_key": "plumbing",
        "title": "CPVC concealed hot and cold water supply lines",
        "description": "Run Ashirvad SDR-11 CPVC pipes inside bathroom walls with brass elbow fittings for geyser, shower mixer, and wash basin points.",
        "trade": "Plumber",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 31,
        "stage_key": "plumbing",
        "title": "Hydraulic pressure testing of CPVC water lines",
        "description": "Plug all plumbing outlets, pressurize line to 10 kg/cm² for 4 hours with hydraulic test pump to confirm zero leakage joints.",
        "trade": "Plumber & Site Incharge",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 32,
        "stage_key": "plumbing",
        "title": "PVC drainage and soil waste line installation",
        "description": "Install 110mm PVC soil pipes for EWC and 75mm waste pipes with water-sealed multi-floor traps connected to inspection chambers.",
        "trade": "Plumber",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 33,
        "stage_key": "plumbing",
        "title": "Overhead water tank and sump pump line interconnection",
        "description": "Erect 1000-litre triple-layer Sintex overhead tank on terrace parapet with float valve, bypass line, and pressure relief valve.",
        "trade": "Plumber",
        "is_critical": False,
        "completed": False,
    },

    # Stage 7: Finishing & Handover (Days 34–40)
    {
        "day_number": 34,
        "stage_key": "finishing",
        "title": "Bathroom floor and sunken slab waterproofing coating",
        "description": "Apply 2 coats of elastomeric polymer modified cementitious slurry (Dr. Fixit Fastflex) with fiberglass mesh at wall-floor corners.",
        "trade": "Waterproofing Specialist",
        "is_critical": True,
        "completed": False,
    },
    {
        "day_number": 35,
        "stage_key": "finishing",
        "title": "Bathroom ceramic wall tile dado up to 7 ft height",
        "description": "Fix 12x18-inch anti-skid digital ceramic glazed tiles using polymer-modified tile adhesive; fill joints with epoxy grout.",
        "trade": "Tile Mason",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 36,
        "stage_key": "finishing",
        "title": "Vitrified floor tile laying (4x2 ft) in hall and bedrooms",
        "description": "Lay Kajaria 4x2 ft vitrified tiles on 1:4 cement mortar bed with 2mm tile spacers and laser leveling; clean with sponge.",
        "trade": "Tile Mason",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 37,
        "stage_key": "finishing",
        "title": "Kitchen Black Galaxy granite countertop and sink fixing",
        "description": "Cut 18mm granite slab, machine-chamfer front edge, cut opening for SS Franke kitchen sink, and fix on brick support pillars.",
        "trade": "Granite Worker",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 38,
        "stage_key": "finishing",
        "title": "Birla White wall putty sanding and primer application",
        "description": "Sand two coats of dried wall putty with 180-grit sandpaper; apply 1 coat water-thinnable acrylic primer using paint rollers.",
        "trade": "Painting Team",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 39,
        "stage_key": "finishing",
        "title": "Sanitaryware fixture and CP tap fittings installation",
        "description": "Fix Parryware floor-mounted EWC, soft-close seat cover, dual-flush cistern, wash basin, diverter, and stainless steel health faucets.",
        "trade": "Plumber",
        "is_critical": False,
        "completed": False,
    },
    {
        "day_number": 40,
        "stage_key": "finishing",
        "title": "Final Asian Paints Royale emulsion coat & site cleanup",
        "description": "Roll two finish coats of interior emulsion paint, fix modular switch plates, execute chemical floor scrubbing, and prepare for handover.",
        "trade": "Finishing & Cleaning",
        "is_critical": True,
        "completed": False,
    },
]


def generate_dynamic_daily_tasks(
    total_days: int = 250,
    built_up_area: float = 1850.0,
    floors: int = 1,
) -> list[dict[str, Any]]:
    """Dynamically generates an architecturally authentic day-by-day site checklist

    spanning from Day 1 to Day total_days for residential construction in Tamil Nadu.
    Every task is initially uncompleted (completed=False) for manual daily tracking.
    """
    total = max(30, int(total_days))

    # Apportion stage milestones across the total working days
    d_site_prep = max(3, int(round(total * 0.05)))
    d_foundation = max(d_site_prep + 6, int(round(total * 0.22)))
    d_structure = max(d_foundation + 12, int(round(total * 0.52)))
    d_walls = max(d_structure + 8, int(round(total * 0.68)))
    d_electrical = max(d_walls + 5, int(round(total * 0.76)))
    d_plumbing = max(d_electrical + 4, int(round(total * 0.82)))
    d_plastering = max(d_plumbing + 6, int(round(total * 0.90)))

    # Master templates for each stage
    stage_templates = {
        "site_prep": [
            ("Site boundary survey and benchmark setup", "Clear wild vegetation, roots, and debris. Fix permanent benchmark level pillars at the plot corner.", "Survey & Earthwork", True),
            ("Plot setback & road margin verification", "Cross-check CMDA / DTCP setback compliance (5 ft front, 3 ft sides and rear) using steel measuring tape.", "Site Engineer", True),
            ("Temporary site shed & cement godown", "Erect cement storage godown (dry platform raised 6 inches off ground) and temporary watchman shed.", "Carpentry & Helpers", False),
            ("Construction water & power connection", "Install temporary 5HP submersible borewell pump connection and TNEB temporary single-phase meter board.", "Electrical & Plumbing", True),
            ("Column grid layout centerline marking", "Drive timber batter boards, stretch nylon mason strings along grid axes, and mark column footing pits with white lime powder.", "Head Mason", True),
            ("Soil profile & excavation marking", "Final inspection of soil strata before machinery mobilization; verify pit offset boundaries.", "Site Engineer", False),
        ],
        "foundation": [
            ("Earthwork excavation for column footings", "Excavate 5 ft x 5 ft x 5 ft footing pits in hard red gravel soil; stack excavated soil 3 ft away from pit edges.", "Earthwork JCB / Labours", True),
            ("Pit bottom leveling & anti-termite spray", "Mechanically tamp pit beds and spray Chlorpyrifos 20% EC emulsifiable concentrate @ 5 litres per sq.m.", "Pest Control Specialist", False),
            ("PCC 1:4:8 leveling base bed casting", "Mix and pour 4-inch thick Plain Cement Concrete (1 cement : 4 M-sand : 8 40mm aggregate) as leveling base course.", "Concreting Team", True),
            ("Footing reinforcement mesh binding", "Cut and bend Fe550D TMT rebar (10mm @ 6 inches c/c both ways) for trapezoidal footing mats.", "Bar Bender", False),
            ("Column starter cage & cover blocks", "Position column starter rebar cages vertically using plumb-bob; wire 50mm concrete cover blocks on all sides.", "Bar Bender", True),
            ("M20 concrete casting for isolated footings", "Pour M20 grade concrete (1:1.5:3) into footing forms using 40mm needle vibrator to eliminate honeycombing.", "Concreting Team", True),
            ("Footing curing pond & water curing", "Construct mini cement mortar bunds around footing pads; begin 14-day continuous water pond curing.", "Curing Helper", False),
            ("Column neck casting up to plinth level", "Fix steel column neck formwork boxes; cast M20 concrete up to natural ground plinth height.", "Head Mason", False),
            ("Plinth beam shuttering & steel binding", "Erect plinth beam side shuttering plates; bind top (2x12mm) and bottom (3x16mm) Fe550D reinforcement with 8mm stirrups.", "Bar Bender", True),
            ("Plinth beam M20 concrete pouring", "Cast continuous plinth tie-beam around building perimeter with integrated damp-proof membrane.", "Concreting Team", True),
            ("Red gravel backfilling & compaction", "Backfill footing trenches with red gravel in 6-inch layers; flood with water and mechanically ram.", "Earthwork Labours", False),
            ("Ground floor sub-base PCC casting", "Pour 4-inch thick PCC 1:4:8 base slab over compacted gravel to seal building ground floor against dampness.", "Concreting Team", True),
        ],
        "structure": [
            ("Column rebar cage fabrication", "Tie main longitudinal column bars (4x16mm + 2x12mm Fe550D) with 8mm lateral ties spaced at 150mm c/c.", "Bar Bender", False),
            ("Column shuttering box erection & plumb check", "Erect lubricated steel column shuttering boxes; verify verticality with magnetic plumb bob and fix diagonal tie props.", "Centering Carpenter", True),
            ("Column concrete casting with needle vibrator", "Pour M20 concrete in lifts not exceeding 1.2 meters; vibrate thoroughly around rebar cage.", "Concreting Team", True),
            ("Column de-shuttering & hessian wrapping", "Dismantle column formwork after 24 hours; wrap column faces with wet hessian gunny bags for 21 days curing.", "Curing Helper", False),
            ("Roof beam & slab staging prop alignment", "Erect heavy-duty Acro steel props and MS runners at 3 ft spacing for ceiling centering support.", "Centering Carpenter", False),
            ("Ceiling plywood centering shuttering", "Lay 12mm film-faced marine shuttering plywood sheets; seal joints with PVC tape to prevent slurry leakage.", "Centering Carpenter", True),
            ("Roof beam reinforcement cage placement", "Fabricate and place main beam rebar cages with high-tensile stirrups and cranked tension bars.", "Bar Bender", True),
            ("Slab bottom rebar mesh tying", "Lay bottom reinforcement mesh (8mm @ 6 inches c/c) with 20mm concrete cover blocks under all bars.", "Bar Bender", True),
            ("Concealed electrical PVC conduit routing", "Embed heavy-duty 25mm PVC conduits, ceiling fan hooks, and junction boxes within slab rebar mesh.", "Electrician", True),
            ("Plumbing sleeves & AC core cutouts", "Fix 4-inch PVC pipe sleeves for toilet soil stacks and copper refrigerant lines before slab casting.", "Plumber", False),
            ("Top negative rebar & chair support bars", "Tie top negative moment reinforcement over beam supports and place MS bar chairs at 3 ft c/c.", "Bar Bender", True),
            ("Pre-pour structural clearance inspection", "Site Engineer structural verification of rebar covers, beam depths, conduit binding, and shutter stability.", "Site Engineer", True),
            ("M20 roof slab machine concrete casting", "Continuous machine-mixed M20 concrete pouring across full slab (5-inch thickness) with screed vibrators.", "Concreting Team", True),
            ("Slab surface trowel finishing with slope", "Trowel slab top surface using wooden floats with 1:100 slope directed toward rainwater roof drains.", "Head Mason", False),
            ("Mortar bund creation & 21-day pond curing", "Form 3-inch high cement mortar bunds dividing roof slab into water pond bays; maintain water depth 2 inches.", "Curing Helper", False),
            ("RCC staircase centering & step casting", "Fabricate doglegged staircase waist slab shuttering, bind rebar, and cast steps with rich mortar finish.", "Concreting Team", True),
            ("Parapet wall stub column casting", "Cast 3 ft high RCC stub columns and lintel bands along terrace boundary for wind and safety resistance.", "Head Mason", False),
        ],
        "walls": [
            ("Clay brick water soaking & batching", "Submerge country burnt red bricks in water curing tank for 2 hours prior to laying in mortar.", "Masonry Helper", False),
            ("Ground floor 9-inch perimeter brick masonry", "Lay external 9-inch load-bearing brick walls in cement mortar 1:6 using string lines and spirit levels.", "Head Mason", False),
            ("Internal 4.5-inch partition wall masonry", "Construct partition walls in CM 1:4 with 2 nos 6mm reinforcement rods embedded every 4th course.", "Head Mason", False),
            ("Continuous RCC sill band casting", "Cast 3-inch thick RCC sill band with 2x8mm rebar along window openings to prevent diagonal shear cracks.", "Concreting Team", True),
            ("First-class Teakwood door frame fixing", "Position seasoned first-class Teakwood main door and bedroom frames with MS holdfast brackets into brickwork.", "Carpentry Specialist", True),
            ("UPVC window sub-frame alignment", "Install galvanized steel sub-frames for UPVC sliding windows with spirit-level plumb alignment.", "Window Specialist", False),
            ("Brickwork masonry up to lintel level", "Raise walls up to 7 ft lintel height; check corners with 3-4-5 right angle triangles.", "Head Mason", False),
            ("RCC lintel beam & sunshade chajja casting", "Cast 6-inch lintel beams with integrated 1.5 ft cantilevered weather chajjas over all doors and windows.", "Concreting Team", True),
            ("Upper brickwork up to slab soffit", "Complete upper wall masonry up to roof slab bottom; pack joint solidly with non-shrink mortar.", "Head Mason", False),
            ("Bathroom sunken slab brick lining", "Build water-retaining brick dwarf walls in sunken slab zones for sanitary pipe concealment.", "Head Mason", False),
            ("Parapet wall brick masonry (3.5 ft height)", "Construct 9-inch terrace parapet wall with copings and rainwater weep-holes.", "Head Mason", False),
        ],
        "electrical": [
            ("Wall groove chasing for electrical conduits", "Cut neat vertical wall chases using twin-blade electric wall chaser without disturbing structural brickwork.", "Electrician", False),
            ("Concealed PVC conduit & GI switch box fixing", "Install heavy-duty PVC conduit pipes and galvanized steel switch back-boxes embedded in mortar.", "Electrician", False),
            ("AC refrigerant copper pipe line concealment", "Run insulated twin copper refrigerant pipes with drain lines from bedroom locations to terrace outdoor unit stands.", "HVAC Specialist", False),
            ("Finolex FRLS copper wire pulling", "Pull multi-strand fire-retardant low-smoke copper wires through conduits (1.5 sq mm lighting, 4 sq mm power sockets).", "Electrician", True),
            ("Earthing copper plate & charcoal pit setup", "Drive 600x600x3mm copper earth plate into treated charcoal and salt pit; achieve resistance < 1.0 Ohm.", "Electrician", True),
            ("Distribution board (DB) installation", "Mount Legrand 12-way double-door distribution board with 40A 30mA RCCB and dedicated B-curve MCBs.", "Electrician", True),
        ],
        "plumbing": [
            ("CPVC hot & cold water supply pipe routing", "Run Astral / Ashirvad SDR 11 CPVC pipes inside toilet walls with brass elbow drop fittings for mixers.", "Plumber", False),
            ("Concealed wall mixer pressure testing", "Test internal water plumbing joints with hydraulic test pump at 10 bar pressure for 24 hours.", "Plumber", True),
            ("External 4-inch SWR soil pipe fixing", "Fix Supreme PVC 4-inch soil and 3-inch waste pipes along external ducts using vibration-damping pipe clamps.", "Plumber", False),
            ("Septic tank & soak pit pipe connections", "Connect toilet sewage outlets to RCC septic tank with P-traps and inspection chamber manholes.", "Plumber", True),
            ("Overhead Sintex / RCC water tank manifold", "Connect 1,500L multi-layer overhead tank with automatic water-level controller sensors and pressure pump line.", "Plumber", False),
        ],
        "finishing": [
            ("Chicken mesh fixing at beam-brick joints", "Fasten galvanized chicken wire mesh over all concrete-brick interfaces with steel nails to eliminate plaster cracks.", "Plasterer Helper", False),
            ("Ceiling rough coat plastering (CM 1:3)", "Apply 8mm cement plaster to concrete slab ceiling with Dr. Fixit waterproofing admixture.", "Plasterer", False),
            ("Internal wall two-coat plastering (CM 1:4)", "Apply 12mm base coat followed by 3mm sponge-finished smooth plaster using fine M-sand.", "Plasterer", False),
            ("External sand-faced weather plastering", "Plaster exterior building envelope with double-coat waterproof plaster and drip-mould grooves on chajjas.", "Plasterer", True),
            ("Terrace elastomeric waterproofing membrane", "Apply 2 coats of Dr. Fixit Dampguard / Pidifin 2K polymer waterproofing membrane on terrace slab.", "Waterproofing Specialist", True),
            ("Bathroom tile dadoing up to 7 ft height", "Lay Kajaria anti-skid ceramic wall tiles with waterproof epoxy tile grout in all bathrooms.", "Tile Mason", False),
            ("Vitrified floor tile laying (4x2 ft) in hall", "Lay premium 4x2 ft double-charge vitrified floor tiles with 2mm leveling clips on 1:4 mortar bed.", "Tile Mason", False),
            ("Kitchen Black Galaxy granite counter fixing", "Mount 18mm chamfered granite slab with Franke stainless steel undermount sink on support dwarf walls.", "Granite Specialist", False),
            ("Staircase granite cladding & safety bullnosing", "Fix flamed granite treads on staircase with machine-cut anti-slip grooving.", "Granite Specialist", False),
            ("Birla White wall putty & machine sanding", "Apply two coats of white cement wall putty; sand with 220-grit orbital sanders to glass-smooth finish.", "Painting Team", False),
            ("Interior primer & Royale emulsion painting", "Apply 1 coat acrylic primer and 2 finish coats of Asian Paints Royale Luxury interior emulsion.", "Painting Team", False),
            ("Exterior Apex Ultima weathercoat painting", "Apply exterior anti-fungal silicone weathercoat paint on all external facade surfaces.", "Painting Team", False),
            ("Sanitaryware & Jaguar CP fittings install", "Install wall-hung EWC, soft-close seats, basin mixers, health faucets, and overhead rain showers.", "Plumber", False),
            ("Modular switch plates & light fixture fixing", "Clip on Legrand Arteor / Anchor Roma modular switch plates, LED panel lights, and ceiling fans.", "Electrician", False),
            ("Main Teakwood door PU polish & mortise lock", "Hand-rub PU clear gloss polish on main teak door and install Godrej brass mortise handle lock.", "Carpenter Specialist", False),
            ("Deep chemical floor cleaning & handover", "Acid-free mechanical scrubbing of all tiled surfaces, glass window cleaning, debris removal, and key handover.", "Handover Team", True),
        ],
    }

    tasks: list[dict[str, Any]] = []

    def get_stage_for_day(d: int) -> str:
        if d <= d_site_prep:
            return "site_prep"
        elif d <= d_foundation:
            return "foundation"
        elif d <= d_structure:
            return "structure"
        elif d <= d_walls:
            return "walls"
        elif d <= d_electrical:
            return "electrical"
        elif d <= d_plumbing:
            return "plumbing"
        else:
            return "finishing"

    # Distribute tasks systematically across all days from 1 to total
    for day in range(1, total + 1):
        stg = get_stage_for_day(day)
        pool = stage_templates[stg]
        # Pick 1 or 2 tasks based on position in stage
        idx = (day - 1) % len(pool)
        title, desc, trade, crit = pool[idx]

        task_item = {
            "day_number": day,
            "stage_key": stg,
            "title": f"Day {day}: {title}",
            "description": desc,
            "trade": trade,
            "is_critical": crit,
            "completed": False,
        }
        tasks.append(task_item)

        # For critical days or mid-stage milestones, add an inspection / verification task
        if crit and day % 4 == 0:
            tasks.append({
                "day_number": day,
                "stage_key": stg,
                "title": f"Day {day} Quality Gate: {trade} Verification",
                "description": f"Site Supervisor quality checklist inspection and sign-off for {title}.",
                "trade": "Site Engineer",
                "is_critical": True,
                "completed": False,
            })

    return tasks


def generate_default_daily_tasks() -> list[dict[str, Any]]:
    return generate_dynamic_daily_tasks(total_days=250, built_up_area=1850.0, floors=1)

