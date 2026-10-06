/* Public read-only exercise discovery through wger. No account is needed for public lists. */
const WGER_EXERCISEINFO_URL = "https://wger.de/api/v2/exerciseinfo/";
const WGER_EXERCISE_LIBRARY_MAX_PAGES = 20;
const WGER_EXERCISE_LIBRARY_PAGE_SIZE = 100;
const WGER_EXERCISE_LIBRARY_BATCH_SIZE = 4;
let exerciseLibraryCache = null;
const exerciseLibraryPages = new Map();
let exerciseLibraryTotalCount = null;
let exerciseLibraryLastPageOffset = null;
const exerciseSearchRequestIds = new WeakMap();

function invalidateExerciseSearch(resultsRoot) {
    if (!resultsRoot) return;
    exerciseSearchRequestIds.set(resultsRoot, (exerciseSearchRequestIds.get(resultsRoot) || 0) + 1);
}

function normalizeWgerExercise(item) {
    if (!item || typeof item !== "object") return null;
    const base = item.exercise_base || item.exercise || {};
    const translations = Array.isArray(item.translations) ? item.translations : [];
    const english = translations.find(function (entry) { return Number(entry.language) === 2; });
    const name = String(item.name || (english && english.name) || base.name || "").trim();
    if (!name) return null;
    const description = String(item.description || (english && english.description) || base.description || "").trim();
    const label = function (value) { return value && typeof value === "object" ? String(value.name || value.id || "") : String(value || ""); };
    return {
        id: String(item.id || base.id || ""),
        name: name,
        description: description,
        category: label(item.category || base.category),
        equipment: (Array.isArray(item.equipment) ? item.equipment : []).map(label).filter(Boolean),
        muscles: (Array.isArray(item.muscles) ? item.muscles : []).map(label).filter(Boolean),
        provider: "wger"
    };
}

async function fetchWgerExercisePage(offset) {
    const url = WGER_EXERCISEINFO_URL + "?language=2&limit=" + WGER_EXERCISE_LIBRARY_PAGE_SIZE + "&offset=" + offset;
    const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "omit" });
    if (!response.ok) throw new Error("Exercise library returned HTTP " + response.status + ".");
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error("Exercise library returned an unexpected response.");
    const count = Number(data.count);
    const page = {
        items: data.results.map(normalizeWgerExercise).filter(Boolean),
        next: data.next || null
    };
    if (Number.isFinite(count) && count >= 0) exerciseLibraryTotalCount = count;
    if (!page.next) exerciseLibraryLastPageOffset = offset;
    return page;
}

function getExerciseLibraryPageCount() {
    if (exerciseLibraryTotalCount !== null) {
        return Math.max(1, Math.ceil(exerciseLibraryTotalCount / WGER_EXERCISE_LIBRARY_PAGE_SIZE));
    }
    if (exerciseLibraryLastPageOffset !== null) {
        return Math.floor(exerciseLibraryLastPageOffset / WGER_EXERCISE_LIBRARY_PAGE_SIZE) + 1;
    }
    return WGER_EXERCISE_LIBRARY_MAX_PAGES;
}

async function loadWgerExerciseLibrary() {
    if (exerciseLibraryCache) {
        return {
            items: exerciseLibraryCache,
            complete: true,
            searchedCount: exerciseLibraryCache.length,
            totalCount: exerciseLibraryTotalCount
        };
    }

    if (!exerciseLibraryPages.has(0)) exerciseLibraryPages.set(0, await fetchWgerExercisePage(0));

    const expectedPageCount = getExerciseLibraryPageCount();
    const pageLimit = Math.min(expectedPageCount, WGER_EXERCISE_LIBRARY_MAX_PAGES);
    let batchFailed = false;

    for (let firstPage = 1; firstPage < pageLimit; firstPage += WGER_EXERCISE_LIBRARY_BATCH_SIZE) {
        const offsets = [];
        for (let page = firstPage; page < Math.min(firstPage + WGER_EXERCISE_LIBRARY_BATCH_SIZE, pageLimit); page += 1) {
            const offset = page * WGER_EXERCISE_LIBRARY_PAGE_SIZE;
            if (!exerciseLibraryPages.has(offset)) offsets.push(offset);
        }
        if (!offsets.length) continue;

        const outcomes = await Promise.allSettled(offsets.map(fetchWgerExercisePage));
        outcomes.forEach(function (outcome, index) {
            if (outcome.status === "fulfilled") exerciseLibraryPages.set(offsets[index], outcome.value);
            else batchFailed = true;
        });
        if (batchFailed) break;
    }

    const pages = Array.from(exerciseLibraryPages.entries()).sort(function (a, b) { return a[0] - b[0]; });
    const items = pages.reduce(function (all, entry) { return all.concat(entry[1].items); }, []);
    const everyExpectedPageLoaded = expectedPageCount <= WGER_EXERCISE_LIBRARY_MAX_PAGES &&
        Array.from({ length: expectedPageCount }, function (_unused, index) {
            return exerciseLibraryPages.has(index * WGER_EXERCISE_LIBRARY_PAGE_SIZE);
        }).every(Boolean);
    const complete = everyExpectedPageLoaded && !batchFailed;

    if (complete) exerciseLibraryCache = items;
    return {
        items: items,
        complete: complete,
        searchedCount: items.length,
        totalCount: exerciseLibraryTotalCount
    };
}

