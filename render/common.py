"""Shared Blender (Cycles) setup for the site's pre-rendered 3D assets.

Run scripts via render/build.sh; each script imports this module.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPER_SRGB = (0xF3 / 255, 0xF1 / 255, 0xEB / 255)  # --paper


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


PAPER = tuple(srgb_to_linear(c) for c in PAPER_SRGB)


def args():
    """Arguments after `--` on the Blender command line, as a dict of k=v."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return dict(a.split("=", 1) for a in argv if "=" in a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"

    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
    return scene


def settings(scene, *, res=(1000, 1000), samples=256, view="AgX", look="None",
             exposure=0.0, transparent=True, glass_transparent=False, caustics=False,
             bounces=12):
    r = scene.render
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.film_transparent = transparent
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.image_settings.color_depth = "8"
    r.dither_intensity = 0.0

    c = scene.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.006
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.film_transparent_glass = glass_transparent
    c.max_bounces = bounces
    c.diffuse_bounces = 4
    c.glossy_bounces = bounces
    c.transmission_bounces = bounces
    c.transparent_max_bounces = bounces
    c.volume_bounces = 2
    c.caustics_reflective = caustics
    c.caustics_refractive = caustics
    c.blur_glossy = 0.0
    c.sample_clamp_indirect = 0.0 if caustics else 10.0
    c.pixel_filter_type = "BLACKMAN_HARRIS"
    c.filter_width = 1.5

    vs = scene.view_settings
    vs.view_transform = view
    vs.look = look
    vs.exposure = exposure
    vs.gamma = 1.0
    scene.display_settings.display_device = "sRGB"
    scene.sequencer_colorspace_settings.name = "sRGB"


def world(scene, top=0.9, bottom=0.25, strength=1.0):
    """Soft vertical gradient environment (never seen directly: film is transparent)."""
    w = bpy.data.worlds.new("World")
    scene.world = w
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (bottom, bottom, bottom * 0.98, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (top * PAPER[0] / PAPER[1], top, top * PAPER[2] / PAPER[1], 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return w


def camera(scene, *, location, target=(0, 0, 0), lens=85, ortho_scale=None):
    cam_data = bpy.data.cameras.new("Camera")
    if ortho_scale:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_scale
    else:
        cam_data.lens = lens
    cam_data.clip_start = 0.05
    cam_data.clip_end = 200
    cam = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def area_light(scene, name, *, location, target=(0, 0, 0), size=2.0, size_y=None,
               energy=500, color=(1, 1, 1), shape="RECTANGLE", visible_glossy=True):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = shape
    data.size = size
    data.size_y = size_y or size
    data.energy = energy
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    obj.visible_glossy = visible_glossy
    return obj


def card(scene, name, *, location, size, color=(0, 0, 0), emission=0.0, target=(0, 0, 0)):
    """Invisible-to-camera card: a black flag (emission=0) or a soft box (emission>0)."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], 1)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("Z", "Y").to_euler()
    mat = new_material(name)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if emission > 0:
        sh = nt.nodes.new("ShaderNodeEmission")
        sh.inputs["Color"].default_value = (*color, 1)
        sh.inputs["Strength"].default_value = emission
    else:
        sh = nt.nodes.new("ShaderNodeBsdfDiffuse")
        sh.inputs["Color"].default_value = (*color, 1)
    nt.links.new(sh.outputs[0], out.inputs["Surface"])
    obj.data.materials.append(mat)
    obj.visible_camera = False
    obj.visible_shadow = False
    return obj


def shadow_catcher(scene, z=0.0, size=30):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    obj = bpy.context.active_object
    obj.name = "ShadowCatcher"
    obj.is_shadow_catcher = True
    return obj


def new_material(name):
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:  # Blender < 5 creates materials without nodes
        mat.use_nodes = True
    return mat


def principled(name, **inputs):
    """New material with a Principled BSDF; kwargs map to input names (spaces as _)."""
    mat = new_material(name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    for key, value in inputs.items():
        socket = bsdf.inputs[key.replace("_", " ")]
        if socket.type == "RGBA" and len(value) == 3:
            value = (*value, 1.0)
        socket.default_value = value
    return mat, bsdf


def smooth(obj, angle=None):
    for p in obj.data.polygons:
        p.use_smooth = True


def turntable(scene, pivot, out_dir, frames, axis="Z", start_deg=0.0):
    """Render `frames` stills of `pivot` spun once around its local axis."""
    os.makedirs(out_dir, exist_ok=True)
    if os.environ.get("NORENDER"):
        bpy.context.view_layer.update()
        bpy.context.evaluated_depsgraph_get()
        print("[turntable] NORENDER: scene built, skipping render", flush=True)
        return
    idx = "XYZ".index(axis)
    only = os.environ.get("FRAMES")  # e.g. "0" or "0,18,36" for quick tests
    todo = [int(f) for f in only.split(",")] if only else range(frames)
    for i in todo:
        rot = list(pivot.rotation_euler)
        rot[idx] = math.radians(start_deg + 360.0 * i / frames)
        pivot.rotation_euler = rot
        scene.render.filepath = os.path.join(out_dir, f"{i:03d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[turntable] {out_dir} {i + 1}/{frames}", flush=True)
