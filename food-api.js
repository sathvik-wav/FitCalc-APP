/* Unified local and remote food search plus Open Food Facts barcode lookup. */
const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org";
const OPEN_FOOD_FACTS_SEARCH_API = "https://search.openfoodfacts.org/search";
const USDA_FOOD_DATA_API = "https://api.nal.usda.gov/fdc/v1/foods/search";
let barcodeStream = null;
let barcodeFrame = null;
let barcodeDetector = null;
let foodSearchTimer = null;
let foodSearchController = null;
let foodSearchVersion = 0;

function createFoodApiError(message, kind, status) {
    const error = new Error(message);
    error.kind = kind || "http";
    if (status !== undefined) error.status = status;
    return error;
}

function foodNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function normalizeFoodSearchResult(food, sourceOverride) {
    if (!food || typeof food !== "object") return null;
    const name = String(food.name || food.product_name || food.product_name_en || food.description || "").trim();
    if (!name) return null;
    const nutrients = {
        calories: foodNumber(food.calories),
        protein: foodNumber(food.protein),
        carbs: foodNumber(food.carbs),
        fat: foodNumber(food.fat),
        fiber: foodNumber(food.fiber)
    };
    if (nutrients.calories === null || nutrients.calories < 0 || nutrients.calories > 900) return null;
    for (const key of ["protein", "carbs", "fat", "fiber"]) {
        if (nutrients[key] !== null && (nutrients[key] < 0 || nutrients[key] > 100)) return null;
    }
    const knownMacros = [nutrients.protein, nutrients.carbs, nutrients.fat].filter(function (value) { return value !== null; });
    if (knownMacros.reduce(function (total, value) { return total + value; }, 0) > 105) return null;

    const unitGrams = Object.assign({}, food.unitGrams || {}, { oz: 28.35 });
    const pieceGrams = foodNumber(food.pieceGrams) || foodNumber(unitGrams.piece);
    const servingGrams = foodNumber(food.servingGrams);
    if (pieceGrams && !unitGrams.piece) unitGrams.piece = pieceGrams;
    const units = Array.isArray(food.units) ? food.units.slice() : ["g"];
    if (pieceGrams && !units.includes("piece")) units.push("piece");
    if (servingGrams && !units.includes("serving")) units.push("serving");
    if (!units.includes("oz")) units.push("oz");
    if (!units.includes("g")) units.unshift("g");
    const missingNutrients = ["protein", "carbs", "fat", "fiber"].filter(function (key) { return nutrients[key] === null; });

    return {
        name: name,
        brand: String(food.brand || food.brands || food.brandOwner || food.brandName || "").trim(),
        calories: nutrients.calories,
        protein: nutrients.protein,
        carbs: nutrients.carbs,
        fat: nutrients.fat,
        fiber: nutrients.fiber,
        pieceGrams: pieceGrams,
        servingGrams: servingGrams,
        source: String(sourceOverride || food.source || "Food database"),
        barcode: String(food.barcode || food.code || ""),
        unitGrams: unitGrams,
        units: units,
        approximateUnits: Array.isArray(food.approximateUnits) ? food.approximateUnits.slice() : [],
        defaultUnit: food.defaultUnit || (pieceGrams ? "piece" : (servingGrams ? "serving" : "g")),
        preparation: String(food.preparation || ""),
        missingNutrients: Array.isArray(food.missingNutrients) ? food.missingNutrients.slice() : missingNutrients,
        aliases: Array.isArray(food.aliases) ? food.aliases.slice() : [],
        resultGroup: food.resultGroup || "",
        fdcId: food.fdcId || food.fdcId === 0 ? food.fdcId : undefined
    };
}

function foodSearchDedupeKey(food) {
    const normalize = function (value) { return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase(); };
    return normalize(food.name) + "\u0000" + normalize(food.brand);
}

function mergeFoodSearchResults(sourceGroups) {
    const groups = Array.isArray(sourceGroups) ? sourceGroups : [];
    const seen = new Set();
    const merged = [];
    groups.forEach(function (group) {
        (Array.isArray(group) ? group : [group]).forEach(function (candidate) {
            const normalized = normalizeFoodSearchResult(candidate);
            if (!normalized) return;
            const key = foodSearchDedupeKey(normalized);
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(normalized);
        });
    });
    return merged;
}

