/*
 * Target engine. Pure functions + refreshTargets().
 * profile -> BMR -> TDEE -> goal adjustment -> targets (saved to macrobay_targets)
 */
const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9
};
const EDITABLE_TARGET_FIELDS = ["calories", "protein", "carbs", "fat", "fiber"];
const TARGET_FIELD_LIMITS = {
    calories: [500, 10000],
    protein: [0, 1000],
    carbs: [0, 1500],
    fat: [0, 1000],
    fiber: [0, 150]
};

function calculateBMR(profile) {
    const base = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age;
    if (profile.sex === "male") return base + 5;
    if (profile.sex === "female") return base - 161;
    return 0;
}

function calculateTDEE(bmr, activity) {
    return bmr * (ACTIVITY_MULTIPLIERS[activity] || 1.2);
}

function calculateCalorieTarget(tdee, goal, sex) {
    const adjusted = tdee + (GOAL_ADJUSTMENT[goal] || 0);
    const floor = CALORIE_FLOOR[sex] || 1200;
    return Math.max(adjusted, floor);
}

function calculateProteinTarget(profile) {
    const perKg = { lose: 2.0, maintain: 1.6, gain: 1.8 };
    return profile.weight * (perKg[profile.goal] || 1.6);
}

function computeTargets(profile) {
    const bmr = calculateBMR(profile);
    const tdee = calculateTDEE(bmr, profile.activity);
    const calories = calculateCalorieTarget(tdee, profile.goal, profile.sex);
    const protein = calculateProteinTarget(profile);
    const fat = profile.weight * 0.8;
    const carbs = Math.max((calories - protein * 4 - fat * 9) / 4, 0);
    return {
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        fiber: Math.round(calories * 14 / 1000),
        bmr: Math.round(bmr),
        tdee: Math.round(tdee)
    };
}

function isCompleteTargetProfile(profile) {
    return !!(profile && profile.sex && profile.age && profile.height && profile.weight && profile.activity && profile.goal);
}

function normalizeTargetOverrides(overrides) {
    const normalized = {};
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return normalized;
    EDITABLE_TARGET_FIELDS.forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(overrides, field)) return;
        const value = Number(overrides[field]);
        const bounds = TARGET_FIELD_LIMITS[field];
        if (Number.isFinite(value) && value >= bounds[0] && value <= bounds[1]) {
            normalized[field] = Math.round(value);
        }
    });
    return normalized;
}

function applyTargetOverrides(computedTargets, overrides) {
    const normalized = normalizeTargetOverrides(overrides);
    const targets = Object.assign({}, computedTargets, normalized);
    if (Object.keys(normalized).length) targets.overrides = normalized;
    return targets;
}

function saveTargetRecord(targets) {
    try {
        writeJSON(TARGETS_KEY, targets);
        if (typeof announceDataChange === "function") {
            announceDataChange(getDateKey(new Date()), TARGETS_KEY);
        }
        return true;
    } catch (error) {
        return false;
    }
}

function saveTargetOverrides(values) {
    const profile = getProfile();
    if (!isCompleteTargetProfile(profile)) return false;
    const existing = getTargets();
    const overrides = normalizeTargetOverrides(existing.overrides);
    let valid = true;
    EDITABLE_TARGET_FIELDS.forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(values || {}, field)) return;
        const value = Number(values[field]);
        const bounds = TARGET_FIELD_LIMITS[field];
        if (!Number.isFinite(value) || value < bounds[0] || value > bounds[1]) {
            valid = false;
            return;
        }
        overrides[field] = Math.round(value);
    });
    if (!valid) return false;
    return saveTargetRecord(applyTargetOverrides(computeTargets(profile), overrides));
}

function resetTargetOverrides() {
    const profile = getProfile();
    if (!isCompleteTargetProfile(profile)) return false;
    return saveTargetRecord(computeTargets(profile));
}

// Uses the water calculator's body-weight and recorded-duration formula. The
// app has no climate setting, so the formula's temperate-climate baseline is used.
function getWaterGoalLiters(profile, planner) {
    const currentProfile = profile || getProfile();
    const weightKg = Number(currentProfile.weight);
    if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

    const currentPlanner = planner || {};
    const workouts = Array.isArray(currentPlanner.workouts) ? currentPlanner.workouts : [];
    let exerciseMinutes = 0;
    workouts.forEach(function (workout) {
        (Array.isArray(workout && workout.exercises) ? workout.exercises : []).forEach(function (exercise) {
            (Array.isArray(exercise && exercise.sets) ? exercise.sets : []).forEach(function (set) {
                const minutes = Number(set && set.durationMinutes);
                if (Number.isFinite(minutes) && minutes > 0) exerciseMinutes += minutes;
            });
        });
    });

    const liters = weightKg * 0.033 + (exerciseMinutes / 30) * 0.35;
    return Math.round(liters * 100) / 100;
}

function refreshTargets() {
    const p = getProfile();
    if (!isCompleteTargetProfile(p)) return false;
    const existing = getTargets();
    const refreshed = applyTargetOverrides(computeTargets(p), existing.overrides);
    if (JSON.stringify(existing) === JSON.stringify(refreshed)) return true;
    return saveTargetRecord(refreshed);
}

if (typeof document !== "undefined" && document.body && !document.body.hasAttribute("data-calc")) { refreshTargets(); }
if (typeof module !== "undefined") { module.exports = { computeTargets, calculateBMR, calculateTDEE, calculateCalorieTarget, getWaterGoalLiters }; }
