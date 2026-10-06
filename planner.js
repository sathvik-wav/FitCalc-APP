function getInitialPlannerDate() {
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

let selectedDate = getInitialPlannerDate();
let currentPlannerTodayKey = getDateKey(new Date());

const collapsedWorkouts = {};
let renderedPlannerDateKey = getDateKey(selectedDate);


/*
 * DATE
 */



function updateSelectedDay() {
    const today = new Date();

    const selectedKey = getDateKey(selectedDate);
    const todayKey = getDateKey(today);

    let label;

    if (selectedKey === todayKey) {
        label = "Today";
    } else {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (selectedKey === getDateKey(yesterday)) {
            label = "Yesterday";
        } else if (selectedKey === getDateKey(tomorrow)) {
            label = "Tomorrow";
        } else {
            label = selectedDate.toLocaleDateString("en-US", {
                weekday: "long"
            });
        }
    }

    document.getElementById(
        "selected-day-label"
    ).textContent = label;

    document.getElementById(
        "selected-date"
    ).textContent = selectedDate.toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );

    const nextButton = document.getElementById("next-day");
    if (nextButton) nextButton.disabled = selectedKey >= todayKey;
    const todayButton = document.getElementById("today-day");
    if (todayButton) todayButton.disabled = selectedKey === todayKey;
}

function refreshPlannerTodayIfNeeded() {
    const now = new Date();
    const todayKey = getDateKey(now);
    if (todayKey === currentPlannerTodayKey) return false;

    const previousTodayKey = currentPlannerTodayKey;
    currentPlannerTodayKey = todayKey;

    if (getDateKey(selectedDate) === previousTodayKey) {
        selectedDate = now;
        refreshPlannerDay();
    } else {
        updateSelectedDay();
    }

    return true;
}


/*
 * STORAGE
 */

function savePlanner(planner) {
    try {
        savePlannerFor(planner.date, planner);
        return true;
    } catch (error) {
        return false;
    }
}


function getPlanner() {
    refreshPlannerTodayIfNeeded();
    const dateKey = getDateKey(selectedDate);
    const planner = getPlannerFor(dateKey);
    if (!Array.isArray(planner.workouts)) planner.workouts = [];
    if (!Array.isArray(planner.tasks)) planner.tasks = [];
    if (typeof ensureWorkoutRecordIds === "function") ensureWorkoutRecordIds(planner.workouts, dateKey);
    return planner;
}

/*
 * STEPS
 */

function saveSteps() {
    const planner = getPlanner();
    const input = document.getElementById("steps-input");
    const rawSteps = input && String(input.value).trim();
    const steps = Number(rawSteps);

    const currentSteps = Number(planner.steps) || 0;
    if (
        !rawSteps ||
        !Number.isInteger(steps) ||
        steps <= 0 ||
        steps > 100000 ||
        currentSteps + steps > 200000
    ) {
        window.fitcalcToast("Enter a whole step count from 1 to 100,000; the day's total cannot exceed 200,000.", "error");
        return;
    }

    planner.steps = currentSteps + steps;

    if (!savePlanner(planner)) return;

    updateStepsDisplay();
    window.fitcalcToast("Steps updated for this day.");

    document.getElementById(
        "steps-input"
    ).value = "";
}


function updateStepsDisplay() {
    const planner = getPlanner();

    const stepsElement =
        document.getElementById(
            "planner-steps"
        );
    const stepsGoalText = Number(STEPS_GOAL).toLocaleString();
    const stepsGoalElement = document.getElementById("planner-steps-goal");
    const stepsGoalCopy = document.getElementById("planner-steps-goal-copy");
    if (stepsGoalElement) stepsGoalElement.textContent = stepsGoalText;
    if (stepsGoalCopy) stepsGoalCopy.textContent = stepsGoalText;

    if (stepsElement) {
        stepsElement.textContent =
            planner.steps;
    }

    const progressElement =
        document.getElementById(
            "steps-progress"
        );

    if (progressElement) {
        progressElement.style.width =
            Math.min(
                (planner.steps / STEPS_GOAL) * 100,
                100
            ) + "%";
        const meter = progressElement.closest('[role="progressbar"]');
        if (meter) meter.setAttribute("aria-valuenow", String(Math.min(Math.round((planner.steps / STEPS_GOAL) * 100), 100)));
    }
}

