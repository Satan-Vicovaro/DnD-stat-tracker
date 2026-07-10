import openpyxl

wb = openpyxl.load_workbook('../Ekwipunki.xlsx', data_only=True)
sheet = wb['Różne']

for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=20, values_only=True)):
    print(f"Row {i+1}: {row}")
