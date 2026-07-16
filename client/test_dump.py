from api import game_engine
vm = game_engine.get_character_view_model()
for item in vm['inventory']:
    if item['name'] in ['Leki', 'Opatrunek', 'Narzędzia lekkie zbroje', 'Miecz dwuręczny']:
        print(item['name'], item.get('consumable_effects'), item.get('item_type'))
