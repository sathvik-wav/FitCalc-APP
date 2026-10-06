/* Public read-only food search and barcode adapter for Open Food Facts. */
const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org";
let barcodeStream = null;
let barcodeFrame = null;
let barcodeDetector = null;

function normalizeOpenFoodFactsProduct(product) {
    if (!product || typeof product !== "object") return null;
    const n = product.nutriments || {};
    const name = String(product.product_name || product.product_name_en || "").trim();
    if (!name) return null;
    const hasNutrition = ["energy-kcal_100g", "energy_100g", "proteins_100g", "carbohydrates_100g", "fat_100g", "fiber_100g"]
        .some(function (key) { return n[key] !== undefined && n[key] !== null && n[key] !== "" && Number.isFinite(Number(n[key])); });
    if (!hasNutrition) return null;
    const kcalValue = n["energy-kcal_100g"];
    const hasKcal = kcalValue !== undefined && kcalValue !== null && kcalValue !== "" && Number.isFinite(Number(kcalValue));
    const kjValue = n.energy_100g;
    const hasKj = kjValue !== undefined && kjValue !== null && kjValue !== "" && Number.isFinite(Number(kjValue));
    const nutrient = function (key) {
        const value = n[key];
        return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value))
            ? Number(value)
            : null;
    };
    const calories = hasKcal ? Number(kcalValue) : (hasKj ? Number(kjValue) / 4.184 : null);
    const macros = {
        calories: calories,
        protein: nutrient("proteins_100g"),
        carbs: nutrient("carbohydrates_100g"),
        fat: nutrient("fat_100g"),
        fiber: nutrient("fiber_100g")
    };
    const missingNutrients = Object.keys(macros).filter(function (key) { return macros[key] === null; });
    const servingGrams = parseOpenFoodFactsServingGrams(product.serving_size);
    const unitGrams = {};
    const units = ["g"];
    if (servingGrams) units.push("serving");
    return {
        name: name,
        calories: calories,
        caloriesMissing: !hasKcal && !hasKj,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        missingNutrients: missingNutrients,
        servingGrams: servingGrams,
        unitGrams: unitGrams,
        units: units,
        defaultUnit: servingGrams ? "serving" : "g",
        preparation: "",
        source: "Open Food Facts",
        barcode: String(product.code || "")
    };
}

