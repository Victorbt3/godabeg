Python ML Service (FastAPI)

Quick start

1. Create a virtualenv and activate it (recommended).
2. pip install -r requirements.txt
3. Run: uvicorn app:app --host 0.0.0.0 --port 8000

Docker (recommended)

- Build and run both services with `docker-compose up --build -d` from the project root. The ML service will create a small demo model automatically if no model is present, allowing end-to-end testing without extra downloads.

Endpoints

- POST /predict (form field `image`) → returns { emotion, confidence, bbox }

Notes

- The service attempts to load `model.h5` from the same folder. If missing, it will run a heuristic fallback (brightness-based) after detecting a face.
- For production, replace `model.h5` with a trained Keras/TensorFlow model that outputs probabilities for labels defined in `LABELS`.
