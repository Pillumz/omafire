.pragma library
// Continuous anatomy shared by the encounter and renderer. Paws live in world
// space: planted feet do not follow the body, including on diagonal trails.
var HIPS = [-9, 9, -9, 9]; // far hind, far fore, near hind, near fore
var WALK = { stride: 16, stance: 0.70, lift: 4, offsets: [0.75, 0.5, 0.25, 0] };
var RUN = { stride: 22, stance: 0.38, lift: 6, offsets: [0.62, 0.07, 0.55, 0] };
function clamp(t) { return Math.max(0, Math.min(1, t)); }
function mix(a, b, t) { return a + (b - a) * t; }
function smooth(t) { t = clamp(t); return t * t * (3 - 2 * t); }
function unit(t) { return (t % 1 + 1) % 1; }
function moving(pose) { return pose === "walk" || pose === "run"; }
function gait(fox) { return fox.pose === "run" ? RUN : WALK; }
function phase(fox) { return unit(fox.gaitDistance / gait(fox).stride); }
function footAt(cycle, index, run) {
    var g = run ? RUN : WALK, p = unit(cycle + g.offsets[index] + (run ? 0.5 : 0));
    var span = g.stride * g.stance;
    if (p < g.stance) return [HIPS[index] + span / 2 - p * g.stride, 0];
    var s = (p - g.stance) / (1 - g.stance);
    return [HIPS[index] - span / 2 + smooth(s) * span, -Math.sin(s * Math.PI) * g.lift];
}
function pulse(age, period, offset, duration) {
    var t = unit((age - offset) / period) * period / duration;
    return t < 1 ? Math.pow(Math.sin(t * Math.PI), 2) : 0;
}
function create(fox) {
    var yaw = fox.direction > 0 ? 0 : Math.PI;
    var body = { seat: 0, run: 0, bob: 0, flex: 0, dip: 0, pitch: 0,
        yaw: yaw, headYaw: yaw, tailYaw: yaw, ear: 0, blink: 0, sway: 0 };
    var feet = [];
    for (var i = 0; i < 4; i++) {
        var p = footAt(0, i, false), x = fox.x + p[0] * fox.direction;
        var y = fox.y + p[1] + (i < 2 ? -1 : 0);
        feet.push({ x: x, y: y, standX: x, standY: y, mode: "plant" });
    }
    return { body: body, from: body, feet: feet, version: 0 };
}
function begin(fox, previousPose) {
    var r = fox.rig;
    r.from = r.body;
    r.blend = previousPose === fox.pose && moving(fox.pose) ? 0 : fox.pose === "alert" ? 0.12 : 0.28;
    r.turnGoal = fox.direction > 0 ? Math.PI : 0;
    r.startSeat = r.body.seat;
    for (var i = 0; i < 4; i++) {
        var f = r.feet[i];
        if (fox.pose === "turn") {
            f.fromX = f.x; f.fromY = f.y;
            var run = fox.fleeing, cycle = unit(fox.gaitDistance / (run ? RUN.stride : WALK.stride));
            f.toX = fox.x + (Math.cos(r.turnGoal) > 0 ? 1 : -1) * footAt(cycle, i, run)[0];
            f.toY = fox.y + (i < 2 ? -1 : 0);
            f.pivotY = f.mode === "swing" || f.mode === "landing" ? f.toY : f.y;
            f.mode = "turn";
        } else if (!moving(fox.pose) && f.mode === "swing") {
            // Finish an airborne recovery step instead of teleporting its paw
            // into the standing plate when the body comes to rest.
            f.fromX = f.x; f.fromY = f.y;
            f.toX = f.x + fox.direction * 0.8;
            f.toY = fox.y + (i < 2 ? -1 : 0);
            f.landingAge = 0;
            f.mode = "landing";
        }
    }
    update(fox, 0);
}
function sniffDip(fox) {
    var knots = fox.action.sniff;
    for (var i = 1; i < knots.length; i++) {
        var a = knots[i - 1], b = knots[i];
        if (fox.poseAge <= b.at)
            return mix(a.dip, b.dip, smooth((fox.poseAge - a.at) / (b.at - a.at)));
    }
    return 0;
}
function targetBody(fox) {
    var r = fox.rig, cycle = phase(fox), wave = cycle * Math.PI * 2;
    var run = fox.pose === "run" ? 1 : 0, travel = moving(fox.pose);
    var progress = fox.action.duration > 0 ? clamp(fox.poseAge / fox.action.duration) : 1;
    var seat = fox.pose === "sit" ? 1 : fox.pose === "settle"
        ? mix(r.startSeat, 1, smooth(progress)) : fox.pose === "rise"
        ? mix(r.startSeat, 0, smooth(progress)) : 0;
    var dip = fox.pose === "sniff" ? sniffDip(fox) : 0;
    var bob = travel ? -0.4 + Math.cos(wave * 2) * 0.4 : Math.sin(fox.age * 1.65) * 0.22;
    if (run) bob = -1.1 - Math.max(0, Math.sin(wave - 0.3)) * 1.8;
    var yaw = fox.direction > 0 ? 0 : Math.PI, headYaw = yaw;
    if (fox.pose === "turn") {
        yaw = mix(r.from.yaw, r.turnGoal, smooth(progress));
        headYaw = mix(r.from.headYaw, r.turnGoal, smooth(progress * 1.35));
    }
    return { seat: seat, run: run, bob: bob, flex: run * Math.sin(wave) * 1.3,
        dip: dip, pitch: dip * 0.38 - (fox.pose === "alert" ? 0.1 : 0),
        yaw: yaw, headYaw: headYaw,
        // Ears and blinks have their own quiet clock, not a twitch every step.
        ear: pulse(fox.age, 6.7, 1.8 + fox.entry * 0.13, 0.42) * 1.2,
        blink: pulse(fox.age, 4.9, 2.3 + fox.entry * 0.17, 0.17),
        sway: Math.sin(fox.age * 1.65 - 0.8) };
}
// Predict a recovery step along the actual connected trail, not a tangent
// that can overshoot a bend or a stopping point.
function groundAhead(fox, ahead) {
    var x = fox.x, y = fox.y, horizontal = 1;
    var motion = fox.motion;
    for (var i = motion.index; i < motion.points.length; i++) {
        var target = motion.points[i], dx = target.x - x, dy = target.y - y;
        var length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            horizontal = Math.abs(dx) / length;
            if (ahead <= length) return { x: x + dx * ahead / length,
                y: y + dy * ahead / length, horizontal: horizontal };
            ahead -= length;
        }
        x = target.x; y = target.y;
    }
    return { x: x, y: y, horizontal: horizontal };
}
function updateFeet(fox, dt) {
    var r = fox.rig, g = gait(fox), cycle = phase(fox), isMoving = moving(fox.pose);
    var progress = fox.action.duration > 0 ? clamp(fox.poseAge / fox.action.duration) : 1;
    var delays = [0.66, 0.02, 0.20, 0.48];
    for (var i = 0; i < 4; i++) {
        var f = r.feet[i], side = i < 2 ? -1 : 0;
        if (fox.pose === "turn") {
            // Two diagonal support pairs trade places. An incoming recovery
            // lands first; the turn never becomes an unsupported four-paw hop.
            var t = clamp((progress - delays[i]) / 0.32), u = smooth(t);
            var plantedY = mix(f.fromY, f.pivotY, smooth(progress / Math.min(delays[i], 0.12)));
            f.x = mix(f.fromX, f.toX, u);
            f.y = mix(plantedY, f.toY, u) - Math.sin(t * Math.PI) * 3.5;
            f.standX = f.x; f.standY = f.y;
            continue;
        }
        if (isMoving) {
            var p = unit(cycle + g.offsets[i] + (fox.pose === "run" ? 0.5 : 0));
            if (p < g.stance) {
                if (f.mode === "swing") { f.x = f.toX; f.y = f.toY; }
                f.mode = "plant";
                f.standX = f.x; f.standY = f.y;
            } else {
                if (f.mode !== "swing") {
                    f.fromX = f.x; f.fromY = f.y; f.startPhase = p;
                    var ahead = groundAhead(fox, (1 - p) * g.stride);
                    f.toX = ahead.x + fox.direction * (HIPS[i] + g.stride * g.stance / 2 * ahead.horizontal);
                    f.toY = ahead.y + side;
                    f.mode = "swing";
                }
                var s = clamp((p - f.startPhase) / (1 - f.startPhase)), w = smooth(s);
                f.x = mix(f.fromX, f.toX, w);
                f.y = mix(f.fromY, f.toY, w) - Math.sin(s * Math.PI) * g.lift;
            }
        } else if (f.mode === "landing") {
            f.landingAge += dt;
            var land = clamp(f.landingAge / 0.18), eased = smooth(land);
            f.x = mix(f.fromX, f.toX, eased);
            f.y = mix(f.fromY, f.toY, eased) - Math.sin(land * Math.PI);
            if (land >= 1) { f.mode = "plant"; f.standX = f.x; f.standY = f.y; }
        } else if (i % 2 === 0 && (r.body.seat > 0 || fox.pose === "rise")) {
            // The haunch lowers over the rear paws; forepaws keep their anchors.
            f.x = mix(f.standX, fox.x + fox.direction * (i === 2 ? -4 : -6), r.body.seat);
            f.y = mix(f.standY, fox.y + side, r.body.seat) - Math.sin(r.body.seat * Math.PI);
        }
    }
}
function update(fox, dt) {
    var r = fox.rig, target = targetBody(fox);
    var weight = r.blend ? smooth(fox.poseAge / r.blend) : 1, body = {};
    for (var key in target) body[key] = mix(r.from[key], target[key], weight);
    // Progress actions must arrive exactly, and can reverse from the actual
    // visible angle/seat rather than jumping to a nominal sprite frame.
    if (fox.pose === "turn") { body.yaw = target.yaw; body.headYaw = target.headYaw; }
    if (fox.pose === "settle" || fox.pose === "rise") body.seat = target.seat;
    body.tailYaw = mix(r.body.tailYaw, body.yaw, 1 - Math.exp(-dt / 0.16));
    r.body = body;
    updateFeet(fox, dt);
    r.version++;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { create: create, begin: begin, update: update, phase: phase,
        footAt: footAt, WALK: WALK, RUN: RUN };
}
