"use strict";

function populateUnitPreferences() {
    const form = document.getElementById("unit-preferences-form");
    if (!form || typeof getFitCalcUnits !== "function") return;
    const units = getFitCalcUnits();
    const weight = document.getElementById("unit-weight");
    const height = document.getElementById("unit-height");
    if (weight) weight.value = units.weight;
    if (height) height.value = units.height;
}

function populateSettingsPreferences() {
    populateUnitPreferences();
    const theme = document.getElementById("settings-theme");
    if (!theme || typeof getFitCalcPreferences !== "function") return;
    const preference = getFitCalcPreferences().theme;
    theme.value = preference === "light" || preference === "dark" || preference === "system" ? preference : "system";
}

function setDataManagementStatus(message) {
    const status = document.getElementById("data-management-status");
    if (status) status.textContent = message;
}

function updateAfterDataRestore() {
    populateSettingsPreferences();
    if (typeof window.fitcalcApplyThemePreference === "function") {
        const preferences = typeof getFitCalcPreferences === "function" ? getFitCalcPreferences() : {};
        window.fitcalcApplyThemePreference(preferences.theme || "system");
    }
    if (typeof populateProfileForm === "function" && typeof getProfile === "function") {
        populateProfileForm(getProfile());
    }
    if (typeof renderProfileTargets === "function") renderProfileTargets();
}

const unitPreferencesForm = document.getElementById("unit-preferences-form");
if (unitPreferencesForm) {
    unitPreferencesForm.addEventListener("submit", function (event) {
        event.preventDefault();
        try {
            saveFitCalcPreferences({ units: {
                weight: document.getElementById("unit-weight").value,
                height: document.getElementById("unit-height").value
            } });
            if (typeof populateProfileForm === "function" && typeof getProfile === "function") {
                populateProfileForm(getProfile());
            }
            const status = document.getElementById("unit-status");
            if (status) status.textContent = "Display units saved. Stored measurements remain unchanged.";
            if (typeof announceDataChange === "function") announceDataChange(getDateKey(new Date()), PREFERENCES_KEY);
            if (window.fitcalcToast) window.fitcalcToast("Display units updated.");
        } catch (error) {
            const status = document.getElementById("unit-status");
            if (status) {
                status.textContent = "Unit preferences could not be saved. Check device storage and try again.";
                status.dataset.state = "error";
            }
            if (window.fitcalcToast) window.fitcalcToast("Unit preferences could not be saved.", "error");
        }
    });
}

const themePreferenceSelect = document.getElementById("settings-theme");
if (themePreferenceSelect) {
    themePreferenceSelect.addEventListener("change", function () {
        try {
            saveFitCalcPreferences({ theme: themePreferenceSelect.value });
            if (typeof window.fitcalcApplyThemePreference === "function") {
                window.fitcalcApplyThemePreference(themePreferenceSelect.value);
            }
            if (typeof announceDataChange === "function") announceDataChange(getDateKey(new Date()), PREFERENCES_KEY);
            const status = document.getElementById("settings-theme-status");
            if (status) status.textContent = "Appearance preference saved.";
        } catch (error) {
            const status = document.getElementById("settings-theme-status");
            if (status) {
                status.textContent = "Appearance could not be saved. Check device storage and try again.";
                status.dataset.state = "error";
            }
        }
    });
}

const exportDataButton = document.getElementById("export-data");
if (exportDataButton) {
    exportDataButton.addEventListener("click", function () {
        try {
            const backup = exportFitCalcData();
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "fitcalc-backup-" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
            setDataManagementStatus("Backup downloaded. Keep the JSON file somewhere safe.");
            if (window.fitcalcToast) window.fitcalcToast("FitCalc backup downloaded.");
        } catch (error) {
            setDataManagementStatus(error.message || "Could not create a backup.");
            if (window.fitcalcToast) window.fitcalcToast("Could not create the backup.", "error");
        }
    });
}

const importDataInput = document.getElementById("import-data-file");
if (importDataInput) {
    importDataInput.addEventListener("change", async function () {
        const file = importDataInput.files && importDataInput.files[0];
        if (!file) return;
        try {
            const backup = JSON.parse(await file.text());
            validateFitCalcBackup(backup);
            const confirmed = window.fitcalcDialog
                ? await window.fitcalcDialog.confirm(
                    "Importing this backup replaces FitCalc data saved on this device. Continue?",
                    "Replace saved data",
                    "Import backup"
                )
                : window.confirm("Importing this backup replaces FitCalc data saved on this device. Continue?");
            if (!confirmed) return;
            importFitCalcData(backup);
            updateAfterDataRestore();
            setDataManagementStatus("Backup restored successfully.");
            if (window.fitcalcToast) window.fitcalcToast("FitCalc backup restored.");
        } catch (error) {
            const message = error && error.message ? error.message : "Could not read this backup.";
            setDataManagementStatus(message);
            if (window.fitcalcToast) window.fitcalcToast(message, "error");
        } finally {
            importDataInput.value = "";
        }
    });
}

const resetDataButton = document.getElementById("reset-data");
if (resetDataButton) {
    resetDataButton.addEventListener("click", async function () {
        const confirmed = window.fitcalcDialog
            ? await window.fitcalcDialog.confirm(
                "This permanently removes your profile, targets, nutrition, planner, workouts, history, templates, and preferences from this device.",
                "Reset FitCalc data",
                "Delete data"
            )
            : window.confirm("Permanently delete all FitCalc data saved on this device?");
        if (!confirmed) return;
        try {
            resetFitCalcData();
            updateAfterDataRestore();
            setDataManagementStatus("FitCalc data was removed from this device.");
            if (window.fitcalcToast) window.fitcalcToast("FitCalc data reset.");
        } catch (error) {
            const message = error && error.message ? error.message : "Could not reset FitCalc data.";
            setDataManagementStatus(message);
            if (window.fitcalcToast) window.fitcalcToast(message, "error");
        }
    });
}

populateSettingsPreferences();
