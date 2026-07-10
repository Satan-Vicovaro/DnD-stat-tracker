import zipfile
import xml.etree.ElementTree as ET
import re
import json
import os

def col2num(col_str):
    num = 0
    for c in col_str:
        num = num * 26 + (ord(c.upper()) - ord('A')) + 1
    return num - 1

def get_shared_strings(z):
    data = z.read('xl/sharedStrings.xml')
    root = ET.fromstring(data)
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    strings = []
    for si in root.findall('.//main:si', ns):
        texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
        strings.append("".join(texts))
    return strings

def extract_sheet(z, sheet_path, shared_strings):
    data = z.read(sheet_path)
    root = ET.fromstring(data)
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    grid = []
    rows = root.findall('.//main:row', ns)
    for row in rows:
        row_idx = int(row.attrib['r']) - 1
        while len(grid) <= row_idx:
            grid.append([])
            
        cells = row.findall('.//main:c', ns)
        for c in cells:
            r_attr = c.attrib['r']
            col_str = re.sub(r'[0-9]+', '', r_attr)
            col_idx = col2num(col_str)
            
            while len(grid[row_idx]) <= col_idx:
                grid[row_idx].append("")
                
            val = ""
            v_node = c.find('.//main:v', ns)
            if v_node is not None:
                val = v_node.text
                if c.attrib.get('t') == 's':
                    if val is not None and val.isdigit():
                        idx = int(val)
                        if idx < len(shared_strings):
                            val = shared_strings[idx]
            grid[row_idx][col_idx] = val
    return grid

with zipfile.ZipFile('scrapers/Ekwipunki.xlsx', 'r') as z:
    ss = get_shared_strings(z)
    grid = extract_sheet(z, 'xl/worksheets/sheet6.xml', ss)

items = []
for r_idx, row in enumerate(grid):
    if r_idx == 0 or r_idx == 1: continue # skip headers
    if not any(row): continue
    
    while len(row) < 6: row.append("")
    
    name = row[1].strip()
    if not name: continue
    
    cost = row[2].strip()
    action = row[3].strip()
    desc = row[4].strip()
    space = row[5].strip()
    
    # Fix obvious typos in the excel file
    if name == "Zaopatrzenie" and "leczy max hp" in desc:
        name = "Opatrunek"
    elif name == "Opatrunek" and "woda, jedzenie" in desc:
        name = "Zaopatrzenie"
        
    items.append({
        "name": name,
        "cost_silver": cost,  # changed from quantity_or_cost for compatibility with ShopComponent logic
        "action_cost": action,
        "description": desc,
        "space_taken": space
    })

# Remove duplicates
unique_items = []
seen = set()
for item in items:
    if item['name'] not in seen:
        seen.add(item['name'])
        unique_items.append(item)

out_path = 'config/shop/rozne_structured.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(unique_items, f, ensure_ascii=False, indent=2)

print(f"Generated {out_path} with {len(unique_items)} items")
