import math
from dataclasses import dataclass, field
from typing import List, Optional, Dict

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
        return 10 + (self.level - 1) * 2 + (self.stats.str * 3)
        
    @property
    def current_hp(self) -> int:
        return self.max_hp - (self.damage_taken_physical + self.damage_taken_magical)

    @property
    def defense(self) -> float:
        # Base 10 + (LVL-1)*0.8 + DEX
        return 10 + (self.level - 1) * 0.8 + self.stats.dex

    @property
    def max_action_points(self) -> float:
        # Base 1 + (LVL*0.5 - 0.5) + DEX*0.5
        return 1 + (self.level * 0.5 - 0.5) + (self.stats.dex * 0.5)
        
    @property
    def max_stamina(self) -> float:
        # Base 1 + (LVL-1)*0.25 + CHA*0.25 (Rounded down or up based on rules, keeping raw float for now)
        return 1 + (self.level - 1) * 0.25 + (self.stats.cha * 0.25)
        
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
