"""Curated, cited facts for the IGNITE-AI environment tabs and the safety section.

Rules: every `fact` has a `source` (label + URL) and, where possible, a verbatim `quote`
from that source. Values marked kind="estimate" are computed from stated physics and labelled
as estimates in the UI. Nothing here is a model prediction.
"""
from __future__ import annotations

S = {
    "friedman2000": ("Friedman, R. (2000) Progress in Fire Detection and Suppression Technology for Future Space Missions, NASA/TM-2000-210337 (NTRS 20000120278)",
                     "https://ntrs.nasa.gov/citations/20000120278"),
    "olson2012": ("Olson & Ferkul (2012) Evaluating Material Flammability in Microgravity and Martian Gravity Compared to the NASA Standard Normal Gravity Test (NTRS 20130010991)",
                  "https://ntrs.nasa.gov/citations/20130010991"),
    "ferkul2026": ("Ferkul et al. (2026) Material Flammability at Lunar and Martian Gravity, LPSC presentation (NTRS 20260001966)",
                   "https://ntrs.nasa.gov/citations/20260001966"),
    "luci2025": ("Ferkul et al. (2025) Lunar Combustion Investigation (LUCI): Flammability Results from a Rotating Sounding Rocket (NTRS 20250010653)",
                 "https://ntrs.nasa.gov/citations/20250010653"),
    "fwm2011": ("Development of the ISS Fine Water Mist Portable Fire Extinguisher (2011, NTRS 20110012300)",
                "https://ntrs.nasa.gov/citations/20110012300"),
    "orionpfe2018": ("Orion Portable Fire Extinguisher Performance Testing ... (2018, NTRS 20180005251)",
                     "https://ntrs.nasa.gov/citations/20180005251"),
    "orionsmoke2009": ("Smoke Detection for the Orion Crew Exploration Vehicle (2009, NTRS 20090020655)",
                       "https://ntrs.nasa.gov/citations/20090020655"),
    "sfsplan": ("Spacecraft Fire Safety Technology Development Plan for Exploration Missions (NTRS 20205000063)",
                "https://ntrs.nasa.gov/citations/20205000063"),
    "saffire45": ("Urban et al. (2021) Fire Safety Implications of Preliminary Results from Saffire IV and V, ICES-2021-266 (NTRS 20210011521)",
                  "https://ntrs.nasa.gov/citations/20210011521"),
    "nasa_combustion": ("NASA (2023) Studying Combustion and Fire Safety - Space Station Research Integration Office",
                        "https://www.nasa.gov/missions/station/iss-research/studying-combustion-and-fire-safety/"),
    "acme": ("NASA Science - ACME mission page", "https://science.nasa.gov/mission/acme/"),
    "sofie": ("NASA Science - SoFIE mission page", "https://science.nasa.gov/mission/sofie/"),
    "psi20": ("NASA PSI-20 ACME Burning Rate Emulator (BRE) investigation metadata",
              "https://psi.nasa.gov/physci/repo/data/investigations/PSI-20"),
    "psi25": ("NASA PSI-25 BASS-II investigation metadata", "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25"),
    "psi69": ("NASA PSI-69 FLEX investigation metadata + experimental table", "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69"),
    "bass2015": ("Zhao, T'ien, Ferkul, Olson (2015) BASS/BASS-II concurrent flame spread over SIBAL (NTRS 20150008962)",
                 "https://ntrs.nasa.gov/citations/20150008962"),
}


def src(key: str) -> dict:
    label, url = S[key]
    return {"label": label, "url": url}


def F(label, value, key, quote="", kind="sourced", note=""):
    return {"label": label, "value": value, "kind": kind, "quote": quote, "note": note, "source": src(key) if key else None}


