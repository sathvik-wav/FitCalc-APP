/*
 * NORMALIZE RECORD
 *
 * Makes old and new history records
 * use the same structure.
 */

function normalizeProgressRecord(
    dateKey,
    record
) {

    record =
        record && typeof record === "object"
            ? record
            : {};


    const recordDate =
        typeof record.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(
            record.date
        )
            ? record.date
            : dateKey;

    const workouts = Array.isArray(record.workouts) ? record.workouts.filter(Boolean) : [];
    const tasks = Array.isArray(record.tasks) ? record.tasks.filter(Boolean) : [];
    const legacyCompletedWorkouts = Array.isArray(record.workouts)
        ? workouts.filter(function (workout) { return workout && workout.completed === true; }).length
        : record.workouts;
    const legacyCompletedTasks = Array.isArray(record.tasks)
        ? tasks.filter(function (task) { return task && task.completed === true; }).length
        : record.tasks;


    let weight = null;


    if (
        record.weight !== null &&
        record.weight !== undefined &&
        Number.isFinite(
            Number(record.weight)
        )
    ) {

        weight =
            Number(record.weight);

    }


    return {

        date:
            recordDate,

        weight:
            weight,

        calories:
            Math.round(
                Number(
                    record.calories
                ) || 0
            ),

        protein:
            Math.round(
                Number(
                    record.protein
                ) || 0
            ),

        carbs:
            Math.round(
                Number(
                    record.carbs
                ) || 0
            ),

        fat:
            Math.round(
                Number(
                    record.fat
                ) || 0
            ),

        fiber:
            Math.round(
                Number(
                    record.fiber
                ) || 0
            ),

        foods:
            Array.isArray(record.foods) ? record.foods : [],

        water:
            Number(record.water) || 0,

        steps:
            Math.round(
                Number(
                    record.steps
                ) || 0
            ),

        workouts:
            workouts,

        completedWorkouts:
            Math.round(Number(record.completedWorkouts ?? legacyCompletedWorkouts) || 0),

        tasks:
            tasks,

        completedTasks:
            Math.round(Number(record.completedTasks ?? legacyCompletedTasks) || 0)

    };
}


/*
 * CREATE DAILY RECORD
 */

function createProgressRecord(dateKey, nutritionForDate, plannerForDate) {

    const nutrition =
        nutritionForDate || getNutritionFor(dateKey);


    const planner =
        plannerForDate || getPlannerFor(dateKey);


    const workouts =
        Array.isArray(
            planner.workouts
        )
            ? planner.workouts.filter(Boolean)
            : [];


    const tasks =
        Array.isArray(
            planner.tasks
        )
            ? planner.tasks.filter(Boolean)
            : [];


    const completedWorkouts =
        workouts.filter(
            function (workout) {

                return (
                    workout &&
                    workout.completed === true
                );

            }
        ).length;


    const completedTasks =
        tasks.filter(
            function (task) {

                return (
                    task &&
                    task.completed === true
                );

            }
        ).length;


    let weight = null;


    if (
        planner.weight !== null &&
        planner.weight !== undefined &&
        Number.isFinite(
            Number(planner.weight)
        )
    ) {

        weight =
            Number(
                planner.weight
            );

    }


    return {

        date:
            dateKey,

        weight:
            weight,

        calories:
            Math.round(
                Number(
                    nutrition.calories
                ) || 0
            ),

        protein:
            Math.round(
                Number(
                    nutrition.protein
                ) || 0
            ),

        carbs:
            Math.round(
                Number(
                    nutrition.carbs
                ) || 0
            ),

        fat:
            Math.round(
                Number(
                    nutrition.fat
                ) || 0
            ),

        fiber:
            Math.round(
                Number(
                    nutrition.fiber
                ) || 0
            ),

        foods:
            Array.isArray(nutrition.foods) ? nutrition.foods : [],

        steps:
            Math.round(
                Number(
                    planner.steps
                ) || 0
            ),

        water:
            Number(nutrition.water) || 0,

        workouts:
            workouts,

        completedWorkouts:
            completedWorkouts,

        tasks:
            tasks,

        completedTasks:
            completedTasks

    };
}


