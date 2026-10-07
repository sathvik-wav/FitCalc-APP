const foodDatabase = [
    // Existing nutrient values are retained per 100 g. Preparation notes
    // narrow each generic food to the closest matching source record.
    { name: "chicken breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, preparation: "cooked, roasted, skinless", servingGrams: 85, units: ["g", "serving"], defaultUnit: "serving" },
    // USDA SR Legacy FDC 168878: 1 cup cooked rice is 158 g. Its katori
    // estimate scales that weight to the approximate 180 ml household measure.
    { name: "white rice", aliases: ["cooked rice", "cooked white rice"], calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, preparation: "cooked, long-grain", servingGrams: 158, unitGrams: { cup: 158, katori: 118.5 }, units: ["g", "katori", "cup", "serving"], approximateUnits: ["katori"], defaultUnit: "cup" },
    { name: "brown rice", calories: 112, protein: 2.3, carbs: 24, fat: 0.8, fiber: 1.8, preparation: "cooked, medium-grain", servingGrams: 195, unitGrams: { cup: 195, katori: 146.25 }, units: ["g", "katori", "cup", "serving"], approximateUnits: ["katori"], defaultUnit: "cup" },
    { name: "banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, preparation: "raw, edible portion", servingGrams: 118, unitGrams: { piece: 118 }, units: ["g", "piece"], defaultUnit: "piece" },
    { name: "apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, preparation: "raw, with skin", servingGrams: 182, unitGrams: { piece: 182 }, units: ["g", "piece"], defaultUnit: "piece" },
    { name: "orange", calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, preparation: "raw, edible portion", servingGrams: 131, unitGrams: { piece: 131 }, units: ["g", "piece"], defaultUnit: "piece" },
    { name: "egg", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, preparation: "whole, raw, edible portion", servingGrams: 50, unitGrams: { piece: 50 }, units: ["g", "piece"], defaultUnit: "piece" },
    { name: "oats", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6, preparation: "rolled oats, dry", servingGrams: 40, unitGrams: { cup: 81, tbsp: 5, tsp: 1.7 }, units: ["g", "cup", "tbsp", "tsp", "serving"], defaultUnit: "serving" },
    { name: "salmon", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, preparation: "raw, farmed Atlantic", servingGrams: 85, units: ["g", "serving"], defaultUnit: "serving" },
    { name: "tuna", calories: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0, preparation: "light tuna, canned in water, drained", servingGrams: 85, unitGrams: { cup: 154 }, units: ["g", "cup", "serving"], defaultUnit: "serving" },
    { name: "lean beef", calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, preparation: "ground, 85% lean, cooked, broiled", servingGrams: 85, units: ["g", "serving"], defaultUnit: "serving" },
    { name: "tofu", calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, preparation: "regular tofu, raw", servingGrams: 85, unitGrams: { cup: 126 }, units: ["g", "cup", "serving"], defaultUnit: "serving" },
    // USDA SR Legacy FDC 171265: 1 cup whole milk is 244 g.
    { name: "milk", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, preparation: "whole milk, 3.25% milkfat", servingGrams: 244, unitGrams: { ml: 244 / 240, tsp: 244 / 48, tbsp: 244 / 16, cup: 244, glass: 244 * 250 / 240 }, units: ["g", "ml", "tsp", "tbsp", "cup", "glass"], defaultUnit: "cup" },
    { name: "greek yogurt", calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, preparation: "plain, nonfat", servingGrams: 170, unitGrams: { cup: 245 }, units: ["g", "cup", "serving"], defaultUnit: "serving" },
    { name: "cottage cheese", calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0, preparation: "4% milkfat", servingGrams: 113, unitGrams: { cup: 226 }, units: ["g", "cup", "serving"], defaultUnit: "serving" },
    { name: "cheddar cheese", calories: 403, protein: 25, carbs: 1.3, fat: 33, fiber: 0, preparation: "natural, full-fat", servingGrams: 28, unitGrams: { piece: 28, cup: 113, tbsp: 7, tsp: 2.3 }, units: ["g", "piece", "cup", "tbsp", "tsp", "serving"], defaultUnit: "piece" },
    // USDA SR Legacy FDC 172421; this is plain boiled lentils, not a dal recipe.
    { name: "lentils", aliases: ["dal", "cooked dal"], calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, preparation: "cooked, boiled", servingGrams: 198, unitGrams: { cup: 198, katori: 148.5 }, units: ["g", "katori", "cup", "serving"], approximateUnits: ["katori"], defaultUnit: "cup" },
    { name: "chickpeas", calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, preparation: "cooked, boiled", servingGrams: 164, unitGrams: { cup: 164 }, units: ["g", "cup", "serving"], defaultUnit: "cup" },
    { name: "potato", calories: 87, protein: 1.9, carbs: 20, fat: 0.1, fiber: 1.8, preparation: "boiled, flesh and skin", servingGrams: 173, unitGrams: { piece: 173, cup: 150 }, units: ["g", "piece", "cup", "serving"], defaultUnit: "piece" },
    { name: "sweet potato", calories: 90, protein: 2, carbs: 21, fat: 0.2, fiber: 3.3, preparation: "baked, flesh", servingGrams: 130, unitGrams: { piece: 130, cup: 255 }, units: ["g", "piece", "cup", "serving"], defaultUnit: "piece" },
    { name: "broccoli", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, preparation: "raw, chopped", servingGrams: 91, unitGrams: { cup: 91 }, units: ["g", "cup", "serving"], defaultUnit: "cup" },
    { name: "spinach", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, preparation: "raw leaves", servingGrams: 30, unitGrams: { cup: 30 }, units: ["g", "cup", "serving"], defaultUnit: "cup" },
    { name: "avocado", calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, preparation: "raw, edible portion", servingGrams: 50, unitGrams: { piece: 150, cup: 230 }, units: ["g", "piece", "cup", "serving"], defaultUnit: "serving" },
    { name: "almonds", calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, preparation: "raw", servingGrams: 28, unitGrams: { piece: 1.2, cup: 143, tbsp: 9, tsp: 3 }, units: ["g", "piece", "cup", "tbsp", "tsp", "serving"], defaultUnit: "serving" },
    { name: "peanut butter", calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, preparation: "smooth, regular", servingGrams: 32, unitGrams: { cup: 258, tbsp: 16, tsp: 5.3 }, units: ["g", "cup", "tbsp", "tsp", "serving"], defaultUnit: "serving" },
    // USDA SR Legacy FDC 171413: 1 tablespoon is 13.5 g (216 g per cup).
    { name: "olive oil", calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, preparation: "pure", servingGrams: 13.5, unitGrams: { ml: 0.9, tsp: 4.5, tbsp: 13.5, cup: 216, glass: 225 }, units: ["g", "ml", "tsp", "tbsp", "cup", "glass"], defaultUnit: "tbsp" },
    { name: "whole wheat bread", calories: 252, protein: 12.3, carbs: 43, fat: 3.5, fiber: 6, preparation: "commercial, whole wheat", servingGrams: 28, unitGrams: { slice: 28 }, units: ["g", "slice", "serving"], defaultUnit: "slice" },
    { name: "pasta", calories: 158, protein: 5.8, carbs: 31, fat: 0.9, fiber: 1.8, preparation: "enriched pasta, cooked", servingGrams: 140, unitGrams: { cup: 140 }, units: ["g", "cup", "serving"], defaultUnit: "cup" }
];
foodDatabase.forEach(function (food) { food.sourceTag = "USDA"; });

// Standard kitchen measures use the volume conversions in the entry form.
// Katori is an approximate 180 ml midpoint of the stated 150–200 ml range;
// its grams are scaled from a food's source-backed cup weight and density.
const FOOD_VOLUME_ML = { ml: 1, tsp: 5, tbsp: 15, cup: 240, glass: 250, katori: 180 };
const FOOD_APPROXIMATE_UNITS = ["katori", "ladle", "plate"];
const FOOD_SEARCH_ALIASES = {
    "chicken breast": ["chicken"], "white rice": ["cooked rice", "cooked white rice"],
    "brown rice": ["cooked brown rice"], "whole wheat bread": ["bread", "wholemeal bread"],
    banana: ["kela"], apple: ["seb"], orange: ["santra"], milk: ["whole milk", "doodh"],
    "greek yogurt": ["yogurt", "plain yogurt"], lentils: ["dal", "cooked dal", "masoor dal"],
    chickpeas: ["chana", "garbanzo beans"], potato: ["aloo"], "sweet potato": ["shakarkandi"],
    spinach: ["palak"], almonds: ["badam"], "peanut butter": ["groundnut butter"],
    "olive oil": ["oil"]
};
foodDatabase.forEach(function (food) {
    food.unitGrams = Object.assign({ oz: 28.35 }, food.unitGrams || {});
    if (!food.units.includes("oz")) food.units.splice(1, 0, "oz");
    if (!food.source) food.source = "USDA";
    food.sourceTag = "USDA";
    if (!Array.isArray(food.aliases)) food.aliases = [];
    food.aliases = Array.from(new Set(food.aliases.concat(FOOD_SEARCH_ALIASES[food.name] || [])));
});



/*
 * DATE
 */

function getInitialNutritionDate() {
    try {
        const search = String(window.location.search || "");
        const match = search.match(/[?&]date=(\d{4}-\d{2}-\d{2})(?:&|$)/);
        const value = match && match[1];
        if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
            const date = new Date(value + "T00:00:00");
            if (!Number.isNaN(date.getTime()) && getDateKey(date) === value && value <= getDateKey(new Date())) return date;
        }
    } catch (error) { /* The page may be running in a test sandbox without a URL. */ }
    return new Date();
}

let selectedNutritionDate = getInitialNutritionDate();
let currentNutritionTodayKey = getDateKey(new Date());
let editingFoodIndex = -1;
let editingFoodDateKey = null;
let editingFoodSnapshot = null;
let previousWaterChange = null;

function getNutritionDateKey(date) {
    if (!date) refreshNutritionTodayIfNeeded();
    return getDateKey(date || selectedNutritionDate);
}

function getNutritionTargets() { return getTargets(); }


/*
 * GET TODAY'S NUTRITION
 */

function getNutrition() {

    const nutrition = Object.assign(
        emptyNutritionDay(),
        getNutritionFor(getNutritionDateKey())
    );

    let migratedFoodAmounts = false;
    nutrition.foods = (Array.isArray(nutrition.foods) ? nutrition.foods : []).map(function (food) {
        const migrated = migrateFoodLogAmount(food);
        if (migrated !== food) migratedFoodAmounts = true;
        return migrated;
    });


    ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
        nutrition[key] = nutrition[key] === null ? null : (Number(nutrition[key]) || 0);
    });

    nutrition.water =
        Number(nutrition.water) || 0;


    if (migratedFoodAmounts) saveNutritionFor(getNutritionDateKey(), nutrition);

    return nutrition;
}

