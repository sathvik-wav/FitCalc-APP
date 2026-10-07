/* The planner remains the owner of workout records; this file only presents and edits that schema. */
let activeWorkoutId = null;
let exerciseSheetWorkoutId = null;
let exerciseSheetReplaceIndex = null;

function currentWorkoutById(planner, id) {
    return (Array.isArray(planner.workouts) ? planner.workouts : []).find(function (workout) { return String(workout && workout.id) === String(id); }) || null;
}

function workoutSetCount(workout) {
    return (Array.isArray(workout && workout.exercises) ? workout.exercises : []).reduce(function (sum, exercise) {
        return sum + (Array.isArray(exercise && exercise.sets) ? exercise.sets.length : 0);
    }, 0);
}

function renderWorkoutList() {
    const planner = getPlanner();
    const root = document.getElementById("workout-list");
    const newButton = document.getElementById("new-workout");
    if (!root) return;
    const workouts = Array.isArray(planner.workouts) ? planner.workouts : [];
    if (migrateWorkoutSets(workouts)) savePlanner(planner);
    if (newButton) newButton.hidden = workouts.length === 0;
    root.replaceChildren();
    if (!workouts.length) {
        root.innerHTML = '<div class="workout-empty"><strong>No workouts planned</strong><span>Start a session or choose a saved template.</span><div><button type="button" class="primary-btn" id="start-empty-workout">Start empty workout</button><button type="button" class="ghost-btn" id="from-template">From template</button></div></div>';
        root.querySelector("#start-empty-workout").addEventListener("click", function () { createWorkoutRecord("Workout"); });
        root.querySelector("#from-template").addEventListener("click", function () {
            setPlannerView("templates");
            const firstStart = document.querySelector("#template-list .template-start");
            if (firstStart) firstStart.focus();
        });
        return;
    }
    workouts.forEach(function (workout) {
        if (!workout || typeof workout !== "object") return;
        const row = document.createElement("button");
        row.type = "button";
        row.className = "workout-list-row";
        row.dataset.workoutId = String(workout.id);
        const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
        const status = workout.completed ? "Done" : "Planned";
        row.innerHTML = '<span class="workout-list-copy"><strong>' + escapeHTML(workout.name || "Workout") + '</strong><small>' + exercises.length + ' exercises · ' + workoutSetCount(workout) + ' sets</small></span><span class="workout-status' + (workout.completed ? ' is-done' : '') + '">' + status + '</span><span class="workout-row-chevron" aria-hidden="true">›</span>';
        row.addEventListener("click", function () { openWorkoutSession(workout.id); });
        root.appendChild(row);
    });
}

function createWorkoutRecord(name, exercises) {
    const planner = getPlanner();
    const workout = { id: createWorkoutRecordId(), name: String(name || "Workout").trim() || "Workout", completed: false, exercises: Array.isArray(exercises) ? exercises.map(function (exercise) { return { name: String(exercise.name || "Exercise"), sets: [] }; }) : [] };
    planner.workouts.push(workout);
    if (!savePlanner(planner)) return;
    updateDailyProgress();
    renderWorkoutList();
    openWorkoutSession(workout.id);
}

function findLastExercisePerformance(exerciseName) {
    const allByDate = readJSON(PLANNER_KEY, {});
    const selectedKey = getDateKey(selectedDate);
    const earlier = Object.keys(allByDate || {}).filter(function (key) { return /^\d{4}-\d{2}-\d{2}$/.test(key) && key < selectedKey; }).sort().reverse();
    for (let d = 0; d < earlier.length; d += 1) {
        const workouts = Array.isArray(allByDate[earlier[d]] && allByDate[earlier[d]].workouts) ? allByDate[earlier[d]].workouts : [];
        for (let w = workouts.length - 1; w >= 0; w -= 1) {
            const exercises = Array.isArray(workouts[w] && workouts[w].exercises) ? workouts[w].exercises : [];
            for (let e = exercises.length - 1; e >= 0; e -= 1) {
                if (String(exercises[e] && exercises[e].name || "").toLowerCase() !== String(exerciseName).toLowerCase()) continue;
                const sets = Array.isArray(exercises[e].sets) ? exercises[e].sets : [];
                const set = sets.slice().reverse().find(function (item) { return item && (Number(item.reps) > 0 || Number(item.durationMinutes) > 0); });
                if (set) return set;
            }
        }
    }
    return null;
}

