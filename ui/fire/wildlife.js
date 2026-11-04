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

// One unhurried visit, not a bag of random actions. Turns retain the old
// facing until their last frame; settle/rise/turn use nonlooping progress.
var STAGES = {
    approach: { pose: "walk", duration: 8, next: "listen" },
    listen: { pose: "idle", duration: 2.5, next: "sniff" },
    sniff: { pose: "sniff", duration: 3, next: "settle" },
    settle: { pose: "settle", duration: 0.8, next: "sit" },
    sit: { pose: "sit", duration: 5, next: "rise" },
    rise: { pose: "rise", duration: 0.7, next: "turn" },
    turn: { pose: "turn", duration: 0.65, next: "retreat" },
    retreat: { pose: "walk", duration: 8 },
    startle: { pose: "alert", duration: 0.22, next: "escapeTurn" },
    escapeTurn: { pose: "turn", duration: 0.3, next: "run" },
    run: { pose: "run" }
};

// Preview entry point; replaces any existing encounter without touching RNG.
// x,y is the centre of the feet, not the sprite's top-left; artwork faces
// right. Moving phase follows feet distance; stationary cycles loop [0,1).
function startVisit(state) {
    state.wait = 0;
    state.fox = {
        x: 332, y: 176, direction: -1, pose: "walk",
        age: 0, poseAge: 0, phase: 0, distance: 0,
        stage: "approach", startX: 332, fleeing: false
    };
}

function enterStage(fox, stage) {
    fox.stage = stage;
    fox.poseAge = 0;
    fox.phase = 0;
    fox.pose = STAGES[stage].pose;
    fox.startX = fox.x;
}

// Clicks near the body startle, including while the fox is leaving. Repeated
// clicks throughout anticipation, turning and flight cannot delay escape.
function spook(state, x, y) {
    var fox = state.fox;
    if (!fox) return false;
    var dx = x - fox.x, dy = y - (fox.y - 12);
    if (!(dx * dx + dy * dy <= 24 * 24)) return false;
    if (!fox.fleeing) {
        fox.fleeing = true;
        enterStage(fox, "startle");
    }
    return true;
}

function ease(t) {
    return t * t * (3 - 2 * t);
}

// Accelerate for .6s, then keep running at 28.8px/s. Position is analytic,
// so both gait and speed are independent of the caller's frame size.
function runDistance(t) {
    return t < 0.6 ? 24 * t * t : 8.64 + 28.8 * (t - 0.6);
}

function runDuration(distance) {
    return distance < 8.64 ? Math.sqrt(distance / 24)
        : 0.6 + (distance - 8.64) / 28.8;
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
        if (state.wait > 0) return;
        dt = -state.wait;
        startVisit(state);
    }

    var fox = state.fox;
    while (dt > 0) {
        var stage = fox.stage;
        var spec = STAGES[stage];
        var duration = stage === "run" ? runDuration(332 - fox.startX) : spec.duration;
        var step = Math.min(dt, Math.max(0, duration - fox.poseAge));
        var oldX = fox.x;
        fox.poseAge = Math.min(duration, fox.poseAge + step);
        fox.age += step;
        var progress = duration > 0 ? fox.poseAge / duration : 1;
        if (stage === "approach") fox.x = 332 - 72 * ease(progress);
        else if (stage === "retreat") fox.x = 260 + 72 * ease(progress);
        else if (stage === "run") fox.x = Math.min(332, fox.startX + runDistance(fox.poseAge));
        fox.y = 176 + (332 - fox.x) / 36;
        fox.distance += Math.abs(fox.x - oldX);
        // Feet stop with the body at the end of each eased walk. Breathing
        // and sniffing are time cycles; posture changes finish exactly once.
        fox.phase = fox.pose === "walk" || fox.pose === "run"
            ? (fox.distance / (fox.pose === "run" ? 22 : 16)) % 1
            : fox.pose === "turn" || fox.pose === "settle" || fox.pose === "rise"
            ? progress : (fox.poseAge / (fox.pose === "sniff" ? 1.2 : 2.4)) % 1;
        dt -= step;
        if (fox.poseAge < duration) break;
        if (stage === "retreat" || stage === "run") {
            dismiss(state);
            // Bank any remainder toward the next quiet interval as well.
            state.wait -= dt;
            return;
        }
        if (fox.pose === "turn") fox.direction = 1;
        // A fox already heading toward cover need not turn around again.
        enterStage(fox, stage === "startle" && fox.direction === 1 ? "run" : spec.next);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        create: create, advance: advance, startVisit: startVisit, spook: spook
    };
}