function migrateFoodLogAmount(food) {
    if (!food || typeof food !== "object") return food;
    const amountGrams = Number(food.amountGrams) > 0 ? Number(food.amountGrams) : Number(food.amount);
    if (!Number.isFinite(amountGrams) || amountGrams <= 0) return food;

    const originalUnit = String(food.amountUnit || "").trim();
    let unit = originalUnit ? normalizeFoodAmountUnit(originalUnit) : "g";
    let enteredAmount = Number(food.enteredAmount);
    const servingCount = Number(food.servingCount);
    if (!originalUnit && servingCount > 0 && Number(food.servingGrams) > 0 &&
        Math.abs(servingCount * Number(food.servingGrams) - amountGrams) < 0.1) {
        unit = "serving";
        enteredAmount = servingCount;
    }

    let gramsPerUnit = Number(food.gramsPerUnit);
    if (!(enteredAmount > 0)) {
        if (unit === "g") enteredAmount = amountGrams;
        else if (unit === "serving" && Number(food.servingGrams) > 0) enteredAmount = amountGrams / Number(food.servingGrams);
        else {
            const knownFood = findFood(food.name);
            gramsPerUnit = gramsPerUnit > 0 ? gramsPerUnit : gramsPerFoodUnit(knownFood, unit);
            enteredAmount = gramsPerUnit > 0 ? amountGrams / gramsPerUnit : amountGrams;
            if (!(gramsPerUnit > 0)) unit = "g";
        }
    }
    if (!(gramsPerUnit > 0) || Math.abs(enteredAmount * gramsPerUnit - amountGrams) > 0.1) {
        // Saved grams and macros are the historical truth. If an old
        // conversion is missing or has drifted, infer its unit weight from
        // that portion so Edit cannot silently change the log.
        gramsPerUnit = unit === "g" ? 1 : amountGrams / enteredAmount;
    }

    const migrated = Object.assign({}, food, {
        amount: amountGrams,
        amountGrams: amountGrams,
        enteredAmount: enteredAmount,
        amountUnit: unit,
        gramsPerUnit: gramsPerUnit
    });
    if (unit === "serving" && enteredAmount > 0) migrated.servingGrams = gramsPerUnit;
    if (originalUnit && unit === "g" && originalUnit.toLowerCase() !== "g" && originalUnit.toLowerCase() !== "grams") {
        migrated.legacyAmountUnit = originalUnit;
    }
    if (food.amountGrams === amountGrams && food.amount === amountGrams &&
        Number(food.enteredAmount) === enteredAmount && food.amountUnit === unit &&
        Number(food.gramsPerUnit) === gramsPerUnit) return food;
    return migrated;
}


/*
 * SAVE NUTRITION
 */

function saveNutrition(nutrition) {
    try {
        const saveDateKey = getNutritionDateKey();
        saveNutritionFor(saveDateKey, nutrition);
        return true;
    } catch (error) {
        return false;
    }
}

function updateNutritionDateDisplay() {
    const label = document.getElementById("nutrition-day-label");
    const date = document.getElementById("nutrition-date");
    if (!label || !date) return;
    const today = new Date();
    const key = getNutritionDateKey(selectedNutritionDate);
    label.textContent = key === getDateKey(today) ? "Today" : selectedNutritionDate.toLocaleDateString(undefined, { weekday: "long" });
    date.textContent = selectedNutritionDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const next = document.getElementById("nutrition-next-day");
    if (next) next.disabled = key === getDateKey(today);
}

function refreshNutritionTodayIfNeeded() {
    const now = new Date();
    const todayKey = getDateKey(now);
    if (todayKey === currentNutritionTodayKey) return false;

    const previousTodayKey = currentNutritionTodayKey;
    currentNutritionTodayKey = todayKey;
    if (getDateKey(selectedNutritionDate) === previousTodayKey) {
        selectedNutritionDate = now;
        refreshNutritionDay();
    } else {
        updateNutritionDateDisplay();
    }
    return true;
}

function shiftNutritionDate(offset) {
    refreshNutritionTodayIfNeeded();
    const today = new Date();
    const next = new Date(selectedNutritionDate);
    next.setDate(next.getDate() + offset);
    if (getDateKey(next) > getDateKey(today)) return;
    cancelFoodEdit();
    selectedNutritionDate = next;
    updateNutritionDateDisplay();
    updateNutritionDisplay();
    updateFoodList();
    renderFoodShortcuts();
    updateWaterDisplay();
}

document.getElementById("nutrition-previous-day")?.addEventListener("click", function () { shiftNutritionDate(-1); });
document.getElementById("nutrition-next-day")?.addEventListener("click", function () { shiftNutritionDate(1); });


