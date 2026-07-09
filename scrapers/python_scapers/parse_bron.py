import json

def parse():
    with open('bron_biala.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    weapons = []
    current_weapon = None
    
    # Skip the header row (index 0)
    for row in data[1:]:
        # Extend row if it's too short
        while len(row) < 12:
            row.append("")
            
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
        
        # If there's a weapon name, start a new weapon object
        if col_weapon != "":
            current_weapon = {
                "weapon_name": col_weapon,
                "cost_silver": col_cost_silver if col_cost_silver else None,
                "actions": []
            }
            weapons.append(current_weapon)
            
        # Add action if there is an action name or card value
        if current_weapon and (col_action_name != "" or col_card_val != ""):
            action = {
                "card_value": col_card_val,
                "action_name": col_action_name,
                "action_cost": col_action_cost,
                "range": col_range,
                "hit_roll": col_hit,
                "damage_roll": col_dmg,
                "targets": col_targets,
                "turn_execution": col_turn_exec,
                "description": col_desc
            }
            current_weapon["actions"].append(action)

    with open('bron_biala_structured.json', 'w', encoding='utf-8') as f:
        json.dump(weapons, f, ensure_ascii=False, indent=2)
        
    print(f"Structured {len(weapons)} weapons into bron_biala_structured.json")

if __name__ == '__main__':
    parse()
