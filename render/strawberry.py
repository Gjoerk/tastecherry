"""Bitten strawberry turntable.

blender -b -P render/strawberry.py -- out=render/out/strawberry frames=72 res=1000 samples=256
FRAMES=0 env var renders only listed frames (quick tests).
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector, noise  # noqa: E402
import common as C  # noqa: E402

A = C.args()
OUT = os.path.join(C.ROOT, A.get("out", "render/out/strawberry"))
FRAMES = int(A.get("frames", 60))
RES = int(A.get("res", 760))
SAMPLES = int(A.get("samples", 128))

scene = C.reset()
rng = np.random.default_rng(11)


def lin(hex_):
    h = hex_.lstrip("#")
    return tuple(C.srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


# ------------------------------------------------------------------ profile
# (radius, height) from the tip up to the top centre
CTRL = np.array([
    (0.0, -1.0), (0.09, -0.975), (0.3, -0.77), (0.55, -0.39), (0.72, 0.0),
    (0.8, 0.34), (0.74, 0.6), (0.5, 0.76), (0.22, 0.76), (0.0, 0.69),
])


def catmull_rom(points, n):
    pts = np.vstack([points[0], points, points[-1]])
    out = []
    segs = len(points) - 1
    for s in range(segs):
        p0, p1, p2, p3 = pts[s:s + 4]
        for t in np.linspace(0, 1, 40, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(points[-1])
    out = np.array(out)
    # resample by arc length
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(out, axis=0), axis=1))]
    u = np.linspace(0, d[-1], n)
    return np.c_[np.interp(u, d, out[:, 0]), np.interp(u, d, out[:, 1])]


PROF = catmull_rom(CTRL, 240)
PROF[0, 0] = PROF[-1, 0] = 0.0


def prof_at(v):
    """Point and tangent on the profile at v in [0, 1]."""
    x = v * (len(PROF) - 1)
    i = min(int(x), len(PROF) - 2)
    f = x - i
    p = PROF[i] * (1 - f) + PROF[i + 1] * f
    t = PROF[i + 1] - PROF[i]
    return p, t / np.linalg.norm(t)


# ------------------------------------------------------------------ seeds
seeds = []  # (position, normal, up)
# Evenly spaced but irregular: dart throwing on the surface (area-weighted)
MIN_D = 0.108
accepted = []
tries = 0
while tries < 60000:
    tries += 1
    v = rng.uniform(0.04, 0.79)
    r = prof_at(v)[0][0]
    if rng.uniform(0, 0.8) > r:          # area weighting: more seeds where wider
        continue
    phi = rng.uniform(0, 2 * math.pi)
    (pr, pz), (tr, tz) = prof_at(v)
    c, s = math.cos(phi), math.sin(phi)
    pos = np.array([pr * c, pr * s, pz])
    if accepted and np.min(np.sum((np.array(accepted) - pos) ** 2, axis=1)) < MIN_D ** 2:
        continue
    accepted.append(pos)
    nrm = np.array([tz * c, tz * s, -tr])
    nrm /= np.linalg.norm(nrm)
    up = np.array([tr * c, tr * s, tz])
    seeds.append((pos, nrm, up))
seed_pos = np.array([s[0] for s in seeds])

# ------------------------------------------------------------------ body
SEG = 256
verts, faces = [], []
ring_index = []
for j, (r, z) in enumerate(PROF):
    if r < 1e-6:
        ring_index.append([len(verts)])
        verts.append((0.0, 0.0, z))
        continue
    idx = []
    for i in range(SEG):
        a = 2 * math.pi * i / SEG
        idx.append(len(verts))
        verts.append((r * math.cos(a), r * math.sin(a), z))
    ring_index.append(idx)
for j in range(len(ring_index) - 1):
    A_, B_ = ring_index[j], ring_index[j + 1]
    if len(A_) == 1:
        faces += [(A_[0], B_[(i + 1) % SEG], B_[i]) for i in range(SEG)]
    elif len(B_) == 1:
        faces += [(A_[i], A_[(i + 1) % SEG], B_[0]) for i in range(SEG)]
    else:
        faces += [(A_[i], A_[(i + 1) % SEG], B_[(i + 1) % SEG], B_[i]) for i in range(SEG)]

mesh = bpy.data.meshes.new("Berry")
mesh.from_pydata(verts, [], faces)
mesh.update()
body = bpy.data.objects.new("Berry", mesh)
scene.collection.objects.link(body)

V = np.array(verts)
N = np.zeros_like(V)
mesh.vertices.foreach_get("normal", N.ravel())

# organic asymmetry + seed dimples
dimple = np.zeros(len(V))
for p in seed_pos:
    d2 = np.sum((V - p) ** 2, axis=1)
    dimple += np.exp(-d2 / (0.042 ** 2))
dimple = np.clip(dimple, 0, 1)
lump = np.array([noise.noise(Vector(v) * 1.3) for v in V]) * 0.035
V = V + N * (lump - 0.03 * dimple)[:, None]
mesh.vertices.foreach_set("co", V.ravel())
mesh.update()
C.smooth(body)

# colour attribute: pale shoulders under the calyx, deeper red in dimples
red, deep, pale = np.array(lin("#B80D1C")), np.array(lin("#5E0510")), np.array(lin("#EFC9A4"))
radial = np.hypot(V[:, 0], V[:, 1])
top = np.clip((V[:, 2] - 0.48) / 0.26, 0, 1) * np.clip((0.66 - radial) / 0.35, 0, 1)
var = np.array([noise.noise(Vector(v) * 3.0) for v in V]) * 0.5 + 0.5
col = red[None] * (0.85 + 0.3 * var[:, None])
col = col * (1 - 0.55 * dimple[:, None]) + deep[None] * (0.55 * dimple[:, None])
col = col * (1 - 0.6 * top[:, None]) + pale[None] * (0.6 * top[:, None])
attr = mesh.color_attributes.new("col", "FLOAT_COLOR", "POINT")
attr.data.foreach_set("color", np.c_[col, np.ones(len(col))].ravel())

skin, sk = C.principled("Skin", Roughness=0.34, Coat_Weight=0.55, Coat_Roughness=0.08,
                        Subsurface_Weight=0.18, Subsurface_Radius=(1.0, 0.2, 0.12),
                        Subsurface_Scale=0.03, Specular_IOR_Level=0.5)
nt = skin.node_tree
at = nt.nodes.new("ShaderNodeAttribute")
at.attribute_name = "col"
nt.links.new(at.outputs["Color"], sk.inputs["Base Color"])
pores = nt.nodes.new("ShaderNodeTexNoise")
pores.inputs["Scale"].default_value = 220
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.06
nt.links.new(pores.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], sk.inputs["Normal"])
mesh.materials.append(skin)

# ------------------------------------------------------------------ seed mesh
bm = bmesh.new()
tmpl = bmesh.new()
bmesh.ops.create_uvsphere(tmpl, u_segments=12, v_segments=8, radius=1.0)
tv = np.array([v.co[:] for v in tmpl.verts])
tf = [[v.index for v in f.verts] for f in tmpl.faces]
all_v, all_f = [], []
for pos, nrm, up in seeds:
    side = np.cross(up, nrm)
    R = np.stack([side, up, nrm], axis=1)  # columns: local x, y, z
    scale = np.array([0.016, 0.028, 0.012]) * rng.uniform(0.85, 1.1)
    base = len(all_v)
    all_v.extend((tv * scale) @ R.T + pos - nrm * 0.02)
    all_f.extend([[base + i for i in f] for f in tf])
seed_mesh = bpy.data.meshes.new("Seeds")
seed_mesh.from_pydata([tuple(v) for v in all_v], [], all_f)
seeds_obj = bpy.data.objects.new("Seeds", seed_mesh)
scene.collection.objects.link(seeds_obj)
C.smooth(seeds_obj)
seed_mat, _ = C.principled("Seed", Base_Color=lin("#D8A640"), Roughness=0.35, Coat_Weight=0.4,
                           Subsurface_Weight=0.3, Subsurface_Radius=(1, 0.7, 0.2), Subsurface_Scale=0.02)
seed_mesh.materials.append(seed_mat)

# ------------------------------------------------------------------ calyx
top_curve = PROF[(PROF[:, 1] > 0.5) & (PROF[:, 0] < 0.79)]
top_curve = top_curve[np.argsort(top_curve[:, 0])]


def surface_z(r):
    return float(np.interp(r, top_curve[:, 0], top_curve[:, 1]))


leaf_mat, lf = C.principled("Leaf", Base_Color=lin("#2F6B22"), Roughness=0.5, Sheen_Weight=0.35,
                            Sheen_Roughness=0.4, Subsurface_Weight=0.25, Subsurface_Radius=(0.3, 1, 0.2),
                            Subsurface_Scale=0.03, Coat_Weight=0.2)
leaves = []
sepals = 9
for k in range(sepals):
    length = 0.9 + 0.12 * math.sin(k * 3.1)
    width = 0.2 + 0.035 * math.cos(k * 2.3)
    lv, lf_ = [], []
    nu, nv = 8, 36
    for jv in range(nv + 1):
        t = jv / nv
        half = width * math.sin(math.pi * min(t * 1.04, 1)) ** 0.7 * (1 - 0.35 * t)
        r = t * length
        rim = max(0.0, r - 0.6)
        for ju in range(nu + 1):
            x = (ju / nu - 0.5) * 2
            z = surface_z(min(r, 0.78)) + 0.02 - rim * rim * 3.0 + t * t * 0.03 + abs(x) * half * 0.35
            z += 0.012 * math.sin(t * 9 + k)  # slight waviness
            lv.append((r, x * half, z))
    for jv in range(nv):
        for ju in range(nu):
            a = jv * (nu + 1) + ju
            lf_.append((a, a + 1, a + nu + 2, a + nu + 1))
    m = bpy.data.meshes.new(f"Sepal{k}")
    m.from_pydata(lv, [], lf_)
    o = bpy.data.objects.new(f"Sepal{k}", m)
    scene.collection.objects.link(o)
    o.rotation_euler.z = 2 * math.pi * k / sepals + math.sin(k * 5.7) * 0.12
    sol = o.modifiers.new("Solidify", "SOLIDIFY")
    sol.thickness = 0.014
    sol.offset = 0
    sub = o.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = sub.render_levels = 2
    C.smooth(o)
    m.materials.append(leaf_mat)
    leaves.append(o)

stem_curve = bpy.data.curves.new("Stem", "CURVE")
stem_curve.dimensions = "3D"
sp = stem_curve.splines.new("NURBS")
sp.points.add(3)
for p, co in zip(sp.points, [(0, 0, 0.64), (0.01, 0.0, 0.82), (0.04, 0.01, 0.98), (0.11, 0.02, 1.08)]):
    p.co = (*co, 1)
sp.use_endpoint_u = True
sp.order_u = 3
stem_curve.bevel_depth = 0.042
stem_curve.bevel_resolution = 6
stem_curve.use_fill_caps = True
stem = bpy.data.objects.new("Stem", stem_curve)
scene.collection.objects.link(stem)
stem_mat, _ = C.principled("Stem", Base_Color=lin("#3B6A26"), Roughness=0.55, Sheen_Weight=0.5,
                           Subsurface_Weight=0.2, Subsurface_Radius=(0.3, 1, 0.2), Subsurface_Scale=0.02)
stem_curve.materials.append(stem_mat)

# ------------------------------------------------------------------ bite
# Main scoop + a ring of tooth bumps, from the top left as seen by the camera
axis = Vector((-0.8, -0.58, 0.5)).normalized()   # outward from the fruit
centre = axis * 0.9
bm = bmesh.new()


def add_ellipsoid(center, radii, rot=None, seg=48):
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=seg // 2, radius=1.0)
    for v in tmp.verts:
        co = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]))
        if rot:
            co = rot @ co
        v.co = co + center
    m = bpy.data.meshes.new("tmp")
    tmp.to_mesh(m)
    bm.from_mesh(m)
    bpy.data.meshes.remove(m)


rot = axis.to_track_quat("Z", "Y").to_matrix()
add_ellipsoid(centre, (0.6, 0.56, 0.66), rot, seg=96)
# Tooth marks: bumps around the rim push the cut edge into scallops
ring_r = 0.55
for i in range(11):
    a = -1.0 + 2.0 * i / 10          # spread over an arc (upper and lower teeth)
    for side in (1, -1):
        ang = side * (math.pi / 2) + a * 0.85
        local = Vector((math.cos(ang) * ring_r, math.sin(ang) * ring_r * 0.95, -0.12))
        add_ellipsoid(centre + rot @ local, (0.1, 0.1, 0.22), rot, seg=24)
cut_mesh = bpy.data.meshes.new("BiteCutter")
bm.to_mesh(cut_mesh)
cutter = bpy.data.objects.new("BiteCutter", cut_mesh)
scene.collection.objects.link(cutter)
cutter.hide_render = True
cutter.display_type = "WIRE"


def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# Fuse the overlapping scoop + teeth into one smooth, watertight cutter
rm = cutter.modifiers.new("Fuse", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.012
sm = cutter.modifiers.new("Soften", "SMOOTH")
sm.factor, sm.iterations = 0.8, 6
apply_all(cutter)

# Flesh: pale core fading to red at the skin, fibrous and wet
flesh, fl = C.principled("Flesh", Roughness=0.3, Coat_Weight=0.45, Coat_Roughness=0.12,
                         Subsurface_Weight=0.6, Subsurface_Radius=(1.0, 0.3, 0.25),
                         Subsurface_Scale=0.04, Specular_IOR_Level=0.5)
ft = flesh.node_tree
tc = ft.nodes.new("ShaderNodeTexCoord")
sep = ft.nodes.new("ShaderNodeSeparateXYZ")
ft.links.new(tc.outputs["Object"], sep.inputs[0])
# radial distance from the fruit axis, distorted by noise for streaks
sq = ft.nodes.new("ShaderNodeVectorMath")
sq.operation = "LENGTH"
comb = ft.nodes.new("ShaderNodeCombineXYZ")
ft.links.new(sep.outputs["X"], comb.inputs["X"])
ft.links.new(sep.outputs["Y"], comb.inputs["Y"])
ft.links.new(comb.outputs[0], sq.inputs[0])
streak = ft.nodes.new("ShaderNodeTexNoise")
streak.inputs["Scale"].default_value = 9
streak.inputs["Detail"].default_value = 8
mix = ft.nodes.new("ShaderNodeMath")
mix.operation = "MULTIPLY_ADD"
mix.inputs[1].default_value = 1.0
ft.links.new(streak.outputs["Fac"], mix.inputs[0])
ft.links.new(sq.outputs["Value"], mix.inputs[2])
# mix: noise*1 + radius  → subtract 0.5 to centre the noise
off = ft.nodes.new("ShaderNodeMath")
off.operation = "SUBTRACT"
off.inputs[1].default_value = 0.5
ft.links.new(mix.outputs[0], off.inputs[0])
ramp = ft.nodes.new("ShaderNodeValToRGB")
el = ramp.color_ramp.elements
el[0].position, el[0].color = 0.12, (*lin("#F7DDD3"), 1)
el[1].position, el[1].color = 0.66, (*lin("#A80C1B"), 1)
mid = el.new(0.42)
mid.color = (*lin("#EA7A80"), 1)
ft.links.new(off.outputs[0], ramp.inputs["Fac"])
ft.links.new(ramp.outputs["Color"], fl.inputs["Base Color"])
fib = ft.nodes.new("ShaderNodeTexNoise")
fib.inputs["Scale"].default_value = 60
fib.inputs["Detail"].default_value = 10
fbump = ft.nodes.new("ShaderNodeBump")
fbump.inputs["Strength"].default_value = 0.25
fbump.inputs["Distance"].default_value = 0.02
ft.links.new(fib.outputs["Fac"], fbump.inputs["Height"])
ft.links.new(fbump.outputs["Normal"], fl.inputs["Normal"])
cut_mesh.materials.append(flesh)

def trim_inside(obj, cutter_obj):
    """Delete the parts of a thin mesh (leaf) that fall inside the cutter volume."""
    apply_all(obj)
    bm_ = bmesh.new()
    bm_.from_mesh(obj.data)
    inside = []
    for v in bm_.verts:
        ok, hit, nrm, _ = cutter_obj.closest_point_on_mesh(v.co)
        if ok and (v.co - hit).dot(nrm) < 0:
            inside.append(v)
    bmesh.ops.delete(bm_, geom=inside, context="VERTS")
    bm_.to_mesh(obj.data)
    bm_.free()


for leaf in leaves:
    trim_inside(leaf, cutter)

for obj in [body, seeds_obj]:
    b = obj.modifiers.new("Bite", "BOOLEAN")
    b.operation = "DIFFERENCE"
    b.solver = "EXACT"
    b.object = cutter
    b.material_mode = "TRANSFER"

# Bake the bite in once, so turntable frames don't recompute booleans
for obj in [body, seeds_obj]:
    apply_all(obj)

# ------------------------------------------------------------------ assembly
pivot = bpy.data.objects.new("Pivot", None)
scene.collection.objects.link(pivot)
for obj in [body, seeds_obj, stem, cutter] + leaves:
    obj.parent = pivot
stand = bpy.data.objects.new("Stand", None)   # slight forward lean
scene.collection.objects.link(stand)
pivot.parent = stand
stand.rotation_euler = (math.radians(-8), math.radians(-6), 0)

C.shadow_catcher(scene, z=-1.3)
C.world(scene, top=0.9, bottom=0.3, strength=0.35)
C.area_light(scene, "Key", location=(-4, -5, 5), size=6, energy=1500)
C.area_light(scene, "Rim", location=(4, 4, 3), size=3, energy=900, color=(1, 0.95, 0.9))
C.area_light(scene, "Fill", location=(5, -4, 1), size=5, energy=350)
C.area_light(scene, "Top", location=(0, 0, 7), size=4, energy=600)
C.card(scene, "Strip", location=(-3, -4, 2.5), size=(0.6, 3.5), color=(1, 1, 1), emission=6)

C.camera(scene, location=(0, -7.4, 1.5), target=(0, 0, -0.06), lens=85)
C.settings(scene, res=(RES, RES), samples=SAMPLES, view="Standard",
           exposure=float(A.get("exposure", -0.9)), transparent=True, bounces=8)

# Start angle chosen so frame 0 shows the bite at the upper left
C.turntable(scene, pivot, OUT, FRAMES, axis="Z", start_deg=float(A.get("start", 0)))