function updateWeightDisplay() {
    const planner = getPlanner();
    const value = document.getElementById("planner-weight-value");
    const detailValue = document.getElementById("planner-weight-value-display");
    const date = document.getElementById("planner-weight-date");
    const input = document.getElementById("planner-weight-input");
    const unit = getFitCalcWeightUnit();
    const unitLabel = document.getElementById("planner-weight-unit");
    const inputLabel = document.getElementById("planner-weight-input-label");
    if (value) value.textContent = planner.weight === null || planner.weight === undefined ? "—" : formatFitCalcWeight(planner.weight);
    if (detailValue) detailValue.textContent = planner.weight === null || planner.weight === undefined ? "—" : formatFitCalcWeight(planner.weight);
    if (unitLabel) unitLabel.textContent = unit;
    if (inputLabel) inputLabel.textContent = "Weight in " + unit;
    if (date) date.textContent = selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (input) {
        input.value = planner.weight === null || planner.weight === undefined ? "" : kilogramsToDisplayWeight(planner.weight).toFixed(1);
        input.min = unit === "lb" ? "66.1" : "30";
        input.max = unit === "lb" ? "661.4" : "300";
    }
}

function saveWeight() {
    const input = document.getElementById("planner-weight-input");
    const displayWeight = Number(input && input.value);
    const unit = getFitCalcWeightUnit();
    const minimumWeight = unit === "lb" ? 66.1 : 30;
    const maximumWeight = unit === "lb" ? 661.4 : 300;
    const weight = displayWeightToKilograms(displayWeight);
    if (!Number.isFinite(displayWeight) || displayWeight < minimumWeight || displayWeight > maximumWeight) {
        window.fitcalcToast(unit === "lb" ? "Enter a weight from 66.1 to 661.4 lb." : "Enter a weight from 30 to 300 kg.", "error");
        return;
    }
    const planner = getPlanner();
    planner.weight = weight;
    if (!savePlanner(planner)) return;

    let profileTargetsSaved = true;
    if (getDateKey(selectedDate) === getDateKey(new Date())) {
        let profileUpdated = false;
        try {
            updateProfile({ weight: weight });
            profileUpdated = true;
            if (typeof refreshTargets === "function" && refreshTargets() === false &&
                typeof isCompleteTargetProfile === "function" && isCompleteTargetProfile(getProfile())) {
                profileTargetsSaved = false;
            }
        } catch (error) {
            profileTargetsSaved = false;
        }
        if (profileUpdated && typeof announceDataChange === "function") {
            announceDataChange(getDateKey(selectedDate), PROFILE_KEY);
        }
    }

    updateWeightDisplay();
    if (!profileTargetsSaved) {
        window.fitcalcToast("Weight was logged, but profile targets could not be updated.", "error");
        return;
    }
    window.fitcalcToast("Weight check-in saved.");
}

const saveWeightButton = document.getElementById("save-weight");
if (saveWeightButton) saveWeightButton.addEventListener("click", saveWeight);


const saveStepsButton =
    document.getElementById(
        "save-steps"
    );

if (saveStepsButton) {
    saveStepsButton.addEventListener(
        "click",
        saveSteps
    );
}


const resetStepsButton =
    document.getElementById(
        "reset-steps"
    );

if (resetStepsButton) {
    resetStepsButton.addEventListener(
        "click",
        function () {

            const planner = getPlanner();

            planner.steps = 0;

            if (!savePlanner(planner)) return;

            updateStepsDisplay();
            updateWeightDisplay();
            window.fitcalcToast("Step count reset.");
        }
    );
}


/*
 * WORKOUTS
 */

function createWorkout() {
    const input =
        document.getElementById(
            "workout-name"
        );

    const workoutName =
        input.value.trim();

    if (!workoutName) {
        window.fitcalcToast("Enter a workout name first.", "error");
        return;
    }

    const planner = getPlanner();

    planner.workouts.push({
        id: createWorkoutRecordId(),
        name: workoutName,
        completed: false,
        exercises: []
    });

    if (!savePlanner(planner)) return;

    input.value = "";

    updateWorkoutList();
    updateDailyProgress();
    window.fitcalcToast("Workout added to this day.");
}


