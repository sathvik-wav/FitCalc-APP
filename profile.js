const profileForm = document.getElementById("profile-form");
const targetForm = document.getElementById("target-form");
let currentProfile = {};
let targetEditMode = false;
let calculatorTargetHandoff = (function () {
    const values = {};
    try {
        const query = String(window.location.search || "").replace(/^\?/, "");
        const params = {};
        query.split("&").forEach(function (part) {
            if (!part) return;
            const pieces = part.split("=");
            const key = decodeURIComponent(pieces.shift().replace(/\+/g, " "));
            params[key] = decodeURIComponent(pieces.join("=").replace(/\+/g, " "));
        });
        ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
            const param = "target" + key.charAt(0).toUpperCase() + key.slice(1);
            const value = Number(params[param]);
            const maximum = { calories: 10000, protein: 1000, carbs: 1500, fat: 1000, fiber: 150 }[key];
            if (Object.prototype.hasOwnProperty.call(params, param) && Number.isFinite(value) && value >= (key === "calories" ? 500 : 0) && value <= maximum) values[key] = Math.round(value);
        });
    } catch (error) { /* The page may be running in a test sandbox without a location. */ }
    return Object.keys(values).length ? values : null;
})();

function setProfileStatus(id, message, state) {
    const status = document.getElementById(id);
    if (!status) return;
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
}

function renderProfileSummary(profile) {
    const value = profile || {};
    const name = String(value.name || "").trim();
    const nameNode = document.getElementById("profile-card-name");
    const detailsNode = document.getElementById("profile-card-details");
    const initialNode = document.getElementById("profile-avatar-initial");
    const personNode = document.getElementById("profile-avatar-person");
    const activityNode = document.getElementById("profile-card-activity");
    const goalNode = document.getElementById("profile-card-goal");
    const activityLabels = {
        sedentary: "Mostly sitting",
        light: "Lightly active",
        moderate: "Moderately active",
        active: "Very active",
        very_active: "Extremely active"
    };
    const goalLabels = { lose: "Lose weight", maintain: "Maintain weight", gain: "Gain weight" };

    if (nameNode) nameNode.textContent = name || "Your name";
    if (initialNode) {
        initialNode.textContent = name ? Array.from(name)[0].toLocaleUpperCase() : "";
        initialNode.hidden = !name;
    }
    if (personNode) personNode.hidden = !!name;

    const details = [];
    const age = Number(value.age);
    const height = Number(value.height);
    const weight = Number(value.weight);
    if (Number.isFinite(age) && age > 0) details.push(age + " years old");
    if (Number.isFinite(height) && height > 0) details.push(formatMacroBayHeight(height));
    if (Number.isFinite(weight) && weight > 0) {
        details.push(formatMacroBayWeight(weight, 1) + " " + getMacroBayWeightUnit());
    }
    if (detailsNode) detailsNode.textContent = details.join(" | ");

    const activityLabel = activityLabels[value.activity] || "";
    if (activityNode) {
        activityNode.textContent = activityLabel;
        activityNode.hidden = !activityLabel;
    }
    const goalLabel = goalLabels[value.goal] || "";
    if (goalNode) {
        goalNode.textContent = goalLabel;
        goalNode.hidden = !goalLabel;
    }
}

function applyProfileUnitControls() {
    const units = getMacroBayUnits();
    const heightMetric = document.getElementById("profile-height");
    const heightImperial = document.getElementById("profile-height-imperial");
    const heightLabel = document.getElementById("profile-height-label");
    const weightLabel = document.getElementById("profile-weight-label");
    const weightInput = document.getElementById("profile-weight");
    const feet = document.getElementById("profile-height-feet");
    const inches = document.getElementById("profile-height-inches");

    const useImperialHeight = units.height === "ft-in";
    if (heightMetric) {
        heightMetric.hidden = useImperialHeight;
        heightMetric.disabled = useImperialHeight;
        heightMetric.required = !useImperialHeight;
    }
    if (heightImperial) heightImperial.hidden = !useImperialHeight;
    [feet, inches].forEach(function (input) {
        if (input) {
            input.disabled = !useImperialHeight;
            input.required = useImperialHeight;
        }
    });
    if (heightLabel) {
        heightLabel.htmlFor = useImperialHeight ? "profile-height-feet" : "profile-height";
        heightLabel.textContent = useImperialHeight ? "Height (ft/in)" : "Height (cm)";
    }
    if (weightLabel) weightLabel.textContent = "Weight (" + units.weight + ")";
    if (weightInput) {
        weightInput.min = units.weight === "lb" ? "66.1" : "30";
        weightInput.max = units.weight === "lb" ? "661.4" : "300";
    }
}

