import zipfile
import xml.etree.ElementTree as ET

def get_shared_strings(z):
    try:
        data = z.read('xl/sharedStrings.xml')
        root = ET.fromstring(data)
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        return [t.text for t in root.findall('.//main:t', ns)]
    except Exception:
        return []

def print_sheet(z, sheet_path, shared_strings, max_rows=5):
    try:
        data = z.read(sheet_path)
        root = ET.fromstring(data)
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = root.findall('.//main:row', ns)
        for i, row in enumerate(rows[:max_rows]):
            row_data = []
            for c in row.findall('.//main:c', ns):
                v_node = c.find('.//main:v', ns)
                if v_node is not None:
                    val = v_node.text
                    if c.attrib.get('t') == 's':
                        val = shared_strings[int(val)]
                    row_data.append(val)
                else:
                    row_data.append("")
            print("\t".join(str(x) for x in row_data))
    except Exception as e:
        print("Error reading sheet:", e)

with zipfile.ZipFile('Ekwipunki.xlsx', 'r') as z:
    ss = get_shared_strings(z)
    print("--- Broń zasięgowa (sheet3) ---")
    print_sheet(z, 'xl/worksheets/sheet3.xml', ss)
    print("\n--- Tarcze (sheet4) ---")
    print_sheet(z, 'xl/worksheets/sheet4.xml', ss)
    print("\n--- Zbroje (sheet5) ---")
    print_sheet(z, 'xl/worksheets/sheet5.xml', ss)
