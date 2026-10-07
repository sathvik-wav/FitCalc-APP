function getRemainingTargets() {
    const key = getDateKey(new Date());
    const t = getTargets(), n = getNutritionFor(key), p = getPlannerFor(key);
    const left = function (target, now) { return Math.max((Number(target) || 0) - (Number(now) || 0), 0); };
    const calorieTarget = Number(t.calories) || 0;
    const caloriesLogged = Number(n.calories) || 0;
    const waterGoal = getWaterGoalLiters(getProfile(), p);
    return {
        calories: left(calorieTarget, caloriesLogged),
        caloriesOver: Math.max(caloriesLogged - calorieTarget, 0),
        calorieTarget: calorieTarget,
        protein: left(t.protein, n.protein),
        water: waterGoal === null ? null : left(waterGoal, n.water),
        steps: left(STEPS_GOAL, p.steps),
        hasTargets: Number(t.calories) > 0
    };
}

function getWorkoutProgressionInsights() {
    const history = readJSON(HISTORY_KEY, {});
    const today = getDateKey(new Date());
    const records = Object.keys(history).filter(function (date) { return date <= today; }).sort().map(function (date) {
        return { date: date, record: history[date] };
    });
    const exposures = {};
    records.forEach(function (entry) {
        const record = entry.record;
        if (!record || typeof record !== "object") return;
        (Array.isArray(record.workouts) ? record.workouts : []).forEach(function (workout) {
            if (!workout || workout.completed !== true) return;
            (Array.isArray(workout.exercises) ? workout.exercises : []).forEach(function (exercise) {
                if (!exercise || typeof exercise !== "object") return;
                const name = String(exercise.name || "").trim();
                const sets = Array.isArray(exercise.sets) ? exercise.sets.filter(function (set) {
                    return set && typeof set === "object";
                }) : [];
                if (!name || !sets.length) return;
                const timed = sets.filter(function (set) { return Number(set.durationMinutes) > 0; });
                const loaded = sets.filter(function (set) { return Number(set.reps) > 0; });
                let signature;
                let summary;
                if (timed.length && !loaded.length) {
                    const best = Math.max.apply(null, timed.map(function (set) { return Number(set.durationMinutes); }));
                    signature = "time:" + best;
                    summary = best + " min";
                } else if (loaded.length) {
                    const best = loaded.reduce(function (current, set) {
                        const score = Number(set.weight || 0) * 100000 + Number(set.reps || 0);
                        return score > current.score ? { score: score, set: set } : current;
                    }, { score: -1, set: loaded[0] }).set;
                    signature = "load:" + Number(best.weight || 0) + ":reps:" + Number(best.reps || 0);
                    summary = formatMacroBayWeight(best.weight || 0) + " " + getMacroBayWeightUnit() + " × " + Number(best.reps || 0);
                }
                if (!signature) return;
                const key = name.toLowerCase();
                if (!exposures[key]) exposures[key] = { name: name, rows: [] };
                const rows = exposures[key].rows;
                const exposure = { date: entry.date, signature: signature, summary: summary };
                if (rows.length && rows[rows.length - 1].date === record.date) rows[rows.length - 1] = exposure;
                else rows.push(exposure);
            });
        });
    });
    return Object.keys(exposures).map(function (key) {
        const item = exposures[key];
        const last = item.rows.slice(-3);
        if (last.length === 3 && last.every(function (row) { return row.signature === last[0].signature; })) {
            return "Review progression for " + item.name + ": its top logged set has stayed at " + last[0].summary + " across three sessions.";
        }
        return null;
    }).filter(Boolean).slice(0, 2);
}

function adaptiveRecordHasActivity(record) {
    return isProgressMetricLogged(record, "calories") ||
        isProgressMetricLogged(record, "water") ||
        isProgressMetricLogged(record, "steps") ||
        record.weight !== null ||
        Number(record.completedWorkouts) > 0 ||
        Number(record.completedTasks) > 0;
}

