import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile('scrapers/Ekwipunki.xlsx', 'r') as z:
    rels_data = z.read('xl/_rels/workbook.xml.rels')
    root = ET.fromstring(rels_data)
    ns = {'rels': 'http://schemas.openxmlformats.org/package/2006/relationships'}
    rels = root.findall('.//rels:Relationship', ns)
    for rel in rels:
        print(f"Id: {rel.attrib['Id']}, Target: {rel.attrib['Target']}")
