---
title: IGNITE-AI API
emoji: 🔥
colorFrom: red
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: Microgravity fire-spread prediction API (NASA data)
---

# IGNITE-AI API

This is the backend for **IGNITE-AI**, which does predictive fire-safety analytics for spacecraft cabins. It is a read-only FastAPI service. The website itself is a static site hosted separately (Netlify), which proxies `/api/*` to this Space.

- `GET /health`: status and model summary
- `GET /api/model`: model card, with honest cross-validated metrics
- `POST /api/predict`: flame-spread class for a set of cabin conditions. Inputs outside the tested envelope are refused, not extrapolated.
- `POST /api/ask`: answers questions with quotes and citations from NASA reports (extractive retrieval, not generation)
- `GET /docs`: interactive OpenAPI documentation

**Data.** The model is trained on 144 rows transcribed from 13 NASA technical reports, with further tables from NASA Physical Sciences Informatics. The model is retrained when the image is built. This is not a certification tool: NASA-STD-6001 testing governs material acceptance. NASA does not endorse this project.

The source code is in the project's GitHub repository. Code is licensed under Apache-2.0.
