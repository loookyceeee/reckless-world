import bpy, sys, math
argv = sys.argv[sys.argv.index('--') + 1:]; GLB, OUT = argv[0], argv[1]; SHOW = argv[2].split(',')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
COL = {'Body': (0.93, 0.86, 0.82), 'Hair': (0.05, 0.05, 0.06), 'Eyebrows': (0.05, 0.05, 0.05), 'Eyes': (0.2, 0.15, 0.1), 'G_tee': (0.06, 0.06, 0.07), 'G_jeans': (0.42, 0.52, 0.65), 'G_hoodie': (0.07, 0.07, 0.08), 'G_shoes': (0.04, 0.04, 0.04), 'G_briefs': (0.05, 0.05, 0.05), 'G_pants': (0.06, 0.06, 0.07), 'G_long': (.1, .1, .1), 'G_shorts': (.4, .4, .42), 'G_cuffed': (.08, .08, .09), 'G_crop': (.5, .5, .5)}
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    base = o.name.split('.')[0]
    if base.startswith('G_') and base not in SHOW: o.hide_render = True
    if base.startswith('Hair.') or o.name.startswith('Icosphere'): o.hide_render = True
    m = bpy.data.materials.new('pv' + o.name); m.diffuse_color = (*COL.get(base, (0.8, 0.8, 0.8)), 1); o.data.materials.clear(); o.data.materials.append(m)
POSE = argv[4] if len(argv) > 4 else ''
for a in bpy.context.scene.objects:
    if a.type == 'ARMATURE':
        if POSE:
            a.animation_data_create(); a.animation_data.action = [x for x in bpy.data.actions if x.name.startswith(POSE)][0]; bpy.context.scene.frame_set(int([x for x in bpy.data.actions if x.name.startswith(POSE)][0].frame_range[0]) + 5)
        else: a.data.pose_position = 'REST'
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16; sc.cycles.use_denoising = False
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        for m in o.data.materials:
            m.use_nodes = True; bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = m.diffuse_color; bs.inputs['Roughness'].default_value = 0.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30)); sc.collection.objects.link(sun)
sc.render.resolution_x, sc.render.resolution_y = 540, 720; sc.render.film_transparent = True
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.25, 0.27, 1); sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.1
ang = float(argv[3]) if len(argv) > 3 else 0
d = 5; cam.location = (math.sin(math.radians(ang)) * d, -math.cos(math.radians(ang)) * d, 0.9); cam.rotation_euler = (math.radians(90), 0, math.radians(ang))
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
