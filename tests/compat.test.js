// Omarchy 4.0.x and 4.5 compatibility guards. QML resolves types and
// property assignments when a file is parsed, so one 4.5-only name in a file
// the bar loads stops the whole widget on 4.0.x ("ShellIpc is not a type").
// 4.5-only host API has to stay behind a runtime check. The behaviour on both
// hosts is covered by tests/integration.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./lib/images");

const UI = path.join(ROOT, "ui");
function qmlFiles(dir = UI, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) qmlFiles(p, out);
    else if (name.endsWith(".qml")) out.push(p);
  }
  return out;
}
const rel = p => path.relative(ROOT, p);
const code = p => fs.readFileSync(p, "utf8").replace(/\/\/.*$/gm, "");

test("ShellIpc is named only in the optional IPC file", () => {
  const users = qmlFiles().filter(p => /\bShellIpc\b/.test(code(p))).map(rel);
  assert.deepEqual(users, ["ui/FireIpcShell.qml"]);
});

test("the optional IPC file is loaded at runtime with a 4.0.x fallback", () => {
  const session = code(path.join(UI, "FireSession.qml"));
  assert.match(session, /Qt\.createComponent\("FireIpcShell\.qml"\)/);
  assert.match(session, /Qt\.createComponent\("FireIpcPlain\.qml"\)/);
  const qmldir = fs.readFileSync(path.join(UI, "qmldir"), "utf8");
  assert.doesNotMatch(qmldir, /FireIpc/, "the IPC files must not be registered types");
});

test("both IPC files declare the same calls on the same target", () => {
  const calls = f => {
    const s = code(path.join(UI, f));
    return { target: s.match(/target:\s*(.+)/)[1].trim(), fns: [...s.matchAll(/function\s+(\w+\([^)]*\)\s*:\s*\w+)/g)].map(m => m[1]) };
  };
  const shell = calls("FireIpcShell.qml"), plain = calls("FireIpcPlain.qml");
  assert.deepEqual(shell, plain);
});

test("no 4.5-only KeyboardPanel or Style API at parse time", () => {
  const bad = [];
  for (const p of qmlFiles()) {
    const s = code(p);
    if (/^\s*content\s*:/m.test(s)) bad.push(`${rel(p)}: KeyboardPanel content slot`);
    if (/\bloadedContent\b|\bensureContent\b/.test(s)) bad.push(`${rel(p)}: loadedContent/ensureContent`);
    if (/Style\.reduceMotion(?!\s*===\s*true)/.test(s)) bad.push(`${rel(p)}: Style.reduceMotion read without a fallback`);
  }
  assert.deepEqual(bad, []);
});