/*
 * FIND FOOD
 */

function findFood(name) {

    const searchName = normalizeFoodSearchName(name);


    if (!searchName) {

        return null;

    }


    const availableFoods = foodDatabase.concat(
        typeof indianFoodDatabase !== "undefined" ? indianFoodDatabase : [],
        getFoodLibrary().customFoods
    );
    const exactMatch = availableFoods.find(function (food) {
        return [food.name].concat(Array.isArray(food.aliases) ? food.aliases : []).some(function (candidate) {
            return normalizeFoodSearchName(candidate) === searchName;
        });
    });
    if (exactMatch) return exactMatch;

    const escapedName = searchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholeWordMatch = new RegExp("\\b" + escapedName + "\\b", "i");
    return availableFoods.find(function (food) {
        return [food.name].concat(Array.isArray(food.aliases) ? food.aliases : []).some(function (candidate) {
            return wholeWordMatch.test(String(candidate));
        });
    }) || null;
}

function searchBuiltInFoodList(query) {
    const normalized = normalizeFoodSearchName(query);
    if (!normalized) return [];
    const words = normalized.split(/\s+/).filter(Boolean);
    const matches = foodDatabase.filter(function (food) {
        const searchableText = [food.name].concat(Array.isArray(food.aliases) ? food.aliases : []).map(normalizeFoodSearchName).join(" ");
        return searchableText.includes(normalized) || words.every(function (word) {
            return new RegExp("(?:^|\\s)" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:$|\\s)").test(searchableText);
        });
    });
    return matches.sort(function (a, b) {
        return foodNameMatchRank(a, normalized) - foodNameMatchRank(b, normalized);
    }).slice(0, 12).map(function (food) {
        return Object.assign({}, food, { source: "FitCalc built-in", sourceTag: food.sourceTag || "USDA", resultGroup: "basic" });
    });
}

