(function () {
  "use strict";

  var BASE = new URL(".", document.currentScript.src).href;
  var root = document.documentElement;
  var PRIMARY_NAV = [
    { path: "index.html", label: "Home", icon: "home" },
    { path: "calculators/index.html", label: "Calculators", icon: "calculators" },
    { path: "planner/index.html", label: "Activity", icon: "activity" },
    { path: "history/index.html", label: "Progress", icon: "progress" },
    { path: "profile/index.html", label: "Profile", icon: "profile" }
  ];
  var TOOLS = [
    { path: "bmi/index.html", label: "BMI" },
    { path: "bmr/index.html", label: "BMR" },
    { path: "calories/index.html", label: "Calories" },
    { path: "macro/index.html", label: "Macros" },
    { path: "bodyfat/index.html", label: "Body Fat" },
    { path: "water/index.html", label: "Water Intake" },
    { path: "protein/index.html", label: "Protein" },
    { path: "sleep/index.html", label: "Sleep Planner" },
    { path: "maxhr/index.html", label: "Max Heart Rate" },
    { path: "idealweight/index.html", label: "Ideal Weight" },
    { path: "steptocalories/index.html", label: "Steps Calories" },
    { path: "exercisecalories/index.html", label: "Workout Calories" },
    { path: "resttimer/index.html", label: "Rest Timer" }
  ];
  var TRACKING = [
    { path: "nutrition/index.html", label: "Nutrition" },
    { path: "planner/index.html", label: "Planner" },
    { path: "history/index.html", label: "History" }
  ];
  var ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    calculators: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    activity: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    progress: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>'
  };
  var basePath = new URL(BASE).pathname;
  function normalizedPath(url) {
    var pathname = url.pathname.indexOf(basePath) === 0 ? "/" + url.pathname.slice(basePath.length) : url.pathname;
    var path = pathname.replace(/index\.html$/, "").replace(/\/$/, "");
    return path || "/";
  }
  function routeState() {
    var location = new URL(window.location.href);
    var path = normalizedPath(location);
    var tool = TOOLS.find(function (item) { return normalizedPath(new URL(item.path, BASE)) === path; });
    var tracking = TRACKING.find(function (item) { return normalizedPath(new URL(item.path, BASE)) === path; });
    var appLabel = null;
    var primaryLabel = null;
    if (path === "/settings") {
      appLabel = location.hash === "#settings-about" ? "About"
        : location.hash === "#settings-privacy" ? "Privacy" : "Settings";
    }
    if (tool || path === "/calculators" || (path === "/" && location.hash === "#calculators")) {
      primaryLabel = "Calculators";
    } else if (path === "/" || path === "/index.html") {
      primaryLabel = "Home";
    } else if (path.indexOf("/planner") === 0) {
      primaryLabel = "Activity";
    } else if (path.indexOf("/nutrition") === 0) {
      primaryLabel = null;
    } else if (path.indexOf("/history") === 0) {
      primaryLabel = "Progress";
    } else if (path.indexOf("/profile") === 0) {
      primaryLabel = "Profile";
    } else if (document.body.dataset.calc) {
      primaryLabel = "Calculators";
    }
    return { path: path, primary: primaryLabel, tracking: tracking ? tracking.label : null, tool: tool ? tool.label : null, app: appLabel };
  }
  window.fitcalcNavigation = { getState: routeState };
  function navAnchor(item, className, active) {
    var url = new URL(item.path, BASE);
    var classes = [className, active ? "active" : ""].filter(Boolean).join(" ");
    return '<a class="' + classes + '" href="' + url.href + '"' +
      (active ? ' aria-current="page"' : "") + '>' + item.label + '</a>';
  }
  var desktopNav = document.querySelector(".desktop-nav");
  var mobileMenu = document.getElementById("mobile-menu");
  var hamburger = document.getElementById("hamburger-btn");
  var mobileNav = document.createElement("nav");
  mobileNav.className = "bottom-nav";
  mobileNav.setAttribute("aria-label", "Primary navigation");
  function menuGroup(title, links) {
    return '<section class="mobile-menu-group"><h2 class="mobile-menu-heading">' + title + '</h2>' + links + '</section>';
  }
  function routeLink(item, active, className) {
    return '<a class="' + (className || "") + (active ? " active" : "") + '" href="' + new URL(item.path, BASE).href + '"' +
      (active ? ' aria-current="page"' : "") + '>' + item.label + '</a>';
  }
  function renderNavigation() {
    var state = routeState();
    if (desktopNav) desktopNav.innerHTML = PRIMARY_NAV.map(function (item) {
      return navAnchor(item, "", item.label === state.primary);
    }).join("");
    if (mobileMenu) {
      var primaryLinks = PRIMARY_NAV.map(function (item) {
        return routeLink(item, item.label === state.primary, "mobile-primary-link");
      }).join("");
      var trackingLinks = TRACKING.map(function (item) {
        return routeLink(item, item.label === state.tracking, "mobile-secondary-link");
      }).join("");
      var toolLinks = TOOLS.map(function (item) {
        return routeLink(item, item.label === state.tool, "mobile-tool-link");
      }).join("");
      var appLinks = [
        { path: "settings/index.html", label: "Settings", state: "Settings" },
        { path: "settings/index.html#settings-about", label: "About", state: "About" },
        { path: "settings/index.html#settings-privacy", label: "Privacy", state: "Privacy" }
      ].map(function (item) { return routeLink(item, item.state === state.app, "mobile-app-link"); }).join("");
      mobileMenu.innerHTML = menuGroup("Primary navigation", '<div class="mobile-primary-list">' + primaryLinks + '</div>') +
        menuGroup("Tracking", '<div class="mobile-secondary-list">' + trackingLinks + '</div>') +
        menuGroup("Tools", '<div class="mobile-tool-list">' + toolLinks + '</div>') +
        menuGroup("App", '<div class="mobile-app-list">' + appLinks + '</div>');
    }
    mobileNav.innerHTML = PRIMARY_NAV.map(function (item) {
      var active = item.label === state.primary;
      var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[item.icon] + '</svg>';
      return '<a class="mobile-tab' + (active ? " active" : "") + '" href="' + new URL(item.path, BASE).href + '"' +
        (active ? ' aria-current="page"' : "") + '><span class="mobile-tab-icon">' + icon + '</span><span>' + item.label + '</span></a>';
    }).join("");
  }
  renderNavigation();
  document.body.appendChild(mobileNav);
  window.addEventListener("hashchange", renderNavigation);
  window.addEventListener("popstate", renderNavigation);

  function closeMenu(returnFocus) {
    if (!mobileMenu || !hamburger) return;
    mobileMenu.classList.remove("open");
    mobileMenu.hidden = true;
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "Open menu");
    if (returnFocus) hamburger.focus();
  }
  if (mobileMenu && hamburger) {
    hamburger.addEventListener("click", function () {
      var open = hamburger.getAttribute("aria-expanded") !== "true";
      hamburger.setAttribute("aria-expanded", String(open));
      hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      mobileMenu.hidden = !open;
      mobileMenu.classList.toggle("open", open);
      if (open) {
        var firstLink = mobileMenu.querySelector("a");
        if (firstLink) firstLink.focus({ preventScroll: true });
      }
    });
    mobileMenu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu(false);
    });
    document.addEventListener("click", function (event) {
      if (hamburger.getAttribute("aria-expanded") === "true" &&
          !mobileMenu.contains(event.target) && !hamburger.contains(event.target)) closeMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && hamburger.getAttribute("aria-expanded") === "true") closeMenu(true);
    });
  }

  var storedPreferences = typeof getFitCalcPreferences === "function" ? getFitCalcPreferences() : {};
  var themeMedia = null;
  if (typeof window.matchMedia === "function") {
    try { themeMedia = window.matchMedia("(prefers-color-scheme: light)"); }
    catch (error) { /* Use the dark fallback when the preference query is unavailable. */ }
  }
  function resolveThemePreference(preference) {
    if (preference === "light" || preference === "dark") return preference;
    var prefersLightTheme = !!(themeMedia && themeMedia.matches === true);
    return prefersLightTheme ? "light" : "dark";
  }
  function syncThemeButton(button) {
    var light = root.dataset.theme === "light";
    button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    button.title = light ? "Switch to dark theme" : "Switch to light theme";
    button.innerHTML = light
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.7 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
  }
  function applyThemePreference(preference) {
    root.dataset.theme = resolveThemePreference(preference);
    document.querySelectorAll(".theme-toggle").forEach(syncThemeButton);
    var themeSelector = document.getElementById("settings-theme");
    if (themeSelector && themeSelector.value !== preference) {
      themeSelector.value = preference === "light" || preference === "dark" || preference === "system" ? preference : "system";
    }
    return root.dataset.theme;
  }
  window.fitcalcApplyThemePreference = applyThemePreference;
  applyThemePreference(storedPreferences && storedPreferences.theme);
  if (themeMedia && typeof themeMedia.addEventListener === "function") {
    themeMedia.addEventListener("change", function () {
      var current = typeof getFitCalcPreferences === "function" ? getFitCalcPreferences() : {};
      if (!current || (current.theme !== "light" && current.theme !== "dark")) applyThemePreference("system");
    });
  }
  document.querySelectorAll(".theme-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      if (typeof saveFitCalcPreferences === "function") {
        try {
          var nextTheme = root.dataset.theme === "light" ? "dark" : "light";
          saveFitCalcPreferences({ theme: nextTheme });
          applyThemePreference(nextTheme);
        }
        catch (error) { /* Storage failure is already announced by store.js. */ }
      } else {
        applyThemePreference(root.dataset.theme === "light" ? "dark" : "light");
      }
    });
  });

  if (document.body.dataset.calc && document.body.dataset.calc !== "bmi") {
    var calculatorCard = document.querySelector(".tile-input");
    if (calculatorCard) {
      var calculatorActions = document.createElement("div");
      calculatorActions.className = "calc-screen-actions";
      calculatorActions.innerHTML = '<a class="bmi-icon-button" href="' + new URL("calculators/index.html", BASE).href + '" aria-label="Back to calculators" title="Back to calculators"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/><path d="M9 12h11"/></svg></a><a class="bmi-icon-button" href="' + new URL("history/index.html", BASE).href + '" aria-label="Open history" title="Open history"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/></svg></a>';
      calculatorCard.insertBefore(calculatorActions, calculatorCard.firstChild);
    }
  }

  var splashScreen = document.getElementById("fitcalc-splash");
  var splashStart = document.getElementById("splash-start");
  if (splashScreen && splashStart) {
    function dismissSplash() {
      splashScreen.hidden = true;
      document.body.classList.remove("splash-active");
      Array.prototype.forEach.call(document.body.children, function (child) {
        if (child !== splashScreen) child.inert = false;
      });
    }
    var onboardingComplete = false;
    if (typeof hasCompletedFitCalcOnboarding === "function") {
      try { onboardingComplete = hasCompletedFitCalcOnboarding(); }
      catch (error) { /* Fall back to showing onboarding if saved state cannot be read. */ }
    }
    if (window.location.hash || onboardingComplete) {
      dismissSplash();
    } else {
      Array.prototype.forEach.call(document.body.children, function (child) {
        if (child !== splashScreen) child.inert = true;
      });
    }
    splashStart.addEventListener("click", function () {
      try {
        if (typeof completeFitCalcOnboarding !== "function") throw new Error("Saved app state is unavailable.");
        completeFitCalcOnboarding();
      } catch (error) {
        if (window.fitcalcToast) window.fitcalcToast("Could not save onboarding. Check device storage and try again.", "error");
        return;
      }
      dismissSplash();
      var homeLink = document.querySelector(".brand");
      if (homeLink) homeLink.focus({ preventScroll: true });
    });
  }

  function ensureToast() {
    var toast = document.getElementById("fitcalc-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "fitcalc-toast";
      toast.className = "fitcalc-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.hidden = true;
      document.body.appendChild(toast);
    }
    return toast;
  }
  window.fitcalcToast = function (message, kind) {
    var toast = ensureToast();
    toast.textContent = String(message || "");
    toast.dataset.kind = kind || "info";
    toast.hidden = false;
    window.clearTimeout(toast.hideTimer);
    toast.hideTimer = window.setTimeout(function () { toast.hidden = true; }, 4200);
  };

  var dialog;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "fitcalc-dialog";
    dialog.setAttribute("aria-labelledby", "fitcalc-dialog-title");
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog && dialog.open) dialog.close("cancel");
    });
    document.body.appendChild(dialog);
    return dialog;
  }
  function showDialog(options) {
    var settings = options || {};
    var modal = ensureDialog();
    var form = document.createElement("form");
    form.className = "fitcalc-dialog-content";
    form.method = "dialog";
    var title = document.createElement("h2");
    title.id = "fitcalc-dialog-title";
    title.textContent = settings.title || "FitCalc";
    form.appendChild(title);
    if (settings.message) {
      var message = document.createElement("p");
      message.textContent = settings.message;
      form.appendChild(message);
    }
    var input;
    if (settings.prompt) {
      var field = document.createElement("div");
      field.className = "field";
      var label = document.createElement("label");
      label.textContent = settings.label || "Value";
      input = document.createElement("input");
      input.type = settings.type === "number" ? "number" : "text";
      if (settings.type === "number") input.step = "any";
      input.inputMode = settings.inputMode || (settings.type === "number" ? "decimal" : "text");
      input.autocomplete = "off";
      input.value = settings.value || "";
      input.required = !!settings.required;
      label.htmlFor = "fitcalc-dialog-input";
      input.id = "fitcalc-dialog-input";
      field.append(label, input);
      form.appendChild(field);
    }
    var actions = document.createElement("div");
    actions.className = "fitcalc-dialog-actions";
    if (settings.cancel !== false) {
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "secondary-btn";
      cancel.textContent = settings.cancelLabel || "Cancel";
      cancel.addEventListener("click", function () { modal.close("cancel"); });
      actions.appendChild(cancel);
    }
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary-btn";
    submit.value = "confirm";
    submit.textContent = settings.confirmLabel || "Continue";
    actions.appendChild(submit);
    form.appendChild(actions);
    modal.replaceChildren(form);
    modal.returnValue = "";
    return new Promise(function (resolve) {
      function finish() {
        modal.removeEventListener("close", finish);
        resolve(modal.returnValue === "confirm" ? (input ? input.value : true) : (settings.prompt ? null : false));
      }
      modal.addEventListener("close", finish);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (input && !input.reportValidity()) return;
        modal.close("confirm");
      });
      modal.showModal();
      window.setTimeout(function () { (input || submit).focus(); }, 0);
    });
  }
  window.fitcalcDialog = {
    alert: function (message, title) { return showDialog({ title: title || "A quick note", message: message, cancel: false, confirmLabel: "Got it" }); },
    confirm: function (message, title, confirmLabel) { return showDialog({ title: title || "Please confirm", message: message, confirmLabel: confirmLabel || "Confirm" }); },
    prompt: function (options) { return showDialog(Object.assign({ prompt: true }, options || {})); }
  };

  window.addEventListener("fitcalc:storage-error", function () {
    var notice = document.getElementById("fitcalc-storage-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "fitcalc-storage-notice";
      notice.className = "storage-notice";
      notice.setAttribute("role", "alert");
      notice.setAttribute("aria-live", "assertive");
      document.body.appendChild(notice);
    }
    notice.textContent = "FitCalc could not save this change. Check browser storage and try again.";
    notice.hidden = false;
    window.clearTimeout(notice.hideTimer);
    notice.hideTimer = window.setTimeout(function () { notice.hidden = true; }, 6000);
  });

  var isCapacitorNative = window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === "function" &&
    window.Capacitor.isNativePlatform();
  if (!isCapacitorNative && "serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    navigator.serviceWorker.register(new URL("service-worker.js", BASE).href).catch(function () {});
  }
})();
