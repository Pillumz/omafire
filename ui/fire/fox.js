.pragma library
// A little woodland animal, painted in the campsite's native pixels. Anatomy
// is articulated before rasterising: planted paws, hocks, shoulder, neck and a
// trailing brush. All plates are baked once; playback only copies palette ink.
var WIDTH = 80, HEIGHT = 44, ANCHOR_X = 40, ANCHOR_Y = 40;
var FRAMES = 16;
var COLOURS = [null,
    [36,35,42], [59,40,39], [83,45,37], [107,53,36],
    [133,65,39], [155,79,44], [176,96,53], [195,119,68],
    [208,141,86], [219,162,111], // russet through guard-hair gold
    [85,84,85], [116,113,107], [149,143,126], [180,169,144],
    [206,191,160], [226,209,176], // moon-shadow through ivory
    [25,29,36], [44,42,44], [65,52,46], // stockings, nose, ears
    [116,127,143], [147,152,155], // broken silver-blue rim
    [17,23,29], [222,178,99] // dark eye, tiny amber reflection
];
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mix(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }
function pixel(im, x, y, c) {
    x = Math.round(x) + ANCHOR_X; y = Math.round(y) + ANCHOR_Y;
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) im[y * WIDTH + x] = c;
}
function poly(im, points, c) {
    var x0 = WIDTH, x1 = -WIDTH, y0 = HEIGHT, y1 = -HEIGHT;
    for (var n = 0; n < points.length; n++) {
        x0 = Math.min(x0, points[n][0]); x1 = Math.max(x1, points[n][0]);
        y0 = Math.min(y0, points[n][1]); y1 = Math.max(y1, points[n][1]);
    }
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++) for (var x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        var inside = false, px = x + 0.5, py = y + 0.5;
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
            var a = points[i], b = points[j];
            if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        }
        if (inside) pixel(im, x, y, c);
    }
}
function stroke(im, a, b, width, c) {
    var dx = b[0] - a[0], dy = b[1] - a[1], length = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / length * width / 2, ny = dx / length * width / 2;
    poly(im, [[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]], c);
}
function ellipse(im, cx, cy, rx, ry, c) {
    var points = [];
    for (var i = 0; i < 20; i++) {
        var t = i * Math.PI / 10;
        points.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
    }
    poly(im, points, c);
}

// The brush follows a curved centre line, with a pointed ivory tip and a
// darker underside. Its lag is independent of the body, not a rigid flag.
function tail(im, phase, seat, run, bob) {
    var sway = Math.sin(phase * Math.PI * 2 - 0.8);
    var points = [], count = 25;
    for (var i = 0; i < count; i++) {
        var t = i / (count - 1);
        var x = mix(-11, -35, t), y = -17 + bob + 12 * t - 3 * Math.sin(t * Math.PI);
        y += sway * 2.1 * t * t;
        y = mix(y, -7 + 5 * Math.sin(t * Math.PI / 2), seat);
        x = mix(x, -10 - 17 * Math.sin(t * Math.PI * 0.8) + 7 * t, seat);
        y = mix(y, -16 + 4 * t + sway * 2 * t, run);
        var radius = (1.4 + 4.6 * Math.sin(Math.PI * Math.pow(t, 0.7))) * (1 - 0.8 * Math.pow(t, 8));
        points.push({ x:x, y:y, r:radius });
    }
    // Cross-sections overlap; paint from root to tip, with slanting flecks at
    // the russet/ivory boundary rather than a square dipped-in-paint end.
    for (var k = 0; k < count; k++) {
        var p = points[k], ivory = k > 17;
        ellipse(im, p.x, p.y, 1.8, p.r, ivory ? 12 : 3);
        ellipse(im, p.x, p.y - 1.1, 1.6, p.r * 0.76, ivory ? 14 : 6);
        if (k > 3) pixel(im, p.x, p.y - p.r + 1, ivory ? 16 : 8);
        if (k % 3 === 0 && k < 19) pixel(im, p.x - 1, p.y + 1, ivory ? 13 : 5);
    }
}

