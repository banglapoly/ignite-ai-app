"""Build data/experiments.csv (+ .parquet) from values transcribed out of public NASA reports.

EVERY row below was transcribed by hand from the cited table/page of a public NTRS document.
Nothing is interpolated, digitised from a figure, or synthesised. The `source_location` and
`quote` columns say exactly where each value is printed so a reviewer can check it.

Outcome classes (defined BEFORE looking at model results):
  spread          - source reports sustained flame propagation (measured steady spread rate,
                    sample consumed, or no quench/extinction during the test).
  marginal_spread - a flame persisted but propagation was near-limit: the source explicitly
                    reports oscillatory/unstable near-limit spread, an unmeasurably small spread
                    rate, decelerating spread whose reported fate is extinction, or a flame that
                    stayed anchored at the leading edge instead of spreading.
  no_spread       - no ignition, extinction/quench, blow-off, or insignificant burn.

Run:  python scripts/build_dataset.py
"""
from __future__ import annotations
import csv, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_CSV = ROOT / "data" / "experiments.csv"
ATM = 101.3  # kPa per 1 atm (14.7 psia)

SRC = {
    "20130010991": ("Olson, S.L.; Ferkul, P.V. (2012) Evaluating Material Flammability in Microgravity and Martian Gravity Compared to the NASA Standard Normal Gravity Test. AIAA/ICES",
                    "https://ntrs.nasa.gov/citations/20130010991"),
    "20260001966": ("Ferkul, P.; Kralik, N.; Liao, Y.-T.; Johnston, M. (2026) Material Flammability at Lunar and Martian Gravity. Lunar and Planetary Science Conference (presentation)",
                    "https://ntrs.nasa.gov/citations/20260001966"),
    "20250010653": ("Ferkul, P.V.; Johnston, M.C.; Kralik, N.; Liao, Y.-T. (2025) Lunar Combustion Investigation (LUCI): Flammability Results from a Rotating Sounding Rocket. ASGSR 2025 (presentation)",
                    "https://ntrs.nasa.gov/citations/20250010653"),
    "19880006471": ("Olson, S.L. (1987) The Effect of Microgravity on Flame Spread over a Thin Fuel. NASA TM-100195",
                    "https://ntrs.nasa.gov/citations/19880006471"),
    "19890014267": ("Olson, S.L.; Ferkul, P.V.; T'ien, J.S. (1989) An experimental study of opposed flow diffusion flame extinction over a thin fuel in microgravity. NASA TM-101479",
                    "https://ntrs.nasa.gov/citations/19890014267"),
    "20150008962": ("Zhao, X.; T'ien, J.S.; Ferkul, P.V.; Olson, S.L. (2015) Concurrent Flame Growth, Spread and Extinction over Composite Fabric Samples in Low Speed Purely Forced Flow in Microgravity (BASS / BASS-II)",
                    "https://ntrs.nasa.gov/citations/20150008962"),
    "20080034883": ("Olson, S.L.; Hegde, U.; Bhattacharjee, S.; Deering, J.L.; Tang, L.; Altenkirch, R.A. (2008) Microgravity Flame Spread in Exploration Atmospheres: Pressure, Oxygen, and Velocity Effects on Opposed and Concurrent Flame Spread. NASA/TM-2008-215260",
                    "https://ntrs.nasa.gov/citations/20080034883"),
    "20210011521": ("Urban, D.L. et al. (2021) Fire Safety Implications of Preliminary Results from Saffire IV and V Experiments on Large Scale Spacecraft Fires. ICES-2021-266",
                    "https://ntrs.nasa.gov/citations/20210011521"),
    "20170008805": ("Urban, D.L. et al. (2017) Results of Large-Scale Spacecraft Flammability Tests (Saffire-I/II)",
                    "https://ntrs.nasa.gov/citations/20170008805"),
    "20240002981": ("Urban, D.L. et al. (2024) Preliminary Results from the Saffire VI Experiment",
                    "https://ntrs.nasa.gov/citations/20240002981"),
    "20260001992": ("Heat and Smoke Emission from Tests on the Saffire VI Experiment (2026, ICES)",
                    "https://ntrs.nasa.gov/citations/20260001992"),
    "19960008387": ("Altenkirch, R.A. et al. (1995) Solid surface combustion experiment flame spread in a quiescent, microgravity environment: implications of spread rate and flame structure",
                    "https://ntrs.nasa.gov/citations/19960008387"),
    "20050177200": ("NASA Lewis (1996) Solid Surface Combustion Experiment Completes a Series of Eight Successful Flights",
                    "https://ntrs.nasa.gov/citations/20050177200"),
    "19950007798": ("The Solid Surface Combustion Experiment Aboard the USML-1 Mission (1994)",
                    "https://ntrs.nasa.gov/citations/19950007798"),
    "19970020608": ("Altenkirch, R.A. et al. (1997) Solid Surface Combustion Experiment: Thick Fuel Results",
                    "https://ntrs.nasa.gov/citations/19970020608"),
    "19990053971": ("Reflight of the Solid Surface Combustion Experiment: Flame Radiation Near Extinction (1999)",
                    "https://ntrs.nasa.gov/citations/19990053971"),
}

rows: list[dict] = []

