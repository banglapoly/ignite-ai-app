# IGNITE-AI API: Hugging Face Docker Space (backend only).
# Build context = the Space folder produced by deploy/make_hf_space.ps1:
#   Dockerfile, README.md, .dockerignore, backend/   (backend/ is the repo's backend folder)
FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    IGNITE_CORS_ORIGINS="*" \
    IGNITE_LLM=off

# Hugging Face runs Space containers as uid 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH
WORKDIR /home/user/app

# Dependencies first (cached layer), then the code and data.
COPY --chown=user backend/requirements.txt backend/requirements.txt
RUN pip install --user -r backend/requirements.txt

COPY --chown=user backend/ backend/
WORKDIR /home/user/app/backend

# Retrain the model from the committed NASA-derived dataset (deterministic, a few seconds)
# so data/artifacts always matches the installed scikit-learn, then run the test suite
# so a broken image never starts.
RUN python -m src.compute.model && python -m tests.test_core

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