function normalizeFoodName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeFoodSearchName(value) {
    return normalizeFoodName(value).split(" ").map(function (word) {
        if (word.length > 4 && /ies$/.test(word)) return word.slice(0, -3) + "y";
        if (word.length > 4 && /oes$/.test(word)) return word.slice(0, -2);
        if (word.length > 3 && /s$/.test(word) && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
        return word;
    }).join(" ");
}

function foodNameMatchRank(food, query) {
    const names = [food && food.name].concat(Array.isArray(food && food.aliases) ? food.aliases : []).map(normalizeFoodSearchName);
    if (names.includes(query)) return 0;
    if (names.some(function (name) { return name.startsWith(query); })) return 1;
    const queryWords = query.split(/\s+/).filter(Boolean);
    if (names.some(function (name) { return queryWords.every(function (word) { return new RegExp("(?:^|\\s)" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:$|\\s)").test(name); }); })) return 2;
    return 3;
}

function foodDefinitionFromEntry(food) {
    const amount = Number(food && (food.amountGrams || food.amount));
    const divisor = amount > 0 ? amount / 100 : 1;
    const knownFood = foodDatabase.concat(typeof indianFoodDatabase !== "undefined" ? indianFoodDatabase : []).find(function (item) {
        return normalizeFoodName(item.name) === normalizeFoodName(food && food.name);
    });
    const servingGrams = Number(food && food.servingGrams) > 0
        ? Number(food.servingGrams)
        : (knownFood && Number(knownFood.servingGrams) > 0 ? Number(knownFood.servingGrams) : null);
    const per100 = function (key) {
        if (!food || food[key] === null || food[key] === undefined || !Number.isFinite(Number(food[key]))) return null;
        return Number(food[key]) / divisor;
    };
    return {
        name: String(food && food.name || "").trim(),
        calories: per100("calories"),
        protein: per100("protein"),
        carbs: per100("carbs"),
        fat: per100("fat"),
        fiber: per100("fiber"),
        brand: String(food && food.brand || ""),
        pieceGrams: Number(food && food.pieceGrams) > 0 ? Number(food.pieceGrams) : (knownFood && knownFood.pieceGrams || null),
        servingGrams: servingGrams,
        unitGrams: Object.assign({}, knownFood && knownFood.unitGrams || {}, food && food.unitGrams || {}),
        units: Array.isArray(food && food.units) ? food.units.slice() : (knownFood && knownFood.units ? knownFood.units.slice() : ["g"].concat(servingGrams ? ["serving"] : [])),
        approximateUnits: Array.isArray(food && food.approximateUnits) ? food.approximateUnits.slice() : (knownFood && knownFood.approximateUnits ? knownFood.approximateUnits.slice() : []),
        defaultUnit: food && food.defaultUnit || (knownFood && knownFood.defaultUnit) || "g",
        preparation: food && food.preparation || (knownFood && knownFood.preparation) || "",
        source: food && food.source || "FitCalc local list",
        barcode: food && food.barcode || ""
    };
}

function saveCustomFood(food) {
    const name = String(food && food.name || "").trim().replace(/\s+/g, " ");
    if (!name) return false;
    const values = ["calories", "protein", "carbs", "fat", "fiber"].reduce(function (result, key) {
        result[key] = Number(food[key]);
        return result;
    }, {});
    if (Object.keys(values).some(function (key) {
        const maximum = key === "calories" ? 1000 : 100;
        return !Number.isFinite(values[key]) || values[key] < 0 || values[key] > maximum;
    })) return false;
    const servingGrams = Number(food.servingGrams);
    if (!Number.isFinite(servingGrams) || servingGrams <= 0 || servingGrams > 5000) return false;

    const optionalGrams = function (value) {
        if (value === null || value === undefined || String(value).trim() === "") return null;
        const grams = Number(value);
        return Number.isFinite(grams) && grams > 0 && grams <= 5000 ? grams : NaN;
    };
    const pieceGrams = optionalGrams(food.pieceGrams);
    const tablespoonGrams = optionalGrams(food.tablespoonGrams);
    const cupGrams = optionalGrams(food.cupGrams);
    const katoriGrams = optionalGrams(food.katoriGrams);
    if ([pieceGrams, tablespoonGrams, cupGrams, katoriGrams].some(function (grams) { return Number.isNaN(grams); })) return false;

    const unitGrams = { oz: 28.35 };
    const units = ["g", "oz"];
    const approximateUnits = [];
    const volumeDensity = cupGrams ? cupGrams / FOOD_VOLUME_ML.cup : (tablespoonGrams ? tablespoonGrams / FOOD_VOLUME_ML.tbsp : null);
    if (volumeDensity) {
        ["ml", "tsp", "tbsp", "cup", "glass"].forEach(function (unit) { unitGrams[unit] = volumeDensity * FOOD_VOLUME_ML[unit]; });
        if (tablespoonGrams) unitGrams.tbsp = tablespoonGrams;
        if (cupGrams) unitGrams.cup = cupGrams;
        units.push("ml", "tsp", "tbsp", "cup", "glass");
    }
    if (pieceGrams) { unitGrams.piece = pieceGrams; units.push("piece"); }
    units.push("serving");
    if (katoriGrams) { unitGrams.katori = katoriGrams; units.push("katori"); approximateUnits.push("katori"); }

    const library = getFoodLibrary();
    const builtIn = foodDatabase.concat(typeof indianFoodDatabase !== "undefined" ? indianFoodDatabase : []).some(function (item) { return normalizeFoodName(item.name) === normalizeFoodName(name); });
    if (builtIn) return false;
    const existing = library.customFoods.findIndex(function (item) { return normalizeFoodName(item.name) === normalizeFoodName(name); });
    const definition = Object.assign({
        name: name, servingGrams: servingGrams, pieceGrams: pieceGrams, unitGrams: unitGrams,
        units: units, approximateUnits: approximateUnits, defaultUnit: "serving", source: "Custom food"
    }, values);
    if (existing >= 0) library.customFoods[existing] = definition;
    else library.customFoods.unshift(definition);
    ["favorites", "recents"].forEach(function (key) {
        library[key] = library[key].map(function (item) {
            return normalizeFoodName(item.name) === normalizeFoodName(name)
                ? Object.assign({}, definition)
                : item;
        });
    });
    try { saveFoodLibrary(library); } catch (error) { return false; }
    return true;
}

function isFoodFavorite(food) {
    const name = normalizeFoodName(food && food.name);
    return getFoodLibrary().favorites.some(function (item) { return normalizeFoodName(item.name) === name; });
}

function toggleFoodFavorite(food) {
    if (!food || !food.name) return false;
    const library = getFoodLibrary();
    const name = normalizeFoodName(food.name);
    const index = library.favorites.findIndex(function (item) { return normalizeFoodName(item.name) === name; });
    if (index >= 0) library.favorites.splice(index, 1);
    else library.favorites.unshift(foodDefinitionFromEntry(food));
    try { saveFoodLibrary(library); } catch (error) { return false; }
    renderFoodShortcuts();
    updateFoodList();
    return index < 0;
}

function rememberFood(food) {
    const library = getFoodLibrary();
    const definition = foodDefinitionFromEntry(food);
    const name = normalizeFoodName(definition.name);
    library.recents = [definition].concat(library.recents.filter(function (item) {
        return normalizeFoodName(item.name) !== name;
    })).slice(0, 8);
    try { saveFoodLibrary(library); } catch (error) { /* Logging remains saved even if recents cannot be updated. */ }
    renderFoodShortcuts();
}


/*
 * REMAINING
 */

function getRemaining(target, current) {

    const targetValue =
        Number(target) || 0;

    const currentValue =
        Number(current) || 0;


    return Math.max(
        targetValue - currentValue,
        0
    );
}


/*
 * PROGRESS PERCENTAGE
 */

function getNutritionPercentage(
    current,
    target
) {

    const currentValue =
        Number(current) || 0;

    const targetValue =
        Number(target) || 0;


    if (targetValue <= 0) {

        return 0;

    }


    return Math.min(
        (currentValue / targetValue) * 100,
        100
    );
}


/*
 * PROGRESS BAR
 */

function updateNutritionProgressBar(
    id,
    current,
    target
) {

    const element =
        document.getElementById(id);


    if (!element) {

        return;

    }


    const percentage =
        getNutritionPercentage(
            current,
            target
        );


    element.style.width =
        percentage + "%";
    const meter = element.closest('[role="progressbar"]');
    if (meter) meter.setAttribute("aria-valuenow", String(Math.round(percentage)));


    const percentageIdMap = {

        "calorie-progress":
            "total-calories-progress",

        "protein-progress":
            "total-protein-progress",

        "carbs-progress":
            "total-carbs-progress",

        "fat-progress":
            "total-fat-progress",

        "fiber-progress":
            "total-fiber-progress"

    };


    const percentageElement =
        document.getElementById(
            percentageIdMap[id]
        );


    if (percentageElement) {

        percentageElement.textContent =
            `${Math.round(percentage)}%`;

    }
}


/*
 * NUTRITION DISPLAY
 */

function updateNutritionDisplay() {

    const nutrition =
        getNutrition();

    const targets =
        getNutritionTargets();

    const targetNotice = document.getElementById("nutrition-profile-notice");
    if (targetNotice) targetNotice.hidden = Number(targets.calories) > 0;


    const values = [

        {
            total: "total-calories",
            progress: "calorie-progress",
            current: nutrition.calories,
            target: targets.calories
        },

        {
            total: "total-protein",
            progress: "protein-progress",
            current: nutrition.protein,
            target: targets.protein
        },

        {
            total: "total-carbs",
            progress: "carbs-progress",
            current: nutrition.carbs,
            target: targets.carbs
        },

        {
            total: "total-fat",
            progress: "fat-progress",
            current: nutrition.fat,
            target: targets.fat
        },

        {
            total: "total-fiber",
            progress: "fiber-progress",
            current: nutrition.fiber,
            target: targets.fiber
        }

    ];


    values.forEach(
        function (item) {

            const total =
                document.getElementById(
                    item.total
                );


            const target =
                Number(item.target) || 0;


            if (total) {

                total.textContent =
                    `${item.current === null ? "—" : Math.round(item.current)} / ${Math.round(target)}`;

            }


            updateNutritionProgressBar(
                item.progress,
                item.current === null ? 0 : item.current,
                target
            );

        }
    );


    updateNutritionRemaining(
        nutrition,
        targets
    );


    updateWaterDisplay(
        nutrition
    );
}


/*
 * REMAINING DISPLAY
 */

function updateNutritionRemaining(
    nutrition,
    targets
) {

    const remaining = [

        {
            id: "remaining-calories",
            value: nutrition.calories === null ? null : getRemaining(
                targets.calories,
                nutrition.calories
            ),
            unit: "kcal"
        },

        {
            id: "remaining-protein",
            value: nutrition.protein === null ? null : getRemaining(
                targets.protein,
                nutrition.protein
            ),
            unit: "g"
        },

        {
            id: "remaining-carbs",
            value: nutrition.carbs === null ? null : getRemaining(
                targets.carbs,
                nutrition.carbs
            ),
            unit: "g"
        },

        {
            id: "remaining-fat",
            value: nutrition.fat === null ? null : getRemaining(
                targets.fat,
                nutrition.fat
            ),
            unit: "g"
        },

        {
            id: "remaining-fiber",
            value: nutrition.fiber === null ? null : getRemaining(
                targets.fiber,
                nutrition.fiber
            ),
            unit: "g"
        }

    ];


    remaining.forEach(
        function (item) {

            const element =
                document.getElementById(
                    item.id
                );


            if (element) {

                element.textContent =
                    `${item.value === null ? "—" : Math.round(item.value) + " " + item.unit}`;

            }

        }
    );
}


/*
 * FOOD LIST
 */

function updateFoodList() {

    const nutrition =
        getNutrition();


    const foodList =
        document.getElementById(
            "food-list"
        );


    if (!foodList) {

        return;

    }


    foodList.innerHTML = "";


    if (nutrition.foods.length === 0) {

        foodList.innerHTML =
            '<p class="empty-state"><strong>No food logged yet</strong><span>Add an item to see it here.</span></p>';

        return;

    }


    const orderedFoods = nutrition.foods.map(function (food, index) {
        return { food: food, index: index };
    }).sort(function (a, b) {
        const order = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };
        const mealA = a.food.meal || "Snack";
        const mealB = b.food.meal || "Snack";
        return (Object.prototype.hasOwnProperty.call(order, mealA) ? order[mealA] : 4) -
            (Object.prototype.hasOwnProperty.call(order, mealB) ? order[mealB] : 4) || a.index - b.index;
    });
    orderedFoods.forEach(function (item) {
        const food = item.food;
        const index = item.index;
        const entry = document.createElement("div");
        entry.className = "nutrition-food-entry";
        entry.innerHTML = `
            <div class="nutrition-food-info">
                <h3>${escapeHTML(food.name)}</h3>
                ${food.preparation ? '<p class="food-preparation">' + escapeHTML(food.preparation) + '</p>' : ""}
                <div class="food-entry-meta"><span>${escapeHTML(formatLoggedFoodAmount(food))}</span><span class="food-entry-meal">${escapeHTML(food.meal || "Snack")}</span></div>
                <p class="food-entry-macros">
                    ${formatFoodNutrient(food.calories, "kcal")} ·
                    ${formatFoodNutrient(food.protein, "g protein")} ·
                    ${formatFoodNutrient(food.carbs, "g carbs")} ·
                    ${formatFoodNutrient(food.fat, "g fat")}
                </p>
                ${Array.isArray(food.missingNutrients) && food.missingNutrients.length ? '<p class="food-data-warning">Some values are unavailable in the source data.</p>' : ""}
            </div>
            <div class="nutrition-food-actions">
                <button type="button" class="secondary-btn favorite-food" data-index="${index}" aria-pressed="${isFoodFavorite(food)}" aria-label="${isFoodFavorite(food) ? "Remove from" : "Add to"} favorite foods">${isFoodFavorite(food) ? "★ Saved" : "☆ Favorite"}</button>
                <button type="button" class="secondary-btn edit-food" data-index="${index}">Edit</button>
                <button type="button" class="ghost-btn remove-food" data-index="${index}">Remove</button>
            </div>`;
        foodList.appendChild(entry);
        entry.querySelector(".remove-food").addEventListener("click", function () { removeFood(index); });
        entry.querySelector(".edit-food").addEventListener("click", function () { editFood(index); });
        entry.querySelector(".favorite-food").addEventListener("click", function () {
            const added = toggleFoodFavorite(food);
            window.fitcalcToast(added ? "Food added to favorites." : "Food removed from favorites.");
        });
    });
}

function formatFoodNutrient(value, unit) {
    return value === null || value === undefined || !Number.isFinite(Number(value))
        ? "— " + unit
        : formatFoodAmount(Number(value)) + " " + unit;
}

function formatLoggedFoodAmount(food) {
    const unit = normalizeFoodAmountUnit(food && food.amountUnit);
    const quantity = Number(food && food.enteredAmount);
    if (food && Number.isFinite(quantity) && quantity > 0 && food.amountUnit) {
        const plural = { g: "g", oz: "oz", ml: "ml", tsp: "tsp", tbsp: "tbsp", cup: "cups", glass: "glasses", piece: "pieces", slice: "slices", serving: "servings", katori: "katori", ladle: "ladles", plate: "plates" };
        const name = quantity === 1 ? unit : (plural[unit] || unit);
        const weight = Number(food.amountGrams || food.amount);
        const approximate = isApproximateFoodUnit(food, unit);
        return formatFoodAmount(quantity) + " " + name + (unit === "g" ? "" : (approximate ? " ≈ " : " · ") + formatFoodAmount(weight) + " g");
    }
    return food && Number(food.servingCount) > 0
        ? food.servingCount + " × " + (food.servingGrams || "unknown") + " g serving"
        : (food && (food.amountGrams || food.amount) || 0) + " g";
}

function renderFoodShortcuts() {
    const root = document.getElementById("food-shortcuts");
    if (!root) return;
    if (typeof root.replaceChildren === "function") root.replaceChildren();
    else { root.innerHTML = ""; root.children = []; }
    const library = getFoodLibrary();
    const sections = [
        { title: "Saved custom foods", items: library.customFoods.slice(0, 6) },
        { title: "Favorites", items: library.favorites.slice(0, 6) }
    ].filter(function (section) { return section.items.length > 0; });
    if (!sections.length) {
        const note = document.createElement("small");
        note.className = "muted-copy";
        note.textContent = "Favorite foods and saved custom foods will appear here for quick logging.";
        root.appendChild(note);
        return;
    }
    sections.forEach(function (section) {
        const group = document.createElement("div");
        group.className = "food-shortcut-group";
        const heading = document.createElement("strong");
        heading.textContent = section.title;
        const list = document.createElement("div");
        list.className = "food-shortcut-list";
        section.items.forEach(function (food) {
            const button = document.createElement("button");
            const servingGrams = Number(food.servingGrams);
            const canUseServing = Number.isFinite(servingGrams) && servingGrams > 0;
            const shortcutUnit = canUseServing ? "serving" : "g";
            const shortcutAmount = canUseServing ? 1 : 100;
            button.type = "button";
            button.className = "secondary-btn food-shortcut";
            button.textContent = food.name + (canUseServing ? " · 1 serving (" + servingGrams + " g)" : " · 100 g");
            button.addEventListener("click", function () {
                const meal = document.getElementById("food-meal");
                addFoodToSelectedDay(food, shortcutAmount, meal ? meal.value : "Snack", shortcutUnit);
            });
            list.appendChild(button);
        });
        if (typeof group.append === "function") group.append(heading, list);
        else { group.appendChild(heading); group.appendChild(list); }
        root.appendChild(group);
    });
}


/*
 * REMOVE FOOD
 */

function removeFood(index) {

    const nutrition =
        getNutrition();


    const removedFood =
        nutrition.foods[index];


    if (!removedFood) {

        return;

    }

    nutrition.foods.splice(
        index,
        1
    );

    recalculateNutritionTotals(nutrition);


    if (!saveNutrition(
        nutrition
    )) return;

    if (editingFoodIndex === index) cancelFoodEdit();
    else if (editingFoodIndex > index) editingFoodIndex -= 1;


    updateNutritionDisplay();

    updateFoodList();

}

function editFood(index) {
    const food = getNutrition().foods[index];
    const amountGrams = Number(food && (food.amountGrams || food.amount));
    if (!food || !(amountGrams > 0)) return;
    editingFoodIndex = index;
    editingFoodDateKey = getNutritionDateKey();
    editingFoodSnapshot = JSON.stringify(food);
    document.getElementById("food-name").value = food.name;
    const amountUnit = document.getElementById("food-amount-unit");
    const savedUnit = food.amountUnit ? normalizeFoodAmountUnit(food.amountUnit) : (Number(food.servingCount) > 0 ? "serving" : "g");
    const quantity = Number(food.enteredAmount) > 0 ? food.enteredAmount : (Number(food.servingCount) > 0 ? food.servingCount : amountGrams);
    if (amountUnit) amountUnit.value = savedUnit;
    document.getElementById("food-amount").value = quantity;
    document.getElementById("food-meal").value = food.meal || "Snack";
    const per100 = function (key) { return food[key] === null || food[key] === undefined ? null : Number(food[key]) * 100 / amountGrams; };
    const knownFood = findFood(food.name);
    const editUnitGrams = Object.assign({}, knownFood && knownFood.unitGrams || {}, food.unitGrams || {});
    const editUnits = Array.from(new Set([].concat(knownFood && knownFood.units || [], food.units || [], [savedUnit])));
    if (savedUnit === "piece" && !(editUnitGrams.piece > 0) && Number(editUnitGrams.slice) > 0) {
        editUnitGrams.piece = Number(editUnitGrams.slice);
    }
    if (savedUnit !== "g" && savedUnit !== "oz" && savedUnit !== "serving") {
        const loggedWeight = Number(food.gramsPerUnit);
        if (loggedWeight > 0) editUnitGrams[savedUnit] = loggedWeight;
    }
    window.fitcalcPendingFood = {
        name: food.name, calories: per100("calories"), protein: per100("protein"), carbs: per100("carbs"), fat: per100("fat"), fiber: per100("fiber"),
        servingGrams: food.servingGrams || (knownFood && knownFood.servingGrams), unitGrams: editUnitGrams, units: editUnits,
        approximateUnits: food.approximateUnits || (knownFood && knownFood.approximateUnits) || [],
        defaultUnit: savedUnit, preparation: food.preparation || "", source: food.source, barcode: food.barcode, missingNutrients: food.missingNutrients || []
    };
    const button = document.getElementById("add-food");
    if (button) button.textContent = "Save changes";
    const cancel = document.getElementById("cancel-food-edit");
    if (cancel) cancel.hidden = false;
    setNutritionFoodUnits(window.fitcalcPendingFood, { forceDefault: true, preferredUnit: savedUnit });
    updateFoodAmountLabel();
    updateNutritionFoodPreview();
    document.getElementById("food-name").focus();
}

let lastFoodEntryName = "";
const foodUnitLabels = {
    g: "g", oz: "oz", ml: "ml", tsp: "tsp", tbsp: "tbsp", cup: "cup", glass: "glass",
    piece: "piece", slice: "slice", serving: "serving", katori: "katori (approx.)",
    ladle: "ladle / kadchi (approx.)", plate: "plate (approx.)"
};

function foodUnitPreferenceKey(foodData) {
    return normalizeFoodName(foodData && foodData.name) + "\u0000" + normalizeFoodName(foodData && foodData.brand);
}

function getLastFoodAmountUnit(foodData) {
    try {
        const preferences = typeof getFitCalcPreferences === "function" ? getFitCalcPreferences() : {};
        const saved = preferences.foodAmountUnits && preferences.foodAmountUnits[foodUnitPreferenceKey(foodData)];
        return saved ? normalizeFoodAmountUnit(saved) : null;
    } catch (error) { return null; }
}

function rememberFoodAmountUnit(foodData, unit) {
    if (!foodData || !foodData.name || typeof saveFitCalcPreferences !== "function") return;
    try {
        const preferences = getFitCalcPreferences();
        const units = Object.assign({}, preferences.foodAmountUnits || {});
        units[foodUnitPreferenceKey(foodData)] = normalizeFoodAmountUnit(unit);
        saveFitCalcPreferences({ foodAmountUnits: units });
    } catch (error) { /* Food logging remains available when preferences are read-only. */ }
}

function currentFoodEntryData() {
    const name = document.getElementById("food-name");
    const foodName = name ? name.value.trim() : "";
    const pending = window.fitcalcPendingFood;
    return pending && normalizeFoodName(pending.name) === normalizeFoodName(foodName) ? pending : findFood(foodName);
}

function supportedFoodUnits(foodData) {
    const result = ["g", "oz"];
    if (!foodData) return result;
    const candidates = Array.isArray(foodData.units)
        ? foodData.units
        : ["serving"].concat(Object.keys(foodData.unitGrams || {}));
    candidates.forEach(function (unit) {
        const normalized = normalizeFoodAmountUnit(unit);
        if (normalized === "g" || normalized === "oz") return;
        if (normalized === "serving" && Number(foodData.servingGrams) > 0 && !result.includes(normalized)) result.push(normalized);
        else if (normalized !== "serving" && Number(foodData.unitGrams && foodData.unitGrams[normalized]) > 0 && !result.includes(normalized)) result.push(normalized);
    });
    return result;
}

function setNutritionFoodUnits(foodData, options) {
    const select = document.getElementById("food-amount-unit");
    if (!select) return;
    const settings = options || {};
    const input = document.getElementById("food-amount");
    const previousUnit = normalizeFoodAmountUnit(select.value);
    const units = supportedFoodUnits(foodData);
    const foodKey = normalizeFoodName(foodData && foodData.name);
    const isNewFood = settings.forceDefault === true || (foodKey && foodKey !== lastFoodEntryName);
    let desiredUnit = previousUnit;
    if (isNewFood) {
        const rememberedUnit = getLastFoodAmountUnit(foodData);
        desiredUnit = rememberedUnit && units.includes(rememberedUnit)
            ? rememberedUnit
            : normalizeFoodAmountUnit(foodData && foodData.defaultUnit);
        if (desiredUnit === "g" && typeof getFitCalcWeightUnit === "function" && getFitCalcWeightUnit() === "lb") desiredUnit = "oz";
    }
    if (settings.preferredUnit && units.includes(normalizeFoodAmountUnit(settings.preferredUnit))) {
        desiredUnit = normalizeFoodAmountUnit(settings.preferredUnit);
    }
    const selectedUnit = units.includes(desiredUnit) ? desiredUnit : (units.includes("serving") && isNewFood ? "serving" : "g");
    const amountWasEmpty = !input || !String(input.value || "").trim() || input.value === "100";

    select.innerHTML = units.map(function (unit) {
        const label = foodUnitLabels[unit] || unit;
        return '<option value="' + unit + '">' + label + '</option>';
    }).join("");
    select.value = selectedUnit;
    lastFoodEntryName = foodKey;
    if (isNewFood && selectedUnit !== "g" && amountWasEmpty && input) input.value = "1";
    updateFoodAmountLabel();
}

function updateFoodAmountLabel() {
    const unit = document.getElementById("food-amount-unit");
    const label = document.getElementById("food-amount-label");
    const input = document.getElementById("food-amount");
    const selected = unit ? normalizeFoodAmountUnit(unit.value) : "g";
    if (label) label.textContent = "Amount";
    if (input) {
        input.step = selected === "g" || selected === "ml" ? "1" : (selected === "oz" ? "0.1" : "0.25");
        input.placeholder = selected === "g" || selected === "ml" ? "100" : "1";
        if (!input.value) input.value = input.placeholder;
    }
    updateNutritionFoodPreview();
}

document.getElementById("food-amount-unit")?.addEventListener("change", updateFoodAmountLabel);
document.getElementById("food-name")?.addEventListener("input", function () {
    setNutritionFoodUnits(currentFoodEntryData());
});

window.updateNutritionFoodUnits = function (foodData) {
    setNutritionFoodUnits(foodData, { forceDefault: true });
};

function normalizeFoodAmountUnit(unit) {
    const value = String(unit || "g").toLowerCase();
    const aliases = {
        grams: "g", ounces: "oz", ounce: "oz", milliliters: "ml", millilitres: "ml",
        teaspoons: "tsp", teaspoon: "tsp", tablespoons: "tbsp", tablespoon: "tbsp",
        cups: "cup", glasses: "glass", pieces: "piece", slices: "slice", servings: "serving",
        katoris: "katori", ladles: "ladle", plates: "plate"
    };
    const normalized = aliases[value] || value;
    return ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass", "piece", "slice", "serving", "katori", "ladle", "plate"].includes(normalized) ? normalized : "g";
}

function gramsPerFoodUnit(foodData, unit) {
    const selected = normalizeFoodAmountUnit(unit);
    const builtIn = foodDatabase.concat(typeof indianFoodDatabase !== "undefined" ? indianFoodDatabase : []).find(function (item) {
        return normalizeFoodName(item.name) === normalizeFoodName(foodData && foodData.name);
    });
    const unitGrams = foodData && foodData.unitGrams || {};
    const fallbackUnitGrams = builtIn && builtIn.unitGrams || {};
    const grams = Number(unitGrams[selected]) > 0 ? Number(unitGrams[selected]) : Number(fallbackUnitGrams[selected]);
    if (selected === "g") return 1;
    if (selected === "oz") return 28.35;
    if (selected === "serving") {
        const serving = Number(foodData && foodData.servingGrams);
        if (serving > 0) return serving;
        return Number(builtIn && builtIn.servingGrams) > 0 ? Number(builtIn.servingGrams) : null;
    }
    return grams > 0 ? grams : null;
}

function isApproximateFoodUnit(foodData, unit) {
    const selected = normalizeFoodAmountUnit(unit);
    const builtIn = foodDatabase.concat(typeof indianFoodDatabase !== "undefined" ? indianFoodDatabase : []).find(function (item) {
        return normalizeFoodName(item.name) === normalizeFoodName(foodData && foodData.name);
    });
    return (Array.isArray(foodData && foodData.approximateUnits) && foodData.approximateUnits.includes(selected)) ||
        (Array.isArray(builtIn && builtIn.approximateUnits) && builtIn.approximateUnits.includes(selected)) ||
        FOOD_APPROXIMATE_UNITS.includes(selected) && Number(foodData && foodData.unitGrams && foodData.unitGrams[selected]) > 0;
}

function updateNutritionFoodPreview() {
    const preview = document.getElementById("food-nutrition-preview");
    if (!preview) return;
    const name = document.getElementById("food-name");
    const amount = document.getElementById("food-amount");
    const unit = document.getElementById("food-amount-unit");
    const foodName = name ? name.value.trim() : "";
    const pending = window.fitcalcPendingFood;
    const foodData = pending && pending.name.toLowerCase() === foodName.toLowerCase() ? pending : findFood(foodName);
    const quantity = Number(amount && amount.value);
    if (!foodData || !foodName) {
        preview.textContent = "";
        return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
        preview.textContent = foodData.name + " · enter an amount to preview macros.";
        return;
    }
    const selectedUnit = normalizeFoodAmountUnit(unit && unit.value);
    const gramsPerUnit = gramsPerFoodUnit(foodData, selectedUnit);
    if (!(gramsPerUnit > 0)) {
        preview.textContent = "Choose a supported amount unit for " + foodData.name + ".";
        return;
    }
    const grams = gramsPerUnit * quantity;
    const logged = calculateLoggedFood(foodData, quantity, "", selectedUnit);
    const amountName = quantity === 1 ? selectedUnit : ({ piece: "pieces", slice: "slices", cup: "cups", glass: "glasses", serving: "servings", ladle: "ladles", plate: "plates" }[selectedUnit] || selectedUnit);
    const approximateAmount = isApproximateFoodUnit(foodData, selectedUnit);
    const amountText = approximateAmount
        ? formatFoodAmount(quantity) + " " + amountName + " ≈ " + formatFoodAmount(grams) + " g"
        : formatFoodAmount(quantity) + " " + amountName;
    const weightText = !approximateAmount && selectedUnit !== "g" ? " · " + formatFoodAmount(grams) + " g used" : "";
    preview.textContent = foodData.name + " · " + amountText + weightText + " · " + formatFoodNutrient(logged.calories, "kcal") +
        " · " + formatFoodNutrient(logged.protein, "g protein") + " · " + formatFoodNutrient(logged.carbs, "g carbs") +
        " · " + formatFoodNutrient(logged.fat, "g fat");
}

function formatFoodAmount(value) {
    return (Math.round(Number(value) * 10) / 10).toString();
}

document.getElementById("food-name")?.addEventListener("input", updateNutritionFoodPreview);
document.getElementById("food-amount")?.addEventListener("input", updateNutritionFoodPreview);

function cancelFoodEdit() {
    editingFoodIndex = -1;
    editingFoodDateKey = null;
    editingFoodSnapshot = null;
    window.fitcalcPendingFood = null;
    const button = document.getElementById("add-food");
    if (button) button.textContent = "Add to log";
    const cancel = document.getElementById("cancel-food-edit");
    if (cancel) cancel.hidden = true;
    const name = document.getElementById("food-name");
    const amount = document.getElementById("food-amount");
    if (name) name.value = "";
    if (amount) amount.value = "";
    updateNutritionFoodPreview();
}

const cancelFoodEditButton = document.getElementById("cancel-food-edit");
if (cancelFoodEditButton) cancelFoodEditButton.addEventListener("click", cancelFoodEdit);

function calculateLoggedFood(foodData, amount, meal, amountUnit) {
    const enteredAmount = Number(amount);
    const servingGrams = Number(foodData.servingGrams) > 0 ? Number(foodData.servingGrams) : null;
    const unit = normalizeFoodAmountUnit(amountUnit);
    const gramsPerUnit = gramsPerFoodUnit(foodData, unit);
    const actualGrams = Number.isFinite(enteredAmount) && gramsPerUnit > 0 ? enteredAmount * gramsPerUnit : NaN;
    const factor = actualGrams / 100;
    const scaled = function (key) {
        const value = foodData[key];
        return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value) * factor;
    };
    return {
        name: String(foodData.name), amount: actualGrams, amountGrams: actualGrams, meal: meal || "Snack",
        enteredAmount: enteredAmount,
        amountUnit: unit,
        gramsPerUnit: gramsPerUnit,
        servingCount: unit === "serving" ? enteredAmount : null,
        servingGrams: servingGrams,
        unitGrams: Object.assign({}, foodData.unitGrams || {}),
        units: supportedFoodUnits(foodData),
        approximateUnits: Array.isArray(foodData.approximateUnits) ? foodData.approximateUnits.slice() : [],
        defaultUnit: foodData.defaultUnit || "g",
        preparation: foodData.preparation || "",
        calories: scaled("calories"),
        protein: scaled("protein"),
        carbs: scaled("carbs"),
        fat: scaled("fat"),
        fiber: scaled("fiber"),
        missingNutrients: Array.isArray(foodData.missingNutrients) ? foodData.missingNutrients.slice() : [],
        source: foodData.source || "FitCalc local list",
        barcode: foodData.barcode || ""
    };
}

function addFoodToSelectedDay(foodData, amount, meal, amountUnit) {
    const food = calculateLoggedFood(foodData, amount, meal, amountUnit);
    const nutrition = getNutrition();
    nutrition.foods.push(food);
    recalculateNutritionTotals(nutrition);
    if (!saveNutrition(nutrition)) return false;
    rememberFood(food);
    rememberFoodAmountUnit(foodData, amountUnit);
    updateNutritionDisplay();
    updateFoodList();
    window.fitcalcToast("Food added to your log.");
    return true;
}

function recalculateNutritionTotals(nutrition) {
    ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
        const foods = nutrition.foods || [];
        if (foods.some(function (food) { return food[key] === null || food[key] === undefined || !Number.isFinite(Number(food[key])); })) {
            nutrition[key] = null;
        } else {
            nutrition[key] = foods.reduce(function (sum, food) { return sum + Number(food[key]); }, 0);
        }
    });
}


/*
 * ADD FOOD
 */

const addFoodButton =
    document.getElementById(
        "add-food"
    );


if (addFoodButton) {

    addFoodButton.addEventListener(
        "click",
        function () {

            const foodName =
                document.getElementById(
                    "food-name"
                ).value;


            const foodAmount =
                Number(
                    document.getElementById(
                        "food-amount"
                    ).value
                );


            if (!foodName.trim()) {

                window.fitcalcToast("Enter a food name.", "error");

                return;

            }


            if (
                !Number.isFinite(foodAmount) ||
                foodAmount <= 0
            ) {

                window.fitcalcToast("Enter an amount greater than zero.", "error");

                return;

            }


            const pending = window.fitcalcPendingFood;
            const foodData = pending && pending.name.toLowerCase() === foodName.trim().toLowerCase()
                ? pending
                : findFood(foodName);


            if (!foodData) {

                window.fitcalcToast("That food is not in the local list. Search the food database or choose a listed item.", "error");

                return;

            }


            const amountUnit = document.getElementById("food-amount-unit")?.value || "grams";
            const food = calculateLoggedFood(foodData, foodAmount, document.getElementById("food-meal").value, amountUnit);
            if (!Number.isFinite(food.amount) || food.amount <= 0) {
                window.fitcalcToast("Choose a supported amount unit for this food.", "error");
                return;
            }
            if (food.amount > 10000) {
                window.fitcalcToast("Food amount cannot exceed 10,000 g.", "error");
                return;
            }


            const nutrition =
                getNutrition();


            const wasEditing = editingFoodIndex >= 0;
            if (wasEditing && nutrition.foods[editingFoodIndex]) {
                nutrition.foods[editingFoodIndex] = food;
            } else {
                nutrition.foods.push(food);
            }
            recalculateNutritionTotals(nutrition);


            if (!saveNutrition(
                nutrition
            )) return;

            rememberFood(food);
            rememberFoodAmountUnit(foodData, amountUnit);


            document.getElementById(
                "food-name"
            ).value = "";


            document.getElementById(
                "food-amount"
            ).value = "";

            cancelFoodEdit();


            updateNutritionDisplay();

            updateFoodList();
            window.fitcalcToast(wasEditing ? "Food entry updated." : "Food added to your log.");

        }
    );

}

const customFoodForm = document.getElementById("custom-food-form");
if (customFoodForm) {
    customFoodForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const food = {
            name: document.getElementById("custom-food-name").value,
            calories: document.getElementById("custom-food-calories").value,
            protein: document.getElementById("custom-food-protein").value,
            carbs: document.getElementById("custom-food-carbs").value,
            fat: document.getElementById("custom-food-fat").value,
            fiber: document.getElementById("custom-food-fiber").value,
            servingGrams: document.getElementById("custom-food-serving").value,
            pieceGrams: document.getElementById("custom-food-piece-grams").value,
            tablespoonGrams: document.getElementById("custom-food-tbsp-grams").value,
            cupGrams: document.getElementById("custom-food-cup-grams").value,
            katoriGrams: document.getElementById("custom-food-katori-grams").value
        };
        if (!saveCustomFood(food)) {
            window.fitcalcToast("Check the food name and nutrition values. Names from the built-in list cannot be replaced.", "error");
            return;
        }
        customFoodForm.reset();
        renderFoodShortcuts();
        window.fitcalcToast("Custom food saved per 100 g.");
    });
}