function populateProfileForm(profile) {
    if (!profileForm) return;
    const value = profile || {};
    const units = getMacroBayUnits();
    document.getElementById("profile-name").value = value.name || "";
    document.getElementById("profile-age").value = value.age || "";
    document.getElementById("profile-sex").value = value.sex || "";
    if (units.height === "ft-in" && value.height) {
        const parts = centimetersToFeetInches(value.height);
        document.getElementById("profile-height-feet").value = parts.feet;
        document.getElementById("profile-height-inches").value = parts.inches;
        document.getElementById("profile-height").value = "";
    } else {
        document.getElementById("profile-height").value = value.height || "";
        document.getElementById("profile-height-feet").value = "";
        document.getElementById("profile-height-inches").value = "";
    }
    document.getElementById("profile-weight").value = value.weight
        ? kilogramsToDisplayWeight(value.weight).toFixed(1)
        : "";
    document.getElementById("profile-activity").value = value.activity || "";
    document.getElementById("profile-goal").value = value.goal || "";
    applyProfileUnitControls();
    renderProfileSummary(value);
}

function hasSavedProfileRecord(profile) {
    const value = profile || {};
    return ["name", "sex", "activity", "goal"].some(function (key) {
        return typeof value[key] === "string" && value[key].trim().length > 0;
    }) || ["age", "height", "weight"].some(function (key) {
        return Number.isFinite(Number(value[key])) && Number(value[key]) > 0;
    });
}

function setProfileEditMode(editing, profile) {
    if (profile) currentProfile = profile;
    const detailsCard = document.getElementById("profile-details-card");
    const editButton = document.getElementById("profile-edit");
    const cancelButton = document.getElementById("profile-cancel");
    if (detailsCard) detailsCard.hidden = !editing;
    if (editButton) editButton.hidden = !!editing;
    if (cancelButton) cancelButton.hidden = !editing;
    if (editing) populateProfileForm(currentProfile);
    else renderProfileSummary(currentProfile);
}

const profileEditButton = document.getElementById("profile-edit");
if (profileEditButton) {
    profileEditButton.addEventListener("click", function () {
        setProfileEditMode(true, currentProfile);
        const name = document.getElementById("profile-name");
        if (name) name.focus();
    });
}

const profileCancelButton = document.getElementById("profile-cancel");
if (profileCancelButton) {
    profileCancelButton.addEventListener("click", function () {
        setProfileEditMode(false, currentProfile);
    });
}

function renderTargetEditor(targets, available) {
    if (!targetForm) return;
    const list = document.getElementById("profile-target-list");
    const editButton = document.getElementById("profile-target-edit");
    targetForm.hidden = !available || !targetEditMode;
    if (list) list.hidden = !available || targetEditMode;
    if (editButton) editButton.hidden = !available || targetEditMode;
    if (!available) return;
    ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
        const input = document.getElementById("target-" + key);
        if (input) input.value = Math.round(Number(targets[key]) || 0);
    });
}

const profileTargetEditButton = document.getElementById("profile-target-edit");
if (profileTargetEditButton) {
    profileTargetEditButton.addEventListener("click", function () {
        targetEditMode = true;
        setProfileStatus("target-status", "");
        renderProfileTargets();
        const input = document.getElementById("target-calories");
        if (input) input.focus();
    });
}

const profileTargetCancelButton = document.getElementById("target-cancel");
if (profileTargetCancelButton) {
    profileTargetCancelButton.addEventListener("click", function () {
        targetEditMode = false;
        calculatorTargetHandoff = null;
        renderProfileTargets();
        setProfileStatus("target-status", "");
    });
}

function renderProfileTargets() {
    const targets = getTargets();
    const list = document.getElementById("profile-target-list");
    const empty = document.getElementById("profile-target-empty");
    if (!list || !empty) return;
    const available = Number(targets.calories) > 0;
    list.hidden = !available;
    empty.hidden = available;
    renderTargetEditor(targets, available);
    const handoffStatus = document.getElementById("calculator-handoff-status");
    if (!available) {
        if (handoffStatus && calculatorTargetHandoff) handoffStatus.textContent = "Calculator values are ready. Save your profile to enable daily target editing.";
        return;
    }
    ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
        const value = document.getElementById("profile-target-" + key);
        if (value) value.textContent = Math.round(Number(targets[key]) || 0) + (key === "calories" ? " kcal" : " g");
    });
    if (calculatorTargetHandoff) {
        Object.keys(calculatorTargetHandoff).forEach(function (key) {
            const input = document.getElementById("target-" + key);
            if (input) input.value = calculatorTargetHandoff[key];
        });
        if (handoffStatus) handoffStatus.textContent = "Calculator values are filled in below. Review and save them to apply the targets.";
    }
}

