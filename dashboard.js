/*
 * Dashboard only READS shared state (store.js). No duplicate storage code.
 */
function getDashboardNutrition() { return getNutritionFor(getDateKey(new Date())); }
function getDashboardTargets() { return getTargets(); }
function getDashboardPlanner() { return getPlannerFor(getDateKey(new Date())); }


/*
 * NUMBER HELPERS
 */

function dashboardNumber(value) {

    return Number(value) || 0;

}


function dashboardPercentage(
    current,
    target
) {

    const currentValue =
        dashboardNumber(current);

    const targetValue =
        dashboardNumber(target);


    if (targetValue <= 0) {

        return 0;

    }


    return Math.max(0, Math.min((currentValue / targetValue) * 100, 100));
}


/*
 * DAILY PROGRESS
 */

function getDashboardDailyProgress() {

    const nutrition =
        getDashboardNutrition();

    const targets =
        getDashboardTargets();

    const planner =
        getDashboardPlanner();


    const metrics = [];
    const calorieTarget = dashboardNumber(targets.calories);
    if (calorieTarget > 0) metrics.push(Math.max(0, 100 - Math.abs(1 - dashboardNumber(nutrition.calories) / calorieTarget) * 100));
    ["protein", "carbs", "fat", "fiber"].forEach(function (key) {
        if (dashboardNumber(targets[key]) > 0) metrics.push(dashboardPercentage(nutrition[key], targets[key]));
    });
    const waterGoal = getWaterGoalLiters(getProfile(), planner);
    if (waterGoal) metrics.push(dashboardPercentage(nutrition.water, waterGoal));
    metrics.push(dashboardPercentage(planner.steps, STEPS_GOAL));
    const workouts = Array.isArray(planner.workouts) ? planner.workouts : [];
    const tasks = Array.isArray(planner.tasks) ? planner.tasks : [];
    if (workouts.length) metrics.push(dashboardPercentage(workouts.filter(function (w) { return w && w.completed; }).length, workouts.length));
    if (tasks.length) metrics.push(dashboardPercentage(tasks.filter(function (t) { return t && t.completed === true; }).length, tasks.length));
    return metrics.length ? Math.round(metrics.reduce(function (sum, value) { return sum + value; }, 0) / metrics.length) : 0;
}


/*
 * UPDATE TEXT + BARS
 * (the HTML already has the "/" and the units, so each span gets just one value)
 */

function setDashboardText(id, text) {
    const el = document.getElementById(id);
    if (el) { el.textContent = text; }
}

function setDashboardBar(id, percent) {
    const el = document.getElementById(id);
    if (el) {
        const value = Math.round(percent);
        el.style.width = value + "%";
        const meter = el.closest('[role="progressbar"]');
        if (meter) {
            meter.setAttribute("aria-valuenow", String(value));
            if (meter.classList && meter.classList.contains("home-ring") && meter.style && typeof meter.style.setProperty === "function") {
                meter.style.setProperty("--ring-progress", value + "%");
            }
        }
    }
}

function dashboardCalorieProgress(eaten, target) {
    const t = dashboardNumber(target);
    if (t <= 0) { return 0; }
    return Math.max(0, 100 - Math.abs(1 - dashboardNumber(eaten) / t) * 100);
}

