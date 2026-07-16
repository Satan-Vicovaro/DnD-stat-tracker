import eel
import logging
import os
import json
import urllib.request
from engine import GameEngine

logger = logging.getLogger(__name__)

# Injected by main.py after the engine is created.
# Never import game_engine directly from engine — that would trigger disk I/O.
game_engine: "GameEngine | None" = None


@eel.expose
def get_character():
    """API endpoint for frontend to fetch character state."""
    logger.info("Frontend requested character state.")
    return game_engine.get_character_view_model()

@eel.expose
def update_name(new_name: str):
    """API endpoint to update character name."""
    game_engine.update_name(new_name)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def update_notes(notes: str):
    """API endpoint to update character notes."""
    game_engine.update_notes(notes)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_stat(stat_name: str, delta: int):
    """API endpoint to modify a base stat."""
    if game_engine.modify_stat(stat_name, delta):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_armor_quantity(armor_name: str, delta: int):
    """API endpoint to modify armor fragments."""
    if game_engine.modify_armor_quantity(armor_name, delta):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_money(currency_type: str, delta: int):
    """API endpoint to modify character money."""
    if game_engine.modify_money(currency_type, delta):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def set_money(currency_type: str, value: int):
    """API endpoint to set character money directly."""
    if game_engine.set_money(currency_type, value):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def add_item_to_inventory(item_data: dict, payment: dict, quantity: int = 1):
    """API endpoint to add a new item or buy from shop."""
    if game_engine.add_item_to_inventory(item_data, payment, quantity):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def edit_inventory_item(index: int, item_data: dict):
    """API endpoint to edit an existing inventory item."""
    if game_engine.edit_inventory_item(index, item_data):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_item_quantity(index: int, delta: int):
    """API endpoint to adjust the quantity of an inventory item."""
    if game_engine.modify_item_quantity(index, delta):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def remove_inventory_item(index: int):
    """API endpoint to remove an item from inventory."""
    if game_engine.remove_inventory_item(index):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def toggle_equip_inventory_item(index: int):
    """API endpoint to toggle equip status of an inventory item."""
    success, msg = game_engine.toggle_equip_inventory_item(index)
    return {"success": success, "message": msg, "character": game_engine.get_character_view_model()}

@eel.expose
def use_inventory_item(index: int, override_value: int = None):
    """API endpoint to use an item from inventory."""
    if game_engine.use_inventory_item(index, override_value):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_level(delta: int):
    """API endpoint to modify the character level."""
    if game_engine.modify_level(delta):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def apply_damage(damage_type: str, amount: int):
    """API endpoint to apply damage to the character."""
    if game_engine.apply_damage(damage_type, amount):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def adjust_health(amount: int):
    """API endpoint to manually add or remove base health."""
    if game_engine.adjust_health(amount):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def adjust_armor_health(amount: int):
    """API endpoint to manually repair or damage armor."""
    if game_engine.adjust_armor_health(amount):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def reset_action_points():
    """API endpoint to reset current AP to maximum."""
    if game_engine.reset_action_points():
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def set_action_points(value: float):
    """API endpoint to manually set current AP."""
    if game_engine.set_action_points(value):
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def get_shop_items():
    """API endpoint for frontend to fetch shop items."""
    logger.info("Frontend requested shop items.")
    return game_engine.get_shop_data()

@eel.expose
def undo():
    """API endpoint to undo the last state mutation."""
    if game_engine.undo():
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def redo():
    """API endpoint to redo the last undone mutation."""
    if game_engine.redo():
        game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def can_undo():
    """API endpoint to check whether undo is available."""
    return game_engine.can_undo()

@eel.expose
def create_named_save():
    """API endpoint to create a manual named save."""
    filename = game_engine.create_named_save()
    return filename

@eel.expose
def list_named_saves():
    """API endpoint to list all manual saves."""
    return game_engine.list_named_saves()

@eel.expose
def load_named_save(filename: str):
    """API endpoint to load a manual save."""
    success = game_engine.load_named_save(filename)
    if success:
        # After loading, we update the quick save so we don't lose progress on restart
        game_engine.save()
        return game_engine.get_character_view_model()
    return None


@eel.expose
def add_status_effect(effect_dict: dict):
    """API endpoint to add a new status effect."""
    game_engine.add_status_effect(effect_dict)
    game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def remove_status_effect(status_id: str):
    """API endpoint to remove a status effect by ID."""
    game_engine.remove_status_effect(status_id)
    game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def toggle_status_effect(status_id: str):
    """API endpoint to toggle a status effect's active state."""
    game_engine.toggle_status_effect(status_id)
    game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def update_status_effect(status_id: str, effect_dict: dict):
    """API endpoint to update an existing status effect."""
    game_engine.update_status_effect(status_id, effect_dict)
    game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def set_mana_config(max_val: int, current_val: int = None):
    """API endpoint to update max and current mana."""
    if game_engine.set_mana_config(max_val, current_val):
        game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def end_day():
    """API endpoint to restore mana and clear buffs."""
    if game_engine.end_day():
        game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def heal_remaining_mana():
    """API endpoint to heal the character using remaining mana."""
    if game_engine.heal_remaining_mana():
        game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def activate_mana_effects(planned_buffs: dict):
    """API endpoint to apply planned buffs and spend mana."""
    if game_engine.activate_mana_effects(planned_buffs):
        game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def cancel_mana_effects():
    """API endpoint to drop active buffs without refunding mana."""
    if game_engine.cancel_mana_effects():
        game_engine.save()
    return game_engine.get_character_view_model()


@eel.expose
def set_sync_config(url: str, enabled: bool):
    """API endpoint to set background sync configuration."""
    os.environ["SYNC_SERVER_URL"] = url
    os.environ["SYNC_ENABLED"] = str(enabled)
    # Give UI a quick response
    return True


@eel.expose
def test_sync_connection(url: str):
    """API endpoint to test connection to GM server."""
    try:
        # A dummy payload just to check if the server is reachable
        data = json.dumps({"name": "test_ping"}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=3) as response:
            return response.status == 200
    except Exception as e:
        logger.error(f"Test sync connection failed: {e}")
        return False
