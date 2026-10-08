/*
 * store.js: the ONLY file that reads/writes localStorage JSON for shared data.
 * Reads never write. Load right after constants.js.
 */
function macrobayStorageKey(key) {
    function isTestPage(target) {
        if (!target || target.MACROBAY_TEST_MODE !== true) return false;
        const pathname = target.location && target.location.pathname;
        return typeof pathname === "string" && (pathname === "/tests" || pathname.indexOf("/tests/") === 0);
    }
    let testMode = typeof window !== "undefined" && isTestPage(window);
    try {
        if (!testMode && window && window.top && window.top !== window) {
            testMode = isTestPage(window.top);
        }
    } catch (error) { /* Cross-origin parents are simply not trusted as test flags. */ }
    return testMode ? "test_" + key : key;
}

function readJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(macrobayStorageKey(key)));
        return value === null || value === undefined ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(macrobayStorageKey(key), JSON.stringify(value));
    } catch (error) {
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new CustomEvent("macrobay:storage-error", { detail: { key: key } }));
        }
        throw error;
    }
}

function getDateKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function getProfile() { return readJSON(PROFILE_KEY, {}); }
function saveProfile(profile) { writeJSON(PROFILE_KEY, profile); }
function updateProfile(data) { saveProfile(Object.assign(getProfile(), data)); }
function getTargets() { return readJSON(TARGETS_KEY, {}); }
function getFoodLibrary() {
    const library = readJSON(FOOD_LIBRARY_KEY, {});
    return {
        customFoods: Array.isArray(library.customFoods) ? library.customFoods : [],
        favorites: Array.isArray(library.favorites) ? library.favorites : [],
        recents: Array.isArray(library.recents) ? library.recents : []
    };
}
function saveFoodLibrary(library) {
    const value = library && typeof library === "object" ? library : {};
    const normalized = {
        customFoods: Array.isArray(value.customFoods) ? value.customFoods : [],
        favorites: Array.isArray(value.favorites) ? value.favorites : [],
        recents: Array.isArray(value.recents) ? value.recents : []
    };
    writeJSON(FOOD_LIBRARY_KEY, normalized);
    announceDataChange(getDateKey(new Date()), FOOD_LIBRARY_KEY);
    return normalized;
}
function getProgressHistoryStorage() { return readJSON(HISTORY_KEY, {}); }
function saveProgressHistoryStorage(history) {
    writeJSON(HISTORY_KEY, history);
    return true;
}

function getMacroBayPreferences() {
    return readJSON(PREFERENCES_KEY, {});
}

function saveMacroBayPreferences(updates) {
    const current = getMacroBayPreferences();
    const next = Object.assign({}, current, updates || {});
    if (updates && updates.units) {
        next.units = Object.assign({}, current.units || {}, updates.units);
    }
    writeJSON(PREFERENCES_KEY, next);
    return next;
}

function hasMeaningfulMacroBayData(value) {
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0;
    if (Array.isArray(value)) return value.some(hasMeaningfulMacroBayData);
    if (typeof value === "object") return Object.keys(value).some(function (key) {
        return hasMeaningfulMacroBayData(value[key]);
    });
    return false;
}

function hasExistingMacroBayUserData() {
    const profile = getProfile();
    const profileFields = ["name", "age", "sex", "height", "weight", "activity", "goal"];
    if (profileFields.some(function (key) { return hasMeaningfulMacroBayData(profile[key]); })) return true;

    return [
        getTargets(),
        readJSON(NUTRITION_KEY, {}),
        readJSON(PLANNER_KEY, {}),
        getProgressHistoryStorage(),
        readJSON(WORKOUT_TEMPLATES_KEY, []),
        getFoodLibrary()
    ].some(hasMeaningfulMacroBayData);
}

function hasCompletedMacroBayOnboarding() {
    if (getMacroBayPreferences().onboardingComplete === true) return true;
    if (!hasExistingMacroBayUserData()) return false;

    // Migrate users who already have MacroBay data into the single persisted
    // completion state without touching their profile or other data records.
    try { saveMacroBayPreferences({ onboardingComplete: true }); }
    catch (error) { /* Existing user data still takes precedence if storage is read-only. */ }
    return true;
}

function completeMacroBayOnboarding() {
    saveMacroBayPreferences({ onboardingComplete: true });
    return true;
}

function getMacroBayUnits() {
    const units = getMacroBayPreferences().units || {};
    return {
        weight: units.weight === "lb" ? "lb" : "kg",
        height: units.height === "ft-in" ? "ft-in" : "cm"
    };
}

function getMacroBayWeightUnit() {
    return getMacroBayUnits().weight;
}