function updateWorkoutList() {
    const planner = getPlanner();

    const workoutList =
        document.getElementById(
            "workout-list"
        );

    workoutList.innerHTML = "";

    const workouts = Array.isArray(planner.workouts) ? planner.workouts : [];
    ensureWorkoutRecordIds(workouts, getDateKey(selectedDate));

    if (workouts.length === 0) {
            workoutList.innerHTML =
            '<p><strong>No workouts planned</strong><span>Add a workout above to start logging.</span></p>';

        return;
    }

    workouts.forEach(
        function (workout, workoutIndex) {
            if (!workout || typeof workout !== "object") return;
            const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
            const isCollapsed = isWorkoutCollapsed(workout.id);

            const workoutSection =
                document.createElement("div");

            workoutSection.className =
                "workout-section";

            workoutSection.innerHTML = `
                <div class="workout-header">

                    <button
                        type="button"
                        class="workout-toggle"
                        data-index="${workoutIndex}"
                        aria-expanded="${!isCollapsed}"
                        aria-controls="workout-content-${workoutIndex}"
                    >
                        <span>
                            ${escapeHTML(workout.name)}
                        </span>

                        <span class="workout-toggle-icon">
                            ${
                                isCollapsed
                                    ? "›"
                                    : "⌄"
                            }
                        </span>
                    </button>

                    <button
                        type="button"
                        class="delete-workout"
                        data-index="${workoutIndex}"
                        aria-label="Delete ${escapeHTML(workout.name)}"
                    >
                        Delete
                    </button>

                </div>

                <div
                    class="workout-content"
                    id="workout-content-${workoutIndex}"
                    style="${
                        isCollapsed
                            ? "display:none;"
                            : ""
                    }"
                >

                    <div class="exercise-list">

                        ${
                            exercises.length > 0

                                ? exercises
                                    .map(
                                        function (
                                            exercise,
                                            exerciseIndex
                                        ) {

                                            if (!exercise || typeof exercise !== "object") return "";

                                            const sets = Array.isArray(exercise.sets) ? exercise.sets : [];

                                            return `
                                                <div class="exercise-item">

                                                    <h4>
                                                        ${escapeHTML(exercise.name)}
                                                    </h4>

                                                    ${
                                                        sets.length > 0

                                                            ? `
                                                                <div class="sets-inline">

                                                                    ${
                                                                        sets
                                                                            .map(
                                                                                function (
                                                                                    set,
                                                                                    setIndex
                                                                                ) {

                                                                                    if (!set || typeof set !== "object") return "";

                                                                                    return `
                                                                                        <span class="set-chip">

                                                                                            ${setIndex + 1})
                                                                                            ${formatWorkoutSet(set)}

                                                    <button
                                                        type="button"
                                                        class="remove-set"
                                                        data-workout="${workoutIndex}"
                                                        data-exercise="${exerciseIndex}"
                                                        data-set="${setIndex}"
                                                        aria-label="Remove set ${setIndex + 1}"
                                                                                            >
                                                                                                ✕
                                                                                            </button>

                                                                                        </span>
                                                                                    `;
                                                                                }
                                                                            )
                                                                            .join("")
                                                                    }

                                                                </div>
                                                            `

                                                            : `
                                                                <p>
                                                                    No sets yet.
                                                                </p>
                                                            `
                                                    }

                                                    <button
                                                        type="button"
                                                        class="primary-btn add-set"
                                                        data-workout="${workoutIndex}"
                                                        data-exercise="${exerciseIndex}"
                                                    >
                                                        Add Set
                                                    </button>

                                                    <button
                                                        type="button"
                                                        class="secondary-btn remove-exercise"
                                                        data-workout="${workoutIndex}"
                                                        data-exercise="${exerciseIndex}"
                                                    >
                                                        Remove
                                                    </button>

                                                </div>
                                            `;
                                        }
                                    )
                                    .join("")

                                : `
                                    <p>
                                        No exercises yet.
                                    </p>
                                `
                        }

                    </div>


                    <div class="add-exercise-form">

                        <div class="field">
                            <label for="exercise-name-${workoutIndex}">Exercise</label>

                            <input
                                type="text"
                                class="exercise-name-input"
                                id="exercise-name-${workoutIndex}"
                                placeholder="e.g. Bench Press"
                            >

                        </div>

                        <div class="exercise-library-tools">
                            <div class="inline-input-action">
                                <input type="search" class="exercise-library-query" data-index="${workoutIndex}" placeholder="Search exercise library" aria-label="Search exercise library">
                                <button type="button" class="secondary-btn search-exercise-library" data-index="${workoutIndex}">Search library</button>
                            </div>
                            <div class="exercise-library-results" aria-live="polite"></div>
                        </div>


                        <button
                            type="button"
                            class="primary-btn add-exercise"
                            data-index="${workoutIndex}"
                        >
                            Add
                        </button>


                        <button
                            type="button"
                            class="primary-btn complete-workout${workout.completed ? " is-complete" : ""}"
                            data-index="${workoutIndex}"
                        >
                            ${
                                workout.completed
                                    ? "Undo completion"
                                    : "Complete"
                            }
                        </button>


                        <button
                            type="button"
                            class="secondary-btn save-template"
                            data-index="${workoutIndex}"
                        >
                            Save
                        </button>

                    </div>

                </div>
            `;

            workoutList.appendChild(
                workoutSection
            );
        }
    );


    /*
     * COLLAPSE WORKOUT
     */

    workoutList
        .querySelectorAll(".workout-toggle")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const workoutIndex =
                        Number(
                            button.dataset.index
                        );

                    const planner = getPlanner();
                    const workout = planner.workouts[workoutIndex];
                    if (!workout) return;
                    toggleWorkoutCollapsed(workout.id);

                    updateWorkoutList();
                }
            );
        });


    /*
     * ADD EXERCISE
     */

    workoutList
        .querySelectorAll(".add-exercise")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const workoutIndex =
                        Number(
                            button.dataset.index
                        );

                    const form =
                        button.closest(
                            ".add-exercise-form"
                        );

                    const input =
                        form.querySelector(
                            ".exercise-name-input"
                        );

                    const exerciseName =
                        input.value.trim();

                    if (!exerciseName) {
                        window.fitcalcToast("Enter an exercise name first.", "error");

                        return;
                    }

                    const planner =
                        getPlanner();

                    planner
                        .workouts[workoutIndex]
                        .exercises
                        .push({
                            name: exerciseName,
                            sets: []
                        });

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                    window.fitcalcToast("Exercise added.");
                }
            );
        });

    workoutList.querySelectorAll(".search-exercise-library").forEach(function (button) {
        button.addEventListener("click", function () {
            const form = button.closest(".add-exercise-form");
            const query = form.querySelector(".exercise-library-query").value;
            const results = form.querySelector(".exercise-library-results");
            if (typeof searchExerciseLibrary === "function") {
                searchExerciseLibrary(query, Number(button.dataset.index), results);
            } else {
                results.textContent = "Exercise lookup is unavailable. You can still add exercises by name.";
            }
        });
    });

    workoutList.querySelectorAll(".exercise-library-query").forEach(function (input) {
        let debounceTimer = null;
        input.addEventListener("input", function () {
            if (debounceTimer !== null) window.clearTimeout(debounceTimer);
            const query = String(input.value || "").trim();
            const form = input.closest(".add-exercise-form");
            const results = form && form.querySelector(".exercise-library-results");
            if (!results) return;
            if (query.length < 2) {
                if (typeof invalidateExerciseSearch === "function") invalidateExerciseSearch(results);
                results.replaceChildren();
                results.textContent = "Enter at least two letters to search.";
                return;
            }
            debounceTimer = window.setTimeout(function () {
                if (typeof searchExerciseLibrary === "function") {
                    searchExerciseLibrary(query, Number(input.dataset.index), results);
                }
            }, 250);
        });
    });


    /*
     * ADD SET
     */

    workoutList
        .querySelectorAll(".add-set")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const workoutIndex =
                        Number(
                            button.dataset.workout
                        );

                    const exerciseIndex =
                        Number(
                            button.dataset.exercise
                        );

                    const repsText = await window.fitcalcDialog.prompt({
                        title: "Log actual performance",
                        message: "Enter the reps you completed. Leave it blank to log an activity by duration.",
                        label: "Reps completed",
                        inputMode: "decimal"
                    });
                    if (repsText === null) return;
                    let actualSet;
                    if (repsText.trim() !== "") {
                        const reps = Number(repsText);
                        if (!Number.isFinite(reps) || reps <= 0) { window.fitcalcToast("Enter a positive rep count.", "error"); return; }
                        const weightText = await window.fitcalcDialog.prompt({
                            title: "Log the load",
                            message: "Record the weight used for this set. Enter 0 for bodyweight.",
                            label: "Weight in " + getFitCalcWeightUnit(),
                            type: "number",
                            required: true
                        });
                        if (weightText === null) return;
                        const enteredWeight = Number(weightText);
                        if (!Number.isFinite(enteredWeight) || enteredWeight < 0) { window.fitcalcToast("Enter a valid weight.", "error"); return; }
                        const weight = getFitCalcWeightUnit() === "lb" ? enteredWeight / 2.20462262185 : enteredWeight;
                        actualSet = { reps: reps, weight: weight };
                    } else {
                        const durationText = await window.fitcalcDialog.prompt({
                            title: "Log activity duration",
                            message: "Enter how long you actually performed this exercise.",
                            label: "Duration in minutes",
                            type: "number",
                            required: true
                        });
                        if (durationText === null) return;
                        const durationMinutes = Number(durationText);
                        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) { window.fitcalcToast("Enter a positive duration.", "error"); return; }
                        actualSet = { durationMinutes: durationMinutes };
                    }

                    const planner =
                        getPlanner();

                    const exercise =
                        planner
                            .workouts[workoutIndex]
                            .exercises[exerciseIndex];

                    if (!exercise.sets) {
                        exercise.sets = [];
                    }

                    exercise.sets.push(actualSet);

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                    window.fitcalcToast("Set logged.");
                }
            );
        });


    /*
     * REMOVE SET
     */

    workoutList
        .querySelectorAll(".remove-set")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const workoutIndex =
                        Number(
                            button.dataset.workout
                        );

                    const exerciseIndex =
                        Number(
                            button.dataset.exercise
                        );

                    const setIndex =
                        Number(
                            button.dataset.set
                        );

                    const planner =
                        getPlanner();

                    planner
                        .workouts[workoutIndex]
                        .exercises[exerciseIndex]
                        .sets
                        .splice(
                            setIndex,
                            1
                        );

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                }
            );
        });


    /*
     * REMOVE EXERCISE
     */

    workoutList
        .querySelectorAll(".remove-exercise")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const workoutIndex =
                        Number(
                            button.dataset.workout
                        );

                    const exerciseIndex =
                        Number(
                            button.dataset.exercise
                        );

                    if (!await window.fitcalcDialog.confirm("Remove this exercise from this workout?", "Remove exercise", "Remove")) {
                        return;
                    }

                    const planner =
                        getPlanner();

                    planner
                        .workouts[workoutIndex]
                        .exercises
                        .splice(
                            exerciseIndex,
                            1
                        );

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                }
            );
        });


    /*
     * DELETE WORKOUT
     */

    workoutList
        .querySelectorAll(".delete-workout")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const workoutIndex =
                        Number(
                            button.dataset.index
                        );

                    if (!await window.fitcalcDialog.confirm("Delete this workout and its logged sets from this day?", "Delete workout", "Delete")) {
                        return;
                    }

                    const planner =
                        getPlanner();

                    const deletedWorkout = planner.workouts[workoutIndex];

                    planner.workouts.splice(
                        workoutIndex,
                        1
                    );

                    if (deletedWorkout && deletedWorkout.id) delete collapsedWorkouts[deletedWorkout.id];

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                    updateDailyProgress();
                }
            );
        });


    /*
     * COMPLETE WORKOUT
     */

    workoutList
        .querySelectorAll(".complete-workout")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const workoutIndex =
                        Number(
                            button.dataset.index
                        );

                    const planner =
                        getPlanner();

                    const workout = planner.workouts[workoutIndex];
                    if (!workout) return;
                    const nextCompleted = !workout.completed;
                    if (nextCompleted && !hasWorkoutPerformance(workout)) {
                        window.fitcalcToast("Log at least one actual set or duration before completing this workout.", "error");
                        return;
                    }
                    workout.completed = nextCompleted;

                    if (!savePlanner(planner)) return;

                    updateWorkoutList();
                    updateDailyProgress();
                }
            );
        });


    /*
     * SAVE WORKOUT AS TEMPLATE
     */

    workoutList
        .querySelectorAll(".save-template")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const workoutIndex =
                        Number(
                            button.dataset.index
                        );

                    const planner =
                        getPlanner();

                    const workout =
                        planner.workouts[
                            workoutIndex
                        ];

                    if (!workout) {
                        return;
                    }

                    const templateNameKey = workout.name.trim().replace(/\s+/g, " ").toLowerCase();
                    const storedTemplates = getWorkoutTemplates();
                    const templates = Array.isArray(storedTemplates) ? storedTemplates : [];
                    const existingTemplate = templates.find(function (template) {
                        return template && typeof template.name === "string" &&
                            template.name.trim().replace(/\s+/g, " ").toLowerCase() === templateNameKey;
                    });
                    if (existingTemplate && !await window.fitcalcDialog.confirm(
                        "A workout template with this name already exists. Overwrite it?",
                        "Overwrite template",
                        "Overwrite"
                    )) return;

                    const template = createWorkoutTemplate(
                        workout.name,
                        workout.exercises
                    );
                    if (!template) return;

                    renderWorkoutTemplates();

                    window.fitcalcToast("Workout saved as a reusable template.");
                }
            );
        });
}


