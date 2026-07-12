import math
import uuid
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


@dataclass
class StatusEffect:
    """A named status that can apply stat modifiers when active."""
    title: str
    description: str = ""
    active: bool = True
    modifiers: List[Modifier] = field(default_factory=list)
    status_id: str = field(default_factory=lambda: str(uuid.uuid4()))


class ModifierProvider(ABC):
    @abstractmethod
    def get_modifiers(self, character=None, stat_name: Optional[str] = None) -> List[Modifier]:
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
                [m for m in provider.get_modifiers(self.character, stat_name) if m.stat_name == stat_name]
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

    def get_modifiers(self, character=None, stat_name: Optional[str] = None) -> List[Modifier]:
        mods = []
        level_div = (character.level / 2.0) if character and character.level > 0 else 0.5
        level_mult = (character.level / 2.0) if character else 0.5

        for name, armor in self.types.items():
            if armor.quantity > 0:
                source_name = f"Zbroja: {name}"

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
    BACK = "BACK"
    QUIVER = "QUIVER"
    WAGON = "WAGON"


@dataclass
class Item:
    name: str
    description: str = ""
    space_taken: float = 0.0
    location: ItemLocation = ItemLocation.BACKPACK
    modifiers: List[Modifier] = field(default_factory=list)
    item_type: str = "Misc"
    consumable_effects: Dict[str, any] = field(default_factory=dict)
    max_uses: int = 1
    current_uses: int = 1
    action_cost: str = ""
    properties: Dict[str, any] = field(default_factory=dict)
    quantity: int = 1
    # Stable identifier that survives deep-copies and save/load cycles.
    # Must NOT be compared with Python's id() which is address-based.
    item_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class Weapon(Item):
    # item_type is fixed and excluded from __init__ so it can never be
    # accidentally overridden by a caller passing item_type= to the constructor.
    item_type: str = field(default="Weapon", init=False)
    actions: List[ActionCard] = field(default_factory=list)


@dataclass
class Armor(Item):
    # item_type is fixed and excluded from __init__ so it can never be
    # accidentally overridden by a caller passing item_type= to the constructor.
    item_type: str = field(default="Armor", init=False)
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
    def get_modifiers(self, character, stat_name: Optional[str] = None) -> List[Modifier]:
        mods = []
        # Fast return for base stats to prevent infinite recursion
        if stat_name in ("str", "dex", "wis", "cha"):
            return mods
            
        # max_hp
        mods.append(Modifier("Baza", "max_hp", 10))
        mods.append(Modifier("Poziom", "max_hp", (character.level - 1) * 2))
        mods.append(Modifier("Siła", "max_hp", character.total_str * 3))

        # defense
        mods.append(Modifier("Baza", "defense", 10))
        mods.append(Modifier("Poziom", "defense", (character.level - 1) * 0.8))
        mods.append(Modifier("Zręczność", "defense", character.total_dex))

        # ap
        mods.append(Modifier("Baza", "ap", 1))
        mods.append(Modifier("Poziom", "ap", character.level * 0.5 - 0.5))
        mods.append(Modifier("Zręczność", "ap", character.total_dex * 0.5))

        # stamina
        mods.append(Modifier("Baza", "stamina", 1))
        mods.append(Modifier("Poziom", "stamina", (character.level - 1) * 0.25))
        mods.append(Modifier("Charyzma", "stamina", character.total_cha * 0.25))

        # movement
        mods.append(Modifier("Baza", "movement", 30))

        return mods


class ItemModifierProvider(ModifierProvider):
    def get_modifiers(self, character, stat_name: Optional[str] = None) -> List[Modifier]:
        mods = []
        for item in character.inventory:
            if item.location == ItemLocation.EQUIPPED:
                mods.extend(item.modifiers)
        return mods


