// Generated from package.json by scripts/sync-service-worker-cache.js before each build.
// Update this value by bumping the package version and running `npm run build`.
const CACHE_NAME = "macrobay-app-shell-v1.1.22";
// Page CSP connect-src origins: https://world.openfoodfacts.org,
// https://search.openfoodfacts.org, and https://api.nal.usda.gov. This worker
// leaves external food API requests uncached.
const APP_SHELL = [
    "./index.html", "./main.css", "./script.js", "./theme-init.js", "./calculators.js", "./constants.js", "./store.js", "./manifest.webmanifest",
    "./calculator-directory.js", "./bmi-unit-toggle.js", "./settings.js",
    "./target.js", "./profile.js", "./foods-india.js", "./nutrition.js", "./food-api.js", "./planner.js",
    "./workout.js", "./exercise-api.js", "./progress.js", "./history.js",
    "./dashboard.js", "./adaptive.js", "./foods-usda.json", "./assets/icon.png", "./assets/fonts/Inter-Variable.ttf",
    "./profile/index.html", "./nutrition/index.html", "./planner/index.html", "./history/index.html", "./calculators/index.html", "./settings/index.html",
    "./bmi/index.html", "./bmr/index.html", "./bodyfat/index.html", "./calories/index.html",
    "./idealweight/index.html", "./macro/index.html", "./maxhr/index.html", "./protein/index.html",
    "./resttimer/index.html", "./sleep/index.html", "./water/index.html",
    "./steptocalories/index.html", "./exercisecalories/index.html"
];
const OPTIONAL_APP_SHELL = [
    "./build/icon.iconset/icon_128x128.png",
    "./build/icon.iconset/icon_512x512.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
        return cache.addAll(APP_SHELL).then(function () {
            return Promise.all(OPTIONAL_APP_SHELL.map(function (path) {
                return cache.add(path).catch(function () {});
            }));
        }).then(function () { return self.skipWaiting(); });
    }));
});

self.addEventListener("activate", function (event) {
    event.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (key) { return key.startsWith("macrobay-app-shell-") && key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
    const request = event.request;
    const requestUrl = new URL(request.url);
    if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;
    if (request.mode === "navigate") {
        event.respondWith(fetch(request).then(function (response) {
            if (!response.ok) return response;
            const copy = response.clone();
            return caches.open(CACHE_NAME).then(function (cache) {
                return cache.put(request, copy).catch(function () {}).then(function () { return response; });
            });
        }).catch(function () {
            return caches.match(request, { ignoreSearch: true }).then(function (cached) {
                if (cached) return cached;
                if (requestUrl.pathname.endsWith("/")) {
                    return caches.match(requestUrl.pathname + "index.html").then(function (directoryIndex) {
                        return directoryIndex || caches.match("./index.html");
                    });
                }
                return caches.match("./index.html");
            });
        }));
        return;
    }

    const networkFirst = request.destination === "script" || request.destination === "style" ||
        request.destination === "document" || /\.(?:js|css|html)$/i.test(requestUrl.pathname);
    if (networkFirst) {
        event.respondWith(fetch(request).then(function (response) {
            if (!response.ok) {
                return caches.match(request).then(function (cached) { return cached || response; });
            }
            const copy = response.clone();
            return caches.open(CACHE_NAME).then(function (cache) {
                return cache.put(request, copy).catch(function () {}).then(function () { return response; });
            });
        }).catch(function () {
            return caches.match(request);
        }));
        return;
    }

    const update = fetch(request).then(function (response) {
        if (response.ok) {
            const copy = response.clone();
            return caches.open(CACHE_NAME).then(function (cache) {
                return cache.put(request, copy).then(function () { return response; });
            });
        }
        return response;
    });
    event.waitUntil(update.then(function () {}, function () {}));
    event.respondWith(caches.match(request).then(function (cached) {
        return cached || update;
    }));
});