function footAt(phase, offset, hip, moving, run) {
    if (!moving) return [hip + 1, 0];
    var p = (phase + offset) % 1;
    if (run) return [hip + Math.cos(p * Math.PI * 2) * 9, -Math.max(0, Math.sin(p * Math.PI * 2)) * 6];
    // 62% ground contact. During stance the paw travels back exactly one
    // body stride per cycle, so it stays on the same patch of ground.
    var stance = 0.62, span = 16 * stance;
    if (p < stance) return [hip + span / 2 - p * 16, 0];
    var s = (p - stance) / (1 - stance);
    return [hip - span / 2 + smooth(s) * span, -Math.sin(s * Math.PI) * 4.5];
}
function limb(im, hip, foot, hind, far) {
    var bend = hind ? -3.5 : 1.8;
    var knee = [mix(hip[0], foot[0], 0.48) + bend, mix(hip[1], foot[1], 0.52)];
    stroke(im, hip, knee, hind ? 4 : 2.8, far ? 3 : 5);
    stroke(im, [hip[0]+0.4,hip[1]], [knee[0]+0.5,knee[1]-0.5], 1.1, far ? 4 : 7);
    stroke(im, knee, foot, 1.8, far ? 17 : 18);
    stroke(im, [foot[0]-0.6,foot[1]-0.4], [foot[0]+2.2,foot[1]-0.4], 1.5, 17);
    if (!far) pixel(im, knee[0], knee[1], 19);
}

function head(im, pose, phase, bob, seat) {
    var sniff = pose === "sniff" ? (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)) : 0;
    var lowered = 13 * sniff;
    var angle = pose === "sniff" ? sniff * 0.38 : (pose === "alert" ? -0.10 : 0);
    var hx = 8 + (pose === "sniff" ? 2 : 0), hy = -22 + bob + lowered - seat * 1.5;
    var ear = pose === "alert" ? -1.4 : (phase > 0.65 && phase < 0.85 ? 1.3 : 0);
    function point(p) {
        return [hx + p[0] * Math.cos(angle) - p[1] * Math.sin(angle), hy + p[0] * Math.sin(angle) + p[1] * Math.cos(angle)];
    }
    function shape(points, c) { poly(im, points.map(point), c); }
    function dot(x, y, c) { var p = point([x,y]); pixel(im,p[0],p[1],c); }
    // Far ear and cheek first. Long wedge muzzle, narrow forehead and tall
    // black-backed ears distinguish a fox from a cat or a small orange dog.
    shape([[3,-5],[5+ear,-13],[8,-8],[9,-3]], 2);
    shape([[5,-11],[7,-7],[6,-4]], 7);
    shape([[-2,1],[-1,-6],[2,-9],[6,-7],[9,-4],[11,-1],[17,2],[16,4],[10,5],[5,8],[0,6],[-3,4]], 3);
    shape([[-1,0],[0,-6],[2,-8],[6,-6],[9,-3],[10,0],[15,2],[13,4],[7,5],[2,6]], 7);
    shape([[0,-5],[0+ear,-14],[4,-11],[6,-5],[4,-2]], 18);
    shape([[1,-11],[3,-9],[4,-5],[2,-5]], 5);
    stroke(im, point([0+ear,-14]), point([0,-7]), 1, 20);
    dot(2,-11,9);
    // Cream cheek sweeps back into a jagged ruff, not a rectangular bib.
    shape([[-2,0],[2,2],[6,2],[9,3],[14,3],[12,5],[7,6],[3,8],[2,6],[-1,7],[0,5],[-3,4]], 13);
    shape([[-1,0],[2,2],[5,3],[8,3],[6,5],[2,6],[0,4],[-2,4]], 15);
    shape([[4,-5],[7,-4],[9,-2],[12,0],[8,0],[5,-1],[2,-2]], 8);
    dot(3,-5,10); dot(5,-4,9);
    // Dark almond with one restrained amber glint. Blinks close the eye;
    // they do not change the skull or flash a white cartoon eyeball.
    dot(8,-1,22); dot(9,-1,22);
    if (!((pose === "idle" || pose === "sit") && phase > 0.81 && phase < 0.89)) dot(9,-1,23);
    dot(15,2,17); dot(16,2,17); dot(16,3,17);
    dot(13,4,2); dot(12,4,3);
    dot(-1,-4,20); dot(-2,1,12);
}

