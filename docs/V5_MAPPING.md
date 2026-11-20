# v5 crew art → game mapping (APP DEV v5, manifest f97d7a11274f)

2D: portraits/wardrobe/phone/picker composite the v5 layers exactly like the app (lower = legs piece else body.lower, then upper = outer else top else body.upper), live from the manifest with bundled lossless copies in public/crew/v5/.
3D: textures re-baked from the per-gender v5 garment-only layers (tools/bake_avatar_tex.py, V5=1 default).

| v5 piece | name | slot | lvl (manifest) | game wardrobe id | v5 file | 3D mesh kind | 3D tint (v5 median) | notes |
|---|---|---|---|---|---|---|---|---|
| skate-tee | SKATE TEE | top | 1 | skate-tee | upper-tee | tee | #1e1b21 |  |
| rckls-tee | RCKLS TEE | top | 2 | rckls-tee | upper-rckls-tee | tee | #161618 |  |
| see-me-shorts | SEE ME SHORTS | legs | 3 | see-me-shorts | lower-see-shorts | shorts | #736f6f |  |
| deject-sleeve | DEJECT SLEEVE | top | 3 | deject-sleeve | upper-deject | long | #262428 | generic long-sleeve mesh |
| barrel-jeans | BARREL JEANS | legs | 1 | barrel-jeans | lower-jeans | jeans | #58697f | generic jeans mesh; v5 barrel leg is wider at the knee |
| moltin-tee | MOLTIN TEE | top | 4 | moltin-tee | upper-moltin | tee | #e0dee5 |  |
| stripped-tee | STRIPPED TEE | top | 5 | stripped-tee | upper-stripped | tee | #161618 |  |
| seasoned-pants | SEASONED PANTS | legs | 4 | seasoned-pants | lower-seasoned-pants | pants | #161619 |  |
| seasoned-hoodie | SEASONED HOODIE | outer | 7 | seasoned-hoodie | upper-hoodie | hoodie | #1d1b22 | generic hoodie mesh (hood up, as v5) |
| isometric-tee | ISOMETRIC TEE | top | 6 | isometric-tee | upper-isometric | tee | #e0dee8 |  |
| artillery | ARTILLERY CARGOS | legs | 7 | artillery | lower-artillery | pants | #161417 | generic pants mesh; no cargo pockets geometry |
| ultra-tee | ULTRA TEE | top | 8 | ultra-tee | upper-ultra | tee | #151517 |  |
| stan-bottoms | STAN BOTTOMS | legs | 9 | stan-bottoms | lower-stan-bottoms | cuffed | #171719 | cuffed mesh |
| rawdwg-zip | RAWDWG ZIP | outer | 10 | rawdwg-zip | upper-zip | hoodie | #18161a | shares the generic hoodie mesh; no zip/placket geometry yet (zip is in the texture only) |
| pinner-tee | PINNER TEE | top | 10 | pinner-tee | upper-pinner | tee | #171717 |  |
| rawdawg-shorts | RAWDWG SHORTS | legs | 11 | rawdawg-shorts | lower-raw-shorts | shorts | #161616 |  |
| distress-shirt | DISTRESS SHIRT | top | 11 | distress-shirt | upper-distress | tee | #353537 | kind changed long → tee (v5 is short-sleeve) |
| manager-shorts | MANAGER SHORTS | legs | 12 | manager-shorts | lower-manager-shorts | shorts | #6b7d9d |  |
| manager-zip | MANAGER ZIP | outer | 13 | manager-zip | upper-manager | long | #7487ae | shares the generic long-sleeve mesh; no collar/zip geometry yet |
| see-me-crop | SEE ME CROP | top | 14 | see-me-crop | upper-crop | crop | #706b72 | crop mesh; v5 shows short sleeves + boxy hem |
| stan-hoodie | STAN HOODIE | outer | 14 | stan-hoodie | upper-stan-hoodie | long | #222224 | kind changed hoodie → long (v5 hood is down); no hood-down hoodie mesh yet |
| rcklstv-jersey | RCKLSTV JERSEY | top | 15 | rcklstv-jersey | upper-jersey | long | #d9d7d8 | kind changed tee → long (v5 is long-sleeve) |
| mesh-jersey | MESH JERSEY | top | 15 | mesh-jersey | upper-mesh | tee | #282729 | shares the generic tee mesh; no mesh/perforation geometry |

All 23 manifest pieces have a game wardrobe entry and a baked 3D texture for both bases. No piece is missing from 3D; gaps are shape-only (pieces sharing a generic mesh), listed in the notes column.
