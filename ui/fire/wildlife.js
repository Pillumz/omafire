.pragma library
// Quiet visitors, with a private random stream and a small map of dry ground.
// Coordinates are feet positions in the 360x240 scene; times are seconds.
function random(state) {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 4294967296;
}
function between(state, low, high) { return low + random(state) * (high - low); }
function pick(state, values) { return values[Math.floor(random(state) * values.length)]; }
function create(seed) {
    var state = { seed: seed >>> 0, fox: null, wait: 0, lastEntry: -1 };
    state.wait = between(state, 45, 100);
    return state;
}
function dismiss(state) {
    state.fox = null;
    state.wait = between(state, 150, 360);
}

// Paths go AROUND the hearth, never through the fire or across the lake.
// The three mouths are beyond the whole sprite, so departures cannot pop.
// Only the upper-right trail passes behind the painted boulder.
var GROUND = [
    { x: -44, y: 186, links: [1] }, // left trail, above the foreground rocks
    { x: 76, y: 187, links: [0, 7] }, // scents below the woodpile
    { x: 170, y: 225, links: [7, 3] }, // foreground clearing
    { x: 284, y: 208, links: [2, 4, 6] }, // trail fork, above the lower-right rock
    { x: 255, y: 182, links: [3, 5] }, // quiet side of the hearth
    { x: 404, y: 176, links: [4] }, // behind the right boulder
    { x: 404, y: 208, links: [3] }, // right foreground trail
    { x: 120, y: 219, links: [1, 2] } // bend between the left rocks and hearth
];
var COVERS = [0, 5, 6];
var INTERESTS = [1, 2, 3, 4, 7];
function distance(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}
// The ground links form a tree: each pair has one safe connecting trail.
function path(from, to, previous) {
    if (from === to) return [];
    var links = GROUND[from].links;
    for (var i = 0; i < links.length; i++) {
        if (links[i] === previous) continue;
        var rest = path(links[i], to, from);
        if (rest) return [links[i]].concat(rest);
    }
    return null;
}
function pause(plan, pose, duration) { plan.push({ pose: pose, duration: duration }); }
function travel(plan, from, to, speed) {
    var route = path(from, to, -1);
    for (var i = 0; i < route.length; i++) plan.push({ pose: "walk", node: route[i], speed: speed });
    return to;
}

// Pick an intention, not independent random poses every frame. A scent trail
// has little investigations and backtracking; a passer-by needn't sit at all.
// Randomness is consumed only while planning, never at a frame-rate boundary.
function startVisit(state) {
    var entrances = COVERS.filter(function(n) { return n !== state.lastEntry; });
    var entry = pick(state, entrances), node = GROUND[entry].links[0];
    state.lastEntry = entry;
    var mood = pick(state, ["passing", "foraging", "lingering", "wary"]);
    var speed = between(state, 11, 16), plan = [];
    travel(plan, entry, node, speed);
    if (mood !== "passing" || random(state) < 0.35)
        pause(plan, "idle", between(state, 1.2, 3.5));
    var stops = mood === "passing" ? 0 : mood === "foraging" ? 3 + Math.floor(random(state) * 3)
        : mood === "wary" ? 1 : 2;
    for (var i = 0; i < stops; i++) {
        if (i > 0) {
            var nearby = GROUND[node].links.filter(function(n) { return INTERESTS.indexOf(n) >= 0; });
            node = travel(plan, node, pick(state, nearby), speed);
        }
        if (mood === "foraging" || random(state) < 0.55)
            pause(plan, "sniff", (1 + Math.floor(random(state) * 3)) * 1.5);
        pause(plan, mood === "wary" || random(state) < 0.35 ? "alert" : "idle", between(state, 1, 3.5));
        if (mood === "lingering" && i === stops - 1) {
            pause(plan, "settle", 0.8);
            pause(plan, "sit", between(state, 5, 12));
            pause(plan, "rise", 0.7);
        }
    }
    var exit = mood === "wary" || (mood !== "passing" && random(state) < 0.3) ? entry
        : pick(state, COVERS.filter(function(n) { return n !== entry; }));
    travel(plan, node, exit, speed);
    state.wait = 0;
    state.fox = {
        x: GROUND[entry].x, y: GROUND[entry].y, node: entry,
        direction: entry === 0 ? 1 : -1, pose: "walk",
        age: 0, poseAge: 0, phase: 0, gaitDistance: 0, runAge: 0,
        fleeing: false, mood: mood, entry: entry, exit: exit,
        plan: plan, action: null
    };
    nextAction(state.fox);
}
function begin(fox, action) {
    fox.action = action;
    fox.pose = action.pose;
    fox.poseAge = 0;
    fox.phase = action.pose === "walk" || action.pose === "run"
        ? gaitPhase(fox) : action.startPhase || 0;
    fox.startX = fox.x; fox.startY = fox.y;
    if (action.node !== undefined) {
        var length = distance(fox, GROUND[action.node]);
        action.length = length;
        action.duration = fox.fleeing
            ? runDuration(runDistance(fox.runAge) + length) - fox.runAge
            : Math.max(0.1, length * 1.5 / action.speed);
    }
}
function nextAction(fox) {
    var action = fox.plan[0];
    if (!action) return false;
    if (action.node !== undefined) {
        var direction = GROUND[action.node].x < fox.x ? -1 : 1;
        if (direction !== fox.direction) {
            begin(fox, { pose: "turn", duration: fox.fleeing ? 0.3 : 0.65 });
            return true;
        }
    }
    fox.plan.shift();
    begin(fox, action);
    return true;
}
// Sprite paws travel horizontally, not along the route's diagonal length.
function gaitPhase(fox) { return (fox.gaitDistance / (fox.pose === "run" ? 22 : 16)) % 1; }
function ease(t) { return t * t * (3 - 2 * t); }
function runDistance(t) { return t < 0.6 ? 24 * t * t : 8.64 + 28.8 * (t - 0.6); }
function runDuration(d) { return d < 8.64 ? Math.sqrt(d / 24) : 0.6 + (d - 8.64) / 28.8; }