def add(o2, p_kpa, flow, direction, material, detail, geometry, facility, outcome, outcome_detail,
        rid, location, quote, notes="", extra_sources="", gravity_g=0.0):
    title, url = SRC[rid]
    rows.append(dict(
        oxygen_pct=o2, pressure_kpa=p_kpa, flow_cm_s=flow, flow_direction=direction, gravity_g=gravity_g,
        material=material, material_detail=detail, geometry=geometry, facility=facility,
        outcome=outcome, outcome_detail=outcome_detail,
        report_id=f"NTRS {rid}", source_url=url, source_title=title,
        source_location=location, quote=quote, notes=notes, extra_sources=extra_sources,
    ))

# ---------------------------------------------------------------------------------------------
# 1) Olson 1987, NASA TM-100195 (NTRS 19880006471). Quiescent microgravity, 1 atm, O2/N2.
#    Drop towers (NASA Lewis 2.2 s Drop Tower and 5.18 s Zero Gravity Facility). Kimwipes
#    cellulose. Table A-I (single thickness 0.0076 cm) and Table A-III (double, 0.0152 cm),
#    Appendix A p.26-27; footnote a = "Oscillatory behavior observed".
# ---------------------------------------------------------------------------------------------
R = "19880006471"
kim1 = ("cellulose_thin", "Kimwipes laboratory wipe, 99% cellulose, single thickness 0.0076 cm")
kim2 = ("cellulose_double", "Kimwipes laboratory wipe, 99% cellulose, double thickness 0.0152 cm")
geo = "flat thin sheet, quiescent (no imposed flow)"
fac = "NASA Lewis 2.2 s Drop Tower / 5.18 s Zero Gravity Facility"
add(20.5, ATM, 0.0, "quiescent", *kim1, geo, fac, "no_spread", "flame extinguished (quenching) after 1.55 s of forward propagation",
    R, "Sec. 5.1.1, p.10-11", "The extinguished flame at 20.5 percent oxygen ... it was observed to retreat slightly for 0.57 sec before the flame extinguished.")
for v in (0.53, 0.55, 0.54):
    add(21.0, ATM, 0.0, "quiescent", *kim1, geo, fac, "marginal_spread", f"oscillatory near-limit spread, Vf={v} cm/s",
        R, "Table A-I, p.26 (footnote a)", f"21 percent O2: spread rate {v} cm/sec, footnote a 'Oscillatory behavior observed'; text: observed extinction limit of 21 percent oxygen at 1 atm")
add(23.0, ATM, 0.0, "quiescent", *kim1, geo, fac, "marginal_spread", "oscillatory near-limit spread, Vf=0.56 cm/s",
    R, "Table A-I, p.26 (footnote a)", "23 percent O2: spread rate 0.56 cm/sec, footnote a 'Oscillatory behavior observed'")
add(25.0, ATM, 0.0, "quiescent", *kim1, geo, fac, "marginal_spread", "oscillatory near-limit spread, Vf=1.09 cm/s",
    R, "Table A-I, p.26 (footnote a)", "25 percent O2: spread rate 1.09 cm/sec, footnote a 'Oscillatory behavior observed'")
for o2, vs in [(27.5, [1.26]), (30, [1.74, 1.81, 1.86, 1.72, 1.88, 1.84]), (35, [2.17]),
               (40, [2.63, 2.67, 2.85, 2.63, 2.86, 2.72]), (50, [3.78, 3.89]), (60, [4.94, 4.55]),
               (80, [6.11, 6.13]), (100, [7.09, 6.74])]:
    for v in vs:
        add(float(o2), ATM, 0.0, "quiescent", *kim1, geo, fac, "spread", f"steady spread, Vf={v} cm/s",
            R, "Table A-I, p.26", f"{o2} percent O2: flame spread rate {v} cm/sec (no oscillation footnote)")
add(25.0, ATM, 0.0, "quiescent", *kim2, geo, fac, "no_spread", "flame quenched after oscillating (forward for 2.10 s, retreat 2.33 s)",
    R, "Sec. 5.1.3, p.13", "The quenched flame at 25 percent oxygen also oscillated prior to extinction ... Extinction in microgravity was again caused by quenching.")
for o2, v in [(26, 0.25), (27, 0.40), (28, 0.36)]:
    add(float(o2), ATM, 0.0, "quiescent", *kim2, geo, fac, "marginal_spread", f"oscillatory near-limit spread, Vf={v} cm/s",
        R, "Table A-III, p.27 (footnote a)", f"{o2} percent O2: spread rate {v} cm/sec, footnote a 'Oscillatory behavior observed'; text: observed extinction limit of 26 percent oxygen at 1 atm")
for o2, vs in [(30, [0.47, 0.63, 0.54]), (40, [1.42, 1.29, 1.55]), (50, [2.00, 2.19]), (60, [2.26, 3.42]),
               (80, [3.44, 3.55]), (100, [4.59, 2.72])]:
    for v in vs:
        add(float(o2), ATM, 0.0, "quiescent", *kim2, geo, fac, "spread", f"steady spread, Vf={v} cm/s",
            R, "Table A-III, p.27", f"{o2} percent O2: flame spread rate {v} cm/sec (no oscillation footnote)")

