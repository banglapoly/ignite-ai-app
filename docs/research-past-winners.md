# What makes NASA Space Apps global winners strong: research notes

Researched 2026-09-25. Sources: official winners announcements and the winning teams' own project pages.

## Winners reviewed

| Year | Team / project | Award | Link |
|---|---|---|---|
| 2025 | SpaceGenes+ (synergy dashboard for molecular space health) | Best Use of Science | https://www.spaceappschallenge.org/2025/find-a-team/spacegenes/?tab=project |
| 2025 | Resonant Exoplanets (AI exoplanet and biosignature pipeline) | Best Use of Data | https://www.spaceappschallenge.org/2025/find-a-team/resonant-exoplanets/?tab=project |
| 2025 | Twisters / SkySense (NASA POWER + AI weather risk) | Best Use of Technology | https://www.spaceappschallenge.org/2025/find-a-team/twisters/?tab=project |
| 2025 | Astro Sweepers (orbital-debris compliance and risk index) | Galactic Impact | https://www.spaceappschallenge.org/2025/find-a-team/astro-sweepers-we-catch-what-space-leaves-behind/?tab=project |
| 2024 | WMPGang, GaamaRamma, 42 QuakeHeroes, NVS-knot, AsturExplorers (Landsat Connect), Innovisionaries, TerraTales, Asteroid Destroyer, Connected Earth Museum, Team I.O. | the 10 global awards | https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/ |
| 2023 | LunarTech Ensemble / Lunar Trek (3D moon globe + UE5 game on Apollo seismic data) | Best Use of Science | https://www.spaceappschallenge.org/2023/find-a-team/lunartech-ensemble/?tab=project |
| 2023 | full list of 10 winners | | https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/ |
| all | Award definitions (Best Use of Science = "best and most valid use of science and/or the scientific method") | | https://www.spaceappschallenge.org/2025/awards/ |

The spaceappschallenge.org project pages render client-side, so I read them with a headless browser. The 2024 project pages returned 404 at the time of reading, so 2024 is covered through NASA's announcement.

## Takeaways, and how this site applies them

1. **Name the exact NASA dataset in the first paragraph.** SpaceGenes+ opens with "NASA GeneLab OSD-288". Resonant Exoplanets names Kepler, TESS and JWST. Twisters names the NASA POWER API.
   *Applied:* the hero, stats bar and every prediction cite NTRS record IDs. The Sources section lists all 14 NTRS records row by row.
2. **One-sentence problem, then who it helps.** Winners state the gap in one line (for example, "most space omics tools treat stressors in isolation") and then name the users (researchers, mission planners, operators).
   *Applied:* a "The problem" section, plus a dedicated "For spacecraft operators" section.
3. **A working, interactive demo linked from the project page.** Every winner reviewed links a live app and a demo video.
   *Applied:* the flammability explorer runs locally with one command. A killer-demo button replays the 21→17% O₂ sweep, ready to record for the video.
4. **Show the method, not only the output.** Astro Sweepers documents its risk formula component by component. Resonant Exoplanets describes the whole pipeline (fetch → detect → validate). The Best Use of Science award literally scores validity.
   *Applied:* a model card with honest CV accuracy, a majority baseline, leave-reports-out accuracy, the confusion matrix, class definitions, the training envelope and a row-level data table with quotes.
5. **Trust over hype, especially with AI.** Resonant Exoplanets argues that "traditional AI can misclassify or hallucinate". Twisters discloses exactly where AI tools were used.
   *Applied:* a range guard that refuses to extrapolate, an explanation layer that cannot state numbers absent from the prediction object, and an AI-use disclosure (docs/AI_USE.md).
6. **One memorable visual or interaction.** Lunar Trek's 3D moon globe and the 3D exoplanet explorer (Asteroid Destroyer, 2024) are what people remember.
   *Applied:* a 3D hero scene that toggles between an Earth-gravity teardrop flame and a spherical, dim blue microgravity flame, and a live decision-boundary plot with real experiments overlaid.
7. **Impact framing with a path forward.** Winners describe future filters, users and scale ("in future, users will be able to…").
   *Applied:* safety framing for Artemis-style exploration atmospheres (Saffire VI, FM²), plus a README roadmap (more NTRS extraction, SoFIE data once published).
8. **Team and credits visible.** Every page has a Members tab.
   *Applied:* not used; the project does not show a team section.
