import logging
from models import Character

logger = logging.getLogger(__name__)

class GameEngine:
    """Core game engine managing state, rules, and logic."""

    def __init__(self):
        self.hero = self._create_starting_character()
        logger.info(f"GameEngine initialized with hero: {self.hero.name}")

    def _create_starting_character(self) -> Character:
        hero = Character(name="Kajzer", level=1)
        hero.stats.base_str = 5
        hero.stats.base_dex = 5
        hero.stats.base_wis = 5
        hero.stats.base_cha = 5
        return hero

    def get_character_view_model(self) -> dict:
        """Returns the character data formatted for the frontend."""
        return {
            "name": self.hero.name,
            "level": self.hero.level,
            "hp": self.hero.current_hp,
            "max_hp": self.hero.max_hp,
            "defense": self.hero.defense,
            "ap": self.hero.max_action_points,
            "stamina": self.hero.max_stamina,
            "stats": {
                "str": self.hero.stats.str,
                "dex": self.hero.stats.dex,
                "wis": self.hero.stats.wis,
                "cha": self.hero.stats.cha,
            },
        }

    def update_name(self, new_name: str):
        self.hero.name = new_name
        logger.info(f"Hero name updated to: {new_name}")

    def modify_stat(self, stat_name: str, delta: int):
        stat_attr = f"base_{stat_name}"
        if hasattr(self.hero.stats, stat_attr):
            current = getattr(self.hero.stats, stat_attr)
            setattr(self.hero.stats, stat_attr, current + delta)
            logger.info(f"Hero stat {stat_name} modified by {delta}")

# Singleton instance exported for use by APIs
game_engine = GameEngine()