# ---------------------------------------------------------------------------------------------
# 2) Olson, Ferkul, T'ien 1989, NASA TM-101479 (NTRS 19890014267). Opposed flow produced by
#    moving the fuel at constant speed through quiescent O2/N2 at 1 atm, 5.18 s Zero Gravity
#    Facility. Same Kimwipes fuel as ref. 4 (Olson 1987). Table I p.6 "Extinction observed".
# ---------------------------------------------------------------------------------------------
R = "19890014267"
geo = "flat thin sheet 3 cm wide, opposed flow (fuel moved through quiescent gas)"
fac = "NASA Lewis 5.18 s Zero Gravity Facility"
t1 = [(21, 6.06, "0.87", "No"), (18, 6.75, ".64", "No"), (18, 3.92, ".40", "No"), (18, 1.70, ".35", "No"),
      (17, 6.36, ".36", "No"), (17, 3.30, ".27", "No"), (17, 1.31, ".21", "No"), (17, 0.81, "---", "Yes"),
      (16, 5.96, ".19", "No"), (15, 5.66, "(d) unmeasurably small", "No"), (15, 4.29, "(d) unmeasurably small", "No"),
      (14, 6.08, "---", "Yes"), (14, 4.19, "---", "Yes")]
for o2, fs, sr, ext in t1:
    if ext == "Yes":
        out, det = "no_spread", "flame extinction observed within 5.18 s"
    elif sr.startswith("(d)"):
        out, det = "marginal_spread", "flame survived but spread rate unmeasurably small"
    else:
        out, det = "spread", f"spread rate {sr} cm/s, no extinction"
    add(float(o2), ATM, fs, "opposed", *kim1, geo, fac, out, det, R, "Table I, p.6",
        f"Oxygen {o2} mole %, fuel speed {fs} cm/sec, spread rate {sr}, extinction observed: {ext}",
        notes="1 atm: 'filled to 1 atm pressure' (Appendix). Fuel is the Kimwipes fuel of Olson 1987 (ref. 4). flow_cm_s = fuel speed relative to the gas.")

# ---------------------------------------------------------------------------------------------
# 3) Zhao, T'ien, Ferkul, Olson 2015 (NTRS 20150008962): BASS and BASS-II on ISS (MSG),
#    SIBAL cotton-fiberglass fabric, concurrent forced flow, 1 atm. Appendix table p.9.
#    Tests with a velocity ramp "a->b": flame was burning at the starting flow a; the comment
#    column states whether it Quenched / Blew off at the final flow b. Reused samples and the
#    two tests flagged "O2 reading might be inaccurate" are excluded.
# ---------------------------------------------------------------------------------------------
R = "20150008962"
fac = "ISS Microgravity Science Glovebox, BASS / BASS-II flow duct"
def sibal(width):
    return ("SIBAL_fabric", f"SIBAL cotton-fiberglass blend fabric, {width} cm wide x 10 cm")
bass = [  # test, width, v_start, v_end, O2, comment
    ("GMT45-T4", 2.2, 10, 2.2, 18.7, "Quenched"), ("GMT45-T15", 2.2, 10, 29, 18.7, "No Blow-off"),
    ("GMT100-T5", 2.2, 10, 2.4, 18.8, ""), ("GMT100-T6", 2.2, 4.5, 2.6, 18.8, ""),
    ("GMT100-T13", 2.2, 4, 2.2, 17.5, "Quenched"), ("GMT100-T16", 2.2, 4, 3, 17.6, ""),
    ("GMT175-T9", 2.2, 10, None, 16.4, "No ignition"), ("GMT175-T10", 2.2, 5, None, 16.4, "No ignition"),
    ("GMT175-T18", 2.2, 5, 2.6, 17.4, "Quenched"), ("GMT178-T11", 2.2, 4, None, 17.1, ""),
    ("GMT178-T12", 2.2, 5, None, 16.8, "No ignition"), ("GMT178-T14", 2.2, 4, 2.8, 16.9, "Quenched"),
    ("GMT178-T17", 2.2, 6, 53, 16.9, "No Blow-off"), ("GMT190-T19", 1.2, 11, None, 17.2, ""),
    ("GMT190-T20", 1.2, 11, 3, 17.2, "Quenched"), ("GMT190-T21", 1.2, 11, 47, 17.2, "Blow-off"),
    ("GMT190-T22", 1.2, 10.5, 5, 17.1, "Quenched"),
    ("GMT96-T8", 2.2, 5, None, 21.0, "BASS"), ("GMT96-T7", 2.2, 10, None, 21.0, "BASS"),
    ("GMT131-T10", 1.2, 11, None, 21.0, "BASS"), ("GMT222-T11", 1.2, 19, None, 21.0, "BASS"),
]
for test, w, v0, v1, o2, com in bass:
    flowtxt = f"{v0}" if v1 is None else f"{v0}->{v1}"
    q = f"{test}: width {w} cm, flow {flowtxt} cm/s, O2 {o2}% by vol., comment '{com}'"
    geo = f"flat fabric {w} cm wide, concurrent forced flow"
    if com == "No ignition":
        add(o2, ATM, float(v0), "concurrent", *sibal(w), geo, fac, "no_spread", "no ignition (hot-wire could not establish a flame)",
            R, "Appendix table, p.9", q, notes=f"test {test}")
        continue
    add(o2, ATM, float(v0), "concurrent", *sibal(w), geo, fac, "spread", "flame established and sustained at this flow",
        R, "Appendix table, p.9", q, notes=f"test {test}; starting flow of the test" + (" (BASS series, fixed flow)" if com == "BASS" else ""))
    if v1 is not None:
        if com == "Quenched":
            add(o2, ATM, float(v1), "concurrent", *sibal(w), geo, fac, "no_spread", "low-speed quenching extinction at this flow",
                R, "Appendix table, p.9", q, notes=f"test {test}; final (quench) flow after the crew reduced the fan")
        elif com == "Blow-off":
            add(o2, ATM, float(v1), "concurrent", *sibal(w), geo, fac, "no_spread", "blow-off extinction at this flow",
                R, "Appendix table, p.9", q, notes=f"test {test}; final flow at blow-off")
        else:
            add(o2, ATM, float(v1), "concurrent", *sibal(w), geo, fac, "spread", "flame still burning at the final flow" + (" (no blow-off)" if com else ""),
                R, "Appendix table, p.9", q, notes=f"test {test}; final flow of the test")