function renderWorkoutSession() {
    const root = document.getElementById("workout-session");
    if (!root || !activeWorkoutId) return;
    const planner = getPlanner();
    const workout = currentWorkoutById(planner, activeWorkoutId);
    if (!workout) { closeWorkoutSession(); return; }
    const unit = getMacroBayWeightUnit();
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    const title = escapeHTML(workout.name || "Workout");
    const sections = exercises.map(function (exercise, exerciseIndex) {
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        const last = findLastExercisePerformance(exercise.name);
        const previousText = last ? (Number(last.reps) > 0 ? String(last.reps) + " reps" : Number(last.durationMinutes) + " min") + (Number(last.weight) > 0 ? " · " + formatMacroBayWeight(last.weight) + " " + unit : "") : "—";
        const rows = sets.map(function (set, setIndex) {
            const w = Number(set && set.weight) > 0 ? kilogramsToDisplayWeight(Number(set.weight)) : "";
            const reps = Number(set && set.reps) > 0 ? Number(set.reps) : "";
            const weightPlaceholder = last && Number(last.weight) > 0 ? String(kilogramsToDisplayWeight(last.weight)) : "";
            const repsPlaceholder = last && Number(last.reps) > 0 ? String(last.reps) : "";
            return '<div class="workout-set-row" data-exercise="' + exerciseIndex + '" data-set="' + setIndex + '"><span class="set-number">' + (setIndex + 1) + '</span><span class="set-previous">' + escapeHTML(previousText) + '</span><input class="set-weight-input" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Set ' + (setIndex + 1) + ' weight in ' + unit + '" placeholder="' + escapeHTML(weightPlaceholder) + '" value="' + (w === "" ? "" : w) + '"><input class="set-reps-input" type="number" min="0" step="1" inputmode="numeric" aria-label="Set ' + (setIndex + 1) + ' reps" placeholder="' + escapeHTML(repsPlaceholder) + '" value="' + reps + '"><input class="set-done-input" type="checkbox" aria-label="Mark set ' + (setIndex + 1) + ' done"' + (set && set.done ? ' checked' : '') + '></div>';
        }).join("");
        return '<section class="workout-exercise-section" data-exercise-index="' + exerciseIndex + '"><header><h3>' + escapeHTML(exercise.name || "Exercise") + '</h3><details class="workout-menu"><summary aria-label="Exercise actions">…</summary><div><button type="button" class="replace-exercise" data-exercise="' + exerciseIndex + '">Replace</button><button type="button" class="remove-last-set" data-exercise="' + exerciseIndex + '"' + (sets.length ? '' : ' disabled') + '>Remove last set</button><button type="button" class="remove-exercise" data-exercise="' + exerciseIndex + '">Remove</button></div></details></header><div class="workout-set-table"><div class="workout-set-heading"><span>SET</span><span>PREVIOUS</span><span>' + unit.toUpperCase() + '</span><span>REPS</span><span></span></div>' + rows + '</div><button type="button" class="text-button add-session-set" data-exercise="' + exerciseIndex + '">+ Add set</button></section>';
    }).join("");
    const volume = exercises.reduce(function (total, exercise) { return total + (Array.isArray(exercise.sets) ? exercise.sets : []).reduce(function (sum, set) { return sum + (Number(set && set.reps) || 0) * (Number(set && set.weight) || 0); }, 0); }, 0);
    root.hidden = false;
    const setCount = workoutSetCount(workout);
    root.innerHTML = '<header class="workout-session-header"><button type="button" class="text-button session-back" aria-label="Back to workouts">←</button><button type="button" class="session-title" id="session-rename">' + title + '</button><details class="workout-menu session-menu"><summary aria-label="Workout actions">…</summary><div><button type="button" id="save-session-template">Save as template</button><button type="button" id="duplicate-session">Duplicate</button><button type="button" id="delete-session">Delete</button></div></details></header><div class="workout-session-body"><div class="workout-session-summary">' + (workout.completed ? '<strong>Workout complete</strong><span>' + setCount + (setCount === 1 ? ' set' : ' sets') + ' · ' + Math.round(volume).toLocaleString() + ' kg total volume</span><button type="button" class="text-button" id="undo-finish">Undo</button>' : '<span>Log each set as you go. Previous numbers are hints only.</span>') + '</div><div class="workout-exercise-list">' + (sections || '<p class="session-empty-copy">Add an exercise to begin.</p>') + '</div><button type="button" class="text-button add-session-exercise">+ Add exercise</button></div><footer class="workout-session-footer">' + (workout.completed ? '<span>Finished</span>' : '<span></span><button type="button" class="primary-btn" id="finish-workout">Finish workout</button>') + '</footer>';
    root.querySelector(".session-back").addEventListener("click", closeWorkoutSession);
    root.querySelector("#session-rename").addEventListener("click", async function () {
        const name = await window.macrobayDialog.prompt({ title: "Rename workout", message: "Choose a name for this workout.", label: "Workout name", value: workout.name || "Workout", required: true });
        if (name === null || !name.trim()) return;
        workout.name = name.trim().slice(0, 80);
        if (savePlanner(planner)) { renderWorkoutSession(); renderWorkoutList(); }
    });
    root.querySelector(".add-session-exercise").addEventListener("click", function () { openExerciseSearch(workout.id, null); });
    root.querySelectorAll(".add-session-set").forEach(function (button) { button.addEventListener("click", function () { const ex = workout.exercises[Number(button.dataset.exercise)]; ex.sets.push({}); if (savePlanner(planner)) renderWorkoutSession(); }); });
    root.querySelectorAll(".workout-set-row").forEach(function (row) {
        const ex = workout.exercises[Number(row.dataset.exercise)];
        const set = ex.sets[Number(row.dataset.set)];
        row.querySelector(".set-weight-input").addEventListener("input", function (event) {
            const value = String(event.target.value).trim();
            if (!value) delete set.weight;
            else { const n = Number(value); if (Number.isFinite(n) && n >= 0) set.weight = unit === "lb" ? n / 2.20462262185 : n; }
            savePlanner(planner);
        });
        row.querySelector(".set-reps-input").addEventListener("input", function (event) {
            const value = String(event.target.value).trim();
            if (!value) delete set.reps;
            else { const n = Number(value); if (Number.isFinite(n) && n > 0) set.reps = n; }
            savePlanner(planner);
        });
        row.querySelector(".set-done-input").addEventListener("change", function (event) { set.done = event.target.checked; savePlanner(planner); });
    });
    root.querySelectorAll(".remove-exercise").forEach(function (button) { button.addEventListener("click", async function () {
        if (!await window.macrobayDialog.confirm("Remove this exercise and its sets?", "Remove exercise", "Remove")) return;
        workout.exercises.splice(Number(button.dataset.exercise), 1);
        if (savePlanner(planner)) { renderWorkoutSession(); renderWorkoutList(); }
    }); });
    root.querySelectorAll(".remove-last-set:not([disabled])").forEach(function (button) { button.addEventListener("click", async function () {
        if (!await window.macrobayDialog.confirm("Remove the last set from this exercise?", "Remove set", "Remove")) return;
        workout.exercises[Number(button.dataset.exercise)].sets.pop();
        if (savePlanner(planner)) renderWorkoutSession();
    }); });
    root.querySelectorAll(".replace-exercise").forEach(function (button) { button.addEventListener("click", function () { openExerciseSearch(workout.id, Number(button.dataset.exercise)); }); });
    const finish = root.querySelector("#finish-workout");
    if (finish) finish.addEventListener("click", finishWorkoutSession);
    const undo = root.querySelector("#undo-finish");
    if (undo) undo.addEventListener("click", function () { workout.completed = false; delete workout.completedAt; if (savePlanner(planner)) { updateDailyProgress(); renderWorkoutSession(); renderWorkoutList(); } });
    root.querySelector("#save-session-template").addEventListener("click", function () { saveSessionAsTemplate(workout); });
    root.querySelector("#duplicate-session").addEventListener("click", function () { createWorkoutRecord((workout.name || "Workout") + " copy", workout.exercises); });
    root.querySelector("#delete-session").addEventListener("click", async function () {
        if (!await window.macrobayDialog.confirm("Delete this workout and its logged sets from this day?", "Delete workout", "Delete")) return;
        planner.workouts.splice(planner.workouts.indexOf(workout), 1);
        if (savePlanner(planner)) { activeWorkoutId = null; root.hidden = true; updateDailyProgress(); renderWorkoutList(); }
    });
}

