"""Astronauta V2 — utilidades de rigging."""
import math
import bpy
from mathutils import Vector, Matrix


def create_bone(eb_coll, name, head, tail, parent=None, connect=False, roll=0.0, deform=False):
    b = eb_coll.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.roll = roll
    b.use_deform = deform
    if parent is not None:
        b.parent = eb_coll[parent] if isinstance(parent, str) else parent
        b.use_connect = connect
    return b


def bone_tail_matrix(arm_obj, bone_name, posed=False):
    pb = arm_obj.pose.bones[bone_name]
    m = pb.matrix if posed else arm_obj.data.bones[bone_name].matrix_local
    return arm_obj.matrix_world @ m @ Matrix.Translation((0, arm_obj.data.bones[bone_name].length, 0))


def parent_to_bone(obj, arm_obj, bone_name):
    """Emparenta un objeto rígido a un hueso conservando su transformación mundial (pose de reposo)."""
    mw = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = 'BONE'
    obj.parent_bone = bone_name
    obj.matrix_parent_inverse = bone_tail_matrix(arm_obj, bone_name).inverted()
    obj.matrix_world = mw
    return obj


def add_ik(arm_obj, bone_name, target, pole, chain=2):
    pb = arm_obj.pose.bones[bone_name]
    for c in list(pb.constraints):
        pb.constraints.remove(c)
    c = pb.constraints.new('IK')
    c.target = target
    c.pole_target = pole
    c.chain_count = chain
    return c


def pose_error(arm_obj, names):
    bpy.context.view_layer.update()
    err = 0.0
    for n in names:
        a = arm_obj.pose.bones[n].matrix
        b = arm_obj.data.bones[n].matrix_local
        err += sum(abs(a[i][j] - b[i][j]) for i in range(3) for j in range(4))
    return err


def best_pole_angle(arm_obj, ik, names):
    """Prueba ángulos de polo y elige el que deja la cadena en su pose de reposo."""
    best = (1e9, 0.0)
    for deg in range(-180, 181, 5):
        ik.pole_angle = math.radians(deg)
        e = pose_error(arm_obj, names)
        if e < best[0]:
            best = (e, math.radians(deg))
    # refinamiento
    lo = best[1]
    for d in [lo + math.radians(x * 0.25) for x in range(-20, 21)]:
        ik.pole_angle = d
        e = pose_error(arm_obj, names)
        if e < best[0]:
            best = (e, d)
    ik.pole_angle = best[1]
    return best


def add_child_of(arm_obj, bone_name, target):
    pb = arm_obj.pose.bones[bone_name]
    for c in list(pb.constraints):
        if c.type == 'CHILD_OF':
            pb.constraints.remove(c)
    c = pb.constraints.new('CHILD_OF')
    c.target = target
    c.inverse_matrix = target.matrix_world.inverted()
    return c