function copyPreviousDayNutrition() {
    const previousDate = new Date(selectedNutritionDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousKey = getNutritionDateKey(previousDate);
    const source = getNutritionFor(previousKey);
    if (!source.foods.length && !(Number(source.water) > 0)) {
        window.fitcalcToast("There is no food or water logged on the previous day.", "error");
        return false;
    }
    const current = getNutrition();
    if ((current.foods.length || current.water > 0) && typeof window.confirm === "function" &&
        !window.confirm("Replace this day's food and water with the previous day's entries?")) return false;
    current.foods = source.foods.map(function (food) { return Object.assign({}, food); });
    current.water = Number(source.water) || 0;
    recalculateNutritionTotals(current);
    if (!saveNutrition(current)) return false;
    updateNutritionDisplay();
    updateFoodList();
    window.fitcalcToast("Previous day's nutrition copied.");
    return true;
}

document.getElementById("copy-previous-day")?.addEventListener("click", copyPreviousDayNutrition);


/*
 * WATER
 */

function updateWaterDisplay(
    nutrition
) {

    if (!nutrition) {

        nutrition =
            getNutrition();

    }


    const water =
        Number(nutrition.water) || 0;


    const waterEl =
        document.getElementById(
            "planner-water"
        );


    if (waterEl) {

        waterEl.textContent =
            water.toFixed(2);

    }

    const dateKey = getNutritionDateKey();
    const targetLiters = getWaterGoalLiters(getProfile(), getPlannerFor(dateKey));
    const waterGoal = document.getElementById("nutrition-water-goal");
    if (waterGoal) waterGoal.textContent = targetLiters ? targetLiters.toFixed(2) : "—";

    const waterProgressEl =
        document.getElementById(
            "water-progress"
        );


    if (waterProgressEl) {

        const percentage = targetLiters
            ? Math.min((water / targetLiters) * 100, 100)
            : 0;


        waterProgressEl.style.width =
            percentage + "%";
        const meter = waterProgressEl.closest('[role="progressbar"]');
        if (meter) meter.setAttribute("aria-valuenow", String(Math.round(percentage)));

    }

}


/* Add custom amounts while keeping the quick 250 ml action. */

function setWaterAmount(nextWater) {
    const nutrition = getNutrition();
    const currentWater = Number(nutrition.water) || 0;
    const amount = Number(nextWater);
    if (!Number.isFinite(amount) || amount < 0) return false;
    nutrition.water = Math.round(amount * 1000) / 1000;
    if (!saveNutrition(nutrition)) return false;
    previousWaterChange = {
        date: getNutritionDateKey(),
        before: currentWater,
        after: nutrition.water
    };
    updateNutritionDisplay();
    return true;
}

function addWaterAmount(liters) {
    const amount = Number(liters);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10) return false;
    const nutrition = getNutrition();
    return setWaterAmount((Number(nutrition.water) || 0) + amount);
}

