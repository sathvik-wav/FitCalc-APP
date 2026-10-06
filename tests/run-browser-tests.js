"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const electronPath = require("electron");
const result = spawnSync(electronPath, [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--headless",
  path.join(__dirname, "browser-harness.js")
], {
  cwd: path.resolve(__dirname, ".."),
  env: Object.assign({}, process.env, { ELECTRON_DISABLE_SECURITY_WARNINGS: "true" }),
  stdio: "inherit",
  timeout: 180000
});

if (result.error) {
  console.error("Could not launch the Electron browser tests:", result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status === null ? 1 : result.status;
}
