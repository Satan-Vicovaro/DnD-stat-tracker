import zipfile
import xml.etree.ElementTree as ET

def get_shared_strings(z):
    data = z.read('xl/sharedStrings.xml')
    root = ET.fromstring(data)
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    strings = []
    for si in root.findall('.//main:si', ns):
        texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
        strings.append("".join(texts))
    return strings

with zipfile.ZipFile('scrapers/Ekwipunki.xlsx', 'r') as z:
    ss = get_shared_strings(z)
    for i in [476, 477, 478, 480, 481, 157, 71, 72]:
        print(f"{i}: {ss[i]}")