function updateDashboardText() {
    const n = getDashboardNutrition();
    const t = getDashboardTargets();
    const p = getDashboardPlanner();
    const r = function (v) { return Math.round(dashboardNumber(v)).toLocaleString(); };
    const target = function (v) { return dashboardNumber(v) > 0 ? r(v) : "—"; };

    setDashboardText("terminal-calories", r(n.calories));
    setDashboardText("terminal-calorie-target", target(t.calories));
    setDashboardText("terminal-protein", r(n.protein));
    setDashboardText("terminal-protein-target", target(t.protein));
    setDashboardText("terminal-carbs", r(n.carbs));
    setDashboardText("terminal-carbs-target", target(t.carbs));
    setDashboardText("terminal-fat", r(n.fat));
    setDashboardText("terminal-fat-target", target(t.fat));
    setDashboardText("terminal-fiber", r(n.fiber));
    setDashboardText("terminal-fiber-target", target(t.fiber));
    setDashboardText("terminal-water", dashboardNumber(n.water).toFixed(2));
    const waterGoal = getWaterGoalLiters(getProfile(), p);
    setDashboardText("terminal-water-target", waterGoal ? waterGoal.toFixed(1) : "—");
    setDashboardText("terminal-steps", r(p.steps));
    setDashboardText("terminal-steps-goal", r(STEPS_GOAL));

    const workouts = Array.isArray(p.workouts)
        ? p.workouts.filter(function (workout) { return workout && typeof workout === "object"; })
        : [];
    const tasks = Array.isArray(p.tasks) ? p.tasks : [];
    const completedWorkouts = workouts.filter(function (w) { return w && w.completed; }).length;
    setDashboardText("terminal-workout",
        completedWorkouts + " / " + workouts.length + " complete");
    setDashboardText("terminal-workout-name", workouts.map(function (w) {
        const name = String(w && w.name || "Workout");
        return name + (w && w.completed ? " · done" : " · planned");
    }).join(", ") || "None planned");
    setDashboardText("terminal-tasks",
        tasks.filter(function (x) { return x && x.completed === true; }).length + " / " + tasks.length + " complete");

    const workoutSummary = document.getElementById("home-workout-summary");
    const workoutEmpty = document.getElementById("home-workout-empty");
    if (workoutSummary) workoutSummary.hidden = workouts.length === 0;
    if (workoutEmpty) workoutEmpty.hidden = workouts.length > 0;

    setDashboardBar("terminal-calorie-progress", dashboardCalorieProgress(n.calories, t.calories));
    setDashboardBar("terminal-protein-progress", dashboardPercentage(n.protein, t.protein));
    setDashboardBar("terminal-carbs-progress", dashboardPercentage(n.carbs, t.carbs));
    setDashboardBar("terminal-fat-progress", dashboardPercentage(n.fat, t.fat));
    setDashboardBar("terminal-fiber-progress", dashboardPercentage(n.fiber, t.fiber));
    setDashboardBar("terminal-water-progress", waterGoal ? dashboardPercentage(n.water, waterGoal) : 0);
    setDashboardBar("terminal-steps-progress", dashboardPercentage(p.steps, STEPS_GOAL));
}

function updateDashboardProgress() {
    const progress = getDashboardDailyProgress();
    setDashboardText("terminal-daily-progress", progress + "%");
    setDashboardBar("terminal-daily-progress-bar", progress);
    const meter = document.querySelector(".daily-progress-track[role='progressbar']");
    if (meter) meter.setAttribute("aria-valuenow", String(progress));
}


/*
 * PRIORITY
 */

function updateDashboardPriority() {
    if (typeof displayAdaptivePlan === "function") { displayAdaptivePlan(); }
}

function updateHomeGreeting(now) {
    const date = now || new Date();
    const hour = date.getHours();
    const period = hour >= 5 && hour < 12 ? "morning" :
        (hour >= 12 && hour < 17 ? "afternoon" :
            (hour >= 17 && hour < 21 ? "evening" : "night"));
    const greetings = { morning: "Good morning,", afternoon: "Good afternoon,", evening: "Good evening,", night: "Good night," };
    const greeting = greetings[period];
    setDashboardText("home-greeting-label", greeting);
    const icon = document.getElementById("home-greeting-icon");
    if (icon) icon.dataset.period = period;

    const profile = getProfile();
    const name = String(profile.name || "there").trim();
    setDashboardText("home-user-name", name || "there");
}

