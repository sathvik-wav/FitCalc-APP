"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function findExecutable() {
  if (process.platform === "linux") return path.join(dist, "linux-unpacked", "fitcalc");
  if (process.platform === "win32") return path.join(dist, "win-unpacked", "FitCalc.exe");
  if (process.platform === "darwin") {
    const folder = fs.readdirSync(dist).find((name) => /^mac(?:-|$)/.test(name));
    if (!folder) return null;
    return path.join(dist, folder, "FitCalc.app", "Contents", "MacOS", "FitCalc");
  }
  return null;
}

const executable = findExecutable();
if (!executable || !fs.existsSync(executable)) {
  console.error("Packaged FitCalc executable was not found for this platform.");
  process.exit(1);
}

const args = ["--headless", "--disable-gpu"];
if (process.platform === "linux") args.unshift("--no-sandbox", "--disable-setuid-sandbox");
const app = spawn(executable, args, {
  cwd: root,
  env: Object.assign({}, process.env, { ELECTRON_DISABLE_SECURITY_WARNINGS: "true" }),
  stdio: ["ignore", "ignore", "pipe"]
});

let stderr = "";
let finished = false;
const startup = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    finished = true;
    app.kill("SIGTERM");
    resolve();
  }, 6000);
  app.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  app.once("error", (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  app.once("exit", (code, signal) => {
    if (finished) return;
    clearTimeout(timeout);
    reject(new Error(`Packaged app exited before the smoke window (${code ?? signal}).`));
  });
});

startup.then(() => {
  if (/FATAL:|Uncaught (?:Exception|Error)/.test(stderr)) {
    console.error(stderr);
    process.exitCode = 1;
    return;
  }
  console.log("PASS packaged FitCalc remained running for 6 seconds.");
}).catch((error) => {
  console.error(error.message);
  if (stderr) console.error(stderr);
  process.exitCode = 1;
});
