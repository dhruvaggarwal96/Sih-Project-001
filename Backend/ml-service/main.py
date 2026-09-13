"""Road-condition inference service.

The Node API sends the photo bytes here. This service keeps the Roboflow key on the
server and returns only normalized detections to the API.
"""

import base64
import os
from typing import Literal

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Urban Intelligence Road Model", version="1.0.0")
MAX_IMAGE_BYTES = 8 * 1024 * 1024
SUPPORTED_ISSUES = {"pothole", "garbage", "flooding", "road_blockage", "accident"}


class PredictionRequest(BaseModel):
    imageBase64: str
    mimeType: Literal["image/jpeg", "image/png", "image/webp"]
    demoIssueType: str | None = None


def normalize_issue(value: str | None) -> str | None:
    value = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "potholes": "pothole",
        "road_damage": "pothole",
        "trash": "garbage",
        "waste": "garbage",
        "garbage_overflow": "garbage",
        "waterlogging": "flooding",
        "flood": "flooding",
        "water_logging": "flooding",
        "blockage": "road_blockage",
        "obstruction": "road_blockage",
        "debris": "road_blockage",
        "traffic_obstruction": "road_blockage",
        "crash": "accident",
    }
    value = aliases.get(value, value)
    return value if value in SUPPORTED_ISSUES else None


def convert_prediction(prediction: dict) -> dict | None:
    issue_type = normalize_issue(prediction.get("class") or prediction.get("issueType"))
    if issue_type is None:
        return None
    confidence = float(prediction.get("confidence", 0))
    if confidence > 1:
        confidence /= 100
    return {
        "class": issue_type,
        "confidence": confidence,
        "x": float(prediction.get("x", 0)),
        "y": float(prediction.get("y", 0)),
        "width": float(prediction.get("width", 0)),
        "height": float(prediction.get("height", 0)),
    }


def infer_with_roboflow(image_base64: str) -> dict:
    api_key = os.getenv("ROBOFLOW_API_KEY")
    model_id = os.getenv("ROBOFLOW_MODEL_ID")
    if not api_key or not model_id:
        raise HTTPException(
            status_code=503,
            detail="Roboflow is not configured. Set ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ID on the ML server.",
        )

    try:
        response = requests.post(
            f"https://detect.roboflow.com/{model_id}",
            params={"api_key": api_key},
            data=image_base64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=25,
        )
        response.raise_for_status()
        result = response.json()
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"Roboflow inference failed: {error}") from error

    predictions = [converted for item in result.get("predictions", []) if (converted := convert_prediction(item))]
    image = result.get("image", {})
    return {
        "modelMode": "roboflow",
        "note": "Roboflow hosted model prediction.",
        "imageWidth": image.get("width"),
        "imageHeight": image.get("height"),
        "predictions": predictions,
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "provider": "roboflow" if os.getenv("ROBOFLOW_API_KEY") else "unconfigured",
        "demoMode": os.getenv("DEMO_ML_MODE", "false").lower() == "true",
    }


@app.post("/predict")
def predict(request: PredictionRequest) -> dict:
    try:
        image_bytes = base64.b64decode(request.imageBase64, validate=True)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Photo data is not valid base64.") from error
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Photo must be between 1 byte and 8 MB.")

    if os.getenv("ROBOFLOW_API_KEY") and os.getenv("ROBOFLOW_MODEL_ID"):
        return infer_with_roboflow(request.imageBase64)

    # This is only for an SIH demonstration when a real Roboflow model has not been configured.
    # The returned note keeps the dashboard from presenting it as an AI prediction.
    demo_issue = normalize_issue(request.demoIssueType)
    if os.getenv("DEMO_ML_MODE", "false").lower() == "true" and demo_issue:
        return {
            "modelMode": "demo",
            "note": "Demo mode: the driver-selected issue is not an AI prediction. Configure Roboflow before deployment.",
            "predictions": [{"class": demo_issue, "confidence": 0.72, "x": 320, "y": 240, "width": 180, "height": 120}],
        }

    raise HTTPException(
        status_code=503,
        detail="Road model is not ready. Configure Roboflow or enable explicit demo mode with a selected issue type.",
    )