# ---------------------------------------------------------------------------------------------
# 4) Olson et al. 2008, NASA/TM-2008-215260 (NTRS 20080034883). 0g (5.2 s drop tower) limits at
#    30 cm/s concurrent flow. Table 1, p.3: 0g ULOI (burns) and 0g MOC (extinguishes).
# ---------------------------------------------------------------------------------------------
R = "20080034883"
fac = "NASA GRC 5.2 s Zero Gravity Research Facility, microgravity flow tunnel"
for mat, det, geo, o2b, o2e, psia in [
    ("Nomex_HT90-40", "Nomex HT90-40 fabric, 12 mil, fire-retarded aramid", "flat fabric sample 5 x 10 cm, concurrent flow", 23, 22, 14.7),
    ("Ultem_1000", "Ultem 1000 polyetherimide film, 10 mil", "flat film sample 5 x 10 cm, concurrent flow", 24, 23, 10.2),
    ("Mylar_G", "Mylar G PET film, 5 mil", "flat film sample 5 x 10 cm, concurrent flow", 17, 16, 10.2)]:
    p = round(psia * 6.89476, 1)
    add(float(o2b), p, 30.0, "concurrent", mat, det, geo, fac, "spread", "0g ULOI: burned for the full test",
        R, "Table 1, p.3 (0g ULOI column)", f"{det.split(',')[0]}: 0g ULOI (burns) {o2b}% O2, {psia} psia, 30 cm/s",
        notes=f"pressure converted from {psia} psia; same 0g* value re-tabulated in NTRS 20130010991 Table I",
        extra_sources="https://ntrs.nasa.gov/citations/20130010991")
    add(float(o2e), p, 30.0, "concurrent", mat, det, geo, fac, "no_spread", "0g MOC: flame extinguished",
        R, "Table 1, p.3 (0g MOC column)", f"{det.split(',')[0]}: 0g MOC (extinguishes) {o2e}% O2, {psia} psia, 30 cm/s",
        notes=f"pressure converted from {psia} psia; same 0g* value re-tabulated in NTRS 20130010991 Table I",
        extra_sources="https://ntrs.nasa.gov/citations/20130010991")

# ---------------------------------------------------------------------------------------------
# 5) Saffire large-scale tests in Cygnus. Conditions: ICES-2021-266 (NTRS 20210011521) Table 1
#    and Table 2 p.3/p.8; Saffire VI: NTRS 20240002981 Table 1 p.3. Outcomes from the same
#    papers (+ NTRS 20260001992 for Saffire VI PMMA: "did not spread but remained anchored").
# ---------------------------------------------------------------------------------------------
fac_s = "Saffire flow unit inside an uncrewed Cygnus spacecraft (low Earth orbit)"
R = "20210011521"
for fs, flow, o2, p in [("I-1", 20, 21, 100), ("II-5", 20, 21, 100), ("II-6", 25, 21, 100), ("III-1", 25, 21, 100), ("IV-1", 20, 22, 100)]:
    add(float(o2), float(p), float(flow), "concurrent", "SIBAL_fabric", "SIBAL fabric (75% cotton / 25% fiberglass), 0.37 mm",
        "large flat fabric sample, concurrent flow", fac_s, "spread", "steady spread with a limiting flame size",
        R, "Table 2, p.8", f"Saffire {fs}: air flow {flow} cm/s, O2 {o2}%, pressure {p} kPa, SIBAL; text: 'the Cotton and SIBAL fuel samples established a steady ... spread rate and flame size'")
add(26.2, 70.7, 20.0, "concurrent", "cotton_jersey", "cotton jersey fabric, 18.1 mg/cm2", "large flat fabric sample 41 x 50 cm, concurrent flow", fac_s,
    "spread", "steady spread with a limiting flame size", R, "Table 2, p.8", "Saffire V-2: air flow 20 cm/s, O2 26.2%, pressure 70.7 kPa, Cotton jersey")
add(22.0, 100.0, 20.0, "concurrent", "PMMA_thick", "cast PMMA slab, 2-sided, 10 mm thick", "thick slab 40 x 18 cm, concurrent flow", fac_s,
    "marginal_spread", "flame anchored at leading edge; advanced by surface regression only, limiting flame length",
    R, "Table 1 p.3; Sec. D p.8", "IV-2: 2-sided PMMA, 20 cm/s concurrent, 100.0 kPa, 22.0% O2; 'Both concurrent samples (IV-2 and V-3) did not spread appreciably and instead remained fixed at the leading edge'")