function matchesFoodQuery(food, query) {
    const normalizedQuery = normalizeFoodSearchQuery(query);
    if (!normalizedQuery) return false;
    const names = [food.name].concat(Array.isArray(food.aliases) ? food.aliases : []).map(normalizeFoodSearchQuery);
    const words = normalizedQuery.split(/\s+/).filter(Boolean);
    return names.some(function (name) {
        return name === normalizedQuery || name.startsWith(normalizedQuery) ||
            words.every(function (word) { return new RegExp("(?:^|\\s)" + escapeFoodRegex(word) + "(?:$|\\s)").test(name); }) || name.includes(normalizedQuery);
    });
}

function normalizeFoodSearchQuery(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase()
        .replace(/\b([a-z]+)ies\b/g, "$1y").replace(/\b([a-z]+)oes\b/g, "$1o").replace(/\b([a-z]+)s\b/g, "$1");
}

function escapeFoodRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foodSearchRank(food, query) {
    const normalized = normalizeFoodSearchQuery(query);
    const names = [food && food.name].concat(Array.isArray(food && food.aliases) ? food.aliases : []).map(normalizeFoodSearchQuery);
    if (names.includes(normalized)) return 0;
    if (names.some(function (name) { return name.startsWith(normalized); })) return 1;
    const words = normalized.split(/\s+/).filter(Boolean);
    if (names.some(function (name) { return words.every(function (word) { return new RegExp("(?:^|\\s)" + escapeFoodRegex(word) + "(?:$|\\s)").test(name); }); })) return 2;
    return 3;
}

function foodSearchSourceRank(food) {
    if (food.resultGroup === "your" || food.source === "Favorite" || food.source === "Custom food") return 0;
    if (food.resultGroup === "basic" && food.source === "USDA FoodData Central") return 1;
    if (food.source === "FitCalc built-in") return 2;
    if (food.source === "Open Food Facts" || food.source === "USDA FoodData Central") return 3;
    return 1;
}

function filterExternalFoodSearchResults(foods, query) {
    const queryWords = normalizeFoodSearchQuery(query).split(/\s+/).filter(Boolean);
    return (Array.isArray(foods) ? foods : []).filter(function (food) {
        if (!food || food.calories === null || food.calories === undefined || !Number.isFinite(Number(food.calories))) return false;
        const nameWords = normalizeFoodSearchQuery(food.name).split(/[^a-z0-9]+/).filter(Boolean);
        return queryWords.some(function (token) { return nameWords.includes(token); });
    }).slice(0, 8);
}

function searchLocalFoodSources(query) {
    if (!String(query || "").trim()) return [];
    let library = { customFoods: [], favorites: [] };
    try {
        if (typeof getFoodLibrary === "function") library = getFoodLibrary() || library;
    } catch (error) { /* Local built-ins remain searchable if saved data cannot be read. */ }
    const favorites = (Array.isArray(library.favorites) ? library.favorites : []).filter(function (food) { return matchesFoodQuery(food, query); })
        .map(function (food) { return Object.assign({}, food, { source: "Favorite", resultGroup: "your" }); });
    const customFoods = (Array.isArray(library.customFoods) ? library.customFoods : []).filter(function (food) { return matchesFoodQuery(food, query); })
        .map(function (food) { return Object.assign({}, food, { source: "Custom food", resultGroup: "your" }); });
    const builtIns = (typeof searchBuiltInFoodList === "function" ? searchBuiltInFoodList(query) : [])
        .map(function (food) { return Object.assign({}, food, { resultGroup: "basic" }); });
    const india = typeof indianFoodDatabase !== "undefined" && Array.isArray(indianFoodDatabase)
        ? indianFoodDatabase.filter(function (food) { return matchesFoodQuery(food, query); }).map(function (food) {
            return Object.assign({}, food, { resultGroup: "basic" });
        })
        : [];
    return mergeFoodSearchResults([favorites, customFoods, india, builtIns]).sort(function (a, b) {
        return foodSearchRank(a, query) - foodSearchRank(b, query) || foodSearchSourceRank(a) - foodSearchSourceRank(b);
    });
}

