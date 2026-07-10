import copy
import logging
import os, json
import re
from models import Character
from models import Item, ItemLocation, Modifier, Weapon, ActionCard, Armor

logger = logging.getLogger(__name__)

def parse_space_taken(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        val = value.replace(',', '.')
        match = re.search(r"[-+]?\d*\.\d+|\d+", val)
        if match:
            return float(match.group())
    return 0.0


class GameEngine:
    """Core game engine managing state, rules, and logic."""

    def __init__(self):
        self._history: list[Character] = []   # undo stack (past states)
        self._future: list[Character] = []    # redo stack (states after undo)
        self._max_history: int = 20
        self.hero = self._create_starting_character()
        logger.info(f"GameEngine initialized with hero: {self.hero.name}")

    def _create_starting_character(self) -> Character:
        hero = Character(name="Kajzer", level=1)
        hero.stats.base_str = 0
        hero.stats.base_dex = 0
        hero.stats.base_wis = 0
        hero.stats.base_cha = 0
        return hero

    # ------------------------------------------------------------------
    # History / Undo
    # ------------------------------------------------------------------

    def _snapshot(self):
        """Push a deep-copy of the current hero state onto the undo stack.
        Any pending redo history is discarded — new action creates a new branch."""
        self._history.append(copy.deepcopy(self.hero))
        if len(self._history) > self._max_history:
            self._history.pop(0)
        # New action kills the redo branch
        self._future.clear()

    def undo(self) -> bool:
        """Restore the last snapshot. Pushes current state to redo stack."""
        if not self._history:
            logger.warning("Undo requested but history is empty.")
            return False
        self._future.append(copy.deepcopy(self.hero))
        self.hero = self._history.pop()
        logger.info(f"Undo performed. History: {len(self._history)}, Future: {len(self._future)}")
        return True

    def redo(self) -> bool:
        """Reapply the last undone state. Pushes current state to undo stack."""
        if not self._future:
            logger.warning("Redo requested but future is empty.")
            return False
        self._history.append(copy.deepcopy(self.hero))
        self.hero = self._future.pop()
        logger.info(f"Redo performed. History: {len(self._history)}, Future: {len(self._future)}")
        return True

    def can_undo(self) -> bool:
        return len(self._history) > 0

    def can_redo(self) -> bool:
        return len(self._future) > 0

    def _build_item(self, item_dict: dict, fallback: Item = None) -> Item:
        """Constructs a typed Item/Weapon/Armor from a dict.

        Args:
            item_dict: The incoming data dict (from JS frontend).
            fallback:  An existing Item instance used as default values when
                       a field is missing from item_dict (used during edits).
        """
        item_type = item_dict.get("item_type", fallback.item_type if fallback else "Misc")
        location = ItemLocation(item_dict.get(
            "location",
            fallback.location.value if fallback else "BACKPACK"
        ))

        # Auto-place specific named containers into their natural slot
        name_lower = item_dict.get("name", "").lower()
        if name_lower in ("kołczan", "kolczan"):
            location = ItemLocation.QUIVER
        elif name_lower in ("plecak", "plecak podróżnika", "plecak podroznika"):
            location = ItemLocation.BACKPACK
        elif name_lower in ("ubranie z kieszeniami", "ubrania z kieszeniami", "pasek z mocowaniem"):
            location = ItemLocation.EQUIPPED

        modifiers = [
            Modifier(
                source=m.get("source", item_dict.get("name")),
                stat_name=m.get("stat_name"),
                value=m.get("value"),
                mod_type=m.get("mod_type", "ADD")
            )
            for m in item_dict.get("modifiers", [])
        ]

        fb_name = fallback.name if fallback else "Unknown Item"
        fb_desc = fallback.description if fallback else ""
        fb_space = fallback.space_taken if fallback else 0.0

        if item_type == "Weapon":
            actions = [
                ActionCard(
                    card_value=a.get("card_value", 0),
                    action_name=a.get("action_name", ""),
                    action_cost=a.get("action_cost", 0),
                    range_str=a.get("range_str", ""),
                    hit_roll=a.get("hit_roll", ""),
                    damage_roll=a.get("damage_roll", ""),
                    targets=a.get("targets", ""),
                    turn_execution=a.get("turn_execution", ""),
                    description=a.get("description", "")
                )
                for a in item_dict.get("actions", [])
            ]
            return Weapon(
                name=item_dict.get("name", fb_name),
                description=item_dict.get("description", fb_desc),
                space_taken=parse_space_taken(item_dict.get("space_taken", fb_space)),
                location=location,
                modifiers=modifiers,
                actions=actions
            )

        if item_type == "Armor":
            return Armor(
                name=item_dict.get("name", fb_name),
                description=item_dict.get("description", fb_desc),
                space_taken=parse_space_taken(item_dict.get("space_taken", fb_space)),
                location=location,
                modifiers=modifiers,
                effect_value=item_dict.get("effect_value", getattr(fallback, "effect_value", "")),
                uses_durability=item_dict.get("uses_durability", getattr(fallback, "uses_durability", "")),
                cost_type=item_dict.get("cost_type", getattr(fallback, "cost_type", ""))
            )

        return Item(
            name=item_dict.get("name", fb_name),
            description=item_dict.get("description", fb_desc),
            space_taken=parse_space_taken(item_dict.get("space_taken", fb_space)),
            location=location,
            modifiers=modifiers,
            item_type=item_type
        )

    def get_character_view_model(self) -> dict:
        """Returns the character data formatted for the frontend."""
        from dataclasses import asdict
        view_model = {
            "name": self.hero.name,
            "level": self.hero.level,
            "unspent_stat_points": self.hero.unspent_stat_points,
            "hp": self.hero.current_hp,
            "max_hp": self.hero.stat_manager.get_stat_breakdown("max_hp"),
            "defense": self.hero.stat_manager.get_stat_breakdown("defense"),
            "ap": self.hero.stat_manager.get_stat_breakdown("ap"),
            "stamina": self.hero.stat_manager.get_stat_breakdown("stamina"),
            "movement": self.hero.stat_manager.get_stat_breakdown("movement"),
            "stats": {
                "str": self.hero.stats.str,
                "dex": self.hero.stats.dex,
                "wis": self.hero.stats.wis,
                "cha": self.hero.stats.cha,
            },
            "armor": {
                "max_space": self.hero.armor_state.max_space,
                "total_used_space": self.hero.armor_state.total_used_space,
                "remaining_space": self.hero.armor_state.remaining_space,
                "types": [
                    {
                        "name": t.name,
                        "quantity": t.quantity,
                        "space_per_fragment": t.space_per_fragment,
                        "used_space": t.used_space,
                    }
                    for t in self.hero.armor_state.types.values()
                ],
            },
            "economy": {
                "gold": self.hero.gold,
                "silver": self.hero.silver,
                "copper": self.hero.copper,
            },
            "inventory_space": self.hero.inventory_space,
            "inventory": []
        }
        
        active_containers = view_model["inventory_space"].get("active_containers", {})
        for item in self.hero.inventory:
            item_dict = asdict(item)
            item_id = id(item)
            if item_id in active_containers:
                item_dict["is_active_container"] = True
                item_dict["granted_space"] = active_containers[item_id]
            else:
                item_dict["is_active_container"] = False
                
            view_model["inventory"].append(item_dict)
            
        view_model["can_undo"] = self.can_undo()
        view_model["can_redo"] = self.can_redo()
        return view_model

    def add_item_to_inventory(self, item_dict: dict, payment: dict) -> bool:
        """Processes a payment and adds an item to the inventory."""

        # Validate payment
        gold_cost = int(payment.get("gold", 0))
        silver_cost = int(payment.get("silver", 0))
        copper_cost = int(payment.get("copper", 0))

        if self.hero.gold < gold_cost or self.hero.silver < silver_cost or self.hero.copper < copper_cost:
            logger.warning("Insufficient funds for custom payment.")
            return False

        self._snapshot()

        # Deduct payment
        self.hero.gold -= gold_cost
        self.hero.silver -= silver_cost
        self.hero.copper -= copper_cost

        item = self._build_item(item_dict)
        self.hero.inventory.append(item)
        logger.info(f"Added item {item.name} to inventory at {item.location}.")
        return True

    def edit_inventory_item(self, index: int, item_dict: dict) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False

        self._snapshot()
        # Remove the old item and rebuild it from the incoming dict, using the
        # old item as a fallback for any fields the frontend didn't send.
        old_item = self.hero.inventory.pop(index)
        item = self._build_item(item_dict, fallback=old_item)
        self.hero.inventory.insert(index, item)
        logger.info(f"Edited item at index {index}.")
        return True

    def remove_inventory_item(self, index: int) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False
        self._snapshot()
        item = self.hero.inventory.pop(index)
        logger.info(f"Removed item {item.name} from inventory.")
        return True

    def modify_armor_quantity(self, armor_name: str, delta: int) -> bool:
        """Modifies armor quantity, checking space bounds. Returns True if successful."""
        if armor_name not in self.hero.armor_state.types:
            return False

        armor_type = self.hero.armor_state.types[armor_name]

        # Don't go below 0
        if delta < 0 and armor_type.quantity + delta < 0:
            return False

        # Check max space constraint for additions
        if delta > 0:
            space_required = delta * armor_type.space_per_fragment
            if self.hero.armor_state.remaining_space - space_required < 0:
                logger.warning(f"Cannot equip {delta} {armor_name}: Not enough space.")
                return False

        self._snapshot()
        armor_type.quantity += delta
        logger.info(
            f"Armor {armor_name} quantity changed by {delta}. New total: {armor_type.quantity}"
        )
        return True

    def modify_money(self, currency_type: str, delta: int) -> bool:
        """Modifies character money (gold, silver, copper). Returns True if successful."""
        if not hasattr(self.hero, currency_type):
            return False

        current = getattr(self.hero, currency_type)
        if current + delta < 0:
            return False

        self._snapshot()
        setattr(self.hero, currency_type, current + delta)
        logger.info(f"Money {currency_type} changed by {delta}. New total: {current + delta}")
        return True

    def set_money(self, currency_type: str, value: int) -> bool:
        """Sets character money directly. Returns True if successful."""
        if not hasattr(self.hero, currency_type):
            return False

        if value < 0:
            value = 0

        self._snapshot()
        setattr(self.hero, currency_type, value)
        logger.info(f"Money {currency_type} set to {value}.")
        return True

    def update_name(self, new_name: str):
        self._snapshot()
        self.hero.name = new_name
        logger.info(f"Hero name updated to: {new_name}")

    def modify_level(self, delta: int) -> bool:
        """Modifies character level by delta, minimum 1."""
        if self.hero.level + delta < 1:
            return False
        self._snapshot()
        self.hero.level += delta
        logger.info(f"Hero level changed to {self.hero.level}")
        return True

    def modify_stat(self, stat_name: str, delta: int):
        stat_attr = f"base_{stat_name}"
        if hasattr(self.hero.stats, stat_attr):
            current = getattr(self.hero.stats, stat_attr)

            # Prevent lowering below 0
            if delta < 0 and current + delta < 0:
                return False

            # Check if we have unspent points for additions
            if delta > 0 and self.hero.unspent_stat_points < delta:
                logger.warning("Not enough unspent stat points.")
                return False

            self._snapshot()
            setattr(self.hero.stats, stat_attr, current + delta)
            logger.info(f"Hero stat {stat_name} modified by {delta}")
            return True
        return False

    def get_shop_data(self) -> dict:

        shop_dir = "config/shop"
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
                        shop_data[category] = json.load(f)
                except Exception as e:
                    logger.error(f"Error loading {filename}: {e}")
                    shop_data[category] = []
            else:
                shop_data[category] = []
        return shop_data


# Singleton instance exported for use by APIs
game_engine = GameEngine()
