import math
from dataclasses import dataclass, field
from typing import List, Optional, Dict
import json
import os
from abc import ABC, abstractmethod
from enum import Enum

@dataclass
class Modifier:
    source: str
    stat_name: str
    value: float
    mod_type: str = "ADD"


class ModifierProvider(ABC):
    @abstractmethod
    def get_modifiers(self, character=None) -> List[Modifier]:
        pass


class StatManager:
    def __init__(self, character):
        self.character = character
        self.providers: List[ModifierProvider] = []

    def add_provider(self, provider: ModifierProvider):
        if provider not in self.providers:
            self.providers.append(provider)

    def get_stat_breakdown(self, stat_name: str, base_value: float = 0.0) -> Dict:
        modifiers = []
        for provider in self.providers:
            modifiers.extend(
                [m for m in provider.get_modifiers(self.character) if m.stat_name == stat_name]
            )

        aggregated = {}
        for mod in modifiers:
            if mod.source not in aggregated:
                aggregated[mod.source] = 0.0
            aggregated[mod.source] += mod.value

        breakdown = [
            {"source": source, "value": round(val, 2)}
            for source, val in aggregated.items()
            if round(val, 2) != 0
        ]

        total = base_value + sum(item["value"] for item in breakdown)

        return {"total": round(total, 2) if total % 1 != 0 else int(total), "breakdown": breakdown}


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
class ArmorState(ModifierProvider):
    max_space: int = 24
    types: Dict[str, ArmorType] = field(default_factory=dict)

    @property
    def total_used_space(self) -> int:
        return sum(t.used_space for t in self.types.values())

    @property
    def remaining_space(self) -> int:
        return self.max_space - self.total_used_space

    def get_modifiers(self, character=None) -> List[Modifier]:
        mods = []
        level_div = (character.level / 2.0) if character and character.level > 0 else 0.5
        level_mult = (character.level / 2.0) if character else 0.5

        for name, armor in self.types.items():
            if armor.quantity > 0:
                source_name = f"Zbroja: {name}"

                hp = armor.effects.get("hp_per_fragment", 0.0) * armor.quantity
                if hp != 0:
                    mods.append(Modifier(source_name, "max_hp", hp))

                def_pen = armor.effects.get("defense_penalty", 0.0) * armor.quantity
                if def_pen != 0:
                    mods.append(Modifier(source_name, "defense", -(def_pen / level_div)))

                ap_pen = armor.effects.get("ap_penalty", 0.0) * armor.quantity
                if ap_pen != 0:
                    mods.append(Modifier(source_name, "ap", -(ap_pen / level_div)))

                stam_pen = armor.effects.get("stamina_penalty", 0.0) * armor.quantity
                if stam_pen != 0:
                    mods.append(Modifier(source_name, "stamina", -(stam_pen * level_mult)))

                move_pen = armor.effects.get("movement_penalty", 0.0) * armor.quantity
                if move_pen != 0:
                    mods.append(Modifier(source_name, "movement", -move_pen))
        return mods