function parseOpenFoodFactsServingGrams(value) {
    const text = String(value || "").trim();
    const match = text.match(/(?:^|[, (])(?:about\s*)?(\d+(?:[.,]\d+)?)\s*(g|grams?)\b/i);
    if (!match) return null;
    const amount = Number(match[1].replace(",", "."));
    return Number.isFinite(amount) && amount > 0 && amount <= 5000 ? amount : null;
}

function normalizeOpenFoodFactsProduct(product) {
    if (!product || typeof product !== "object") return null;
    const n = product.nutriments || {};
    const calories = foodNumber(n["energy-kcal_100g"]);
    const kj = foodNumber(n.energy_100g);
    const kcal = calories !== null ? calories : (kj !== null ? kj / 4.184 : null);
    const servingGrams = parseOpenFoodFactsServingGrams(product.serving_size);
    const macros = {
        name: product.product_name || product.product_name_en,
        brand: product.brands || "",
        calories: kcal,
        protein: foodNumber(n.proteins_100g),
        carbs: foodNumber(n.carbohydrates_100g),
        fat: foodNumber(n.fat_100g),
        fiber: foodNumber(n.fiber_100g),
        servingGrams: servingGrams,
        units: ["g", "oz"].concat(servingGrams ? ["serving"] : []),
        defaultUnit: servingGrams ? "serving" : "g",
        source: "Open Food Facts",
        barcode: product.code || ""
    };
    return normalizeFoodSearchResult(macros);
}

function openFoodFactsSearchHit(hit) {
    if (!hit || typeof hit !== "object") return null;
    const product = hit._source || hit.source || hit.document || hit;
    return normalizeOpenFoodFactsProduct(product);
}

function getOpenFoodFactsSearchItems(data) {
    if (!data || typeof data !== "object") return [];
    const rawHits = Array.isArray(data.hits) ? data.hits :
        (data.hits && Array.isArray(data.hits.hits) ? data.hits.hits :
            (Array.isArray(data.products) ? data.products : []));
    return rawHits.map(openFoodFactsSearchHit).filter(Boolean);
}

function createAbortError() {
    return createFoodApiError("Food search was cancelled.", "aborted");
}

function delayFoodApi(ms, signal) {
    return new Promise(function (resolve, reject) {
        if (signal && signal.aborted) { reject(createAbortError()); return; }
        const timeoutId = setTimeout(function () {
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timeoutId);
            signal.removeEventListener("abort", onAbort);
            reject(createAbortError());
        }
        if (signal) signal.addEventListener("abort", onAbort, { once: true });
    });
}

async function requestFoodApiJson(url, options) {
    const settings = Object.assign({ timeoutMs: 8000, retries: 0, retryDelayMs: 300, headers: {} }, options || {});
    for (let attempt = 0; ; attempt += 1) {
        if (settings.signal && settings.signal.aborted) throw createAbortError();
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const abortFromParent = function () { if (controller) controller.abort(); };
        if (settings.signal) settings.signal.addEventListener("abort", abortFromParent, { once: true });
        let timeoutId = null;
        try {
            const request = fetch(url, {
                method: settings.method || "GET",
                headers: Object.assign({ Accept: "application/json" }, settings.headers),
                credentials: "omit",
                ...(settings.body ? { body: settings.body } : {}),
                ...((controller || settings.signal) ? { signal: controller ? controller.signal : settings.signal } : {})
            });
            const response = await Promise.race([
                request,
                new Promise(function (_resolve, reject) {
                    timeoutId = setTimeout(function () {
                        if (controller) controller.abort();
                        reject(createFoodApiError("Food database request timed out.", "timeout"));
                    }, settings.timeoutMs);
                })
            ]);
            if (!response.ok) {
                const status = Number(response.status) || 0;
                const kind = status === 429 || status >= 500 ? "service" : (status === 404 ? "notFound" : "http");
                throw createFoodApiError("Food database returned HTTP " + status + ".", kind, status);
            }
            return await response.json();
        } catch (error) {
            if (settings.signal && settings.signal.aborted) throw createAbortError();
            const failure = error && error.kind ? error : createFoodApiError(error && error.message || "Food database request failed.", "network");
            const retryable = failure.kind === "network" || failure.kind === "timeout" || failure.kind === "service";
            if (attempt >= settings.retries || !retryable) throw failure;
            await delayFoodApi(settings.retryDelayMs, settings.signal);
        } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
            if (settings.signal) settings.signal.removeEventListener("abort", abortFromParent);
        }
    }
}

