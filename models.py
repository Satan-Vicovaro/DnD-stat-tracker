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
        mult_mods = []
        for mod in modifiers:
            mod_type = getattr(mod, "mod_type", "ADD")
            if mod_type == "MULT":
                mult_mods.append(mod)
            else:
                if mod.source not in aggregated:
                    aggregated[mod.source] = 0.0
                aggregated[mod.source] += mod.value

        breakdown = [
            {"source": source, "value": round(val, 2)}
            for source, val in aggregated.items()
            if round(val, 2) != 0
        ]

        total = base_value + sum(val for val in aggregated.values())
        
        for mod in mult_mods:
            new_total = total * mod.value
            bonus = new_total - total
            total = new_total
            if round(bonus, 2) != 0:
                breakdown.append({
                    "source": f"{mod.source} (x{mod.value})", 
                    "value": round(bonus, 2)
                })

        return {"total": int(math.floor(total + 0.5)), "breakdown": breakdown}


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

        for name, armor in self.types.items():
            if armor.quantity > 0:
                source_name = f"Zbroja: {name}"

                def_pen = armor.effects.get("defense_penalty", 0.0) * armor.quantity
                if def_pen != 0:
                    mods.append(Modifier(source_name, "defense", -def_pen))

                ap_pen = armor.effects.get("ap_penalty", 0.0) * armor.quantity
                if ap_pen != 0:
                    mods.append(Modifier(source_name, "ap", -ap_pen))

                stam_pen = armor.effects.get("stamina_penalty", 0.0) * armor.quantity
                if stam_pen != 0:
                    mods.append(Modifier(source_name, "stamina", -stam_pen))

                move_pen = armor.effects.get("movement_penalty", 0.0) * armor.quantity
                if move_pen != 0:
                    mods.append(Modifier(source_name, "movement", -move_pen))
        return mods



_GAME_RULES_CACHE = None

