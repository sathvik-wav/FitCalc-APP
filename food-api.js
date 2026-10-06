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
    const kcalValue = n["energy-kcal_100g"] ?? n["energy-kcal"];
    const hasKcal = kcalValue !== undefined && kcalValue !== null && kcalValue !== "" && Number.isFinite(Number(kcalValue));
    const kjValue = n.energy_100g;
    const hasKj = kjValue !== undefined && kjValue !== null && kjValue !== "" && Number.isFinite(Number(kjValue));
    return {
        name: name,
        calories: hasKcal ? Number(kcalValue) : (hasKj ? Number(kjValue) / 4.184 : 0),
        caloriesMissing: !hasKcal && !hasKj,
        protein: Number(n.proteins_100g ?? 0) || 0,
        carbs: Number(n.carbohydrates_100g ?? 0) || 0,
        fat: Number(n.fat_100g ?? 0) || 0,
        fiber: Number(n.fiber_100g ?? 0) || 0,
        source: "Open Food Facts",
        barcode: String(product.code || "")
    };
}

async function requestOpenFoodFacts(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "omit" });
    if (!response.ok) throw new Error("Food database returned HTTP " + response.status + ".");
    return response.json();
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
        fields: "product_name,product_name_en,brands,code,nutriments"
    });
    const data = await requestOpenFoodFacts(OPEN_FOOD_FACTS_API + "/cgi/search.pl?" + params.toString());
    return (Array.isArray(data.products) ? data.products : []).map(normalizeOpenFoodFactsProduct).filter(Boolean);
}

async function lookupOpenFoodFactsBarcode(barcode) {
    const code = String(barcode || "").replace(/\s/g, "");
    if (!/^\d{8,14}$/.test(code)) throw new Error("Enter a barcode with 8 to 14 digits.");
    const params = new URLSearchParams({ fields: "code,product_name,product_name_en,nutriments" });
    const data = await requestOpenFoodFacts(OPEN_FOOD_FACTS_API + "/api/v3/product/" + encodeURIComponent(code) + "?" + params.toString());
    if (!data || !data.product || !String(data.status || "").startsWith("success")) throw new Error("That barcode is not in the food database.");
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
    if (food.caloriesMissing) {
        setFoodApiStatus(food.name + " selected. Calories are unavailable for this product; check the label.", "warning");
    } else {
        setFoodApiStatus(food.name + " selected. Set the amount and add it to your log.", "success");
    }
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
        details.textContent = Math.round(food.calories) + " kcal · " + Math.round(food.protein) + "g protein per 100g";
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
        setFoodApiStatus((error.message || "The food database could not be reached.") + " The built-in food list remains available.", "error");
        if (!/^Enter at least/.test(error.message || "")) {
            renderFoodApiRetry("Search failed. Check your connection and try again.", "Retry search", searchFoodDatabase);
        } else if (root) {
            root.textContent = "Enter at least two letters to search the food database.";
        }
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
        setFoodApiStatus(error.message, "error");
        if (!/^Enter a barcode|^That barcode|^The product has no usable/.test(error.message || "")) {
            renderFoodApiRetry("Lookup failed. Check your connection and try again.", "Retry lookup", lookupBarcodeInput);
        }
    }
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