function openWorkoutSession(id) { activeWorkoutId = String(id); document.body.classList.add("workout-session-open"); renderWorkoutSession(); }
function closeWorkoutSession() { activeWorkoutId = null; const root = document.getElementById("workout-session"); if (root) root.hidden = true; document.body.classList.remove("workout-session-open"); renderWorkoutList(); }

function finishWorkoutSession() {
    const planner = getPlanner();
    const workout = currentWorkoutById(planner, activeWorkoutId);
    if (!workout) return;
    workout.completed = true;
    workout.completedAt = new Date().toISOString();
    if (!savePlanner(planner)) return;
    updateDailyProgress();
    renderWorkoutSession();
    renderWorkoutList();
}

function saveSessionAsTemplate(workout) {
    const name = String(workout.name || "Workout").trim() || "Workout";
    const templatesValue = getWorkoutTemplates();
    const templates = Array.isArray(templatesValue) ? templatesValue : [];
    const existing = templates.find(function (item) { return String(item && item.name || "").trim().toLowerCase() === name.toLowerCase(); });
    if (existing) {
        window.macrobayDialog.confirm("A template with this name already exists. Overwrite it?", "Overwrite template", "Overwrite").then(function (yes) {
            if (!yes) return;
            createWorkoutTemplate(name, workout.exercises);
            renderWorkoutTemplates();
        });
        return;
    }
    if (createWorkoutTemplate(name, workout.exercises)) renderWorkoutTemplates();
}