function parseOpenFoodFactsServingGrams(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const match = text.match(/(?:^|[,(\s])(?:about\s*)?(\d+(?:[.,]\d+)?)\s*(g|grams?|ml|millilit(?:er|re)s?)\b/i);
    if (!match) return null;
    const amount = Number(match[1].replace(",", "."));
    return Number.isFinite(amount) && amount > 0 && amount <= 5000 ? amount : null;
}

function createFoodApiError(message, kind, status) {
    const error = new Error(message);
    error.kind = kind || "http";
    if (status !== undefined) error.status = status;
    return error;
}

async function requestOpenFoodFacts(url, options) {
    const settings = Object.assign({ timeoutMs: 0, retries: 0, retryDelayMs: 250 }, options || {});
    for (let attempt = 0; ; attempt += 1) {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        let timeoutId = null;
        try {
            const request = fetch(url, {
                headers: { Accept: "application/json" }, credentials: "omit",
                ...(controller ? { signal: controller.signal } : {})
            });
            let response;
            if (settings.timeoutMs > 0) {
                response = await Promise.race([
                    request,
                    new Promise(function (_resolve, reject) {
                        timeoutId = setTimeout(function () {
                            if (controller) controller.abort();
                            reject(createFoodApiError("Food database request timed out.", "timeout"));
                        }, settings.timeoutMs);
                    })
                ]);
            } else {
                response = await request;
            }
            if (!response.ok) {
                const status = Number(response.status) || 0;
                const kind = status === 429 || status >= 500 ? "service" : (status === 404 ? "notFound" : "http");
                throw createFoodApiError("Food database returned HTTP " + status + ".", kind, status);
            }
            return await response.json();
        } catch (error) {
            const failure = error && error.kind ? error : createFoodApiError(error && error.message || "Food database request failed.", "network");
            const retryable = failure.kind === "network" || failure.kind === "timeout" || failure.kind === "service";
            if (attempt >= settings.retries || !retryable) throw failure;
            await new Promise(function (resolve) { setTimeout(resolve, settings.retryDelayMs); });
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
        }
    }
}

async function searchOpenFoodFacts(query) {
    const value = String(query || "").trim();
    if (value.length < 2) throw new Error("Enter at least two letters to search.");
    const params = new URLSearchParams({
        search_terms: value,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "12",
        fields: "product_name,product_name_en,brands,code,nutriments,serving_size"
    });
    const data = await requestOpenFoodFacts(OPEN_FOOD_FACTS_API + "/cgi/search.pl?" + params.toString(), {
        timeoutMs: 8000, retries: 1, retryDelayMs: 300
    });
    return (Array.isArray(data.products) ? data.products : []).map(normalizeOpenFoodFactsProduct).filter(Boolean);
}

async function lookupOpenFoodFactsBarcode(barcode) {
    const code = String(barcode || "").replace(/\s/g, "");
    if (!/^\d{8,14}$/.test(code)) throw new Error("Enter a barcode with 8 to 14 digits.");
    const params = new URLSearchParams({ fields: "code,product_name,product_name_en,nutriments,serving_size" });
    let data;
    try {
        data = await requestOpenFoodFacts(OPEN_FOOD_FACTS_API + "/api/v3/product/" + encodeURIComponent(code) + "?" + params.toString());
    } catch (error) {
        if (error.status === 404 || error.kind === "notFound") {
            throw createFoodApiError("Barcode not found. Add it as a custom food instead.", "notFound", 404);
        }
        throw error;
    }
    if (!data || !data.product || !String(data.status || "").startsWith("success")) {
        throw createFoodApiError("Barcode not found. Add it as a custom food instead.", "notFound", 404);
    }
    const product = normalizeOpenFoodFactsProduct(Object.assign({ code: code }, data.product));
    if (!product) throw new Error("The product has no usable nutrition values in the database.");
    return product;
}

function setFoodApiStatus(message, state) {
    const el = document.getElementById("food-api-status");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.state = state || "";
}

function chooseFoodFromApi(food) {
    window.fitcalcPendingFood = food;
    const name = document.getElementById("food-name");
    if (name) name.value = food.name;
    if (typeof window.updateNutritionFoodUnits === "function") window.updateNutritionFoodUnits(food);
    const missing = Array.isArray(food.missingNutrients)
        ? food.missingNutrients
        : (food.caloriesMissing ? ["calories"] : []);
    if (missing.length) {
        const labels = { calories: "calories", protein: "protein", carbs: "carbohydrates", fat: "fat", fiber: "fiber" };
        setFoodApiStatus(food.name + " selected. " + missing.map(function (key) { return labels[key] || key; }).join(", ") + " unavailable; missing values will stay marked as unknown. Check the package label.", "warning");
    } else {
        setFoodApiStatus(food.name + " selected. Set the amount and add it to your log.", "success");
    }
    const amount = document.getElementById("food-amount");
    if (amount && !amount.value) amount.value = document.getElementById("food-amount-unit")?.value === "g" ? "100" : "1";
    if (typeof window.updateNutritionFoodPreview === "function") window.updateNutritionFoodPreview();
    document.getElementById("food-amount")?.focus();
}

function renderFoodApiResults(foods) {
    const root = document.getElementById("food-api-results");
    if (!root) return;
    root.replaceChildren();
    if (!foods.length) {
        root.textContent = "No matching products with nutrition data were found. You can still log foods from the built-in list.";
        return;
    }
    foods.forEach(function (food) {
        const card = document.createElement("div");
        card.className = "integration-result";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = food.name;
        const details = document.createElement("small");
        const calories = food.calories === null ? "—" : Math.round(food.calories);
        const protein = food.protein === null ? "—" : Math.round(food.protein);
        details.textContent = calories + " kcal · " + protein + "g protein per 100g" +
            (Array.isArray(food.missingNutrients) && food.missingNutrients.length ? " · incomplete data" : "");
        info.append(title, details);
        const select = document.createElement("button");
        select.type = "button";
        select.className = "secondary-btn";
        select.textContent = "Use";
        select.addEventListener("click", function () { chooseFoodFromApi(food); });
        card.append(info, select);
        root.appendChild(card);
    });
}

function renderFoodApiRetry(message, retryLabel, retry) {
    const root = document.getElementById("food-api-results");
    if (!root) return;
    root.replaceChildren();
    const note = document.createElement("p");
    note.className = "integration-error-copy";
    note.textContent = message;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn";
    button.textContent = retryLabel || "Retry";
    button.addEventListener("click", retry);
    root.append(note, button);
}

async function searchFoodDatabase() {
    const input = document.getElementById("food-database-search");
    const query = input ? input.value : "";
    setFoodApiStatus("Searching Open Food Facts…", "loading");
    const root = document.getElementById("food-api-results");
    if (root) root.replaceChildren();
    try {
        const products = await searchOpenFoodFacts(query);
        renderFoodApiResults(products);
        setFoodApiStatus(products.length ? "Found " + products.length + " products." : "No matching products found.", "success");
    } catch (error) {
        if (/^Enter at least/.test(error.message || "")) {
            setFoodApiStatus(error.message, "error");
            root.textContent = "Enter at least two letters to search the food database.";
            return;
        }
        const matches = typeof searchBuiltInFoodList === "function" ? searchBuiltInFoodList(query) : [];
        renderFoodApiResults(matches);
        const failureText = error.kind === "network" || error.kind === "timeout"
            ? "Open Food Facts could not be reached; matching built-in foods are shown below."
            : "Open Food Facts search is temporarily unavailable; matching built-in foods are shown below.";
        setFoodApiStatus(failureText, "warning");
    }
}

async function lookupBarcodeInput() {
    const input = document.getElementById("food-barcode");
    try {
        setFoodApiStatus("Looking up barcode…", "loading");
        const product = await lookupOpenFoodFactsBarcode(input ? input.value : "");
        chooseFoodFromApi(product);
        if (input) input.value = product.barcode;
    } catch (error) {
        setFoodApiStatus(error.message || "Food database lookup failed.", error.kind === "notFound" ? "warning" : "error");
        if (error.kind === "network" || error.kind === "timeout") {
            renderFoodApiRetry("Lookup failed because the food database could not be reached. Check your connection and try again.", "Retry lookup", lookupBarcodeInput);
        } else if (error.kind === "service") {
            renderFoodApiRetry("The food database is temporarily unavailable. Try again shortly.", "Retry lookup", lookupBarcodeInput);
        }
    }
}

function updateBarcodeCameraAvailability() {
    const button = document.getElementById("start-barcode-camera");
    const hint = document.getElementById("barcode-camera-hint");
    const hasCameraApi = typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
    const supported = typeof BarcodeDetector === "function" && !!hasCameraApi;
    if (button) button.hidden = !supported;
    if (hint) hint.hidden = supported;
}

function stopBarcodeCamera(message) {
    if (barcodeFrame !== null) cancelAnimationFrame(barcodeFrame);
    barcodeFrame = null;
    if (barcodeStream) barcodeStream.getTracks().forEach(function (track) { track.stop(); });
    barcodeStream = null;
    const video = document.getElementById("barcode-camera");
    if (video) { video.pause(); video.srcObject = null; video.hidden = true; }
    const stop = document.getElementById("stop-barcode-camera");
    if (stop) stop.hidden = true;
    if (message) setFoodApiStatus(message, "");
}

async function startBarcodeCamera() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
        setFoodApiStatus("Camera access is unavailable here. Enter the barcode manually.", "error");
        return;
    }
    if (typeof BarcodeDetector !== "function") {
        setFoodApiStatus("This browser does not support built-in barcode detection. Enter the barcode manually.", "error");
        return;
    }
    try {
        const supported = typeof BarcodeDetector.getSupportedFormats === "function"
            ? await BarcodeDetector.getSupportedFormats()
            : ["ean_13", "ean_8", "upc_a", "upc_e"];
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e"].filter(function (format) { return supported.includes(format); });
        if (!formats.length) throw new Error("This browser cannot detect common retail barcode formats.");
        barcodeDetector = new BarcodeDetector({ formats: formats });
        barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        const video = document.getElementById("barcode-camera");
        video.srcObject = barcodeStream;
        video.hidden = false;
        await video.play();
        document.getElementById("stop-barcode-camera").hidden = false;
        setFoodApiStatus("Camera is on. Hold the barcode in view.", "loading");
        const scan = async function () {
            if (!barcodeStream || video.readyState < 2) { barcodeFrame = requestAnimationFrame(scan); return; }
            try {
                const codes = await barcodeDetector.detect(video);
                if (codes.length && codes[0].rawValue) {
                    document.getElementById("food-barcode").value = codes[0].rawValue;
                    stopBarcodeCamera("Barcode detected. Looking up product…");
                    await lookupBarcodeInput();
                    return;
                }
            } catch (error) {
                stopBarcodeCamera("Could not scan this frame. Enter the barcode manually.");
                return;
            }
            barcodeFrame = requestAnimationFrame(scan);
        };
        barcodeFrame = requestAnimationFrame(scan);
    } catch (error) {
        stopBarcodeCamera();
        setFoodApiStatus(error.name === "NotAllowedError" ? "Camera permission was denied. Enter the barcode manually." : (error.message || "Camera could not be started."), "error");
    }
}

document.getElementById("search-food-database")?.addEventListener("click", searchFoodDatabase);
document.getElementById("food-database-search")?.addEventListener("keydown", function (event) { if (event.key === "Enter") searchFoodDatabase(); });
document.getElementById("lookup-food-barcode")?.addEventListener("click", lookupBarcodeInput);
document.getElementById("food-barcode")?.addEventListener("keydown", function (event) { if (event.key === "Enter") lookupBarcodeInput(); });
document.getElementById("start-barcode-camera")?.addEventListener("click", startBarcodeCamera);
document.getElementById("stop-barcode-camera")?.addEventListener("click", function () { stopBarcodeCamera("Camera stopped."); });
window.addEventListener("pagehide", function () { stopBarcodeCamera(); });
updateBarcodeCameraAvailability();
