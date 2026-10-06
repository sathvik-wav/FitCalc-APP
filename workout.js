function formatWorkoutSet(set) {
    if (Number(set.durationMinutes) > 0) return Number(set.durationMinutes) + " min";
    const displayWeight = kilogramsToDisplayWeight(set.weight || 0);
    const weightText = Number.isInteger(displayWeight) ? String(displayWeight) : displayWeight.toFixed(1);
    return Number(set.reps) + "×" + weightText + getFitCalcWeightUnit();
}

function createWorkoutRecordId() {
    if (typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "workout-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function ensureWorkoutRecordIds(workouts, dateKey) {
    if (!Array.isArray(workouts)) return false;
    const reservedIds = new Set(workouts.filter(function (workout) {
        return workout && typeof workout === "object" && typeof workout.id === "string" && workout.id.trim();
    }).map(function (workout) { return workout.id; }));
    const usedIds = new Set();
    let changed = false;
    workouts.forEach(function (workout, index) {
        if (!workout || typeof workout !== "object") return;
        if (typeof workout.id === "string" && workout.id.trim() && !usedIds.has(workout.id)) {
            usedIds.add(workout.id);
            return;
        }

        const baseId = "legacy-" + String(dateKey || "unknown") + "-" + index;
        let replacementId = baseId;
        let suffix = 1;
        while (usedIds.has(replacementId) || reservedIds.has(replacementId)) {
            replacementId = baseId + "-" + suffix;
            suffix += 1;
        }
        workout.id = replacementId;
        usedIds.add(replacementId);
        changed = true;
    });
    return changed;
}

function hasWorkoutPerformance(workout) {
    return !!workout && Array.isArray(workout.exercises) && workout.exercises.some(function (exercise) {
        return !!exercise && Array.isArray(exercise.sets) && exercise.sets.some(function (set) {
            if (!set || typeof set !== "object") return false;
            return Number(set.reps) > 0 || Number(set.durationMinutes) > 0;
        });
    });
}

function getWorkoutTemplates() {
    return readJSON(WORKOUT_TEMPLATES_KEY, []);
}


function saveWorkoutTemplates(templates) {
    try {
        persistWorkoutTemplates(templates);
        return true;
    } catch (error) {
        return false;
    }
}


function createWorkoutTemplate(
    name,
    exercises = []
) {
    const validExercises = Array.isArray(exercises) ? exercises.filter(function (exercise) {
        return exercise && typeof exercise === "object";
    }) : [];
    const storedTemplates = getWorkoutTemplates();
    const templates = Array.isArray(storedTemplates) ? storedTemplates : [];

    const template = {
        name: name.trim(),

        exercises: validExercises.map(
            function (exercise) {

                return { name: exercise.name };
            }
        )
    };

    const existingIndex =
        templates.findIndex(
            function (item) {
                if (!item || typeof item.name !== "string") return false;
                const normalizeName = function (value) {
                    return value.trim().replace(/\s+/g, " ").toLowerCase();
                };
                return normalizeName(item.name) === normalizeName(template.name);
            }
        );

    if (existingIndex !== -1) {
        templates[existingIndex] =
            template;
    } else {
        templates.push(template);
    }

    if (!saveWorkoutTemplates(templates)) return null;

    return template;
}


function renderWorkoutTemplates() {
    const templateList =
        document.getElementById(
            "template-list"
        );

    if (!templateList) {
        return;
    }

    const storedTemplates = getWorkoutTemplates();
    const templates = Array.isArray(storedTemplates) ? storedTemplates : [];

    templateList.innerHTML = "";

    if (templates.length === 0) {
        templateList.innerHTML =
            '<p class="empty-state"><strong>No templates saved</strong><span>Save a workout to reuse its structure.</span></p>';

        return;
    }

    templates.forEach(
        function (template, index) {
            if (!template || typeof template !== "object") return;
            const exercises = Array.isArray(template.exercises) ? template.exercises : [];
            const templateName = String(template.name || "Workout");

            const templateItem =
                document.createElement("div");

            templateItem.className =
                "workout-template-item";

            templateItem.innerHTML = `
                <strong>
                    ${escapeHTML(templateName)}
                </strong>

                <span>
                    ${exercises.length}
                    ${
                        exercises.length === 1
                            ? "exercise"
                            : "exercises"
                    }
                </span>

                <div class="workout-template-actions">
                <button
                    type="button"
                    class="primary-btn load-template"
                    data-index="${index}">
                    Load
                </button>

                <button
                    type="button"
                    class="ghost-btn delete-template"
                    data-index="${index}"
                    aria-label="Delete ${escapeHTML(templateName)} template">
                    Remove
                </button>
                </div>
            `;

            templateList.appendChild(
                templateItem
            );
        }
    );


    /*
     * Load Template
     */

    templateList
        .querySelectorAll(".load-template")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const index =
                        Number(
                            button.dataset.index
                        );

                    const templates =
                        getWorkoutTemplates();

                    const template =
                        templates[index];

                    if (!template) {
                        return;
                    }

                    const exercises = Array.isArray(template.exercises) ? template.exercises : [];

                    const planner =
                        getPlanner();

                    planner.workouts.push({

                        id:
                            createWorkoutRecordId(),

                        name:
                            template.name || "Workout",

                        completed:
                            false,

                        exercises:
                            exercises.map(
                                function (exercise) {

                                    return { name: exercise.name, sets: [] };
                                }
                            )
                    });

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                    updateDailyProgress();
                }
            );
        });


    /*
     * Delete Template
     */

    templateList
        .querySelectorAll(".delete-template")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const index =
                        Number(
                            button.dataset.index
                        );

                    const templates =
                        getWorkoutTemplates();

                    const template =
                        templates[index];

                    if (!template) {
                        return;
                    }

                    if (!await window.fitcalcDialog.confirm(
                        `Delete the “${template.name || "Workout"}” workout template?`,
                        "Delete template",
                        "Delete"
                    )) {
                        return;
                    }

                    templates.splice(
                        index,
                        1
                    );

                    if (!saveWorkoutTemplates(
                        templates
                    )) return;

                    renderWorkoutTemplates();
                }
            );
        });
}


renderWorkoutTemplates();