function openExerciseSearch(workoutId, replaceIndex) {
    exerciseSheetWorkoutId = String(workoutId);
    exerciseSheetReplaceIndex = replaceIndex === null ? null : Number(replaceIndex);
    const sheet = document.getElementById("exercise-search-sheet");
    sheet.hidden = false;
    sheet.innerHTML = '<header><h2>' + (exerciseSheetReplaceIndex === null ? 'Add exercise' : 'Replace exercise') + '</h2><button type="button" class="text-button" id="close-exercise-sheet">Close</button></header><label for="exercise-search-input">Exercise</label><input type="search" id="exercise-search-input" placeholder="Search exercise library"><div id="exercise-search-results" aria-live="polite"></div>';
    sheet.querySelector("#close-exercise-sheet").addEventListener("click", closeExerciseSearch);
    const input = sheet.querySelector("#exercise-search-input");
    input.addEventListener("input", function () { renderExerciseSearchChoices(input.value); });
    renderExerciseSearchChoices("");
    input.focus();
}

function closeExerciseSearch() { const sheet = document.getElementById("exercise-search-sheet"); if (sheet) sheet.hidden = true; exerciseSheetWorkoutId = null; exerciseSheetReplaceIndex = null; }

function renderExerciseSearchChoices(query) {
    const root = document.getElementById("exercise-search-results");
    if (!root) return;
    root.replaceChildren();
    const term = String(query || "").trim();
    if (term) {
        const custom = document.createElement("button");
        custom.type = "button";
        custom.className = "custom-exercise-choice";
        custom.textContent = 'Add “' + term + '” as custom';
        custom.addEventListener("click", function () { chooseExercise({ name: term, provider: "custom" }); });
        root.appendChild(custom);
    }
    if (!term) {
        const recent = [];
        const planner = getPlanner();
        (planner.workouts || []).forEach(function (workout) { (workout.exercises || []).forEach(function (exercise) { const name = String(exercise.name || ""); if (name && !recent.some(function (item) { return item.name.toLowerCase() === name.toLowerCase(); })) recent.push({ name: name, provider: "recent" }); }); });
        if (recent.length) {
            const heading = document.createElement("small"); heading.className = "exercise-sheet-label"; heading.textContent = "Recent exercises"; root.appendChild(heading);
            recent.slice(-6).reverse().forEach(function (item) { const button = document.createElement("button"); button.type = "button"; button.className = "exercise-choice-row"; button.textContent = item.name; button.addEventListener("click", function () { chooseExercise(item); }); root.appendChild(button); });
        }
        return;
    }
    if (term.length < 2) return;
    const results = document.createElement("div"); results.className = "exercise-library-results"; root.appendChild(results);
    searchExerciseLibrary(term, 0, results);
}

