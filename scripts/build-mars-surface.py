"""Run in Blender's Python console (or through MCP) to rebuild Mars surface assets.

Original procedural artwork guided by the user's rover photographs, not a
photogrammetry reconstruction. Texture tiles cover 6 m (ground) / 2 m (rock).
The source scene is created separately from any scene currently open.
"""
from pathlib import Path
import math
import random

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(r"C:\Users\LENOVO\Documents\GitHub")
OUT = ROOT / "public/textures/mars/surface"
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 1024
rng = np.random.default_rng(87031)


def enum(owner, prop, wanted):
    items = owner.bl_rna.properties[prop].enum_items
    return next(i.identifier for i in items if i.identifier.lower() == wanted.lower())


def noise(cells):
    """Periodic smooth noise: all derivatives and marks wrap at the tile edge."""
    grid = rng.random((cells, cells)).astype(np.float32)
    coord = np.arange(SIZE, dtype=np.float32) * cells / SIZE
    index = coord.astype(int)
    f = coord - index
    f = f * f * (3 - 2 * f)
    a = grid[index[:, None] % cells, index[None, :] % cells]
    b = grid[index[:, None] % cells, (index[None, :] + 1) % cells]
    c = grid[(index[:, None] + 1) % cells, index[None, :] % cells]
    d = grid[(index[:, None] + 1) % cells, (index[None, :] + 1) % cells]
    return (a * (1 - f[None, :]) + b * f[None, :]) * (1 - f[:, None]) + (c * (1 - f[None, :]) + d * f[None, :]) * f[:, None]