/*
 * SAVE DAILY RECORD
 */

function saveProgressRecord(dateKey) {

    const history =
        getProgressHistoryStorage();


    const existing =
        history[dateKey];


    const record =
        createProgressRecord(
            dateKey
        );

    const hasData = hasProgressRecordData(record);

    // A read or an empty edit should never manufacture a blank history day.
    if (!hasData && !existing) return null;


    /*
     * Preserve historical weight if
     * planner currently has no weight.
     */

    if (
        record.weight === null &&
        existing &&
        existing.weight !== null &&
        existing.weight !== undefined &&
        Number.isFinite(
            Number(existing.weight)
        )
    ) {

        record.weight =
            Number(
                existing.weight
        );

    }

    if (existing && JSON.stringify(normalizeProgressRecord(dateKey, existing)) === JSON.stringify(normalizeProgressRecord(dateKey, record))) {
        return normalizeProgressRecord(dateKey, existing);
    }


    history[dateKey] =
        record;


    if (Object.keys(history).length > 0) {
        try {
            if (!saveProgressHistoryStorage(history)) return false;
        } catch (error) {
            return false;
        }
    }


    return record;
}

function hasProgressRecordData(record) {
    return record.weight !== null || record.calories > 0 ||
        record.protein > 0 || record.carbs > 0 || record.fat > 0 ||
        record.fiber > 0 || record.foods.length > 0 || record.water > 0 || record.steps > 0 ||
        record.workouts.length > 0 || record.tasks.length > 0;
}


/*
 * GET ONE RECORD
 */

function getProgressRecord(dateKey) {

    const history =
        getProgressHistoryStorage();


    if (!history[dateKey]) {

        return null;

    }


    return normalizeProgressRecord(
        dateKey,
        history[dateKey]
    );
}


/*
 * GET ALL RECORDS
 */

function getProgressRecords() {

    const history =
        getProgressHistoryStorage();


    return Object.entries(history)

        .map(
            function ([dateKey, record]) {

                return normalizeProgressRecord(
                    dateKey,
                    record
                );

            }
        )

        .filter(
            function (record) {

                return (
                    /^\d{4}-\d{2}-\d{2}$/.test(
                        record.date
                    ) && record.date <= getDateKey(new Date())
                );

            }
        )

        .sort(
            function (a, b) {

                return a.date.localeCompare(
                    b.date
                );

            }
        );
}


/*
 * GET LAST N RECORDS
 */

function getProgressRecordsForDays(
    days
) {

    const records =
        getProgressRecords();


    const count =
        Number(days);


    if (
        !Number.isFinite(count) ||
        count <= 0
    ) {

        return records;

    }


    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Math.ceil(count) + 1);
    const firstKey = getDateKey(start);
    const lastKey = getDateKey(end);
    return records.filter(function (record) {
        return record.date >= firstKey && record.date <= lastKey;
    });
}


/*
 * WEIGHT HISTORY
 */

function getWeightProgress() {

    return getProgressRecords()

        .filter(
            function (record) {

                return (
                    record.weight !== null &&
                    Number.isFinite(
                        Number(record.weight)
                    )
                );

            }
        )

        .map(
            function (record) {

                return {

                    date:
                        record.date,

                    weight:
                        Number(
                            record.weight
                        )

                };

            }
        );
}


/*
 * AVERAGE
 */

function isProgressMetricLogged(record, field) {
    if (!record || record[field] === null || record[field] === undefined) return false;

    const value = Number(record[field]);
    if (!Number.isFinite(value)) return false;

    if (["calories", "protein", "carbs", "fat", "fiber"].includes(field)) {
        return value > 0 || (Array.isArray(record.foods) && record.foods.length > 0);
    }

    // These metrics have no per-day zero marker, so a positive value is the
    // evidence that they were actually logged rather than defaulted to zero.
    if (["water", "steps", "completedWorkouts", "completedTasks"].includes(field)) {
        return value > 0;
    }

    return true;
}

