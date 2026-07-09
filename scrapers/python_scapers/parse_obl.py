import json

def parse_obl():
    with open('obl_raw.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    extracted = []
    
    for r_idx, row in enumerate(data):
        row_data = []
        for c_idx, cell in enumerate(row):
            if cell.get("val") != "" or cell.get("formula") != "":
                row_data.append({
                    "col": chr(65 + c_idx) if c_idx < 26 else f"{chr(64 + c_idx//26)}{chr(65 + c_idx%26)}",
                    "val": cell.get("val"),
                    "formula": cell.get("formula")
                })
        if row_data:
            extracted.append({
                "row": r_idx + 1,
                "cells": row_data
            })

    with open('obl_filtered.json', 'w', encoding='utf-8') as f:
        json.dump(extracted, f, ensure_ascii=False, indent=2)
        
    print(f"Found data in {len(extracted)} rows")

if __name__ == '__main__':
    parse_obl()
