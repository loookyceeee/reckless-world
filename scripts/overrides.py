"""Hand fixes after LiDAR enrichment (landmarks whose shape the generic builder must not guess)."""
import json
P = 'public/data/city.json'; c = json.load(open(P))
OV = {539787113: {'rf': 'flat', 'c': '#e6e0d2', 'rc': '#8c8a84', 'h': 17.4}}  # Belfast City Hall: Portland stone, flat leaded roof
for b in c['buildings']:
    o = OV.get(b['id'])
    if o: b.update(o); b.pop('r', None)
json.dump(c, open(P, 'w'), separators=(',', ':'))
print('overrides applied', len(OV))
