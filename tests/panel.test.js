// Panel size: the 3:2 chrome, the saved-width clamps, and the lower-left
// corner drag. The host centers the card, so the corner is one degree of
// freedom and a diagonal drag has to land back on the pointer.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PANEL_JS = path.join(__dirname, "..", "ui", "fire", "panel.js");

function loadPanel() {
  const source = fs.readFileSync(PANEL_JS, "utf8").replace(/^\.pragma library\s*$/m, "");
  const module = { exports: {} };
  const context = vm.createContext({ module, Math, isFinite });
  vm.runInContext(source, context, { filename: PANEL_JS });
  return module.exports;
}

const Panel = loadPanel();

test("width clamps to the button floor and the screen ceiling, else the default", () => {
  assert.equal(Panel.clampWidth(390), 390);
  assert.equal(Panel.clampWidth(299.4), Panel.MIN_WIDTH);
  assert.equal(Panel.clampWidth(960.4), Panel.MAX_WIDTH);
  assert.equal(Panel.clampWidth(520.4), 520);
  assert.equal(Panel.clampWidth(Number.NaN), 390);
  assert.equal(Panel.clampWidth(undefined), 390);
});

test("a drag along the corner path keeps the corner on the pointer", () => {
  // Unclamped: +1 width moves the corner (-1/2, +2/3). A 60 px growth is
  // exactly 30 left and 40 down.
  const grown = Panel.widthAfterCornerDrag(390, -30, 40);
  assert.equal(grown, 450);
  const shrunk = Panel.widthAfterCornerDrag(450, 15, -20);
  assert.equal(shrunk, 420);

  // Right edge pinned to the screen: the corner moves (-1, +2/3) per width.
  const pinned = Panel.widthAfterCornerDrag(600, -30, 20, -1, 2 / 3);
  assert.equal(pinned, 630);
});

test("a drag past either limit stops on the clamp", () => {
  assert.equal(Panel.widthAfterCornerDrag(390, -4000, 4000), Panel.MAX_WIDTH);
  assert.equal(Panel.widthAfterCornerDrag(390, 4000, -4000), Panel.MIN_WIDTH);
});

test("a corner that cannot move does not change the width", () => {
  assert.equal(Panel.widthDeltaForCorner(-40, 30, 0, 0), 0);
  assert.equal(Panel.widthAfterCornerDrag(390, 0, 0), 390);
});
