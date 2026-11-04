"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWildlife, loadFox } = require("./lib/load-wildlife");
const Wildlife = loadWildlife(), Fox = loadFox();

function visit(seed = 1) {
  const state = Wildlife.create(seed);
  Wildlife.startVisit(state);
  return state;
}
function findPose(state, pose, progress = 0.4) {
  for (let i = 0; i < 18000 && state.fox; i++) {
    const fox = state.fox;
    if (fox.pose === pose && fox.poseAge >= fox.action.duration * progress) return fox;
    Wildlife.advance(state, 1 / 60);
  }
  assert.fail(`visit did not reach ${pose}`);
}

test("a startle preserves the visible fox, including halfway through a turn or rise", () => {
  for (const pose of ["walk", "sniff", "turn", "settle", "sit", "rise"]) {
    const state = visit(), fox = findPose(state, pose);
    const before = Buffer.from(Fox.makeSprite(fox));
    assert.ok(Wildlife.spook(state, fox.x, fox.y - 12));
    assert.ok(Buffer.from(Fox.makeSprite(fox)).equals(before), `${pose}: no pose/mirror pop at the click`);
    const action = fox.action;
    Wildlife.spook(state, fox.x, fox.y - 12);
    assert.equal(fox.action, action, "repeated clicks cannot postpone escape");
    for (let i = 0; i < 1000 && state.fox; i++) Wildlife.advance(state, 0.05);
    assert.equal(state.fox, null, `${pose}: the fox reaches cover`);
  }
});

test("planted paws keep both world coordinates on diagonal trails", () => {
  const state = visit(8);
  let contacts = 0, diagonalContacts = 0;
  for (let i = 0; i < 10000 && state.fox; i++) {
    const fox = state.fox, action = fox.action;
    const feet = fox.rig.feet.map(f => ({ x: f.x, y: f.y, mode: f.mode }));
    const y = fox.y;
    Wildlife.advance(state, 1 / 60);
    if (!state.fox || state.fox.action !== action || fox.pose !== "walk") continue;
    for (let leg = 0; leg < 4; leg++) {
      const previous = feet[leg], current = fox.rig.feet[leg];
      if (previous.mode !== "plant" || current.mode !== "plant") continue;
      assert.equal(current.x, previous.x, "ground contact cannot skate horizontally");
      assert.equal(current.y, previous.y, "ground contact cannot slide with the body's depth movement");
      contacts++;
      if (fox.y !== y) diagonalContacts++;
    }
  }
  assert.ok(contacts > 100 && diagonalContacts > 100, "exercise real sloped travel, not only a horizontal entrance");
});

test("waypoints carry speed, while a real pause or reversal brakes to rest", () => {
  const state = visit(2);
  let bends = 0, turns = 0;
  for (let i = 0; i < 5000 && state.fox; i++) {
    const fox = state.fox, action = fox.action, previous = fox.pose;
    Wildlife.advance(state, Math.min(0.1, action.duration - fox.poseAge));
    if (!state.fox || state.fox.action === action) continue;
    if (previous === "walk" && fox.pose === "walk") {
      assert.ok(fox.speed > 5, "an invisible waypoint is not another start/stop");
      bends++;
    }
    if (previous === "walk" && fox.pose === "turn") {
      assert.ok(fox.speed < 0.000001, "turning begins after braking, not a velocity snap");
      turns++;
    }
  }
  assert.ok(bends >= 2 && turns >= 1);
  assert.equal(state.fox, null);
});

test("long update slices keep the fox articulated and visits still finish", () => {
  for (const seed of [1, 2, 6, 8]) {
    const state = visit(seed);
    for (let i = 0; i < 180 && state.fox; i++) {
      Wildlife.advance(state, 0.75);
      if (!state.fox) continue;
      const fox = state.fox;
      assert.ok(Number.isFinite(fox.x) && Number.isFinite(fox.y));
      for (const foot of fox.rig.feet) {
        assert.ok(Math.abs(foot.x - fox.x) < 30, "a delayed frame cannot leave a paw a stride behind");
        assert.ok(Math.abs(foot.y - fox.y) < 16, "contacts stay inside the drawn anatomy");
      }
    }
    assert.equal(state.fox, null);
  }
});