// Escape via the nearest connected cover, not a straight line through the
// hearth. Mid-walk the fox can use either end of its current ground segment.
function escapeRoute(fox) {
    var ends = [fox.node];
    if (fox.action.node !== undefined) ends.push(fox.action.node);
    var best = null, bestLength = Infinity;
    for (var i = 0; i < ends.length; i++) for (var c = 0; c < COVERS.length; c++) {
        var route = [ends[i]].concat(path(ends[i], COVERS[c], -1));
        var length = distance(fox, GROUND[route[0]]);
        for (var j = 1; j < route.length; j++) length += distance(GROUND[route[j-1]], GROUND[route[j]]);
        if (length < bestLength) { bestLength = length; best = route; }
    }
    return best;
}

// Repeated clicks never restart anticipation or postpone escape. Preserve a
// partially completed rise/turn rather than popping into a standing flank.
function spook(state, x, y) {
    var fox = state.fox;
    if (!fox) return false;
    var dx = x - fox.x, dy = y - (fox.y - 12);
    if (!(dx * dx + dy * dy <= 24 * 24)) return false;
    if (fox.fleeing) return true;
    var route = escapeRoute(fox), plan = [];
    fox.exit = route[route.length - 1];
    // Skip a waypoint already under the paws (and its meaningless turn).
    if (distance(fox, GROUND[route[0]]) < 0.01) route.shift();
    var seat = fox.pose === "sit" ? 1 : fox.pose === "settle" ? fox.phase
        : fox.pose === "rise" ? 1 - fox.phase : 0;
    if (seat > 0) plan.push({ pose: "rise", duration: 0.25 * seat, startPhase: 1 - seat });
    if (fox.pose === "turn") {
        var phase = fox.phase;
        var direction = route.length && GROUND[route[0]].x < fox.x ? -1 : 1;
        // Reverse an interrupted turn if the nearer exit is on the old side.
        if (direction === fox.direction) { fox.direction *= -1; phase = 1 - phase; }
        plan.push({ pose: "turn", duration: Math.max(0.01, 0.3 * (1 - phase)), startPhase: phase });
    } else pause(plan, "alert", 0.22);
    for (var i = 0; i < route.length; i++) plan.push({ pose: "run", node: route[i] });
    fox.fleeing = true;
    fox.plan = plan;
    nextAction(fox);
    return true;
}

// Hidden/suspended time never catches up with a burst of visitors. Small
// slices consume actual seconds across actions; the gait follows distance.
function advance(state, dt) {
    if (!(dt > 0)) return;
    if (dt > 1) { dismiss(state); return; }
    if (!state.fox) {
        state.wait -= dt;
        if (state.wait > 0) return;
        dt = -state.wait;
        startVisit(state);
    }
    var fox = state.fox;
    while (dt > 0) {
        var action = fox.action, duration = action.duration;
        var step = Math.min(dt, Math.max(0, duration - fox.poseAge));
        var oldX = fox.x;
        fox.poseAge = Math.min(duration, fox.poseAge + step);
        fox.age += step;
        var progress = duration > 0 ? fox.poseAge / duration : 1;
        if (action.node !== undefined) {
            var fraction = fox.fleeing
                ? (runDistance(fox.runAge + fox.poseAge) - runDistance(fox.runAge)) / action.length
                : ease(progress);
            fraction = Math.min(1, fraction);
            var target = GROUND[action.node];
            fox.x = fox.startX + (target.x - fox.startX) * fraction;
            fox.y = fox.startY + (target.y - fox.startY) * fraction;
        }
        fox.gaitDistance += Math.abs(fox.x - oldX);
        fox.phase = fox.pose === "walk" || fox.pose === "run"
            ? gaitPhase(fox)
            : fox.pose === "turn" || fox.pose === "settle" || fox.pose === "rise"
            ? (action.startPhase || 0) + (1 - (action.startPhase || 0)) * progress
            : (fox.poseAge / (fox.pose === "sniff" ? 1.5 : 2.4)) % 1;
        dt -= step;
        if (fox.poseAge < duration) break;
        if (fox.pose === "turn") fox.direction *= -1;
        if (action.node !== undefined) {
            fox.node = action.node;
            if (fox.fleeing) fox.runAge += duration;
        }
        if (!nextAction(fox)) {
            dismiss(state);
            state.wait -= dt;
            return;
        }
    }
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { create: create, advance: advance, startVisit: startVisit, spook: spook };
}