async function searchOpenFoodFacts(query, options) {
    const search = String(query || "").trim();
    if (search.length < 2) return [];
    const signal = options && options.signal;
    const startedAt = Date.now();
    let searchError = null;
    try {
        const data = await requestFoodApiJson(OPEN_FOOD_FACTS_SEARCH_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                q: search, page: 1, page_size: 12, langs: ["en"],
                fields: ["product_name", "product_name_en", "brands", "code", "nutriments", "serving_size"]
            }),
        timeoutMs: 2200, retries: 0, retryDelayMs: 0, signal: signal
        });
        const foods = getOpenFoodFactsSearchItems(data);
        const relevantFoods = filterExternalFoodSearchResults(foods, search);
        if (relevantFoods.length) return relevantFoods;
    } catch (error) {
        if (error.kind === "aborted") throw error;
        searchError = error;
    }

    // The older CGI endpoint remains a compatibility fallback while the new
    // Search-a-licious endpoint is being rolled out and its browser CORS support
    // is stabilized. It is the only OFF endpoint that supports full text today.
    try {
        const legacyParams = new URLSearchParams({
            search_terms: search,
            search_simple: "1",
            action: "process",
            json: "1",
            page_size: "12",
            lc: "en",
            countries_tags: "india",
            fields: "product_name,product_name_en,brands,code,nutriments,serving_size"
        });
        const data = await requestFoodApiJson(OPEN_FOOD_FACTS_API + "/cgi/search.pl?" + legacyParams.toString(), {
            timeoutMs: Math.max(1, 4000 - (Date.now() - startedAt)), retries: 0, retryDelayMs: 0, signal: signal
        });
        return filterExternalFoodSearchResults((Array.isArray(data.products) ? data.products : []).map(normalizeOpenFoodFactsProduct).filter(Boolean), search);
    } catch (error) {
        if (error.kind === "aborted") throw error;
        throw searchError || error;
    }
}

function findFdcNutrient(food, nutrientId, namePattern) {
    const nutrients = Array.isArray(food && food.foodNutrients) ? food.foodNutrients : [];
    let match = nutrients.find(function (item) {
        const id = item.nutrientId !== undefined ? item.nutrientId : (item.nutrient && item.nutrient.id);
        return Number(id) === nutrientId;
    });
    if (!match && namePattern) {
        match = nutrients.find(function (item) {
            const nutrient = item.nutrient || item;
            return namePattern.test(String(item.nutrientName || nutrient.name || ""));
        });
    }
    if (!match) return null;
    return foodNumber(match.value !== undefined ? match.value : match.amount);
}

