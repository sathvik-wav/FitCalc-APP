"use strict";

function populateUnitPreferences() {
    const form = document.getElementById("unit-preferences-form");
    if (!form || typeof getMacroBayUnits !== "function") return;
    const units = getMacroBayUnits();
    const weight = document.getElementById("unit-weight");
    const height = document.getElementById("unit-height");
    if (weight) weight.value = units.weight;
    if (height) height.value = units.height;
}

function populateSettingsPreferences() {
    populateUnitPreferences();
    const preferences = typeof getMacroBayPreferences === "function" ? getMacroBayPreferences() : {};
    const usdaKey = document.getElementById("usda-api-key");
    if (usdaKey) usdaKey.value = preferences.usdaApiKey || "";
    const theme = document.getElementById("settings-theme");
    if (!theme || typeof getMacroBayPreferences !== "function") return;
    const preference = preferences.theme;
    theme.value = preference === "light" || preference === "dark" || preference === "system" ? preference : "system";
}

const usdaKeyForm = document.getElementById("usda-key-form");
if (usdaKeyForm) {
    usdaKeyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const value = document.getElementById("usda-api-key").value.trim();
        try {
            saveMacroBayPreferences({ usdaApiKey: value });
            const status = document.getElementById("usda-key-status");
            if (status) status.textContent = value ? "USDA search key saved on this device." : "USDA search key cleared.";
            if (typeof announceDataChange === "function") announceDataChange(getDateKey(new Date()), PREFERENCES_KEY);
        } catch (error) {
            const status = document.getElementById("usda-key-status");
            if (status) {
                status.textContent = "The key could not be saved. Check device storage and try again.";
                status.dataset.state = "error";
            }
        }
    });
}

const clearUsdaKeyButton = document.getElementById("clear-usda-key");
if (clearUsdaKeyButton) {
    clearUsdaKeyButton.addEventListener("click", function () {
        const input = document.getElementById("usda-api-key");
        if (input) input.value = "";
        saveMacroBayPreferences({ usdaApiKey: "" });
        const status = document.getElementById("usda-key-status");
        if (status) status.textContent = "USDA search key cleared.";
        if (typeof announceDataChange === "function") announceDataChange(getDateKey(new Date()), PREFERENCES_KEY);
    });
}

function setDataManagementStatus(message) {
    const status = document.getElementById("data-management-status");
    if (status) status.textContent = message;
}

function updateAfterDataRestore() {
    populateSettingsPreferences();
    if (typeof window.macrobayApplyThemePreference === "function") {
        const preferences = typeof getMacroBayPreferences === "function" ? getMacroBayPreferences() : {};
        window.macrobayApplyThemePreference(preferences.theme || "system");
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
            saveMacroBayPreferences({ units: {
                weight: document.getElementById("unit-weight").value,
                height: document.getElementById("unit-height").value
            } });
            if (typeof populateProfileForm === "function" && typeof getProfile === "function") {
                populateProfileForm(getProfile());
            }
            const status = document.getElementById("unit-status");
            if (status) status.textContent = "Display units saved. Stored measurements remain unchanged.";
            if (typeof announceDataChange === "function") announceDataChange(getDateKey(new Date()), PREFERENCES_KEY);
            if (window.macrobayToast) window.macrobayToast("Display units updated.");
        } catch (error) {
            const status = document.getElementById("unit-status");
            if (status) {
                status.textContent = "Unit preferences could not be saved. Check device storage and try again.";
                status.dataset.state = "error";
            }
            if (window.macrobayToast) window.macrobayToast("Unit preferences could not be saved.", "error");
        }
    });
}

const themePreferenceSelect = document.getElementById("settings-theme");
if (themePreferenceSelect) {
    themePreferenceSelect.addEventListener("change", function () {
        try {
            saveMacroBayPreferences({ theme: themePreferenceSelect.value });
            if (typeof window.macrobayApplyThemePreference === "function") {
                window.macrobayApplyThemePreference(themePreferenceSelect.value);
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
            const backup = exportMacroBayData();
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "macrobay-backup-" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
            setDataManagementStatus("Backup downloaded. Keep the JSON file somewhere safe.");
            if (window.macrobayToast) window.macrobayToast("MACROBAY backup downloaded.");
        } catch (error) {
            setDataManagementStatus(error.message || "Could not create a backup.");
            if (window.macrobayToast) window.macrobayToast("Could not create the backup.", "error");
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
            validateMacroBayBackup(backup);
            const confirmed = window.macrobayDialog
                ? await window.macrobayDialog.confirm(
                    "Importing this backup replaces MACROBAY data saved on this device. Continue?",
                    "Replace saved data",
                    "Import backup"
                )
                : window.confirm("Importing this backup replaces MACROBAY data saved on this device. Continue?");
            if (!confirmed) return;
            importMacroBayData(backup);
            updateAfterDataRestore();
            setDataManagementStatus("Backup restored successfully.");
            if (window.macrobayToast) window.macrobayToast("MACROBAY backup restored.");
        } catch (error) {
            const message = error && error.message ? error.message : "Could not read this backup.";
            setDataManagementStatus(message);
            if (window.macrobayToast) window.macrobayToast(message, "error");
        } finally {
            importDataInput.value = "";
        }
    });
}

const resetDataButton = document.getElementById("reset-data");
if (resetDataButton) {
    resetDataButton.addEventListener("click", async function () {
        const confirmed = window.macrobayDialog
            ? await window.macrobayDialog.confirm(
                "This permanently removes your profile, targets, nutrition, planner, workouts, history, templates, and preferences from this device.",
                "Reset MACROBAY data",
                "Delete data"
            )
            : window.confirm("Permanently delete all MACROBAY data saved on this device?");
        if (!confirmed) return;
        try {
            resetMacroBayData();
            updateAfterDataRestore();
            setDataManagementStatus("MACROBAY data was removed from this device.");
            if (window.macrobayToast) window.macrobayToast("MACROBAY data reset.");
        } catch (error) {
            const message = error && error.message ? error.message : "Could not reset MACROBAY data.";
            setDataManagementStatus(message);
            if (window.macrobayToast) window.macrobayToast(message, "error");
        }
    });
}

populateSettingsPreferences();
