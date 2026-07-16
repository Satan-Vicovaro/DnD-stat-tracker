import json
import os
import logging
from typing import Dict, Any
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Game Master Sync Server")

# Set up templates
# Assuming this file is run from the `server` directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

DATA_FILE = os.path.join(BASE_DIR, "data", "players.json")

import threading

state_lock = threading.Lock()

def load_state() -> Dict[str, Any]:
    with state_lock:
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading state: {e}")
        return {}

def save_state(state: Dict[str, Any]):
    # Note: caller should hold state_lock if doing read-modify-write
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving state: {e}")


@app.post("/api/sync")
async def sync_player_state(request: Request):
    """
    Receives JSON payload from the game client and updates the player state.
    Note: We aren't requiring auth for sync yet, so clients can easily push data.
    """
    try:
        data = await request.json()
        player_name = data.get("name")
        if not player_name:
            raise HTTPException(status_code=400, detail="Missing 'name' in payload")
            
        with state_lock:
            # We must load, modify, and save within the same lock to prevent race conditions
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, "r", encoding="utf-8") as f:
                        current_state = json.load(f)
                except Exception:
                    current_state = {}
            else:
                current_state = {}
                
            current_state[player_name] = data
            save_state(current_state)
        
        logger.info(f"Successfully synced state for player: {player_name}")
        return {"status": "success", "message": f"State updated for {player_name}"}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/players")
async def get_all_players(username: str = Depends(get_current_user)):
    """
    Returns the current state of all players. Protected by auth.
    """
    return load_state()


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, username: str = Depends(get_current_user)):
    """
    Game Master Dashboard View. Protected by auth.
    """
    return templates.TemplateResponse(
        "index.html", 
        {"request": request, "gm_name": username}
    )