function kilogramsToDisplayWeight(kilograms) {
    const value = Number(kilograms);
    if (!Number.isFinite(value)) return null;
    return getMacroBayWeightUnit() === "lb" ? value * 2.20462262185 : value;
}

function displayWeightToKilograms(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return getMacroBayWeightUnit() === "lb" ? number / 2.20462262185 : number;
}

function formatMacroBayWeight(kilograms, decimals) {
    const value = kilogramsToDisplayWeight(kilograms);
    if (value === null) return "—";
    return value.toFixed(Number.isInteger(decimals) ? decimals : 1);
}

function centimetersToFeetInches(centimeters) {
    const value = Number(centimeters);
    if (!Number.isFinite(value)) return null;
    let totalInches = Math.round((value / 2.54) * 10) / 10;
    let feet = Math.floor(totalInches / 12);
    let inches = Math.round((totalInches - feet * 12) * 10) / 10;
    if (inches >= 12) { feet += 1; inches = 0; }
    return { feet: feet, inches: inches };
}

function feetInchesToCentimeters(feet, inches) {
    const feetValue = Number(feet);
    const inchValue = Number(inches);
    if (!Number.isFinite(feetValue) || !Number.isFinite(inchValue)) return null;
    return (feetValue * 12 + inchValue) * 2.54;
}

function formatMacroBayHeight(centimeters) {
    const value = Number(centimeters);
    if (!Number.isFinite(value)) return "—";
    if (getMacroBayUnits().height === "cm") return value.toFixed(1) + " cm";
    const parts = centimetersToFeetInches(value);
    return parts.feet + " ft " + parts.inches.toFixed(1) + " in";
}

function emptyNutritionDay() {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0, foods: [] };
}

function emptyPlannerDay(dateKey) {
    return { date: dateKey, steps: 0, weight: null, workouts: [], tasks: [] };
}

// Read-only: returns an empty day if nothing is stored (does NOT save it).
function getNutritionFor(dateKey) {
    return Object.assign(emptyNutritionDay(), readJSON(NUTRITION_KEY, {})[dateKey] || {});
}

function getPlannerFor(dateKey) {
    return Object.assign(emptyPlannerDay(dateKey), readJSON(PLANNER_KEY, {})[dateKey] || {});
}

function saveNutritionFor(dateKey, nutrition) {
    const allDays = readJSON(NUTRITION_KEY, {});
    allDays[dateKey] = Object.assign(emptyNutritionDay(), nutrition || {});
    writeJSON(NUTRITION_KEY, allDays);
    announceDataChange(dateKey, NUTRITION_KEY);
    return allDays[dateKey];
}

function savePlannerFor(dateKey, planner) {
    const allDays = readJSON(PLANNER_KEY, {});
    allDays[dateKey] = Object.assign(emptyPlannerDay(dateKey), planner || {}, { date: dateKey });
    writeJSON(PLANNER_KEY, allDays);
    announceDataChange(dateKey, PLANNER_KEY);
    return allDays[dateKey];
}

function persistWorkoutTemplates(templates) {
    writeJSON(WORKOUT_TEMPLATES_KEY, Array.isArray(templates) ? templates : []);
}

function announceDataChange(dateKey, key) {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("macrobay:data-change", {
            detail: { date: dateKey, key: key || null }
        }));
    }
}

/*
 * Data backup and schema migrations
 */
const MACROBAY_BACKUP_FORMAT = "macrobay-backup";
const LEGACY_FITCALC_BACKUP_FORMAT = "fitcalc-backup";
const MACROBAY_DATA_KEYS = [
    PROFILE_KEY,
    TARGETS_KEY,
    NUTRITION_KEY,
    PLANNER_KEY,
    HISTORY_KEY,
    WORKOUT_TEMPLATES_KEY,
    PREFERENCES_KEY,
    FOOD_LIBRARY_KEY
];
const MACROBAY_RESETTABLE_KEYS = MACROBAY_DATA_KEYS.concat([
    LEGACY_PROGRESS_BACKFILL_KEY,
    PROGRESS_BACKFILL_KEY
]);
const MACROBAY_DATA_DEFAULTS = {
    [PROFILE_KEY]: {},
    [TARGETS_KEY]: {},
    [NUTRITION_KEY]: {},
    [PLANNER_KEY]: {},
    [HISTORY_KEY]: {},
    [WORKOUT_TEMPLATES_KEY]: [],
    [PREFERENCES_KEY]: {},
    [FOOD_LIBRARY_KEY]: { customFoods: [], favorites: [], recents: [] }
};

