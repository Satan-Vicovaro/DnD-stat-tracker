import eel
import logging
from engine import game_engine

logger = logging.getLogger(__name__)

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
def modify_stat(stat_name: str, delta: int):
    """API endpoint to modify a base stat."""
    game_engine.modify_stat(stat_name, delta)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_armor_quantity(armor_name: str, delta: int):
    """API endpoint to modify armor fragments."""
    game_engine.modify_armor_quantity(armor_name, delta)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_money(currency_type: str, delta: int):
    """API endpoint to modify character money."""
    game_engine.modify_money(currency_type, delta)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def set_money(currency_type: str, value: int):
    """API endpoint to set character money directly."""
    game_engine.set_money(currency_type, value)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def add_item_to_inventory(item_data: dict, payment: dict):
    """API endpoint to add a new item or buy from shop."""
    game_engine.add_item_to_inventory(item_data, payment)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def edit_inventory_item(index: int, item_data: dict):
    """API endpoint to edit an existing inventory item."""
    game_engine.edit_inventory_item(index, item_data)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def remove_inventory_item(index: int):
    """API endpoint to remove an item from inventory."""
    game_engine.remove_inventory_item(index)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def modify_level(delta: int):
    """API endpoint to modify the character level."""
    game_engine.modify_level(delta)
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def apply_damage(damage_type: str, amount: int):
    """API endpoint to apply damage to the character."""
    game_engine.apply_damage(damage_type, amount)
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
    game_engine.undo()
    game_engine.save()
    return game_engine.get_character_view_model()

@eel.expose
def redo():
    """API endpoint to redo the last undone mutation."""
    game_engine.redo()
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
