const { app, BrowserWindow, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

// Keep Electron's original storage directory so its existing localStorage
// origin remains available to the one-time key migration in theme-init.js.
if (!process.argv.some((argument) => argument === "--user-data-dir" || argument.startsWith("--user-data-dir="))) {
    const legacyUserData = path.join(app.getPath("appData"), "FitCalc");
    app.setPath("userData", legacyUserData);
    app.setPath("sessionData", legacyUserData);
}

protocol.registerSchemesAsPrivileged([
    {
        // Chromium localStorage belongs to an origin; preserve the old desktop origin for migration.
        scheme: "fitcalc",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "MACROBAY",
        webPreferences: {
            contextIsolation: true
        }
    });

    // keep the window on the app; open anything external in the browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) { require("electron").shell.openExternal(url); }
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("fitcalc://")) {
            event.preventDefault();
            if (/^https?:/.test(url)) { require("electron").shell.openExternal(url); }
        }
    });

    win.loadURL("fitcalc://app/index.html");
}

app.whenReady().then(() => {

    protocol.handle("fitcalc", async (request) => {
        let url = new URL(request.url);
        let requestedPath;
        try { requestedPath = decodeURIComponent(url.pathname); }
        catch (e) { return new Response("Bad request", { status: 400 }); }

        if (requestedPath === "/") {
            requestedPath = "/index.html";
        }

        // If the URL points to a folder, load its index.html
        if (requestedPath.endsWith("/")) {
            requestedPath += "index.html";
        }

        const filePath = path.resolve(__dirname, "." + requestedPath);
        const normalizedRoot = path.normalize(__dirname + path.sep);

        if (!filePath.startsWith(normalizedRoot)) {
            return new Response("Forbidden", { status: 403 });
}

        const relativePath = path.relative(__dirname, filePath);
        if (relativePath.split(path.sep)[0] === "tests") {
            return new Response("Not found", { status: 404 });
        }

        try {
            const data = await fs.promises.readFile(filePath);

            const ext = path.extname(filePath).toLowerCase();

            const mimeTypes = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "text/javascript",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".webp": "image/webp",
                ".ico": "image/x-icon",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
                ".ttf": "font/ttf"
            };

            const headers = {
                "Content-Type": mimeTypes[ext] || "application/octet-stream"
            };
            if (ext === ".html") {
                headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.openfoodfacts.org; font-src 'self'; connect-src 'self' https://world.openfoodfacts.org https://wger.de https://api.wger.de; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'";
            }

            return new Response(data, {
                headers
            });

        } catch (error) {
            return new Response("File not found", {
                status: 404
            });
        }
    });

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
