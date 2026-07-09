import eel
from models import Character

# Initialize Eel and point it to the 'web' folder
eel.init("web")

# Create our main character instance
hero = Character(name="Kajzer", level=1)
# Initialize some basic stats so they show up on the UI
hero.stats.base_str = 5
hero.stats.base_dex = 5
hero.stats.base_wis = 5
hero.stats.base_cha = 5


@eel.expose
def get_character():
    """
    Returns a dictionary of character data.
    """
    return {
        "name": hero.name,
        "level": hero.level,
        "hp": hero.current_hp,
        "max_hp": hero.max_hp,
        "defense": hero.defense,
        "ap": hero.max_action_points,
        "stamina": hero.max_stamina,
        "stats": {
            "str": hero.stats.str,
            "dex": hero.stats.dex,
            "wis": hero.stats.wis,
            "cha": hero.stats.cha,
        },
    }


if __name__ == "__main__":
    print("Starting Eel App...")
    # Start the app. It opens index.html in a native-looking window.
    eel.start("index.html", size=(800, 600))