function getProgressAverage(
    field,
    days
) {

    const records =
        days
            ? getProgressRecordsForDays(
                days
            )
            : getProgressRecords();


    const values =
        records

            .filter(
                function (record) {

                    return isProgressMetricLogged(record, field);

                }
            )

            .map(
                function (record) {

                    return Number(
                        record[field]
                    );

                }
            )

            .filter(
                function (value) {

                    return Number.isFinite(
                        value
                    );

                }
            );


    if (
        values.length === 0
    ) {

        return 0;

    }


    const total =
        values.reduce(
            function (
                sum,
                value
            ) {

                return sum + value;

            },
            0
        );


    return total / values.length;
}


/*
 * WEIGHT CHANGE
 */

function getWeightChange(days) {
    const weights = (days
        ? getProgressRecordsForDays(days)
        : getProgressRecords())
        .filter(function (record) {
            return record.weight !== null && Number.isFinite(Number(record.weight));
        });

    if (
        weights.length < 2
    ) {

        return null;
    }


    const first = Number(weights[0].weight);
    const last = Number(weights[weights.length - 1].weight);


    return last - first;
}


function backfillProgressFromActivity() {
    if (readJSON(PROGRESS_BACKFILL_KEY, false) === true) return;

    const nutritionDays = readJSON(NUTRITION_KEY, {});
    const plannerDays = readJSON(PLANNER_KEY, {});
    const history = getProgressHistoryStorage();
    const dates = new Set(Object.keys(nutritionDays).concat(Object.keys(plannerDays)));
    let allEligibleRecordsSaved = true;
    let historyChanged = false;
    dates.forEach(function (dateKey) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        const nutrition = nutritionDays[dateKey] || {};
        const planner = plannerDays[dateKey] || {};
        const record = createProgressRecord(dateKey, nutrition, planner);
        if (!hasProgressRecordData(record)) return;

        const existing = history[dateKey];
        if (record.weight === null && existing && existing.weight !== null && existing.weight !== undefined && Number.isFinite(Number(existing.weight))) {
            record.weight = Number(existing.weight);
        }
        if (existing && JSON.stringify(normalizeProgressRecord(dateKey, existing)) === JSON.stringify(normalizeProgressRecord(dateKey, record))) return;

        history[dateKey] = record;
        historyChanged = true;
    });

    if (historyChanged) {
        try {
            if (!saveProgressHistoryStorage(history)) allEligibleRecordsSaved = false;
        } catch (error) {
            allEligibleRecordsSaved = false;
        }
    }

    if (allEligibleRecordsSaved) {
        try { writeJSON(PROGRESS_BACKFILL_KEY, true); }
        catch (error) { /* The storage notice is already announced by writeJSON. */ }
    }
}


/*
 * INITIALIZATION
 */

if (typeof window !== "undefined") {
    window.addEventListener("fitcalc:data-change", function (event) {
        const dateKey = event.detail && event.detail.date;
        if (dateKey) saveProgressRecord(dateKey);
    });

    window.addEventListener("storage", function (event) {
        if (event.key !== fitcalcStorageKey(NUTRITION_KEY) && event.key !== fitcalcStorageKey(PLANNER_KEY)) return;
        try {
            const changedDays = event.newValue ? JSON.parse(event.newValue) : {};
            const previousDays = event.oldValue ? JSON.parse(event.oldValue) : {};
            const affectedDates = new Set(Object.keys(changedDays).concat(Object.keys(previousDays)));
            affectedDates.forEach(function (dateKey) {
                if (JSON.stringify(changedDays[dateKey]) !== JSON.stringify(previousDays[dateKey])) {
                    saveProgressRecord(dateKey);
                }
            });
        } catch (error) {
            // Ignore malformed external storage; normal reads remain non-mutating.
        }
    });
    backfillProgressFromActivity();
}
