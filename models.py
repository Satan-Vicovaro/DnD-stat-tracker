import math
from dataclasses import dataclass, field
from typing import List, Optional, Dict
import json
import os

@dataclass
class ArmorType:
    name: str
    space_per_fragment: int
    effects: Dict[str, float] = field(default_factory=dict)
    quantity: int = 0

    @property
    def used_space(self) -> int:
        return self.quantity * self.space_per_fragment

@dataclass
class ArmorState:
    max_space: int = 24
    types: Dict[str, ArmorType] = field(default_factory=dict)

    @property
    def total_used_space(self) -> int:
        return sum(t.used_space for t in self.types.values())

    @property
    def remaining_space(self) -> int:
        return self.max_space - self.total_used_space

def load_armor_config(file_path: str = 'config/armor_config.json') -> ArmorState:
    state = ArmorState()
    if not os.path.exists(file_path):
        return state
        
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    state.max_space = data.get("max_space", 24)
    for name, info in data.get("types", {}).items():
        state.types[name] = ArmorType(
            name=name, 
            space_per_fragment=info.get("space_per_fragment", 0),
            effects=info.get("effects", {})
        )
    return state

@dataclass
class ActionCard:
    card_value: int
    action_name: str
    action_cost: float
    range_str: str
    hit_roll: str
    damage_roll: str
    targets: str
    turn_execution: str
    description: str

@dataclass
class Item:
    name: str
    cost_silver: Optional[float] = None
    space_taken: float = 0.0

@dataclass
class Weapon(Item):
    actions: List[ActionCard] = field(default_factory=list)

@dataclass
class Armor(Item):
    effect_value: str = ""
    uses_durability: str = ""
    cost_type: str = ""

@dataclass
class CharacterStats:
    base_str: int = 0
    base_dex: int = 0
    base_wis: int = 0
    base_cha: int = 0
    
    # Optional stat modifiers (from items/buffs)
    mod_str: int = 0
    mod_dex: int = 0
    mod_wis: int = 0
    mod_cha: int = 0

    @property
    def str(self) -> int:
        return self.base_str + self.mod_str

    @property
    def dex(self) -> int:
        return self.base_dex + self.mod_dex

    @property
    def wis(self) -> int:
        return self.base_wis + self.mod_wis

    @property
    def cha(self) -> int:
        return self.base_cha + self.mod_cha


class Character:
    def __init__(self, name: str, level: int = 1):
        self.name = name
        self.level = level
        self.stats = CharacterStats()
        self.armor_state = load_armor_config()
        
        # Combat State
        self.damage_taken_physical: int = 0
        self.damage_taken_magical: int = 0
        self.current_action_points: float = 0.0
        
        # Economy
        self.copper: int = 0
        self.silver: int = 0
        self.gold: int = 0
        
        # Inventory
        self.backpack: List[Item] = []
        self.equipped_weapons: List[Weapon] = []
        self.equipped_armor: Optional[Armor] = None
        
        self.base_movement: int = 30
        
    # --- Derived Attributes ---

    @property
    def unspent_stat_points(self) -> int:
        # Starts with 3 points, gains 2 per level
        total_earned = 3 + (self.level - 1) * 2
        spent = self.stats.base_str + self.stats.base_dex + self.stats.base_wis + self.stats.base_cha
        return total_earned - spent

    @property
    def max_hp(self) -> int:
        # Base 10 + (LVL-1)*2 + STR*3
        base = 10 + (self.level - 1) * 2 + (self.stats.str * 3)
        armor_bonus = sum(t.quantity * t.effects.get("hp_per_fragment", 0) for t in self.armor_state.types.values())
        return int(base + armor_bonus)
        
    @property
    def current_hp(self) -> int:
        return self.max_hp - (self.damage_taken_physical + self.damage_taken_magical)

    @property
    def defense(self) -> float:
        # Base 10 + (LVL-1)*0.8 + DEX
        base = 10 + (self.level - 1) * 0.8 + self.stats.dex
        level_div = (self.level / 2.0) if self.level > 0 else 0.5
        armor_penalty = sum(t.quantity * t.effects.get("defense_penalty", 0.0) for t in self.armor_state.types.values())
        return base - (armor_penalty / level_div)

    @property
    def max_action_points(self) -> float:
        # Base 1 + (LVL*0.5 - 0.5) + DEX*0.5
        base = 1 + (self.level * 0.5 - 0.5) + (self.stats.dex * 0.5)
        level_div = (self.level / 2.0) if self.level > 0 else 0.5
        armor_penalty = sum(t.quantity * t.effects.get("ap_penalty", 0.0) for t in self.armor_state.types.values())
        return base - (armor_penalty / level_div)
        
    @property
    def max_stamina(self) -> float:
        # Base 1 + (LVL-1)*0.25 + CHA*0.25 (Rounded down or up based on rules, keeping raw float for now)
        base = 1 + (self.level - 1) * 0.25 + (self.stats.cha * 0.25)
        level_mult = (self.level / 2.0)
        armor_penalty = sum(t.quantity * t.effects.get("stamina_penalty", 0.0) for t in self.armor_state.types.values())
        return base - (armor_penalty * level_mult)
        
    @property
    def movement(self) -> int:
        return self.base_movement  # Modifiers to be added based on armor/items
        
    @property
    def max_inventory_space(self) -> float:
        # Base is 20, can be expanded with items
        base_space = 20.0
        for item in self.backpack:
            if item.name == "Ubrania z kieszeniami" or item.name == "Pasek z mocowaniem":
                base_space += 10.0
        return base_space

    @property
    def current_inventory_space(self) -> float:
        used_space = 0.0
        for item in self.backpack:
            used_space += item.space_taken
        for weapon in self.equipped_weapons:
            used_space += weapon.space_taken
            
        # Coin weight: Złote*0.005 + Srebrne*0.004 + Miedziane*0.01
        coin_weight = (self.gold * 0.005) + (self.silver * 0.004) + (self.copper * 0.01)
        
        return used_space + coin_weight

    # --- Actions ---

    def start_turn(self):
        """Resets Action Points at the start of the round."""
        self.current_action_points = self.max_action_points
        
    def use_action(self, action: ActionCard) -> bool:
        """Attempts to use an action. Returns True if successful."""
        if self.current_action_points >= action.action_cost:
            self.current_action_points -= action.action_cost
            return True
        return False
