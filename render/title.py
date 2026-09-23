"""Ceramic hero title: rounded, glazed letters the colour of the page.

blender -b -P render/title.py -- out=render/out/title.png width=2400 exposure=0
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common as C  # noqa: E402

A = C.args()
OUT = os.path.join(C.ROOT, A.get("out", "render/out/title.png"))
WIDTH = int(A.get("width", 2400))
SAMPLES = int(A.get("samples", 256))
EXPOSURE = float(A.get("exposure", -2.33))  # calibrated: flat faces ≈ --paper

scene = C.reset()

# ---- Text: pillowy extrusion, fully rounded edge profile
curve = bpy.data.curves.new("Title", "FONT")
curve.body = "Websites\nwith Taste"
curve.font = bpy.data.fonts.load(os.path.join(C.ROOT, "render/fonts/HankenGrotesk-ExtraBold.ttf"))
curve.align_x = "CENTER"
curve.align_y = "CENTER"
curve.size = 1.0
curve.space_line = 0.86
curve.space_character = 1.07
curve.extrude = 0.11
curve.offset = float(A.get("fatten", 0.008))  # offsets the smoothing shrink
curve.resolution_u = 32
text = bpy.data.objects.new("Title", curve)
scene.collection.objects.link(text)

# Fuse overlapping glyph contours into one watertight volume, then round every
# edge by smoothing: gives soft, slip-cast ceramic edges with no bevel glitches.
bpy.context.view_layer.objects.active = text
text.select_set(True)
bpy.ops.object.convert(target="MESH")
remesh = text.modifiers.new("Remesh", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = float(A.get("voxel", 0.0045))
remesh.use_smooth_shade = True
soft = text.modifiers.new("Soften", "SMOOTH")
soft.factor = 0.9
soft.iterations = int(A.get("soften", 28))
bpy.ops.object.modifier_apply(modifier="Remesh")
bpy.ops.object.modifier_apply(modifier="Soften")
text.location.z = curve.extrude  # back face rests on the floor

mat, bsdf = C.principled(
    "Ceramic",
    Base_Color=C.PAPER,
    Roughness=0.32,
    Coat_Weight=1.0,
    Coat_Roughness=0.035,
    Coat_IOR=1.5,
    Subsurface_Weight=0.08,
    Subsurface_Radius=(0.6, 0.5, 0.4),
    Subsurface_Scale=0.02,
)
text.data.materials.append(mat)

C.shadow_catcher(scene, z=0.0)
C.world(scene, top=0.95, bottom=0.55, strength=0.55)

# ---- Light: one very large, soft key from the top left + gentle fill
C.area_light(scene, "Key", location=(-1.5, 2.5, 14), size=16, energy=9000)
C.area_light(scene, "Fill", location=(6, -4, 7), size=10, energy=1200)
# Soft boxes that only show up as reflections in the glaze
for i, (x, y, z, sx, sy, e) in enumerate([
    (-3, 6, 3, 9, 1.4, 6),     # long strip above: highlight along the top edges
    (-8, 1, 3, 1.4, 7, 4),     # left strip
    (6, 5, 4, 4, 1.2, 2.5),    # small kicker, upper right
    (0, 0, 16, 5, 3, 1.2),     # soft overhead for the flat faces
]):
    C.card(scene, f"Box{i}", location=(x, y, z), size=(sx, sy), color=(1, 1, 1), emission=e)

# ---- Frame: orthographic, straight down
bpy.context.view_layer.update()
w, h = text.dimensions.x, text.dimensions.y
margin = 1.06
aspect = (h * margin + 0.35) / (w * margin)
res = (WIDTH, int(round(WIDTH * aspect / 2)) * 2)
C.camera(scene, location=(0, 0, 20), target=(0, 0, 0), ortho_scale=w * margin)

C.settings(scene, res=res, samples=SAMPLES, view="Standard", exposure=EXPOSURE,
           transparent=True, bounces=8)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("[title] wrote", OUT, res)
