.pragma library
// Hand-pixelled red fox, in scene pixels. Small shapes are rasterised ONCE at
// load, not antialiased or scaled independently of the campsite. The poses
// share a coat/head/tail; the feet actually change placement through the gait.
var WIDTH = 52, HEIGHT = 28, ANCHOR_X = 26, ANCHOR_Y = 27;
var COLOURS = [null,
    [47, 37, 35],    // 1 deep fur / broken outline
    [86, 49, 37],    // 2 shaded russet
    [126, 65, 39],   // 3 coat
    [157, 87, 48],   // 4 warm fur
    [180, 112, 63],  // 5 fire-facing highlights
    [184, 171, 142], // 6 ivory cheek and tail
    [119, 115, 106], // 7 shaded ivory
    [34, 34, 37],   // 8 stockings / nose
    [113, 112, 117], // 9 cool moonlit ridge
    [186, 135, 91],  // a ear rim
    [21, 24, 28],   // b eye
    [214, 179, 117]  // c single eye catchlight
];

function pixel(im, x, y, c) {
    x = Math.round(x) + ANCHOR_X; y = Math.round(y) + ANCHOR_Y;
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) im[y * WIDTH + x] = c;
}
function rect(im, x, y, w, h, c) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) pixel(im, i, j, c);
}
function poly(im, points, c) {
    for (var y = -ANCHOR_Y; y < HEIGHT - ANCHOR_Y; y++) for (var x = -ANCHOR_X; x < WIDTH - ANCHOR_X; x++) {
        var inside = false, px = x + 0.5, py = y + 0.5;
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
            var a = points[i], b = points[j];
            if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        }
        if (inside) pixel(im, x, y, c);
    }
}
function leg(im, hip, knee, foot, far) {
    poly(im, [[hip,-10],[hip+3,-9],[knee+2,-5],[foot+2,-1],[foot+3,0],[foot-1,0],[knee-1,-5]], far ? 2 : 3);
    poly(im, [[knee,-5],[knee+2,-5],[foot+2,-1],[foot+3,0],[foot-1,0]], 8);
    if (!far) pixel(im, knee, -5, 4);
}
function head(im, pose, phase, bob) {
    var sniff = pose === "sniff", alert = pose === "alert";
    var dx = sniff ? 2 : 0;
    var dy = sniff ? 4 + (phase === 1 || phase === 2 ? 1 : 0) : (alert ? -1 : 0);
    dy += bob;
    // Head is drawn onto a little local plate so it can dip without bending
    // the torso or making the fox's feet float.
    var h = new Uint8Array(WIDTH * HEIGHT);
    poly(h, [[7,-16],[8,-21],[9,-26],[12,-23],[14,-23],[16,-25],[18,-21],[19,-18],[22,-16],[24,-15],[23,-13],[19,-12],[16,-10],[10,-11]], 1);
    poly(h, [[8,-17],[9,-21],[10,-24],[12,-21],[15,-22],[16,-24],[17,-20],[18,-18],[21,-16],[22,-14],[18,-13],[15,-11],[10,-12]], 4);
    poly(h, [[9,-20],[10,-24],[12,-21],[11,-19]], 8);
    pixel(h, 10,-24,10); pixel(h, 11,-23,5);
    poly(h, [[15,-21],[16,-24],[17,-21],[17,-19]], 2);
    pixel(h,16,-23,10);
    poly(h, [[9,-16],[12,-17],[14,-15],[18,-14],[22,-14],[19,-12],[15,-10],[11,-12]], 6);
    poly(h, [[10,-13],[14,-11],[17,-12],[15,-10],[11,-11]], 7);
    poly(h, [[11,-20],[14,-21],[17,-19],[19,-17],[17,-16],[14,-17],[12,-16]], 5);
    rect(h, 22,-15,2,2,8);
    pixel(h,21,-13,1); pixel(h,20,-13,1);
    // A small dark almond, not a white cartoon eye. Briefly shut while idle.
    rect(h,16,-18,2,1,11);
    if (!(pose === "idle" && phase === 1)) pixel(h,17,-18,12);
    pixel(h,13,-20,4); pixel(h,12,-18,3); pixel(h,9,-18,3);
    for (var y = 0; y < HEIGHT; y++) for (var x = 0; x < WIDTH; x++) {
        var c = h[y * WIDTH + x];
        if (c) pixel(im, x - ANCHOR_X + dx, y - ANCHOR_Y + dy, c);
    }
}
function makeSprite(pose, phase) {
    var im = new Uint8Array(WIDTH * HEIGHT);
    var moving = pose === "walk" || pose === "run";
    var bob = moving && (phase === 1 || phase === 3) ? -1 : 0;
    // Far legs are behind the belly. The diagonal pairs alternate, with
    // planted and passing positions rather than sliding rigid sticks.
    var gait = [-3, 0, 3, 0], stride = moving ? gait[phase] : 0;
    if (pose === "run") stride *= 1.6;
    leg(im,-8,-8-stride,-8-stride*1.4,true);
    leg(im,6,6+stride,6+stride*1.4,true);
    // Bushy tail, white brush pointing away from the head. A one-pixel
    // tail-tip motion is enough at this scale; no rubber-hose wagging.
    var lift = pose === "alert" ? -2 : (phase === 2 ? 1 : 0);
    poly(im, [[-9,-12+lift],[-14,-12+lift],[-19,-14+lift],[-24,-13+lift],[-24,-10+lift],[-21,-6+lift],[-17,-5+lift],[-12,-6+lift],[-6,-9+lift]],1);
    poly(im, [[-9,-11+lift],[-14,-11+lift],[-19,-13+lift],[-23,-12+lift],[-22,-9+lift],[-19,-7+lift],[-15,-6+lift],[-10,-8+lift],[-6,-9+lift]],3);
    poly(im, [[-10,-11+lift],[-15,-10+lift],[-19,-12+lift],[-22,-12+lift],[-20,-9+lift],[-16,-8+lift],[-12,-8+lift]],4);
    poly(im, [[-23,-12+lift],[-20,-12+lift],[-19,-10+lift],[-20,-8+lift],[-18,-7+lift],[-21,-7+lift],[-23,-10+lift]],6);
    pixel(im,-23,-11+lift,9); pixel(im,-20,-7+lift,7);
    // Torso: dark belly, russet flank, broken cool ridge, little fur notches.
    poly(im,[[-12,-12+bob],[-8,-16+bob],[0,-17+bob],[7,-16+bob],[11,-18+bob],[15,-14+bob],[13,-7+bob],[8,-5+bob],[-4,-6+bob],[-10,-8+bob]],1);
    poly(im,[[-11,-12+bob],[-7,-15+bob],[0,-16+bob],[7,-15+bob],[11,-17+bob],[13,-13+bob],[11,-8+bob],[6,-6+bob],[-5,-7+bob],[-10,-9+bob]],3);
    poly(im,[[-8,-14+bob],[-3,-15+bob],[3,-15+bob],[8,-14+bob],[10,-11+bob],[6,-9+bob],[-3,-9+bob],[-8,-11+bob]],4);
    poly(im,[[-9,-10+bob],[-5,-9+bob],[2,-9+bob],[7,-10+bob],[10,-8+bob],[6,-6+bob],[-5,-7+bob]],2);
    rect(im,-5,-15+bob,5,1,9); rect(im,1,-15+bob,3,1,5);
    pixel(im,-7,-14+bob,5); pixel(im,-3,-12+bob,5); pixel(im,3,-13+bob,5);
    pixel(im,-1,-10+bob,3); pixel(im,5,-12+bob,3); pixel(im,-7,-9+bob,3);
    // Near legs and the ivory bib.
    leg(im,-8,-8+stride,-8+stride*1.4,false);
    leg(im,8,8-stride,8-stride*1.4,false);
    poly(im,[[10,-17+bob],[14,-15+bob],[13,-11+bob],[11,-7+bob],[8,-6+bob],[9,-10+bob]],7);
    poly(im,[[11,-17+bob],[14,-15+bob],[12,-11+bob],[10,-9+bob],[10,-13+bob]],6);
    head(im,pose,phase,bob);
    return im;
}
var SPRITES = {};
["idle", "walk", "sniff", "alert", "run"].forEach(function (pose) {
    SPRITES[pose] = [];
    for (var i = 0; i < 4; i++) SPRITES[pose].push(makeSprite(pose, i));
});

