import json

def parse_to_dict():
    with open('obl_filtered.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    structured = {}
    
    for row in data:
        r_idx = row["row"]
        for cell in row["cells"]:
            col = cell["col"]
            val = str(cell["val"]).strip() if cell["val"] is not None else ""
            formula = str(cell["formula"]).strip() if cell["formula"] is not None else ""
            
            # Skip completely empty cells if they slipped through
            if val == "" and formula == "":
                continue
                
            cell_id = f"{col}{r_idx}"
            structured[cell_id] = {
                "value": val,
                "formula": formula
            }

    with open('obl_structured.json', 'w', encoding='utf-8') as f:
        json.dump(structured, f, ensure_ascii=False, indent=2)
        
    print(f"Structured {len(structured)} cells into obl_structured.json")

if __name__ == '__main__':
    parse_to_dict()
