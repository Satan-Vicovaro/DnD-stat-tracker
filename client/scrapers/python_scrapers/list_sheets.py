import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile('scrapers/Ekwipunki.xlsx', 'r') as z:
    wb_data = z.read('xl/workbook.xml')
    root = ET.fromstring(wb_data)
    ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sheets = root.findall('.//main:sheet', ns)
    for sheet in sheets:
        print(f"Sheet name: {sheet.attrib['name']}, sheetId: {sheet.attrib['sheetId']}, r:id: {sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']}")
