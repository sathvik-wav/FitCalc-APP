"use strict";

const { app, BrowserWindow, protocol } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const browserAssetToken = Date.now() + "-" + process.pid;
const pages = [
  "tests/browser.html",
  "tests/ui-dashboard-live.html",
  "tests/ui-planner-render.html",
  "tests/ui-planner-templates.html",
  "tests/ui-nutrition-flow.html",
  "tests/ui-tablet.html",
  "tests/ui-responsive-audit.html",
  "tests/ui-smoke.html"
];
const mimeTypes = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf"
};

protocol.registerSchemesAsPrivileged([{
  scheme: "macrobay",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

function finish(code) {
  app.exit(code);
}

app.whenReady().then(async function () {
  protocol.handle("macrobay", async function (request) {
    let relative;
    try { relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, ""); }
    catch (_) { return new Response("Bad request", { status: 400 }); }
    if (!relative) relative = "index.html";
    if (relative.endsWith("/")) relative += "index.html";
    const filePath = path.resolve(root, relative);
    if (!filePath.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });
    try {
      let body = await fs.promises.readFile(filePath);
      if (path.extname(filePath).toLowerCase() === ".html" && !relative.startsWith("tests/")) {
        const freshHtml = body.toString("utf8").replace(/(href=["'][^"']*main\.css)(\?[^"']*)?(["'])/g, "$1?browser-test=" + browserAssetToken + "$3");
        body = Buffer.from(freshHtml);
      }
      const headers = { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" };
      if (path.extname(filePath).toLowerCase() === ".html" && !relative.startsWith("tests/")) {
        headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.openfoodfacts.org; font-src 'self'; connect-src 'self' https://world.openfoodfacts.org https://search.openfoodfacts.org https://api.nal.usda.gov https://wger.de https://api.wger.de; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'";
      }
      return new Response(body, { headers });
    } catch (_) {
      return new Response("Not found", { status: 404 });
    }
  });

  const win = new BrowserWindow({
    show: false,
    width: 1366,
    height: 1000,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  await win.webContents.session.clearCache();
  let failures = 0;
  win.webContents.on("console-message", function (event) {
    const level = event.level;
    const message = event.message || "";
    if (message.includes("Electron Security Warning")) return;
    if (level === "error" && !/Failed to load resource: net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED)/.test(message)) {
      console.error("Browser console error:", message);
      if (/^Uncaught\b|^Failed to load resource:/.test(message)) failures += 1;
    }
  });
  win.webContents.on("render-process-gone", function (_event, details) {
    console.error("Browser renderer exited:", details.reason);
    finish(1);
  });

  for (const page of pages) {
    const url = "macrobay://app/" + page;
    console.log("Browser check:", page);
    try {
      await win.loadURL(url);
      const started = Date.now();
      let result;
      while (Date.now() - started < 25000) {
        result = await win.webContents.executeJavaScript(`({result:document.body.dataset.result || (document.querySelector('#results') && document.querySelector('#results').dataset.result) || '', title:document.title, output:(document.querySelector('#results') && document.querySelector('#results').textContent) || ''})`);
        if (result.result === "pass" || result.result === "fail" || /^(PASS|FAIL)/.test(result.title)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (result && (result.result === "pass" || /^(PASS)/.test(result.title))) {
        console.log(result.output.trim() || result.title);
      } else {
        failures += 1;
        console.error(result && result.output ? result.output.trim() : `${page} did not finish its browser checks.`);
      }
    } catch (error) {
      failures += 1;
      console.error(`${page}: ${error.message}`);
    }
  }

  console.log("Browser check: dynamic preview routes use explicit page files");
  for (const route of ["calories/", "calories"]) {
    try {
      await win.loadURL("macrobay://app/tests/ui-preview.html?route=" + encodeURIComponent(route));
      const started = Date.now();
      let preview;
      while (Date.now() - started < 10000) {
        preview = await win.webContents.executeJavaScript(`(() => {
          const frame = document.getElementById("preview");
          return {
            source: frame.src,
            pathname: new URL(frame.src).pathname,
            loaded: !!(frame.contentDocument && frame.contentDocument.querySelector(".calc-page"))
          };
        })()`);
        if (preview.loaded) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!preview || !preview.loaded || !preview.pathname.endsWith("/calories/index.html")) {
        throw new Error(`Preview route ${route} did not load the explicit calculator index file`);
      }
      console.log(`PASS ${route} → ${preview.pathname}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL preview route ${route}:`, error.message);
    }
  }

  console.log("Browser check: explicit navigation over HTTP/PWA origin");
  const webServer = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch (_) { response.writeHead(400).end("Bad request"); return; }
    if (pathname.endsWith("/")) { response.writeHead(404).end("Directory URLs are not served"); return; }
    const filePath = path.resolve(root, "." + pathname);
    if (!filePath.startsWith(root + path.sep)) { response.writeHead(403).end("Forbidden"); return; }
    fs.readFile(filePath, (error, data) => {
      if (error) { response.writeHead(404).end("Not found"); return; }
      const headers = { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" };
      if (path.extname(filePath).toLowerCase() === ".html") {
        headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.openfoodfacts.org; font-src 'self'; connect-src 'self' https://world.openfoodfacts.org https://search.openfoodfacts.org https://api.nal.usda.gov https://wger.de https://api.wger.de; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'";
      }
      response.writeHead(200, headers).end(data);
    });
  });
  try {
    await new Promise((resolve, reject) => {
      webServer.once("error", reject);
      webServer.listen(0, "127.0.0.1", resolve);
    });
    const origin = "http://127.0.0.1:" + webServer.address().port;
    await win.loadURL(origin + "/calories/index.html");
    const startPage = await win.webContents.executeJavaScript(`(() => {
      const brand = document.querySelector(".brand");
      return {
        protocol: location.protocol,
        target: brand && new URL(brand.getAttribute("href"), location.href).href,
        serviceWorkerAvailable: "serviceWorker" in navigator
      };
    })()`);
    if (startPage.protocol !== "http:" || startPage.target !== origin + "/index.html" || !startPage.serviceWorkerAvailable) {
      throw new Error("Browser/PWA page did not expose an explicit HTTP index.html home target");
    }
    const navigationFinished = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);
      win.webContents.once("did-finish-load", () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
    await win.webContents.executeJavaScript('document.querySelector(".brand").click()');
    if (!(await navigationFinished)) throw new Error("Clicking the HTTP home link did not finish navigation");
    const destinationPage = await win.webContents.executeJavaScript(`({
      protocol: location.protocol,
      pathname: location.pathname,
      homeLoaded: !!document.querySelector(".dashboard-page")
    })`);
    if (destinationPage.protocol !== "http:" || destinationPage.pathname !== "/index.html" || !destinationPage.homeLoaded) {
      throw new Error("HTTP home navigation did not load the MacroBay dashboard from index.html");
    }
    console.log("PASS calculator → home uses an explicit HTTP index.html URL");
  } catch (error) {
    failures += 1;
    console.error("FAIL HTTP/PWA navigation:", error.message);
  } finally {
    await new Promise((resolve) => webServer.close(resolve));
  }

  console.log("Browser check: explicit navigation on file:// URLs");
  try {
    await win.loadURL(pathToFileURL(path.join(root, "calories/index.html")).href);
    const startingPage = await win.webContents.executeJavaScript(`(() => {
      const brand = document.querySelector(".brand");
      return {
        protocol: location.protocol,
        brandTarget: brand && new URL(brand.getAttribute("href"), location.href).pathname,
        source: location.pathname
      };
    })()`);
    if (startingPage.protocol !== "file:" || !startingPage.brandTarget || !startingPage.brandTarget.endsWith("/index.html")) {
      throw new Error("Calculator home link did not resolve to an explicit local index.html file");
    }

    const navigationFinished = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);
      win.webContents.once("did-finish-load", () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
    await win.webContents.executeJavaScript('document.querySelector(".brand").click()');
    if (!(await navigationFinished)) throw new Error("Clicking the calculator home link did not finish navigation");
    const destinationPage = await win.webContents.executeJavaScript(`({
      protocol: location.protocol,
      pathname: location.pathname,
      homeLoaded: !!document.querySelector(".dashboard-page")
    })`);
    if (destinationPage.protocol !== "file:" || !destinationPage.pathname.endsWith("/index.html") || !destinationPage.homeLoaded) {
      throw new Error("Explicit file:// home navigation did not load the MacroBay dashboard");
    }
    console.log("PASS calculator → home uses an explicit index.html file URL");
  } catch (error) {
    failures += 1;
    console.error("FAIL file:// navigation:", error.message);
  }

  win.destroy();
  finish(failures ? 1 : 0);
}).catch(function (error) {
  console.error(error.stack || error.message);
  finish(1);
});