function makeSprite(pose, frame) {
    var phase = frame / FRAMES, t = frame / (FRAMES - 1);
    var im = new Uint8Array(WIDTH * HEIGHT);
    var moving = pose === "walk" || pose === "run", run = pose === "run" ? 1 : 0;
    var seat = pose === "sit" ? 1 : pose === "settle" ? smooth(t) : pose === "rise" ? 1 - smooth(t) : 0;
    var bob = moving ? -0.65 + Math.cos(phase * Math.PI * 4) * 0.65 : Math.sin(phase * Math.PI * 2) * 0.35;
    if (run) bob = -1.5 - Math.sin(phase * Math.PI * 2) * 1.5;
    var hipY = mix(-16 + bob + run * Math.sin(phase * Math.PI * 2) * 2, -6, seat), shoulderY = -18 + bob;
    var rear = footAt(phase, run ? 0.58 : 0.28, -9, moving, run);
    var front = footAt(phase, run ? 0.12 : 0.78, 9, moving, run);
    limb(im, [-9,hipY], rear, true, true);
    limb(im, [8,shoulderY], front, false, true);
    tail(im, phase, seat, run, bob);
    // Long barrel, high shoulder and tucked belly, widening to the haunch.
    var outline = [[-14,hipY+2],[-13,hipY-3],[-9,hipY-5],[-3,mix(-22+bob,-18,seat)],
        [4,-22+bob],[9,-25+bob],[13,-22+bob],[13,-16+bob],[10,-10+bob],
        [4,mix(-10+bob,-7,seat)],[-5,mix(-10+bob,-1,seat)],[-12,hipY+7]];
    poly(im, outline, 3);
    poly(im, [[-13,hipY+1],[-11,hipY-3],[-6,hipY-4],[1,-21+bob],[8,-23+bob],
        [11,-20+bob],[9,-14+bob],[2,mix(-12+bob,-6,seat)],[-7,hipY+4]], 5);
    poly(im, [[-11,hipY-2],[-7,hipY-4],[0,-21+bob],[7,-22+bob],[9,-19+bob],
        [5,-16+bob],[-3,mix(-16+bob,-10,seat)],[-10,hipY+1]], 7);
    poly(im, [[-8,hipY-3],[-3,mix(-22+bob,-18,seat)],[4,-22+bob],[8,-24+bob],
        [8,-21+bob],[1,-19+bob],[-6,hipY-1]], 8);
    poly(im, [[-12,hipY+3],[-7,hipY+4],[1,mix(-12+bob,-5,seat)],[7,-13+bob],
        [7,-10+bob],[0,mix(-10+bob,-3,seat)],[-8,hipY+6]], 4);
    // Sparse, coherent guard hairs. Fixed coordinates keep the coat attached
    // to the torso instead of crawling randomly from one frame to the next.
    for (var fx = -12; fx < 9; fx++) for (var fy = -22; fy < -10; fy++) {
        var grain = ((fx+17)*137 + (fy+29)*71 + (fx+17)*(fy+29)*13) % 101;
        if (grain > 22) continue;
        var x = fx, y = fy + bob + seat * Math.max(0, -fx + 3) * 0.6;
        var ix = Math.round(x) + ANCHOR_X, iy = Math.round(y) + ANCHOR_Y;
        var c = im[iy * WIDTH + ix];
        if (c >= 4 && c <= 8) {
            pixel(im,x,y,c + (grain < 8 ? 1 : -1));
            // Paired diagonal hairs break up bands without making a grid.
            if (grain < 5 && im[(iy+1)*WIDTH+ix-1] === c) pixel(im,x-1,y+1,c-1);
        }
    }
    stroke(im, [-8,hipY-4], [-3,mix(-22+bob,-18,seat)], 1, 20);
    pixel(im,0,-22+bob,21); pixel(im,2,-22+bob,9);
    // Near hind leg folds under the haunch when sitting. Front paws remain
    // planted during the entire lowering/rising motion.
    rear = footAt(phase, run ? 0.5 : 0.78, -9, moving, run);
    front = footAt(phase, run ? 0 : 0.28, 9, moving, run);
    if (seat > 0) {
        rear[0] = mix(rear[0], -4, seat);
        ellipse(im, -9, hipY+2, 5, 5, 5);
        ellipse(im, -10, hipY+1, 3, 3, 6);
    }
    limb(im, [-9,hipY+1], rear, true, false);
    limb(im, [10,shoulderY+3], front, false, false);
    // The neck follows a dipping skull; moving the head alone would leave
    // it floating below the shoulders at the bottom of a sniff.
    var dip = pose === "sniff" ? 0.5 - 0.5 * Math.cos(phase * Math.PI * 2) : 0;
    poly(im, [[8,-23+bob],[13,-21+bob],[15,-16+bob+10*dip],
        [12,-10+bob+10*dip],[9,-10+bob],[7,-16+bob]], 5);
    poly(im, [[10,-22+bob],[13,-20+bob],[14,-15+bob+9*dip],
        [12,-12+bob+8*dip],[10,-16+bob]], 7);
    // The breast catches reflected fire below, silver moonlight above.
    poly(im, [[12,-22+bob],[14,-19+bob+5*dip],[13,-14+bob+9*dip],
        [10,-10+bob+6*dip],[9,-13+bob],[10,-17+bob]], 12);
    poly(im, [[12,-22+bob],[14,-19+bob+5*dip],[12,-15+bob+8*dip],
        [10,-13+bob+6*dip],[11,-18+bob]], 15);
    head(im, pose, phase, bob, seat);
    return im;
}
var SPRITES = {};
["idle", "walk", "sniff", "alert", "run", "sit", "settle", "rise"].forEach(function(pose) {
    SPRITES[pose] = [];
    for (var i = 0; i < FRAMES; i++) SPRITES[pose].push(makeSprite(pose, i));
});

