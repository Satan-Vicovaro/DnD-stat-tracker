import zipfile
import xml.etree.ElementTree as ET
import json
import re

def col2num(col_str):
    num = 0
    for c in col_str:
        num = num * 26 + (ord(c.upper()) - ord('A')) + 1
    return num - 1

def get_shared_strings(z):
    try:
        data = z.read('xl/sharedStrings.xml')
        root = ET.fromstring(data)
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        return [t.text for t in root.findall('.//main:t', ns)]
    except Exception:
        return []

def sheet_to_grid(z, sheet_path, shared_strings):
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
                
            v_node = c.find('.//main:v', ns)
            if v_node is not None:
                val = v_node.text
                if c.attrib.get('t') == 's':
                    if val is not None and val.isdigit():
                        val = shared_strings[int(val)]
                grid[row_idx][col_idx] = val
    return [row for row in grid if any(cell != "" for cell in row)]

def main():
    with zipfile.ZipFile('Ekwipunki.xlsx', 'r') as z:
        ss = get_shared_strings(z)
        grid = sheet_to_grid(z, 'xl/worksheets/sheet7.xml', ss)
        with open('zajmowane_miejsce_raw.json', 'w', encoding='utf-8') as f:
            json.dump(grid, f, ensure_ascii=False, indent=2)
        print(f"Extracted {len(grid)} rows. First few rows:")
        for r in grid[:10]:
            print(r)

if __name__ == '__main__':
    main()
