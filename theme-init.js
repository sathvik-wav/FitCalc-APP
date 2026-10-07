(function () {
  "use strict";

  var root = document.documentElement;
  var preferences = null;

  try {
    function isTestPage(target) {
      if (!target || target.MACROBAY_TEST_MODE !== true) return false;
      var pathname = target.location && target.location.pathname;
      return typeof pathname === "string" && (pathname === "/tests" || pathname.indexOf("/tests/") === 0);
    }

    var testMode = isTestPage(window);
    try {
      if (!testMode && window.top && window.top !== window) testMode = isTestPage(window.top);
    } catch (error) { /* Ignore inaccessible parent windows. */ }

    var keyPrefix = testMode ? "test_" : "";
    var migrationKey = keyPrefix + "macrobay_storage_migration_v1";
    var legacyKeys = [
      ["fitcalc_preferences", "macrobay_preferences"],
      ["fitcalc_profile", "macrobay_profile"],
      ["fitcalc_history", "macrobay_history"],
      ["fitcalc_targets", "macrobay_targets"],
      ["fitcalc_nutrition", "macrobay_nutrition"],
      ["fitcalc_planner", "macrobay_planner"],
      ["fitcalc_food_library", "macrobay_food_library"],
      ["fitcalc_workout_templates", "macrobay_workout_templates"],
      ["fitcalc_progress_backfill_v1", "macrobay_progress_backfill_v1"],
      ["fitcalc_progress_backfill_v2", "macrobay_progress_backfill_v2"],
      ["fitcalc_schema_version", "macrobay_schema_version"]
    ];

    if (localStorage.getItem(migrationKey) !== "1") {
      var migrationComplete = true;
      legacyKeys.forEach(function (pair) {
        try {
          var oldValue = localStorage.getItem(keyPrefix + pair[0]);
          var newKey = keyPrefix + pair[1];
          if (oldValue !== null && localStorage.getItem(newKey) === null) {
            localStorage.setItem(newKey, oldValue);
          }
        } catch (error) { migrationComplete = false; }
      });
      if (migrationComplete) {
        try { localStorage.setItem(migrationKey, "1"); }
        catch (error) { /* A later page load can safely retry the migration. */ }
      }
    }

    var saved = localStorage.getItem(keyPrefix + "macrobay_preferences");
    preferences = saved ? JSON.parse(saved) : null;
  } catch (error) { /* Storage may be unavailable or contain malformed JSON. */ }

  if (preferences && (preferences.theme === "light" || preferences.theme === "dark")) {
    root.dataset.theme = preferences.theme;
    return;
  }

  var prefersLightTheme = false;
  if (typeof window.matchMedia === "function") {
    try { prefersLightTheme = window.matchMedia("(prefers-color-scheme: light)").matches === true; }
    catch (error) { /* Use the same dark fallback as script.js. */ }
  }
  root.dataset.theme = prefersLightTheme ? "light" : "dark";
})();
