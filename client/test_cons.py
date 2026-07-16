import json
from serializer import build_item, serialize
from models import Item

with open('config/shop/rozne_structured.json', 'r') as f:
    data = json.load(f)
    leki = next(i for i in data if i['name'] == 'Leki')
    item = build_item(leki)
    print(json.dumps(serialize(item), indent=2, ensure_ascii=False))