class StatusEffectProvider(ModifierProvider):
    """Feeds active StatusEffect modifiers into the stat manager."""

    def get_modifiers(self, character, stat_name: Optional[str] = None) -> List[Modifier]:
        mods = []
        for effect in character.status_effects:
            if effect.active:
                mods.extend(effect.modifiers)
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

        # Status Effects (buffs / debuffs)
        self.status_effects: List[StatusEffect] = []
        self.status_provider = StatusEffectProvider()
        self.stat_manager.add_provider(self.status_provider)

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
    def total_str(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("str", base_value=self.stats.str)["total"])

    @property
    def total_dex(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("dex", base_value=self.stats.dex)["total"])

    @property
    def total_wis(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("wis", base_value=self.stats.wis)["total"])

    @property
    def total_cha(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("cha", base_value=self.stats.cha)["total"])

    @property
    def max_hp(self) -> int:
        return int(self.stat_manager.get_stat_breakdown("max_hp")["total"])

    @property
    def current_hp(self) -> int:
        return self.max_hp - self.damage_taken_magical

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
    def inventory_space(self) -> Dict[str, Dict[str, float]]:
        has_quiver = False
        quiver_item = None
        has_pocket_clothes = False
        pocket_clothes_item = None
        has_attachment_belt = False
        attachment_belt_item = None
        backpack_bonus = 0.0
        best_backpack_item = None

        # Pass 1: Identify items that provide space bonuses
        for item in self.inventory:
            name_lower = item.name.lower()
            loc = item.location

            if (
                name_lower in ("kołczan", "kolczan")
                and loc == ItemLocation.QUIVER
                and not has_quiver
            ):
                has_quiver = True
                quiver_item = item
            elif (
                name_lower in ("ubranie z kieszeniami", "ubrania z kieszeniami")
                and loc == ItemLocation.EQUIPPED
                and not has_pocket_clothes
            ):
                has_pocket_clothes = True
                pocket_clothes_item = item
            elif (
                name_lower == "pasek z mocowaniem"
                and loc == ItemLocation.EQUIPPED
                and not has_attachment_belt
            ):
                has_attachment_belt = True
                attachment_belt_item = item
            elif name_lower == "plecak" and loc == ItemLocation.BACKPACK:
                if 10.0 > backpack_bonus:
                    backpack_bonus = 10.0
                    best_backpack_item = item
            elif (
                name_lower in ("plecak podróżnika", "plecak podroznika")
                and loc == ItemLocation.BACKPACK
            ):
                if 20.0 > backpack_bonus:
                    backpack_bonus = 20.0
                    best_backpack_item = item

        # Pass 2: Calculate used space, skipping the items that provide the bonuses
        used_quick = 0.0
        used_backpack = 0.0
        used_back = 0.0
        used_quiver = 0.0

        # Use stable item_id (UUID) instead of id() which is an ephemeral
        # memory address that changes after deep-copies and save/load cycles.
        exempt_ids = {
            quiver_item.item_id if quiver_item else None,
            pocket_clothes_item.item_id if pocket_clothes_item else None,
            attachment_belt_item.item_id if attachment_belt_item else None,
            best_backpack_item.item_id if best_backpack_item else None,
        }

        for item in self.inventory:
            if item.item_id in exempt_ids:
                continue

            item_total_space = item.space_taken * item.quantity

            if item.location == ItemLocation.EQUIPPED:
                used_quick += item_total_space
            elif item.location == ItemLocation.BACKPACK:
                used_backpack += item_total_space
            elif item.location == ItemLocation.BACK:
                used_back += item_total_space
            elif item.location == ItemLocation.QUIVER:
                used_quiver += item_total_space

        # Coin weight: Złote*0.005 + Srebrne*0.004 + Miedziane*0.01
        used_backpack += (self.gold * 0.005) + (self.silver * 0.004) + (self.copper * 0.01)

        # Calculate max capacities
        max_quick = 20.0 + (self.total_str * 2.0)
        if has_pocket_clothes:
            max_quick += 10.0
        if has_attachment_belt:
            max_quick += 10.0

        max_backpack = 10.0 + (self.max_stamina * 4.0) + backpack_bonus
        max_back = 20.0
        max_quiver = 10.0 if has_quiver else 0.0

        active_containers = {}
        if quiver_item:
            active_containers[quiver_item.item_id] = 10.0
        if pocket_clothes_item:
            active_containers[pocket_clothes_item.item_id] = 10.0
        if attachment_belt_item:
            active_containers[attachment_belt_item.item_id] = 10.0
        if best_backpack_item:
            active_containers[best_backpack_item.item_id] = backpack_bonus

        return {
            "quick": {"used": round(used_quick, 2), "max": round(max_quick, 2)},
            "backpack": {"used": round(used_backpack, 2), "max": round(max_backpack, 2)},
            "back": {"used": round(used_back, 2), "max": round(max_back, 2)},
            "quiver": {
                "used": round(used_quiver, 2),
                "max": round(max_quiver, 2),
                "visible": has_quiver,
            },
            "active_containers": active_containers,
        }

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