function getUsdaPortionConversions(portions, foodName) {
    const result = { unitGrams: { oz: 28.35 }, units: ["g", "oz"], approximateUnits: [] };
    const volumeMl = { tsp: 5, tablespoon: 15, tbsp: 15, cup: 240, glass: 250 };
    const portionRows = Array.isArray(portions) ? portions : [];
    const normalizedRows = portionRows.map(function (portion) {
        const measure = portion && portion.measureUnit || {};
        const amount = foodNumber(portion && portion.amount) || 1;
        const grams = foodNumber(portion && portion.gramWeight);
        const description = [portion && portion.modifier, portion && portion.portionDescription, measure.name, measure.abbreviation]
            .filter(Boolean).join(" ").toLowerCase();
        return { description: description, grams: grams && grams > 0 ? grams * amount : null };
    }).filter(function (portion) { return portion.grams > 0; });

    // Use a source-reported food portion (cup, tablespoon, or teaspoon) as
    // the density basis, then apply the standard volume ratios. A food with
    // no matching USDA portion receives no volume choices.
    const volumePortion = normalizedRows.find(function (portion) { return /\b(cup|cups)\b/.test(portion.description); }) ||
        normalizedRows.find(function (portion) { return /\b(tablespoon|tablespoons|tbsp)\b/.test(portion.description); }) ||
        normalizedRows.find(function (portion) { return /\b(teaspoon|teaspoons|tsp)\b/.test(portion.description); });
    if (volumePortion) {
        const sourceUnit = /\b(cup|cups)\b/.test(volumePortion.description) ? "cup" :
            (/\b(tablespoon|tablespoons|tbsp)\b/.test(volumePortion.description) ? "tbsp" : "tsp");
        const milliliters = sourceUnit === "cup" ? 240 : (sourceUnit === "tbsp" ? 15 : 5);
        const gramsPerMl = volumePortion.grams / milliliters;
        result.unitGrams.ml = gramsPerMl;
        result.unitGrams.tsp = gramsPerMl * volumeMl.tsp;
        result.unitGrams.tbsp = gramsPerMl * volumeMl.tbsp;
        result.unitGrams.cup = gramsPerMl * volumeMl.cup;
        result.unitGrams.glass = gramsPerMl * volumeMl.glass;
        result.units.push("ml", "tsp", "tbsp", "cup", "glass");
        if (/\b(rice|lentils?|dal|curry)\b/i.test(String(foodName || ""))) {
            result.unitGrams.katori = gramsPerMl * 180;
            result.units.push("katori");
            result.approximateUnits.push("katori");
        }
    }

    ["piece", "slice"].forEach(function (unit) {
        const portion = normalizedRows.find(function (candidate) {
            return new RegExp("\\b" + unit + "s?\\b").test(candidate.description);
        });
        if (!portion) return;
        result.unitGrams[unit] = portion.grams;
        result.units.push(unit);
    });
    ["ladle", "plate", "katori"].forEach(function (unit) {
        const portion = normalizedRows.find(function (candidate) {
            const pattern = unit === "ladle" ? /\b(ladle|kadchi)\b/ : new RegExp("\\b" + unit + "s?\\b");
            return pattern.test(candidate.description);
        });
        if (!portion) return;
        result.unitGrams[unit] = portion.grams;
        if (!result.units.includes(unit)) result.units.push(unit);
        if (!result.approximateUnits.includes(unit)) result.approximateUnits.push(unit);
    });
    return result;
}

function normalizeUSDAFood(food) {
    if (!food || typeof food !== "object") return null;
    const energyEntries = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
    const nutrientId = function (item) {
        const nutrient = item.nutrient || item;
        return Number(item.nutrientId !== undefined ? item.nutrientId : (nutrient.id !== undefined ? nutrient.id : item.number));
    };
    const energy = energyEntries.find(function (item) { return nutrientId(item) === 1008; }) ||
        energyEntries.find(function (item) { return nutrientId(item) === 2048; }) ||
        energyEntries.find(function (item) { return nutrientId(item) === 2047; }) ||
        energyEntries.find(function (item) { return /^Energy(?:,|$)/i.test(String(item.nutrientName || (item.nutrient || {}).name || "")); });
    const energyValue = energy ? foodNumber(energy.value !== undefined ? energy.value : energy.amount) : null;
    const energyUnit = String(energy && (energy.unitName || energy.nutrientUnit || (energy.nutrient || {}).unitName) || "kcal").toLowerCase();
    const calories = energyValue === null ? null : (energyUnit === "kj" || energyUnit === "kilojoule" || energyUnit === "kilojoules" ? energyValue / 4.184 : (/kcal|kilocalorie/.test(energyUnit) ? energyValue : null));
    const protein = findFdcNutrient(food, 1003, /^Protein$/i);
    const fat = findFdcNutrient(food, 1004, /^(?:Total lipid \(fat\)|Fat, total lipid)$/i);
    const carbs = findFdcNutrient(food, 1005, /^Carbohydrate, by difference$/i);
    const fiber = findFdcNutrient(food, 1079, /^Fiber, total dietary$/i);
    const servingSize = foodNumber(food.servingSize);
    const servingSizeUnit = String(food.servingSizeUnit || "").toLowerCase();
    const servingGrams = servingSize && ["g", "gram", "grams"].includes(servingSizeUnit) ? servingSize : null;
    const portions = getUsdaPortionConversions(food.foodPortions, food.description);
    const portionUnits = portions.units.slice();
    if (servingGrams) portionUnits.push("serving");
    const normalized = normalizeFoodSearchResult({
        name: food.description,
        brand: food.brandOwner || food.brandName || "",
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        fiber: fiber,
        servingGrams: servingGrams,
        unitGrams: portions.unitGrams,
        units: portionUnits,
        approximateUnits: portions.approximateUnits,
        defaultUnit: servingGrams ? "serving" : "g",
        source: "USDA FoodData Central",
        fdcId: food.fdcId
    });
    return normalized;
}

