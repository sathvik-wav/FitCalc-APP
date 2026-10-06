"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const electronPath = require("electron");
const browserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fitcalc-browser-tests-"));
let result;
try {
  result = spawnSync(electronPath, [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--headless",
    "--user-data-dir=" + browserDataDir,
    path.join(__dirname, "browser-harness.js")
  ], {
    cwd: path.resolve(__dirname, ".."),
    env: Object.assign({}, process.env, { ELECTRON_DISABLE_SECURITY_WARNINGS: "true" }),
    stdio: "inherit",
    timeout: 180000
  });
} finally {
  fs.rmSync(browserDataDir, { recursive: true, force: true });
}

if (result.error) {
  console.error("Could not launch the Electron browser tests:", result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status === null ? 1 : result.status;
}
