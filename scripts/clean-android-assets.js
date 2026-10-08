"use strict";

const fs = require("fs");
const path = require("path");

const assetsRoot = path.resolve(__dirname, "../android/app/src/main/assets/public");
fs.rmSync(assetsRoot, { recursive: true, force: true });
console.log("Cleared Android public assets before sync.");
