import json

def parse_bron_and_tarcze(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    weapons = []
    current_weapon = None
    for row in data[1:]:
        while len(row) < 12: row.append("")
        col_weapon = str(row[1]).strip()
        col_card_val = str(row[2]).strip()
        col_action_name = str(row[3]).strip()
        col_action_cost = str(row[4]).strip()
        col_range = str(row[5]).strip()
        col_hit = str(row[6]).strip()
        col_dmg = str(row[7]).strip()
        col_targets = str(row[8]).strip()
        col_turn_exec = str(row[9]).strip()
        col_desc = str(row[10]).strip()
        col_cost_silver = str(row[11]).strip()
        
        if col_weapon != "":
            current_weapon = {
                "name": col_weapon,
                "cost_silver": col_cost_silver if col_cost_silver else None,
                "actions": []
            }
            weapons.append(current_weapon)
            
        if current_weapon and (col_action_name != "" or col_card_val != ""):
            current_weapon["actions"].append({
                "card_value": col_card_val,
                "action_name": col_action_name,
                "action_cost": col_action_cost,
                "range": col_range,
                "hit_roll": col_hit,
                "damage_roll": col_dmg,
                "targets": col_targets,
                "turn_execution": col_turn_exec,
                "description": col_desc
            })
    return weapons

def parse_zbroje(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    armors = []
    for row in data[1:]:
        while len(row) < 7: row.append("")
        col_name = str(row[1]).strip()
        if col_name == "": continue
        armors.append({
            "name": col_name,
            "space_taken": str(row[2]).strip(),
            "effect_value": str(row[3]).strip(),
            "cost_type": str(row[4]).strip(),
            "uses_durability": str(row[5]).strip(),
            "cost_silver": str(row[6]).strip()
        })
    return armors

def parse_rozne(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    items = []
    for row in data[1:]:
        while len(row) < 6: row.append("")
        col_name = str(row[1]).strip()
        if col_name == "": continue
        items.append({
            "name": col_name,
            "quantity_or_cost": str(row[2]).strip(),
            "action_cost": str(row[3]).strip(),
            "description": str(row[4]).strip(),
            "space_taken": str(row[5]).strip()
        })
    return items

def main():
    res = {
        'bron_zasiegowa_structured.json': parse_bron_and_tarcze('bron_zasiegowa_raw.json'),
        'tarcze_structured.json': parse_bron_and_tarcze('tarcze_raw.json'),
        'zbroje_structured.json': parse_zbroje('zbroje_raw.json'),
        'rozne_structured.json': parse_rozne('rozne_raw.json')
    }
    for k, v in res.items():
        with open(k, 'w', encoding='utf-8') as f:
            json.dump(v, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(v)} items to {k}")

if __name__ == '__main__':
    main()