// Version 0 is the unversioned localStorage layout already used by MacroBay.
// It is structurally identical to v1, so the first migration only records the
// version. Future migrations can transform this known-data object.
const MACROBAY_SCHEMA_MIGRATIONS = {
    0: function (data) { return data; },
    1: function (data) {
        return Object.assign({}, data, {
            [FOOD_LIBRARY_KEY]: Object.prototype.hasOwnProperty.call(data, FOOD_LIBRARY_KEY)
                ? data[FOOD_LIBRARY_KEY]
                : { customFoods: [], favorites: [], recents: [] }
        });
    }
};

function isMacroBayRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneMacroBayJSON(value) {
    return JSON.parse(JSON.stringify(value));
}

function readMacroBayData() {
    const data = {};
    MACROBAY_DATA_KEYS.forEach(function (key) {
        const raw = localStorage.getItem(macrobayStorageKey(key));
        if (raw === null) {
            data[key] = cloneMacroBayJSON(MACROBAY_DATA_DEFAULTS[key]);
            return;
        }
        try {
            data[key] = JSON.parse(raw);
        } catch (error) {
            throw new Error("Saved " + key + " data is not valid JSON. MacroBay left it unchanged.");
        }
    });
    return validateMacroBayData(data);
}

function validateMacroBayData(data) {
    if (!isMacroBayRecord(data)) throw new Error("Backup data must be a JSON object.");

    const keys = Object.keys(data);
    if (keys.length !== MACROBAY_DATA_KEYS.length || MACROBAY_DATA_KEYS.some(function (key) {
        return !Object.prototype.hasOwnProperty.call(data, key);
    }) || keys.some(function (key) { return MACROBAY_DATA_KEYS.indexOf(key) === -1; })) {
        throw new Error("Backup is missing required MacroBay data or contains unsupported fields.");
    }

    MACROBAY_DATA_KEYS.forEach(function (key) {
        const value = data[key];
        if (key === WORKOUT_TEMPLATES_KEY) {
            if (!Array.isArray(value)) throw new Error("Workout templates in this backup are invalid.");
            return;
        }
        if (key === FOOD_LIBRARY_KEY) {
            if (!isMacroBayRecord(value) || ["customFoods", "favorites", "recents"].some(function (list) {
                return !Array.isArray(value[list]);
            })) throw new Error("The food library in this backup is invalid.");
            return;
        }
        if (!isMacroBayRecord(value)) throw new Error("The " + key + " section in this backup is invalid.");
        if ([NUTRITION_KEY, PLANNER_KEY, HISTORY_KEY].indexOf(key) !== -1 &&
            Object.keys(value).some(function (date) { return !isMacroBayRecord(value[date]); })) {
            throw new Error("A daily record in the " + key + " section is invalid.");
        }
    });

    // Verify that the complete payload can be persisted as JSON before writes.
    JSON.stringify(data);
    return data;
}

function migrateMacroBayData(data, fromVersion) {
    let migrated = data;
    for (let version = fromVersion; version < APP_SCHEMA_VERSION; version += 1) {
        const migration = MACROBAY_SCHEMA_MIGRATIONS[version];
        if (typeof migration !== "function") {
            throw new Error("This backup uses an unsupported MacroBay data version.");
        }
        const result = migration(migrated);
        if (result !== undefined) migrated = result;
    }
    return validateMacroBayData(migrated);
}

function isStandaloneCalculatorPage() {
    return typeof document !== "undefined" && document.body &&
        typeof document.body.hasAttribute === "function" &&
        document.body.hasAttribute("data-calc");
}

function initializeMacroBayStorageSchema() {
    if (isStandaloneCalculatorPage()) return false;

    const storedVersion = Number(readJSON(SCHEMA_VERSION_KEY, 0));
    if (!Number.isInteger(storedVersion) || storedVersion < 0) {
        throw new Error("MacroBay data has an invalid schema version.");
    }
    if (storedVersion > APP_SCHEMA_VERSION) return false;
    if (storedVersion === APP_SCHEMA_VERSION) return true;

    const foodLibraryWasMissing = storedVersion < 2 && localStorage.getItem(macrobayStorageKey(FOOD_LIBRARY_KEY)) === null;
    const data = readMacroBayData();
    const migrated = migrateMacroBayData(data, storedVersion);
    if (JSON.stringify(migrated) !== JSON.stringify(data)) {
        writeMacroBayDataTransaction(migrated, APP_SCHEMA_VERSION);
    } else {
        if (foodLibraryWasMissing) writeJSON(FOOD_LIBRARY_KEY, migrated[FOOD_LIBRARY_KEY]);
        if (storedVersion !== APP_SCHEMA_VERSION) writeJSON(SCHEMA_VERSION_KEY, APP_SCHEMA_VERSION);
    }
    return true;
}