async function searchWgerExerciseNames(term) {
    const url = WGER_EXERCISEINFO_URL + "?language=2&name__search=" + encodeURIComponent(term) + "&limit=20";
    const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "omit" });
    if (!response.ok) throw new Error("Exercise search returned HTTP " + response.status + ".");
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error("Exercise search returned an unexpected response.");
    return data.results.map(normalizeWgerExercise).filter(function (exercise) {
        return exercise && exercise.name.toLocaleLowerCase().includes(term);
    }).slice(0, 20);
}

function getExerciseLibraryMatches(libraryItems, term) {
    return libraryItems.filter(function (exercise) {
        return exercise.name.toLocaleLowerCase().includes(term) ||
            exercise.category.toLocaleLowerCase().includes(term) ||
            exercise.muscles.some(function (muscle) { return muscle.toLocaleLowerCase().includes(term); });
    }).slice(0, 12);
}

function renderExerciseMatches(matches, workoutIndex, resultsRoot) {
    matches.forEach(function (exercise) {
        const row = document.createElement("div");
        row.className = "integration-result";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = exercise.name;
        const details = document.createElement("small");
        details.textContent = [exercise.category, exercise.muscles.join(", ")].filter(Boolean).join(" · ");
        info.append(title, details);
        const add = document.createElement("button");
        add.type = "button";
        add.className = "secondary-btn";
        add.textContent = "Add";
        add.addEventListener("click", function () { addLibraryExerciseToWorkout(exercise, workoutIndex); });
        row.append(info, add);
        resultsRoot.appendChild(row);
    });
}

function appendExerciseRetry(resultsRoot, query, workoutIndex) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "secondary-btn";
    retry.textContent = "Retry search";
    retry.addEventListener("click", function () { return searchExerciseLibrary(query, workoutIndex, resultsRoot); });
    resultsRoot.appendChild(retry);
}

async function searchExerciseLibrary(query, workoutIndex, resultsRoot) {
    const term = String(query || "").trim().toLocaleLowerCase();
    if (!resultsRoot) return;
    invalidateExerciseSearch(resultsRoot);
    const requestId = exerciseSearchRequestIds.get(resultsRoot);
    resultsRoot.replaceChildren();
    if (term.length < 2) {
        resultsRoot.textContent = "Enter at least two letters to search.";
        return;
    }
    resultsRoot.textContent = "Searching public exercise library…";
    try {
        let serverMatches = [];
        try {
            serverMatches = await searchWgerExerciseNames(term);
        } catch (error) {
            if (exerciseSearchRequestIds.get(resultsRoot) !== requestId) return;
            // The local library below remains available when server-side search is unavailable.
        }
        if (exerciseSearchRequestIds.get(resultsRoot) !== requestId) return;

        if (serverMatches.length) {
            resultsRoot.replaceChildren();
            renderExerciseMatches(serverMatches, workoutIndex, resultsRoot);
            return;
        }

        const library = await loadWgerExerciseLibrary();
        if (exerciseSearchRequestIds.get(resultsRoot) !== requestId) return;
        const matches = getExerciseLibraryMatches(library.items, term);
        resultsRoot.replaceChildren();
        renderExerciseMatches(matches, workoutIndex, resultsRoot);
        if (!matches.length && library.complete) {
            resultsRoot.textContent = "No matches in the currently loaded public results. You can still add an exercise by name.";
            return;
        }
        if (!library.complete) {
            const note = document.createElement("small");
            const estimate = library.totalCount === null ? "an unknown number" : "~" + library.totalCount.toLocaleString();
            note.textContent = "Searched " + library.searchedCount.toLocaleString() + " of " + estimate + " exercises; some results may be missing.";
            resultsRoot.appendChild(note);
            appendExerciseRetry(resultsRoot, query, workoutIndex);
        }
    } catch (error) {
        if (exerciseSearchRequestIds.get(resultsRoot) !== requestId) return;
        resultsRoot.replaceChildren();
        const message = document.createElement("p");
        message.className = "integration-error-copy";
        const offline = (typeof navigator !== "undefined" && navigator.onLine === false) ||
            (error && (error instanceof TypeError || error.name === "TypeError"));
        let friendlyMessage = offline
            ? "Couldn't reach the exercise library. Check your connection."
            : (error && error.message) || "The exercise library returned an unexpected error.";
        if (!/[.!?]$/.test(friendlyMessage)) friendlyMessage += ".";
        message.textContent = friendlyMessage + " You can still add an exercise by name.";
        resultsRoot.append(message);
        appendExerciseRetry(resultsRoot, query, workoutIndex);
    }
}

function addLibraryExerciseToWorkout(exercise, workoutIndex) {
    const planner = getPlanner();
    const workout = planner.workouts[workoutIndex];
    if (!workout) return;
    if (!Array.isArray(workout.exercises)) workout.exercises = [];
    workout.exercises.push({
        name: exercise.name,
        sets: [],
        library: {
            provider: exercise.provider,
            id: exercise.id,
            description: exercise.description,
            category: exercise.category,
            muscles: exercise.muscles.slice(),
            equipment: exercise.equipment.slice()
        }
    });
    if (!savePlanner(planner)) return;
    updateWorkoutList();
}
