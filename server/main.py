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

PLAYERS_DATA_DIR = os.path.join(BASE_DIR, "data", "players")

import threading
import time
import shutil

state_lock = threading.Lock()

def load_state() -> Dict[str, Any]:
    state = {}
    with state_lock:
        if os.path.exists(PLAYERS_DATA_DIR):
            for player_name in os.listdir(PLAYERS_DATA_DIR):
                player_dir = os.path.join(PLAYERS_DATA_DIR, player_name)
                state_file = os.path.join(player_dir, "state.json")
                if os.path.isdir(player_dir) and os.path.exists(state_file):
                    try:
                        with open(state_file, "r", encoding="utf-8") as f:
                            state[player_name] = json.load(f)
                    except Exception as e:
                        logger.error(f"Error loading state for {player_name}: {e}")
    return state

def save_player_state(player_name: str, data: Dict[str, Any]):
    # Note: caller should hold state_lock if doing read-modify-write
    player_dir = os.path.join(PLAYERS_DATA_DIR, player_name)
    os.makedirs(player_dir, exist_ok=True)
    state_file = os.path.join(player_dir, "state.json")
    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving state for {player_name}: {e}")


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
            
        if player_name == "test_ping":
            return {"status": "success", "message": "Pong!"}
            
        with state_lock:
            data["_last_sync"] = time.time()
            save_player_state(player_name, data)
        
        logger.info(f"Successfully synced state for player: {player_name}")
        return {"status": "success", "message": f"State updated for {player_name}"}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/players/{player_name}")
async def delete_player(player_name: str, username: str = Depends(get_current_user)):
    """
    Deletes the data for a specific player. Protected by auth.
    """
    with state_lock:
        player_dir = os.path.join(PLAYERS_DATA_DIR, player_name)
        if os.path.exists(player_dir):
            try:
                shutil.rmtree(player_dir)
                logger.info(f"Deleted data for player: {player_name}")
                return {"status": "success", "message": f"Deleted player {player_name}"}
            except Exception as e:
                logger.error(f"Failed to delete player {player_name}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to delete player: {e}")
        else:
            raise HTTPException(status_code=404, detail="Player not found")


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