ENVIRONMENTS = {
    "earth": {
        "id": "earth", "name": "Earth", "short": "Earth (1 g)", "gravity_g": 1.0,
        "tagline": "Buoyancy drives the classic flickering teardrop flame.",
        "facts": [
            F("Gravity", "1 g (reference)", None, kind="definition"),
            F("Reference atmosphere", "Air: 21% O₂ / 79% N₂ at 14.7 psia (101.3 kPa)", "olson2012",
              "normal sea-level conditions (air, 21% oxygen and 79% nitrogen by volume at 14.7 psia total pressure)"),
            F("Why flames are teardrops", "Hot gas rises, cool air is pulled in at the base", "nasa_combustion",
              "on Earth, hot gases from a flame rise and gravity pulls cooler, denser air to the bottom of a flame, creating the classic shape and flickering effect."),
            F("NASA material screening", "NASA-STD-6001 Test 1: upward burning, pass/fail at 6 in (15 cm)", "olson2012",
              "NASA STD 6001 Test 1 is the major method used to assess flammability of materials ... Materials that do not self-extinguish after six inches of burning must undergo other special considerations"),
        ],
        "data_note": "6 training rows at 1 g: the upward limiting-oxygen (ULOI / MOC) tests for Mylar G, Ultem 1000 and Nomex HT90-40 at NASA White Sands (NTRS 20130010991 Table I). No 1 g rows exist for the other materials, so the range guard refuses them in this tab.",
        "default": {"material": "Nomex_HT90-40", "oxygen_pct": 23.5, "pressure_kpa": 101.4, "flow_cm_s": 0, "flow_direction": "concurrent"},
    },
    "moon": {
        "id": "moon", "name": "Moon", "short": "Moon (0.165 g)", "gravity_g": 0.165,
        "tagline": "Weak buoyancy: lunar gravity may be close to the MOST flammable condition.",
        "facts": [
            F("Gravity", "0.165 g (1.62 m/s²)", "friedman2000", "For the Moon, the gravitational level is 1.62 m/s2, or 0.165 that of normal gravity."),
            F("Planned habitat atmosphere", "8.2 psia (56.5 kPa), 34% O₂ / 66% N₂; control bands up to 37% O₂", "ferkul2026",
              "HLS, Lunar habitat and pressurized rover will nominally use 8.2 psia / 34% O2, 66% N2 ... Control bands are expected to allow up to 37% O2"),
            F("Flammability at lunar g", "Near the most flammable gravity level", "ferkul2026",
              "Numerical and experimental evidence suggests that Lunar gravity is nearly the most flammable condition."),
            F("Partial-gravity maximum", "Flammability peaks roughly between 0.15 and 0.4 g", "friedman2000",
              "the partial-gravity fire maxima occur roughly over the range bracketing the levels of concern for missions beyond Earth orbit, namely, 0.15 to 0.4 of normal gravity."),
            F("First long-duration lunar-g burns", "LUCI: >25 s burns on a spinning New Shepard rocket", "luci2025",
              "These are the first-ever, extended-duration (greater than 25 seconds) combustion tests performed in simulated Lunar gravity."),
            F("Buoyant flow speed vs Earth", "≈ 0.41 × Earth (√0.165)", None, kind="estimate",
              note="Physics-based ESTIMATE: buoyant velocity scales as √(g·β·ΔT·L), so at fixed flame size and temperature it scales with √g. Not a measurement."),
        ],
        "data_note": "8 training rows at lunar g: ULOI*/MOC* for Mylar, Ultem, Nomex (drop-tower centrifuge, NTRS 20130010991) and 2 SIBAL downward-spread tests (parabolic flight, NTRS 20260001966; LUCI rocket, NTRS 20250010653). Low-g drop tests last only ~5 s.",
        "default": {"material": "SIBAL_fabric", "oxygen_pct": 20.5, "pressure_kpa": 101.3, "flow_cm_s": 0, "flow_direction": "opposed"},
    },
    "mars": {
        "id": "mars", "name": "Mars", "short": "Mars (0.38 g)", "gravity_g": 0.38,
        "tagline": "Martian gravity: limits measured up to 5.75 points of O₂ below Earth's.",
        "facts": [
            F("Gravity", "0.380 g (3.72 m/s²)", "friedman2000", 'For Mars, this "partial gravity" level is 3.72 m/s2, or 0.380 that of normal gravity.'),
            F("Habitat atmosphere", "Not yet baselined in our sources; NASA-considered exploration atmospheres include 10.2 psia / 26.5% O₂ and 8.2 psia / 34% O₂", "psi20",
              "NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen."),
            F("Measured Martian-g limits", "Up to 5.75% O₂ lower than 1 g, typically between 1 g and lunar values", "olson2012",
              "The limiting oxygen levels at Martian gravity were significantly lower than normal gravity (up to 5.75% O2 lower), and typically between the normal gravity and Lunar gravity values."),
            F("Implication for screening", "1 g tests may not be conservative", "olson2012",
              "normal gravity material flammability screening tests may not be conservative and some materials tested to be safe for use in space may actually be flammable."),
            F("Buoyant flow speed vs Earth", "≈ 0.62 × Earth (√0.38)", None, kind="estimate",
              note="Physics-based ESTIMATE from √g scaling of buoyant velocity. Not a measurement."),
        ],
        "data_note": "6 training rows at Martian g: ULOI*/MOC* for Mylar G, Ultem 1000 and Nomex HT90-40 (5.18 s drop-tower centrifuge, NTRS 20130010991 Table I). Every other material is refused in this tab.",
        "default": {"material": "Mylar_G", "oxygen_pct": 18.0, "pressure_kpa": 70.3, "flow_cm_s": 0, "flow_direction": "concurrent"},
    },
    "iss": {
        "id": "iss", "name": "ISS", "short": "ISS µg (~0 g)", "gravity_g": 0.0,
        "tagline": "No buoyancy: only ventilation and diffusion feed the flame.",
        "facts": [
            F("Gravity", "~0 g (continuous free fall)", "nasa_combustion", kind="definition"),
            F("Cabin atmosphere", "Air, 21% O₂ at 14.7 psia (101.3 kPa)", "olson2012",
              "the Space Shuttle and the International Space Station (ISS) have operated at normal sea-level conditions (air, 21% oxygen and 79% nitrogen by volume at 14.7 psia total pressure)"),
            F("Pre-EVA atmosphere", "30% O₂ at 10.2 psia (70.3 kPa)", "olson2012",
              "brief pre-EVA activities when oxygen levels are increased for a short period of time to 30% oxygen while the total pressure is lowered to 10.2 psia"),
            F("Flame shape", "Rounded or even spherical", "nasa_combustion",
              "In microgravity, this flow doesn't occur and on the space station, low-momentum flames tend to be rounded or even spherical."),
            F("Role of ventilation", "Flames spread poorly in still air, vigorously in flows up to ~20 cm/s", "friedman2000",
              "Flames propagate poorly in truly quiescent conditions, but they are enhanced vigorously by low-rate atmospheric flows (velocities up to about 20 cm/s)."),
            F("Hard-to-see flames", "At very low airflow a flame can be pale violet and nearly invisible", "friedman2000",
              "At 1.0 cm/s, the entire flame is pale violet and nearly invisible"),
            F("Invisible cool flames", "FLEX found fuel still 'burning' after the visible flame went out", "nasa_combustion",
              "FLEX ... led to the discovery of a type of cool flame, where the fuel continued \u201cburning\u201d under certain conditions after extinction of the visible flame."),
        ],
        "data_note": "123 training rows in microgravity: NASA drop towers, Shuttle SSCE, ISS BASS/BASS-II (corroborated by the PSI-25 experimental table) and Saffire I-VI in Cygnus.",
        "default": {"material": "SIBAL_fabric", "oxygen_pct": 21, "pressure_kpa": 101.3, "flow_cm_s": 3, "flow_direction": "concurrent"},
    },
    "transit": {
        "id": "transit", "name": "Rocket transit", "short": "Transit cabin (µg coast)", "gravity_g": 0.0,
        "tagline": "Coasting to the Moon or Mars is free fall: the same physics as the ISS.",
        "facts": [
            F("Gravity while coasting", "~0 g, identical to orbit", "friedman2000",
              "the environment in the transit phases of these journeys is microgravity, identical to the environment of Earth-orbiting spacecraft."),
            F("Why transit is harder", "Limited suppressant, delayed help from Earth", "friedman2000",
              "Stores of suppressant and atmospheric diluents are more limited ... and consultation and emergency communications with Earth controllers may be of poor quality and delayed."),
            F("Real spacecraft-cabin fires", "Saffire burned large samples inside uncrewed Cygnus spacecraft", "nasa_combustion",
              "Saffire is a series of experiments conducted aboard uncrewed Cygnus cargo spacecraft after they depart the station"),
            F("Exploration atmospheres", "Reduced pressure with higher O₂ (e.g. 8.2 psia / 34%)", "psi20",
              "10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen."),
            F("Powered flight", "Most of the trip is unpowered; brief engine burns are not modelled", "friedman2000",
              "practical travel to the Moon or Mars must assume flight, for the most part, that is unpowered and without artificial gravity.",
              note="During engine burns the crew feels thrust acceleration instead of free fall; no flame-spread data exist for that, so the tool models the coast phase only."),
        ],
        "data_note": "Uses the 123 microgravity rows; the Saffire (Cygnus spacecraft) rows are the closest real analogue to a crew-cabin fire in transit.",
        "default": {"material": "SIBAL_fabric", "oxygen_pct": 21, "pressure_kpa": 100, "flow_cm_s": 20, "flow_direction": "concurrent"},
    },
}

