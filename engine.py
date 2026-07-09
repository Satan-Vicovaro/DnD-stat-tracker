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
        }

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