async function searchUSDAFoods(query, apiKey, options) {
    const search = String(query || "").trim();
    const key = String(apiKey || "").trim();
    if (!key || search.length < 2) return [];
    const params = new URLSearchParams({ query: search, pageSize: "12", api_key: key });
    const data = await requestFoodApiJson(USDA_FOOD_DATA_API + "?" + params.toString(), {
        timeoutMs: 4000, retries: 0, signal: options && options.signal
    });
    return filterExternalFoodSearchResults((Array.isArray(data.foods) ? data.foods : []).map(normalizeUSDAFood).filter(Boolean), search);
}

function setFoodApiStatus(message, state) {
    const el = document.getElementById("food-api-status");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.state = state || "";
}

function cancelUnifiedFoodSearch() {
    foodSearchVersion += 1;
    if (foodSearchTimer !== null) clearTimeout(foodSearchTimer);
    foodSearchTimer = null;
    if (foodSearchController) foodSearchController.abort();
    foodSearchController = null;
    return foodSearchVersion;
}

function chooseFoodFromApi(food) {
    const normalized = normalizeFoodSearchResult(food);
    if (!normalized) return;
    cancelUnifiedFoodSearch();
    window.fitcalcPendingFood = normalized;
    const name = document.getElementById("food-name");
    if (name) name.value = normalized.name;
    if (typeof window.updateNutritionFoodUnits === "function") window.updateNutritionFoodUnits(normalized);
    setFoodApiStatus(normalized.name + " selected. Set the amount and add it to your log.", "success");
    const amount = document.getElementById("food-amount");
    if (amount && !amount.value) amount.value = document.getElementById("food-amount-unit")?.value === "g" ? "100" : "1";
    if (typeof window.updateNutritionFoodPreview === "function") window.updateNutritionFoodPreview();
    document.getElementById("food-amount")?.focus();
}

