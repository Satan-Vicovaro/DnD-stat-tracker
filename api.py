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
    return game_engine.get_character_view_model()

@eel.expose
def modify_stat(stat_name: str, delta: int):
    """API endpoint to modify a base stat."""
    game_engine.modify_stat(stat_name, delta)
    return game_engine.get_character_view_model()

@eel.expose
def modify_armor_quantity(armor_name: str, delta: int):
    """API endpoint to modify armor fragments."""
    game_engine.modify_armor_quantity(armor_name, delta)
    return game_engine.get_character_view_model()

@eel.expose
def modify_money(currency_type: str, delta: int):
    """API endpoint to modify character money."""
    game_engine.modify_money(currency_type, delta)
    return game_engine.get_character_view_model()

@eel.expose
def set_money(currency_type: str, value: int):
    """API endpoint to set character money directly."""
    game_engine.set_money(currency_type, value)
    return game_engine.get_character_view_model()

@eel.expose
def modify_level(delta: int):
    """API endpoint to modify the character level."""
    game_engine.modify_level(delta)
    return game_engine.get_character_view_model()

@eel.expose
def get_shop_items():
    """API endpoint for frontend to fetch shop items."""
    logger.info("Frontend requested shop items.")
    return game_engine.get_shop_data()