add(25.4, 71.3, 20.0, "concurrent", "PMMA_thick", "cast PMMA slab, 1-sided, 5 mm thick", "thick slab 40 x 18 cm, concurrent flow", fac_s,
    "marginal_spread", "flame anchored at leading edge; advanced by surface regression only, limiting flame length",
    R, "Table 1 p.3; Sec. D p.8", "V-3: 1-sided PMMA, 20 cm/s concurrent, 71.3 kPa, 25.4% O2; 'did not spread appreciably and instead remained fixed at the leading edge'")
add(25.7, 72.6, 20.0, "opposed", "PMMA_thick", "structured cast PMMA, 10 mm base with ribs", "thick ribbed slab 20 cm long, opposed flow", fac_s,
    "spread", "flames propagated along rib edges (up to 0.88 mm/s reported in companion paper)",
    R, "Table 1, p.3", "V-4: Structured PMMA, 20 cm/s, Opposed, 72.6 kPa, 25.7% O2",
    notes="Companion abstract NTRS 20210017785 reports 761 hPa / 26.9 vol% for this test and forward propagation along rib edges up to 0.88 mm/s; the Table 1 values of 20210011521 are used here.",
    extra_sources="https://ntrs.nasa.gov/citations/20210017785")
R = "20240002981"
add(31.0, 54.1, 20.0, "concurrent", "SIBAL_fabric", "SIBAL fabric (75% cotton / 25% fiberglass)", "large flat fabric sample 40 x 50 cm, concurrent flow", fac_s,
    "spread", "linear flame spread, 4.05 mm/s (NTRS 20260001992 Table 1)", R, "Table 1, p.3",
    "VI-2: SIBAL cloth, 20 cm/s concurrent, 54.1 kPa, 31.0% O2", extra_sources="https://ntrs.nasa.gov/citations/20260001992")
for fs, det, p, o2 in [("VI-3", "cast PMMA slab, 2-sided, 10 mm thick", 54.6, 30.3), ("VI-4", "cast PMMA slab, 1-sided, 5 mm thick", 55.2, 28.8)]:
    add(o2, p, 20.0, "concurrent", "PMMA_thick", det, "thick slab 40 x 18 cm, concurrent flow", fac_s,
        "marginal_spread", "flame anchored at leading edge, grew to a limiting length (~90 mm)", R, "Table 1, p.3",
        f"{fs}: {det.split(',')[1].strip()} PMMA, 20 cm/s concurrent, {p} kPa, {o2}% O2; NTRS 20260001992: 'the flames did not spread but remained anchored at the leading edge'",
        extra_sources="https://ntrs.nasa.gov/citations/20260001992")
# Saffire-II small samples: outcomes from NTRS 20170008805 (Table I, backup slides); flight II
# pressure 100 kPa from NTRS 20210011521 Table 2 (II-5, II-6 on the same flight).
R = "20170008805"
for s, thick, direction in [("2-1", "0.27 mm", "concurrent"), ("2-2", "0.61 mm", "concurrent"), ("2-3", "1.03 mm", "concurrent"), ("2-4", "0.37 mm", "opposed")]:
    add(22.1, 100.0, 20.0, direction, "silicone", f"silicone sheet {thick}", f"5 x 29 cm sheet, {direction} flow", fac_s,
        "no_spread", "ignition attempted (80 W, 9.2 s); insignificant burn, ~0 burn length",
        R, "Table I, p.28-29", f"Sample {s}: Silicone {thick}, 20 cm/s {direction}, O2 ~22.1%; burn duration 'Insignificant', micro-g burn length ~0",
        notes="O2 given as '~22.1' (derived from CO production). Pressure 100 kPa for flight II from NTRS 20210011521 Table 2.",
        extra_sources="https://ntrs.nasa.gov/citations/20210011521")
add(22.1, 100.0, 20.0, "concurrent", "Nomex_HT90-40", "Nomex fabric 0.37 mm (downstream of PMMA on sample 2-7)", "5 x 24 cm fabric, concurrent flow", fac_s,
    "no_spread", "Nomex not ignited although the upstream PMMA burned completely", R, "Table I, p.28-29 (note ii)",
    "Sample 2-7 PMMA & Nomex, 20 cm/s concurrent, ~22.1% O2; 'The PMMA portion was completely consumed but the Nomex was not ignited.'",
    notes="Nomex grade given only as 'Nomex' in this table; grouped with Nomex HT90-40 fabric. Pressure from NTRS 20210011521 Table 2.",
    extra_sources="https://ntrs.nasa.gov/citations/20210011521")
for s, o2txt, o2 in [("2-8", "22.1 to 22.0", 22.05), ("2-9", "22.0 to 21.9", 21.95)]:
    add(o2, 100.0, 20.0, "concurrent", "PMMA_thick", "cast PMMA, 5 cm wide" + (", 1 cm thick" if s == "2-9" else ", grooved (see paper Fig. 5)"),
        "5 x 29 cm thick sample, concurrent flow", fac_s, "marginal_spread", "flames remained anchored at the base; very slow regression (0.01-0.04 mm/s)",
        R, "Table I, p.28-29 (note iv)", f"Sample {s}: PMMA, 20 cm/s concurrent, O2 {o2txt}%; 'The flames remain anchored at the base of the sample which has a very slow regression rate'",
        notes=f"oxygen_pct is the midpoint of the reported '{o2txt}' range. Pressure from NTRS 20210011521 Table 2.",
        extra_sources="https://ntrs.nasa.gov/citations/20210011521")

