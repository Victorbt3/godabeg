Node proxy server (forwards images to Python ML service)

Quick start

1. Copy `.env.example` to `.env` and edit `PY_SERVICE_URL` if your Python service runs elsewhere.
2. npm install
3. npm start

Endpoints

- POST /api/scan (form-data, field `image`) → returns { emotion, confidence, bbox }
- GET /health → status

Notes

- The server validates image type/size and forwards the binary to the configured Python ML service.
- If the Python service returns invalid JSON, the server returns a 502.

Example (curl):

curl -F "image=@/path/to/photo.jpg" http://localhost:3000/api/scan

Tip: Open the app at http://localhost:3000/scan.html after starting the server.

Docker / Auto-start

- You can run both services with Docker Compose: `docker-compose up --build -d`.
- Compose sets `restart: unless-stopped` so containers will restart automatically (and after reboots if Docker Desktop is set to start at login).

Quick Win (Windows): run `.\\\nsetup_and_run.ps1` from PowerShell (Administrator) to install deps and start the containers automatically.