function renderFoodApiResults(foods, query, options) {
    const root = document.getElementById("food-api-results");
    if (!root) return;
    root.replaceChildren();
    if (!foods.length) {
        if (String(query || "").trim()) {
            const empty = document.createElement("p");
            empty.className = "food-search-empty";
            empty.textContent = "No match for '" + String(query).trim() + "'. Add it as a custom food.";
            const addCustom = document.createElement("button");
            addCustom.type = "button";
            addCustom.className = "secondary-btn";
            addCustom.textContent = "Add custom food";
            addCustom.addEventListener("click", function () {
                const name = document.getElementById("food-name");
                const customName = document.getElementById("custom-food-name");
                const details = document.querySelector(".custom-food-details");
                if (name) name.value = String(query).trim();
                if (customName) customName.value = String(query).trim();
                if (details) details.open = true;
                if (customName) customName.focus();
            });
            root.append(empty, addCustom);
        }
        if (options && options.packagedUnavailable) appendPackagedUnavailable(root);
        return;
    }

    const groups = [
        { key: "your", title: "Your foods" },
        { key: "basic", title: "Basic foods" },
        { key: "packaged", title: "Packaged (Open Food Facts)" }
    ];
    groups.forEach(function (group) {
        let groupFoods = foods.filter(function (food) {
            const inferred = food.resultGroup || (food.source === "Open Food Facts" ? "packaged" :
                (food.source === "Favorite" || food.source === "Custom food" ? "your" : "basic"));
            return inferred === group.key;
        });
        if (!groupFoods.length) return;
        const section = document.createElement("section");
        section.className = "food-results-group food-results-group-" + group.key;
        const heading = document.createElement("h3");
        heading.textContent = group.title;
        section.appendChild(heading);
        const list = document.createElement("div");
        list.className = "food-results-list";
        const allPackaged = groupFoods;
        const hiddenPackaged = group.key === "packaged" && groupFoods.length > 3;
        if (hiddenPackaged) groupFoods = groupFoods.slice(0, 3);
        groupFoods.forEach(function (food) {
        const card = document.createElement("div");
        card.className = "integration-result";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = food.name;
        const details = document.createElement("small");
        const value = function (number, unit) { return number === null ? "—" : (Math.round(number * 10) / 10) + unit; };
        details.textContent = (food.brand ? food.brand + " · " : "") + value(food.calories, " kcal") + " · " +
            value(food.protein, "g protein") + " · " + value(food.carbs, "g carbs") + " · " + value(food.fat, "g fat") + " per 100 g";
        const source = document.createElement("span");
        source.className = "food-source-tag";
        source.textContent = food.source;
        info.append(title, details, source);
        const select = document.createElement("button");
        select.type = "button";
        select.className = "secondary-btn";
        select.textContent = "Use";
        select.addEventListener("click", function () { chooseFoodFromApi(food); });
        card.append(info, select);
        list.appendChild(card);
        });
        section.appendChild(list);
        if (hiddenPackaged) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "ghost-btn food-show-more";
            more.textContent = "Show more";
            more.addEventListener("click", function () {
                more.remove();
                allPackaged.slice(3).forEach(function (food) {
                    const item = document.createElement("div");
                    item.className = "integration-result";
                    const info = document.createElement("div");
                    const title = document.createElement("strong");
                    title.textContent = food.name;
                    const details = document.createElement("small");
                    const value = function (number, unit) { return number === null ? "—" : (Math.round(number * 10) / 10) + unit; };
                    details.textContent = (food.brand ? food.brand + " · " : "") + value(food.calories, " kcal") + " · " +
                        value(food.protein, "g protein") + " · " + value(food.carbs, "g carbs") + " · " + value(food.fat, "g fat") + " per 100 g";
                    info.append(title, details);
                    const source = document.createElement("span");
                    source.className = "food-source-tag";
                    source.textContent = food.source;
                    info.appendChild(source);
                    const select = document.createElement("button");
                    select.type = "button";
                    select.className = "secondary-btn";
                    select.textContent = "Use";
                    select.addEventListener("click", function () { chooseFoodFromApi(food); });
                    item.append(info, select);
                    list.appendChild(item);
                });
            });
            section.appendChild(more);
        }
        root.appendChild(section);
    });
    if (options && options.packagedUnavailable) appendPackagedUnavailable(root);
}

function appendPackagedUnavailable(root) {
    const note = document.createElement("small");
    note.className = "food-packaged-unavailable";
    note.textContent = "Packaged foods unavailable right now";
    root.appendChild(note);
}

function getSavedUSDAKey() {
    try {
        const preferences = typeof getFitCalcPreferences === "function" ? getFitCalcPreferences() : {};
        return String(preferences.usdaApiKey || "").trim();
    } catch (error) {
        return "";
    }
}