const createWorkoutButton =
    document.getElementById(
        "create-workout"
    );

if (createWorkoutButton) {
    createWorkoutButton.addEventListener(
        "click",
        createWorkout
    );
}


/*
 * TASKS
 */

function addTask() {
    const taskInput =
        document.getElementById(
            "task-name"
        );

    const taskName =
        taskInput.value.trim();

    if (!taskName) {
        window.fitcalcToast("Enter a task first.", "error");
        return;
    }

    const planner = getPlanner();

    planner.tasks.push({
        name: taskName,
        completed: false
    });

    if (!savePlanner(planner)) return;

    taskInput.value = "";

    updateTaskList();
    updateDailyProgress();
    window.fitcalcToast("Task added to this day.");
}


function updateTaskList() {
    const planner = getPlanner();

    const taskList =
        document.getElementById(
            "task-list"
        );

    taskList.innerHTML = "";

    if (planner.tasks.length === 0) {
        taskList.innerHTML =
            '<p><strong>No tasks yet</strong><span>Add one above to keep your day organized.</span></p>';

        return;
    }

    planner.tasks.forEach(
        function (task, index) {

            if (!task || typeof task !== "object") return;

            const taskItem =
                document.createElement("div");
            taskItem.className = "task-item" + (task.completed ? " is-complete" : "");

            taskItem.innerHTML = `
                <p>
                    ${escapeHTML(task.name)}
                </p>

                <button
                    type="button"
                    class="secondary-btn complete-task"
                    data-index="${index}"
                    aria-pressed="${!!task.completed}"
                >
                    ${
                        task.completed
                            ? "Completed"
                            : "Complete"
                    }
                </button>
                <button type="button" class="ghost-btn delete-task" data-index="${index}" aria-label="Remove ${escapeHTML(task.name)}">Remove</button>
            `;

            taskList.appendChild(
                taskItem
            );

            taskItem
                .querySelector(
                    ".complete-task"
                )
                .addEventListener(
                    "click",
                    function () {

                        const planner =
                            getPlanner();

                        planner
                            .tasks[index]
                            .completed = !planner.tasks[index].completed;

                        if (!savePlanner(planner)) return;

                        updateTaskList();
                        updateDailyProgress();
                        window.fitcalcToast(planner.tasks[index].completed ? "Task completed." : "Task marked incomplete.");
                    }
                );

            taskItem.querySelector(".delete-task").addEventListener("click", async function () {
                if (!await window.fitcalcDialog.confirm("Remove this task from the selected day?", "Remove task", "Remove")) return;
                const current = getPlanner();
                current.tasks.splice(index, 1);
                if (!savePlanner(current)) return;
                updateTaskList();
                updateDailyProgress();
            });
        }
    );
}