def get_resource_path(relative_path: str) -> str:
    """Return the path for external static resources (config), which lives next to the executable."""
    import sys
    if getattr(sys, "frozen", False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def get_game_rules(file_path: str = "config/game_rules.json") -> dict:
    global _GAME_RULES_CACHE
    if _GAME_RULES_CACHE is None:
        full_path = get_resource_path(file_path)
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                _GAME_RULES_CACHE = json.load(f)
        else:
            _GAME_RULES_CACHE = {}
    return _GAME_RULES_CACHE

def load_armor_config(file_path: str = "config/armor_config.json") -> ArmorState:
    state = ArmorState()
    full_path = get_resource_path(file_path)
    if not os.path.exists(full_path):
        return state

    with open(full_path, "r", encoding="utf-8") as f:
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
    CLOTHES = "CLOTHES"


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
    is_equipped: bool = False
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
            
        rules = get_game_rules().get("stats_scaling", {})
        name_map = {
            "level": "Poziom",
            "total_str": "Siła",
            "total_dex": "Zręczność",
            "total_wis": "Mądrość",
            "total_cha": "Charyzma"
        }
        
        for stat, conf in rules.items():
            base = conf.get("base", 0)
            if base != 0:
                mods.append(Modifier("Baza", stat, base))
                
            for scale in conf.get("scaling", []):
                source = scale.get("source")
                multiplier = scale.get("multiplier", 1.0)
                divisor = scale.get("divisor", 1.0)
                offset = scale.get("offset", 0.0)
                
                val = getattr(character, source, 0)
                calc_val = ((val + offset) * multiplier) / divisor
                
                if calc_val != 0:
                    mods.append(Modifier(name_map.get(source, source), stat, calc_val))

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


class ManaBoostProvider(ModifierProvider):
    """Feeds temporary mana boosts into the stat manager."""

    def get_modifiers(self, character, stat_name: Optional[str] = None) -> List[Modifier]:
        mods = []
        # Mapping from UI/buff keys to actual stat names
        stat_map = {
            "Obrona": "defense",
            "Akcje": "ap",
            "Wytrwałość": "stamina",
            "Ruch": "movement"
        }
        for buff_key, value in character.mana_buffs.items():
            if value > 0 and buff_key in stat_map:
                target_stat = stat_map[buff_key]
                if stat_name is None or stat_name == target_stat:
                    # Depending on rules, 1 mana = 1 point of boost
                    mods.append(Modifier("Magia", target_stat, value))
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

        # Magia (Mana)

        self.current_mana: int = 0
        self.mana_spent_this_turn: int = 0
        self.mana_buffs: Dict[str, int] = {
            "Obrona": 0,
            "Akcje": 0,
            "Wytrwałość": 0,
            "Ruch": 0,
            "Redukcja obrażeń": 0,
            "Przerzucenie kostki": 0,
            "Inne": 0
        }
        self.mana_provider = ManaBoostProvider()
        self.stat_manager.add_provider(self.mana_provider)

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

        self.notes: str = ""

        self.base_movement: int = 30

    # --- Derived Attributes ---

    @property
    def unspent_stat_points(self) -> int:
        rules = get_game_rules().get("progression", {})
        initial = rules.get("starting_unspent_stat_points", 3)
        per_lvl = rules.get("unspent_stat_points_per_level", 2)
        total_earned = initial + (self.level - 1) * per_lvl
        spent = (
            self.stats.base_str + self.stats.base_dex + self.stats.base_wis + self.stats.base_cha
        )
        return total_earned - spent

    @property
    def total_str(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("str", base_value=self.stats.str)["total"] + 0.5))

    @property
    def total_dex(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("dex", base_value=self.stats.dex)["total"] + 0.5))

    @property
    def total_wis(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("wis", base_value=self.stats.wis)["total"] + 0.5))

    @property
    def total_cha(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("cha", base_value=self.stats.cha)["total"] + 0.5))

    @property
    def max_mana(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("max_mana")["total"] + 0.5))

    @property
    def mana_per_turn(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("mana_per_turn")["total"] + 0.5))

    @property
    def max_hp(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("max_hp")["total"] + 0.5))

    @property
    def current_hp(self) -> int:
        return self.max_hp - self.damage_taken_magical

    @property
    def defense(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("defense")["total"] + 0.5))

    @property
    def max_action_points(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("ap")["total"] + 0.5))

    @property
    def max_stamina(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("stamina")["total"] + 0.5))

    @property
    def movement(self) -> int:
        return int(math.floor(self.stat_manager.get_stat_breakdown("movement")["total"] + 0.5))

    @property
    def inventory_space(self) -> Dict[str, Dict[str, float]]:
        has_quiver = False
        quick_bonus = 0.0
        back_bonus = 0.0
        quiver_bonus = 0.0
        best_backpack_item = None
        best_backpack_value = 0.0
        
        active_containers = {}
        exempt_ids = set()

        # Pass 1: Identify items that provide space bonuses
        for item in self.inventory:
            name_lower = item.name.lower()
            loc = item.location

            item_quick = 0.0
            item_backpack = 0.0
            item_back = 0.0
            item_quiver = 0.0

            # 1. Modifiers check (works as tags on the item)
            for mod in item.modifiers:
                if mod.stat_name == "quick_space": item_quick += mod.value
                elif mod.stat_name == "backpack_space": item_backpack += mod.value
                elif mod.stat_name == "back_space": item_back += mod.value
                elif mod.stat_name == "quiver_space": item_quiver += mod.value

            # 3. Apply bonuses and mark as active containers
            granted = 0.0
            
            if item.is_equipped:
                if item_quick > 0:
                    quick_bonus += item_quick
                    granted += item_quick
                if item_back > 0:
                    back_bonus += item_back
                    granted += item_back
                if item_quiver > 0:
                    has_quiver = True
                    quiver_bonus += item_quiver
                    granted += item_quiver
                
                # Backpacks take max so you can't infinitely nest them
                if item_backpack > 0:
                    if item_backpack > best_backpack_value:
                        best_backpack_value = item_backpack
                        best_backpack_item = item

            if granted > 0:
                active_containers[item.item_id] = granted
                exempt_ids.add(item.item_id)

        if best_backpack_item:
            active_containers[best_backpack_item.item_id] = best_backpack_value
            exempt_ids.add(best_backpack_item.item_id)

        # Pass 2: Calculate used space, skipping the items that provide the bonuses
        used_quick = 0.0
        used_backpack = 0.0
        used_back = 0.0
        used_quiver = 0.0

        for item in self.inventory:
            quantity_to_weigh = item.quantity
            if item.item_id in exempt_ids:
                # One instance of this item acts as the container and its weight is exempt.
                # The rest of the stack still contributes to the used space.
                quantity_to_weigh -= 1
            
            if quantity_to_weigh <= 0:
                continue

            item_total_space = item.space_taken * quantity_to_weigh

            if item.location == ItemLocation.EQUIPPED:
                used_quick += item_total_space
            elif item.location == ItemLocation.BACKPACK:
                used_backpack += item_total_space
            elif item.location == ItemLocation.BACK:
                used_back += item_total_space
            elif item.location == ItemLocation.QUIVER:
                used_quiver += item_total_space

        # Load rules
        rules = get_game_rules().get("inventory", {})
        coin_weights = rules.get("coin_weights", {"gold": 0.005, "silver": 0.004, "copper": 0.01})
        caps = rules.get("capacity_scaling", {})

        # Coin weight
        used_backpack += (self.gold * coin_weights.get("gold", 0.005)) + \
                         (self.silver * coin_weights.get("silver", 0.004)) + \
                         (self.copper * coin_weights.get("copper", 0.01))

        def calc_cap(key, bonus, default_base):
            conf = caps.get(key, {})
            base = conf.get("base", default_base)
            for scale in conf.get("scaling", []):
                val = getattr(self, scale.get("source"), 0)
                base += (val + scale.get("offset", 0.0)) * scale.get("multiplier", 1.0)
            return base + bonus

        # Calculate max capacities
        max_quick = calc_cap("quick", quick_bonus, 20.0)
        max_backpack = calc_cap("backpack", best_backpack_value, 10.0)
        max_back = calc_cap("back", back_bonus, 20.0)
        max_quiver = quiver_bonus if has_quiver else 0.0

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
        """Resets Action Points and Turn Buffs at the start of the round."""
        self.current_action_points = self.max_action_points
        for k in self.mana_buffs:
            self.mana_buffs[k] = 0

    def use_action(self, action: ActionCard) -> bool:
        """Attempts to use an action. Returns True if successful."""
        if self.current_action_points >= action.action_cost:
            self.current_action_points -= action.action_cost
            return True
        return False
