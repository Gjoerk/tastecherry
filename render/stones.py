"""Diamond turntables: a rough milky crystal and a round brilliant.

blender -b -P render/stones.py -- kind=rough|cut out=render/out/rough frames=360 res=760 samples=256
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector, noise  # noqa: E402
import common as C  # noqa: E402

A = C.args()
KIND = A.get("kind", "cut")
OUT = os.path.join(C.ROOT, A.get("out", f"render/out/{KIND}"))
FRAMES = int(A.get("frames", 360))   # 1° per frame, as on the site (rough + cut ≈ 2.5 h on an RTX 3060)
RES = int(A.get("res", 760))
SAMPLES = int(A.get("samples", 160))

scene = C.reset()


def mesh_object(name, verts, faces):
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.update()
    o = bpy.data.objects.new(name, m)
    scene.collection.objects.link(o)
    return o


# ------------------------------------------------------------------ rough
def rough_stone():
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0)
    obj = bpy.context.active_object
    obj.name = "Rough"
    me = obj.data
    V = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get("co", V)
    V = V.reshape(-1, 3)
    n = V / np.linalg.norm(V, axis=1)[:, None]
    octa = n / np.abs(n).sum(axis=1)[:, None] * 1.5
    r = n * 0.3 + octa * 0.7                       # rounded octahedron
    lump = np.array([noise.fractal(Vector(p) * 1.1, 0.5, 2.0, 2) for p in n])
    etch = np.array([noise.fractal(Vector(p) * 7.0, 0.5, 2.0, 3) for p in n])
    r *= (1 + lump * 0.045 + etch * 0.003)[:, None]
    r[:, 2] *= 1.08
    r[:, 0] *= 0.95
    me.vertices.foreach_set("co", r.ravel())
    me.update()
    C.smooth(obj)

    mat, b = C.principled(
        "MilkyDiamond",
        Base_Color=(1, 1, 1),
        Transmission_Weight=1.0,
        Roughness=0.55,
        IOR=2.0,
        Specular_IOR_Level=0.5,
    )
    nt = mat.node_tree
    # Etched, frosted skin: fine voronoi pits drive bump + roughness variation
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 40
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    bump.inputs["Distance"].default_value = 0.01
    nt.links.new(vor.outputs["Distance"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    rn = nt.nodes.new("ShaderNodeTexNoise")
    rn.inputs["Scale"].default_value = 6
    rmap = nt.nodes.new("ShaderNodeMapRange")
    rmap.inputs["To Min"].default_value = float(A.get("rough_min", 0.18))
    rmap.inputs["To Max"].default_value = float(A.get("rough_max", 0.38))
    nt.links.new(rn.outputs["Fac"], rmap.inputs["Value"])
    nt.links.new(rmap.outputs["Result"], b.inputs["Roughness"])
    # Milky interior: soft white scattering with cloudy density variation
    out = nt.nodes.get("Material Output")
    vol = nt.nodes.new("ShaderNodeVolumeScatter")
    vol.inputs["Color"].default_value = (0.96, 0.965, 0.97, 1)
    vol.inputs["Anisotropy"].default_value = 0.3
    # constant density: Cycles can sample it analytically (no ray marching)
    vol.inputs["Density"].default_value = float(A.get("milk", 0.7))
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    me.materials.append(mat)
    return obj


# ------------------------------------------------------------------ brilliant
def brilliant():
    R, girdle, table_r, star_r, lower_r = 1.0, 0.022, 0.56, 0.77, 0.2
    tan_c = math.tan(math.radians(34.5))
    tan_p = math.tan(math.radians(40.75))
    crown_z = lambda r: girdle + (R - r) * tan_c  # noqa: E731
    pav_z = lambda r: -girdle - (R - r) * tan_p  # noqa: E731

    def at(j, r, z):
        a = j / 16 * 2 * math.pi
        return (r * math.cos(a), r * math.sin(a), z)

    verts = [(0, 0, crown_z(table_r)), (0, 0, pav_z(0))]  # table centre, culet
    idx = {}

    def v(key, co):
        if key not in idx:
            idx[key] = len(verts)
            verts.append(co)
        return idx[key]

    T = lambda k: v(("T", k % 8), at(2 * (k % 8), table_r, crown_z(table_r)))  # noqa: E731
    M = lambda k: v(("M", k % 8), at(2 * (k % 8) + 1, star_r, crown_z(star_r) + 0.012))  # noqa: E731
    G = lambda j: v(("G", j % 16), at(j % 16, R, girdle))  # noqa: E731
    B = lambda j: v(("B", j % 16), at(j % 16, R, -girdle))  # noqa: E731
    Q = lambda k: v(("Q", k % 8), at(2 * (k % 8) + 1, lower_r, pav_z(lower_r)))  # noqa: E731

    faces = [[T(k) for k in range(8)]]                        # table (one octagon)
    for k in range(8):
        faces += [
            [T(k), M(k), T(k + 1)],                             # star
            [T(k), M(k - 1), G(2 * k), M(k)],                   # bezel kite
            [M(k), G(2 * k), G(2 * k + 1)],                     # upper girdle
            [M(k), G(2 * k + 1), G(2 * k + 2)],
            [Q(k), B(2 * k), B(2 * k + 1)],                     # lower girdle
            [Q(k), B(2 * k + 1), B(2 * k + 2)],
            [1, Q(k - 1), B(2 * k), Q(k)],                      # pavilion main kite
        ]
    for j in range(16):
        faces.append([G(j), G(j + 1), B(j + 1), B(j)])        # girdle band
    obj = mesh_object("Brilliant", verts, faces)
    # Consistent outward normals
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    obj.location.z = -0.28

    mat, b = C.principled(
        "Diamond",
        Base_Color=(1, 1, 1),
        Transmission_Weight=1.0,
        Roughness=0.0,
        IOR=2.417,
        Specular_IOR_Level=0.5,
    )
    if "Dispersion" in b.inputs:
        b.inputs["Dispersion"].default_value = float(A.get("dispersion", 0.06))
    obj.data.materials.append(mat)
    return obj


# ------------------------------------------------------------------ scene
pivot = bpy.data.objects.new("Pivot", None)
scene.collection.objects.link(pivot)
stand = bpy.data.objects.new("Stand", None)
scene.collection.objects.link(stand)
pivot.parent = stand

if KIND == "rough":
    stone = rough_stone()
    stone.rotation_euler = (math.radians(20), math.radians(12), 0)
    stone.scale = (0.88, 0.88, 0.88)
    stand.rotation_euler = (math.radians(-6), 0, 0)
    floor_z = -1.55
    cam = dict(location=(0, -8.2, 1.9), target=(0, 0, -0.05))
    exposure = float(A.get("exposure", -0.8))
    bounces = 10
else:
    stone = brilliant()
    stone.scale = (1.02, 1.02, 1.02)
    # Lean the table toward the camera so crown facets + table read clearly
    stand.rotation_euler = (math.radians(float(A.get("tilt", 19))), 0, 0)
    floor_z = -1.35
    cam = dict(location=(0, -8.0, 3.4), target=(0, 0, -0.1))
    exposure = float(A.get("exposure", -0.3))
    bounces = 32
stone.parent = pivot

C.shadow_catcher(scene, z=floor_z)
C.world(scene, top=1.0, bottom=0.18, strength=0.6 if KIND == "rough" else 0.3)

# Studio: big soft key, a few strip boxes and black flags for crisp contrast
C.area_light(scene, "Key", location=(-3.5, -4, 5), size=3, energy=1100)
C.area_light(scene, "Spark", location=(2.5, -5, 4), size=0.4, energy=500)   # small source → fire
C.area_light(scene, "Rim", location=(3, 4, 3), size=3, energy=700)
boxes = [(-5, -1, 2, 0.8, 5, 8), (5, -2, 3, 0.8, 4, 6), (0, 5, 4, 6, 1, 5), (-2, -5, -1, 3, 0.6, 3)]
for i, (x, y, z, sx, sy, e) in enumerate(boxes):
    C.card(scene, f"Box{i}", location=(x, y, z), size=(sx, sy), color=(1, 1, 1), emission=e)
flags = [(4, 3, 0, 2.5, 3), (-4, 3, 1, 2, 3), (0, -6, 6, 3, 1.5), (-5, 2, -2, 2, 2), (5, -3, -1, 1.5, 2.5)]
if KIND == "rough":
    # seen only through the stone: gives the refraction something to reveal
    flags += [(0.6, 4, 0.6, 1.6, 2.2), (-1.4, 4, -0.8, 1.2, 1.2)]
    C.card(scene, "Behind", location=(-0.8, 4.2, 1.2), size=(0.5, 3), color=(1, 1, 1), emission=4)
if KIND == "cut":
    flags += [(2, -5, 3, 1.5, 1.5), (-3, -5, 4, 1.2, 2), (0, 6, 1, 4, 2), (6, 0, 4, 1, 3), (-6, -2, 4, 1, 3)]
for i, (x, y, z, sx, sy) in enumerate(flags):
    C.card(scene, f"Flag{i}", location=(x, y, z), size=(sx, sy), color=(0.01, 0.01, 0.01))

C.camera(scene, lens=85, **cam)
C.settings(scene, res=(RES, RES), samples=SAMPLES, view="Standard", exposure=exposure,
           transparent=True, glass_transparent=False, caustics=False, bounces=bounces)
C.turntable(scene, pivot, OUT, FRAMES, axis="Z", start_deg=float(A.get("start", 0)))
