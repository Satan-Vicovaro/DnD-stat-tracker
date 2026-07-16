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

def extract_sheet_formulas(z, sheet_path, shared_strings):
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
                grid[row_idx].append({"val": "", "formula": ""})
                
            val = ""
            v_node = c.find('.//main:v', ns)
            if v_node is not None:
                val = v_node.text
                if c.attrib.get('t') == 's':
                    if val is not None and val.isdigit():
                        val = shared_strings[int(val)]
                        
            formula = ""
            f_node = c.find('.//main:f', ns)
            if f_node is not None:
                formula = f_node.text
                
            grid[row_idx][col_idx] = {"val": val, "formula": formula}
    return grid

def main():
    with zipfile.ZipFile('Ekwipunki.xlsx', 'r') as z:
        ss = get_shared_strings(z)
        try:
            grid = extract_sheet_formulas(z, 'xl/worksheets/sheet8.xml', ss)
            with open('obl_raw.json', 'w', encoding='utf-8') as f:
                json.dump(grid, f, ensure_ascii=False, indent=2)
            print("Extracted sheet8 to obl_raw.json")
        except Exception as e:
            print("Error:", e)

if __name__ == '__main__':
    main()
