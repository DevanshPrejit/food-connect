import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
from ngo_scoring_engine import NGONotificationEngine

# Resolve model path relative to this script's directory (not CWD)
_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_DIR)
_MODEL_PATH = os.path.join(_DIR, "best_travel_time_model.pkl")
_DIST_DIR = os.path.join(_PROJECT_ROOT, "dist")

app = FastAPI(title="Food Connect ML Service & Web UI")

# Allow the Vite dev-server and any production frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = NGONotificationEngine(_MODEL_PATH)

# ── Health check ────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "model": engine.model_bundle["model_name"]}

# ── Request schema ──────────────────────────────
class DonationRequest(BaseModel):
    donation_id: str
    donor: dict
    ngo_list: list


# ── Score NGOs ──────────────────────────────────
@app.post("/api/score")
def score_ngos(req: DonationRequest):
    req.donor["expiry_time"] = datetime.fromisoformat(
    req.donor["expiry_time"]
    ).replace(tzinfo=None)
    ranked = engine.rank_ngos(req.donor, req.ngo_list)
    return ranked.to_dict(orient="records")


# ── Dispatch donation ───────────────────────────
@app.post("/api/dispatch")
def dispatch(req: DonationRequest):
    req.donor["expiry_time"] = datetime.fromisoformat(
    req.donor["expiry_time"]
).replace(tzinfo=None)
    engine.dispatch(req.donation_id, req.donor, req.ngo_list)
    return {"status": "dispatched", "donation_id": req.donation_id}


# ── Serve React Frontend ─────────────────────────
if os.path.isdir(_DIST_DIR):
    app.mount("/", StaticFiles(directory=_DIST_DIR, html=True), name="static")

    @app.exception_handler(404)
    async def custom_404_handler(request, __):
        # Serve index.html for React Router to handle client-side routes
        return FileResponse(os.path.join(_DIST_DIR, "index.html"))
else:
    print(f"[WARN] Dist directory not found at {_DIST_DIR}. Make sure to run 'npm run build'.")