function chooseExercise(exercise) {
    const planner = getPlanner();
    const workout = currentWorkoutById(planner, exerciseSheetWorkoutId);
    if (!workout) return closeExerciseSearch();
    const record = { name: String(exercise.name || "Exercise"), sets: [] };
    if (exercise.provider && exercise.provider !== "custom" && exercise.provider !== "recent") record.library = { provider: exercise.provider, id: exercise.id, category: exercise.category, muscles: exercise.muscles || [], equipment: exercise.equipment || [] };
    if (exerciseSheetReplaceIndex === null) workout.exercises.push(record);
    else workout.exercises[exerciseSheetReplaceIndex] = record;
    if (savePlanner(planner)) { closeExerciseSearch(); renderWorkoutSession(); renderWorkoutList(); }
}

function addLibraryExerciseToWorkout(exercise) { chooseExercise(exercise); }

function renderWorkoutTemplates() {
    const root = document.getElementById("template-list");
    if (!root) return;
    const templatesValue = getWorkoutTemplates();
    const templates = Array.isArray(templatesValue) ? templatesValue : [];
    root.replaceChildren();
    if (!templates.length) { root.innerHTML = '<div class="workout-empty"><strong>No templates saved</strong><span>Save a workout from its session menu.</span></div>'; return; }
    templates.forEach(function (template, index) {
        const row = document.createElement("div"); row.className = "template-list-row";
        const info = document.createElement("span"); info.className = "workout-list-copy"; info.innerHTML = '<strong>' + escapeHTML(template.name || "Workout") + '</strong><small>' + (Array.isArray(template.exercises) ? template.exercises.length : 0) + ' exercises</small>';
        const start = document.createElement("button"); start.type = "button"; start.className = "ghost-btn template-start"; start.textContent = "Start"; start.addEventListener("click", function () { createWorkoutRecord(template.name || "Workout", template.exercises); setPlannerView("workouts"); });
        const menu = document.createElement("details"); menu.className = "workout-menu"; menu.innerHTML = '<summary aria-label="Template actions">…</summary><div><button type="button" class="rename-template">Rename</button><button type="button" class="delete-template">Delete</button></div>';
        menu.querySelector(".rename-template").addEventListener("click", async function () { const name = await window.macrobayDialog.prompt({ title: "Rename template", message: "Choose a template name.", label: "Template name", value: template.name || "Workout", required: true }); if (!name || !name.trim()) return; template.name = name.trim().slice(0, 80); if (saveWorkoutTemplates(templates)) renderWorkoutTemplates(); });
        menu.querySelector(".delete-template").addEventListener("click", async function () { if (!await window.macrobayDialog.confirm('Delete the “' + (template.name || "Workout") + '” template?', "Delete template", "Delete")) return; templates.splice(index, 1); if (saveWorkoutTemplates(templates)) renderWorkoutTemplates(); });
        row.append(info, start, menu); root.appendChild(row);
    });
}

const newWorkoutButton = document.getElementById("new-workout");
if (newWorkoutButton) newWorkoutButton.addEventListener("click", function () { createWorkoutRecord("Workout"); });

/* Override the previous expandable-card renderer with the focused list and session views. */
updateWorkoutList = renderWorkoutList;
updateWorkoutList();
renderWorkoutTemplates();
