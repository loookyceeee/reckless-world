# Textured preview of the avatar glb: blender -b --python prev_tex.py -- glb out.png angle mode(flat|lit) texdir map(json: mesh->tex)
import bpy, sys, math, json
a = sys.argv[sys.argv.index('--') + 1:]; GLB, OUT, ANG, MODE, TD = a[0], a[1], float(a[2]), a[3], a[4]; MAP = json.loads(a[5])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=GLB)
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    b = o.name.split('.')[0]
    if b not in MAP: o.hide_render = True; continue
    m = bpy.data.materials.new('t' + b); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(TD + '/' + MAP[b] + '.webp'); tx.interpolation = 'Linear'
    if MODE == 'flat':
        em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(tx.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs[0])
    else:
        nt.links.new(tx.outputs[0], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.6
        if b == 'Hair': nt.links.new(tx.outputs[1], bs.inputs['Alpha'])
    o.data.materials.clear(); o.data.materials.append(m)
for ar in bpy.context.scene.objects:
    if ar.type == 'ARMATURE':
        ac = [x for x in bpy.data.actions if x.name.startswith('idle')][0]; ar.animation_data_create(); ar.animation_data.action = ac; bpy.context.scene.frame_set(1)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 8 if MODE == 'flat' else 24; sc.cycles.use_denoising = False
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x, sc.render.resolution_y = 540, 720; sc.render.film_transparent = True
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.5, 0.52, 1); sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
if MODE != 'flat':
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 2.5; sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.9
d = 5; cam.location = (math.sin(math.radians(ANG)) * d, -math.cos(math.radians(ANG)) * d, 0.88); cam.rotation_euler = (math.radians(90), 0, math.radians(ANG))
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