const homeMotivations = [
    "Small steps still move you forward.",
    "Show up for the next choice.",
    "Consistency beats perfection.",
    "Give yourself credit for starting."
];
let homeMotivationIndex = 0;
const homeGreetingButton = document.getElementById("home-greeting");
if (homeGreetingButton) {
    homeGreetingButton.addEventListener("click", function () {
        homeMotivationIndex = (homeMotivationIndex + 1) % homeMotivations.length;
        setDashboardText("home-motivation", homeMotivations[homeMotivationIndex]);
    });
}

function updateHomeWeightCard() {
    const profile = getProfile();
    const records = typeof getProgressRecordsForDays === "function"
        ? getProgressRecordsForDays(7).filter(function (record) {
            return record && record.weight !== null && record.weight !== undefined && Number.isFinite(Number(record.weight));
        })
        : [];
    const profileWeight = Number(profile.weight);
    const currentWeight = Number.isFinite(profileWeight) && profileWeight > 0
        ? profileWeight
        : (records.length ? Number(records[records.length - 1].weight) : null);
    const weightValue = document.getElementById("home-weight-value");
    const weightUnit = document.getElementById("home-weight-unit");
    if (weightValue) weightValue.textContent = currentWeight === null ? "—" : formatFitCalcWeight(currentWeight, 1);
    if (weightUnit) weightUnit.textContent = getFitCalcWeightUnit();

    const changeLabel = document.getElementById("home-weight-change");
    if (changeLabel) {
        if (records.length >= 2) {
            const change = Number(records[records.length - 1].weight) - Number(records[0].weight);
            changeLabel.textContent = Math.abs(change) < 0.05
                ? "No change this week"
                : (change > 0 ? "+" : "−") + formatFitCalcWeight(Math.abs(change), 1) + " " + getFitCalcWeightUnit() + " this week";
        } else {
            changeLabel.textContent = "Log another weigh-in to see your weekly change.";
        }
    }

    const line = document.getElementById("home-weight-sparkline-line");
    if (line) {
        const values = records.map(function (record) { return Number(record.weight); });
        line.style.display = values.length > 1 ? "" : "none";
        if (values.length > 1) {
            const minimum = Math.min.apply(null, values);
            const maximum = Math.max.apply(null, values);
            const spread = maximum - minimum || 1;
            const points = values.map(function (value, index) {
                const x = index / (values.length - 1) * 120;
                const y = 38 - ((value - minimum) / spread) * 30;
                return x.toFixed(1) + "," + y.toFixed(1);
            }).join(" ");
            line.setAttribute("points", points);
            const chart = line.closest("svg");
            if (chart) chart.setAttribute("aria-label", "Weight trend from " + formatFitCalcWeight(values[0], 1) + " to " + formatFitCalcWeight(values[values.length - 1], 1) + " " + getFitCalcWeightUnit() + " over the last seven days");
        } else {
            line.setAttribute("points", "");
            const chart = line.closest("svg");
            if (chart) chart.setAttribute("aria-label", "No weight trend recorded in the last seven days");
        }
    }
}


/*
 * INITIALIZE
 */

function updateDashboard() {

    updateDashboardText();

    updateDashboardProgress();

    updateDashboardPriority();
    updateHomeGreeting();
    updateHomeWeightCard();

    const date = document.getElementById("today-date");
    if (date) {
        const now = new Date();
        date.textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
        date.dateTime = getDateKey(now);
    }

    const setup = document.getElementById("dashboard-profile-setup");
    if (setup) setup.hidden = dashboardNumber(getDashboardTargets().calories) > 0;

}


updateDashboard();


/*
 * REFRESH WHEN RETURNING TO PAGE
 */

window.addEventListener(
    "focus",
    function () {

        updateDashboard();

    }
);


window.addEventListener(
    "storage",
    function () {

        updateDashboard();

    }
);

window.addEventListener("fitcalc:data-change", updateDashboard);
if (document && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") updateDashboard();
    });
}
