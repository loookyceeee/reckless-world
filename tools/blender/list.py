import bpy
UAL="/workspace/reckless-world/research/assets/quaternius/universal-animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=UAL)
arm=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'][0]
print("ARM", arm.name, [b.name for b in arm.data.bones][:80])
print("ACTIONS", [(a.name, a.frame_range[:]) for a in bpy.data.actions][:200])
print("FPS", bpy.context.scene.render.fps)
