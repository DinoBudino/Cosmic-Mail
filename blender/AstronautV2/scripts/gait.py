"""
Authored locomotion cycles for the web astronaut (Walk, Run).

The retargeted Walk/Run of the previous astronaut barely bent the knees and
never moved the hips, so the V2 character looked stiff. These cycles are
built directly on the V2 rig as a light "Mars lope": in 0.38 g a walk turns
into a springy gait with a short float between steps.

What each cycle moves:
- legs: thigh swing, knee bend that peaks while the leg passes under the
  body, heel strike and toe-off on the foot (the foot keeps its own angle to
  the ground instead of inheriting the leg's);
- hips: they sit as low as the planted foot allows (so the body bobs from
  the real leg geometry), plus a small float after each push, a yaw toward
  the leading leg and a slight roll;
- torso: forward lean, twist against the hips, a little breathing of the
  shoulders;
- arms: swing against the opposite leg with the elbow bending forward;
- head: steadies the twist and the bob so the helmet does not wobble.

Armature space of the V2 rig: X is the character's left, -Y is forward,
Z is up. Each bone's rotation is composed as D_bone = D_parent @ R_local
(R_local about armature axes, as if from rest), then applied over the rest
orientation. That keeps the angles readable in degrees.
"""

import math

from mathutils import Matrix, Quaternion, Vector

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


def rot(axis, degrees):
    return Quaternion(axis, math.radians(degrees))


def forward(degrees):
    """Swing a downward limb forward (its tip toward -Y)."""
    return rot(X, -degrees)


def periodic(keys, p):
    """Periodic Catmull-Rom through (phase, value) keys.

    Keys are sorted by phase, the first one at 0.0; the curve wraps at 1.
    """
    p %= 1.0
    n = len(keys)
    for i in range(n):
        p0, v0 = keys[i]
        p1 = keys[i + 1][0] if i + 1 < n else 1.0
        if p0 <= p < p1:
            t = (p - p0) / (p1 - p0)
            vm = keys[(i - 1) % n][1]
            v1 = keys[(i + 1) % n][1]
            vp = keys[(i + 2) % n][1]
            t2, t3 = t * t, t * t * t
            return 0.5 * (
                2 * v0
                + (-vm + v1) * t
                + (2 * vm - 5 * v0 + 4 * v1 - vp) * t2
                + (-vm + 3 * v0 - 3 * v1 + vp) * t3
            )
    return keys[0][1]


# Leg phase 0 = heel strike in front. Values in degrees.
WALK = {
    'frames': 18,
    'thigh': [(0.0, 30), (0.14, 20), (0.32, 0), (0.52, -24), (0.62, -18),
              (0.78, 12), (0.92, 33)],
    'knee': [(0.0, 6), (0.12, 20), (0.3, 8), (0.5, 18), (0.64, 55),
             (0.76, 62), (0.9, 22)],
    # Foot angle to the ground: + toes up (heel strike), - heel up.
    'foot': [(0.0, 14), (0.12, 0), (0.42, -6), (0.56, -26), (0.7, -4),
             (0.9, 12)],
    'float': 0.018, 'lean': 5, 'hip_yaw': 7, 'hip_roll': 3, 'twist': 9,
    'arm': 24, 'elbow': 22, 'elbow_swing': 18, 'arm_out': 4, 'head_bob': 3,
}
RUN = {
    'frames': 15,
    'thigh': [(0.0, 40), (0.12, 26), (0.3, -2), (0.46, -32), (0.58, -22),
              (0.74, 22), (0.9, 46)],
    'knee': [(0.0, 12), (0.1, 30), (0.28, 14), (0.44, 26), (0.6, 92),
             (0.74, 100), (0.88, 38)],
    'foot': [(0.0, 10), (0.1, 0), (0.36, -10), (0.48, -32), (0.64, -10),
             (0.88, 8)],
    'float': 0.055, 'lean': 11, 'hip_yaw': 9, 'hip_roll': 4, 'twist': 14,
    'arm': 34, 'elbow': 58, 'elbow_swing': 14, 'arm_out': 9, 'head_bob': 5,
}

LEGS = {'L': 0.0, 'R': 0.5}
ARMS = {'L': 0.5, 'R': 0.0}  # each arm swings with the opposite leg