GAS_MIXES = [
    {"id": "air", "label": "Normal air (O₂/N₂)", "modelled": True,
     "note": "Every training experiment burned in O₂/N₂ (air or N₂-diluted / O₂-enriched air). Adjust O₂ and pressure with the sliders."},
    {"id": "co2", "label": "Carbon dioxide build-up", "modelled": False,
     "note": "No flame-SPREAD experiment in the dataset used CO₂-diluted air, so the classifier refuses. Real related data: FLEX (PSI-69) burned fuel droplets in atmospheres with added CO₂; the table below summarises those real tests.",
     "source": src("psi69")},
    {"id": "methane", "label": "Methane leak", "modelled": False,
     "note": "No flame-spread experiment in the dataset had fuel gas mixed into the cabin air, so the classifier refuses. Related NASA work on methane flames: ACME BRE, SLICE and SPICE (gas-jet flames), cited below.",
     "source": src("acme")},
]

SAFETY = [
    {"id": "detect", "title": "Detection", "icon": "radar", "applies": ["earth", "moon", "mars", "iss", "transit"],
     "items": [
         F("ISS smoke detectors", "Photoelectric smoke detectors in each module, as spot or duct monitors", "friedman2000",
           "segments of the International Space Station (ISS) will have one or more detector units in each module that sense smoke through photoelectric light-beam obscuration and scattering"),
         F("Confirm with gas sensing", "Combined CO/CO₂ sensing can tell flaming from non-flaming events", "friedman2000",
           "combined CO/CO 2 detectors are shown in ground tests to discriminate among non-flaming fires, flaming fires, and non-fire events."),
         F("Don't rely on seeing flames", "Low-flow microgravity flames can be nearly invisible; FLEX cool flames kept 'burning' after the visible flame went out", "nasa_combustion",
           "FLEX ... led to the discovery of a type of cool flame, where the fuel continued \u201cburning\u201d under certain conditions after extinction of the visible flame."),
         F("Orion", "Orion's smoke detector is adapted from a mature commercial-aircraft design", "orionsmoke2009",
           "The smoke detector described in this paper is an adaptation of a mature commercial aircraft design for manned spaceflight."),
     ]},
    {"id": "isolate", "title": "Ventilation shutdown & isolation", "icon": "fan", "applies": ["iss", "transit", "moon", "mars", "earth"],
     "items": [
         F("First response", "Isolate the zone: remove power and air circulation", "friedman2000",
           "Upon a verified fire alarm, the automated or manual crew response is to isolate the affected zone, removing power and local or general air circulation."),
         F("Necessary, not sufficient", "Stopping airflow may not put out every fire (a candle on Mir burned for minutes)", "friedman2000",
           "removal of air flow upon fire detection is a necessary response, but it is not always sufficient for control of the incipient fire."),
         F("Saffire lesson", "Charring or bubbling materials may not self-extinguish quickly in still air", "saffire45",
           "Extinguishment of thin charring fuels at increased oxygen cannot be assumed to occur rapidly in quiescent conditions."),
         F("Saffire lesson", "A small residual flow can sometimes help extinction", "saffire45",
           "In some circumstances, reducing air flow to a small value rather than quiescent conditions may be useful to disperse fuel vapor and help cool the material to enable extinction"),
     ]},
    {"id": "suppress", "title": "Suppression", "icon": "extinguisher", "applies": ["iss", "transit", "moon", "mars", "earth"],
     "items": [
         F("ISS extinguishers", "CO₂ in the US segment, Columbus and Kibo; water foam in the Russian segment", "fwm2011",
           "The International Space Station presently uses two different types of fire extinguishers: a water foam extinguisher in the Russian Segment, and a carbon dioxide extinguisher in the US Segment and Columbus and Kibo pressurized elements."),
         F("Why water mist", "Fine water mist avoids filling the cabin with CO₂ and low-O₂ air", "fwm2011",
           "Fine Water Mist extinguishes a fire without creating a large volume of air with reduced oxygen and elevated CO2."),
         F("Crew breathing", "Fire-response respirator cartridge rated up to 90 min; it does not filter CO₂", "fwm2011",
           "It is qualified to provide up to 90 minutes of capability ... The fire response respirator cartridge does not filter carbon dioxide (CO2)"),
         F("Orion", "Orion uses a water-spray portable extinguisher", "orionpfe2018",
           "The Orion crew capsule will utilize a different PFE technology from ISS (water spray rather than water mist)"),
         F("Depressurization", "If used, drop the pressure fast", "friedman2000",
           "if a fire is to be controlled by depressurization, the pressure in the affected module should be decreased rapidly"),
     ]},
    {"id": "materials", "title": "Material selection", "icon": "layers", "applies": ["earth", "moon", "mars", "iss", "transit"],
     "items": [
         F("Standard test", "NASA-STD-6001 Test 1: upward burning in the worst expected atmosphere", "olson2012",
           "The method is a pass/fail upward flame propagation test conducted in the most severe flaming combustion environment (oxygen concentration, pressure) expected in the spacecraft"),
         F("Low-g margin", "Some materials burn at lower O₂ in low g than in 1 g", "olson2012",
           "1g flammability limits are generally not conservative for these materials as evidenced by the negative \u2206O2%, by up to -5.75% oxygen."),
         F("Higher O₂ habitats", "Fire-safe materials get harder to find as O₂ rises", "ferkul2026",
           "Fire safe materials become increasingly difficult to find as the oxygen concentration increases."),
         F("Saffire lesson", "Thick-fuel growth in low g differs from Test 1", "saffire45",
           "Thick fuel flame growth was found to be dissimilar from that seen in NASA STD 6001 Test 1. This does not invalidate the test but does affect the interpretation of the test results"),
     ]},
    {"id": "crew", "title": "Crew procedures & post-fire", "icon": "crew", "applies": ["iss", "transit", "moon", "mars", "earth"],
     "items": [
         F("Re-ignition", "Hot embers can re-ignite if fresh air returns too early", "friedman2000",
           "Since burned material remains hot in the non-convective environment, embers may reignite if prematurely exposed to fresh air."),
         F("Deflagration risk", "Overheated materials in still zones can build up fuel vapour", "saffire45",
           "Overheated materials in quiescent conditions or in low-flow zones in low gravity can produce stratified fuel mixtures that can result in dramatic deflagrations during ignition."),
         F("Flame jumps", "A flame jumped a 4.5 cm gap to a warmed PMMA surface", "saffire45",
           "In one case, a flame was seen to jump a 4.5 cm gap to ignite a previously warmed PMMA surface."),
         F("Large fire impact", "Saffire fires up to 10 kW did not push average vehicle conditions to unacceptable levels", "saffire45",
           "despite having heat release rates up to 10 kW, the average vehicle conditions did not rise to unacceptable levels."),
     ]},
    {"id": "partialg", "title": "Moon & Mars specifics", "icon": "planet", "applies": ["moon", "mars"],
     "items": [
         F("Most flammable band", "Flammability and spread rate peak between about 0.15 and 0.4 g", "friedman2000",
           "the fuels exhibit a maximum in their flammability behavior in the partial-gravity range."),
         F("New hazards", "Dormancy, higher O₂, partial gravity and surface dust", "sfsplan",
           "extended durations, dormancy intervals, increased oxygen concentrations, partial gravity conditions and the presence of surface dust. All of these changes can have significant impacts on fire safety system design and operations."),
     ]},
    {"id": "transitg", "title": "Transit specifics", "icon": "rocket", "applies": ["transit"],
     "items": [
         F("Self-reliance", "Less suppressant, delayed contact with Earth", "friedman2000",
           "Stores of suppressant and atmospheric diluents are more limited, long missions imply more accumulated wastes and possible relaxation of crew vigilance"),
     ]},
]

