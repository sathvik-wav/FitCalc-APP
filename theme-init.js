(function () {
  "use strict";

  var root = document.documentElement;
  var preferences = null;

  try {
    function isTestPage(target) {
      if (!target || target.FITCALC_TEST_MODE !== true) return false;
      var pathname = target.location && target.location.pathname;
      return typeof pathname === "string" && (pathname === "/tests" || pathname.indexOf("/tests/") === 0);
    }

    var testMode = isTestPage(window);
    try {
      if (!testMode && window.top && window.top !== window) testMode = isTestPage(window.top);
    } catch (error) { /* Ignore inaccessible parent windows. */ }

    var storageKey = (testMode ? "test_" : "") + "fitcalc_preferences";
    var saved = localStorage.getItem(storageKey);
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