const addTaskButton =
    document.getElementById(
        "add-task"
    );

if (addTaskButton) {
    addTaskButton.addEventListener(
        "click",
        addTask
    );
}


/*
 * DAILY PROGRESS
 */

function updateDailyProgress() {
    const planner = getPlanner();
    const workouts = Array.isArray(planner.workouts) ? planner.workouts : [];
    const tasks = Array.isArray(planner.tasks) ? planner.tasks : [];

    const completedWorkouts =
        workouts.filter(
            function (workout) {
                return workout && workout.completed === true;
            }
        ).length;

    const completedTasks =
        tasks.filter(
            function (task) {
                return task && task.completed === true;
            }
        ).length;

    document.getElementById(
        "completed-workouts"
    ).textContent =
        completedWorkouts;

    document.getElementById(
        "completed-tasks"
    ).textContent =
        completedTasks;
}

function isWorkoutCollapsed(workoutId) {
    return collapsedWorkouts[workoutId] === true;
}

function toggleWorkoutCollapsed(workoutId) {
    collapsedWorkouts[workoutId] = !isWorkoutCollapsed(workoutId);
    return collapsedWorkouts[workoutId];
}


/*
 * DAY NAVIGATION
 */

function refreshPlannerDay() {
    const dateKey = getDateKey(selectedDate);
    if (dateKey !== renderedPlannerDateKey) {
        Object.keys(collapsedWorkouts).forEach(function (key) {
            delete collapsedWorkouts[key];
        });
        renderedPlannerDateKey = dateKey;
    }

    updateSelectedDay();
    updateStepsDisplay();
    updateWeightDisplay();
    updateWorkoutList();
    updateTaskList();
    updateDailyProgress();
}

