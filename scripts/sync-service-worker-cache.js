"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const workerPath = path.join(root, "service-worker.js");
const worker = fs.readFileSync(workerPath, "utf8");
const cacheLine = /^const CACHE_NAME = "macrobay-app-shell-v[^"]+";$/m;

if (!packageInfo.version || !cacheLine.test(worker)) {
  throw new Error("Could not find the service worker cache version to sync.");
}

const nextWorker = worker.replace(cacheLine, `const CACHE_NAME = "macrobay-app-shell-v${packageInfo.version}";`);
if (nextWorker !== worker) {
  fs.writeFileSync(workerPath, nextWorker);
}
console.log(`Service worker cache set to MACROBAY ${packageInfo.version}.`);
