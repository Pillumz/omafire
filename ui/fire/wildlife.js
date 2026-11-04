.pragma library
// Quiet, infrequent visitors. All times are seconds; coordinates are in the
// 360x240 scene. This module owns its RNG, independently of the fire.
function random(state) {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 4294967296;
}

function create(seed) {
    var state = { seed: seed >>> 0, fox: null, wait: 0 };
    state.wait = 45 + random(state) * 55;
    return state;
}

function dismiss(state) {
    state.fox = null;
    state.wait = 150 + random(state) * 210;
}

// Preview entry point; replaces any existing encounter without touching RNG.
// x,y is the centre of the feet, not the sprite's top-left. A roughly 40x24
// sprite occupies x-20..x+20, y-24..y; its unmirrored artwork faces right.
// phase is a looping [0,1) visual cycle (four frames: floor(phase * 4)).
function startVisit(state) {
    state.wait = 0;
    state.fox = {
        x: 332, y: 176, direction: -1, pose: "walk",
        age: 0, poseAge: 0, phase: 0, distance: 0, stage: 0
    };
}

function enterStage(fox, stage) {
    fox.stage = stage;
    fox.poseAge = 0;
    fox.phase = 0;
    fox.pose = stage === 1 ? "idle" : stage === 2 ? "sniff"
        : stage === 3 || stage === 5 ? "alert"
        : stage === 6 ? "run" : "walk";
    fox.direction = stage >= 4 ? 1 : -1;
}

// Clicks near the body startle, including while the fox is leaving. Repeated
// clicks during flight do not reset the alert or delay escape.
function spook(state, x, y) {
    var fox = state.fox;
    if (!fox) return false;
    var dx = x - fox.x, dy = y - (fox.y - 12);
    if (!(dx * dx + dy * dy <= 24 * 24)) return false;
    if (fox.stage < 5) enterStage(fox, 5);
    return true;
}

// Call only while animating. A >1s gap means suspended/hidden time: discard
// the encounter and reschedule, never catch up with a burst of visits.
// Smaller slices consume actual seconds, including across pose boundaries.
function advance(state, dt) {
    if (!(dt > 0)) return;
    if (dt > 1) {
        dismiss(state);
        return;
    }
    if (!state.fox) {
        state.wait -= dt;
        if (state.wait <= 0) startVisit(state);
        return;
    }

    var fox = state.fox;
    while (dt > 0) {
        var stage = fox.stage;
        // Walk in 8s, idle 3s, sniff 4s, listen 3s, walk home 8s.
        // Startle turns immediately, listens .35s, then runs at 17px/s
        // (4s from the furthest point). No route ever goes left of x264.
        var duration = stage === 0 || stage === 4 ? 8
            : stage === 1 || stage === 3 ? 3
            : stage === 2 ? 4 : stage === 5 ? 0.35
            : fox.poseAge + (332 - fox.x) / 17;
        var step = Math.min(dt, Math.max(0, duration - fox.poseAge));
        var oldX = fox.x;
        fox.poseAge += step;
        fox.age += step;
        if (stage === 0) fox.x = Math.max(264, 332 - 8.5 * fox.poseAge);
        else if (stage === 4) fox.x = Math.min(332, 264 + 8.5 * fox.poseAge);
        else if (stage === 6) fox.x = Math.min(332, fox.x + 17 * step);
        fox.y = 176 + (332 - fox.x) / 68;
        fox.distance += Math.abs(fox.x - oldX);
        // Gait follows distance, so legs stop when the body stops. Stationary
        // poses get a slower time cycle for breathing, sniffing and listening.
        fox.phase = stage === 0 || stage === 4 || stage === 6
            ? (fox.distance / (stage === 6 ? 22 : 16)) % 1
            : (fox.poseAge / (stage === 2 ? 1.2 : 2.4)) % 1;
        dt -= step;
        if (fox.poseAge < duration) break;
        if (stage === 4 || stage === 6) {
            dismiss(state);
            return;
        }
        enterStage(fox, stage === 5 ? 6 : stage + 1);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        create: create, advance: advance, startVisit: startVisit, spook: spook
    };
}
