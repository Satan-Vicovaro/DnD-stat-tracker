import json

def parse_zajmowane():
    with open('zajmowane_miejsce_raw.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    items = []
    
    # Skip the header row
    for row in data[1:]:
        # Check pairs (1,2), (4,5), (7,8) etc.
        for i in range(1, len(row), 3):
            if i + 1 < len(row):
                name = str(row[i]).strip()
                space = str(row[i+1]).strip()
                if name != "":
                    items.append({
                        "name": name,
                        "space_taken": space
                    })

    with open('zajmowane_miejsce_structured.json', 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        
    print(f"Structured {len(items)} items into zajmowane_miejsce_structured.json")

if __name__ == '__main__':
    parse_zajmowane()
