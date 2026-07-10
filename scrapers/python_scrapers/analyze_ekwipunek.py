import zipfile
import xml.etree.ElementTree as ET
import json
import re
import os

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

    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, '..', 'Ekwipunki.xlsx')
    output_file = os.path.join(script_dir, '..', 'ekwipunek.json')
    
    with zipfile.ZipFile(input_file, 'r') as z:
        ss = get_shared_strings(z)
        try:
            grid = extract_sheet_formulas(z, 'xl/worksheets/sheet1.xml', ss)
            extracted = []
            for r_idx, row in enumerate(grid):
                row_data = []
                for c_idx, cell in enumerate(row):
                    if cell.get("val") != "" or cell.get("formula") != "":
                        col_letter = chr(65 + c_idx) if c_idx < 26 else f"{chr(64 + c_idx//26)}{chr(65 + c_idx%26)}"
                        row_data.append({
                            "col": col_letter,
                            "val": cell.get("val"),
                            "formula": cell.get("formula")
                        })
                if row_data:
                    extracted.append({
                        "row": r_idx + 1,
                        "cells": row_data
                    })

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(extracted, f, ensure_ascii=False, indent=2)
            print(f"Extracted sheet1 to {output_file}")
        except Exception as e:
            print("Error:", e)

if __name__ == '__main__':
    main()