if (profileForm) {
    profileForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const units = getMacroBayUnits();
        const height = units.height === "ft-in"
            ? feetInchesToCentimeters(
                document.getElementById("profile-height-feet").value,
                document.getElementById("profile-height-inches").value
            )
            : Number(document.getElementById("profile-height").value);
        const values = {
            name: String(document.getElementById("profile-name").value || "").trim(),
            age: Number(document.getElementById("profile-age").value),
            sex: document.getElementById("profile-sex").value,
            height: height,
            weight: displayWeightToKilograms(document.getElementById("profile-weight").value),
            activity: document.getElementById("profile-activity").value,
            goal: document.getElementById("profile-goal").value
        };
        const displayWeight = Number(document.getElementById("profile-weight").value);
        const minimumWeight = units.weight === "lb" ? 66.1 : 30;
        const maximumWeight = units.weight === "lb" ? 661.4 : 300;
        const status = document.getElementById("profile-status");
        if (values.age < 18 || values.age > 100 || values.height < 100 || values.height > 250 ||
            !Number.isFinite(displayWeight) || displayWeight < minimumWeight || displayWeight > maximumWeight) {
            const heightRange = units.height === "ft-in" ? "3 ft 3 in–8 ft 2 in" : "100–250 cm";
            const weightRange = units.weight === "lb" ? "66.1 to 661.4 lb" : "30 to 300 kg";
            if (status) status.textContent = "Check the values: age 18–100, height " + heightRange + ", and weight " + weightRange + ".";
            if (status) status.dataset.state = "error";
            window.macrobayToast("Please review the highlighted profile ranges.", "error");
            return;
        }
        try {
            updateProfile(values);
            currentProfile = Object.assign({}, currentProfile, values);
            renderProfileSummary(currentProfile);
        } catch (error) {
            if (status) status.textContent = "Profile could not be saved. Check device storage and try again.";
            window.macrobayToast("Profile could not be saved.", "error");
            return;
        }
        const targetsSaved = typeof refreshTargets !== "function" || refreshTargets();
        renderProfileTargets();
        setProfileEditMode(false, currentProfile);
        if (!targetsSaved) {
            if (status) status.textContent = "Profile saved, but estimated targets could not be saved. Check device storage and try again.";
            window.macrobayToast("Profile saved, but targets could not be updated.", "error");
            return;
        }
        if (status) status.textContent = "Profile and estimated targets saved on this device.";
        if (status) delete status.dataset.state;
        window.macrobayToast("Profile saved.");
    });
}

const savedProfile = getProfile();
currentProfile = savedProfile || {};
populateProfileForm(currentProfile);
setProfileEditMode(!hasSavedProfileRecord(currentProfile), currentProfile);
document.addEventListener("DOMContentLoaded", renderProfileTargets);

if (targetForm) {
    targetForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const values = {};
        ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
            values[key] = document.getElementById("target-" + key).value;
        });
        if (!saveTargetOverrides(values)) {
            setProfileStatus("target-status", "Targets could not be saved. Check the allowed ranges and device storage.", "error");
            window.macrobayToast("Targets could not be saved.", "error");
            return;
        }
        calculatorTargetHandoff = null;
        targetEditMode = false;
        const handoffStatus = document.getElementById("calculator-handoff-status");
        if (handoffStatus) handoffStatus.textContent = "";
        renderProfileTargets();
        setProfileStatus("target-status", "Your daily targets were saved.");
        window.macrobayToast("Daily targets updated.");
    });
}

const resetTargetsButton = document.getElementById("reset-targets");
if (resetTargetsButton) {
    resetTargetsButton.addEventListener("click", function () {
        if (!resetTargetOverrides()) {
            setProfileStatus("target-status", "Estimated targets could not be restored. Check device storage.", "error");
            window.macrobayToast("Estimated targets could not be restored.", "error");
            return;
        }
        targetEditMode = false;
        calculatorTargetHandoff = null;
        renderProfileTargets();
        setProfileStatus("target-status", "Targets reset to the calculated estimates from your profile.");
        window.macrobayToast("Profile target estimates restored.");
    });
}