function undoWaterChange() {
    if (!previousWaterChange || previousWaterChange.date !== getNutritionDateKey()) {
        window.fitcalcToast("There is no recent water change to undo.", "error");
        return false;
    }
    const nutrition = getNutrition();
    if (Math.abs((Number(nutrition.water) || 0) - previousWaterChange.after) > 0.001) {
        previousWaterChange = null;
        window.fitcalcToast("Water changed since that action, so it cannot be undone safely.", "error");
        return false;
    }
    const previous = previousWaterChange;
    previousWaterChange = null;
    const restored = setWaterAmount(previous.before);
    if (restored) {
        previousWaterChange = null;
        window.fitcalcToast("Last water change undone.");
    }
    return restored;
}

document.getElementById("add-water")?.addEventListener("click", function () {
    if (addWaterAmount(0.25)) window.fitcalcToast("250 ml added.");
});

document.getElementById("add-water-500")?.addEventListener("click", function () {
    if (addWaterAmount(0.5)) window.fitcalcToast("500 ml added.");
});

document.getElementById("add-custom-water")?.addEventListener("click", function () {
    const input = document.getElementById("custom-water-amount");
    const amount = Number(input && input.value);
    if (!input || !String(input.value).trim() || !Number.isFinite(amount) || amount <= 0 || amount > 10) {
        window.fitcalcToast("Enter a water amount from 0.01 to 10 litres.", "error");
        return;
    }
    if (addWaterAmount(amount)) {
        input.value = "";
        window.fitcalcToast(amount.toFixed(2) + " L added.");
    }
});