# ---------------------------------------------------------------------------------------------
# 6) Solid Surface Combustion Experiment (SSCE), Space Shuttle middeck, quiescent O2/N2.
# ---------------------------------------------------------------------------------------------
fac = "Space Shuttle middeck, SSCE sealed chamber (quiescent)"
# Thin ashless filter paper flights: 50% O2 at 1.0/1.5/2.0 atm (20050177200 + 19960008387),
# 35% O2 at 1.0 atm (STS-50, 19950007798). All five thin-fuel flights report flame spread.
R = "20050177200"
for atm in (1.0, 1.5, 2.0):
    add(50.0, round(atm * ATM, 1), 0.0, "quiescent", "filter_paper", "ashless filter paper, 0.00825 cm half-thickness, 3 x 10 cm",
        "flat thin sheet, quiescent", fac, "spread", "flame spread measured (spread rate increases with O2 and pressure)",
        R, "abstract", f"first five flights: ashless filter paper in a 50-percent or 35-percent mixture of oxygen in nitrogen at pressures of 1.0, 1.5, and 2.0 atm",
        notes=f"50% O2 at {atm} atm: STS-41/40/43 were the pressure series (NTRS 19960008387 p.1); USML-1 paper (NTRS 19950007798) states flame spread rate increased with O2 and pressure across the five thin-fuel flights.",
        extra_sources="https://ntrs.nasa.gov/citations/19960008387; https://ntrs.nasa.gov/citations/19950007798")
R = "19950007798"
add(35.0, ATM, 0.0, "quiescent", "filter_paper", "thin cellulosic fuel (ashless filter paper)", "flat thin sheet, quiescent", fac,
    "spread", "flame spread observed (STS-50 / USML-1)", R, "abstract",
    "flame spread over a thin cellulosic fuel in a quiescent oxidizer of 35% oxygen/65% nitrogen at 1.0 atm. pressure in microgravity")
# Thick PMMA flights (19970020608): 70%/1 atm (STS-54), 50%/1 atm (STS-63), 50%/2 atm (STS-64).
R = "19970020608"
for o2, atm, sts in [(70, 1.0, "STS-54"), (50, 1.0, "STS-63"), (50, 2.0, "STS-64")]:
    add(float(o2), round(atm * ATM, 1), 0.0, "quiescent", "PMMA_thick", "cast PMMA 25.4 x 6.35 x 3.18 mm", "thick sample, quiescent", fac,
        "marginal_spread", "flame spread with gradually decreasing rate; no steady spread (reflight reports ultimate fate is extinction)",
        R, "p.381-382, Fig. 2", f"{sts}: quiescent {o2}% O2/{atm} atm; 'they resume a trajectory of gradually decreasing slope, i.e., a decreasing spread rate'",
        notes="NTRS 19990053971 abstract: 'for thick, flat fuels, the ultimate fate of the flame is extinction rather than steady spread.'",
        extra_sources="https://ntrs.nasa.gov/citations/19990053971")