// A half-turn narrows the silhouette before opening onto the opposite flank.
// The final plate faces back relative to the current direction; the encounter
// changes direction only once the turn finishes, so there is no mirror-pop.
SPRITES.turn = [];
for (var f = 0; f < FRAMES; f++) {
    var turn = new Uint8Array(WIDTH * HEIGHT), t = f / (FRAMES - 1);
    var scale = Math.cos(t * Math.PI), plate = SPRITES.idle[0];
    for (var y = 0; y < HEIGHT; y++) for (var x = 0; x < WIDTH; x++) {
        var c = plate[y * WIDTH + x];
        if (c) pixel(turn, (x - ANCHOR_X) * scale, y - ANCHOR_Y, c);
    }
    // At three-quarter/front view the ruff and ears still have volume.
    var frontness = Math.sin(t * Math.PI);
    if (frontness > 0.4) {
        var cx = 8 * scale, w = 5 * frontness;
        // A real front plate supplies chest depth, two ears and separated
        // forepaws at mid-turn, where projecting a side plate becomes paper.
        ellipse(turn,0,-14,w+1,10,4);
        ellipse(turn,cx*0.4,-16,w,8,6);
        stroke(turn,[-w*0.65,-12],[-w*0.65,0],1.8,18);
        stroke(turn,[w*0.65,-12],[w*0.65,0],1.8,18);
        poly(turn,[[cx-w,-22],[cx+w,-22],[cx+w*0.6,-14],[cx,-10],[cx-w*0.6,-14]],12);
        poly(turn,[[cx-w+1,-23],[cx+w-1,-23],[cx+2,-16],[cx,-13],[cx-2,-16]],15);
        ellipse(turn,cx,-26,w+1,5,6);
        poly(turn,[[cx-w,-25],[cx-w-1,-34],[cx-1,-29],[cx+w+1,-34],[cx+w,-25]],3);
        stroke(turn,[cx-w,-33],[cx-w+1,-29],1,20);
        stroke(turn,[cx+w,-33],[cx+w-1,-29],1,8);
        poly(turn,[[cx-w,-25],[cx,-23],[cx+w,-25],[cx+3,-21],[cx,-20],[cx-3,-21]],14);
        poly(turn,[[cx-2,-27],[cx+2,-27],[cx+2,-23],[cx,-21],[cx-2,-23]],7);
        pixel(turn,cx-3,-26,22); pixel(turn,cx+3,-26,22); pixel(turn,cx,-22,17);
    }
    SPRITES.turn.push(turn);
}