document.getElementById("undo-water")?.addEventListener("click", undoWaterChange);

/*
 * RESET WATER
 */

const resetWaterButton =
    document.getElementById(
        "reset-water"
    );


if (resetWaterButton) resetWaterButton.addEventListener("click", function () {
    if (setWaterAmount(0)) window.fitcalcToast("Water total reset.");
});


/*
 * INITIALIZE
 */

function refreshNutritionDay() {
    if (editingFoodIndex >= 0) {
        const dateKey = getNutritionDateKey();
        const foods = getNutritionFor(dateKey).foods || [];
        const currentFood = editingFoodDateKey === dateKey ? foods[editingFoodIndex] : null;
        if (!currentFood || JSON.stringify(currentFood) !== editingFoodSnapshot) cancelFoodEdit();
    }
    updateNutritionDateDisplay();
    updateNutritionDisplay();
    updateFoodList();
    updateWaterDisplay();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("focus", refreshNutritionTodayIfNeeded);
    if (typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState !== "hidden") refreshNutritionTodayIfNeeded();
        });
    }
    window.addEventListener("fitcalc:data-change", function (event) {
        const detail = event.detail || {};
        const relevantKeys = [NUTRITION_KEY, PLANNER_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY, FOOD_LIBRARY_KEY];
        if (detail.key && relevantKeys.indexOf(detail.key) === -1) return;
        if (detail.key === FOOD_LIBRARY_KEY) {
            renderFoodShortcuts();
            updateFoodList();
            return;
        }
        if (detail.date && detail.date !== getNutritionDateKey() &&
            (detail.key === NUTRITION_KEY || detail.key === PLANNER_KEY)) return;
        refreshNutritionDay();
    });

    window.addEventListener("storage", function (event) {
        if (event.key === fitcalcStorageKey(FOOD_LIBRARY_KEY)) {
            renderFoodShortcuts();
            updateFoodList();
            return;
        }
        if ([NUTRITION_KEY, PLANNER_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY, FOOD_LIBRARY_KEY].some(function (key) {
            return event.key === fitcalcStorageKey(key);
        })) refreshNutritionDay();
    });
}

updateNutritionDisplay();

updateFoodList();
renderFoodShortcuts();

updateWaterDisplay();
updateNutritionDateDisplay();
updateFoodAmountLabel();
