/*
 * MacroBay HISTORY
 *
 * Progress / History page UI
 */


/*
 * ELEMENTS
 */

const historyList =
    document.querySelector(
        "#history-list"
    );


/*
 * STATE
 */

let historyRange = 7;


/*
 * FORMAT DATE
 */

function formatHistoryDate(dateKey) {

    const date =
        new Date(
            dateKey + "T00:00:00"
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return dateKey;

    }


    return date.toLocaleDateString(
        undefined,
        {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


/*
 * FORMAT SHORT DATE
 */

function formatChartDate(dateKey) {

    const date =
        new Date(
            dateKey + "T00:00:00"
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return dateKey;

    }


    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short"
        }
    );
}


/*
 * FORMAT NUMBER
 */

function formatHistoryNumber(value) {

    return Number(
        value || 0
    ).toLocaleString();
}


/*
 * FORMAT DECIMAL
 */

function formatHistoryDecimal(value, decimalPlaces) {

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "—";
    }

    return Number(
        value || 0
    ).toFixed(Number.isInteger(decimalPlaces) ? decimalPlaces : 1);
}


/*
 * CREATE SUMMARY CARD
 */

function createSummaryCard(
    label,
    value,
    unit
) {

    return `
        <div class="history-summary-card">

            <span>
                ${label}
            </span>

            <strong>
                ${value}
            </strong>

            <small>
                ${unit}
            </small>

        </div>
    `;
}


/*
 * CREATE SUMMARY
 */

function isHistoryDayLogged(record) {
    if (!record || typeof record !== "object") return false;
    return (record.weight !== null && record.weight !== undefined && Number.isFinite(Number(record.weight))) ||
        Number(record.calories) > 0 || Number(record.protein) > 0 || Number(record.carbs) > 0 ||
        Number(record.fat) > 0 || Number(record.fiber) > 0 || Number(record.water) > 0 ||
        Number(record.steps) > 0 || (Array.isArray(record.foods) && record.foods.length > 0) ||
        (Array.isArray(record.workouts) && record.workouts.length > 0) ||
        (Array.isArray(record.tasks) && record.tasks.length > 0);
}

