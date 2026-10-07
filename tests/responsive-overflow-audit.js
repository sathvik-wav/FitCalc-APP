"use strict";

const { app, BrowserWindow, protocol } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(os.tmpdir(), "macrobay-responsive-audit");
const browserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "macrobay-responsive-data-"));
const widths = [360, 375, 430];
const baseHeight = 844;

protocol.registerSchemesAsPrivileged([{ scheme: "macrobay", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setPath("userData", browserDataDir);
app.setPath("sessionData", browserDataDir);

function listPages(dir, relative) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(function (entry) {
    if (entry.isDirectory()) {
      if (["node_modules", "tests", "android", "ios", ".git", "build", "netlify-dist"].includes(entry.name)) return [];
      return listPages(path.join(dir, entry.name), path.join(relative, entry.name));
    }
    if (entry.isFile() && entry.name.endsWith(".html")) return [path.join(relative, entry.name)];
    return [];
  }).sort();
}

function safeName(value) { return value.replace(/[^a-z0-9.-]+/gi, "_"); }
function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

app.whenReady().then(async function () {
  protocol.handle("macrobay", async function (request) {
    let relative;
    try { relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, ""); }
    catch (_) { return new Response("Bad request", { status: 400 }); }
    const filePath = path.resolve(root, relative || "index.html");
    if (!filePath.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });
    try {
      const data = await fs.promises.readFile(filePath);
      const type = path.extname(filePath) === ".html" ? "text/html" : path.extname(filePath) === ".css" ? "text/css" : path.extname(filePath) === ".js" ? "text/javascript" : "application/octet-stream";
      return new Response(data, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
    } catch (_) { return new Response("Not found", { status: 404 }); }
  });
  fs.mkdirSync(outputDir, { recursive: true });
  const pages = listPages(root, "");
  const win = new BrowserWindow({
    show: false,
    width: widths[0],
    height: baseHeight,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  await win.loadURL("macrobay://app/index.html");
  await win.webContents.executeJavaScript("localStorage.setItem('macrobay_preferences', JSON.stringify({ onboardingComplete: true, profileSetupDismissed: true, theme: 'dark' }));");
  let issues = 0;
  for (const page of pages) {
    for (const width of widths) {
      win.setContentSize(width, baseHeight);
      if (page === "planner/index.html") await win.webContents.executeJavaScript("localStorage.setItem('macrobay_planner', '{}'); localStorage.setItem('macrobay_workout_templates', '[]');");
      await win.loadURL("macrobay://app/" + page.replace(/\\/g, "/"));
      await wait(120);
      const report = await win.webContents.executeJavaScript(`(() => {
        const visible = el => !!(el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
        const describe = el => {
          const id = el.id ? "#" + el.id : "";
          const classes = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "";
          return el.tagName.toLowerCase() + id + classes;
        };
        const found = [];
        for (const el of document.querySelectorAll("body *")) {
          if (!visible(el)) continue;
          const style = getComputedStyle(el);
          const overflow = el.scrollWidth > el.clientWidth + 1;
          const ellipsis = (style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none") && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
          if (overflow || ellipsis) found.push({ selector: describe(el), overflow: overflow, ellipsis: ellipsis, text: (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 70), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
        }
        return { title: document.title, height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), viewport: innerWidth, issues: found };
      })()`);
      const fileName = safeName(page.replace(/\.html$/, "") || "home") + "-" + width + ".png";
      const screenshot = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outputDir, fileName), screenshot.toPNG());
      if (report.issues.length) {
        issues += report.issues.length;
        console.log("OVERFLOW " + page + " @ " + width + "px: " + JSON.stringify(report.issues));
      }
      if (page === "planner/index.html") {
        await win.webContents.executeJavaScript("document.getElementById('planner-view-workouts').click(); document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.getElementById('planner-workouts-card').getBoundingClientRect().top + window.scrollY);");
        await wait(80);
        const listShot = await win.webContents.capturePage();
        fs.writeFileSync(path.join(outputDir, "planner-workouts-list-" + width + ".png"), listShot.toPNG());
        const sessionState = await win.webContents.executeJavaScript("(() => { const button = document.getElementById('start-empty-workout'); if (!button) return { button: false }; button.click(); const finish = document.getElementById('finish-workout'); return { button: true, hidden: document.getElementById('workout-session').hidden, title: document.getElementById('session-rename') && document.getElementById('session-rename').textContent, finishText: finish && finish.textContent, finishColor: finish && getComputedStyle(finish).color }; })()");
        console.log("Session action " + width + "px: " + JSON.stringify(sessionState));
        if (!sessionState.button || sessionState.hidden) console.log("SESSION OPEN CHECK " + width + "px: " + JSON.stringify(sessionState));
        await wait(160);
        const sessionReport = await win.webContents.executeJavaScript(`(() => Array.from(document.querySelectorAll("body *")).filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none" && (el.scrollWidth > el.clientWidth + 1 || ((getComputedStyle(el).textOverflow === "ellipsis" || getComputedStyle(el).webkitLineClamp !== "none") && el.scrollHeight > el.clientHeight + 1))).map(el => ({ selector: el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""), text: (el.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 60), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })) )()`);
        if (sessionReport.length) { issues += sessionReport.length; console.log("OVERFLOW planner workout session @ " + width + "px: " + JSON.stringify(sessionReport)); }
        const sessionShot = await win.webContents.capturePage();
        fs.writeFileSync(path.join(outputDir, "planner-workout-session-" + width + ".png"), sessionShot.toPNG());
      }
    }
  }
  console.log("Audited " + pages.length + " app pages at " + widths.join(", ") + "px; saved " + (pages.length * widths.length + 6) + " screenshots, including workout list/session views, to " + outputDir + ".");
  console.log(issues ? "Found " + issues + " clipped or overflowing visible elements." : "No visible text overflow or ellipsis clipping found.");
  win.destroy();
  fs.rmSync(browserDataDir, { recursive: true, force: true });
  app.exit(issues ? 1 : 0);
}).catch(function (error) {
  console.error(error);
  fs.rmSync(browserDataDir, { recursive: true, force: true });
  app.exit(1);
});
