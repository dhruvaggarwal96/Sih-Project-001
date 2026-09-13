# Road-condition model service

This service calls a private Roboflow model for `pothole`, `garbage`, `flooding`, `road_blockage`, and `accident` detection. The Roboflow key stays here, never in either Expo app or the dashboard.

```powershell
cd 'C:\Users\LENOVO\Desktop\SIH Project\Backend\ml-service'
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8001
```

Set `ROBOFLOW_API_KEY` and `ROBOFLOW_MODEL_ID` in `.env`. Get the model ID from the Roboflow model's **Get curl command**. The Node backend calls this service at `http://127.0.0.1:8001` by default.

For the SIH demo only, set `DEMO_ML_MODE=true`. The driver then selects the demonstration issue type; the resulting ticket is marked **demo** and is not presented as an AI result.
