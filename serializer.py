"""serializer.py — Character ↔ dict conversion.

This module is the single source of truth for translating between live
Character objects and plain JSON-serialisable dicts.  It has NO
dependency on engine.py or api.py (only on models), so there is no
risk of circular imports.
"""

import re
import uuid
from datetime import datetime

from models import (
    Character,
    Item,
    ItemLocation,
    Modifier,
    Weapon,
    ActionCard,
    Armor,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_space_taken(value) -> float:
    """Coerce a space-taken value (int, float, or string like '1,5') to float."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        val = value.replace(",", ".")
        match = re.search(r"[-+]?\d*\.\d+|\d+", val)
        if match:
            return float(match.group())
    return 0.0


# ---------------------------------------------------------------------------
# Item builder  (used both by save-loading AND the live frontend mutations)
# ---------------------------------------------------------------------------


def build_item(item_dict: dict, fallback: Item = None) -> Item:
    """Construct a typed Item / Weapon / Armor from a dict.

    Args:
        item_dict: Incoming data dict (from JS frontend or a save file).
        fallback:  An existing Item whose fields are used as defaults when
                   a key is absent from ``item_dict`` (used during edits).
    """
    item_type = item_dict.get("item_type", fallback.item_type if fallback else "Misc")
    location = ItemLocation(
        item_dict.get("location", fallback.location.value if fallback else "BACKPACK")
    )

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
            mod_type=m.get("mod_type", "ADD"),
        )
        for m in item_dict.get("modifiers", [])
    ]

    fb_name = fallback.name if fallback else "Unknown Item"
    fb_desc = fallback.description if fallback else ""
    fb_space = fallback.space_taken if fallback else 0.0
    fb_effects = fallback.consumable_effects if fallback else {}
    fb_max_uses = fallback.max_uses if fallback else 1
    fb_current_uses = fallback.current_uses if fallback else 1
    # Preserve the item's stable UUID; generate a new one only for brand-new items.
    fb_item_id = fallback.item_id if fallback else str(uuid.uuid4())

    consumable_effects = item_dict.get("consumable_effects", fb_effects)
    max_uses = item_dict.get("max_uses", fb_max_uses)
    current_uses = item_dict.get("current_uses", fb_current_uses)
    item_id = item_dict.get("item_id", fb_item_id)

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
                description=a.get("description", ""),
            )
            for a in item_dict.get("actions", [])
        ]
        return Weapon(
            name=item_dict.get("name", fb_name),
            description=item_dict.get("description", fb_desc),
            space_taken=parse_space_taken(item_dict.get("space_taken", fb_space)),
            location=location,
            modifiers=modifiers,
            consumable_effects=consumable_effects,
            max_uses=max_uses,
            current_uses=current_uses,
            item_id=item_id,
            actions=actions,
        )

    if item_type == "Armor":
        return Armor(
            name=item_dict.get("name", fb_name),
            description=item_dict.get("description", fb_desc),
            space_taken=parse_space_taken(item_dict.get("space_taken", fb_space)),
            location=location,
            modifiers=modifiers,
            consumable_effects=consumable_effects,
            max_uses=max_uses,
            current_uses=current_uses,
            item_id=item_id,
            effect_value=item_dict.get("effect_value", getattr(fallback, "effect_value", "")),
            uses_durability=item_dict.get(
                "uses_durability", getattr(fallback, "uses_durability", "")
            ),
            cost_type=item_dict.get("cost_type", getattr(fallback, "cost_type", "")),
        )

    return Item(
        name=item_dict.get("name", fb_name),
        description=item_dict.get("description", fb_desc),
        space_taken=parse_space_taken(item_dict.get("space_taken", fb_space)),
        location=location,
        modifiers=modifiers,
        item_type=item_type,
        consumable_effects=consumable_effects,
        max_uses=max_uses,
        current_uses=current_uses,
        item_id=item_id,
    )


# ---------------------------------------------------------------------------
# Serialize  (Character → dict)
# ---------------------------------------------------------------------------


def serialize(hero: Character) -> dict:
    """Convert a live Character to a plain JSON-serialisable dict."""
    inventory = []
    for item in hero.inventory:
        entry: dict = {
            "item_type": item.item_type,
            "item_id": item.item_id,
            "name": item.name,
            "description": item.description,
            "space_taken": item.space_taken,
            "location": item.location.value,  # enum → string
            "modifiers": [
                {
                    "source": m.source,
                    "stat_name": m.stat_name,
                    "value": m.value,
                    "mod_type": m.mod_type,
                }
                for m in item.modifiers
            ],
            "consumable_effects": item.consumable_effects,
            "max_uses": item.max_uses,
            "current_uses": item.current_uses,
        }
        if isinstance(item, Weapon):
            entry["actions"] = [
                {
                    "card_value": a.card_value,
                    "action_name": a.action_name,
                    "action_cost": a.action_cost,
                    "range_str": a.range_str,
                    "hit_roll": a.hit_roll,
                    "damage_roll": a.damage_roll,
                    "targets": a.targets,
                    "turn_execution": a.turn_execution,
                    "description": a.description,
                }
                for a in item.actions
            ]
        elif isinstance(item, Armor):
            entry["effect_value"] = item.effect_value
            entry["uses_durability"] = item.uses_durability
            entry["cost_type"] = item.cost_type
        inventory.append(entry)

    return {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        # Identity
        "name": hero.name,
        "level": hero.level,
        # Base stats
        "base_str": hero.stats.base_str,
        "base_dex": hero.stats.base_dex,
        "base_wis": hero.stats.base_wis,
        "base_cha": hero.stats.base_cha,
        # Stat modifiers (from items/buffs, usually 0)
        "mod_str": hero.stats.mod_str,
        "mod_dex": hero.stats.mod_dex,
        "mod_wis": hero.stats.mod_wis,
        "mod_cha": hero.stats.mod_cha,
        # Combat state
        "damage_taken_physical": hero.damage_taken_physical,
        "damage_taken_magical": hero.damage_taken_magical,
        "current_action_points": hero.current_action_points,
        # Economy
        "gold": hero.gold,
        "silver": hero.silver,
        "copper": hero.copper,
        # Armor fragment quantities (armor types defined in armor_config.json)
        "armor_quantities": {
            name: atype.quantity for name, atype in hero.armor_state.types.items()
        },
        # Inventory
        "inventory": inventory,
    }


# ---------------------------------------------------------------------------
# Deserialize  (dict → Character)
# ---------------------------------------------------------------------------


def deserialize(data: dict) -> Character:
    """Reconstruct a Character object from a save dict."""
    hero = Character(name=data["name"], level=data["level"])

    # Base stats
    hero.stats.base_str = data.get("base_str", 0)
    hero.stats.base_dex = data.get("base_dex", 0)
    hero.stats.base_wis = data.get("base_wis", 0)
    hero.stats.base_cha = data.get("base_cha", 0)
    # Stat modifiers
    hero.stats.mod_str = data.get("mod_str", 0)
    hero.stats.mod_dex = data.get("mod_dex", 0)
    hero.stats.mod_wis = data.get("mod_wis", 0)
    hero.stats.mod_cha = data.get("mod_cha", 0)

    # Combat state
    hero.damage_taken_physical = data.get("damage_taken_physical", 0)
    hero.damage_taken_magical = data.get("damage_taken_magical", 0)
    hero.current_action_points = data.get("current_action_points", 0.0)

    # Economy
    hero.gold = data.get("gold", 0)
    hero.silver = data.get("silver", 0)
    hero.copper = data.get("copper", 0)

    # Armor quantities — types come from armor_config, only quantities saved
    for name, qty in data.get("armor_quantities", {}).items():
        if name in hero.armor_state.types:
            hero.armor_state.types[name].quantity = qty

    # Inventory
    for item_dict in data.get("inventory", []):
        hero.inventory.append(build_item(item_dict))

    return hero
