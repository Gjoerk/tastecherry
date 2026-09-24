"""The eyeball for the last section: a grid of gaze directions, not a turntable.

The page picks (and blends) the frames nearest to where the cursor is, so the eye
looks at it. Frame i = row * cols + col; row 0 looks up, col 0 looks left
(the viewer's left). The grid is written to grid.json next to the frames.

blender -b -P render/eye.py -- out=render/out/eye cols=13 rows=9 yaw=36 pitch=24 res=720 samples=192
FRAMES=58 …  renders only frame 58 (the centre of the default grid) for a quick look.

Anatomy (unit eyeball, gaze along local +Z):
  sclera   white shell with a hole at the limbus; subsurface, veins toward the back, wet coat
  cornea   clear dome (IOR 1.376) closed behind the iris, so iris and pupil sit in the aqueous
  iris     shallow cone, radial fibres, darker collarette and limbal ring
  pupil    black disc just behind the iris
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common as C  # noqa: E402

A = C.args()
OUT = os.path.join(C.ROOT, A.get("out", "render/out/eye"))
COLS = int(A.get("cols", 13))
ROWS = int(A.get("rows", 9))
YAW = float(A.get("yaw", 36))        # ± degrees, left/right
PITCH = float(A.get("pitch", 24))    # ± degrees, up/down
RES = int(A.get("res", 720))
SAMPLES = int(A.get("samples", 192))
IRIS = A.get("iris", "hazel")        # hazel | blue | brown

scene = C.reset()

# ------------------------------------------------------------------ geometry
LIMBUS_R = 0.56                                  # iris/cornea edge radius
LIMBUS_Z = math.sqrt(1 - LIMBUS_R ** 2)          # where it meets the unit sphere
CORNEA_R = 0.80                                  # tighter curve than the eyeball: it bulges
CORNEA_C = LIMBUS_Z - math.sqrt(CORNEA_R ** 2 - LIMBUS_R ** 2)
IRIS_Z = LIMBUS_Z - 0.10                         # iris sits a little behind the limbus
PUPIL_R = float(A.get("pupil", 0.19))
SEG = 160


def lathe(name, profile, material, segments=SEG):
    """Revolve (r, z) points about local Z. Points with r == 0 become poles."""
    verts, rings = [], []
    for r, z in profile:
        if r < 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
        else:
            ring = []
            for s in range(segments):
                a = 2 * math.pi * s / segments
                ring.append(len(verts))
                verts.append((r * math.cos(a), r * math.sin(a), z))
            rings.append(ring)
    faces = []
    for a, b in zip(rings, rings[1:]):
        for s in range(segments):
            t = (s + 1) % segments
            if len(a) == 1:
                faces.append((a[0], b[s], b[t]))
            elif len(b) == 1:
                faces.append((a[s], b[0], a[t]))
            else:
                faces.append((a[s], b[s], b[t], a[t]))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    C.smooth(obj)
    return obj


def arc(r, cz, a0, a1, n):
    """Points on a circle of radius r centred at (0, cz), angles from +Z (radians)."""
    return [(r * math.sin(a0 + (a1 - a0) * i / n), cz + r * math.cos(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


# ------------------------------------------------------------------ materials
def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k.replace("_", " ")].default_value = v
    return n


def sclera_material():
    mat, b = C.principled(
        "Sclera", Base_Color=(0.84, 0.80, 0.76), Roughness=0.42,
        Subsurface_Weight=0.35, Subsurface_Radius=(1.0, 0.35, 0.25), Subsurface_Scale=0.06,
        Coat_Weight=1.0, Coat_Roughness=0.04, Coat_IOR=1.376,       # tear film
    )
    nt, L = mat.node_tree, mat.node_tree.links
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    L.new(coord.outputs["Object"], sep.inputs[0])
    # 0 at the limbus, 1 from about 60° back: veins and a warmer tint live there
    back = node(nt, "ShaderNodeMapRange", From_Min=LIMBUS_Z, From_Max=0.35, To_Min=0.0, To_Max=1.0)
    L.new(sep.outputs["Z"], back.inputs["Value"])

    # Veins: edges of a noise-warped voronoi, thin and branching, fading in and out
    warp = node(nt, "ShaderNodeTexNoise", Scale=2.2, Detail=4.0, Roughness=0.6)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "VECTOR"
    mix.inputs["Factor"].default_value = 0.35
    L.new(coord.outputs["Object"], warp.inputs["Vector"])
    L.new(coord.outputs["Object"], mix.inputs[4])
    L.new(warp.outputs["Color"], mix.inputs[5])
    veins = []
    for scale, width, weight in ((2.6, 0.035, 1.0), (6.0, 0.03, 0.55)):
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = scale
        L.new(mix.outputs[1], vor.inputs["Vector"])
        line = node(nt, "ShaderNodeMapRange", From_Min=0.0, From_Max=width, To_Min=weight, To_Max=0.0)
        L.new(vor.outputs["Distance"], line.inputs["Value"])
        veins.append(line)
    both = nt.nodes.new("ShaderNodeMath")
    both.operation = "MAXIMUM"
    L.new(veins[0].outputs["Result"], both.inputs[0])
    L.new(veins[1].outputs["Result"], both.inputs[1])
    patch = node(nt, "ShaderNodeTexNoise", Scale=3.0, Detail=2.0)     # not every edge is a vein
    L.new(coord.outputs["Object"], patch.inputs["Vector"])
    patchm = node(nt, "ShaderNodeMapRange", From_Min=0.45, From_Max=0.62, To_Min=0.0, To_Max=1.0)
    L.new(patch.outputs["Fac"], patchm.inputs["Value"])
    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    L.new(both.outputs[0], m1.inputs[0])
    L.new(patchm.outputs["Result"], m1.inputs[1])
    vein = nt.nodes.new("ShaderNodeMath")
    vein.operation = "MULTIPLY"
    L.new(m1.outputs[0], vein.inputs[0])
    L.new(back.outputs["Result"], vein.inputs[1])

    tint = nt.nodes.new("ShaderNodeMix")                # white near the iris, warmer at the back
    tint.data_type = "RGBA"
    tint.inputs[6].default_value = (0.86, 0.83, 0.79, 1)
    tint.inputs[7].default_value = (0.80, 0.66, 0.60, 1)
    L.new(back.outputs["Result"], tint.inputs["Factor"])
    col = nt.nodes.new("ShaderNodeMix")
    col.data_type = "RGBA"
    col.inputs[7].default_value = (0.42, 0.04, 0.035, 1)
    L.new(tint.outputs[2], col.inputs[6])
    L.new(vein.outputs[0], col.inputs["Factor"])
    L.new(col.outputs[2], b.inputs["Base Color"])
    bump = node(nt, "ShaderNodeBump", Strength=0.08, Distance=0.004)
    L.new(vein.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


IRIS_COLOURS = {
    #          collarette (inner)     body                  outer              limbal ring
    "hazel": ((0.30, 0.16, 0.04), (0.20, 0.17, 0.07), (0.12, 0.13, 0.08), (0.03, 0.03, 0.025)),
    "brown": ((0.22, 0.09, 0.02), (0.13, 0.06, 0.02), (0.08, 0.04, 0.015), (0.02, 0.012, 0.01)),
    "blue":  ((0.30, 0.25, 0.14), (0.16, 0.26, 0.36), (0.10, 0.17, 0.26), (0.02, 0.03, 0.045)),
}


def iris_material():
    inner, body, outer, ring = IRIS_COLOURS[IRIS]
    mat, b = C.principled("Iris", Roughness=0.5)
    nt, L = mat.node_tree, mat.node_tree.links
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    L.new(coord.outputs["Object"], sep.inputs[0])
    # polar coordinates: t = 0 at the pupil, 1 at the limbus; a = angle
    rad = nt.nodes.new("ShaderNodeVectorMath")
    rad.operation = "LENGTH"
    flat = nt.nodes.new("ShaderNodeCombineXYZ")
    L.new(sep.outputs["X"], flat.inputs["X"])
    L.new(sep.outputs["Y"], flat.inputs["Y"])
    L.new(flat.outputs[0], rad.inputs[0])
    t = node(nt, "ShaderNodeMapRange", From_Min=PUPIL_R, From_Max=LIMBUS_R, To_Min=0.0, To_Max=1.0)
    L.new(rad.outputs["Value"], t.inputs["Value"])
    ang = nt.nodes.new("ShaderNodeMath")
    ang.operation = "ARCTAN2"
    L.new(sep.outputs["Y"], ang.inputs[0])
    L.new(sep.outputs["X"], ang.inputs[1])
    # fibres: noise stretched along the radius (many cycles around, few along t)
    polar = nt.nodes.new("ShaderNodeCombineXYZ")
    ascale = nt.nodes.new("ShaderNodeMath")
    ascale.operation = "MULTIPLY"
    ascale.inputs[1].default_value = 7.0
    L.new(ang.outputs[0], ascale.inputs[0])
    L.new(ascale.outputs[0], polar.inputs["X"])
    tscale = nt.nodes.new("ShaderNodeMath")
    tscale.operation = "MULTIPLY"
    tscale.inputs[1].default_value = 0.9
    L.new(t.outputs["Result"], tscale.inputs[0])
    L.new(tscale.outputs[0], polar.inputs["Y"])
    polar.inputs["Z"].default_value = 3.1
    fib = node(nt, "ShaderNodeTexNoise", Scale=6.0, Detail=8.0, Roughness=0.62, Distortion=0.25)
    L.new(polar.outputs[0], fib.inputs["Vector"])
    fibs = nt.nodes.new("ShaderNodeValToRGB")          # fibres: light strands, dark crypts
    fibs.color_ramp.elements[0].position = 0.3
    fibs.color_ramp.elements[0].color = (0.35, 0.35, 0.35, 1)
    fibs.color_ramp.elements[1].position = 0.72
    fibs.color_ramp.elements[1].color = (1.5, 1.5, 1.5, 1)
    L.new(fib.outputs["Fac"], fibs.inputs["Fac"])
    # radial colour: pupil ruff, collarette, body, outer, limbal ring
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "EASE"
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.02, 0.015, 0.01, 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (*ring, 1)
    for pos, c in ((0.04, inner), (0.26, inner), (0.36, body), (0.78, outer), (0.92, ring)):
        e = cr.elements.new(pos)
        e.color = (*c, 1)
    L.new(t.outputs["Result"], ramp.inputs["Fac"])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    L.new(ramp.outputs["Color"], mul.inputs[6])
    L.new(fibs.outputs["Color"], mul.inputs[7])
    L.new(mul.outputs[2], b.inputs["Base Color"])
    bump = node(nt, "ShaderNodeBump", Strength=0.35, Distance=0.01)
    L.new(fib.outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


def cornea_material():
    mat, b = C.principled("Cornea", Base_Color=(1, 1, 1), Transmission_Weight=1.0,
                          Roughness=0.0, IOR=1.376)
    # Shadow rays pass straight through, so the iris is lit (Cycles has no caustics here)
    nt, L = mat.node_tree, mat.node_tree.links
    out = nt.nodes.get("Material Output")
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    L.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    L.new(b.outputs[0], mix.inputs[1])
    L.new(tr.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs["Surface"])
    return mat


pupil_mat, _ = C.principled("Pupil", Base_Color=(0, 0, 0), Roughness=1.0, Specular_IOR_Level=0.0)

# ------------------------------------------------------------------ build
limbus_a = math.asin(LIMBUS_R)
sclera = lathe("Sclera", arc(1.0, 0.0, limbus_a - 0.01, math.pi, 120), sclera_material())
cornea_a = math.asin(LIMBUS_R / CORNEA_R)
back_z = IRIS_Z - 0.08
cornea = lathe("Cornea",
               arc(CORNEA_R, CORNEA_C, 0.0, cornea_a, 48)             # dome, apex → limbus
               + [(LIMBUS_R, LIMBUS_Z - 0.04), (LIMBUS_R * 0.97, back_z), (0.0, back_z)],
               cornea_material())
# iris: a very shallow cone rising toward the pupil, tucked under the sclera at the edge
iris_profile = [(PUPIL_R, IRIS_Z + 0.03)]
for i in range(1, 25):
    r = PUPIL_R + (LIMBUS_R + 0.02 - PUPIL_R) * i / 24
    iris_profile.append((r, IRIS_Z + 0.03 * (1 - i / 24) ** 1.5))
iris = lathe("Iris", iris_profile, iris_material())
pupil = lathe("Pupil", [(0.0, IRIS_Z - 0.01), (PUPIL_R + 0.02, IRIS_Z - 0.01)], pupil_mat)

# rig: base turns the model's +Z to face the camera (−Y); gaze turns it by yaw/pitch
gaze = bpy.data.objects.new("Gaze", None)
scene.collection.objects.link(gaze)
base = bpy.data.objects.new("Base", None)
scene.collection.objects.link(base)
base.parent = gaze
base.rotation_euler = (math.radians(90), 0, 0)
for o in (sclera, cornea, iris, pupil):
    o.parent = base

FLOOR = -1.02
C.shadow_catcher(scene, z=FLOOR)
C.world(scene, top=1.0, bottom=0.2, strength=0.45)

# Studio: one big soft key (its reflection is the catchlight), fill, rim, a floor bounce
C.area_light(scene, "Key", location=(-3.2, -5.5, 4.2), size=2.2, size_y=1.6, energy=1000)
C.area_light(scene, "Fill", location=(4.5, -4.5, 1.0), size=4, energy=260)
C.area_light(scene, "Rim", location=(2.5, 4.5, 3.5), size=3, energy=600)
C.card(scene, "Bounce", location=(0, -3, -3), size=(4, 2), color=(1, 1, 1), emission=0.8)
C.card(scene, "FlagL", location=(-5, 1, 0), size=(2, 3), color=(0.01, 0.01, 0.01))

C.camera(scene, lens=85, location=(0, -8.6, 0.9), target=(0, 0, -0.12))
C.settings(scene, res=(RES, RES), samples=SAMPLES, view="Standard",
           exposure=float(A.get("exposure", -0.5)), transparent=True, bounces=16)

# ------------------------------------------------------------------ render the grid
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "grid.json"), "w") as f:
    json.dump({"cols": COLS, "rows": ROWS, "yaw": YAW, "pitch": PITCH}, f)

if os.environ.get("NORENDER"):
    bpy.context.view_layer.update()
    print("[eye] NORENDER: scene built, skipping render", flush=True)
    sys.exit(0)

only = os.environ.get("FRAMES")
total = COLS * ROWS
todo = [int(i) for i in only.split(",")] if only else range(total)
for i in todo:
    row, col = divmod(i, COLS)
    yaw = -YAW + 2 * YAW * col / (COLS - 1)        # + = the viewer's right
    pitch = PITCH - 2 * PITCH * row / (ROWS - 1)   # + = up
    gaze.rotation_euler = (-math.radians(pitch), 0, math.radians(yaw))
    scene.render.filepath = os.path.join(OUT, f"{i:03d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[eye] {i + 1}/{total} (yaw {yaw:+.0f}°, pitch {pitch:+.0f}°)", flush=True)