function beginFoodSearch(query, version, signal) {
    const localResults = searchLocalFoodSources(query);
    const onlineResults = { off: [], usda: [] };
    const unavailable = new Set();
    let pending = 0;
    const draw = function () {
        if (version !== foodSearchVersion) return;
        const results = mergeFoodSearchResults([localResults, onlineResults.off, onlineResults.usda]).sort(function (a, b) {
            return foodSearchRank(a, query) - foodSearchRank(b, query) || foodSearchSourceRank(a) - foodSearchSourceRank(b);
        });
        renderFoodApiResults(results, query, {
            packagedUnavailable: unavailable.has("off")
        });
        if (unavailable.has("off") || (unavailable.size && !localResults.length)) setFoodApiStatus("", "");
        else if (pending > 0) setFoodApiStatus("Searching online food sources…", "loading");
        else if (query.trim().length >= 2) setFoodApiStatus("Search complete.", "");
    };
    draw();
    if (String(query || "").trim().length < 2) {
        setFoodApiStatus("Type at least two characters to search online sources.", "");
        return;
    }
    const sources = [{ key: "off", run: function () { return searchOpenFoodFacts(query, { signal: signal }); } }];
    const usdaKey = getSavedUSDAKey();
    if (usdaKey) sources.push({ key: "usda", run: function () { return searchUSDAFoods(query, usdaKey, { signal: signal }); } });
    pending = sources.length;
    draw();
    sources.forEach(function (source) {
        source.run().then(function (foods) {
            if (version !== foodSearchVersion || (signal && signal.aborted)) return;
            onlineResults[source.key] = Array.isArray(foods) ? foods : [];
        }).catch(function (error) {
            if (version !== foodSearchVersion || (signal && signal.aborted) || error.kind === "aborted") return;
            unavailable.add(source.key);
        }).finally(function () {
            if (version !== foodSearchVersion || (signal && signal.aborted)) return;
            pending -= 1;
            draw();
        });
    });
}

function scheduleUnifiedFoodSearch(query) {
    const version = cancelUnifiedFoodSearch();
    const localResults = searchLocalFoodSources(query);
    renderFoodApiResults(localResults, query);
    if (!String(query || "").trim()) {
        setFoodApiStatus("", "");
        return;
    }
    if (String(query).trim().length < 2) {
        setFoodApiStatus("Type at least two characters to search online sources.", "");
        return;
    }
    setFoodApiStatus("Searching online food sources…", "loading");
    foodSearchController = typeof AbortController === "function" ? new AbortController() : null;
    const signal = foodSearchController && foodSearchController.signal;
    foodSearchTimer = setTimeout(function () {
        foodSearchTimer = null;
        beginFoodSearch(query, version, signal);
    }, 300);
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

async function lookupOpenFoodFactsBarcode(barcode, options) {
    const code = String(barcode || "").replace(/\s/g, "");
    if (!/^\d{8,14}$/.test(code)) throw createFoodApiError("Enter a barcode with 8 to 14 digits.", "invalid");
    const params = new URLSearchParams({ fields: "code,product_name,product_name_en,brands,nutriments,serving_size" });
    let data;
    try {
        data = await requestFoodApiJson(OPEN_FOOD_FACTS_API + "/api/v3/product/" + encodeURIComponent(code) + "?" + params.toString(), {
            timeoutMs: 8000, retries: 0, signal: options && options.signal
        });
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
    if (!product) throw createFoodApiError("This product has no usable calories per 100 g in the database.", "invalid");
    return product;
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
            renderFoodApiRetry("The food database could not be reached. Check your connection and try again.", "Retry lookup", lookupBarcodeInput);
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

document.getElementById("food-name")?.addEventListener("input", function (event) { scheduleUnifiedFoodSearch(event.target.value); });
document.getElementById("lookup-food-barcode")?.addEventListener("click", lookupBarcodeInput);
document.getElementById("food-barcode")?.addEventListener("keydown", function (event) { if (event.key === "Enter") lookupBarcodeInput(); });
document.getElementById("start-barcode-camera")?.addEventListener("click", startBarcodeCamera);
document.getElementById("stop-barcode-camera")?.addEventListener("click", function () { stopBarcodeCamera("Camera stopped."); });
window.addEventListener("pagehide", function () { cancelUnifiedFoodSearch(); stopBarcodeCamera(); });
updateBarcodeCameraAvailability();
