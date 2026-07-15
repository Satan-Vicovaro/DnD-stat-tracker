import copy
import json
import logging
import os
import sys
from pathlib import Path

from models import Character
from serializer import build_item, serialize, deserialize

logger = logging.getLogger(__name__)


def get_data_path(relative_path: str) -> str:
    """Return the path for mutable data (saves), which lives next to the executable."""
    if getattr(sys, "frozen", False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


def get_resource_path(relative_path: str) -> str:
    """Return the path for external static resources (config), which lives next to the executable."""
    return get_data_path(relative_path)


_AUTOSAVE_PATH = get_data_path("data/quick_save.json")
_SAVES_DIR = get_data_path("data/saves")


class GameEngine:
    """Core game engine — state, rules, and persistence orchestration."""

    def __init__(self):
        self._history: list[Character] = []  # undo stack
        self._future: list[Character] = []  # redo stack
        self._max_history: int = 20

        # Load and cache shop data once at startup so every subsequent call
        # to get_shop_data() is a simple dict return with no disk I/O.
        self._shop_data: dict = self._load_shop_data()

        if os.path.exists(_AUTOSAVE_PATH):
            try:
                with open(_AUTOSAVE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.hero = deserialize(data)
                logger.info(f"Loaded autosave: {self.hero.name} level {self.hero.level}")
            except Exception as e:
                logger.error(f"Failed to load autosave ({e}) — starting fresh")
                self.hero = self._create_starting_character()
        else:
            self.hero = self._create_starting_character()
            logger.info("No autosave found — starting fresh")

        # One-time migration: back-fill consumable_effects for items that were
        # saved before this field existed. Safe to call repeatedly — it is a
        # no-op for items that already have the field populated.
        self._patch_item_consumables()

    # ------------------------------------------------------------------
    # Character factory
    # ------------------------------------------------------------------

    def _create_starting_character(self) -> Character:
        hero = Character(name="Kajzer", level=1)
        hero.stats.base_str = 0
        hero.stats.base_dex = 0
        hero.stats.base_wis = 0
        hero.stats.base_cha = 0
        return hero

    def _patch_item_consumables(self):
        """Back-fill consumable_effects from shop data for items that predate the field.

        This used to run on every view-model render (causing disk I/O each time).
        Now it runs once after any hero load, which is all that was ever needed.
        """
        shop_items_map = {}
        for items in self._shop_data.values():
            for si in items:
                if si.get("name"):
                    shop_items_map[si["name"]] = si

        for item in self.hero.inventory:
            if not item.consumable_effects:
                shop_item = shop_items_map.get(item.name)
                if shop_item and shop_item.get("consumable_effects"):
                    item.consumable_effects = shop_item["consumable_effects"]
                    item.max_uses = shop_item.get("max_uses", 1)
                    if item.current_uses <= 1 and item.max_uses > 1:
                        item.current_uses = item.max_uses
                    else:
                        item.current_uses = max(1, item.current_uses)

    # ------------------------------------------------------------------
    # History / Undo / Redo
    # ------------------------------------------------------------------

    def _snapshot(self):
        """Deep-copy current hero onto the undo stack; clear redo branch."""
        self._history.append(copy.deepcopy(self.hero))
        if len(self._history) > self._max_history:
            self._history.pop(0)
        self._future.clear()

    def undo(self) -> bool:
        if not self._history:
            logger.warning("Undo requested but history is empty.")
            return False
        self._future.append(copy.deepcopy(self.hero))
        self.hero = self._history.pop()
        logger.info(f"Undo. History: {len(self._history)}, Future: {len(self._future)}")
        return True

    def redo(self) -> bool:
        if not self._future:
            logger.warning("Redo requested but future is empty.")
            return False
        self._history.append(copy.deepcopy(self.hero))
        self.hero = self._future.pop()
        logger.info(f"Redo. History: {len(self._history)}, Future: {len(self._future)}")
        return True

    def can_undo(self) -> bool:
        return len(self._history) > 0

    def can_redo(self) -> bool:
        return len(self._future) > 0

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self):
        """Auto-save current hero to data/autosave.json."""
        os.makedirs(os.path.dirname(_AUTOSAVE_PATH), exist_ok=True)
        try:
            with open(_AUTOSAVE_PATH, "w", encoding="utf-8") as f:
                json.dump(serialize(self.hero), f, ensure_ascii=False, indent=2)
            logger.debug("Auto-saved.")
        except OSError as e:
            logger.error(f"Auto-save failed: {e}")

    def create_named_save(self) -> str:
        """Write a timestamped manual save to data/saves/. Returns filename."""
        from datetime import datetime

        os.makedirs(_SAVES_DIR, exist_ok=True)
        filename = datetime.now().strftime("%Y-%m-%dT%H-%M-%S") + ".json"
        path = os.path.join(_SAVES_DIR, filename)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(serialize(self.hero), f, ensure_ascii=False, indent=2)
            logger.info(f"Named save created: {filename}")
            return filename
        except OSError as e:
            logger.error(f"Named save failed: {e}")
            return ""

    def list_named_saves(self) -> list:
        """Return metadata for all manual saves, newest first."""
        if not os.path.exists(_SAVES_DIR):
            return []
        result = []
        for filename in sorted(os.listdir(_SAVES_DIR), reverse=True):
            if not filename.endswith(".json"):
                continue
            path = os.path.join(_SAVES_DIR, filename)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                result.append(
                    {
                        "filename": filename,
                        "timestamp": data.get("timestamp", filename),
                        "hero_name": data.get("name", "?"),
                        "level": data.get("level", 0),
                    }
                )
            except Exception as e:
                logger.warning(f"Skipping unreadable save {filename}: {e}")
        return result

    def load_named_save(self, filename: str) -> bool:
        """Load a specific manual save. Clears undo/redo history on success."""
        # Guard against path traversal — reject anything that isn't a plain
        # filename with no directory component. Using pathlib is safer than
        # string-contains checks, which can be bypassed with URL-encoding or
        # Unicode look-alike characters.
        if Path(filename).name != filename:
            logger.warning(f"Rejected suspicious filename: {filename!r}")
            return False
        path = os.path.join(_SAVES_DIR, filename)
        if not os.path.exists(path):
            return False
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.hero = deserialize(data)
            self._history.clear()
            self._future.clear()
            self._patch_item_consumables()
            logger.info(f"Loaded named save: {filename}")
            return True
        except Exception as e:
            logger.error(f"Failed to load named save {filename}: {e}")
            return False

    # ------------------------------------------------------------------
    # View model
    # ------------------------------------------------------------------

    def get_character_view_model(self) -> dict:
        """Returns the character data formatted for the frontend."""
        from dataclasses import asdict

        armor_max_hp = 0
        for name, armor in self.hero.armor_state.types.items():
            if armor.quantity > 0:
                hp = armor.effects.get("hp_per_fragment", 0.0) * armor.quantity
                armor_max_hp += hp

        # hero.max_hp is computed by the stat manager, which has NO armor HP
        # contributor — it is already the pure base (non-armor) max HP.
        # The old code subtracted armor_max_hp from it a second time, giving
        # base_max_hp = 18 - 20 = -2 when armor HP > stat HP.
        base_max_hp = self.hero.max_hp  # already base-only

        current_armor_hp = max(0, armor_max_hp - self.hero.damage_taken_physical)
        current_base_hp = max(0, base_max_hp - self.hero.damage_taken_magical)

        # Compute broken fragments dynamically
        broken_fragments = 0
        damage_left_for_broken = self.hero.damage_taken_physical
        
        order = ["Stalowa", "Płytowa", "Półpłytowa", "Skórzana"]
        all_types = self.hero.armor_state.types
        for name in order + [n for n in all_types.keys() if n not in order]:
            t = all_types.get(name)
            if not t or t.quantity == 0:
                continue
            hp_pf = t.effects.get("hp_per_fragment", 0.0)
            if hp_pf > 0:
                max_hp_type = t.quantity * hp_pf
                if damage_left_for_broken >= max_hp_type:
                    broken_fragments += t.quantity
                    damage_left_for_broken -= max_hp_type
                else:
                    broken_fragments += int(damage_left_for_broken // hp_pf)
                    damage_left_for_broken = 0
                    break

        current_mitigation = self.get_current_mitigation()

        health_split = {
            "armor_max_hp": armor_max_hp,
            "armor_current_hp": current_armor_hp,
            "base_max_hp": base_max_hp,
            "base_current_hp": current_base_hp,
            "total_max_hp": base_max_hp + armor_max_hp,
            "total_current_hp": current_base_hp + current_armor_hp,
            "current_mitigation": current_mitigation,
            "broken_fragments": broken_fragments,
        }

        damage_left = self.hero.damage_taken_physical
        damaged_space = 0
        intact_space = 0

        armor_types_view = []

        order = ["Stalowa", "Płytowa", "Półpłytowa", "Skórzana"]
        all_types = self.hero.armor_state.types

        for name in order + [n for n in all_types.keys() if n not in order]:
            t = all_types.get(name)
            if not t:
                continue

            hp_per_fragment = t.effects.get("hp_per_fragment", 0.0)
            max_hp = t.quantity * hp_per_fragment
            current_hp = 0

            if t.quantity > 0:
                if damage_left >= max_hp:
                    current_hp = 0
                    damage_left -= max_hp
                    damaged_space += t.used_space
                else:
                    current_hp = max_hp - damage_left
                    if hp_per_fragment > 0:
                        broken_frags = int(damage_left // hp_per_fragment)
                        t_damaged_space = broken_frags * t.space_per_fragment
                        damaged_space += t_damaged_space
                        intact_space += t.used_space - t_damaged_space
                    else:
                        intact_space += t.used_space
                    damage_left = 0

            armor_types_view.append(
                {
                    "name": t.name,
                    "quantity": t.quantity,
                    "space_per_fragment": t.space_per_fragment,
                    "used_space": t.used_space,
                    "max_hp": int(max_hp),
                    "current_hp": int(current_hp),
                }
            )

        view_model = {
            "name": self.hero.name,
            "level": self.hero.level,
            "notes": self.hero.notes,
            "unspent_stat_points": self.hero.unspent_stat_points,
            "hp": self.hero.current_hp,
            "health_split": health_split,
            "max_hp": self.hero.stat_manager.get_stat_breakdown("max_hp"),
            "defense": self.hero.stat_manager.get_stat_breakdown("defense"),
            "ap": self.hero.stat_manager.get_stat_breakdown("ap"),
            "current_action_points": self.hero.current_action_points,
            "stamina": self.hero.stat_manager.get_stat_breakdown("stamina"),
            "movement": self.hero.stat_manager.get_stat_breakdown("movement"),
            "stats": {
                "str": self.hero.stat_manager.get_stat_breakdown(
                    "str", base_value=self.hero.stats.str
                ),
                "dex": self.hero.stat_manager.get_stat_breakdown(
                    "dex", base_value=self.hero.stats.dex
                ),
                "wis": self.hero.stat_manager.get_stat_breakdown(
                    "wis", base_value=self.hero.stats.wis
                ),
                "cha": self.hero.stat_manager.get_stat_breakdown(
                    "cha", base_value=self.hero.stats.cha
                ),
            },
            "armor": {
                "max_space": self.hero.armor_state.max_space,
                "total_used_space": self.hero.armor_state.total_used_space,
                "remaining_space": self.hero.armor_state.remaining_space,
                "damaged_space": damaged_space,
                "intact_space": intact_space,
                "types": armor_types_view,
            },
            "economy": {
                "gold": self.hero.gold,
                "silver": self.hero.silver,
                "copper": self.hero.copper,
            },
            "inventory_space": self.hero.inventory_space,
            "inventory": [],
            "magia": {
                "max_mana": getattr(self.hero, "max_mana", 0),
                "max_mana_breakdown": self.hero.stat_manager.get_stat_breakdown("max_mana"),
                "current_mana": getattr(self.hero, "current_mana", 0),
                "mana_buffs": getattr(self.hero, "mana_buffs", {})
            }
        }

        active_containers = view_model["inventory_space"].get("active_containers", {})
        from models import get_game_rules
        clothes_ids = get_game_rules().get("inventory", {}).get("clothes_identifiers", ["ubrani"])

        logger.info("[Step 7] Generating character view model inventory array...")
        for item in self.hero.inventory:
            item_dict = asdict(item)
            if item.name.lower() in ("plecak", "kołczan", "kolczan"):
                logger.info(f"[Step 7.1] asdict result for {item.name}: is_equipped={item_dict.get('is_equipped')}, modifiers={item_dict.get('modifiers')}")
            # active_containers is now keyed by item_id (stable UUID), not id()
            item_dict["is_active_container"] = item.item_id in active_containers
            item_dict["is_clothes"] = any(cid.lower() in item.name.lower() for cid in clothes_ids)
            if item.item_id in active_containers:
                item_dict["granted_space"] = active_containers[item.item_id]
            view_model["inventory"].append(item_dict)

        view_model["can_undo"] = self.can_undo()
        view_model["can_redo"] = self.can_redo()
        view_model["status_effects"] = [
            {
                "status_id": se.status_id,
                "title": se.title,
                "description": se.description,
                "active": se.active,
                "modifiers": [
                    {
                        "source": m.source,
                        "stat_name": m.stat_name,
                        "value": m.value,
                        "mod_type": m.mod_type,
                    }
                    for m in se.modifiers
                ],
            }
            for se in self.hero.status_effects
        ]
        try:
            import json
            with open("debug_inventory.json", "w", encoding="utf-8") as f:
                json.dump(view_model["inventory"], f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        return view_model

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    def set_mana_config(self, max_val: int, current_val: int = None) -> bool:
        self._snapshot()
        # max_val is ignored as max_mana is dynamically calculated
        if current_val is not None:
            self.hero.current_mana = min(current_val, self.hero.max_mana)
        return True

    def end_day(self) -> bool:
        """Restores current mana to max_mana"""
        self._snapshot()
        self.hero.current_mana = self.hero.max_mana
        # Optionally clear buffs on day end? Yes, makes sense.
        for k in self.hero.mana_buffs:
            self.hero.mana_buffs[k] = 0
        return True

    def heal_remaining_mana(self) -> bool:
        """Spends all current_mana and heals based on config"""
        char = self.hero
        if char.current_mana > 0:
            self._snapshot()
            mana_to_spend = char.current_mana
            char.current_mana = 0
            
            from models import get_game_rules
            rules = get_game_rules()
            heal_per_point = rules.get("magia", {}).get("healing_per_mana_day", 1)
            total_heal = heal_per_point * mana_to_spend
            
            # Heal physical then magical
            while total_heal > 0 and (char.damage_taken_physical > 0 or char.damage_taken_magical > 0):
                if char.damage_taken_physical > 0:
                    char.damage_taken_physical -= 1
                elif char.damage_taken_magical > 0:
                    char.damage_taken_magical -= 1
                total_heal -= 1
            return True
        return False

    def activate_mana_effects(self, planned_buffs: dict) -> bool:
        """Spends mana and applies the planned buffs."""
        char = self.hero
        total_cost = sum(val for val in planned_buffs.values() if val > 0)
        
        if total_cost > 0 and char.current_mana >= total_cost:
            self._snapshot()
            char.current_mana -= total_cost
            for stat, val in planned_buffs.items():
                if val > 0:
                    if stat == "Leczenie":
                        from models import get_game_rules
                        rules = get_game_rules()
                        heal_per_point = rules.get("magia", {}).get("healing_per_mana_day", 1)
                        total_heal = heal_per_point * val
                        while total_heal > 0 and (char.damage_taken_physical > 0 or char.damage_taken_magical > 0):
                            if char.damage_taken_physical > 0:
                                char.damage_taken_physical -= 1
                            elif char.damage_taken_magical > 0:
                                char.damage_taken_magical -= 1
                            total_heal -= 1
                    elif stat in char.mana_buffs:
                        char.mana_buffs[stat] += val
            return True
        return False

    def cancel_mana_effects(self) -> bool:
        """Drops active buffs without refunding mana."""
        self._snapshot()
        for k in self.hero.mana_buffs:
            self.hero.mana_buffs[k] = 0
        return True

    def add_item_to_inventory(self, item_dict: dict, payment: dict, quantity: int = 1) -> bool:
        logger.info(f"[Step 2] engine.add_item_to_inventory called with: {item_dict.get('name')}")
        """Validate payment, deduct it, and add the item to inventory."""
        gold_cost = int(payment.get("gold", 0))
        silver_cost = int(payment.get("silver", 0))
        copper_cost = int(payment.get("copper", 0))

        if (
            self.hero.gold < gold_cost
            or self.hero.silver < silver_cost
            or self.hero.copper < copper_cost
        ):
            logger.warning("Insufficient funds for custom payment.")
            return False

        self._snapshot()
        self.hero.gold -= gold_cost
        self.hero.silver -= silver_cost
        self.hero.copper -= copper_cost

        # Try to stack with an existing item of the same name
        for item in self.hero.inventory:
            if item.name == item_dict.get("name"):
                item.quantity += quantity
                logger.info(f"Stacked {quantity} of {item.name} to existing stack.")
                return True

        logger.info(f"[Step 3] Calling build_item...")
        item = build_item(item_dict)
        logger.info(f"[Step 4] Item built: {item.name}, is_equipped={item.is_equipped}, modifiers={item.modifiers}")
        item.quantity = quantity
        self.hero.inventory.append(item)
        logger.info(f"[Step 5] Item appended to inventory")
        logger.info(f"Added item {item.name} (x{quantity}) to inventory at {item.location}.")
        return True

    def edit_inventory_item(self, index: int, item_dict: dict) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False

        old_item = self.hero.inventory[index]
        old_loc = old_item.location
        new_loc = item_dict.get("location")

        # Check if the item is being moved to a different location
        if new_loc:
            old_loc_str = old_loc.value if hasattr(old_loc, "value") else old_loc
            if new_loc != old_loc_str:
                from models import get_game_rules
                costs = get_game_rules().get("inventory", {}).get("action_costs", {})
                ap_cost = costs.get(f"move_from_{old_loc_str}", 0)

                if ap_cost > 0:
                    self.hero.current_action_points -= ap_cost
                    logger.info(
                        f"Moved item from {old_loc_str} to {new_loc}. Deducted {ap_cost} AP."
                    )

                if new_loc == "CLOTHES":
                    from models import ItemLocation
                    for i, inv_item in enumerate(self.hero.inventory):
                        if i != index and (inv_item.location == "CLOTHES" or getattr(inv_item.location, "value", inv_item.location) == "CLOTHES"):
                            inv_item.location = ItemLocation.BACKPACK
                            logger.info(f"Auto-unequipped {inv_item.name} to backpack.")
                
                # Automatically unequip when moving to a new location
                item_dict["is_equipped"] = False

        self._snapshot()
        old_item = self.hero.inventory.pop(index)
        item = build_item(item_dict, fallback=old_item)
        self.hero.inventory.insert(index, item)
        logger.info(f"Edited item at index {index}.")
        return True

    def toggle_equip_inventory_item(self, index: int) -> tuple[bool, str]:
        if index < 0 or index >= len(self.hero.inventory):
            return False, "Nieprawidłowy indeks przedmiotu."

        item = self.hero.inventory[index]
        
        provides_space = any(mod.stat_name in ("backpack_space", "quick_space", "quiver_space", "back_space") for mod in item.modifiers)
        if not provides_space:
            return False, "Tego przedmiotu nie można założyć w ten sposób."

        if item.is_equipped:
            item.is_equipped = False
            self.save()
            return True, "Zdjęto przedmiot."

        has_backpack = any(mod.stat_name == "backpack_space" for mod in item.modifiers)
        for other in self.hero.inventory:
            if other.is_equipped and other != item:
                other_has_backpack = any(mod.stat_name == "backpack_space" for mod in other.modifiers)
                
                # Only backpacks are mutually exclusive. Other spaces (like quick_space) stack!
                if has_backpack and other_has_backpack:
                    other.is_equipped = False

        item.is_equipped = True
        self.save()
        return True, "Założono przedmiot."

    def remove_inventory_item(self, index: int) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False
        self._snapshot()
        item = self.hero.inventory.pop(index)
        logger.info(f"Removed item {item.name} from inventory.")
        return True

    def use_inventory_item(self, index: int, override_value: int = None) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False

        item = self.hero.inventory[index]
        if not item.consumable_effects:
            logger.warning(f"Item {item.name} has no consumable effects.")
            return False

        from models import get_game_rules
        costs = get_game_rules().get("inventory", {}).get("action_costs", {})
        loc_str = item.location.value if hasattr(item.location, "value") else item.location
        ap_cost = costs.get(f"use_from_{loc_str}", 0)

        if self.hero.current_action_points < ap_cost:
            logger.warning(
                f"Not enough AP to use item {item.name}. Need {ap_cost}, have {self.hero.current_action_points}"
            )
            return False

        # Take exactly ONE snapshot for this entire action.
        # Calling adjust_health / adjust_armor_health would each take an
        # additional snapshot, creating multiple undo steps for a single use.
        self._snapshot()

        self.hero.current_action_points -= ap_cost

        effects = item.consumable_effects

        heal_val = effects.get("heal_health")
        if heal_val:
            heal = min(heal_val, self.hero.damage_taken_magical)
            self.hero.damage_taken_magical -= heal
            logger.info(f"Healed base health by {heal}")

        if effects.get("dynamic_heal") and override_value is not None:
            heal = min(override_value, self.hero.damage_taken_magical)
            self.hero.damage_taken_magical -= heal
            logger.info(f"Healed base health by {heal} (dynamic)")

        repair_val = effects.get("repair_armor")
        if repair_val:
            repair = min(repair_val, self.hero.damage_taken_physical)
            self.hero.damage_taken_physical -= repair
            logger.info(f"Repaired armor by {repair}")

        item.current_uses -= 1
        if item.current_uses <= 0:
            if getattr(item, "quantity", 1) > 1:
                item.quantity -= 1
                item.current_uses = item.max_uses
                logger.info(
                    f"Item {item.name} stack decremented to {item.quantity}. Uses reset to {item.max_uses}."
                )
            else:
                self.hero.inventory.pop(index)
                logger.info(f"Item {item.name} consumed and removed.")
        else:
            logger.info(f"Item {item.name} used. {item.current_uses}/{item.max_uses} uses left.")

        return True

    def modify_item_quantity(self, index: int, delta: int) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False

        item = self.hero.inventory[index]
        self._snapshot()
        if item.quantity + delta <= 0:
            self.hero.inventory.pop(index)
            logger.info(f"Item {item.name} removed (quantity reached 0).")
        else:
            item.quantity += delta
            logger.info(f"Item {item.name} quantity changed by {delta} to {item.quantity}.")
        return True

    def modify_armor_quantity(self, armor_name: str, delta: int) -> bool:
        if armor_name not in self.hero.armor_state.types:
            return False
        armor_type = self.hero.armor_state.types[armor_name]
        if delta < 0 and armor_type.quantity + delta < 0:
            return False
        if delta > 0:
            space_required = delta * armor_type.space_per_fragment
            if self.hero.armor_state.remaining_space - space_required < 0:
                logger.warning(f"Cannot equip {delta} {armor_name}: Not enough space.")
                return False
        self._snapshot()
        armor_type.quantity += delta

        # Clamp physical damage so unequipping broken armor doesn't leave lingering ghost damage
        armor_max_hp = sum(
            t.quantity * t.effects.get("hp_per_fragment", 0.0)
            for t in self.hero.armor_state.types.values()
        )
        if self.hero.damage_taken_physical > armor_max_hp:
            self.hero.damage_taken_physical = int(armor_max_hp)

        logger.info(
            f"Armor {armor_name} qty changed by {delta}. " f"New total: {armor_type.quantity}"
        )
        return True

    def modify_money(self, currency_type: str, delta: int) -> bool:
        if not hasattr(self.hero, currency_type):
            return False
        current = getattr(self.hero, currency_type)
        if current + delta < 0:
            return False
        self._snapshot()
        setattr(self.hero, currency_type, current + delta)
        logger.info(f"Money {currency_type} changed by {delta}. " f"New total: {current + delta}")
        return True

    def set_money(self, currency_type: str, value: int) -> bool:
        if not hasattr(self.hero, currency_type):
            return False
        value = max(0, value)
        self._snapshot()
        setattr(self.hero, currency_type, value)
        logger.info(f"Money {currency_type} set to {value}.")
        return True

    def update_name(self, new_name: str):
        self._snapshot()
        self.hero.name = new_name
        logger.info(f"Hero name updated to: {new_name}")

    def update_notes(self, new_notes: str):
        self._snapshot()
        self.hero.notes = new_notes
        logger.info("Hero notes updated.")

    def modify_level(self, delta: int) -> bool:
        if self.hero.level + delta < 1:
            return False
        self._snapshot()
        self.hero.level += delta
        logger.info(f"Hero level changed to {self.hero.level}")
        return True

    def modify_stat(self, stat_name: str, delta: int):
        stat_attr = f"base_{stat_name}"
        if not hasattr(self.hero.stats, stat_attr):
            return False
        current = getattr(self.hero.stats, stat_attr)
        if delta < 0 and current + delta < 0:
            return False
        if delta > 0 and self.hero.unspent_stat_points < delta:
            logger.warning("Not enough unspent stat points.")
            return False
        self._snapshot()
        setattr(self.hero.stats, stat_attr, current + delta)
        logger.info(f"Hero stat {stat_name} modified by {delta}")
        return True

    # ------------------------------------------------------------------
    # Status Effects
    # ------------------------------------------------------------------

    def add_status_effect(self, effect_dict: dict) -> bool:
        """Add a new status effect to the character."""
        from models import StatusEffect, Modifier
        import uuid as _uuid

        mods = [
            Modifier(
                source=m.get("source", effect_dict.get("title", "Status")),
                stat_name=m.get("stat_name", ""),
                value=float(m.get("value", 0.0)),
                mod_type=m.get("mod_type", "ADD"),
            )
            for m in effect_dict.get("modifiers", [])
        ]
        se = StatusEffect(
            title=effect_dict.get("title", "Status"),
            description=effect_dict.get("description", ""),
            active=effect_dict.get("active", True),
            modifiers=mods,
            status_id=effect_dict.get("status_id") or str(_uuid.uuid4()),
        )
        self._snapshot()
        self.hero.status_effects.append(se)
        logger.info(f"Added status effect: {se.title}")
        return True

    def remove_status_effect(self, status_id: str) -> bool:
        """Remove a status effect by its ID."""
        for i, se in enumerate(self.hero.status_effects):
            if se.status_id == status_id:
                self._snapshot()
                self.hero.status_effects.pop(i)
                logger.info(f"Removed status effect: {se.title}")
                return True
        logger.warning(f"Status effect {status_id!r} not found.")
        return False

    def toggle_status_effect(self, status_id: str) -> bool:
        """Toggle the active state of a status effect."""
        for se in self.hero.status_effects:
            if se.status_id == status_id:
                self._snapshot()
                se.active = not se.active
                logger.info(f"Toggled status effect {se.title!r} → active={se.active}")
                return True
        logger.warning(f"Status effect {status_id!r} not found.")
        return False

    def update_status_effect(self, status_id: str, effect_dict: dict) -> bool:
        """Replace a status effect's data in-place."""
        from models import Modifier

        for se in self.hero.status_effects:
            if se.status_id == status_id:
                self._snapshot()
                se.title = effect_dict.get("title", se.title)
                se.description = effect_dict.get("description", se.description)
                se.active = effect_dict.get("active", se.active)
                se.modifiers = [
                    Modifier(
                        source=m.get("source", se.title),
                        stat_name=m.get("stat_name", ""),
                        value=float(m.get("value", 0.0)),
                        mod_type=m.get("mod_type", "ADD"),
                    )
                    for m in effect_dict.get("modifiers", [])
                ]
                logger.info(f"Updated status effect: {se.title}")
                return True
        logger.warning(f"Status effect {status_id!r} not found.")
        return False

    def get_current_mitigation(self) -> int:
        """Compute total damage mitigation from intact armor fragments.

        Uses each armor type's ``hp_per_fragment`` from the config to determine
        which fragments are broken, rather than the former hardcoded constant of
        5 HP per fragment that silently gave wrong results when the config was
        changed.
        """
        from models import get_game_rules
        rules = get_game_rules().get("combat", {})
        broken_mult = rules.get("broken_fragment_mitigation_multiplier", 0.5)

        order = ["Stalowa", "Płytowa", "Półpłytowa", "Skórzana"]
        all_types = self.hero.armor_state.types

        damage_left = self.hero.damage_taken_physical
        mitigation = 0

        for name in order + [n for n in all_types.keys() if n not in order]:
            t = all_types.get(name)
            if not t or t.quantity == 0:
                continue

            hp_per_frag = t.effects.get("hp_per_fragment", 0.0)
            mit_per_frag = t.effects.get("mitigation_per_fragment", 0)
            max_hp = t.quantity * hp_per_frag

            if damage_left >= max_hp:
                broken = t.quantity
                damage_left -= max_hp
            else:
                if hp_per_frag > 0:
                    broken = int(damage_left // hp_per_frag)
                else:
                    broken = 0
                damage_left = 0

            intact = t.quantity - broken
            mitigation += intact * mit_per_frag
            mitigation += int(broken * (mit_per_frag * broken_mult))

        # Add magic damage reduction
        magic_dr = self.hero.mana_buffs.get("Redukcja obrażeń", 0)
        mitigation += magic_dr

        return mitigation

    def reset_action_points(self) -> bool:
        """Reset current AP to maximum (start-of-turn reset)."""
        self._snapshot()
        self.hero.current_action_points = self.hero.max_action_points
        logger.info(f"AP reset to {self.hero.current_action_points}")
        return True

    def set_action_points(self, value: float) -> bool:
        """Manually set current AP, clamped between 0 and max."""
        clamped = max(0.0, min(float(value), self.hero.max_action_points))
        self._snapshot()
        self.hero.current_action_points = clamped
        logger.info(f"AP set to {clamped}")
        return True

    def apply_damage(self, damage_type: str, amount: int) -> bool:
        """Applies damage considering armor mitigation for physical damage."""
        if amount < 0:
            return False

        self._snapshot()

        if damage_type == "physical":
            mitigation = self.get_current_mitigation()
            effective_damage = max(0, amount - mitigation)

            armor_max_hp = sum(
                t.quantity * t.effects.get("hp_per_fragment", 0.0)
                for t in self.hero.armor_state.types.values()
            )
            current_armor_hp = max(0, armor_max_hp - self.hero.damage_taken_physical)

            damage_to_armor = min(effective_damage, current_armor_hp)

            self.hero.damage_taken_physical += damage_to_armor
            damage_to_health = effective_damage - damage_to_armor

            if damage_to_health > 0:
                self.hero.damage_taken_magical += damage_to_health

            logger.info(
                f"Physical damage: {amount}, Mitigation: {mitigation}, Armor hit: {damage_to_armor}, Health hit: {damage_to_health}"
            )
        elif damage_type == "magical":
            self.hero.damage_taken_magical += amount
            logger.info(f"Magical damage: {amount}")
        else:
            return False

        return True

    def adjust_health(self, amount: int) -> bool:
        """Manually adjust base health. Positive amount = heal, Negative = damage."""
        if amount == 0:
            return False
        self._snapshot()
        if amount > 0:
            heal = min(amount, self.hero.damage_taken_magical)
            self.hero.damage_taken_magical -= heal
            logger.info(f"Healed base health by {heal}")
        else:
            self.hero.damage_taken_magical += abs(amount)
            logger.info(f"Damaged base health by {abs(amount)}")
        return True

    def adjust_armor_health(self, amount: int) -> bool:
        """Manually adjust armor health. Positive amount = repair, Negative = damage."""
        if amount == 0:
            return False
        self._snapshot()
        if amount > 0:
            repair = min(amount, self.hero.damage_taken_physical)
            self.hero.damage_taken_physical -= repair
            logger.info(f"Repaired armor by {repair}")
        else:
            armor_max_hp = sum(
                t.quantity * t.effects.get("hp_per_fragment", 0.0)
                for t in self.hero.armor_state.types.values()
            )
            current_armor_hp = max(0, armor_max_hp - self.hero.damage_taken_physical)
            damage = min(abs(amount), current_armor_hp)
            self.hero.damage_taken_physical += damage
            logger.info(f"Damaged armor by {damage}")
        return True

    def get_shop_data(self) -> dict:
        """Return cached shop data — loaded once at startup, no disk I/O."""
        return self._shop_data

    def _load_shop_data(self) -> dict:
        """Read all shop JSON files from disk and normalise item names.

        Called once in ``__init__``. All subsequent access should go through
        ``get_shop_data()`` which returns the cached result.
        """
        shop_dir = get_resource_path("config/shop")
        categories = {
            "Broń biała": "bron_biala_structured.json",
            "Broń zasięgowa": "bron_zasiegowa_structured.json",
            "Tarcze": "tarcze_structured.json",
            "Zbroje": "zbroje_structured.json",
            "Różne": "rozne_structured.json",
        }
        shop_data = {}
        for category, filename in categories.items():
            path = os.path.join(shop_dir, filename)
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        items = json.load(f)
                    # Normalise every item to have a 'name' field so that
                    # frontend code doesn't need a fragile multi-field OR-chain.
                    for item in items:
                        if "name" not in item:
                            item["name"] = (
                                item.get("weapon_name")
                                or item.get("item_name")
                                or item.get("tarcza")
                                or item.get("zbroja")
                                or "Nieznany Przedmiot"
                            )
                    shop_data[category] = items
                except Exception as e:
                    logger.error(f"Error loading {filename}: {e}")
                    shop_data[category] = []
            else:
                shop_data[category] = []

        # Separate ammunition into its own category
        if "Broń zasięgowa" in shop_data:
            bron = shop_data["Broń zasięgowa"]
            amunicja = [item for item in bron if not item.get("actions")]
            bronie_wlasciwe = [item for item in bron if item.get("actions")]
            shop_data["Broń zasięgowa"] = bronie_wlasciwe
            if amunicja:
                shop_data["Amunicja"] = amunicja

        return shop_data


# GameEngine is instantiated in main.py and injected into api.py.
# Do NOT create a module-level instance here — importing this module must
# have no side-effects (disk I/O, etc.) so it can be imported safely in tests.
