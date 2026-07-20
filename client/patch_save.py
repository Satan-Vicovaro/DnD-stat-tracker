import json

with open('data/quick_save.json', 'r') as f:
    data = json.load(f)

for item in data.get('inventory', []):
    name = item.get('name')
    if name == 'Leki':
        item['consumable_effects'] = { "heal_health": 5 }
        item['max_uses'] = 1
        item['current_uses'] = 1
    elif name == 'Opatrunek':
        item['consumable_effects'] = { "dynamic_heal": True }
        item['max_uses'] = 1
        item['current_uses'] = 1
    elif name == 'Narzędzia lekkie zbroje':
        item['consumable_effects'] = { "repair_armor": 10 }
        item['max_uses'] = 4
        # Don't reset current_uses if it was already 4? Actually it was 1 before the patch.
        item['current_uses'] = 4
    elif name == 'Narzędzia ciężkie zbroje':
        item['consumable_effects'] = { "repair_armor": 15 }
        item['max_uses'] = 6
        item['current_uses'] = 6

with open('data/quick_save.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Save file patched successfully!")
