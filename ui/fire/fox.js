.pragma library
// Articulated woodland visitor at the campsite's native pixel resolution.
// The encounter owns continuous joints and world-space paw anchors; views
// share the last rasterised palette plate. There is no cross-fade/ghost fox.
var WIDTH = 80, HEIGHT = 56, ANCHOR_X = 40, ANCHOR_Y = 40;
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
    // Native-pixel scanlines avoid allocating/testing a twenty-edge polygon
    // for each of the brush's many overlapping cross-sections.
    if (rx <= 0 || ry <= 0) return;
    for (var y = Math.floor(cy-ry); y <= Math.ceil(cy+ry); y++) {
        var dy = (y+0.5-cy)/ry;
        if (Math.abs(dy) >= 1) continue;
        var half = rx*Math.sqrt(1-dy*dy);
        for (var x = Math.ceil(cx-half-0.5); x < cx+half-0.5; x++) pixel(im,x,y,c);
    }
}

// The brush follows a curved centre line, with a pointed ivory tip and a
// darker underside. Its lag is independent of the body, not a rigid flag.
function tail(im, rig) {
    var sway=rig.sway, seat=rig.seat, run=rig.run, bob=rig.bob;
    var scale=Math.cos(rig.tailYaw), front=Math.sin(rig.tailYaw);
    var root=mix(-11,-10,seat), anchor=root*Math.cos(rig.yaw);
    var points = [], count = 25;
    for (var i = 0; i < count; i++) {
        var t = i / (count - 1);
        var x = mix(-11, -35, t), y = -17 + bob + 12 * t - 3 * Math.sin(t * Math.PI);
        y += sway * 2.1 * t * t;
        y = mix(y, -7 + 5 * Math.sin(t * Math.PI / 2), seat);
        x = mix(x, -10 - 17 * Math.sin(t * Math.PI * 0.8) + 7 * t, seat);
        y = mix(y, -16 + 4 * t + sway * 2 * t, run);
        var radius = (1.4 + 4.6 * Math.sin(Math.PI * Math.pow(t, 0.7))) * (1 - 0.8 * Math.pow(t, 8));
        points.push({ x:anchor+(x-root)*scale-front*6*Math.sin(t*Math.PI), y:y, r:radius });
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

function limb(im, hip, foot, hind, far, facing) {
    var bend = (hind ? -3.5 : 1.8) * facing;
    var knee = [mix(hip[0], foot[0], 0.48) + bend, mix(hip[1], foot[1], 0.52)];
    stroke(im, hip, knee, hind ? 4 : 2.8, far ? 3 : 5);
    stroke(im, [hip[0]+0.4*facing,hip[1]], [knee[0]+0.5*facing,knee[1]-0.5], 1.1, far ? 4 : 7);
    stroke(im, knee, foot, 1.8, far ? 17 : 18);
    ellipse(im,foot[0]+0.7*facing,foot[1]-0.4,1.7,0.8,17);
    if (!far) pixel(im, knee[0], knee[1], 19);
}

function head(im, rig) {
    var angle = rig.pitch, scale = Math.cos(rig.headYaw);
    var hx = 8 + rig.dip * 2, hy = -22 + rig.bob * 0.45 + 13 * rig.dip - rig.seat * 1.5;
    var ear = rig.ear - (rig.pitch < 0 ? 1.4 : 0);
    function point(p) {
        return [(hx + p[0] * Math.cos(angle) - p[1] * Math.sin(angle)) * scale, hy + p[0] * Math.sin(angle) + p[1] * Math.cos(angle)];
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
    if (rig.blink < 0.4) dot(9,-1,23);
    dot(15,2,17); dot(16,2,17); dot(16,3,17);
    dot(13,4,2); dot(12,4,3);
    dot(-1,-4,20); dot(-2,1,12);
    // Volume grows continuously as the muzzle turns towards the viewer.
    // The side ears/skull remain underneath; no sudden front-plate swap.
    var front = Math.abs(Math.sin(rig.headYaw)), cx = hx * scale, cy = hy - 2;
    if (front > 0.03) {
        var w = front * 5;
        ellipse(im,cx,cy,w,5*front,6);
        poly(im,[[cx-w,cy-1],[cx,cy+2],[cx+w,cy-1],[cx+w*0.7,cy+5*front],
            [cx,cy+6*front],[cx-w*0.7,cy+5*front]],14);
        poly(im,[[cx-w,cy-1],[cx-w-1*front,cy-11*front],[cx-1*front,cy-5*front],
            [cx+w+1*front,cy-11*front],[cx+w,cy-1]],3);
        stroke(im,[cx-w,cy-10*front],[cx-w+front,cy-5*front],1,20);
        stroke(im,[cx+w,cy-10*front],[cx+w-front,cy-5*front],1,8);
        ellipse(im,cx,cy+2*front,2.2*front,4*front,7);
        if (front > 0.8) {
            pixel(im,cx-2.5*front,cy+1,22); pixel(im,cx+2.5*front,cy+1,22);
            if (rig.blink < 0.4) pixel(im,cx+2.5*front,cy+1,23);
            pixel(im,cx,cy+5*front,17);
        }
    }
}

function paintTorso(im, rig) {
    var seat = rig.seat, bob = rig.bob;
    var hipY = mix(-16 + bob + rig.flex, -6, seat);
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
}

// Rasterise a coherent joint pose, not an alpha dissolve between two animals.
// One cached plate is shared by views whenever the simulation has not advanced.
function makeSprite(fox) {
    var rig = fox.rig.body, feet = fox.rig.feet;
    var im = new Uint8Array(WIDTH * HEIGHT), torso = new Uint8Array(WIDTH * HEIGHT);
    var px = Math.round(fox.x), py = Math.round(fox.y);
    var scale = Math.cos(rig.yaw), front = Math.abs(Math.sin(rig.yaw));
    var hipY = mix(-16 + rig.bob + rig.flex, -6, rig.seat), shoulderY = -18 + rig.bob;
    function foot(i) { return [feet[i].x - px, feet[i].y - py]; }
    function hip(i) {
        return [(i % 2 ? 9 : -9) * scale + (i < 2 ? -3 : 3) * front,
            i % 2 ? shoulderY + (i < 2 ? 0 : 3) : hipY + (i < 2 ? 0 : 1)];
    }
    limb(im,hip(0),foot(0),true,true,scale);
    limb(im,hip(1),foot(1),false,true,scale);
    tail(im,rig);
    paintTorso(torso,rig);
    for (var y = 0; y < HEIGHT; y++) for (var x = 0; x < WIDTH; x++) {
        var c = torso[y*WIDTH+x];
        if (c) pixel(im,(x-ANCHOR_X)*scale,y-ANCHOR_Y,c);
    }
    if (front > 0.03) {
        // A rounded barrel and ruff keep volume when the flank foreshortens.
        ellipse(im,0,-15+rig.bob,7*front,9,3);
        ellipse(im,-front,-16+rig.bob,5.5*front,8,5);
        ellipse(im,-2*front,-18+rig.bob,3.5*front,5,7);
        ellipse(im,8*scale,-16+rig.bob,5*front,8,12);
        ellipse(im,8*scale-front,-18+rig.bob,3.5*front,5,15);
    }
    if (rig.seat > 0) {
        ellipse(im,-9*scale,hipY+2,5,5,5);
        ellipse(im,-10*scale,hipY+1,3,3,6);
    }
    limb(im,hip(2),foot(2),true,false,scale);
    limb(im,hip(3),foot(3),false,false,scale);
    // The neck bridges the leading head and following shoulders during a turn.
    function neck(points, colour) {
        poly(im,points.map(function(p) {
            var lead = clamp((p[0]-8)/6,0,1);
            return [p[0]*Math.cos(mix(rig.yaw,rig.headYaw,lead)),p[1]];
        }),colour);
    }
    var bob=rig.bob, dip=rig.dip;
    neck([[8,-23+bob],[13,-21+bob],[15,-16+bob+10*dip],
        [12,-10+bob+10*dip],[9,-10+bob],[7,-16+bob]],5);
    neck([[10,-22+bob],[13,-20+bob],[14,-15+bob+9*dip],
        [12,-12+bob+8*dip],[10,-16+bob]],7);
    neck([[12,-22+bob],[14,-19+bob+5*dip],[13,-14+bob+9*dip],
        [10,-10+bob+6*dip],[9,-13+bob],[10,-17+bob]],12);
    neck([[12,-22+bob],[14,-19+bob+5*dip],[12,-15+bob+8*dip],
        [10,-13+bob+6*dip],[11,-18+bob]],15);
    head(im,rig);
    return im;
}
var cachedFox = null, cachedVersion = -1, cachedPlate = null;

// Follow the painted boulder and the ferns around its foot, including the
// right-hand lobe beyond the old scene edge. No invisible vertical frame seam.
var ROCK = [[288,163],[290,156],[295,150],[301,145],[312,139],[324,138],
    [335,137],[344,137],[352,141],[359,145],[364,151],[367,158],
    [370,163],[371,170],[369,177],[365,180],[350,180],[338,179],
    [326,179],[318,177],[305,175],[297,174],[294,173],[293,170],[291,168]];
var ROCK_X = 288, ROCK_Y = 137, ROCK_W = 84, ROCK_H = 44;
function behindRock(x, y) {
    if (x < ROCK_X || x >= ROCK_X + ROCK_W || y < ROCK_Y || y >= ROCK_Y + ROCK_H) return false;
    var inside = false;
    for (var i = 0, j = ROCK.length - 1; i < ROCK.length; j = i++) {
        var a = ROCK[i], b = ROCK[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
}
var OCCLUSION = new Uint8Array(ROCK_W * ROCK_H);
for (var oy = 0; oy < ROCK_H; oy++) for (var ox = 0; ox < ROCK_W; ox++)
    if (behindRock(ox + ROCK_X + 0.5, oy + ROCK_Y + 0.5)) OCCLUSION[oy * ROCK_W + ox] = 1;
function occluded(x, y) {
    return x >= ROCK_X && x < ROCK_X + ROCK_W && y >= ROCK_Y && y < ROCK_Y + ROCK_H
        && OCCLUSION[(y - ROCK_Y) * ROCK_W + x - ROCK_X];
}
var bounds = [0,0,0,0];
// left is a world coordinate; returned dirty bounds are framebuffer-local.
// Popup and wallpaper rasterise the same animal, clipped to their own views.
function draw(fb, fox, heat, left, width) {
    left = left || 0; width = width || 360;
    if (!fox || fox.x + ANCHOR_X < left || fox.x - ANCHOR_X >= left + width) return null;
    if (cachedFox !== fox || cachedVersion !== fox.rig.version) {
        cachedPlate = makeSprite(fox);
        cachedFox = fox; cachedVersion = fox.rig.version;
    }
    var im = cachedPlate, px = Math.round(fox.x), py = Math.round(fox.y);
    var fireDx = fox.x - 180, fireDy = fox.y - 182;
    var warmth = clamp((heat === undefined ? 0.68 : heat) * 1.4, 0, 1)
        * clamp(1 - Math.sqrt(fireDx * fireDx + fireDy * fireDy) / 175, 0, 1);
    var fireSide = fireDx < 0 ? -1 : 1;
    var behindBoulder = fox.y <= 182;
    var flicker = 0.96 + 0.04 * Math.sin((fox.age || 0) * 9.7);
    var shadowWidth = Math.round(mix(22,15,fox.rig.body.seat));
    for (var sy = -2; sy <= 2; sy++) for (var sx = -shadowWidth; sx <= shadowWidth; sx++) {
        var xx = px + sx, yy = py + sy;
        if (xx < left || xx >= left + width || yy < 0 || yy >= 240 || (behindBoulder && occluded(xx, yy))) continue;
        var a = Math.max(0, 1 - sx*sx/(shadowWidth*shadowWidth) - sy*sy/8) * 0.27;
        var idx = (yy * width + xx - left) * 4;
        fb[idx] *= 1-a; fb[idx+1] *= 1-a; fb[idx+2] *= 1-a;
    }
    for (var y = 0; y < HEIGHT; y++) for (var x = 0; x < WIDTH; x++) {
        var c = im[y * WIDTH + x];
        if (!c) continue;
        var dx = px + x - ANCHOR_X, dy = py + y - ANCHOR_Y;
        if (dx < left || dx >= left + width || dy < 0 || dy >= 240 || (behindBoulder && occluded(dx, dy))) continue;
        // Light stays on the hearth-facing side, on either side of camp.
        var light = warmth * flicker * (0.78 + 0.22 * clamp(((px-dx)*fireSide+24)/48,0,1));
        var col = COLOURS[c], i = (dy * width + dx - left) * 4;
        fb[i] = col[0] * (0.67 + 0.33 * light);
        fb[i+1] = col[1] * (0.79 + 0.21 * light);
        fb[i+2] = col[2] * (1.04 - 0.04 * light);
    }
    // Both facing directions, tail, ears, airborne paws and contact shadow.
    bounds[0] = Math.max(0,px-ANCHOR_X-left); bounds[1] = Math.max(0,py-ANCHOR_Y);
    bounds[2] = Math.min(width,px+ANCHOR_X+1-left); bounds[3] = Math.min(240,py+HEIGHT-ANCHOR_Y);
    return bounds;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { draw:draw, makeSprite:makeSprite, COLOURS:COLOURS, WIDTH:WIDTH, HEIGHT:HEIGHT };
}
