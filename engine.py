import logging
import os, json
from models import Character


logger = logging.getLogger(__name__)


class GameEngine:
    """Core game engine managing state, rules, and logic."""

    def __init__(self):
        self.hero = self._create_starting_character()
        logger.info(f"GameEngine initialized with hero: {self.hero.name}")

    def _create_starting_character(self) -> Character:
        hero = Character(name="Kajzer", level=1)
        hero.stats.base_str = 0
        hero.stats.base_dex = 0
        hero.stats.base_wis = 0
        hero.stats.base_cha = 0
        return hero

    def get_character_view_model(self) -> dict:
        """Returns the character data formatted for the frontend."""
        from dataclasses import asdict
        return {
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
            "inventory_space": {
                "max": self.hero.max_inventory_space,
                "used": self.hero.current_inventory_space,
            },
            "inventory": [asdict(item) for item in self.hero.inventory]
        }

    def add_item_to_inventory(self, item_dict: dict, payment: dict) -> bool:
        """Processes a payment and adds an item to the inventory."""
        from models import Item, ItemLocation, Modifier, Weapon, ActionCard
        
        # Validate payment
        gold_cost = int(payment.get("gold", 0))
        silver_cost = int(payment.get("silver", 0))
        copper_cost = int(payment.get("copper", 0))
        
        if self.hero.gold < gold_cost or self.hero.silver < silver_cost or self.hero.copper < copper_cost:
            logger.warning("Insufficient funds for custom payment.")
            return False
            
        # Deduct payment
        self.hero.gold -= gold_cost
        self.hero.silver -= silver_cost
        self.hero.copper -= copper_cost
        
        # Build Item object
        item_type = item_dict.get("item_type", "Misc")
        location = ItemLocation(item_dict.get("location", "BACKPACK"))
        
        # Build modifiers
        modifiers = []
        for m in item_dict.get("modifiers", []):
            modifiers.append(Modifier(
                source=m.get("source", item_dict.get("name")),
                stat_name=m.get("stat_name"),
                value=m.get("value"),
                mod_type=m.get("mod_type", "ADD")
            ))
            
        if item_type == "Weapon":
            actions = []
            for a in item_dict.get("actions", []):
                actions.append(ActionCard(
                    card_value=a.get("card_value", 0),
                    action_name=a.get("action_name", ""),
                    action_cost=a.get("action_cost", 0),
                    range_str=a.get("range_str", ""),
                    hit_roll=a.get("hit_roll", ""),
                    damage_roll=a.get("damage_roll", ""),
                    targets=a.get("targets", ""),
                    turn_execution=a.get("turn_execution", ""),
                    description=a.get("description", "")
                ))
            item = Weapon(
                name=item_dict.get("name", "Unknown Weapon"),
                description=item_dict.get("description", ""),
                space_taken=float(item_dict.get("space_taken", 0.0)),
                location=location,
                modifiers=modifiers,
                actions=actions
            )
        else:
            item = Item(
                name=item_dict.get("name", "Unknown Item"),
                description=item_dict.get("description", ""),
                space_taken=float(item_dict.get("space_taken", 0.0)),
                location=location,
                modifiers=modifiers,
                item_type=item_type
            )
            
        self.hero.inventory.append(item)
        logger.info(f"Added item {item.name} to inventory at {location}.")
        return True

    def edit_inventory_item(self, index: int, item_dict: dict) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False
            
        # We can just remove the old item and add a new one in place (without payment)
        old_item = self.hero.inventory.pop(index)
        
        from models import Item, ItemLocation, Modifier, Weapon, ActionCard
        item_type = item_dict.get("item_type", old_item.item_type)
        location = ItemLocation(item_dict.get("location", old_item.location.value))
        
        modifiers = []
        for m in item_dict.get("modifiers", []):
            modifiers.append(Modifier(
                source=m.get("source", item_dict.get("name")),
                stat_name=m.get("stat_name"),
                value=m.get("value"),
                mod_type=m.get("mod_type", "ADD")
            ))
            
        if item_type == "Weapon":
            actions = []
            for a in item_dict.get("actions", []):
                actions.append(ActionCard(
                    card_value=a.get("card_value", 0),
                    action_name=a.get("action_name", ""),
                    action_cost=a.get("action_cost", 0),
                    range_str=a.get("range_str", ""),
                    hit_roll=a.get("hit_roll", ""),
                    damage_roll=a.get("damage_roll", ""),
                    targets=a.get("targets", ""),
                    turn_execution=a.get("turn_execution", ""),
                    description=a.get("description", "")
                ))
            item = Weapon(
                name=item_dict.get("name", old_item.name),
                description=item_dict.get("description", old_item.description),
                space_taken=float(item_dict.get("space_taken", old_item.space_taken)),
                location=location,
                modifiers=modifiers,
                actions=actions
            )
        else:
            item = Item(
                name=item_dict.get("name", old_item.name),
                description=item_dict.get("description", old_item.description),
                space_taken=float(item_dict.get("space_taken", old_item.space_taken)),
                location=location,
                modifiers=modifiers,
                item_type=item_type
            )
            
        self.hero.inventory.insert(index, item)
        logger.info(f"Edited item at index {index}.")
        return True

    def remove_inventory_item(self, index: int) -> bool:
        if index < 0 or index >= len(self.hero.inventory):
            return False
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
            
        setattr(self.hero, currency_type, current + delta)
        logger.info(f"Money {currency_type} changed by {delta}. New total: {current + delta}")
        return True

    def set_money(self, currency_type: str, value: int) -> bool:
        """Sets character money directly. Returns True if successful."""
        if not hasattr(self.hero, currency_type):
            return False
            
        if value < 0:
            value = 0
            
        setattr(self.hero, currency_type, value)
        logger.info(f"Money {currency_type} set to {value}.")
        return True

    def update_name(self, new_name: str):
        self.hero.name = new_name
        logger.info(f"Hero name updated to: {new_name}")

    def modify_level(self, delta: int) -> bool:
        """Modifies character level by delta, minimum 1."""
        if self.hero.level + delta < 1:
            return False
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
