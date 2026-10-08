"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function findExecutable() {
  if (process.platform === "linux") return path.join(dist, "linux-unpacked", "macrobay");
  if (process.platform === "win32") return path.join(dist, "win-unpacked", "MacroBay.exe");
  if (process.platform === "darwin") {
    const folder = fs.readdirSync(dist).find((name) => /^mac(?:-|$)/.test(name));
    if (!folder) return null;
    return path.join(dist, folder, "MacroBay.app", "Contents", "MacOS", "MacroBay");
  }
  return null;
}

const executable = findExecutable();
if (!executable || !fs.existsSync(executable)) {
  console.error("Packaged MacroBay executable was not found for this platform.");
  process.exit(1);
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "macrobay-packaged-smoke-"));
const args = ["--headless", "--disable-gpu", "--user-data-dir=" + userDataDir];
if (process.platform === "linux") args.unshift("--no-sandbox", "--disable-setuid-sandbox");
const app = spawn(executable, args, {
  cwd: root,
  env: Object.assign({}, process.env, { ELECTRON_DISABLE_SECURITY_WARNINGS: "true" }),
  stdio: ["ignore", "ignore", "pipe"]
});

let stderr = "";
let finished = false;
const removeUserData = () => fs.rmSync(userDataDir, { recursive: true, force: true });
app.once("exit", removeUserData);
app.once("error", removeUserData);
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
  console.log("PASS packaged MacroBay remained running for 6 seconds.");
}).catch((error) => {
  console.error(error.message);
  if (stderr) console.error(stderr);
  process.exitCode = 1;
});