def save_image(name, rgb, data=False):
    image = bpy.data.images.new(name, width=SIZE, height=SIZE, alpha=False, is_data=data)
    rgba = np.ones((SIZE, SIZE, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 1)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(OUT / (name + ".png"))
    image.file_format = enum(image, "file_format", "PNG")
    image.save()
    return image


def maps(kind):
    broad, mid, fine = noise(5), noise(28), noise(170)
    grain = rng.random((SIZE, SIZE)).astype(np.float32)
    yy, xx = np.mgrid[:SIZE, :SIZE] / SIZE
    if kind == "regolith":
        # Discontinuous aeolian ripples, fine dust and basalt granules.
        phase = yy * math.tau * 19 + np.sin(xx * math.tau * 3) * 1.4 + mid * 1.7
        ripple = np.maximum(0, np.sin(phase)) ** 5 * np.clip((broad - .33) * 2, 0, .55)
        height = mid * .16 + fine * .07 + grain * .024 + ripple * .10
        stones = np.zeros((SIZE, SIZE), dtype=np.float32)
        for _ in range(2800):
            x, y = rng.integers(0, SIZE, 2)
            radius = float(rng.uniform(1.2, 5.5))
            r = math.ceil(radius)
            dy, dx = np.mgrid[-r:r+1, -r:r+1]
            shape = np.maximum(0, 1 - (dx / radius) ** 2 - (dy / (radius * .65)) ** 2)
            yi, xi = (y + dy) % SIZE, (x + dx) % SIZE
            stones[yi, xi] = np.maximum(stones[yi, xi], shape)
        height += stones * .22
        dust = np.array([.61, .40, .29], dtype=np.float32)
        # Large-scale colour belongs to the terrain vertices; keep this tile
        # low-contrast so distant crater walls do not reveal a repeating motif.
        rgb = dust + (broad[..., None] - .5) * .035 + (mid[..., None] - .5) * .025
        rgb = rgb + (fine[..., None] - .5) * .065 + (grain[..., None] - .5) * .035
        rgb = rgb * (1 - stones[..., None] * .49)
        rough = .88 + fine * .10 - stones * .12
        strength = 3.2
    else:
        # Nearly neutral modulation: runtime instance colours supply mineral tint.
        strata = np.sin(yy * math.tau * 37 + mid * 1.5 + np.sin(xx * math.tau * 2) * .55)
        seams = np.maximum(0, strata) ** 12
        pits = np.maximum(0, (.32 - fine) * 3)
        height = mid * .30 + fine * .13 + grain * .025 - seams * .08 - pits * .12
        value = .79 + (broad - .5) * .13 + (fine - .5) * .20 - seams * .09 - pits * .20
        rgb = np.stack([value, value * .975, value * .95], axis=-1)
        rough = .80 + fine * .16
        strength = 4.0
    # OpenGL (+Y) tangent-space normals, derived from the same periodic relief.
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    normal = np.stack([-dx, -dy, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return {
        "color": save_image(kind + "-color", rgb),
        "normal": save_image(kind + "-normal", normal * .5 + .5, True),
        "roughness": save_image(kind + "-roughness", np.repeat(rough[..., None], 3, axis=2), True),
    }


def material(name, images, tint):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    shader.inputs["Metallic"].default_value = 0
    color = nodes.new("ShaderNodeTexImage")
    color.image = images["color"]
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = enum(mix, "blend_type", "MULTIPLY")
    mix.inputs[0].default_value = 1
    mix.inputs[2].default_value = (*tint, 1)
    links.new(color.outputs["Color"], mix.inputs[1])
    links.new(mix.outputs[0], shader.inputs["Base Color"])
    rough = nodes.new("ShaderNodeTexImage")
    rough.image = images["roughness"]
    links.new(rough.outputs["Color"], shader.inputs["Roughness"])
    normal = nodes.new("ShaderNodeTexImage")
    normal.image = images["normal"]
    convert = nodes.new("ShaderNodeNormalMap")
    links.new(normal.outputs["Color"], convert.inputs["Color"])
    links.new(convert.outputs["Normal"], shader.inputs["Normal"])
    return mat


scene = bpy.data.scenes.new("Mars Surface • Rover references")
bpy.context.window.scene = scene
ground_maps, rock_maps = maps("regolith"), maps("basalt")
ground_mat = material("Mars • fine aeolian regolith", ground_maps, (1, 1, 1))
rock_mat = material("Mars • dust-coated sedimentary basalt", rock_maps, (.25, .19, .16))


def rock(name, variant):
    rand = random.Random(491 + variant * 199)
    count, layers = 19, 11
    outline = [rand.uniform(.72, 1.08) for _ in range(count)]
    bedding = [rand.uniform(-.025, .045) for _ in range(layers)]
    verts, faces = [], []
    for layer in range(layers):
        t = layer / (layers - 1)
        z = -.43 + t * 1.38
        profile = (.78 + .22 * math.sin(t * math.pi)) * (1 - max(0, t - .66) * .68)
        ledge = bedding[layer] * (0.35 if variant == 0 else 1)
        for j in range(count):
            angle = j / count * math.tau
            radius = outline[j] * (profile + ledge + rand.uniform(-.055, .055))
            verts.append((math.cos(angle) * radius, math.sin(angle) * radius,
                          z + rand.uniform(-.035, .035) + math.cos(angle * 2 + variant) * .065))
    faces.append(tuple(reversed(range(count))))
    for layer in range(layers - 1):
        for j in range(count):
            a = layer * count + j
            b = layer * count + (j + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.append(tuple((layers - 1) * count + j for j in range(count)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(rock_mat)
    # Side strips follow bedding; caps have a separate planar UV island.
    uv = mesh.uv_layers.new()
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex = mesh.loops[loop_index].vertex_index
            layer, j = divmod(vertex, count)
            if len(poly.vertices) > 4:
                p = mesh.vertices[vertex].co
                uv.data[loop_index].uv = (.5 + p.x * .4, .5 + p.y * .4)
            else:
                start = (poly.index - 1) % count
                u = (j if not (start == count - 1 and j == 0) else count) / count
                uv.data[loop_index].uv = (u * 2, layer / (layers - 1))
        poly.use_smooth = True
    # Preserve broken ledges while smoothing the wind-worn faces between them.
    mesh.set_sharp_from_angle(angle=math.radians(38))
    return obj


rocks = [rock("MarsRock" + str(i), i) for i in range(3)]
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in rocks:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rocks[0]
export_props = bpy.ops.export_scene.gltf.get_rna_type().properties
formats = [i.identifier for i in export_props["export_format"].enum_items]
if not formats:
    # The glTF add-on exposes a context-dependent enum, absent from RNA.
    import re
    try:
        bpy.ops.export_scene.gltf(export_format="__discover__")
    except TypeError as error:
        formats = re.findall(r"'([^']+)'", str(error))
glb = next(value for value in formats if value.lower() == "glb")
bpy.ops.export_scene.gltf(filepath=str(ROOT / "public/models/mars-geology.glb"),
                          export_format=glb, use_selection=True, use_active_scene=True, export_materials=next(
                              i.identifier for i in export_props["export_materials"].enum_items
                              if i.identifier.lower() == "none"))
for i, obj in enumerate(rocks):
    obj.location = (i * 2.7 - 2.7, 0, .25)
    obj.scale = (1.25, 1.0, .65 if i != 1 else .9)

# A modest material study in Blender for inspecting relief and colour.
bpy.ops.mesh.primitive_grid_add(x_subdivisions=80, y_subdivisions=80, size=30)
ground = bpy.context.object
ground.name = "Regolith • material study"
ground.data.materials.append(ground_mat)
for v in ground.data.vertices:
    v.co.z = .09 * math.sin(v.co.x * .6) * math.cos(v.co.y * .4) - .08
for loop in ground.data.uv_layers.active.data:
    loop.uv *= 5
for poly in ground.data.polygons:
    poly.use_smooth = True
rand = random.Random(39)
for i in range(140):
    obj = bpy.data.objects.new("Gravel", rocks[i % 3].data)
    scene.collection.objects.link(obj)
    x, y = rand.uniform(-12, 12), rand.uniform(-10, 10)
    s = rand.uniform(.035, .23)
    obj.location = (x, y, .09 * math.sin(x * .6) * math.cos(y * .4) - .08 + s * .2)
    obj.scale = (s * 1.5, s, s * .65)
    obj.rotation_euler.z = rand.random() * math.tau
world = bpy.data.worlds.new("Mars • dusty sky")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs["Color"].default_value = (.48, .37, .30, 1)
bg.inputs["Strength"].default_value = .45
scene.world = world
light_type = next(i.identifier for i in bpy.types.Light.bl_rna.properties["type"].enum_items if i.identifier.lower() == "sun")
light = bpy.data.lights.new("Mars sunlight", light_type)
light.energy, light.angle = 2.2, .07
sun = bpy.data.objects.new("Mars sunlight", light)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(35), math.radians(-35), math.radians(-35))
cam = bpy.data.objects.new("Mars surface study camera", bpy.data.cameras.new("Mars surface study camera"))
scene.collection.objects.link(cam)
cam.location = (7, -11, 5)
cam.rotation_euler = (Vector((0, 0, .1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 48
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1200, 800
scene.render.resolution_percentage = 100
scene.render.filepath = str(ROOT / "blender/Mars/surface-study.png")
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_perspective = enum(area.spaces.active.region_3d, "view_perspective", "CAMERA")
        area.spaces.active.shading.type = enum(area.spaces.active.shading, "type", "RENDERED")
for image in (*ground_maps.values(), *rock_maps.values()):
    image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender/Mars/mars-surface-study.blend"), copy=True)
print("Mars assets exported:", [p.name for p in OUT.glob("*.png")])
print("Geometry:", [(o.name, len(o.data.polygons)) for o in rocks])