# ---------------------------------------------------------------------------------------------
# 6) PARTIAL GRAVITY AND 1 g (added for the IGNITE-AI Moon / Mars / Earth tabs).
#    Olson & Ferkul 2012 (NTRS 20130010991) Table I "Limiting Oxygen Molar Concentrations and Oxygen
#    Margin of Safety for Different Gravity Levels", p.6. Upward (concurrent, buoyant) flame spread,
#    NO imposed forced flow. Mylar G and Ultem 1000 at 10.2 psia, Nomex HT90-40 at 14.7 psia.
#    Definitions (p.2, p.4): 1g ULOI = O2 at which the material passes the NASA-STD-6001 Test 1 burn-
#    length criterion ~half the time -> marginal_spread; 1g MOC = consistently self-extinguishes ->
#    no_spread; low-g ULOI* = "minimum oxygen concentration where the flame survived the full drop time";
#    low-g MOC* = "maximum oxygen concentration at which the flame was observed to self-extinguish during
#    the drop time" -> no_spread. Martian ULOI*: Mylar flame "appeared stable" (p.4) -> spread; Nomex and
#    Ultem flames "were becoming quite dim and shrinking at the end of the drop" (p.4) -> marginal_spread.
#    Lunar ULOI* values come from the paper's ref. 8 (Ferkul & Olson 2011) as re-tabulated in Table I
#    -> spread (survived the full drop time). Gravity levels: Mars 0.380 g and Moon 0.165 g as stated in
#    NTRS 20000120278 (NASA/TM-2000-210337, p.9) and the paper itself ("Martian gravity (0.38 g Earth)").
#    Drop-tower low-g tests last only ~5.2 s; the paper warns that low-g and 1g limit criteria differ.
# ---------------------------------------------------------------------------------------------
R = "20130010991"
fac_mars = "NASA GRC 5.18 s Zero Gravity Research Facility + zero-gravity centrifuge (30.8 RPM for Martian g)"
fac_moon = "Zero-gravity centrifuge in the NASA GRC drop tower (lunar-g data from ref. 8, Ferkul & Olson 2011, as tabulated)"
fac_1g = "NASA White Sands Test Facility, NASA-STD-6001 Test 1 protocol (hot-wire igniter), upward burning"
MATS = {
    "Mylar_G": ("Mylar G PET film, 5 mil (1g tests used Melinex 515, a very similar film)", 10.2),
    "Ultem_1000": ("Ultem 1000 polyetherimide film, 10 mil", 10.2),
    "Nomex_HT90-40": ("Nomex HT90-40 fabric, 12 mil, fire-retarded aramid", 14.7),
}
T1 = {  # material: (1g ULOI, 1g MOC, Mars ULOI*, Mars MOC*, Lunar ULOI*, Lunar MOC*)  -- Table I, p.6
    "Mylar_G": (21.2, 20.0, 18.0, 17.0, 15.6, 14.1),
    "Ultem_1000": (23.5, 23.0, 22.0, 21.1, 21.0, 19.9),
    "Nomex_HT90-40": (23.5, 22.1, 19.9, 19.0, 21.0, 19.9),
}
geo_up = "flat 5 x 15 cm sample, upward (concurrent) buoyant flow, no forced flow"
for mat, (u1, m1, uM, mM, uL, mL) in T1.items():
    det, psia = MATS[mat]
    p = round(psia * 6.89476, 1)
    name = det.split(",")[0]
    nt = f"pressure converted from {psia} psia"
    add(u1, p, 0.0, "concurrent", mat, det, geo_up, fac_1g, "marginal_spread",
        "1g ULOI: passes the Test 1 burn-length criterion about half the time", R, "Table I, p.6 (1g ULOI row)",
        f"{name}: 1g ULOI {u1}% O2 at {psia} psia", notes=nt, gravity_g=1.0)
    add(m1, p, 0.0, "concurrent", mat, det, geo_up, fac_1g, "no_spread",
        "1g MOC: consistently self-extinguishes (>=5 samples passed)", R, "Table I, p.6 (1g MOC row)",
        f"{name}: 1g MOC {m1}% O2 at {psia} psia", notes=nt, gravity_g=1.0)
    mars_ok = "spread" if mat == "Mylar_G" else "marginal_spread"
    mars_det = ("Martian ULOI*: flame survived the full drop and 'appeared to stabilize'" if mat == "Mylar_G" else
                "Martian ULOI*: survived the full drop but 'becoming quite dim and shrinking at the end of the drop'")
    add(uM, p, 0.0, "concurrent", mat, det, geo_up, fac_mars, mars_ok, mars_det, R,
        "Table I, p.6 (Martian ULOI* row); flame description p.4",
        f"{name}: Martian ULOI* {uM}% O2 at {psia} psia", notes=nt + "; 5.18 s drop test", gravity_g=0.38)
    add(mM, p, 0.0, "concurrent", mat, det, geo_up, fac_mars, "no_spread",
        "Martian MOC*: flame self-extinguished during the drop", R, "Table I, p.6 (Martian MOC* row)",
        f"{name}: Martian MOC* {mM}% O2 at {psia} psia", notes=nt + "; 5.18 s drop test", gravity_g=0.38)
    add(uL, p, 0.0, "concurrent", mat, det, geo_up, fac_moon, "spread",
        "Lunar ULOI*: flame survived the full drop time", R, "Table I, p.6 (Lunar ULOI* row, from ref. 8)",
        f"{name}: Lunar ULOI* {uL}% O2 at {psia} psia", notes=nt + "; ~5 s drop test; lunar g = 0.165 per NTRS 20000120278",
        extra_sources="https://ntrs.nasa.gov/citations/20000120278", gravity_g=0.165)
    add(mL, p, 0.0, "concurrent", mat, det, geo_up, fac_moon, "no_spread",
        "Lunar MOC*: flame self-extinguished during the drop", R, "Table I, p.6 (Lunar MOC* row, from ref. 8)",
        f"{name}: Lunar MOC* {mL}% O2 at {psia} psia", notes=nt + "; ~5 s drop test; lunar g = 0.165 per NTRS 20000120278",
        extra_sources="https://ntrs.nasa.gov/citations/20000120278", gravity_g=0.165)

# SIBAL fabric, downward (opposed buoyant flow) spread at lunar gravity
add(21.0, ATM, 0.0, "opposed", "SIBAL_fabric", "SIBAL cotton-fiberglass fabric, 5 cm wide",
    "flat fabric, downward spread in buoyant flow (no forced flow)",
    "Parabolic-flight aircraft at lunar g (0.165 g)", "spread",
    "steady downward spread for the entire 20 s test (flame base spread rate 0.086 cm/s)",
    "20260001966", "Pages 20-21 ('Parabolic Flight Aircraft Testing at Lunar-g')",
    "SIBAL, 5 cm wide, Lunar g, 21% O2, 1 atm ... Lunar gravity: Steady, downward spread occurs for the entire 20-sec test time.",
    notes="0.165 gEarth printed on the slide", gravity_g=0.165)