function shiftHistoryDateKey(dateKey, offset) {
    const date = new Date(dateKey + "T00:00:00");
    date.setDate(date.getDate() + offset);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function getHistoryConsistency(records, days) {
    const loggedDates = Array.from(new Set((records || [])
        .filter(isHistoryDayLogged)
        .map(function (record) { return record.date; })
        .filter(function (date) { return /^\d{4}-\d{2}-\d{2}$/.test(date || ""); })))
        .sort();
    const loggedSet = new Set(loggedDates);
    let bestStreak = 0;
    let runningStreak = 0;
    let previousDate = null;
    loggedDates.forEach(function (date) {
        runningStreak = previousDate && shiftHistoryDateKey(previousDate, 1) === date ? runningStreak + 1 : 1;
        bestStreak = Math.max(bestStreak, runningStreak);
        previousDate = date;
    });

    const today = new Date();
    const todayKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const rangeStart = shiftHistoryDateKey(todayKey, 1 - Math.max(1, Math.floor(Number(days) || 1)));
    let currentDate = loggedSet.has(todayKey) ? todayKey : shiftHistoryDateKey(todayKey, -1);
    let currentStreak = 0;
    while (currentDate >= rangeStart && loggedSet.has(currentDate)) {
        currentStreak += 1;
        currentDate = shiftHistoryDateKey(currentDate, -1);
    }

    return { currentStreak: currentStreak, bestStreak: bestStreak, daysLogged: loggedDates.length };
}

function createHistorySummaryHTML(records) {
    const averageCalories = Math.round(getProgressAverage("calories", historyRange));
    const weightChange = getWeightChange(historyRange);
    const loggedRecords = (records || []).filter(isHistoryDayLogged);
    const workoutsCompleted = loggedRecords.reduce(function (total, record) {
        return total + Math.max(Number(record.completedWorkouts) || 0, 0);
    }, 0);
    const consistency = getHistoryConsistency(loggedRecords, historyRange);


    return `

        <section class="history-summary">

            ${createSummaryCard(
                `${historyRange} DAY AVG CALORIES`,
                formatHistoryNumber(
                    averageCalories
                ),
                "kcal / day"
            )}


            ${createSummaryCard(
                "WEIGHT CHANGE",
                weightChange === null ? "—" : formatHistoryDecimal(kilogramsToDisplayWeight(weightChange)),
                `${getMacroBayWeightUnit()} / ${historyRange} days`
            )}

            ${createSummaryCard(
                "WORKOUTS COMPLETED",
                formatHistoryNumber(workoutsCompleted),
                `${historyRange} day range`
            )}

            ${createSummaryCard(
                "DAYS LOGGED",
                formatHistoryNumber(consistency.daysLogged),
                `of ${historyRange} days`
            )}

        </section>

    `;
}

function createHistoryConsistencyHTML(records) {
    const consistency = getHistoryConsistency(records, historyRange);
    return `<section class="history-consistency" aria-label="Consistency for the selected ${historyRange} day range">
        <div><span class="page-kicker">Consistency</span><strong>Keep your rhythm going</strong></div>
        <div class="history-streak-values"><p><span>Current streak</span><strong>${consistency.currentStreak} <small>${consistency.currentStreak === 1 ? "day" : "days"}</small></strong></p>
        <p><span>Best streak</span><strong>${consistency.bestStreak} <small>${consistency.bestStreak === 1 ? "day" : "days"}</small></strong></p></div>
    </section>`;
}


/*
 * RANGE SELECTOR
 */

function createRangeSelectorHTML() {

    return `

        <div class="history-range">

            <span>
                RANGE
            </span>


            <button
                type="button"
                class="history-range-btn ${
                    historyRange === 7
                        ? "active"
                        : ""
                }"
                data-history-range="7"
                aria-pressed="${historyRange === 7}"
            >
                7D
            </button>


            <button
                type="button"
                class="history-range-btn ${
                    historyRange === 30
                        ? "active"
                        : ""
                }"
                data-history-range="30"
                aria-pressed="${historyRange === 30}"
            >
                30D
            </button>


            <button
                type="button"
                class="history-range-btn ${
                    historyRange === 90
                        ? "active"
                        : ""
                }"
                data-history-range="90"
                aria-pressed="${historyRange === 90}"
            >
                90D
            </button>

            <button type="button" class="secondary-btn" id="export-history-csv" ${getVisibleHistoryRecords(historyRange).length ? "" : "disabled"}>Export CSV</button>

        </div>

    `;
}


/*
 * CHART POINTS
 */

function getChartValueScale(records, field, options) {
    if (!records.length) return { min: 0, max: 1 };
    const values = records.map(function (record) { return Number(record[field]) || 0; });
    const zeroBaseline = !options || options.zeroBaseline !== false;
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (zeroBaseline) {
        min = Math.min(min, 0);
        max = Math.max(max, 1);
    } else {
        const dataRange = max - min;
        const chartPadding = dataRange === 0
            ? Math.max(Math.abs(min) * 0.1, 1)
            : dataRange * 0.1;
        min -= chartPadding;
        max += chartPadding;
    }

    return { min: min, max: max };
}

function createChartPoints(
    records,
    field,
    width,
    height,
    padding,
    options
) {
    if (records.length === 0) return [];

    const scale = getChartValueScale(records, field, options);
    const min = scale.min;
    const range = scale.max - scale.min || 1;


    return records.map(
        function (record, index) {

            const x =
                records.length === 1
                    ? width / 2
                    : padding +
                      (
                        index /
                        (records.length - 1)
                      ) *
                      (
                        width -
                        padding * 2
                      );


            const y =
                height -
                padding -
                (
                    (
                        Number(
                            record[field]
                        ) - min
                    ) /
                    range
                ) *
                (
                    height -
                    padding * 2
                );


            return {

                x: x,
                y: y,
                value:
                    Number(
                        record[field]
                    ) || 0,
                date:
                    record.date

            };

        }
    );
}


/*
 * SVG LINE CHART
 */

function createLineChartHTML(
    title,
    field,
    unit,
    records
) {

    const width = 760;
    const height = 240;
    const padding = 30;


    const points =
        createChartPoints(
            records,
            field,
            width,
            height,
            padding,
            { zeroBaseline: field !== "weight" }
        );


    if (
        points.length === 0
    ) {

        return `
            <section class="progress-chart" aria-label="${escapeHTML(title)} trend. No data yet.">

                <div class="progress-chart-header">
                    <strong>${title}</strong>
                </div>

                <div class="progress-chart-empty">
                    No data yet.
                </div>

            </section>
        `;

    }


    const polyline =
        points
            .map(
                function (point) {

                    return `${point.x},${point.y}`;

                }
            )
            .join(" ");


    const first =
        points[0];


    const last =
        points[
            points.length - 1
        ];


    const latest =
        last.value;

    const scale = getChartValueScale(records, field, { zeroBaseline: field !== "weight" });
    const axisMax = scale.max;
    const axisMin = scale.min;
    const dataValues = records.map(function (record) { return Number(record[field]) || 0; });
    const dataMin = Math.min(...dataValues);
    const dataMax = Math.max(...dataValues);
    const axisLabel = function (value) {
        return field === "weight" ? formatHistoryDecimal(value, 1) : formatHistoryNumber(value);
    };
    const chartValueLabel = function (value) {
        return field === "weight" ? formatHistoryDecimal(value, 1) : formatHistoryNumber(value);
    };
    const topGridPercent = (padding / height * 100).toFixed(3);
    const bottomGridPercent = ((height - padding) / height * 100).toFixed(3);


    return `

        <section class="progress-chart" aria-label="${escapeHTML(title)} trend. Latest value: ${escapeHTML(chartValueLabel(latest))} ${escapeHTML(unit)}. Range: ${escapeHTML(axisLabel(dataMin))} to ${escapeHTML(axisLabel(dataMax))} ${escapeHTML(unit)}.">

            <div class="progress-chart-header">

                <div>

                    <strong>
                        ${title}
                    </strong>

                    <small>
                        ${chartValueLabel(
                            latest
                        )} ${unit}
                    </small>

                </div>

            </div>


            <div class="progress-chart-wrap">

                <div class="progress-chart-y-labels" aria-hidden="true">
                    <span class="progress-chart-y-label" data-axis="top" style="top:${topGridPercent}%">${axisLabel(axisMax)}</span>
                    <span class="progress-chart-y-label" data-axis="bottom" style="top:${bottomGridPercent}%">${axisLabel(axisMin)}</span>
                </div>

                <div class="progress-chart-plot">
                    <svg
                        class="progress-chart-svg"
                        viewBox="0 0 ${width} ${height}"
                        preserveAspectRatio="none"
                        role="img"
                        aria-hidden="true"
                    >

                        <line
                            x1="${padding}"
                            y1="${padding}"
                            x2="${width - padding}"
                            y2="${padding}"
                            class="chart-grid"
                            data-axis="top"
                            vector-effect="non-scaling-stroke"
                        />

                        <line
                            x1="${padding}"
                            y1="${height / 2}"
                            x2="${width - padding}"
                            y2="${height / 2}"
                            class="chart-grid"
                            vector-effect="non-scaling-stroke"
                        />

                        <line
                            x1="${padding}"
                            y1="${height - padding}"
                            x2="${width - padding}"
                            y2="${height - padding}"
                            class="chart-grid"
                            data-axis="bottom"
                            vector-effect="non-scaling-stroke"
                        />


                        <polyline
                            points="${polyline}"
                            class="chart-line"
                            fill="none"
                            vector-effect="non-scaling-stroke"
                        />

                    </svg>

                    <div class="progress-chart-points" aria-hidden="true">
                        ${
                            points
                                .map(
                                    function (point) {

                                        const tooltip = formatChartDate(point.date) + ": " + chartValueLabel(point.value) + " " + unit;
                                        return `
                                            <span
                                                class="chart-point"
                                                aria-hidden="true"
                                                title="${escapeHTML(tooltip)}"
                                                data-value="${point.value}"
                                                style="left:${(point.x / width * 100).toFixed(3)}%;top:${(point.y / height * 100).toFixed(3)}%"
                                            ></span>
                                        `;

                                    }
                                )
                                .join("")
                        }
                    </div>

                </div>

            </div>


            <div class="progress-chart-labels">

                <span>
                    ${formatChartDate(
                        first.date
                    )}
                </span>

                <span>
                    ${formatChartDate(
                        last.date
                    )}
                </span>

            </div>

        </section>

    `;
}


/*
 * CREATE CHARTS
 */

function createProgressChartsHTML() {

    const records =
        getProgressRecordsForDays(
            historyRange
        );


    const weightRecords = records.filter(function (record) {
        return record.weight !== null && Number.isFinite(Number(record.weight));
    }).map(function (record) {
        return Object.assign({}, record, { weight: kilogramsToDisplayWeight(record.weight) });
    });

    return `

        <section class="progress-charts">

            <div class="history-section-title">

                <span>
                    TRENDS
                </span>

                <small>
                    ${historyRange} days
                </small>

            </div>


            <div class="progress-chart-grid">

                ${createLineChartHTML(
                    "Weight",
                    "weight",
                    getMacroBayWeightUnit(),
                    weightRecords
                )}


                ${createLineChartHTML(
                    "Calories",
                    "calories",
                    "kcal",
                    records.filter(function (record) {
                        return isProgressMetricLogged(record, "calories");
                    })
                )}


                ${createLineChartHTML(
                    "Protein",
                    "protein",
                    "g",
                    records.filter(function (record) {
                        return isProgressMetricLogged(record, "protein");
                    })
                )}


                ${createLineChartHTML(
                    "Steps",
                    "steps",
                    "steps",
                    records.filter(function (record) {
                        return isProgressMetricLogged(record, "steps");
                    })
                )}

            </div>

        </section>

    `;
}


/*
 * CREATE RECORD CARD
 */

function formatHistorySetText(set) {
    if (!set || typeof set !== "object") return "Performance not recorded";
    const parts = [];
    if (Number(set.reps) > 0) parts.push(Number(set.reps) + " reps");
    if (Number(set.weight) > 0) parts.push(formatHistoryDecimal(kilogramsToDisplayWeight(set.weight)) + " " + getMacroBayWeightUnit());
    if (Number(set.durationMinutes) > 0) parts.push(Number(set.durationMinutes) + " min");
    if (set.notes) parts.push(String(set.notes));
    return parts.join(" · ") || "Performance not recorded";
}

function formatHistorySet(set) {
    return escapeHTML(formatHistorySetText(set));
}

function createHistoryRecordHTML(record) {
    const workouts = Array.isArray(record.workouts) ? record.workouts.filter(function (item) { return item && typeof item === "object"; }) : [];
    const tasks = Array.isArray(record.tasks) ? record.tasks.filter(function (item) { return item && typeof item === "object"; }) : [];
    const foods = Array.isArray(record.foods) ? record.foods.filter(function (item) { return item && typeof item === "object"; }) : [];
    const workoutCount = Number(record.completedWorkouts) || 0;
    const taskCount = Number(record.completedTasks) || 0;
    const workoutSummary = workouts.length ? workoutCount + " / " + workouts.length : formatHistoryNumber(workoutCount);
    const taskSummary = tasks.length ? taskCount + " / " + tasks.length : formatHistoryNumber(taskCount);
    const foodDetails = foods.length ? foods.map(function (food) {
        return `<li><strong>${escapeHTML(food.name || "Food")}</strong> · ${escapeHTML(food.meal || "Snack")} · ${formatHistoryDecimal(food.amount)} g · ${formatHistoryNumber(food.calories)} kcal · P ${formatHistoryDecimal(food.protein)} g / C ${formatHistoryDecimal(food.carbs)} g / F ${formatHistoryDecimal(food.fat)} g</li>`;
    }).join("") : "<li>No food entries recorded.</li>";
    const workoutDetails = workouts.length ? workouts.map(function (workout) {
        const exercises = Array.isArray(workout.exercises) ? workout.exercises.filter(function (item) { return item && typeof item === "object"; }) : [];
        const exerciseDetails = exercises.map(function (exercise) {
            const sets = Array.isArray(exercise.sets) ? exercise.sets.filter(function (item) { return item && typeof item === "object"; }) : [];
            return `<li><strong>${escapeHTML(exercise.name || "Exercise")}</strong>${sets.length ? `<ol>${sets.map(function (set) { return `<li>${formatHistorySet(set)}</li>`; }).join("")}</ol>` : "<small>No performance sets recorded.</small>"}</li>`;
        }).join("");
        return `<li>${workout.completed === true ? "Completed" : "Planned"}: <strong>${escapeHTML(workout.name || "Workout")}</strong>${exerciseDetails ? `<ul>${exerciseDetails}</ul>` : "<small>No exercises recorded.</small>"}</li>`;
    }).join("") : "<li>No workouts recorded.</li>";
    const taskDetails = tasks.length ? tasks.map(function (task) {
        return `<li>${task.completed === true ? "Completed" : "Planned"}: ${escapeHTML(task.name || "Task")}</li>`;
    }).join("") : "<li>No tasks recorded.</li>";
    const day = encodeURIComponent(record.date);

    return `<details class="history-record history-record-details" data-history-date="${escapeHTML(record.date)}">
        <summary class="history-record-summary">
        <div class="history-record-header"><div><span class="history-record-date">${formatHistoryDate(record.date)}</span></div>
        ${record.weight !== null ? `<span class="history-weight">${formatHistoryDecimal(kilogramsToDisplayWeight(record.weight))} ${getMacroBayWeightUnit()}</span>` : ""}</div>
        <div class="history-stats">
            <div class="history-stat"><span>Calories</span><strong>${formatHistoryNumber(record.calories)} <small>kcal</small></strong></div>
            <div class="history-stat"><span>Water</span><strong>${formatHistoryDecimal(record.water, 2)} <small>L</small></strong></div>
            <div class="history-stat"><span>Protein</span><strong>${formatHistoryNumber(record.protein)} <small>g</small></strong></div>
            <div class="history-stat"><span>Carbs</span><strong>${formatHistoryNumber(record.carbs)} <small>g</small></strong></div>
            <div class="history-stat"><span>Fat</span><strong>${formatHistoryNumber(record.fat)} <small>g</small></strong></div>
            <div class="history-stat"><span>Steps</span><strong>${formatHistoryNumber(record.steps)}</strong></div>
            <div class="history-stat"><span>Workouts</span><strong>${workoutSummary}</strong></div>
            <div class="history-stat"><span>Tasks</span><strong>${taskSummary}</strong></div>
        </div>
        <span class="history-record-prompt">View foods, sets, and activity details</span>
        </summary>
        <div class="history-detail-grid"><section><h3>Food</h3><ul>${foodDetails}</ul></section><section><h3>Workouts and sets</h3><ul>${workoutDetails}</ul></section><section><h3>Tasks</h3><ul>${taskDetails}</ul></section></div>
        <div class="history-record-actions"><a class="secondary-btn" href="../nutrition/index.html?date=${day}">Edit nutrition</a><a class="secondary-btn" href="../planner/index.html?date=${day}">Edit activity</a><button type="button" class="ghost-btn delete-history-day" data-delete-history-date="${escapeHTML(record.date)}">Delete day</button></div>
    </details>`;
}

/*
 * CREATE DAILY RECORDS
 */

function createHistoryRecordsHTML(
    records
) {

    if (
        records.length === 0
    ) {

        return `

            <div class="history-empty">

                <strong>
                    No records yet.
                </strong>

                <p>
                    Start logging nutrition,
                    steps, workouts and weight.
                </p>

            </div>

        `;

    }


    return `

        <section class="history-records">

            <div class="history-section-title">

                <span>
                    DAILY RECORDS
                </span>

                <small>
                    ${records.length}
                    ${
                        records.length === 1
                            ? "day"
                            : "days"
                    }
                </small>

            </div>


            ${records
                .map(
                    createHistoryRecordHTML
                )
                .join("")}

        </section>

    `;
}


/*
 * RANGE EVENTS
 */

function csvCell(value) {
    let text = String(value === null || value === undefined ? "" : value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}

function createHistoryCSV(records) {
    const columns = ["Date", "Weight (" + getMacroBayWeightUnit() + ")", "Calories", "Protein", "Carbohydrates", "Fat", "Fiber", "Water (L)", "Steps", "Completed workouts", "Planned workouts", "Completed tasks", "Planned tasks", "Foods", "Workout details"];
    const rows = [columns.map(csvCell).join(",")];
    records.forEach(function (record) {
        const workouts = Array.isArray(record.workouts) ? record.workouts.filter(function (item) { return item && typeof item === "object"; }) : [];
        const tasks = Array.isArray(record.tasks) ? record.tasks.filter(function (item) { return item && typeof item === "object"; }) : [];
        const foods = Array.isArray(record.foods) ? record.foods.filter(function (item) { return item && typeof item === "object"; }) : [];
        const workoutText = workouts.map(function (workout) {
            const exercises = (Array.isArray(workout.exercises) ? workout.exercises : []).filter(function (item) { return item && typeof item === "object"; }).map(function (exercise) {
                const sets = (Array.isArray(exercise.sets) ? exercise.sets : []).filter(function (item) { return item && typeof item === "object"; }).map(formatHistorySetText).join("; ");
                return String(exercise.name || "Exercise") + (sets ? ": " + sets : "");
            }).join(" / ");
            return String(workout.name || "Workout") + " [" + (workout.completed === true ? "completed" : "planned") + "]" + (exercises ? " — " + exercises : "");
        }).join(" | ");
        const values = [
            record.date,
            record.weight === null ? "" : kilogramsToDisplayWeight(record.weight),
            record.calories, record.protein, record.carbs, record.fat, record.fiber, record.water, record.steps,
            Number(record.completedWorkouts) || 0,
            Math.max(workouts.length - (Number(record.completedWorkouts) || 0), 0),
            Number(record.completedTasks) || 0,
            Math.max(tasks.length - (Number(record.completedTasks) || 0), 0),
            foods.map(function (food) { return (food.meal || "Snack") + ": " + (food.name || "Food") + " (" + food.amount + " g)"; }).join(" | "),
            workoutText
        ];
        rows.push(values.map(csvCell).join(","));
    });
    return rows.join("\r\n");
}

function downloadHistoryCSV() {
    const records = getVisibleHistoryRecords(historyRange);
    if (!records.length) return false;
    if (typeof Blob !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        if (typeof window.macrobayToast === "function") window.macrobayToast("CSV export is unavailable in this environment.", "error");
        return false;
    }
    const blob = new Blob(["\ufeff" + createHistoryCSV(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "macrobay-history-" + historyRange + "d-" + getDateKey(new Date()) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    if (typeof window.macrobayToast === "function") window.macrobayToast("History CSV downloaded.");
    return true;
}

function attachHistoryEvents() {

    const buttons =
        document.querySelectorAll(
            "[data-history-range]"
        );


    buttons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    historyRange =
                        Number(
                            button.dataset
                                .historyRange
                        );


                    renderHistory();

                }
            );

        }
    );

    const exportButton = typeof document.getElementById === "function" ? document.getElementById("export-history-csv") : null;
    if (exportButton) exportButton.addEventListener("click", downloadHistoryCSV);

    (typeof document.querySelectorAll === "function" ? document.querySelectorAll("[data-delete-history-date]") : []).forEach(function (button) {
        button.addEventListener("click", function () {
            const date = button.dataset.deleteHistoryDate;
            if (!date || (typeof window.confirm === "function" && !window.confirm("Delete all MacroBay entries for " + date + "? This removes that day's food, water, planner activity, and history record."))) return;
            if (!deleteMacroBayDay(date)) {
                if (typeof window.macrobayToast === "function") window.macrobayToast("That day could not be deleted. Check device storage and try again.", "error");
                return;
            }
            renderHistory();
            if (typeof window.macrobayToast === "function") window.macrobayToast("Day removed from MacroBay history.");
        });
    });
}


/*
 * RENDER
 */

function renderHistory() {

    if (!historyList) {
        return;
    }


    const records = getVisibleHistoryRecords(historyRange);

    historyList.innerHTML = `

        <div class="history-content">

            ${createRangeSelectorHTML()}

            ${createHistorySummaryHTML(records)}
            ${createHistoryConsistencyHTML(records)}

            ${records.length === 0 ? `
                <div class="history-empty">
                    <strong>Your history will appear here</strong>
                    <p>No records are available in this range. Try a longer range or log food, water, steps, a weigh-in, or a completed workout.</p>
                    <div class="button-row">
                        <a class="primary-btn" href="../nutrition/index.html">Log nutrition</a>
                        <a class="secondary-btn" href="../planner/index.html">Open planner</a>
                    </div>
                </div>
            ` : `
                ${createProgressChartsHTML()}
                ${createHistoryRecordsHTML(records)}
            `}

        </div>

    `;


    attachHistoryEvents();
}

function getVisibleHistoryRecords(days) {
    return getProgressRecordsForDays(days).slice().reverse();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("macrobay:data-change", function (event) {
        const key = event.detail && event.detail.key;
        if (key && [NUTRITION_KEY, PLANNER_KEY, HISTORY_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY].indexOf(key) === -1) return;
        renderHistory();
    });

    window.addEventListener("storage", function (event) {
        const relevantKeys = [NUTRITION_KEY, PLANNER_KEY, HISTORY_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY];
        if (relevantKeys.some(function (key) { return event.key === macrobayStorageKey(key); })) {
            renderHistory();
        }
    });
}


/*
 * INITIAL RENDER
 */

renderHistory();