INVESTIGATIONS = [  # shown in the Resources section; details from PSI metadata where available
    {"acronym": "FLEX", "psi": "PSI-69"}, {"acronym": "FLEX-2", "psi": "PSI-68"}, {"acronym": "BASS", "psi": "PSI-26"},
    {"acronym": "BASS-II", "psi": "PSI-25"}, {"acronym": "SPICE", "psi": "PSI-107"}, {"acronym": "SLICE", "psi": "PSI-106"},
    {"acronym": "CFI", "psi": "PSI-39"}, {"acronym": "ACME BRE", "psi": "PSI-20"}, {"acronym": "ACME CFI-G", "psi": "PSI-159"},
    {"acronym": "SAME", "psi": "PSI-102"}, {"acronym": "SAME-R", "psi": "PSI-101"}, {"acronym": "DAFT / DAFT-2", "psi": "PSI-47"},
    {"acronym": "SAFFIRE-I", "psi": "PSI-98"}, {"acronym": "SAFFIRE-II", "psi": "PSI-99"}, {"acronym": "SAFFIRE-III", "psi": "PSI-100"},
]
EXTRA_LINKS = [
    {"label": "NASA Physical Sciences Informatics (PSI) repository", "url": "https://psi.nasa.gov/physci/repo/"},
    src("acme"), src("sofie"), src("nasa_combustion"),
    {"label": "NASA Technical Reports Server (NTRS) API", "url": "https://ntrs.nasa.gov/api/citations/search"},
]