add(20.0, ATM, 0.0, "opposed", "SIBAL_fabric", "SIBAL cotton-fiberglass fabric sheet",
    "flat fabric, downward spread in buoyant flow (centrifugal lunar g, no forced flow)",
    "LUCI: spinning Blue Origin New Shepard sounding rocket (11 RPM at 1.22 m radius)", "spread",
    "steady-state spread, flame base spread rate 0.92 mm/s; burned for over a minute",
    "20250010653", "Abstract; slides 'LUCI: SIBAL fabric' and 'LUCI: SIBAL fabric' (O2 plot)",
    "Two samples are burned simultaneously in air at normal pressure ... SIBAL fabric (cotton-fiberglass blend) burning downward in Lunar-g ... Spread rates for char front, flame base, and flame tip are all linear (steady state spread) ... O2 concentration decreases from ~20% to ~18%.",
    notes=("O2 taken as the stated starting value (~20%); 'normal pressure' taken as 101.3 kPa; "
           "g = (11 RPM)^2 x 1.22 m = 1.62 m/s^2 = 0.165 g (computed from the stated rotation). "
           "The burn ended in extinction but the O2 at extinction is only given approximately, so no extinction row was added."),
    gravity_g=0.165)

# ---------------------------------------------------------------------------------------------
# 7) NASA Physical Sciences Informatics (PSI) corroboration. PSI experimental tables (CC0) are
#    stored in data/psi/tables/ (downloaded by scripts/fetch_psi.py). They list test conditions
#    but mostly not outcomes, so they are used to CROSS-CHECK the NTRS rows above, not as new rows.
# ---------------------------------------------------------------------------------------------
import re as _re
PSI_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{}"
PSI_DIR = ROOT / "data" / "psi" / "tables"


def _read_psi(acc):
    f = PSI_DIR / f"{acc}_experimental_table.csv"
    if not f.exists():
        return []
    b = f.read_bytes()
    try:
        txt = b.decode("utf-8-sig")
    except UnicodeDecodeError:
        txt = b.decode("cp1252", errors="replace").lstrip("\ufeff").replace("ï»¿", "")
    return list(csv.DictReader(txt.splitlines()))


def _link(r, acc, note):
    url = PSI_URL.format(acc)
    r["extra_sources"] = "; ".join([x for x in [r["extra_sources"], url] if x])
    r["notes"] = "; ".join([x for x in [r["notes"], note] if x])


bass2 = {row.get("Test #", "").strip(): row for row in _read_psi("PSI-25") if row.get("PI", "").startswith("T")}
for r in rows:
    if r["report_id"] == "NTRS 20150008962":
        m = _re.search(r"-T(\d+)", r["quote"])
        pr = bass2.get(f"T{m.group(1)}") if m else None
        if pr:
            try:
                o2 = float(pr["Calibrated  initial O2 % by vol "])
            except (KeyError, ValueError):
                continue
            if abs(o2 - r["oxygen_pct"]) <= 0.05:
                _link(r, "PSI-25", f"PSI-25 BASS-II experimental table lists test T{m.group(1)} (PI T'ien, {pr['Fuel Sample Material'].strip()}) "
                                   f"with calibrated initial O2 {o2}% - matches")
    q = r["quote"]
    if r["report_id"] == "NTRS 20170008805" and q.startswith("Sample 2-"):
        note = "PSI-99 SAFFIRE-II experimental table lists the same sample, material, 20 cm/s flow and direction"
        if q.startswith("Sample 2-1:"):
            note += " (PSI lists O2 '~ 21.5' for 2-1; the NTRS report table gives ~22.1, which is used here)"
        _link(r, "PSI-99", note)
    if q.startswith("Saffire I-1:"):
        _link(r, "PSI-98", "PSI-98 SAFFIRE-I table: S1 SIBAL, 20 cm/s concurrent, O2 21.5-21.7%, burn time 420 s")
    if q.startswith("Saffire II-5:"):
        _link(r, "PSI-99", "PSI-99 SAFFIRE-II table: 2-5 cotton-fiberglass (SIBAL), 20 cm/s concurrent, micro-g spread length 29 cm, 2.1 mm/s")
    if q.startswith("Saffire II-6:"):
        _link(r, "PSI-99", "PSI-99 SAFFIRE-II table: 2-6 lists 20 cm/s and spread 2.6 mm/s over 29 cm (NTRS 20210011521/20170008805 give 25 cm/s, used here)")
    if q.startswith("Saffire III-1:"):
        _link(r, "PSI-100", "PSI-100 SAFFIRE-III table: S1 SIBAL, concurrent, lists 30 cm/s (NTRS 20210011521 gives 25 cm/s, used here)")

FIELDS = ["row_id", "oxygen_pct", "pressure_kpa", "flow_cm_s", "flow_direction", "gravity_g", "material", "material_detail", "geometry",
          "facility", "outcome", "outcome_detail", "report_id", "source_url", "source_title", "source_location", "quote",
          "notes", "extra_sources"]
for i, r in enumerate(rows, 1):
    r["row_id"] = f"E{i:03d}"
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    w.writerows(rows)
print(f"wrote {len(rows)} rows -> {OUT_CSV}")
try:
    import pandas as pd
    pd.read_csv(OUT_CSV).to_parquet(OUT_CSV.with_suffix(".parquet"), index=False)
    print("wrote parquet")
except Exception as e:  # pyarrow optional
    print("parquet skipped:", e)