function requireSupportedMacroBaySchema() {
    if (!initializeMacroBayStorageSchema()) {
        throw new Error("This MacroBay data was created by a newer app version and cannot be changed here.");
    }
}

function exportMacroBayData() {
    requireSupportedMacroBaySchema();
    const data = validateMacroBayData(readMacroBayData());
    return {
        format: MACROBAY_BACKUP_FORMAT,
        schemaVersion: APP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: data
    };
}

function validateMacroBayBackup(backup) {
    if (!isMacroBayRecord(backup) ||
        [MACROBAY_BACKUP_FORMAT, LEGACY_FITCALC_BACKUP_FORMAT].indexOf(backup.format) === -1) {
        throw new Error("This file is not a MacroBay JSON backup.");
    }
    if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 0) {
        throw new Error("This backup has an invalid data version.");
    }
    if (backup.schemaVersion > APP_SCHEMA_VERSION) {
        throw new Error("This backup is from a newer MacroBay version. Update MacroBay before importing it.");
    }
    return migrateMacroBayData(normalizeMacroBayBackupKeys(backup.data), backup.schemaVersion);
}

function normalizeMacroBayBackupKeys(data) {
    if (!isMacroBayRecord(data)) return data;
    const aliases = {};
    MACROBAY_DATA_KEYS.forEach(function (key) {
        const unprefixed = key.replace(/^macrobay_/, "");
        aliases[key] = key;
        aliases["fitcalc_" + unprefixed] = key;
        aliases[unprefixed] = key;
    });

    const normalized = {};
    Object.keys(data).forEach(function (key) {
        const canonicalKey = aliases[key] || key;
        if (Object.prototype.hasOwnProperty.call(normalized, canonicalKey) &&
            JSON.stringify(normalized[canonicalKey]) !== JSON.stringify(data[key])) {
            throw new Error("This backup contains conflicting data keys for " + canonicalKey + ".");
        }
        normalized[canonicalKey] = data[key];
    });
    return normalized;
}

function snapshotMacroBayStorage(keys) {
    const snapshot = {};
    keys.forEach(function (key) {
        const storageKey = macrobayStorageKey(key);
        snapshot[storageKey] = localStorage.getItem(storageKey);
    });
    return snapshot;
}

function restoreMacroBayStorage(snapshot) {
    Object.keys(snapshot).forEach(function (key) {
        try {
            if (snapshot[key] === null) localStorage.removeItem(key);
            else localStorage.setItem(key, snapshot[key]);
        } catch (error) { /* Best effort rollback if storage itself is unavailable. */ }
    });
}

function writeMacroBayDataTransaction(data, schemaVersion) {
    const keys = MACROBAY_DATA_KEYS.concat([SCHEMA_VERSION_KEY]);
    const previous = snapshotMacroBayStorage(keys);
    try {
        MACROBAY_DATA_KEYS.forEach(function (key) { writeJSON(key, data[key]); });
        writeJSON(SCHEMA_VERSION_KEY, schemaVersion);
    } catch (error) {
        restoreMacroBayStorage(previous);
        throw error;
    }
}

function importMacroBayData(backup) {
    const data = validateMacroBayBackup(backup);
    requireSupportedMacroBaySchema();
    writeMacroBayDataTransaction(data, APP_SCHEMA_VERSION);
    return true;
}

function resetMacroBayData() {
    requireSupportedMacroBaySchema();
    const previous = snapshotMacroBayStorage(MACROBAY_RESETTABLE_KEYS);
    try {
        MACROBAY_RESETTABLE_KEYS.forEach(function (key) {
            localStorage.removeItem(macrobayStorageKey(key));
        });
    } catch (error) {
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new CustomEvent("macrobay:storage-error", { detail: { key: "MacroBay data" } }));
        }
        restoreMacroBayStorage(previous);
        throw error;
    }
    return true;
}

function deleteMacroBayDay(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return false;
    const keys = [NUTRITION_KEY, PLANNER_KEY, HISTORY_KEY];
    const previous = snapshotMacroBayStorage(keys);
    try {
        keys.forEach(function (key) {
            const records = readJSON(key, {});
            if (!Object.prototype.hasOwnProperty.call(records, dateKey)) return;
            delete records[dateKey];
            writeJSON(key, records);
        });
    } catch (error) {
        restoreMacroBayStorage(previous);
        return false;
    }
    keys.forEach(function (key) { announceDataChange(dateKey, key); });
    return true;
}

// App pages stamp legacy data as v1 without rewriting the user's existing
// records. Standalone calculators remain read-only with respect to app data.
if (!isStandaloneCalculatorPage()) {
    try { initializeMacroBayStorageSchema(); }
    catch (error) { /* Storage errors are announced by writeJSON; keep the app usable. */ }
}
