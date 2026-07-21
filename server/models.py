from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional

# --- Deep Nested Models ---

class Modifier(BaseModel):
    source: str
    stat_name: str
    value: float
    mod_type: str = "ADD"
    model_config = ConfigDict(extra='allow')

class StatusEffect(BaseModel):
    title: str
    description: str = ""
    active: bool = True
    modifiers: List[Modifier] = []
    status_id: str
    model_config = ConfigDict(extra='allow')

class CharacterStats(BaseModel):
    base_str: int = 0
    base_dex: int = 0
    base_wis: int = 0
    base_cha: int = 0
    model_config = ConfigDict(extra='allow')

class Item(BaseModel):
    item_id: str
    name: str
    item_type: str = "Misc"
    location: str = "BACKPACK"
    quantity: int = 1
    modifiers: List[Modifier] = []
    model_config = ConfigDict(extra='allow')

# --- Top Level Endpoints Models ---

class PlayerSyncPayload(BaseModel):
    name: str = Field(..., description="The unique name of the player")
    level: int = Field(1, description="Character level")
    stats: Optional[CharacterStats] = None
    inventory: List[Item] = []
    status_effects: List[StatusEffect] = []
    
    # ANY field not explicitly listed above will still be accepted and saved!
    model_config = ConfigDict(extra='allow')

class WagonItem(Item):
    # Inherits everything from Item, can be used for the wagon endpoints
    pass

class RemoveWagonItemRequest(BaseModel):
    item_id: str

class GenericResponse(BaseModel):
    status: str
    message: Optional[str] = None
    item: Optional[Dict[str, Any]] = None
