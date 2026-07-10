import zipfile

with zipfile.ZipFile('scrapers/Ekwipunki.xlsx', 'r') as z:
    data = z.read('xl/worksheets/sheet6.xml')
    print(data.decode('utf-8')[:3000])
