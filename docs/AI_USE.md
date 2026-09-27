# AI use disclosure (IGNITE-AI)

- **In the product, at runtime.**
  - No cloud or paid AI service is called.
  - Predictions come from a classical scikit-learn gradient-boosting model trained only on cited experiment rows.
  - Explanations are deterministic templates filled from the prediction object.
  - *Ask IGNITE-AI* uses local TF-IDF retrieval and quotes the retrieved NASA passages verbatim, with source links. Lines built from real table rows are marked "DATA". It declines when nothing relevant is retrieved.
  - An optional local LLM (Ollama) path exists for both explanations and Q&A. It is **off by default** (`IGNITE_LLM=ollama` enables it). Its output is discarded if it contains a number not present in the facts or passages it was given, or, for Q&A, if it does not cite a passage.
- **In development.**
  - An AI coding assistant helped write code, harvest the NTRS and PSI public APIs, and draft documentation.
  - Every dataset row was transcribed from the cited report and carries its verbatim quote and table or page location, so reviewers can check it.
  - Environment and safety facts carry verbatim quotes, which were checked against the source text.
  - Maintainers should re-verify rows against the PDFs before submission (`backend/scripts/build_dataset.py`).
- **Imagery.**
  - The 3D flame, module and window views are procedurally generated (shaders and geometry). They illustrate documented trends and are not a simulation.
  - The AI-generated design mockups were used only as look-and-feel inspiration. No numbers from them are displayed.
  - No AI-generated images are shipped.
