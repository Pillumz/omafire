"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(name, imports = {}) {
  const file = path.join(__dirname, "../../ui/fire", name);
  const source = fs.readFileSync(file, "utf8")
    .replace(/^\.pragma library\s*/, "")
    .replace(/^\.import .+$/gm, "");
  const context = vm.createContext({ ...imports, module: { exports: {} } });
  vm.runInContext(source, context, { filename: file });
  return context.module.exports;
}
function loadWildlife() {
  return load("wildlife.js", { Rig: load("fox-rig.js") });
}
function loadFox() { return load("fox.js"); }
module.exports = { loadWildlife, loadFox };