// The fox emerges from BEHIND the right boulder and its surrounding grasses.
// A hand-traced silhouette keeps those foreground pixels untouched; the
// artwork itself never changes. Cache it rather than testing polygons per frame.
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

// Returns bounds for the scene's incremental-copy path. Drawing uses the same
// opaque RGBA buffer as the fire; no extra Canvas, timer or scene simulation.
var bounds = [0,0,0,0];
function draw(fb, fox, heat) {
    if (!fox) return null;
    var frames = SPRITES[fox.pose] || SPRITES.idle;
    var phase = Math.floor((fox.phase || 0) * 4) % 4;
    if (fox.pose === "idle") phase = fox.poseAge % 2.8 > 2.66 ? 1 : 0;
    var im = frames[phase];
    var px = Math.round(fox.x), py = Math.round(fox.y), facing = fox.direction < 0 ? -1 : 1;
    // Cooler and dimmer in the trees, warm on approaching a burning hearth.
    // Even a resting fire leaves moonlight, not an invisible black fox.
    var warmth = Math.min(1, (heat === undefined ? 0.68 : heat) * 1.5)
        * Math.max(0, Math.min(1, 1 - (fox.x - 264) / 110));
    // Small contact shadow, fading at its edges, anchors the feet to the path.
    for (var sy = -2; sy <= 1; sy++) for (var sx = -17; sx <= 17; sx++) {
        var xx = px + sx, yy = py + sy;
        if (xx < 0 || xx >= 360 || yy < 0 || yy >= 240 || OCCLUSION[yy * 360 + xx]) continue;
        var a = Math.max(0, 1 - sx * sx / 289 - sy * sy / 6) * 0.22, idx = (yy * 360 + xx) * 4;
        fb[idx] *= 1 - a; fb[idx + 1] *= 1 - a; fb[idx + 2] *= 1 - a;
    }
    for (var y = 0; y < HEIGHT; y++) for (var x = 0; x < WIDTH; x++) {
        var c = im[y * WIDTH + x];
        if (!c) continue;
        var dx = px + (x - ANCHOR_X) * facing, dy = py + y - ANCHOR_Y;
        if (dx < 0 || dx >= 360 || dy < 0 || dy >= 240 || OCCLUSION[dy * 360 + dx]) continue;
        var col = COLOURS[c], i = (dy * 360 + dx) * 4;
        fb[i] = col[0] * (0.62 + 0.38 * warmth);
        fb[i + 1] = col[1] * (0.77 + 0.23 * warmth);
        fb[i + 2] = col[2];
    }
    bounds[0] = Math.max(0, px - 26); bounds[1] = Math.max(0, py - 28);
    bounds[2] = Math.min(360, px + 27); bounds[3] = Math.min(240, py + 3);
    return bounds;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { draw: draw, SPRITES: SPRITES, COLOURS: COLOURS, WIDTH: WIDTH, HEIGHT: HEIGHT };
}