const previousDayButton =
    document.getElementById(
        "previous-day"
    );

if (previousDayButton) {

    previousDayButton.addEventListener(
        "click",
        function () {

            selectedDate.setDate(
                selectedDate.getDate() - 1
            );
            refreshPlannerDay();
        }
    );
}


const nextDayButton =
    document.getElementById(
        "next-day"
    );

if (nextDayButton) {

    nextDayButton.addEventListener(
        "click",
        function () {

            const today = new Date();
            const nextDate = new Date(selectedDate);
            nextDate.setDate(nextDate.getDate() + 1);
            if (getDateKey(nextDate) > getDateKey(today)) return;

            selectedDate.setDate(
                selectedDate.getDate() + 1
            );
            refreshPlannerDay();
        }
    );
}

const todayDayButton = document.getElementById("today-day");
if (todayDayButton) {
    todayDayButton.addEventListener("click", function () {
        selectedDate = new Date();
        refreshPlannerDay();
    });
}

function setPlannerView(view) {
    const workoutsCard = document.getElementById("planner-workouts-card");
    const tasksCard = document.getElementById("planner-task-card");
    const showWorkouts = view !== "tasks";
    const showTasks = view !== "workouts";
    if (workoutsCard) workoutsCard.hidden = !showWorkouts;
    if (tasksCard) tasksCard.hidden = !showTasks;

    [
        ["planner-view-workouts", "workouts"],
        ["planner-view-tasks", "tasks"],
        ["planner-view-all", "all"]
    ].forEach(function (item) {
        const button = document.getElementById(item[0]);
        if (button) button.setAttribute("aria-pressed", String(item[1] === view));
    });
}