// The foreground boulder remains untouched as the visitor enters/leaves.
var ROCK = [[295,151],[301,145],[312,139],[327,138],[340,137],[360,137],[360,181],[326,179],[318,177],[305,175],[291,168],[288,163]];
function behindRock(x, y) {
    if (x < 288 || y < 137 || y > 181) return false;
    var inside = false;
    for (var i = 0, j = ROCK.length - 1; i < ROCK.length; j = i++) {
        var a = ROCK[i], b = ROCK[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}
var OCCLUSION = new Uint8Array(360 * 240);
for (var oy = 137; oy <= 181; oy++) for (var ox = 288; ox < 360; ox++)
    if (behindRock(ox + 0.5, oy + 0.5)) OCCLUSION[oy * 360 + ox] = 1;
var bounds = [0,0,0,0];
function draw(fb, fox, heat) {
    if (!fox || fox.x + ANCHOR_X < 0 || fox.x - ANCHOR_X >= 360) return null;
    var frames = SPRITES[fox.pose] || SPRITES.idle;
    var progress = fox.pose === "turn" || fox.pose === "settle" || fox.pose === "rise";
    var phase = Math.min(FRAMES-1, Math.floor((fox.phase || 0) * (progress ? FRAMES-1 : FRAMES)));
    var im = frames[phase], px = Math.round(fox.x), py = Math.round(fox.y);
    var facing = fox.direction < 0 ? -1 : 1;
    var fireDx = fox.x - 180, fireDy = fox.y - 182;
    var warmth = clamp((heat === undefined ? 0.68 : heat) * 1.4, 0, 1)
        * clamp(1 - Math.sqrt(fireDx * fireDx + fireDy * fireDy) / 175, 0, 1);
    var fireSide = fireDx < 0 ? -1 : 1;
    var behindBoulder = fox.y <= 182;
    var flicker = 0.96 + 0.04 * Math.sin((fox.age || 0) * 9.7);
    var shadowWidth = fox.pose === "sit" ? 15 : 22;
    for (var sy = -2; sy <= 2; sy++) for (var sx = -shadowWidth; sx <= shadowWidth; sx++) {
        var xx = px + sx, yy = py + sy;
        if (xx < 0 || xx >= 360 || yy < 0 || yy >= 240 || (behindBoulder && OCCLUSION[yy * 360 + xx])) continue;
        var a = Math.max(0, 1 - sx*sx/(shadowWidth*shadowWidth) - sy*sy/8) * 0.27;
        var idx = (yy * 360 + xx) * 4;
        fb[idx] *= 1-a; fb[idx+1] *= 1-a; fb[idx+2] *= 1-a;
    }
    for (var y = 0; y < HEIGHT; y++) for (var x = 0; x < WIDTH; x++) {
        var c = im[y * WIDTH + x];
        if (!c) continue;
        var dx = px + (x - ANCHOR_X) * facing, dy = py + y - ANCHOR_Y;
        if (dx < 0 || dx >= 360 || dy < 0 || dy >= 240 || (behindBoulder && OCCLUSION[dy * 360 + dx])) continue;
        // Light stays on the hearth-facing side, on either side of camp.
        var light = warmth * flicker * (0.78 + 0.22 * clamp(((px-dx)*fireSide+24)/48,0,1));
        var col = COLOURS[c], i = (dy * 360 + dx) * 4;
        fb[i] = col[0] * (0.67 + 0.33 * light);
        fb[i+1] = col[1] * (0.79 + 0.21 * light);
        fb[i+2] = col[2] * (1.04 - 0.04 * light);
    }
    // Both facing directions, tail, ears, airborne paws and contact shadow.
    bounds[0] = Math.max(0,px-ANCHOR_X); bounds[1] = Math.max(0,py-ANCHOR_Y);
    bounds[2] = Math.min(360,px+ANCHOR_X+1); bounds[3] = Math.min(240,py+HEIGHT-ANCHOR_Y);
    return bounds;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { draw:draw, SPRITES:SPRITES, COLOURS:COLOURS, WIDTH:WIDTH, HEIGHT:HEIGHT };
}