def local_rotations(cfg, phi):
    """R_local per bone (armature axes) and the absolute foot angles."""
    w = 2 * math.pi * phi
    out = {}
    # Hips yaw toward the leading leg (left leg leads at phi = 0), roll down
    # on the swinging side, and the torso twists back against them.
    out['PELVIS'] = (
        rot(Z, -cfg['hip_yaw'] * math.cos(w))
        @ rot(Y, cfg['hip_roll'] * math.sin(w))
    )
    out['SPINE_01'] = (
        rot(X, cfg['lean'] * 0.5)
        @ rot(Z, cfg['twist'] * 0.45 * math.cos(w))
    )
    out['SPINE_02'] = (
        rot(X, cfg['lean'] * 0.5 + 1.5 * math.cos(2 * w))
        @ rot(Z, cfg['twist'] * 0.55 * math.cos(w))
    )
    # The head keeps looking ahead: it undoes most of the twist and lean.
    out['NECK'] = rot(Z, (cfg['hip_yaw'] - cfg['twist']) * math.cos(w))
    out['HEAD'] = rot(X, -cfg['lean'] * 0.6 - cfg['head_bob'] * math.cos(2 * w))
    feet = {}
    for side, offset in LEGS.items():
        p = phi + offset
        out['THIGH_' + side] = forward(periodic(cfg['thigh'], p))
        out['SHIN_' + side] = forward(-periodic(cfg['knee'], p))
        feet['FOOT_' + side] = periodic(cfg['foot'], p)
    for side, offset in ARMS.items():
        p = phi + offset
        swing = math.sin(2 * math.pi * p + math.pi / 2)  # +1 = arm forward
        out_sign = 1 if side == 'L' else -1
        out['CLAVICLE_' + side] = rot(X, 2.5 * swing)
        out['UPPER_ARM_' + side] = (
            rot(Y, -out_sign * cfg['arm_out'])
            @ forward(cfg['arm'] * swing)
        )
        out['FOREARM_' + side] = forward(
            cfg['elbow'] + cfg['elbow_swing'] * max(0.0, swing)
        )
        out['HAND_' + side] = forward(-6 * swing)
    return out, feet


def build_cycle(rig, tgt_order, rest_relative, sole_height, rest_sole,
                name, cfg, log):
    """Bake one authored cycle as a new action on `rig` (frames 1..N+1)."""
    import bpy

    bones = rig.data.bones
    rest_rot = {b.name: b.matrix_local.to_quaternion() for b in bones}
    frames = cfg['frames']

    def pose_at(phi, lift):
        local, feet = local_rotations(cfg, phi)
        pose, delta, basis = {}, {}, {}
        for bone in tgt_order:
            parent_pose = pose[bone.parent.name] if bone.parent else Matrix.Identity(4)
            parent_delta = delta[bone.parent.name] if bone.parent else Quaternion()
            rest_pose = parent_pose @ rest_relative(bone)
            head = rest_pose.translation.copy()
            if bone.name == 'PELVIS':
                head += Vector((0, 0, lift))
            if bone.name in feet:
                # Absolute angle to the ground, plus the hips' yaw only.
                d = delta['PELVIS'].to_euler('XYZ')
                d = rot(Z, math.degrees(d.z)) @ rot(X, -feet[bone.name])
            else:
                d = parent_delta @ local.get(bone.name, Quaternion())
            delta[bone.name] = d
            desired = Matrix.LocRotScale(head, d @ rest_rot[bone.name], None)
            pose[bone.name] = desired
            basis[bone.name] = rest_pose.inverted() @ desired
        return pose, basis

    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data.action = action
    previous = {}
    lifts = []
    for i in range(frames + 1):
        phi = (i % frames) / frames
        pose, _ = pose_at(phi, 0.0)
        # Planted foot on the ground: the body bobs from the legs' shape...
        lift = rest_sole - sole_height(pose)
        # ...plus a short float after each push (twice per cycle).
        lift += cfg['float'] * max(0.0, math.sin(4 * math.pi * (phi - 0.36))) ** 2
        lifts.append(lift)
        pose, basis = pose_at(phi, lift)
        for bone in tgt_order:
            pb = rig.pose.bones[bone.name]
            if bone.name.startswith('ThrusterSocket'):
                continue
            quat = basis[bone.name].to_quaternion()
            if bone.name in previous:
                quat.make_compatible(previous[bone.name])
            previous[bone.name] = quat
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = quat
            pb.location = basis[bone.name].translation
            pb.keyframe_insert('rotation_quaternion', frame=i + 1, group=bone.name)
            pb.keyframe_insert('location', frame=i + 1, group=bone.name)
    log('authored', name, frames, 'frames, hip bob',
        round(max(lifts) - min(lifts), 3))
    return action