function getAdaptiveHistoryInsights() {
    const records = getProgressRecordsForDays(14);
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const todayKey = getDateKey(today);
    const weekStartKey = getDateKey(weekStart);
    const recentWeek = records.filter(function (record) {
        return record.date >= weekStartKey && record.date <= todayKey;
    });
    const insights = [];
    const profile = getProfile();

    const weights = records.filter(function (record) {
        return record.weight !== null && Number.isFinite(Number(record.weight));
    });
    if (weights.length >= 2) {
        const first = weights[0];
        const last = weights[weights.length - 1];
        const elapsed = (new Date(last.date + "T00:00:00Z") - new Date(first.date + "T00:00:00Z")) / 86400000;
        if (elapsed >= 6) {
            const change = Number(last.weight) - Number(first.weight);
            const goal = profile.goal;
            const isCounterToGoal = (goal === "lose" && change >= 0.3) ||
                (goal === "gain" && change <= -0.3) ||
                (goal === "maintain" && Math.abs(change) >= 0.8);
            if (isCounterToGoal) {
                insights.push("Your weight trend moved " + (change > 0 ? "up " : "down ") + formatMacroBayWeight(Math.abs(change)) + " " + getMacroBayWeightUnit() + " over " + Math.round(elapsed) + " days. Review the trend alongside your goal and recent logging.");
            }
        }
    }

    const targetProtein = Number(getTargets().protein) || 0;
    const proteinDays = recentWeek.filter(function (record) { return isProgressMetricLogged(record, "protein"); });
    if (targetProtein > 0 && proteinDays.length >= 3) {
        const average = proteinDays.reduce(function (sum, record) { return sum + Number(record.protein); }, 0) / proteinDays.length;
        if (average < targetProtein * 0.8) {
            insights.push("Protein has averaged " + Math.round(average) + "g on logged days this week, below 80% of your current target.");
        }
    }

    const stepDays = recentWeek.filter(function (record) { return isProgressMetricLogged(record, "steps"); });
    if (stepDays.length >= 3) {
        const averageSteps = stepDays.reduce(function (sum, record) { return sum + Number(record.steps); }, 0) / stepDays.length;
        if (averageSteps < STEPS_GOAL * 0.7) {
            insights.push("Steps have averaged " + Math.round(averageSteps).toLocaleString() + " on logged days this week. A short walk can help you move toward your usual goal.");
        }
    }

    const activeDays = recentWeek.filter(adaptiveRecordHasActivity).length;
    if (activeDays >= 3) {
        const loggedNutritionDays = recentWeek.filter(function (record) {
            return isProgressMetricLogged(record, "calories") || isProgressMetricLogged(record, "water");
        }).length;
        const loggedStepDays = recentWeek.filter(function (record) { return isProgressMetricLogged(record, "steps"); }).length;
        const completedSessions = recentWeek.reduce(function (sum, record) { return sum + (Number(record.completedWorkouts) || 0); }, 0);
        insights.push("7-day review: activity logged on " + activeDays + " days; nutrition on " + loggedNutritionDays + ", steps on " + loggedStepDays + ", and " + completedSessions + " workouts completed.");
    }

    const streakDate = new Date();
    const history = getProgressHistoryStorage();
    let streak = 0;
    const streakTodayKey = getDateKey(streakDate);
    // If today has no activity yet, count back from yesterday so a morning check-in
    // does not make an existing logging streak look broken.
    if (!adaptiveRecordHasActivity(getProgressRecord(streakTodayKey) || normalizeProgressRecord(streakTodayKey, {}))) {
        streakDate.setDate(streakDate.getDate() - 1);
    }
    for (let offset = 0; offset < 30; offset += 1) {
        const key = getDateKey(streakDate);
        const record = history[key] ? normalizeProgressRecord(key, history[key]) : null;
        if (!record || !adaptiveRecordHasActivity(record)) break;
        streak += 1;
        streakDate.setDate(streakDate.getDate() - 1);
    }
    if (streak >= 3) insights.push("You logged activity on " + (streak === 30 ? "30+" : streak) + " consecutive days. Keep the routine flexible and sustainable.");

    return insights.slice(0, 5);
}

function getAdaptivePlan() {
    const r = getRemainingTargets();
    const out = [];
    if (!r.hasTargets) return ["Set up your profile to get daily targets."];
    if (r.protein > 20) out.push("Prioritize protein. About " + Math.round(r.protein) + "g remains.");
    const calorieTolerance = r.calorieTarget * 0.1;
    if (r.caloriesOver > calorieTolerance) {
        out.push("You are about " + Math.round(r.caloriesOver) + " kcal over your target. No need to eat more to reach it.");
    } else if (r.calories > calorieTolerance) {
        out.push("You have about " + Math.round(r.calories) + " kcal remaining.");
    } else {
        out.push("Calories are near target. No need for extra food.");
    }
    if (r.water !== null && r.water > 0.5) out.push("About " + r.water.toFixed(1) + "L remains toward your estimated water goal.");
    if (r.steps > 1000) out.push("You have about " + Math.round(r.steps) + " steps remaining.");
    getAdaptiveHistoryInsights().forEach(function (insight) { out.push(insight); });
    getWorkoutProgressionInsights().forEach(function (insight) { out.push(insight); });
    return out;
}

function displayAdaptivePlan() {
    const suggestions = getAdaptivePlan();

    const container =
        document.getElementById("adaptive-suggestions");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (suggestions.length === 0) {
        container.innerHTML =
            "<p>Your logged nutrition and activity are on track.</p>";

        return;
    }
    suggestions.forEach(function (suggestion) {
        const item = document.createElement("p");

        item.textContent = suggestion;

        container.appendChild(item);
    });
}


function setupAdaptiveToggle() {
    const toggle =
        document.getElementById("adaptive-toggle");

    const panel =
        document.getElementById("adaptive-panel");

    if (!toggle || !panel) {
        return;
    }

    toggle.addEventListener("click", function () {
        const isOpen =
            toggle.getAttribute("aria-expanded") === "true";

        toggle.setAttribute(
            "aria-expanded",
            String(!isOpen)
        );

        panel.hidden = isOpen;

    });
}


displayAdaptivePlan();
setupAdaptiveToggle();