[
    ["planner-view-workouts", "workouts"],
    ["planner-view-tasks", "tasks"],
    ["planner-view-all", "all"]
].forEach(function (item) {
    const button = document.getElementById(item[0]);
    if (button) button.addEventListener("click", function () { setPlannerView(item[1]); });
});
setPlannerView("all");

function handlePlannerDateChange() {
    if (document.visibilityState === "hidden") return;
    refreshPlannerTodayIfNeeded();
}

if (typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", handlePlannerDateChange);
}
if (typeof window.addEventListener === "function") {
    window.addEventListener("focus", handlePlannerDateChange);
    window.addEventListener("fitcalc:data-change", function (event) {
        const detail = event.detail || {};
        const displayKeys = [PLANNER_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY];
        if (detail.key && displayKeys.indexOf(detail.key) === -1) return;
        if (detail.date && detail.date !== getDateKey(selectedDate) && detail.key === PLANNER_KEY) return;
        refreshPlannerDay();
    });
    window.addEventListener("storage", function (event) {
        if ([PLANNER_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY].some(function (key) {
            return event.key === fitcalcStorageKey(key);
        })) refreshPlannerDay();
    });
}


/*
 * INITIAL RENDER
 */

updateStepsDisplay();
updateWeightDisplay();
updateWorkoutList();
updateTaskList();
updateDailyProgress();
updateSelectedDay();
