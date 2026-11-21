# RECKLESS WORLD

A free, browser-based open-world night out in Belfast for Reckless Raves, built with Babylon.js and Vite. It's a prototype.

- `npm ci && npm run build` builds the static site into `dist/`.
- `npm run dev` runs it locally.

## Data & credits
- Map data © OpenStreetMap contributors (ODbL), https://www.openstreetmap.org/copyright
- Belfast City LIDAR is provided by the Department for Infrastructure (Rivers) with the permission of the copyright owner, Cyient Europe Limited, and licensed under the Open Government Licence v3.0.
- Street lights: Contains Department for Infrastructure (Roads) street lighting data licensed under the Open Government Licence v3.0 via OpenDataNI.
- Street trees: Contains Belfast City Council trees data licensed under the Open Government Licence v3.0 via OpenDataNI.
- Streamed outer neighbourhoods (public/data/stream, tools/gen_stream.py): OSM footprints (ODbL) with the 2006 Belfast City LIDAR heights (OGL v3.0).
- Animation: Quaternius Universal Animation Library (CC0). Night HDRI: Poly Haven (CC0).
- Traffic cars: Kenney Car Kit (CC0), https://kenney.nl/assets/car-kit
- Outer-street blocks (desktop only, mid-distance fill on streets with no mapped buildings): Kenney City Kit Commercial + Suburban (CC0), tools/blender/export_midkit.py + tools/gen_midkit_place.py
- The police vehicles are fictional, and all shop names are invented.