def load_armor_config(file_path: str = "config/armor_config.json") -> ArmorState:
    state = ArmorState()
    if not os.path.exists(file_path):
        return state

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    state.max_space = data.get("max_space", 24)
    for name, info in data.get("types", {}).items():
        state.types[name] = ArmorType(
            name=name,
            space_per_fragment=info.get("space_per_fragment", 0),
            effects=info.get("effects", {}),
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


class ItemLocation(str, Enum):
    EQUIPPED = "EQUIPPED"
    BACKPACK = "BACKPACK"
    WAGON = "WAGON"

@dataclass
class Item:
    name: str
    description: str = ""
    space_taken: float = 0.0
    location: ItemLocation = ItemLocation.BACKPACK
    modifiers: List[Modifier] = field(default_factory=list)
    item_type: str = "Misc"

    def __post_init__(self):
        if isinstance(self, Weapon):
            self.item_type = "Weapon"
        elif isinstance(self, Armor):
            self.item_type = "Armor"


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


class CharacterBaseProvider(ModifierProvider):
    def get_modifiers(self, character) -> List[Modifier]:
        mods = []
        # max_hp
        mods.append(Modifier("Baza", "max_hp", 10))
        mods.append(Modifier("Poziom", "max_hp", (character.level - 1) * 2))
        mods.append(Modifier("Siła", "max_hp", character.stats.str * 3))

        # defense
        mods.append(Modifier("Baza", "defense", 10))
        mods.append(Modifier("Poziom", "defense", (character.level - 1) * 0.8))
        mods.append(Modifier("Zręczność", "defense", character.stats.dex))

        # ap
        mods.append(Modifier("Baza", "ap", 1))
        mods.append(Modifier("Poziom", "ap", character.level * 0.5 - 0.5))
        mods.append(Modifier("Zręczność", "ap", character.stats.dex * 0.5))

        # stamina
        mods.append(Modifier("Baza", "stamina", 1))
        mods.append(Modifier("Poziom", "stamina", (character.level - 1) * 0.25))
        mods.append(Modifier("Charyzma", "stamina", character.stats.cha * 0.25))

        # movement
        mods.append(Modifier("Baza", "movement", 30))

        return mods

class ItemModifierProvider(ModifierProvider):
    def get_modifiers(self, character) -> List[Modifier]:
        mods = []
        for item in character.inventory:
            if item.location == ItemLocation.EQUIPPED:
                mods.extend(item.modifiers)
        return mods


class Character:
    def __init__(self, name: str, level: int = 1):
        self.name = name
        self.level = level
        self.stats = CharacterStats()
        self.armor_state = load_armor_config()

        self.stat_manager = StatManager(self)
        self.base_provider = CharacterBaseProvider()
        self.stat_manager.add_provider(self.base_provider)
        self.stat_manager.add_provider(self.armor_state)
        
        self.item_provider = ItemModifierProvider()
        self.stat_manager.add_provider(self.item_provider)

        # Combat State
        self.damage_taken_physical: int = 0
        self.damage_taken_magical: int = 0
        self.current_action_points: float = 0.0

        # Economy
        self.copper: int = 0
        self.silver: int = 0
        self.gold: int = 0

        # Inventory
        self.inventory: List[Item] = []

        self.base_movement: int = 30

    # --- Derived Attributes ---

    @property
    def unspent_stat_points(self) -> int:
        # Starts with 3 points, gains 2 per level
        total_earned = 3 + (self.level - 1) * 2
        spent = (
            self.stats.base_str + self.stats.base_dex + self.stats.base_wis + self.stats.base_cha
        )
        return total_earned - spent

    @property
    def max_hp(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("max_hp")["total"])

    @property
    def current_hp(self) -> int:
        return self.max_hp - (self.damage_taken_physical + self.damage_taken_magical)

    @property
    def defense(self) -> float:
        return self.stat_manager.get_stat_breakdown("defense")["total"]

    @property
    def max_action_points(self) -> float:
        return self.stat_manager.get_stat_breakdown("ap")["total"]

    @property
    def max_stamina(self) -> float:
        return self.stat_manager.get_stat_breakdown("stamina")["total"]

    @property
    def movement(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("movement")["total"])

    @property
    def max_inventory_space(self) -> float:
        # Base is 20, can be expanded with items
        base_space = 20.0
        for item in self.inventory:
            if item.location in (ItemLocation.BACKPACK, ItemLocation.EQUIPPED):
                if item.name == "Ubrania z kieszeniami" or item.name == "Pasek z mocowaniem":
                    base_space += 10.0
        return base_space

    @property
    def current_inventory_space(self) -> float:
        used_space = 0.0
        for item in self.inventory:
            if item.location in (ItemLocation.BACKPACK, ItemLocation.EQUIPPED):
                used_space += item.space_taken

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
