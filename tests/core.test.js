const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { prepareNetlifySite } = require("../scripts/prepare-netlify.js");

const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};

// load constants + target engine in a sandbox (they are plain browser scripts)
const ctx = {
  module: { exports: {} }, console, localStorage,
  document: { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } },
  window: { addEventListener() {} }
};
vm.createContext(ctx);
["constants.js", "store.js", "target.js", "progress.js", "foods-india.js", "nutrition.js", "workout.js", "food-api.js", "exercise-api.js", "dashboard.js", "adaptive.js", "history.js"].forEach((f) =>
  vm.runInContext(fs.readFileSync(__dirname + "/../" + f, "utf8"), ctx));
const { computeTargets, calculateBMR } = ctx.module.exports;
const CURRENT_SCHEMA_VERSION = vm.runInContext("APP_SCHEMA_VERSION", ctx);

function submitStandaloneCalculator(slug, values, selectedUnits, overrides = {}) {
  const calculatorUnits = selectedUnits || { weight: "kg", height: "cm" };
  const fields = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value: String(value) }]));
  const listeners = {};
  const form = { addEventListener(type, handler) { listeners[type] = handler; } };
  const empty = {
    hidden: false,
    textContent: "",
    replaceChildren() { this.textContent = ""; },
    appendChild(child) { this.textContent += child.textContent; }
  };
  const content = { hidden: true, innerHTML: "" };
  const document = {
    body: { getAttribute() { return slug; } },
    addEventListener(type, handler) { listeners[type] = handler; },
    getElementById(id) {
      if (id === "calc-form") return form;
      if (id === "result-empty") return empty;
      if (id === "result-content") return content;
      return fields[id] || null;
    },
    querySelector(selector) {
      if (selector === 'input[name="sex"]:checked') return { value: values.sex || "m" };
      return null;
    },
    querySelectorAll() { return []; },
    createElement() { return { textContent: "", setAttribute() {} }; }
  };
  const loggedErrors = [];
  const sandbox = {
    document,
    window: {},
    console: { error(...args) { loggedErrors.push(args); } },
    calculateBMR: ctx.calculateBMR,
    calculateTDEE: ctx.calculateTDEE,
    calculateCalorieTarget: ctx.calculateCalorieTarget,
    getMacroBayUnits() { return calculatorUnits; },
    feetInchesToCentimeters(feet, inches) { return (Number(feet) * 12 + Number(inches)) * 2.54; },
    centimetersToFeetInches(centimeters) { return ctx.centimetersToFeetInches(centimeters); },
    kilogramsToDisplayWeight(kilograms) { return calculatorUnits.weight === "lb" ? kilograms * 2.20462262185 : kilograms; },
    displayWeightToKilograms(weight) { return calculatorUnits.weight === "lb" ? weight / 2.20462262185 : weight; },
    formatMacroBayHeight(centimeters) { return calculatorUnits.height === "cm" ? centimeters + " cm" : "5 ft 11 in"; }
  };
  Object.assign(sandbox, overrides);
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../calculators.js", "utf8"), sandbox);
  listeners.DOMContentLoaded();
  listeners.submit({ preventDefault() {} });
  return { empty, content, loggedErrors };
}

function loadPlannerSandbox(options = {}) {
  let now = options.now === undefined
    ? new Date(2026, 0, 15, 12, 0).getTime()
    : options.now;
  const storage = new Map();
  const listeners = { window: {}, document: {} };
  const dispatchedEvents = [];
  const toasts = [];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const handlers = {};
      const node = {
        id, value: "", textContent: "", innerHTML: "", style: {}, dataset: {}, disabled: false,
        addEventListener(type, handler) { handlers[type] = handler; },
        click(event) { return handlers.click ? handlers.click(event || { target: this }) : undefined; },
        setAttribute() {}, getAttribute() { return null; },
        closest() { return null; },
        querySelectorAll(selector) {
          if (id === "workout-list" || id === "template-list") return this.children.flatMap((child) => child.querySelectorAll(selector));
          return [];
        },
        querySelector() { return null; }, appendChild(child) { this.children.push(child); }, children: []
      };
      let html = "";
      Object.defineProperty(node, "innerHTML", {
        get() { return html; },
        set(value) {
          html = String(value);
          if ((id === "workout-list" || id === "template-list") && html === "") node.children = [];
        }
      });
      elements.set(id, node);
    }
    return elements.get(id);
  }
  function createRenderedNode() {
    const buttonsBySelector = new Map();
    const node = {
      className: "", innerHTML: "", dataset: {},
      querySelectorAll(selector) {
        if (!buttonsBySelector.has(selector)) {
          const requestedClass = selector.startsWith(".") ? selector.slice(1) : "";
          const buttons = Array.from(this.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g))
            .filter((match) => {
              const classes = (match[1].match(/\bclass="([^"]*)"/) || [null, ""])[1].split(/\s+/);
              return classes.includes(requestedClass);
            })
            .map((match) => {
              const handlers = {};
              const dataset = {};
              Array.from(match[1].matchAll(/\bdata-([\w-]+)="([^"]*)"/g)).forEach((attribute) => {
                const name = attribute[1].replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
                dataset[name] = attribute[2];
              });
              return {
                dataset,
                addEventListener(type, handler) { handlers[type] = handler; },
                click(event) { return handlers.click ? handlers.click(event || { target: this }) : undefined; },
                closest() { return null; },
                handlers
              };
            });
          buttonsBySelector.set(selector, buttons);
        }
        return buttonsBySelector.get(selector);
      }
    };
    return node;
  }
  class FakeDate extends Date {
    constructor(...args) { args.length ? super(...args) : super(now); }
    static now() { return now; }
  }
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  Object.entries(options.initialStorage || {}).forEach(([key, value]) => {
    storage.set(key, typeof value === "string" ? value : JSON.stringify(value));
  });
  const document = {
    body: { hasAttribute() { return false; } },
    visibilityState: "visible",
    getElementById: element,
    querySelectorAll() { return []; },
    addEventListener(type, handler) { listeners.document[type] = handler; },
    createElement() { return createRenderedNode(); }
  };
  const window = {
    location: { search: options.search || "" },
    macrobayToast(message, type) { toasts.push({ message, type }); },
    macrobayDialog: { confirm() { return Promise.resolve(true); } },
    addEventListener(type, handler) { (listeners.window[type] || (listeners.window[type] = [])).push(handler); },
    dispatchEvent(event) {
      dispatchedEvents.push(event);
      (listeners.window[event.type] || []).forEach((handler) => handler(event));
    }
  };
  const sandbox = {
    console, Date: FakeDate, document, window, localStorage,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
  };
  vm.createContext(sandbox);
  ["constants.js", "store.js", "target.js", "workout.js"].concat(options.includeProgress ? ["progress.js"] : []).forEach((file) => {
    vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox);
  });
  if (options.profile) sandbox.saveProfile(options.profile);
  vm.runInContext(fs.readFileSync(__dirname + "/../planner.js", "utf8"), sandbox);
  return {
    sandbox, storage, elements, getElement: element, listeners, toasts, dispatchedEvents,
    setNow(value) { now = value; },
    now() { return now; }
  };
}

function loadNutritionSandbox(search = "", options = {}) {
  let now = options.now === undefined
    ? Date.now()
    : options.now;
  class FakeDate extends Date {
    constructor(...args) { args.length ? super(...args) : super(now); }
    static now() { return now; }
  }
  const storage = new Map();
  const listeners = { window: {}, document: {} };
  const elements = new Map();
  const toasts = [];
  function element(id) {
    if (!elements.has(id)) {
      const handlers = {};
      elements.set(id, {
        id, value: "", textContent: "", innerHTML: "", style: {}, dataset: {},
        hidden: false, disabled: false, children: [],
        addEventListener(type, handler) { handlers[type] = handler; },
        click() { if (handlers.click) handlers.click(); },
        setAttribute() {}, getAttribute() { return null; }, closest() { return null; },
        querySelectorAll() { return []; }, querySelector(selector) { return selector ? element(id + selector) : null; },
        appendChild(child) { this.children.push(child); }, focus() {}
      });
    }
    return elements.get(id);
  }
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const document = {
    body: { hasAttribute() { return false; } },
    visibilityState: "visible",
    getElementById: element,
    querySelectorAll() { return []; },
    addEventListener(type, handler) { listeners.document[type] = handler; },
    createElement() { return element("created-" + elements.size); }
  };
  const window = {
    location: { search },
    macrobayToast(message, type) { toasts.push({ message, type }); },
    confirm() { return false; },
    addEventListener(type, handler) {
      (listeners.window[type] || (listeners.window[type] = [])).push(handler);
    },
    dispatchEvent(event) {
      (listeners.window[event.type] || []).forEach((handler) => handler(event));
    }
  };
  const sandbox = {
    console, Date: options.now === undefined ? Date : FakeDate, document, window, localStorage,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
  };
  vm.createContext(sandbox);
  ["constants.js", "store.js", "target.js", "progress.js", "foods-india.js", "nutrition.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox);
  });
  return {
    sandbox, storage, listeners, elements, getElement: element, toasts,
    setNow(value) { now = value; },
    now() { return now; }
  };
}

function loadProfileSandbox(search = "") {
  const storage = new Map();
  const elements = new Map();
  const listeners = { document: {}, window: {} };
  const toasts = [];
  function element(id) {
    if (!elements.has(id)) {
      const handlers = {};
      elements.set(id, {
        id, value: "", textContent: "", hidden: false, disabled: false, required: false,
        dataset: {}, handlers,
        addEventListener(type, handler) { handlers[type] = handler; },
        click() { if (handlers.click) handlers.click(); },
        reset() { this.value = ""; },
        scrollIntoView() { this.scrolledIntoView = true; },
        focus() { this.focused = true; }
      });
    }
    return elements.get(id);
  }
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const document = {
    body: { hasAttribute() { return false; } },
    getElementById: element,
    addEventListener(type, handler) { listeners.document[type] = handler; },
    createElement() { return element("created"); }
  };
  const window = {
    location: { search },
    macrobayToast(message, type) { toasts.push({ message, type }); },
    confirm() { return true; },
    addEventListener(type, handler) { listeners.window[type] = handler; },
    dispatchEvent(event) { (listeners.window[event.type] || []).forEach((handler) => handler(event)); }
  };
  const sandbox = {
    console, document, window, localStorage,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; }
  };
  vm.createContext(sandbox);
  ["constants.js", "store.js", "settings.js", "profile.js", "target.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox);
  });
  if (listeners.document.DOMContentLoaded) listeners.document.DOMContentLoaded();
  return { sandbox, storage, elements, getElement: element, listeners, toasts };
}

function createApiNode() {
  const handlers = {};
  return {
    value: "", textContent: "", innerHTML: "", className: "", children: [], dataset: {},
    addEventListener(type, handler) { handlers[type] = handler; },
    click() { return handlers.click ? handlers.click() : undefined; },
    replaceChildren() { this.children = []; this.textContent = ""; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    setAttribute() {}, focus() { this.focused = true; }, remove() { this.removed = true; }, handlers
  };
}

function loadFoodApiRetrySandbox() {
  const nodes = new Map();
  const document = {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, createApiNode()); return nodes.get(id); },
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, createApiNode()); return nodes.get(selector); },
    createElement() { return createApiNode(); }
  };
  const sandbox = { document, window: { addEventListener() {} }, navigator: {}, fetch: async function () { throw new Error("offline"); }, URLSearchParams, AbortController, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../food-api.js", "utf8"), sandbox);
  document.getElementById("food-name").value = "oats";
  return { sandbox, nodes, document };
}

function loadExerciseApiRetrySandbox() {
  const results = createApiNode();
  const document = { createElement() { return createApiNode(); } };
  const sandbox = { document, fetch: async function () { throw new Error("offline"); } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../exercise-api.js", "utf8"), sandbox);
  return { sandbox, results };
}

function loadGlobalScriptSandbox(href = "https://macrobay.test/profile/", options = {}) {
  const documentListeners = {};
  const windowListeners = {};
  const appended = [];
  function node() {
    const handlers = {};
    const attributes = {};
    const classes = new Set();
    return {
      innerHTML: "", textContent: "", dataset: {}, hidden: false,
      classList: {
        add(value) { classes.add(value); }, remove(value) { classes.delete(value); },
        toggle(value, force) { if (force === undefined ? !classes.has(value) : force) classes.add(value); else classes.delete(value); }
      },
      addEventListener(type, handler) { handlers[type] = handler; },
      click(event) { if (handlers.click) handlers.click(event || { target: this }); },
      setAttribute(name, value) { attributes[name] = String(value); },
      getAttribute(name) { return attributes[name] || null; },
      focus() { this.focused = true; },
      querySelector() { return { focus() {} }; },
      contains() { return false; },
      appendChild(child) { (this.children || (this.children = [])).push(child); },
      replaceChildren() {},
      handlers,
      attributes
    };
  }
  const desktopNav = node();
  const mobileMenu = node();
  const hamburger = node();
  const theme = node();
  const splashScreen = options.includeSplash ? node() : null;
  const splashStart = options.includeSplash ? node() : null;
  if (splashScreen) splashScreen.hidden = false;
  const rootElement = { dataset: {} };
  const bodyClasses = new Set(options.includeSplash ? ["splash-active"] : []);
  const body = {
    dataset: {}, children: options.includeSplash ? [splashScreen, {}, {}] : [],
    hasAttribute() { return false; },
    classList: {
      add(value) { bodyClasses.add(value); },
      remove(value) { bodyClasses.delete(value); },
      contains(value) { return bodyClasses.has(value); }
    },
    appendChild(child) { appended.push(child); }
  };
  const document = {
    currentScript: { src: "https://macrobay.test/script.js" },
    documentElement: rootElement,
    body,
    querySelector(selector) { return selector === ".desktop-nav" ? desktopNav : null; },
    querySelectorAll() { return []; },
    getElementById(id) {
      if (id === "mobile-menu") return mobileMenu;
      if (id === "hamburger-btn") return hamburger;
      if (id === "macrobay-splash") return splashScreen;
      if (id === "splash-start") return splashStart;
      return null;
    },
    createElement() { return node(); },
    addEventListener(type, handler) { documentListeners[type] = handler; }
  };
  const window = {
    location: new URL(href),
    addEventListener(type, handler) { (windowListeners[type] || (windowListeners[type] = [])).push(handler); },
    clearTimeout() {},
    setTimeout() { return 1; }
  };
  const storage = options.storage || new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const serviceWorkerRegistrations = [];
  const navigator = {
    serviceWorker: {
      register(url) {
        serviceWorkerRegistrations.push(url);
        return { catch() {} };
      }
    }
  };
  if (options.capacitorNative) {
    window.Capacitor = { isNativePlatform() { return true; } };
  }
  if (options.osLight !== undefined) {
    window.matchMedia = function (query) {
      assert.strictEqual(query, "(prefers-color-scheme: light)");
      return { matches: options.osLight };
    };
  }
  const sandbox = {
    document, window, navigator, URL, console, localStorage,
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    setTimeout() { return 1; }, clearTimeout() {}
  };
  vm.createContext(sandbox);
  if (options.withStore) {
    ["constants.js", "store.js"].forEach((file) => vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox));
  } else {
    const preferences = options.preferences || {};
    sandbox.getMacroBayPreferences = () => preferences;
    sandbox.hasCompletedMacroBayOnboarding = () => {
      if (preferences.onboardingComplete === true) return true;
      if (!options.legacyUserData) return false;
      preferences.onboardingComplete = true;
      return true;
    };
    sandbox.completeMacroBayOnboarding = () => {
      if (options.failOnboardingSave) throw new Error("storage unavailable");
      preferences.onboardingComplete = true;
      return true;
    };
  }
  vm.runInContext(fs.readFileSync(__dirname + "/../script.js", "utf8"), sandbox);
  return { sandbox, desktopNav, mobileMenu, hamburger, theme, rootElement, documentListeners, windowListeners, appended, serviceWorkerRegistrations, splashScreen, splashStart, body, bodyClasses, storage };
}

const male = { sex: "male", age: 25, height: 180, weight: 80, activity: "moderate", goal: "maintain" };

test("Mifflin-St Jeor BMR", () => {
  assert.strictEqual(Math.round(calculateBMR(male)), 1805);
  assert.strictEqual(Math.round(calculateBMR({ ...male, sex: "female" })), 1639);
});

test("goal adjustments", () => {
  const m = computeTargets(male), l = computeTargets({ ...male, goal: "lose" }), g = computeTargets({ ...male, goal: "gain" });
  assert.strictEqual(l.calories, m.calories - 500);
  assert.strictEqual(g.calories, m.calories + 300);
});

test("calorie floor and non-negative carbs", () => {
  const small = computeTargets({ sex: "female", age: 60, height: 150, weight: 40, activity: "sedentary", goal: "lose" });
  assert.ok(small.calories >= 1200);
  assert.ok(small.carbs >= 0);
});

test("escapeHTML", () => {
  assert.strictEqual(ctx.escapeHTML("<b>&\"'"), "&lt;b&gt;&amp;&quot;&#39;");
});

test("corrupt storage falls back without throwing", () => {
  localStorage.setItem("broken", "{");
  assert.strictEqual(ctx.readJSON("broken", "safe"), "safe");
});

test("test-mode storage writes only to the test namespace", () => {
  values.clear();
  const previousLocation = ctx.window.location;
  ctx.window.location = { pathname: "/tests/core.test.js" };
  ctx.window.MACROBAY_TEST_MODE = true;
  ctx.writeJSON("test_sentinel", { isolated: true });
  assert.strictEqual(values.get("test_test_sentinel"), JSON.stringify({ isolated: true }));
  ctx.window.location = { pathname: "/index.html" };
  ctx.window.MACROBAY_TEST_MODE = false;
  assert.strictEqual(ctx.readJSON("test_sentinel", null), null);
  assert.strictEqual(values.get("test_test_sentinel"), JSON.stringify({ isolated: true }));
  ctx.window.location = previousLocation;
});

test("date reads do not create empty source records", () => {
  localStorage.removeItem("macrobay_nutrition");
  const before = localStorage.getItem("macrobay_nutrition");
  assert.strictEqual(ctx.getNutritionFor("2026-09-28").water, 0);
  assert.strictEqual(localStorage.getItem("macrobay_nutrition"), before);
  assert.strictEqual(ctx.getProgressRecord("2026-09-28"), null);
});

test("nutrition and planner saves remain keyed by date", () => {
  ctx.saveNutritionFor("2026-09-28", { calories: 400, water: 0.5, foods: [{ name: "Oats" }] });
  ctx.savePlannerFor("2026-09-28", { steps: 6420, weight: 72.5, workouts: [], tasks: [] });
  assert.strictEqual(ctx.getNutritionFor("2026-09-28").calories, 400);
  assert.strictEqual(ctx.getNutritionFor("2026-09-29").calories, 0);
  assert.strictEqual(ctx.getPlannerFor("2026-09-28").steps, 6420);
  assert.strictEqual(ctx.getPlannerFor("2026-09-29").steps, 0);
});

test("food portions scale every nutrient and meal totals can be recomputed", () => {
  const food = ctx.calculateLoggedFood({ name: "Rice", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 }, 150, "Lunch");
  assert.strictEqual(food.calories, 195);
  assert.strictEqual(food.meal, "Lunch");
  const day = { foods: [food, ctx.calculateLoggedFood({ name: "Egg", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 }, 50, "Breakfast")] };
  ctx.recalculateNutritionTotals(day);
  assert.strictEqual(day.calories, 266.5);
  assert.ok(Math.abs(day.protein - 10.35) < 0.001);
});

test("food lookup requires exact or whole-word matches and prefers the exact plural-normalized food", () => {
  assert.strictEqual(ctx.findFood("pineapple"), null);
  assert.strictEqual(ctx.findFood("eggplant"), null);
  assert.strictEqual(ctx.findFood("milk chocolate"), null);
  assert.strictEqual(ctx.findFood("egg").name, "egg");
  assert.strictEqual(ctx.findFood("apple").name, "apple");
  assert.strictEqual(ctx.findFood("oil").name, "olive oil");
  assert.strictEqual(ctx.findFood("peanut").name, "Peanuts, all types, raw");
});

test("A5 custom foods, favorites, recents, and serving quantities persist in the food library", () => {
  values.clear();
  const custom = { name: "Homemade granola", calories: 450, protein: 12, carbs: 64, fat: 16, fiber: 8, servingGrams: 45 };
  assert.strictEqual(ctx.saveCustomFood(custom), true);
  assert.strictEqual(ctx.findFood("homemade granola").source, "Custom food");
  assert.strictEqual(ctx.saveCustomFood({ ...custom, name: "Oats" }), false);

  const logged = ctx.calculateLoggedFood(ctx.findFood("Homemade granola"), 2, "Breakfast", "servings");
  assert.strictEqual(logged.amount, 90);
  assert.strictEqual(logged.servingCount, 2);
  assert.strictEqual(logged.calories, 405);
  assert.strictEqual(ctx.toggleFoodFavorite(logged), true);
  ctx.rememberFood(logged);
  const library = ctx.getFoodLibrary();
  assert.strictEqual(library.customFoods.length, 1);
  assert.strictEqual(library.favorites[0].name, "Homemade granola");
  assert.strictEqual(library.recents[0].name, "Homemade granola");
  assert.ok(values.has("macrobay_food_library"));
});

test("A5 copy previous day transfers logged foods and water without creating an empty day", () => {
  const app = loadNutritionSandbox();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = app.sandbox.getDateKey(yesterday);
  const todayKey = app.sandbox.getDateKey(new Date());
  app.sandbox.saveNutritionFor(yesterdayKey, {
    calories: 300, protein: 12, carbs: 40, fat: 8, fiber: 5, water: 0.75,
    foods: [{ name: "Toast", amount: 100, calories: 300, protein: 12, carbs: 40, fat: 8, fiber: 5 }]
  });
  assert.strictEqual(app.sandbox.copyPreviousDayNutrition(), true);
  assert.strictEqual(app.sandbox.getNutritionFor(todayKey).foods[0].name, "Toast");
  assert.strictEqual(app.sandbox.getNutritionFor(todayKey).water, 0.75);
  assert.strictEqual(app.sandbox.copyPreviousDayNutrition(), false);
});

test("A7 edit-day links reopen the selected Nutrition and Planner date", () => {
  const date = "2026-01-14";
  const nutrition = loadNutritionSandbox("?date=" + date);
  assert.strictEqual(nutrition.sandbox.getNutritionDateKey(), date);

  const planner = loadPlannerSandbox({ search: "?date=" + date });
  assert.strictEqual(vm.runInContext("getDateKey(selectedDate)", planner.sandbox), date);
  planner.sandbox.getPlanner();
  assert.strictEqual(vm.runInContext("getDateKey(selectedDate)", planner.sandbox), date);
});

test("A6 custom water amounts can be undone without changing unrelated nutrition", () => {
  const app = loadNutritionSandbox();
  const today = app.sandbox.getDateKey(new Date());
  app.sandbox.saveNutritionFor(today, { calories: 240, foods: [{ name: "Snack", calories: 240 }], water: 0.5 });
  assert.strictEqual(app.sandbox.addWaterAmount(0.4), true);
  assert.strictEqual(app.sandbox.getNutritionFor(today).water, 0.9);
  assert.strictEqual(app.sandbox.undoWaterChange(), true);
  assert.strictEqual(app.sandbox.getNutritionFor(today).water, 0.5);
  assert.strictEqual(app.sandbox.getNutritionFor(today).calories, 240);
  assert.strictEqual(app.sandbox.addWaterAmount(11), false);
});

test("history captures nutrition and preserves actual workout/task details", () => {
  const date = "2026-09-30";
  ctx.saveNutritionFor(date, { calories: 600, protein: 35, carbs: 50, fat: 20, fiber: 4, water: 1.25, foods: [{ name: "Lunch", meal: "Lunch" }] });
  ctx.savePlannerFor(date, { date, steps: 5000, weight: 73, workouts: [{ name: "Push", completed: true, exercises: [{ name: "Bench press", sets: [{ reps: 8, weight: 60 }] }] }], tasks: [{ name: "Walk", completed: true }] });
  const record = ctx.saveProgressRecord(date);
  assert.strictEqual(record.calories, 600);
  assert.strictEqual(record.water, 1.25);
  assert.strictEqual(record.workouts[0].exercises[0].sets[0].weight, 60);
  assert.strictEqual(record.completedWorkouts, 1);
  assert.strictEqual(record.tasks.length, 1);
  assert.strictEqual(record.completedTasks, 1);
});

test("workout completion requires logged actual performance", () => {
  assert.strictEqual(ctx.hasWorkoutPerformance({ exercises: [{ sets: [] }] }), false);
  assert.strictEqual(ctx.hasWorkoutPerformance({ exercises: [{ sets: [{ reps: 8, weight: 0 }] }] }), true);
  assert.strictEqual(ctx.formatWorkoutSet({ durationMinutes: 25 }), "25 min");
});

test("workout set migration converts legacy reps-by-weight chips into metric values", () => {
  const workouts = [{ exercises: [{ name: "Press", sets: ["8×60kg", "10 x 132.3lb", "legacy text"] }] }];
  assert.strictEqual(ctx.migrateWorkoutSets(workouts), true);
  const sets = JSON.parse(JSON.stringify(workouts[0].exercises[0].sets));
  assert.deepStrictEqual(sets[0], { reps: 8, weight: 60 });
  assert.strictEqual(sets[1].reps, 10);
  assert.ok(Math.abs(sets[1].weight - 60) < 0.02);
  assert.deepStrictEqual(sets[2], {});
  assert.strictEqual(ctx.migrateWorkoutSets(workouts), false);
});

test("external food and exercise records are normalized without trusting markup", () => {
  const food = ctx.normalizeOpenFoodFactsProduct({ code: "12345678", product_name: "Example oats", nutriments: { "energy-kcal_100g": 389, proteins_100g: 16.9, carbohydrates_100g: 66, fat_100g: 6.9, fiber_100g: 10.6 } });
  assert.strictEqual(food.calories, 389);
  assert.strictEqual(ctx.normalizeOpenFoodFactsProduct({ product_name: "No values" }), null);
  const exercise = ctx.normalizeWgerExercise({ id: 5, name: "Press", category: { name: "Chest" }, muscles: [{ name: "Pectoralis" }] });
  assert.strictEqual(exercise.provider, "wger");
  assert.strictEqual(exercise.category, "Chest");
});

test("Open Food Facts normalization converts kJ and drops missing or invalid food energy", () => {
  const kcal = ctx.normalizeOpenFoodFactsProduct({ product_name: "Kcal product", nutriments: {
    "energy-kcal_100g": 210, proteins_100g: 4
  } });
  assert.strictEqual(kcal.calories, 210);
  assert.strictEqual(kcal.source, "Open Food Facts");

  const kj = ctx.normalizeOpenFoodFactsProduct({ product_name: "Kilojoule product", nutriments: {
    energy_100g: 418.4, proteins_100g: 4
  } });
  assert.ok(Math.abs(kj.calories - 100) < 1e-9);

  const missing = ctx.normalizeOpenFoodFactsProduct({ product_name: "No calorie product", nutriments: {
    proteins_100g: 4, carbohydrates_100g: 10
  } });
  assert.strictEqual(missing, null);

  const ambiguous = ctx.normalizeOpenFoodFactsProduct({ product_name: "Serving-only energy", serving_size: "1 bar (40 g)", nutriments: {
    "energy-kcal": 180, proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5
  } });
  assert.strictEqual(ambiguous, null);
  assert.strictEqual(ctx.normalizeFoodSearchResult({ name: "Bad energy", calories: 901, protein: 1, carbs: 1, fat: 1 }), null);
  assert.strictEqual(ctx.normalizeFoodSearchResult({ name: "Impossible macros", calories: 500, protein: 40, carbs: 50, fat: 20 }), null);

  const app = loadFoodApiRetrySandbox();
  assert.strictEqual(app.sandbox.normalizeOpenFoodFactsProduct({ product_name: "Valid", nutriments: { "energy-kcal_100g": 100 } }).calories, 100);
});

test("unified food search normalizes, validates, deduplicates, and preserves source priority", () => {
  const app = loadFoodApiRetrySandbox();
  const favorite = { name: "Oats", brand: "Mill A", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6 };
  const duplicate = { name: " oats ", brand: "mill a", calories: 400, protein: 10, carbs: 70, fat: 8, fiber: 5, source: "Open Food Facts" };
  const otherBrand = { name: "Oats", brand: "Mill B", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6 };
  const merged = app.sandbox.mergeFoodSearchResults([
    [Object.assign({}, favorite, { source: "Favorite" }), { name: "No calories" }],
    [duplicate, otherBrand, { name: "Impossible", calories: 300, protein: 20, carbs: 50, fat: 40 }]
  ]);
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].source, "Favorite");
  assert.strictEqual(merged[0].fiber, 10.6);
  assert.strictEqual(merged[1].brand, "Mill B");

  app.sandbox.getFoodLibrary = function () {
    return { favorites: [{ name: "banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 }], customFoods: [] };
  };
  app.sandbox.searchBuiltInFoodList = function () {
    return [{ name: "banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, source: "MacroBay built-in" }];
  };
  app.sandbox.indianFoodDatabase = [{ name: "Banana", calories: 80, protein: 1, carbs: 20, fat: 0.2, fiber: 2, source: "USDA FoodData Central" }];
  const local = app.sandbox.searchLocalFoodSources("banana");
  assert.strictEqual(local.length, 1);
  assert.strictEqual(local[0].source, "Favorite");

  const basic = app.sandbox.mergeLocalBasicFoodRecords([
    { name: "  White   Rice ", aliases: ["cooked rice"], calories: 115, sourceTag: "local" },
    { name: "white rice", aliases: ["steamed rice"], calories: 130, sourceTag: "USDA" }
  ]);
  assert.strictEqual(basic.length, 1);
  assert.strictEqual(basic[0].calories, 130, "sourced nutrition values win over unsourced duplicates");
  assert.deepStrictEqual(Array.from(basic[0].aliases).sort(), ["cooked rice", "steamed rice"]);

  const ifct = app.sandbox.mergeLocalBasicFoodRecords([
    { name: "Lentil soup", aliases: ["dal soup"], calories: 91, sourceTag: "USDA" },
    { name: "lentil soup", aliases: ["masoor dal soup"], calories: 84, sourceTag: "IFCT 2017" }
  ]);
  assert.strictEqual(ifct[0].calories, 84, "IFCT values take priority over USDA duplicates");
  assert.deepStrictEqual(Array.from(ifct[0].aliases).sort(), ["dal soup", "masoor dal soup"]);
});

test("merged food search puts the legacy bread alias before USDA bread matches", () => {
  const app = loadNutritionSandbox();
  vm.runInContext(fs.readFileSync(__dirname + "/../food-api.js", "utf8"), app.sandbox);
  const bundle = JSON.parse(fs.readFileSync(__dirname + "/../foods-usda.json", "utf8"));
  app.sandbox.setUsdaFoodDatabase(bundle);
  const local = app.sandbox.searchLocalFoodSources("bread");
  const bundled = app.sandbox.searchBundledUsdaFoods("bread");
  const merged = app.sandbox.mergeUnifiedFoodSearchResults("bread", local, bundled, [], []);
  assert.deepStrictEqual(Array.from(merged.slice(0, 3), (food) => food.name), [
    "whole wheat bread",
    "Bread, white, commercially prepared (includes soft bread crumbs)",
    "Bread, whole-wheat, commercially prepared"
  ]);
  assert.strictEqual(vm.runInContext("PREFERRED_FOODS.bread", app.sandbox), 174924);
  assert.strictEqual(Object.keys(vm.runInContext("PREFERRED_FOODS", app.sandbox)).length, 25);
  assert.ok(bundle.every((food) => !/^whey,\s*(?:acid|sweet)\b/i.test(food.name)));
});

test("USDA search normalization uses FoodData Central nutrient IDs and kcal units", () => {
  const app = loadFoodApiRetrySandbox();
  const normalized = app.sandbox.normalizeUSDAFood({
    fdcId: 171844,
    description: "Bread, chapati or roti, plain, commercially prepared",
    servingSize: 68,
    servingSizeUnit: "g",
    foodNutrients: [
      { nutrientId: 1008, nutrientName: "Energy", unitName: "kcal", value: 297 },
      { nutrientId: 1003, nutrientName: "Protein", unitName: "g", value: 11.25 },
      { nutrientId: 1004, nutrientName: "Total lipid (fat)", unitName: "g", value: 7.45 },
      { nutrientId: 1005, nutrientName: "Carbohydrate, by difference", unitName: "g", value: 46.36 },
      { nutrientId: 1079, nutrientName: "Fiber, total dietary", unitName: "g", value: 4.9 }
    ]
  });
  assert.strictEqual(normalized.calories, 297);
  assert.strictEqual(normalized.protein, 11.25);
  assert.strictEqual(normalized.fiber, 4.9);
  assert.strictEqual(normalized.servingGrams, 68);
  assert.strictEqual(normalized.source, "USDA FoodData Central");
  const milk = app.sandbox.normalizeUSDAFood({
    description: "Milk, whole",
    servingSize: 244,
    servingSizeUnit: "g",
    foodNutrients: [
      { nutrientId: 1008, nutrientName: "Energy", unitName: "kcal", value: 61 },
      { nutrientId: 1003, nutrientName: "Protein", unitName: "g", value: 3.2 }
    ],
    foodPortions: [{ amount: 1, gramWeight: 244, modifier: "cup", measureUnit: { name: "undetermined" } }]
  });
  assert.deepStrictEqual(Array.from(milk.units), ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass", "serving"]);
  assert.strictEqual(milk.unitGrams.cup, 244);
  assert.ok(Math.abs(milk.unitGrams.ml - 244 / 240) < 1e-9);
  assert.ok(Math.abs(milk.unitGrams.glass - 244 * 250 / 240) < 1e-9);
  assert.deepStrictEqual(Array.from(app.sandbox.getUsdaPortionConversions([]).units), ["g", "oz"]);
  const portions = app.sandbox.getUsdaPortionConversions([
    { amount: 1, gramWeight: 120, modifier: "cup", measureUnit: { name: "undetermined" } },
    { amount: 1, gramWeight: 45, modifier: "ladle", measureUnit: { name: "undetermined" } },
    { amount: 1, gramWeight: 250, modifier: "plate", measureUnit: { name: "undetermined" } },
    { amount: 1, gramWeight: 28, modifier: "slice", measureUnit: { name: "undetermined" } }
  ], "Cooked rice");
  assert.ok(portions.units.includes("katori") && portions.approximateUnits.includes("katori"));
  assert.strictEqual(portions.unitGrams.katori, 90);
  assert.ok(portions.units.includes("ladle") && portions.approximateUnits.includes("ladle"));
  assert.strictEqual(portions.unitGrams.ladle, 45);
  assert.ok(portions.units.includes("plate") && portions.approximateUnits.includes("plate"));
  assert.strictEqual(portions.unitGrams.plate, 250);
  assert.strictEqual(portions.unitGrams.slice, 28);
  assert.strictEqual(app.sandbox.normalizeUSDAFood({ description: "No kcal", foodNutrients: [] }), null);
});

test("offline Indian entries use verified USDA records with explicit portion weights", () => {
  const entries = vm.runInContext("indianFoodDatabase", ctx);
  const roti = entries.find((food) => food.fdcId === 171844);
  const curd = entries.find((food) => food.fdcId === 171284);
  assert.ok(roti && curd);
  assert.strictEqual(roti.calories, 297);
  assert.strictEqual(roti.pieceGrams, 68);
  assert.strictEqual(roti.unitGrams.piece, 68);
  assert.deepStrictEqual(Array.from(roti.units), ["g", "oz", "piece"]);
  assert.strictEqual(curd.calories, 61);
  assert.strictEqual(curd.servingGrams, 245);
  assert.deepStrictEqual(Array.from(curd.units), ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass"]);
  assert.ok(entries.every((food) => ["USDA", "USDA FoodData Central"].includes(food.source)));
  assert.ok(entries.every((food) => Array.isArray(food.aliases)));
  assert.ok(entries.filter((food) => [171844, 170393, 168409, 170000, 170419, 170457, 172436, 174256, 168893, 169910, 169926, 172430, 170162, 170554].includes(food.fdcId)).every((food) => food.sourceTag === "USDA"));
  assert.strictEqual(curd.sourceTag, "Reference");
  assert.strictEqual(entries.find((food) => food.name === "Cheese, paneer").sourceTag, "Reference");
  entries.forEach((food) => food.units.forEach((unit) => {
    if (unit === "g" || unit === "serving") return;
    assert.ok(food.unitGrams[unit] > 0, food.name + " needs a gram weight for " + unit);
  }));
  assert.strictEqual(ctx.searchBuiltInFoodList("cooked rice")[0].name, "white rice");
  assert.strictEqual(ctx.searchBuiltInFoodList("dal")[0].name, "lentils");
});

test("Nutrition has one search box and barcode lookup behind a disclosure", () => {
  const html = fs.readFileSync(__dirname + "/../nutrition/index.html", "utf8");
  assert.match(html, /type="search"[^>]*id="food-name"/);
  assert.match(html, /id="food-barcode"/);
  assert.match(html, /id="food-barcode-disclosure"/);
  assert.match(html, /Scan or enter barcode/);
  assert.doesNotMatch(html, /food-database-search|search-food-database|Packaged food/);
  assert.match(html, /<script src="\.\.\/foods-india\.js"><\/script>/);
  assert.match(fs.readFileSync(__dirname + "/../service-worker.js", "utf8"), /"\.\/foods-india\.js"/);
});

test("dashboard progress is finite and bounded using saved daily state", () => {
  const today = ctx.getDateKey(new Date());
  ctx.writeJSON("macrobay_targets", { calories: 2000, protein: 100, carbs: 200, fat: 70, fiber: 25 });
  ctx.saveNutritionFor(today, { calories: 1000, protein: 50, carbs: 100, fat: 35, fiber: 12, water: 2, foods: [] });
  ctx.savePlannerFor(today, { steps: 5000, workouts: [], tasks: [] });
  const progress = ctx.getDashboardDailyProgress();
  assert.ok(Number.isFinite(progress));
  assert.ok(progress >= 0 && progress <= 100);
});

test("adaptive exercise insight detects repeated logged performance", () => {
  for (let offset = 1; offset <= 3; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = ctx.getDateKey(date);
    ctx.savePlannerFor(key, { date: key, workouts: [{ name: "Push", completed: true, exercises: [{ name: "Bench press", sets: [{ reps: 8, weight: 60 }] }] }], tasks: [] });
    ctx.saveProgressRecord(key);
  }
  assert.ok(ctx.getWorkoutProgressionInsights().some((item) => item.includes("Bench press") && item.includes("three sessions")));
});

test("history range is a calendar window rather than N saved records", () => {
  const date = new Date();
  date.setDate(date.getDate() - 12);
  const key = ctx.getDateKey(date);
  ctx.savePlannerFor(key, { date: key, steps: 8000, workouts: [], tasks: [] });
  ctx.saveProgressRecord(key);
  assert.ok(!ctx.getProgressRecordsForDays(7).some((record) => record.date === key));
});

test("weight chart uses its own range while count charts keep a zero baseline", () => {
  const records = [
    { date: "2026-09-28", weight: 72.0, calories: 1800 },
    { date: "2026-09-29", weight: 73.1, calories: 2200 }
  ];
  const height = 240, padding = 30;
  const weights = ctx.createChartPoints(records, "weight", 760, height, padding, { zeroBaseline: false });
  const yValues = weights.map((point) => point.y);
  assert.ok(Math.max(...yValues) - Math.min(...yValues) > (height - padding * 2) * 0.7);
  const weightScale = ctx.getChartValueScale(records, "weight", { zeroBaseline: false });
  const weightHTML = ctx.createLineChartHTML("Weight", "weight", "kg", records);
  const topLabel = weightHTML.match(/class="progress-chart-y-label" data-axis="top"[^>]*>([^<]+)<\/span>/);
  assert.ok(topLabel);
  assert.strictEqual(Number(topLabel[1]), Number(weightScale.max.toFixed(1)));
  assert.match(weightHTML, /preserveAspectRatio="none"/);

  const calories = ctx.createChartPoints(records, "calories", 760, height, padding);
  assert.ok(Math.abs(Math.min(...calories.map((point) => point.y)) - padding) < 0.001);
});

test("R2-1 history charts stretch the plot while keeping accessible HTML dots and aligned scale labels", () => {
  const records = [
    { date: "2026-09-28", weight: 72 },
    { date: "2026-09-29", weight: 80 },
    { date: "2026-09-30", weight: 76 }
  ];
  const width = 760, height = 240, padding = 30;
  const html = ctx.createLineChartHTML("Weight", "weight", "kg", records);
  const svg = html.match(/<svg[\s\S]*?<\/svg>/)[0];
  assert.doesNotMatch(svg, /<circle\b/);
  assert.match(svg, /preserveAspectRatio="none"/);
  assert.match(svg, /class="chart-line"[\s\S]*?vector-effect="non-scaling-stroke"/);
  assert.strictEqual((svg.match(/class="chart-grid"[\s\S]*?vector-effect="non-scaling-stroke"/g) || []).length, 3);

  const plottedPoints = ctx.createChartPoints(records, "weight", width, height, padding, { zeroBaseline: false });
  const renderedPositions = Array.from(html.matchAll(/class="chart-point"[\s\S]*?style="left:([\d.]+)%;top:([\d.]+)%"/g), (match) => ({
    left: Number(match[1]), top: Number(match[2])
  }));
  assert.strictEqual(renderedPositions.length, plottedPoints.length);
  renderedPositions.forEach((position, index) => {
    assert.ok(position.left >= 0 && position.left <= 100);
    assert.ok(position.top >= 0 && position.top <= 100);
    assert.ok(Math.abs(position.left - plottedPoints[index].x / width * 100) < 0.001);
    assert.ok(Math.abs(position.top - plottedPoints[index].y / height * 100) < 0.001);
  });

  const scale = ctx.getChartValueScale(records, "weight", { zeroBaseline: false });
  assert.strictEqual(scale.max, 80.8);
  assert.strictEqual(scale.min, 71.2);
  records.forEach((record, index) => {
    const scalePosition = height - padding - ((record.weight - scale.min) / (scale.max - scale.min)) * (height - padding * 2);
    assert.ok(Math.abs(renderedPositions[index].top - scalePosition / height * 100) < 0.001);
  });
  assert.match(html, /class="chart-point"[\s\S]*?aria-hidden="true"/);
  assert.match(html, /class="chart-point"[\s\S]*?title="[^"]+"/);
  assert.doesNotMatch(html.match(/class="chart-point"[\s\S]*?<\/span>/g).join(""), /\btabindex=|\brole=/);
  assert.match(html, /<section class="progress-chart" aria-label="Weight trend\. Latest value: 76\.0 kg\. Range: 72\.0 to 80\.0 kg\.">/);

  const topLabel = Number(html.match(/class="progress-chart-y-label" data-axis="top" style="top:([\d.]+)%"/)[1]);
  const bottomLabel = Number(html.match(/class="progress-chart-y-label" data-axis="bottom" style="top:([\d.]+)%"/)[1]);
  assert.strictEqual(Number(html.match(/class="progress-chart-y-label" data-axis="top"[^>]*>([^<]+)</)[1]), Number(scale.max.toFixed(1)));
  assert.strictEqual(Number(html.match(/class="progress-chart-y-label" data-axis="bottom"[^>]*>([^<]+)</)[1]), Number(scale.min.toFixed(1)));
  const gridLines = Array.from(html.matchAll(/<line\b[^>]*\/>/g), (match) => match[0]);
  const topGridY = Number(gridLines.find((line) => line.includes('data-axis="top"')).match(/y1="([\d.]+)"/)[1]);
  const bottomGridY = Number(gridLines.find((line) => line.includes('data-axis="bottom"')).match(/y1="([\d.]+)"/)[1]);
  assert.strictEqual(topLabel, Number((topGridY / height * 100).toFixed(3)));
  assert.strictEqual(bottomLabel, Number((bottomGridY / height * 100).toFixed(3)));
});

test("history list uses the selected calendar window in newest-first order", () => {
  values.clear();
  const dateAtOffset = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return ctx.getDateKey(date);
  };
  [1, 8].forEach((offset) => {
    const date = dateAtOffset(offset);
    ctx.savePlannerFor(date, { date, steps: 1000 * offset, workouts: [], tasks: [] });
    ctx.saveProgressRecord(date);
  });
  const visible = ctx.getVisibleHistoryRecords(7);
  assert.strictEqual(visible.length, 1);
  assert.strictEqual(visible[0].date, dateAtOffset(1));
});

test("R6-1 History range summary and consistency use only logged days in the selected range", () => {
  values.clear();
  const dateAtOffset = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return ctx.getDateKey(date);
  };
  const history = {};
  [0, 1, 2, 4, 5].forEach((offset, index) => {
    const date = dateAtOffset(offset);
    history[date] = {
      date,
      calories: 1800 + index * 100,
      weight: index === 0 ? 79 : index === 4 ? 80 : null,
      completedWorkouts: index < 2 ? 1 : 0,
      foods: [{ name: "Meal" }],
      workouts: index < 2 ? [{ completed: true }] : [],
      tasks: []
    };
  });
  history[dateAtOffset(3)] = { date: dateAtOffset(3), calories: 0, weight: null, foods: [], workouts: [], tasks: [] };
  ctx.writeJSON("macrobay_history", history);
  vm.runInContext("historyRange = 7", ctx);

  const visible = ctx.getVisibleHistoryRecords(7);
  const consistency = ctx.getHistoryConsistency(visible, 7);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(consistency)), { currentStreak: 3, bestStreak: 3, daysLogged: 5 });
  const summary = ctx.createHistorySummaryHTML(visible);
  assert.match(summary, /7 DAY AVG CALORIES/);
  assert.match(summary, /WORKOUTS COMPLETED/);
  assert.match(summary, /<strong>\s*2\s*<\/strong>/);
  assert.match(summary, /DAYS LOGGED/);
  assert.match(summary, /<strong>\s*5\s*<\/strong>/);

  const consistencyHTML = ctx.createHistoryConsistencyHTML(visible);
  assert.match(consistencyHTML, /Current streak[\s\S]*?>3 <small>days/);
  assert.match(consistencyHTML, /Best streak[\s\S]*?>3 <small>days/);
});

test("weight change uses first and last weigh-ins inside the calendar window", () => {
  values.clear();
  const dateAtOffset = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return ctx.getDateKey(date);
  };
  [
    [9, 70],
    [6, 72],
    [1, 73.1]
  ].forEach(([offset, weight]) => {
    const date = dateAtOffset(offset);
    ctx.savePlannerFor(date, { date, weight, workouts: [], tasks: [] });
    ctx.saveProgressRecord(date);
  });
  assert.ok(Math.abs(ctx.getWeightChange(7) - 1.1) < 0.001);

  values.clear();
  const onlyDate = dateAtOffset(2);
  ctx.savePlannerFor(onlyDate, { date: onlyDate, weight: 72.5, workouts: [], tasks: [] });
  ctx.saveProgressRecord(onlyDate);
  assert.strictEqual(ctx.getWeightChange(7), null);
  assert.strictEqual(ctx.formatHistoryDecimal(ctx.getWeightChange(7)), "—");
});

test("rest timer counts from a deadline, resumes after pause, and restarts its preset", () => {
  let now = 0;
  let timerId = 0;
  let beepCount = 0;
  const intervals = new Map();
  const listeners = {};
  function button(dataset) {
    const handlers = {};
    return {
      dataset: dataset || {},
      textContent: "",
      addEventListener(type, handler) { handlers[type] = handler; },
      click() { handlers.click(); }
    };
  }
  const start = button();
  const reset = button();
  const presets = [{ value: "30" }, { value: "60" }, { value: "90" }, { value: "120" }].map((item) => button({ preset: item.value }));
  const readout = { innerHTML: "" };
  const ring = { r: { baseVal: { value: 90 } }, style: {} };
  const elements = { "timer-readout": readout, "timer-start": start, "timer-reset": reset };
  const audioContext = function () {
    beepCount += 1;
    this.currentTime = 0;
    this.destination = {};
    this.createOscillator = () => ({ connect() {}, frequency: {}, start() {}, stop() {} });
    this.createGain = () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  };
  class FakeDate extends Date { static now() { return now; } }
  const document = {
    body: { getAttribute() { return "resttimer"; } },
    addEventListener(type, handler) { listeners[type] = handler; },
    getElementById(id) { return elements[id] || null; },
    querySelector(selector) { return selector === ".timer-ring .fg" ? ring : null; },
    querySelectorAll() { return presets; }
  };
  const sandbox = {
    document,
    window: { AudioContext: audioContext },
    Date: FakeDate,
    setInterval(handler) { const id = ++timerId; intervals.set(id, handler); return id; },
    clearInterval(id) { intervals.delete(id); }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../calculators.js", "utf8"), sandbox);
  listeners.DOMContentLoaded();
  const tick = () => Array.from(intervals.values()).at(-1)();

  start.click();
  now += 1250;
  tick();
  assert.match(readout.innerHTML, /0:59/);
  start.click();
  now += 10000;
  start.click();
  now += 1000;
  tick();
  assert.match(readout.innerHTML, /0:58/);

  now += 58000;
  tick();
  assert.match(readout.innerHTML, /0:00/);
  assert.strictEqual(beepCount, 1);
  start.click();
  assert.match(readout.innerHTML, /1:00/);
  now += 1000;
  tick();
  assert.match(readout.innerHTML, /0:59/);
  assert.strictEqual(beepCount, 1);
});

test("standalone calculator checks reject out-of-range body measurements", () => {
  const shortHeight = submitStandaloneCalculator("bmi", { height: 49, weight: 70 });
  assert.match(shortHeight.empty.textContent, /Height must be between 50 and 272 cm/);
  const highWeight = submitStandaloneCalculator("bmi", { height: 170, weight: 501 });
  assert.match(highWeight.empty.textContent, /Weight must be between 2 and 500 kg/);
  const devine = submitStandaloneCalculator("idealweight", { height: 100, sex: "m" });
  assert.match(devine.empty.textContent, /not meaningful below 152 cm/);
});

test("B12 Mifflin-St Jeor calculators require adult ages while Max HR keeps its wider range", () => {
  const caloriesValues = { age: 18, height: 180, weight: 80, activity: "1.2", goal: "maintain" };
  const underageCalories = submitStandaloneCalculator("calories", { ...caloriesValues, age: 17 });
  assert.match(underageCalories.empty.textContent, /These estimates are for adults aged 18 and over/);
  const adultCalories = submitStandaloneCalculator("calories", caloriesValues);
  assert.strictEqual(adultCalories.content.hidden, false);
  const overageCalories = submitStandaloneCalculator("calories", { ...caloriesValues, age: 101 });
  assert.match(overageCalories.empty.textContent, /100 years or younger/);

  const bmrValues = { sex: "m", age: 18, height: 180, weight: 80 };
  assert.match(submitStandaloneCalculator("bmr", { ...bmrValues, age: 17 }).empty.textContent, /adults aged 18 and over/);
  assert.strictEqual(submitStandaloneCalculator("bmr", bmrValues).content.hidden, false);
  assert.match(submitStandaloneCalculator("bmr", { ...bmrValues, age: 101 }).empty.textContent, /100 years or younger/);
  assert.strictEqual(submitStandaloneCalculator("maxhr", { age: 17 }).content.hidden, false);

  ["calories/index.html", "bmr/index.html"].forEach((page) => {
    const source = fs.readFileSync(__dirname + "/../" + page, "utf8");
    assert.match(source, /id="age"[^>]*min="18" max="100"/);
  });
});

test("B16 calculator exceptions are logged while the user still gets a friendly error", () => {
  const injected = new Error("injected calculator defect");
  const result = submitStandaloneCalculator("bmr", {
    age: 30, height: 180, weight: 80, sex: "m"
  }, undefined, {
    calculateBMR() { throw injected; }
  });

  assert.match(result.empty.textContent, /check your inputs and try again/i);
  assert.strictEqual(result.loggedErrors.length, 1);
  assert.strictEqual(result.loggedErrors[0][1], injected);
});

test("standalone calorie and BMR calculators share target engine functions", () => {
  const profile = { sex: "female", age: 25, height: 168, weight: 64 };
  const bmr = ctx.calculateBMR(profile);
  const tdee = ctx.calculateTDEE(bmr, "moderate");
  const target = ctx.calculateCalorieTarget(tdee, "lose", "female");
  const calories = submitStandaloneCalculator("calories", {
    sex: "f", age: profile.age, height: profile.height, weight: profile.weight,
    activity: "1.55", goal: "lose"
  });
  const basal = submitStandaloneCalculator("bmr", {
    sex: "f", age: profile.age, height: profile.height, weight: profile.weight
  });
  assert.match(calories.content.innerHTML, new RegExp("<strong>" + Math.round(target) + "</strong>"));
  assert.match(basal.content.innerHTML, new RegExp("<strong>" + Math.round(bmr) + "</strong>"));
});

test("R5-3 calories calculator gain target matches the calorie-floor engine", () => {
  [
    { sex: "f", age: 100, height: 140, weight: 40, activity: "1.2", goal: "gain", activityName: "sedentary" },
    { sex: "m", age: 25, height: 180, weight: 80, activity: "1.55", goal: "gain", activityName: "moderate" }
  ].forEach((input) => {
    const engineProfile = {
      sex: input.sex === "f" ? "female" : "male",
      age: input.age, height: input.height, weight: input.weight
    };
    const tdee = ctx.calculateTDEE(ctx.calculateBMR(engineProfile), input.activityName);
    const expected = ctx.calculateCalorieTarget(tdee, "gain", engineProfile.sex);
    const result = submitStandaloneCalculator("calories", input);
    assert.match(result.content.innerHTML, new RegExp("<strong>" + Math.round(expected) + "</strong>"));
  });
});

test("R5-4 progression insight uses each history key when a record has no date", () => {
  const keys = [];
  for (let offset = 3; offset >= 1; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    keys.push(ctx.getDateKey(date));
  }
  const makeRecord = (date, includeDate) => ({
    ...(includeDate ? { date } : {}),
    workouts: [{
      name: "Strength", completed: true,
      exercises: [{ name: "Squat", sets: [{ reps: 8, weight: 60 }] }]
    }]
  });
  const results = [false, true].map((includeDate) => {
    const history = {};
    keys.forEach((date) => { history[date] = makeRecord(date, includeDate); });
    ctx.writeJSON("macrobay_history", history);
    return ctx.getWorkoutProgressionInsights();
  });
  assert.deepStrictEqual(results[0], results[1]);
  assert.ok(results[0].some((insight) => insight.includes("Squat") && insight.includes("three sessions")));
});

test("R5-5 null exercises, sets, and legacy templates are safe to read", () => {
  values.clear();
  const today = ctx.getDateKey(new Date());
  ctx.writeJSON("macrobay_history", {
    [today]: {
      workouts: [{
        name: "Legacy workout", completed: true,
        exercises: [null, { name: "Squat", sets: [null] }]
      }]
    }
  });
  assert.doesNotThrow(() => ctx.getAdaptivePlan());
  assert.strictEqual(ctx.hasWorkoutPerformance({ exercises: [null] }), false);
  assert.strictEqual(ctx.hasWorkoutPerformance({ exercises: [{ sets: [null] }] }), false);
  assert.doesNotThrow(() => ctx.createHistoryRecordHTML({
    date: today, weight: null, calories: 0, water: 0, protein: 0, carbs: 0, fat: 0, steps: 0,
    workouts: [{ name: "Legacy workout", exercises: [null, { name: "Squat", sets: [null] }] }],
    tasks: [], foods: [], completedWorkouts: 0, completedTasks: 0
  }));

  assert.doesNotThrow(() => loadPlannerSandbox({
    initialStorage: {
      macrobay_planner: {
        "2026-01-15": {
          date: "2026-01-15", workouts: [{
            id: "malformed", name: "Legacy workout", completed: true,
            exercises: [null, { name: "Squat", sets: [null] }]
          }],
          tasks: []
        }
      }
    }
  }));

  const planner = loadPlannerSandbox();
  planner.sandbox.saveWorkoutTemplates([{ name: "Old template" }]);
  assert.doesNotThrow(() => planner.sandbox.renderWorkoutTemplates());
  const created = planner.sandbox.createWorkoutTemplate("New template", null);
  assert.deepStrictEqual(Array.from(created.exercises), []);
});

test("Workout templates tolerate corrupt storage and replace names ignoring case and extra spaces", () => {
  const planner = loadPlannerSandbox();
  planner.sandbox.saveWorkoutTemplates({ invalid: true });
  const first = planner.sandbox.createWorkoutTemplate("  Upper   Body ", [{ name: "Press" }]);
  assert.ok(first);
  assert.deepStrictEqual(JSON.parse(planner.storage.get("macrobay_workout_templates")), [
    { name: "Upper   Body", exercises: [{ name: "Press" }] }
  ]);

  const replacement = planner.sandbox.createWorkoutTemplate("upper body", [{ name: "Row" }]);
  assert.ok(replacement);
  const saved = JSON.parse(planner.storage.get("macrobay_workout_templates"));
  assert.strictEqual(saved.length, 1);
  assert.deepStrictEqual(saved[0].exercises, [{ name: "Row" }]);
});

test("Saving an existing workout template asks before overwriting", async () => {
  const planner = loadPlannerSandbox({ initialStorage: {
    macrobay_planner: { "2026-01-15": { date: "2026-01-15", workouts: [
      { id: "w1", name: "Upper Body", exercises: [{ name: "Press", sets: [] }] }
    ], tasks: [] } },
    macrobay_workout_templates: [{ name: " upper   body ", exercises: [{ name: "Old" }] }]
  } });
  let confirmed = 0;
  planner.sandbox.window.macrobayDialog.confirm = async () => { confirmed++; return false; };
  planner.getElement("template-workout-select").value = "w1";
  await planner.getElement("save-workout-template").click();
  assert.strictEqual(confirmed, 1);
  assert.deepStrictEqual(JSON.parse(planner.storage.get("macrobay_workout_templates")), [
    { name: " upper   body ", exercises: [{ name: "Old" }] }
  ]);
});

test("Templates tab loads a saved template into the selected day and deletes it", async () => {
  const planner = loadPlannerSandbox();
  planner.sandbox.saveWorkoutTemplates([{ name: "Push day", exercises: [{ name: "Press" }, { name: "Row" }] }]);
  planner.sandbox.renderWorkoutTemplates();
  const templateList = planner.getElement("template-list");
  const loadButton = templateList.querySelectorAll(".load-template")[0];
  await loadButton.click();
  const loaded = planner.sandbox.getPlanner().workouts[0];
  assert.strictEqual(loaded.name, "Push day");
  assert.deepStrictEqual(Array.from(loaded.exercises, (exercise) => exercise.name), ["Press", "Row"]);

  const deleteButton = templateList.querySelectorAll(".delete-template")[0];
  await deleteButton.click();
  assert.deepStrictEqual(JSON.parse(planner.storage.get("macrobay_workout_templates")), []);
});

test("R5-6 Settings reset and import refresh shared units without changing Profile measurements", async () => {
  const reset = loadProfileSandbox();
  reset.sandbox.saveProfile(male);
  reset.sandbox.saveMacroBayPreferences({ units: { weight: "lb", height: "ft-in" } });
  reset.sandbox.populateProfileForm(male);
  reset.sandbox.populateUnitPreferences();
  assert.strictEqual(reset.getElement("unit-weight").value, "lb");
  await reset.getElement("reset-data").click();
  assert.strictEqual(reset.getElement("unit-weight").value, "kg");
  assert.strictEqual(reset.getElement("unit-height").value, "cm");
  assert.strictEqual(reset.getElement("profile-weight").min, "30");
  assert.strictEqual(reset.getElement("profile-weight").max, "300");
  assert.strictEqual(reset.getElement("profile-height").hidden, false);
  assert.strictEqual(reset.getElement("profile-height-imperial").hidden, true);

  const source = loadProfileSandbox();
  source.sandbox.saveProfile(male);
  source.sandbox.saveMacroBayPreferences({ units: { weight: "kg", height: "cm" } });
  const backup = source.sandbox.exportMacroBayData();
  const imported = loadProfileSandbox();
  imported.sandbox.saveProfile(male);
  imported.sandbox.saveMacroBayPreferences({ units: { weight: "lb", height: "ft-in" } });
  imported.sandbox.populateProfileForm(male);
  imported.sandbox.populateUnitPreferences();
  const fileInput = imported.getElement("import-data-file");
  fileInput.files = [{ text: async () => JSON.stringify(backup) }];
  await fileInput.handlers.change();
  assert.strictEqual(imported.getElement("unit-weight").value, "kg");
  assert.strictEqual(imported.getElement("unit-height").value, "cm");
  assert.strictEqual(imported.getElement("profile-weight").min, "30");
  assert.strictEqual(imported.getElement("profile-height").hidden, false);
});

test("R5-8 planner copy describes actions on the selected day and workout", () => {
  const plannerHTML = fs.readFileSync(__dirname + "/../planner/index.html", "utf8");
  const plannerJS = fs.readFileSync(__dirname + "/../planner.js", "utf8");
  assert.match(plannerHTML, /Reset steps for this day/);
  assert.match(plannerJS, /Remove this exercise from this workout\?/);
});

test("R5-9 dashboard counts tasks as complete only when completed is true", () => {
  values.clear();
  const today = ctx.getDateKey(new Date());
  ctx.savePlannerFor(today, {
    date: today, workouts: [], tasks: [{ name: "Legacy task", done: true, completed: false }]
  });
  const originalGetElementById = ctx.document.getElementById;
  const dashboardElements = new Map();
  ctx.document.getElementById = function (id) {
    if (!dashboardElements.has(id)) dashboardElements.set(id, { textContent: "", style: {}, closest() { return null; } });
    return dashboardElements.get(id);
  };
  try {
    ctx.updateDashboardText();
    assert.strictEqual(ctx.getDashboardDailyProgress(), 0);
    assert.strictEqual(dashboardElements.get("terminal-tasks").textContent, "0 / 1 complete");
  } finally {
    ctx.document.getElementById = originalGetElementById;
  }
});

test("Home shows today’s workout status or an Activity link when no workout is planned", () => {
  values.clear();
  const today = ctx.getDateKey(new Date());
  ctx.savePlannerFor(today, { date: today, workouts: [], tasks: [] });
  const originalGetElementById = ctx.document.getElementById;
  const dashboardElements = new Map();
  ctx.document.getElementById = function (id) {
    if (!dashboardElements.has(id)) dashboardElements.set(id, { textContent: "", hidden: false, style: {}, closest() { return null; } });
    return dashboardElements.get(id);
  };
  try {
    ctx.updateDashboardText();
    assert.strictEqual(dashboardElements.get("home-workout-summary").hidden, true);
    assert.strictEqual(dashboardElements.get("home-workout-empty").hidden, false);

    ctx.savePlannerFor(today, {
      date: today,
      workouts: [{ name: "Strength", completed: false }, { name: "Cycle", completed: true }],
      tasks: []
    });
    ctx.updateDashboardText();
    assert.strictEqual(dashboardElements.get("home-workout-summary").hidden, false);
    assert.strictEqual(dashboardElements.get("home-workout-empty").hidden, true);
    assert.strictEqual(dashboardElements.get("terminal-workout").textContent, "1 / 2 complete");
    assert.strictEqual(dashboardElements.get("terminal-workout-name").textContent, "Strength · planned, Cycle · done");
  } finally {
    ctx.document.getElementById = originalGetElementById;
  }
});

test("Home keeps Quick Tools while the searchable fourteen-row directory lives on Calculators", () => {
  const home = fs.readFileSync(__dirname + "/../index.html", "utf8");
  const calculators = fs.readFileSync(__dirname + "/../calculators/index.html", "utf8");
  assert.doesNotMatch(home, /calculator-directory|calculator-search-input|calculator-filter-chips|calculator-directory-row/);
  assert.match(home, /home-quick-tools-heading[^>]*>Quick Tools/);
  ["bmi/index.html", "calories/index.html", "macro/index.html", "protein/index.html", "calculators/index.html"].forEach((href) => {
    assert.ok(home.includes(`href="${href}"`), `Home should link to ${href}`);
  });
  assert.match(home, /home-workout-empty/);
  assert.match(home, /href="planner\/index\.html">Plan a workout/);
  assert.match(calculators, /id="calculator-search-input"/);
  assert.match(calculators, /class="calculator-filter-chips"/);
  const rows = Array.from(calculators.matchAll(/<a class="calculator-directory-row" href="([^"]+)" data-category="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g));
  assert.strictEqual(rows.length, 14);
  rows.forEach(([markup, href, category, content]) => {
    assert.ok(["body", "nutrition", "activity", "health"].includes(category), `${href} has a valid category`);
    assert.match(content, /<span class="calculator-row-icon"[^>]*><svg/);
    assert.match(content, /class="calculator-row-chevron"/);
    assert.ok(fs.existsSync(path.resolve(__dirname, "../calculators", href)), `${href} resolves to a calculator page`);
  });
  [
    ["../maxhr/index.html", "health", "Max Heart Rate", "Estimate your maximum heart rate"],
    ["../sleep/index.html", "health", "Sleep Planner", "Plan bedtimes around sleep cycles"],
    ["../water/index.html", "nutrition", "Water Intake", "Find your daily water target"],
    ["../steptocalories/index.html", "activity", "Steps Calories", "Turn your steps into calories burned"],
    ["../exercisecalories/index.html", "activity", "Workout Calories", "Estimate calories burned in a workout"],
    ["../resttimer/index.html", "activity", "Rest Timer", "Time your rest between sets"]
  ].forEach(([href, category, title, description]) => {
    const row = rows.find(([, rowHref]) => rowHref === href);
    assert.ok(row, `${title} directory row exists`);
    assert.strictEqual(row[2], category);
    assert.match(row[3], new RegExp(`<strong>${title}<\\/strong>`));
    assert.ok(row[3].includes(description));
  });
  assert.match(calculators, /id="calculator-no-results"[^>]*hidden/);
  assert.match(calculators, /data-category="all"[^>]*>All/);
  assert.match(calculators, /data-category="body"[^>]*>Body/);
  assert.match(calculators, /data-category="nutrition"[^>]*>Nutrition/);
  assert.match(calculators, /data-category="activity"[^>]*>Activity/);
  assert.match(calculators, /data-category="health"[^>]*>Health/);
  assert.match(fs.readFileSync(__dirname + "/../calculators.js", "utf8"), /row\("maintenance tdee"/);
  assert.match(calculators, /<script src="\.\.\/calculator-directory\.js"><\/script>/);
});

test("Calculator directory search, category chips, and empty state cover all rows", () => {
  const html = fs.readFileSync(__dirname + "/../calculators/index.html", "utf8");
  const rowMatches = Array.from(html.matchAll(/<a class="calculator-directory-row" href="([^"]+)" data-category="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g));
  const rows = rowMatches.map(([, href, category, content]) => ({
    href,
    dataset: { category },
    textContent: content.replace(/<[^>]+>/g, " "),
    hidden: false
  }));
  const categories = ["all", "body", "nutrition", "activity", "health"];
  const filters = categories.map((category, index) => {
    const classes = new Set(index === 0 ? ["active"] : []);
    const attributes = { "aria-pressed": String(index === 0) };
    const filter = {
      dataset: { category },
      addEventListener(type, handler) { this.handler = handler; },
      click() { this.handler(); },
      setAttribute(name, value) { attributes[name] = value; },
      getAttribute(name) { return attributes[name]; },
      classList: {
        toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      }
    };
    return filter;
  });
  const search = { value: "", addEventListener(type, handler) { this.handler = handler; } };
  const emptyState = { hidden: true };
  const directory = {
    querySelectorAll(selector) { return selector === ".calculator-directory-row" ? rows : filters; }
  };
  const document = {
    getElementById(id) {
      return id === "calculator-directory" ? directory
        : id === "calculator-search-input" ? search
          : id === "calculator-no-results" ? emptyState : null;
    }
  };
  const sandbox = { document };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../calculator-directory.js", "utf8"), sandbox);
  const visibleCount = () => rows.filter((row) => !row.hidden).length;

  assert.strictEqual(visibleCount(), 14);
  [["body", 3], ["nutrition", 4], ["activity", 4], ["health", 3]].forEach(([category, expected]) => {
    filters.find((filter) => filter.dataset.category === category).click();
    assert.strictEqual(visibleCount(), expected, `${category} chip filters rows`);
    assert.strictEqual(filters.find((filter) => filter.dataset.category === category).getAttribute("aria-pressed"), "true");
  });
  filters.find((filter) => filter.dataset.category === "health").click();
  search.value = "heart";
  search.handler();
  assert.strictEqual(visibleCount(), 1);
  assert.match(rows.find((row) => !row.hidden).href, /maxhr/);
  search.value = "no matching calculator";
  search.handler();
  assert.strictEqual(visibleCount(), 0);
  assert.strictEqual(emptyState.hidden, false);
  search.value = "";
  search.handler();
  assert.strictEqual(visibleCount(), 3);
  assert.strictEqual(emptyState.hidden, true);
  filters.find((filter) => filter.dataset.category === "all").click();
  assert.strictEqual(visibleCount(), 14);
});

test("R5-10 food amount limit applies after serving conversion and matches the input max", () => {
  const app = loadNutritionSandbox();
  const name = app.getElement("food-name");
  const amount = app.getElement("food-amount");
  const unit = app.getElement("food-amount-unit");
  const add = app.getElement("add-food");
  name.value = "oats";
  amount.value = "10000";
  unit.value = "grams";
  app.getElement("food-meal").value = "Breakfast";
  add.click();
  assert.strictEqual(app.sandbox.getNutrition().foods[0].amount, 10000);

  app.sandbox.window.macrobayPendingFood = {
    name: "oats", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6,
    servingGrams: 10001, source: "test"
  };
  name.value = "oats";
  amount.value = "1";
  unit.value = "servings";
  add.click();
  assert.strictEqual(app.sandbox.getNutrition().foods.length, 1);
  assert.ok(app.toasts.some((toast) => toast.type === "error" && toast.message.includes("10,000 g")));
  const html = fs.readFileSync(__dirname + "/../nutrition/index.html", "utf8");
  assert.match(html, /id="food-amount"[^>]*max="10000"/);
});

test("nutrition serving units scale live food values and preserve unknown nutrients", () => {
  const app = loadNutritionSandbox();
  const food = app.sandbox.findFood("oats");
  const cup = app.sandbox.calculateLoggedFood(food, 1, "Breakfast", "cup");
  assert.strictEqual(cup.amount, 81);
  assert.ok(Math.abs(cup.calories - 315.09) < 1e-9);
  app.getElement("food-name").value = "oats";
  app.getElement("food-amount").value = "1";
  app.getElement("food-amount-unit").value = "cup";
  app.sandbox.updateNutritionFoodPreview();
  assert.match(app.getElement("food-nutrition-preview").textContent, /1 cup · 81 g used · 315\.1 kcal.*13\.7 g protein.*53\.5 g carbs/);
  const serving = app.sandbox.calculateLoggedFood(Object.assign({}, food, { servingGrams: 45 }), 2, "Breakfast", "serving");
  assert.strictEqual(serving.amount, 90);
  assert.ok(Math.abs(serving.calories - 350.1) < 1e-9);
  const egg = app.sandbox.findFood("egg");
  const oneEgg = app.sandbox.calculateLoggedFood(egg, 1, "Breakfast", "piece");
  assert.strictEqual(oneEgg.amount, 50);
  app.getElement("food-name").value = "egg";
  app.getElement("food-amount").value = "1";
  app.getElement("food-amount-unit").value = "piece";
  app.sandbox.updateNutritionFoodPreview();
  assert.match(app.getElement("food-nutrition-preview").textContent, /1 piece · 50 g used/);
  assert.ok(!app.sandbox.supportedFoodUnits(app.sandbox.findFood("white rice")).includes("piece"));
  assert.ok(!app.sandbox.supportedFoodUnits(app.sandbox.findFood("milk")).includes("piece"));
  vm.runInContext("foodDatabase", app.sandbox).forEach(function (item) {
    assert.ok(item.servingGrams > 0, item.name + " needs an explicit serving weight");
    item.units.forEach(function (unit) {
      if (unit === "g" || unit === "serving") return;
      assert.ok(item.unitGrams[unit] > 0, item.name + " needs an explicit " + unit + " conversion");
    });
  });
  const incomplete = app.sandbox.calculateLoggedFood({ name: "Partial", calories: null, protein: 1, carbs: null, fat: 0, fiber: null }, 100, "Snack", "g");
  assert.strictEqual(incomplete.calories, null);
  assert.strictEqual(incomplete.carbs, null);
  assert.strictEqual(incomplete.fat, 0);
  const day = { foods: [incomplete] };
  app.sandbox.recalculateNutritionTotals(day);
  assert.strictEqual(day.calories, null);
  assert.strictEqual(day.fat, 0);
});

test("food amount units convert to grams before scaling per-100g macros", () => {
  const app = loadNutritionSandbox();
  const get = (name) => app.sandbox.findFood(name);
  const calculate = (name, amount, unit) => app.sandbox.calculateLoggedFood(get(name), amount, "Snack", unit);
  assert.strictEqual(calculate("egg", 100, "g").amount, 100);
  assert.strictEqual(calculate("egg", 1, "oz").amount, 28.35);
  assert.ok(Math.abs(calculate("milk", 100, "ml").amount - 244 / 240 * 100) < 1e-9);
  assert.ok(Math.abs(calculate("milk", 1, "tsp").amount - 244 / 48) < 1e-9);
  assert.ok(Math.abs(calculate("milk", 1, "tbsp").amount - 244 / 16) < 1e-9);
  assert.strictEqual(calculate("milk", 1, "cup").amount, 244);
  assert.ok(Math.abs(calculate("milk", 1, "glass").amount - 244 * 250 / 240) < 1e-9);
  const milk = get("milk");
  ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass"].forEach((unit) => {
    const grams = unit === "g" ? 1 : (unit === "oz" ? 28.35 : milk.unitGrams[unit]);
    const sameWeight = app.sandbox.calculateLoggedFood(milk, 100 / grams, "Snack", unit);
    assert.ok(Math.abs(sameWeight.amount - 100) < 1e-9, unit + " should resolve to the same 100 g portion");
    assert.ok(Math.abs(sameWeight.calories - milk.calories) < 1e-9, unit + " should preserve per-100g calories");
  });
  assert.strictEqual(calculate("lentils", 2, "katori").amount, 297);
  assert.strictEqual(calculate("egg", 1, "piece").amount, 50);
  assert.strictEqual(calculate("whole wheat bread", 1, "slice").amount, 28);
  assert.strictEqual(calculate("oats", 2, "serving").amount, 80);
  const riceCup = calculate("white rice", 1, "cup");
  assert.strictEqual(riceCup.calories, 205.4);
  assert.strictEqual(app.getElement("food-amount-label").textContent, "Amount");
  app.getElement("food-name").value = "lentils";
  app.sandbox.window.updateNutritionFoodUnits(get("lentils"));
  app.getElement("food-amount").value = "2";
  app.getElement("food-amount-unit").value = "katori";
  app.sandbox.updateFoodAmountLabel();
  app.sandbox.updateNutritionFoodPreview();
  assert.strictEqual(app.getElement("food-amount-label").textContent, "Amount");
  assert.match(app.getElement("food-nutrition-preview").textContent, /2 katori ≈ 297 g/);
});

test("food unit choices follow verified food portions and imperial preferences", () => {
  const app = loadNutritionSandbox();
  const units = (name) => Array.from(app.sandbox.supportedFoodUnits(app.sandbox.findFood(name)));
  assert.deepStrictEqual(units("egg"), ["g", "oz", "piece"]);
  assert.deepStrictEqual(units("banana"), ["g", "oz", "piece"]);
  assert.deepStrictEqual(units("milk"), ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass"]);
  assert.deepStrictEqual(units("white rice"), ["g", "oz", "katori", "cup", "serving"]);
  assert.ok(!units("white rice").includes("piece"));
  assert.deepStrictEqual(units("curd or dahi, plain whole-milk (yogurt equivalent)"), ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass"]);
  assert.deepStrictEqual(Array.from(app.sandbox.supportedFoodUnits({ name: "Unverified food", units: ["g"] })), ["g", "oz"]);

  app.sandbox.saveMacroBayPreferences({ units: { weight: "lb" } });
  app.sandbox.window.updateNutritionFoodUnits({ name: "Unverified food", calories: 100, protein: 1, carbs: 1, fat: 1, units: ["g"], defaultUnit: "g" });
  assert.strictEqual(app.getElement("food-amount-unit").value, "oz");
  assert.strictEqual(app.getElement("food-amount-label").textContent, "Amount");

  app.sandbox.rememberFoodAmountUnit(app.sandbox.findFood("egg"), "piece");
  app.sandbox.window.updateNutritionFoodUnits(app.sandbox.findFood("egg"));
  assert.strictEqual(app.getElement("food-amount-unit").value, "piece");
  assert.strictEqual(app.sandbox.getMacroBayPreferences().foodAmountUnits["egg\u0000"], "piece");
});

test("custom food portion weights enable only their measured units", () => {
  const app = loadNutritionSandbox();
  const custom = { name: "Measured porridge", calories: 100, protein: 4, carbs: 15, fat: 2, fiber: 3, servingGrams: 200,
    pieceGrams: 50, tablespoonGrams: 15, cupGrams: 240, katoriGrams: 150 };
  assert.strictEqual(app.sandbox.saveCustomFood(custom), true);
  const food = app.sandbox.findFood(custom.name);
  assert.strictEqual(food.unitGrams.piece, 50);
  assert.strictEqual(food.unitGrams.tbsp, 15);
  assert.strictEqual(food.unitGrams.cup, 240);
  assert.strictEqual(food.unitGrams.katori, 150);
  assert.strictEqual(food.unitGrams.ml, 1);
  assert.strictEqual(food.unitGrams.glass, 250);
  assert.ok(food.units.includes("piece") && food.units.includes("katori") && food.units.includes("glass"));
  assert.ok(food.approximateUnits.includes("katori"));
  const html = fs.readFileSync(__dirname + "/../nutrition/index.html", "utf8");
  ["piece-grams", "tbsp-grams", "cup-grams", "katori-grams"].forEach((id) => assert.match(html, new RegExp("custom-food-" + id)));
});

test("legacy food logs migrate to the grams-based amount format without changing macros", () => {
  const app = loadNutritionSandbox();
  const today = app.sandbox.getDateKey(new Date());
  app.sandbox.saveNutritionFor(today, { foods: [
    { name: "egg", amount: 50, calories: 71.5, protein: 6.3, carbs: 0.35, fat: 4.75, fiber: 0, meal: "Breakfast" }
  ] });
  const migrated = app.sandbox.getNutrition().foods[0];
  assert.strictEqual(migrated.amount, 50);
  assert.strictEqual(migrated.amountGrams, 50);
  assert.strictEqual(migrated.enteredAmount, 50);
  assert.strictEqual(migrated.amountUnit, "g");
  assert.strictEqual(migrated.gramsPerUnit, 1);
  assert.strictEqual(migrated.calories, 71.5);
  const stored = JSON.parse(app.storage.get("macrobay_nutrition"))[today].foods[0];
  assert.strictEqual(stored.amountGrams, 50);
  assert.strictEqual(stored.calories, 71.5);

  app.sandbox.saveNutritionFor(today, { foods: [{
    name: "oats", amount: 13.2, enteredAmount: 2, amountUnit: "tbsp", calories: 51.348,
    protein: 2.2308, carbs: 8.712, fat: 0.9108, fiber: 1.3992, meal: "Breakfast"
  }] });
  const oldMeasured = app.sandbox.getNutrition().foods[0];
  assert.strictEqual(oldMeasured.amountGrams, 13.2);
  assert.strictEqual(oldMeasured.enteredAmount, 2);
  assert.strictEqual(oldMeasured.amountUnit, "tbsp");
  assert.strictEqual(oldMeasured.gramsPerUnit, 6.6);
  assert.strictEqual(oldMeasured.calories, 51.348);
  app.sandbox.editFood(0);
  assert.strictEqual(app.getElement("food-amount-unit").value, "tbsp");
  assert.strictEqual(Number(app.getElement("food-amount").value), 2);
  app.getElement("add-food").click();
  const savedMeasured = app.sandbox.getNutrition().foods[0];
  assert.strictEqual(savedMeasured.amountGrams, 13.2);
  assert.ok(Math.abs(savedMeasured.calories - 51.348) < 1e-9);
});

test("editing a food keeps its selected amount unit and quantity", () => {
  const app = loadNutritionSandbox();
  const today = app.sandbox.getDateKey(new Date());
  app.sandbox.saveNutritionFor(today, { foods: [{
    name: "oats", amount: 10, calories: 38.9, protein: 1.69, carbs: 6.6, fat: 0.69, fiber: 1.06,
    enteredAmount: 2, amountUnit: "tbsp", gramsPerUnit: 5, servingGrams: 40,
    unitGrams: { cup: 81, tbsp: 5, tsp: 1.7 }, units: ["g", "cup", "tbsp", "tsp", "serving"], meal: "Breakfast"
  }] });
  app.sandbox.rememberFoodAmountUnit(app.sandbox.findFood("oats"), "cup");
  app.sandbox.editFood(0);
  assert.strictEqual(app.getElement("food-amount-unit").value, "tbsp");
  assert.strictEqual(Number(app.getElement("food-amount").value), 2);
  app.getElement("add-food").click();
  const saved = app.sandbox.getNutrition().foods[0];
  assert.strictEqual(saved.amount, 10);
  assert.strictEqual(saved.enteredAmount, 2);
  assert.strictEqual(saved.amountUnit, "tbsp");
  assert.ok(Math.abs(saved.calories - 38.9) < 1e-9);
  app.sandbox.window.updateNutritionFoodUnits(app.sandbox.findFood("oats"));
  assert.strictEqual(app.getElement("food-amount-unit").value, "tbsp");
});

test("R5-11 weight chart summary, header, and tooltips use one decimal in pounds", () => {
  const html = ctx.createLineChartHTML("Weight", "weight", "lb", [
    { date: "2026-10-01", weight: 153.876 },
    { date: "2026-10-02", weight: 154.324 }
  ]);
  assert.match(html, /aria-label="Weight trend\. Latest value: 154\.3 lb\./);
  assert.match(html, /<small>\s*154\.3 lb\s*<\/small>/);
  assert.match(html, /title="[^\"]*: 154\.3 lb"/);
  assert.doesNotMatch(html, /Latest value: 154\.324|title="[^\"]*154\.324 lb"|<small>\s*154\.324 lb/);
});

test("A4 standalone calculators convert imperial inputs and outputs while calculating in metric", () => {
  const metric = submitStandaloneCalculator("bmi", { height: 180, weight: 80 });
  const imperial = submitStandaloneCalculator("bmi", {
    "height-feet": 5, "height-inches": 10.9, weight: 176.4
  }, { weight: "lb", height: "ft-in" });
  assert.match(metric.content.innerHTML, /kg\/m²/);
  assert.match(metric.content.innerHTML, /59\.9 kg – 80\.7 kg/);
  assert.match(imperial.content.innerHTML, /lb/);
  assert.match(imperial.content.innerHTML, /ft 10\.9 in/);
  assert.match(imperial.content.innerHTML, /132\.[0-9] lb/);
});

test("Step calories distance uses height units independently of weight units", () => {
  const poundsWithMetricHeight = submitStandaloneCalculator("steptocalories", { steps: 10000, weight: 150 }, {
    weight: "lb", height: "cm"
  });
  const kilogramsWithImperialHeight = submitStandaloneCalculator("steptocalories", { steps: 10000, weight: 68 }, {
    weight: "kg", height: "ft-in"
  });
  assert.match(poundsWithMetricHeight.content.innerHTML, /7\.62 km/);
  assert.match(kilogramsWithImperialHeight.content.innerHTML, /4\.73 mi/);
});

test("loading target.js on a standalone calculator does not write app targets", () => {
  const isolated = new Map();
  let writes = 0;
  const localStorage = {
    getItem(key) { return isolated.has(key) ? isolated.get(key) : null; },
    setItem(key, value) { writes += 1; isolated.set(key, String(value)); },
    removeItem(key) { isolated.delete(key); }
  };
  localStorage.setItem("macrobay_profile", JSON.stringify(male));
  writes = 0;
  const sandbox = {
    localStorage,
    document: { body: { hasAttribute(name) { return name === "data-calc"; } } },
    window: {}
  };
  vm.createContext(sandbox);
  ["constants.js", "store.js", "target.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox);
  });
  assert.strictEqual(writes, 0);
  assert.strictEqual(isolated.has("macrobay_targets"), false);
});

test("B1 history range controls remain available when the selected range is empty", () => {
  values.clear();
  const older = new Date();
  older.setDate(older.getDate() - 20);
  const olderKey = ctx.getDateKey(older);
  ctx.savePlannerFor(olderKey, { date: olderKey, steps: 4200, workouts: [], tasks: [] });
  ctx.saveProgressRecord(olderKey);

  const list = { innerHTML: "" };
  let rangeButtons = [];
  const document = {
    querySelector(selector) { return selector === "#history-list" ? list : null; },
    querySelectorAll(selector) {
      if (selector === "[data-delete-history-date]") return [];
      rangeButtons = [7, 30, 90].map((days) => {
        const handlers = {};
        return {
          dataset: { historyRange: String(days) },
          addEventListener(type, handler) { handlers[type] = handler; },
          click() { if (handlers.click) handlers.click(); }
        };
      });
      return rangeButtons;
    }
  };
  const page = {
    document,
    getVisibleHistoryRecords: ctx.getVisibleHistoryRecords,
    getProgressRecordsForDays: ctx.getProgressRecordsForDays,
    getProgressAverage: ctx.getProgressAverage,
    getWeightChange: ctx.getWeightChange,
    isProgressMetricLogged: ctx.isProgressMetricLogged,
    escapeHTML: ctx.escapeHTML,
    getMacroBayWeightUnit: ctx.getMacroBayWeightUnit,
    kilogramsToDisplayWeight: ctx.kilogramsToDisplayWeight
  };
  vm.createContext(page);
  vm.runInContext(fs.readFileSync(__dirname + "/../history.js", "utf8"), page);

  assert.match(list.innerHTML, /class="history-range"/);
  assert.match(list.innerHTML, /class="history-empty"/);
  rangeButtons[1].click();
  assert.match(list.innerHTML, /class="history-range"/);
  assert.match(list.innerHTML, /30 DAY AVG CALORIES/);
  assert.match(list.innerHTML, /DAILY RECORDS/);
  assert.match(list.innerHTML, /4,200/);
});

test("B2 averages and charts ignore days where the metric was not logged", () => {
  values.clear();
  const dateAtOffset = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return ctx.getDateKey(date);
  };
  const foodDate = dateAtOffset(1);
  const stepsDate = dateAtOffset(2);
  ctx.saveNutritionFor(foodDate, {
    calories: 2000, protein: 100, carbs: 220, fat: 60, fiber: 25,
    water: 1, foods: [{ name: "Lunch", calories: 2000 }]
  });
  ctx.saveProgressRecord(foodDate);
  ctx.savePlannerFor(stepsDate, { date: stepsDate, steps: 2000, workouts: [], tasks: [] });
  ctx.saveProgressRecord(stepsDate);

  assert.strictEqual(ctx.getProgressAverage("calories", 7), 2000);
  assert.strictEqual(ctx.getProgressAverage("steps", 7), 2000);
  const charts = ctx.createProgressChartsHTML();
  assert.strictEqual((charts.match(/class="chart-point"/g) || []).length, 3);
  assert.strictEqual(ctx.isProgressMetricLogged(ctx.getProgressRecord(stepsDate), "calories"), false);
});

test("B3 adaptive calorie guidance distinguishes over-target from near-target", () => {
  values.clear();
  const today = ctx.getDateKey(new Date());
  ctx.writeJSON("macrobay_targets", { calories: 2000, protein: 100 });
  ctx.saveNutritionFor(today, { calories: 3200, foods: [{ name: "Meal" }] });
  let suggestions = ctx.getAdaptivePlan();
  assert.ok(suggestions.some((item) => item.includes("1200 kcal over")));
  assert.ok(!suggestions.some((item) => item.includes("Calories are near target")));

  ctx.saveNutritionFor(today, { calories: 1900, foods: [{ name: "Meal" }] });
  suggestions = ctx.getAdaptivePlan();
  assert.ok(suggestions.some((item) => item.includes("Calories are near target")));

  ctx.saveNutritionFor(today, { calories: 1500, foods: [{ name: "Meal" }] });
  suggestions = ctx.getAdaptivePlan();
  assert.ok(suggestions.some((item) => item.includes("500 kcal remaining")));
});

test("B4 activity backfill runs once and records eligible days", () => {
  values.clear();
  const date = new Date();
  date.setDate(date.getDate() - 3);
  const key = ctx.getDateKey(date);
  ctx.saveNutritionFor(key, { calories: 500, foods: [{ name: "Meal" }] });
  ctx.backfillProgressFromActivity();
  assert.strictEqual(ctx.getProgressRecord(key).calories, 500);
  assert.strictEqual(values.get("macrobay_progress_backfill_v2"), "true");
  const savedHistory = values.get("macrobay_history");
  ctx.backfillProgressFromActivity();
  assert.strictEqual(values.get("macrobay_history"), savedHistory);
});

test("B19 Netlify staging excludes tests, scripts, and package manifests", () => {
  const projectRoot = __dirname + "/..";
  const publishRoot = prepareNetlifySite();

  const publishedFiles = [];
  function collectFiles(directory, prefix = "") {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const relativePath = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) collectFiles(directory + "/" + entry.name, relativePath);
      else publishedFiles.push(relativePath);
    });
  }
  collectFiles(publishRoot);

  assert.ok(publishedFiles.includes("index.html"));
  assert.ok(publishedFiles.includes("planner/index.html"));
  assert.ok(publishedFiles.includes("service-worker.js"));
  assert.ok(publishedFiles.includes("build/icon.iconset/icon_128x128.png"));
  assert.doesNotMatch(publishedFiles.join("\n"), /(^|\/)(tests|scripts)\//);
  assert.doesNotMatch(publishedFiles.join("\n"), /(^|\/)package[^/]*\.json$/i);
  assert.ok(!publishedFiles.includes("main.js"));
  assert.ok(!publishedFiles.includes("netlify.toml"));
  assert.ok(!publishedFiles.includes("capacitor.config.json"));
  assert.doesNotMatch(publishedFiles.join("\n"), /(^|\/)(android|ios)\//);
});

test("Capacitor config, Android identity, camera permission, and app icons match MacroBay", () => {
  const root = __dirname + "/..";
  const config = JSON.parse(fs.readFileSync(root + "/capacitor.config.json", "utf8"));
  const packageInfo = JSON.parse(fs.readFileSync(root + "/package.json", "utf8"));
  assert.deepStrictEqual(config, { appId: "com.vikx.macrobay", appName: "MacroBay", webDir: "netlify-dist" });
  assert.strictEqual(packageInfo.name, "macrobay");
  assert.strictEqual(packageInfo.build.appId, config.appId);
  assert.strictEqual(packageInfo.build.productName, "MacroBay");
  ["@capacitor/core", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"].forEach((name) => {
    const version = packageInfo.dependencies?.[name] || packageInfo.devDependencies?.[name];
    assert.match(version || "", /^\^8\./, `${name} should stay on Capacitor 8`);
  });
  const manifest = fs.readFileSync(root + "/android/app/src/main/AndroidManifest.xml", "utf8");
  const strings = fs.readFileSync(root + "/android/app/src/main/res/values/strings.xml", "utf8");
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(manifest, /android:required="false"/);
  assert.match(strings, /<string name="app_name">MacroBay<\/string>/);
  const androidGradle = fs.readFileSync(root + "/android/app/build.gradle", "utf8");
  assert.match(androidGradle, /namespace = "com\.vikx\.macrobay"/);
  assert.match(androidGradle, /applicationId "com\.vikx\.macrobay"/);
  assert.match(fs.readFileSync(root + "/android/app/src/main/java/com/vikx/macrobay/MainActivity.java", "utf8"), /package com\.vikx\.macrobay;/);
  ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"].forEach((density) => {
    assert.ok(fs.existsSync(root + `/android/app/src/main/res/mipmap-${density}/ic_launcher.png`));
  });
});

test("Visible product branding uses MacroBay casing without forced uppercase", () => {
  const root = path.join(__dirname, "..");
  const pages = [];
  function collect(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      if (["tests", "android", "ios", "node_modules", ".git", "build", "dist", "netlify-dist"].includes(entry.name)) return;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.endsWith(".html")) pages.push(file);
    });
  }
  collect(root);
  pages.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /<title>[^<]*MacroBay<\/title>/, file + " page title");
    assert.match(html, /class="brand"[^>]*>[\s\S]*?MacroBay<span class="brand-trademark" aria-hidden="true">™<\/span>/, file + " header brand trademark");
    assert.match(html, /class="footer-brand"[\s\S]*?MacroBay<span class="brand-trademark" aria-hidden="true">™<\/span>/, file + " footer brand trademark");
    assert.doesNotMatch(html.match(/<title>([\s\S]*?)<\/title>/)[1], /™/, file + " title has no trademark symbol");
    assert.doesNotMatch(html.match(/class="brand"[^>]*aria-label="([^"]+)"/)?.[1] || "", /™/, file + " aria label has no trademark symbol");
    assert.doesNotMatch(html, /\bMACROBAY\b|>\s*macrobay\s*</, file + " visible brand casing");
    const splash = html.match(/<div class="splash-brand"[^>]*>([\s\S]*?)<\/div>/);
    if (splash) assert.match(splash[1], /MacroBay<span class="brand-trademark" aria-hidden="true">™<\/span>/, file + " splash brand trademark");
  });
  assert.match(fs.readFileSync(path.join(root, "settings/index.html"), "utf8"), /About MacroBay<\/h2>/);
  const css = fs.readFileSync(path.join(root, "main.css"), "utf8");
  assert.doesNotMatch(css, /\.brand\s*\{[^}]*text-transform\s*:\s*uppercase/i);
  assert.doesNotMatch(css, /\.footer-brand strong\s*,[^}]*text-transform\s*:/i);
  assert.match(css, /\.section-kicker\.brand-case\s*\{\s*text-transform:\s*none;/);
  assert.match(fs.readFileSync(path.join(root, "calculators/index.html"), "utf8"), /class="section-kicker brand-case">MacroBay tools<\/span>/);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.match(manifest.name, /^MacroBay\b/);
  assert.strictEqual(manifest.short_name, "MacroBay");
});

test("Electron keeps the old storage directory and origin for existing desktop data", () => {
  const main = fs.readFileSync(__dirname + "/../main.js", "utf8");
  assert.match(main, /path\.join\(app\.getPath\("appData"\), "FitCalc"\)/);
  assert.match(main, /scheme: "fitcalc"/);
  assert.match(main, /protocol\.handle\("fitcalc"/);
  assert.match(main, /win\.loadURL\("fitcalc:\/\/app\/index\.html"\)/);
});

test("B4 failed history writes leave activity backfill eligible for retry", () => {
  values.clear();
  const date = "2026-10-02";
  ctx.saveNutritionFor(date, { calories: 450, foods: [{ name: "Dinner" }] });
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    if (key === ctx.macrobayStorageKey("macrobay_history")) throw new Error("QuotaExceededError");
    originalSetItem.call(localStorage, key, value);
  };

  try {
    ctx.backfillProgressFromActivity();
    assert.strictEqual(values.has("macrobay_progress_backfill_v2"), false);
  } finally {
    localStorage.setItem = originalSetItem;
  }

  ctx.backfillProgressFromActivity();
  assert.strictEqual(values.get("macrobay_progress_backfill_v2"), "true");
  assert.strictEqual(ctx.getProgressRecord(date).calories, 450);
});

test("T4 history rendering, averages, and backfill handle 365 logged days within 500 ms", () => {
  values.clear();
  const nutritionDays = {};
  const plannerDays = {};
  const historyDays = {};
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const dateKey = ctx.getDateKey(date);
    const nutrition = {
      calories: 1600 + offset,
      protein: 90 + offset % 40,
      carbs: 180 + offset % 60,
      fat: 50 + offset % 25,
      fiber: 20 + offset % 10,
      water: 1 + (offset % 8) / 10,
      foods: []
    };
    const planner = {
      date: dateKey,
      steps: 4000 + offset * 5,
      weight: 70 + offset / 100,
      workouts: [],
      tasks: []
    };
    nutritionDays[dateKey] = nutrition;
    plannerDays[dateKey] = planner;
    historyDays[dateKey] = {
      date: dateKey,
      weight: planner.weight,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      fiber: nutrition.fiber,
      foods: nutrition.foods,
      water: nutrition.water,
      steps: planner.steps,
      workouts: [],
      completedWorkouts: 0,
      tasks: [],
      completedTasks: 0
    };
  }
  values.set("macrobay_nutrition", JSON.stringify(nutritionDays));
  values.set("macrobay_planner", JSON.stringify(plannerDays));
  values.set("macrobay_history", JSON.stringify(historyDays));

  const historyList = { innerHTML: "" };
  const page = {
    document: {
      querySelector(selector) { return selector === "#history-list" ? historyList : null; },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    },
    getProgressRecordsForDays: ctx.getProgressRecordsForDays,
    getProgressAverage: ctx.getProgressAverage,
    getWeightChange: ctx.getWeightChange,
    isProgressMetricLogged: ctx.isProgressMetricLogged,
    escapeHTML: ctx.escapeHTML,
    getMacroBayWeightUnit: ctx.getMacroBayWeightUnit,
    kilogramsToDisplayWeight: ctx.kilogramsToDisplayWeight
  };
  vm.createContext(page);
  vm.runInContext(fs.readFileSync(__dirname + "/../history.js", "utf8"), page);
  vm.runInContext("historyRange = 90", page);

  function elapsedMilliseconds(action) {
    const start = process.hrtime.bigint();
    action();
    return Number(process.hrtime.bigint() - start) / 1e6;
  }
  const renderTime = elapsedMilliseconds(() => page.renderHistory());
  assert.ok(renderTime < 500, `renderHistory took ${renderTime.toFixed(1)} ms`);
  assert.match(historyList.innerHTML, /90 DAY AVG CALORIES/);
  assert.strictEqual((historyList.innerHTML.match(/class="history-record(?:\s|\")/g) || []).length, 90);

  const averageTime = elapsedMilliseconds(() => ctx.getProgressAverage("calories", 365));
  assert.ok(averageTime < 500, `getProgressAverage took ${averageTime.toFixed(1)} ms`);

  let writes = 0;
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    writes += 1;
    originalSetItem.call(localStorage, key, value);
  };
  try {
    const backfillTime = elapsedMilliseconds(() => ctx.backfillProgressFromActivity());
    assert.ok(backfillTime < 500, `backfillProgressFromActivity took ${backfillTime.toFixed(1)} ms`);
    const writesAfterBackfill = writes;
    ctx.backfillProgressFromActivity();
    assert.strictEqual(writes, writesAfterBackfill, "a completed backfill should be a no-op on the next run");
  } finally {
    localStorage.setItem = originalSetItem;
  }
});

test("B5 history preserves hundredths for water", () => {
  assert.strictEqual(ctx.formatHistoryDecimal(0.25, 2), "0.25");
  const html = ctx.createHistoryRecordHTML({
    date: "2026-10-01", weight: null, calories: 0, water: 0.25,
    protein: 0, carbs: 0, fat: 0, steps: 0, completedWorkouts: 0, workouts: []
  });
  assert.match(html, /0\.25\s*<small>L<\/small>/);
});

test("B6 planner saves steps to the new local date after midnight", () => {
  const start = new Date(2026, 0, 15, 23, 59).getTime();
  const app = loadPlannerSandbox({ now: start });
  const firstDate = app.sandbox.getDateKey(new app.sandbox.Date());
  const nextDate = new Date(start);
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setHours(0, 1, 0, 0);
  app.setNow(nextDate.getTime());
  app.getElement("steps-input").value = "2500";

  app.sandbox.saveSteps();

  const currentDate = app.sandbox.getDateKey(new app.sandbox.Date());
  assert.notStrictEqual(currentDate, firstDate);
  assert.strictEqual(app.sandbox.getPlannerFor(firstDate).steps, 0);
  assert.strictEqual(app.sandbox.getPlannerFor(currentDate).steps, 2500);
});

test("B7 today's weigh-in updates the profile and recalculates targets", () => {
  const app = loadPlannerSandbox({ profile: male });
  app.getElement("planner-weight-input").value = "79.5";
  app.sandbox.saveWeight();

  assert.strictEqual(app.sandbox.getProfile().weight, 79.5);
  const expected = app.sandbox.computeTargets({ ...male, weight: 79.5 });
  assert.strictEqual(app.sandbox.getTargets().calories, expected.calories);
  assert.strictEqual(app.sandbox.getTargets().protein, expected.protein);
});

test("R5-1 first weigh-in without a complete profile succeeds and saves planner weight", () => {
  const app = loadPlannerSandbox();
  app.getElement("planner-weight-input").value = "70";
  app.sandbox.saveWeight();

  const today = app.sandbox.getDateKey(new app.sandbox.Date());
  assert.strictEqual(app.sandbox.getPlannerFor(today).weight, 70);
  assert.ok(app.toasts.some((toast) => toast.message === "Weight check-in saved."));
  assert.ok(!app.toasts.some((toast) => toast.type === "error"));
  assert.ok(app.dispatchedEvents.some((event) => event.detail && event.detail.key === "macrobay_profile"));
});

test("R5-2 pound weight limits accept exactly the displayed bounds in Profile and Planner", () => {
  function submitProfileWeight(weight) {
    const app = loadProfileSandbox();
    app.sandbox.saveMacroBayPreferences({ units: { weight: "lb", height: "cm" } });
    app.sandbox.populateProfileForm(male);
    app.getElement("profile-age").value = "30";
    app.getElement("profile-sex").value = "female";
    app.getElement("profile-height").value = "170";
    app.getElement("profile-weight").value = String(weight);
    app.getElement("profile-activity").value = "moderate";
    app.getElement("profile-goal").value = "maintain";
    app.getElement("profile-form").handlers.submit({ preventDefault() {} });
    return app;
  }

  [66.1, 661.4, 150].forEach((weight) => {
    const profile = submitProfileWeight(weight);
    assert.strictEqual(profile.getElement("profile-status").dataset.state, undefined);
    assert.ok(Math.abs(profile.sandbox.getProfile().weight - weight / 2.20462262185) < 0.01);
  });
  [66.0, 661.5].forEach((weight) => {
    const profile = submitProfileWeight(weight);
    assert.match(profile.getElement("profile-status").textContent, /66\.1 to 661\.4 lb/);
    assert.strictEqual(profile.getElement("profile-status").dataset.state, "error");
  });

  [66.1, 661.4, 150].forEach((weight) => {
    const planner = loadPlannerSandbox();
    planner.sandbox.saveMacroBayPreferences({ units: { weight: "lb" } });
    planner.sandbox.updateWeightDisplay();
    planner.getElement("planner-weight-input").value = String(weight);
    planner.sandbox.saveWeight();
    const today = planner.sandbox.getDateKey(new planner.sandbox.Date());
    assert.ok(Math.abs(planner.sandbox.getPlannerFor(today).weight - weight / 2.20462262185) < 0.01);
    assert.ok(planner.toasts.some((toast) => toast.message === "Weight check-in saved."));
  });
  [66.0, 661.5].forEach((weight) => {
    const planner = loadPlannerSandbox();
    planner.sandbox.saveMacroBayPreferences({ units: { weight: "lb" } });
    planner.getElement("planner-weight-input").value = String(weight);
    planner.sandbox.saveWeight();
    assert.ok(planner.toasts.some((toast) => toast.message.includes("66.1 to 661.4 lb") && toast.type === "error"));
  });

  [4.4, 1102.3].forEach((weight) => {
    const result = submitStandaloneCalculator("bmi", { height: 170, weight }, { weight: "lb", height: "cm" });
    assert.strictEqual(result.content.hidden, false);
  });
  [4.3, 1102.4].forEach((weight) => {
    const result = submitStandaloneCalculator("bmi", { height: 170, weight }, { weight: "lb", height: "cm" });
    assert.match(result.empty.textContent, /Weight must be between 4\.4 and 1102\.3 lb/);
  });
});

test("B15 workout collapse state follows stable IDs after an earlier workout is deleted", () => {
  const app = loadPlannerSandbox();
  const today = app.sandbox.getDateKey(new app.sandbox.Date());
  app.sandbox.savePlannerFor(today, {
    date: today,
    workouts: [
      { name: "A", completed: false, exercises: [] },
      { name: "B", completed: false, exercises: [] },
      { name: "C", completed: false, exercises: [] }
    ],
    tasks: []
  });

  const planner = app.sandbox.getPlanner();
  const workoutBId = planner.workouts[1].id;
  assert.ok(workoutBId);
  assert.notStrictEqual(workoutBId, planner.workouts[0].id);
  app.sandbox.toggleWorkoutCollapsed(workoutBId);
  planner.workouts.splice(0, 1);

  assert.strictEqual(planner.workouts[0].name, "B");
  assert.strictEqual(planner.workouts[0].id, workoutBId);
  assert.strictEqual(app.sandbox.isWorkoutCollapsed(workoutBId), true);
});

test("R2-2 planner reads assign deterministic legacy IDs without changing planner or history storage", () => {
  const date = "2026-01-14";
  const planner = {
    [date]: {
      date, steps: 0, weight: null,
      workouts: [{ name: "Legacy", completed: false, exercises: [] }],
      tasks: []
    }
  };
  const history = {
    [date]: {
      date, weight: null, calories: 777, protein: 0, carbs: 0, fat: 0, fiber: 0,
      foods: [], water: 0, steps: 42,
      workouts: [{ name: "Legacy", completed: false, exercises: [] }],
      completedWorkouts: 0, tasks: [], completedTasks: 0
    }
  };
  const plannerBytes = JSON.stringify(planner);
  const historyBytes = JSON.stringify(history);
  const app = loadPlannerSandbox({
    search: "?date=" + date,
    includeProgress: true,
    initialStorage: {
      macrobay_planner: plannerBytes,
      macrobay_history: historyBytes,
      macrobay_progress_backfill_v2: "true"
    }
  });

  const read = app.sandbox.getPlanner();
  assert.strictEqual(read.workouts[0].id, "legacy-2026-01-14-0");
  assert.strictEqual(app.storage.get("macrobay_planner"), plannerBytes);
  assert.strictEqual(app.storage.get("macrobay_history"), historyBytes);
  assert.strictEqual(app.dispatchedEvents.filter((event) => event.type === "macrobay:data-change").length, 0);
});

test("R2-2 legacy workout IDs stay stable across reads when storage writes fail and duplicate IDs are repaired", () => {
  const date = "2026-01-15";
  const app = loadPlannerSandbox({
    initialStorage: {
      macrobay_planner: JSON.stringify({
        [date]: {
          date, steps: 0, weight: null,
          workouts: [
            { id: "stored-id", name: "First", completed: false, exercises: [] },
            { id: "stored-id", name: "Duplicate", completed: false, exercises: [] },
            { name: "Missing", completed: false, exercises: [] }
          ],
          tasks: []
        }
      })
    }
  });
  app.sandbox.localStorage.setItem = function () { throw new Error("QuotaExceededError"); };

  const firstRead = app.sandbox.getPlanner().workouts.map((workout) => workout.id);
  const secondRead = app.sandbox.getPlanner().workouts.map((workout) => workout.id);
  assert.deepStrictEqual(secondRead, firstRead);
  assert.strictEqual(firstRead[0], "stored-id");
  assert.strictEqual(firstRead[1], "legacy-2026-01-15-1");
  assert.strictEqual(firstRead[2], "legacy-2026-01-15-2");
  assert.strictEqual(new Set(firstRead).size, firstRead.length);
  assert.notStrictEqual(app.sandbox.createWorkoutRecordId(), app.sandbox.createWorkoutRecordId());
});

test("R2-2 clicking the real Delete button keeps the following collapsed workout collapsed", async () => {
  const date = "2026-01-15";
  const app = loadPlannerSandbox({
    initialStorage: {
      macrobay_planner: JSON.stringify({
        [date]: {
          date, steps: 0, weight: null,
          workouts: [
            { name: "A", completed: false, exercises: [] },
            { name: "B", completed: false, exercises: [] },
            { name: "C", completed: false, exercises: [] }
          ],
          tasks: []
        }
      })
    }
  });

  const workoutBId = app.sandbox.getPlanner().workouts[1].id;
  const toggleB = app.getElement("workout-list").querySelectorAll(".workout-toggle")
    .find((button) => button.dataset.index === "1");
  await toggleB.click();
  assert.strictEqual(app.sandbox.isWorkoutCollapsed(workoutBId), true);

  const deleteA = app.getElement("workout-list").querySelectorAll(".delete-workout")
    .find((button) => button.dataset.index === "0");
  await deleteA.click();

  const remaining = app.sandbox.getPlanner().workouts;
  assert.strictEqual(remaining[0].name, "B");
  assert.strictEqual(remaining[0].id, workoutBId);
  assert.strictEqual(app.sandbox.isWorkoutCollapsed(workoutBId), true);
  const renderedToggle = app.getElement("workout-list").querySelectorAll(".workout-toggle")[0];
  assert.match(app.getElement("workout-list").children[0].innerHTML, /style="display:none;"/);
  assert.strictEqual(renderedToggle.dataset.index, "0");
});

test("B15 workout IDs remain compatible with history, backup import, and CSV", () => {
  values.clear();
  const date = "2026-10-03";
  const workout = {
    id: "workout-stable-123",
    name: "Push",
    completed: true,
    exercises: [{ name: "Press", sets: [{ reps: 8, weight: 40 }] }]
  };
  ctx.savePlannerFor(date, { date, workouts: [workout], tasks: [] });
  const history = ctx.createProgressRecord(date);
  assert.strictEqual(history.workouts[0].id, workout.id);
  const backup = ctx.exportMacroBayData();
  const importedData = ctx.validateMacroBayBackup(backup);
  assert.strictEqual(importedData.macrobay_planner[date].workouts[0].id, workout.id);
  assert.match(ctx.createHistoryCSV([history]), /Push/);
});

test("B8 empty and zero step entries are rejected without storing planner data", () => {
  const app = loadPlannerSandbox();
  app.getElement("steps-input").value = "";
  app.sandbox.saveSteps();
  app.getElement("steps-input").value = "0";
  app.sandbox.saveSteps();
  assert.strictEqual(app.storage.has("macrobay_planner"), false);
  assert.strictEqual(app.toasts.length, 2);
  assert.ok(app.toasts.every((toast) => toast.type === "error"));

  app.getElement("steps-input").value = "1";
  app.sandbox.saveSteps();
  assert.strictEqual(app.storage.has("macrobay_planner"), true);
});

test("Steps accept bounded whole-number entries and enforce the daily total cap", () => {
  for (const value of ["1.5", "0", "-5", "1e12"]) {
    const app = loadPlannerSandbox();
    app.getElement("steps-input").value = value;
    app.getElement("save-steps").click();
    assert.strictEqual(app.storage.has("macrobay_planner"), false, `${value} must not be saved`);
    assert.strictEqual(app.toasts.at(-1).type, "error");
    assert.match(app.toasts.at(-1).message, /whole step count.*100,000.*200,000/i);
  }

  const valid = loadPlannerSandbox();
  valid.getElement("steps-input").value = "8000";
  valid.getElement("save-steps").click();
  const validDate = valid.sandbox.getDateKey(new valid.sandbox.Date());
  assert.strictEqual(valid.sandbox.getPlannerFor(validDate).steps, 8000);

  const atDailyLimit = loadPlannerSandbox({ initialStorage: {
    macrobay_planner: { "2026-01-15": { date: "2026-01-15", steps: 196000, workouts: [], tasks: [] } }
  } });
  atDailyLimit.getElement("steps-input").value = "5000";
  atDailyLimit.getElement("save-steps").click();
  assert.strictEqual(atDailyLimit.sandbox.getPlannerFor("2026-01-15").steps, 196000);
  assert.strictEqual(atDailyLimit.toasts.at(-1).type, "error");
});

test("B9 Nutrition refreshes from same-tab events and another tab's storage event", () => {
  const app = loadNutritionSandbox();
  const today = app.sandbox.getDateKey(new Date());
  app.sandbox.saveNutritionFor(today, { water: 0.5, calories: 120, foods: [{ name: "Snack" }] });
  assert.strictEqual(app.getElement("planner-water").textContent, "0.50");
  assert.match(app.getElement("food-list").children.at(-1).innerHTML, /Snack/);

  const before = app.storage.get("macrobay_nutrition");
  const updated = JSON.stringify({ [today]: { water: 1.25, calories: 300, foods: [{ name: "Lunch" }] } });
  app.storage.set("macrobay_nutrition", updated);
  app.listeners.window.storage.forEach((handler) => handler({
    key: "macrobay_nutrition", oldValue: before, newValue: updated
  }));

  assert.strictEqual(app.getElement("planner-water").textContent, "1.25");
  assert.match(app.getElement("food-list").children.at(-1).innerHTML, /Lunch/);
});

test("N1 Nutrition rolls today forward at midnight but keeps an explicitly selected past date", () => {
  const start = new Date(2026, 0, 15, 23, 59).getTime();
  const nextDay = new Date(2026, 0, 16, 0, 1).getTime();
  const app = loadNutritionSandbox("", { now: start });
  const oldToday = app.sandbox.getDateKey(new app.sandbox.Date());
  app.setNow(nextDay);
  app.listeners.window.focus[0]();
  const today = app.sandbox.getDateKey(new app.sandbox.Date());
  assert.notStrictEqual(today, oldToday);
  assert.strictEqual(app.sandbox.getNutritionDateKey(), today);
  app.sandbox.addFoodToSelectedDay({ name: "apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 }, 100, "Snack", "grams");
  app.sandbox.addWaterAmount(0.25);
  const nutritionDays = JSON.parse(app.storage.get("macrobay_nutrition"));
  assert.strictEqual(nutritionDays[oldToday], undefined);
  assert.strictEqual(nutritionDays[today].foods[0].name, "apple");
  assert.strictEqual(nutritionDays[today].water, 0.25);

  const pastKey = "2026-01-14";
  const past = loadNutritionSandbox("?date=" + pastKey, { now: start });
  past.setNow(nextDay);
  past.listeners.document.visibilitychange();
  assert.strictEqual(past.sandbox.getNutritionDateKey(), pastKey);
  past.sandbox.addFoodToSelectedDay({ name: "egg", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 }, 50, "Breakfast", "grams");
  const pastDays = JSON.parse(past.storage.get("macrobay_nutrition"));
  assert.strictEqual(pastDays[pastKey].foods[0].name, "egg");

  const saveTime = loadNutritionSandbox("", { now: start });
  saveTime.setNow(nextDay);
  saveTime.sandbox.addWaterAmount(0.5);
  const saveTimeDays = JSON.parse(saveTime.storage.get("macrobay_nutrition"));
  assert.strictEqual(saveTimeDays[saveTime.sandbox.getDateKey(new saveTime.sandbox.Date())].water, 0.5);
});

test("B9 Planner refreshes from same-tab and storage events", () => {
  const app = loadPlannerSandbox();
  const today = app.sandbox.getDateKey(new app.sandbox.Date());
  app.sandbox.savePlannerFor(today, { date: today, steps: 3200, weight: 72.5, workouts: [], tasks: [] });
  assert.strictEqual(app.getElement("planner-steps").textContent, 3200);
  assert.strictEqual(app.getElement("planner-weight-value").textContent, "72.5");

  app.storage.set("macrobay_planner", JSON.stringify({
    [today]: { date: today, steps: 6100, weight: 71.8, workouts: [], tasks: [] }
  }));
  app.listeners.window.storage.forEach((handler) => handler({ key: "macrobay_planner" }));
  assert.strictEqual(app.getElement("planner-steps").textContent, 6100);
  assert.strictEqual(app.getElement("planner-weight-value").textContent, "71.8");
});

test("N3 planner collapse state survives an unrelated same-day save", () => {
  const app = loadPlannerSandbox();
  const today = app.sandbox.getDateKey(new app.sandbox.Date());
  app.sandbox.savePlannerFor(today, {
    date: today,
    workouts: [{ name: "Session", completed: false, exercises: [] }],
    tasks: []
  });
  const workoutId = app.sandbox.getPlanner().workouts[0].id;
  app.sandbox.toggleWorkoutCollapsed(workoutId);
  const planner = app.sandbox.getPlanner();
  planner.steps = 1500;
  app.sandbox.savePlanner(planner);

  assert.strictEqual(app.sandbox.isWorkoutCollapsed(workoutId), true);
});

test("N3 Nutrition keeps a food edit intact after an unrelated storage event", () => {
  const app = loadNutritionSandbox();
  const today = app.sandbox.getDateKey(new Date());
  app.sandbox.saveNutritionFor(today, {
    foods: [{ name: "apple", amount: 100, calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 }]
  });
  app.sandbox.editFood(0);
  app.getElement("food-name").value = "apple, sliced";
  app.getElement("food-amount").value = "175";
  app.listeners.window.storage.forEach((handler) => handler({ key: "macrobay_profile" }));

  assert.strictEqual(app.getElement("food-name").value, "apple, sliced");
  assert.strictEqual(app.getElement("food-amount").value, "175");
  assert.strictEqual(vm.runInContext("editingFoodIndex", app.sandbox), 0);
});

test("B10 History refreshes when source or history data changes", () => {
  values.clear();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = ctx.getDateKey(yesterday);
  const historyList = { innerHTML: "" };
  const listeners = {};
  const page = {
    document: {
      querySelector(selector) { return selector === "#history-list" ? historyList : null; },
      querySelectorAll() { return []; }
    },
    window: { addEventListener(type, handler) { listeners[type] = handler; } },
    NUTRITION_KEY: "macrobay_nutrition", PLANNER_KEY: "macrobay_planner", HISTORY_KEY: "macrobay_history",
    PROFILE_KEY: "macrobay_profile", TARGETS_KEY: "macrobay_targets", PREFERENCES_KEY: "macrobay_preferences",
    macrobayStorageKey: ctx.macrobayStorageKey,
    getVisibleHistoryRecords: ctx.getVisibleHistoryRecords,
    getProgressRecordsForDays: ctx.getProgressRecordsForDays,
    getProgressAverage: ctx.getProgressAverage,
    getWeightChange: ctx.getWeightChange,
    isProgressMetricLogged: ctx.isProgressMetricLogged,
    escapeHTML: ctx.escapeHTML,
    getMacroBayWeightUnit: ctx.getMacroBayWeightUnit,
    kilogramsToDisplayWeight: ctx.kilogramsToDisplayWeight
  };
  vm.createContext(page);
  vm.runInContext(fs.readFileSync(__dirname + "/../history.js", "utf8"), page);

  ctx.savePlannerFor(date, { date, steps: 4200, workouts: [], tasks: [] });
  ctx.saveProgressRecord(date);
  listeners["macrobay:data-change"]({ detail: { date, key: "macrobay_planner" } });
  assert.match(historyList.innerHTML, /4,200/);

  const previousHistory = values.get("macrobay_history");
  ctx.saveNutritionFor(date, { calories: 510, foods: [{ name: "Meal" }] });
  ctx.saveProgressRecord(date);
  listeners.storage({ key: "macrobay_history", oldValue: previousHistory, newValue: values.get("macrobay_history") });
  assert.match(historyList.innerHTML, /510/);
});

test("B11 history retains planned and completed workouts and tasks", () => {
  values.clear();
  const date = "2026-09-30";
  ctx.writeJSON("macrobay_progress_backfill_v1", true);
  ctx.savePlannerFor(date, {
    date,
    workouts: [
      { name: "Completed session", completed: true, exercises: [{ name: "Press", sets: [{ reps: 8, weight: 40 }] }] },
      { name: "Planned session", completed: false, exercises: [{ name: "Squat", sets: [] }] }
    ],
    tasks: [{ name: "Walk", completed: true }, { name: "Stretch", completed: false }]
  });
  ctx.backfillProgressFromActivity();
  const record = ctx.getProgressRecord(date);
  assert.strictEqual(values.get("macrobay_progress_backfill_v2"), "true");
  assert.strictEqual(record.workouts.length, 2);
  assert.strictEqual(record.completedWorkouts, 1);
  assert.strictEqual(record.tasks.length, 2);
  assert.strictEqual(record.completedTasks, 1);
  const html = ctx.createHistoryRecordHTML(record);
  assert.match(html, /Planned: .*Planned session/);
  assert.match(html, /Completed: Walk/);
  assert.match(html, /Planned: Stretch/);

  const legacy = ctx.normalizeProgressRecord(date, { workouts: [{ name: "Old", completed: true }], tasks: 2 });
  assert.strictEqual(legacy.completedWorkouts, 1);
  assert.strictEqual(legacy.tasks.length, 0);
  assert.strictEqual(legacy.completedTasks, 2);
});

test("A7 history details expose foods and actual sets; CSV quotes exported values", () => {
  const record = {
    date: "2026-09-30", weight: null, calories: 450, protein: 12, carbs: 64, fat: 16,
    fiber: 8, water: 0.25, steps: 100, completedWorkouts: 1, completedTasks: 0,
    foods: [{ name: "Oats, <rolled>", meal: "Breakfast", amount: 45, calories: 200, protein: 6, carbs: 30, fat: 4 }],
    workouts: [{ name: "Push", completed: true, exercises: [{ name: "Press", sets: [{ reps: 8, weight: 40, notes: "steady" }] }] }],
    tasks: []
  };
  const html = ctx.createHistoryRecordHTML(record);
  assert.match(html, /^<details class="history-record history-record-details"/);
  assert.match(html, /<summary class="history-record-summary">[\s\S]*class="history-stats"[\s\S]*history-record-prompt[^>]*>View foods, sets, and activity details<\/span>[\s\S]*<\/summary>/);
  assert.doesNotMatch(html, /<details class="history-record-details">/);
  assert.match(html, /Oats, &lt;rolled&gt;/);
  assert.match(html, /8 reps · 40\.0 kg · steady/);
  assert.match(html, /Edit nutrition/);
  assert.match(html, /Delete day/);
  const csv = ctx.createHistoryCSV([record]);
  assert.match(csv, /"Breakfast: Oats, <rolled> \(45 g\)"/);
  assert.match(csv, /"Push \[completed\] — Press: 8 reps · 40\.0 kg · steady"/);
  assert.strictEqual(ctx.csvCell("=SUM(1,2)"), '"\'=SUM(1,2)"');
});

test("N4 CSV keeps workout notes as plain text while History escapes them for HTML", () => {
  const record = {
    date: "2026-10-03", weight: null, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0, steps: 0,
    completedWorkouts: 0, completedTasks: 0, tasks: [], foods: [],
    workouts: [{ name: "Lift", completed: false, exercises: [{ name: "Press", sets: [{ reps: 5, weight: 20, notes: "rock & roll" }] }] }]
  };
  const csv = ctx.createHistoryCSV([record]);
  const html = ctx.createHistoryRecordHTML(record);

  assert.match(csv, /rock & roll/);
  assert.doesNotMatch(csv, /rock &amp; roll/);
  assert.match(html, /rock &amp; roll/);
});

test("A7 deleting a history day removes only that date's owned source and summary records", () => {
  const date = "2001-03-05";
  ctx.saveNutritionFor(date, { calories: 320, foods: [{ name: "Meal", calories: 320 }] });
  ctx.savePlannerFor(date, { date, steps: 1500, workouts: [], tasks: [] });
  ctx.saveProgressRecord(date);
  assert.strictEqual(ctx.deleteMacroBayDay(date), true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(ctx.readJSON("macrobay_nutrition", {}), date), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(ctx.readJSON("macrobay_planner", {}), date), false);
  assert.strictEqual(ctx.getProgressRecord(date), null);
});

test("B13 nutrition date updates leave the Intake and targets heading intact", () => {
  const app = loadNutritionSandbox();
  const heading = app.getElement("nutrition-totals-heading");
  heading.textContent = "Intake and targets";
  vm.runInContext("selectedNutritionDate = new Date(2026, 0, 14); updateNutritionDateDisplay();", app.sandbox);
  assert.strictEqual(heading.textContent, "Intake and targets");
  assert.notStrictEqual(app.getElement("nutrition-date").textContent, "");
});

test("B14 failed nutrition and planner writes do not show success or update stale UI", () => {
  const nutrition = loadNutritionSandbox();
  nutrition.sandbox.localStorage.setItem = function () { throw new Error("QuotaExceededError"); };
  assert.strictEqual(nutrition.sandbox.saveNutrition({ water: 0.25 }), false);
  nutrition.getElement("add-water").click();
  assert.strictEqual(nutrition.getElement("planner-water").textContent, "0.00");
  assert.strictEqual(nutrition.storage.has("macrobay_nutrition"), false);

  const planner = loadPlannerSandbox();
  planner.sandbox.localStorage.setItem = function () { throw new Error("QuotaExceededError"); };
  planner.getElement("steps-input").value = "2500";
  planner.sandbox.saveSteps();
  assert.strictEqual(planner.getElement("steps-input").value, "2500");
  assert.ok(!planner.toasts.some((toast) => toast.message === "Steps updated for this day."));
  assert.strictEqual(planner.sandbox.savePlanner({ date: planner.sandbox.getDateKey(new planner.sandbox.Date()) }), false);

  ctx.saveProfile(male);
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function () { throw new Error("QuotaExceededError"); };
  assert.strictEqual(ctx.saveWorkoutTemplates([]), false);
  assert.strictEqual(ctx.refreshTargets(), false);
  localStorage.setItem = originalSetItem;
});

test("A1 JSON export includes all owned data with a schema version", () => {
  values.clear();
  ctx.saveProfile(male);
  ctx.writeJSON("macrobay_targets", { calories: 2300, protein: 130 });
  ctx.saveNutritionFor("2026-10-01", { calories: 500, foods: [{ name: "Lunch" }] });
  ctx.savePlannerFor("2026-10-01", { date: "2026-10-01", steps: 3200, workouts: [], tasks: [] });
  ctx.saveProgressRecord("2026-10-01");
  ctx.persistWorkoutTemplates([{ name: "Push" }]);
  ctx.writeJSON("macrobay_preferences", { theme: "light" });
  ctx.writeJSON("macrobay_unowned_key", { keep: true });

  const backup = JSON.parse(JSON.stringify(ctx.exportMacroBayData()));
  assert.strictEqual(backup.format, "macrobay-backup");
  assert.strictEqual(backup.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(backup.exportedAt);
  assert.deepStrictEqual(Object.keys(backup.data).sort(), [
    "macrobay_food_library", "macrobay_history", "macrobay_nutrition", "macrobay_planner",
    "macrobay_preferences", "macrobay_profile", "macrobay_targets", "macrobay_workout_templates"
  ]);
  assert.strictEqual(backup.data.macrobay_profile.weight, male.weight);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(backup.data, "macrobay_unowned_key"), false);
});

test("A1 import restores a backup and rejects malformed data without partial writes", () => {
  values.clear();
  ctx.saveProfile(male);
  ctx.writeJSON("macrobay_targets", { calories: 2300 });
  const backup = JSON.parse(JSON.stringify(ctx.exportMacroBayData()));

  ctx.saveProfile({ ...male, weight: 99 });
  ctx.writeJSON("macrobay_targets", { calories: 1000 });
  ctx.importMacroBayData(backup);
  assert.strictEqual(ctx.getProfile().weight, male.weight);
  assert.strictEqual(ctx.getTargets().calories, 2300);

  const beforeProfile = values.get("macrobay_profile");
  const beforeTargets = values.get("macrobay_targets");
  const invalid = JSON.parse(JSON.stringify(backup));
  invalid.data.macrobay_nutrition = [];
  assert.throws(() => ctx.importMacroBayData(invalid), /nutrition section.*invalid/i);
  assert.strictEqual(values.get("macrobay_profile"), beforeProfile);
  assert.strictEqual(values.get("macrobay_targets"), beforeTargets);

  const originalSetItem = localStorage.setItem;
  let failNutritionWrite = true;
  localStorage.setItem = function (key, value) {
    if (key === "macrobay_nutrition" && failNutritionWrite) {
      failNutritionWrite = false;
      throw new Error("simulated storage limit");
    }
    originalSetItem.call(localStorage, key, value);
  };
  assert.throws(() => ctx.importMacroBayData(backup), /simulated storage limit/);
  localStorage.setItem = originalSetItem;
  assert.strictEqual(values.get("macrobay_profile"), beforeProfile);
  assert.strictEqual(values.get("macrobay_targets"), beforeTargets);

  const future = JSON.parse(JSON.stringify(backup));
  future.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
  assert.throws(() => ctx.importMacroBayData(future), /newer MacroBay version/i);
  assert.strictEqual(values.get("macrobay_profile"), beforeProfile);

  const legacyBackup = JSON.parse(JSON.stringify(backup));
  legacyBackup.schemaVersion = 0;
  assert.strictEqual(ctx.importMacroBayData(legacyBackup), true);
  assert.strictEqual(ctx.readJSON("macrobay_schema_version", null), CURRENT_SCHEMA_VERSION);
});

test("A1 reset clears MacroBay-owned data but preserves schema and unrelated storage", () => {
  values.clear();
  ctx.saveProfile(male);
  ctx.writeJSON("macrobay_targets", { calories: 2300 });
  ctx.saveNutritionFor("2026-10-01", { calories: 500, foods: [{ name: "Lunch" }] });
  ctx.savePlannerFor("2026-10-01", { date: "2026-10-01", steps: 3200, workouts: [], tasks: [] });
  ctx.writeJSON("macrobay_history", { "2026-10-01": { calories: 500 } });
  ctx.persistWorkoutTemplates([{ name: "Push" }]);
  ctx.writeJSON("macrobay_preferences", { theme: "light" });
  ctx.writeJSON("macrobay_progress_backfill_v1", true);
  ctx.writeJSON("macrobay_progress_backfill_v2", true);
  ctx.writeJSON("macrobay_unowned_key", { keep: true });
  ctx.initializeMacroBayStorageSchema();

  ctx.resetMacroBayData();

  ["macrobay_profile", "macrobay_targets", "macrobay_nutrition", "macrobay_planner", "macrobay_history",
    "macrobay_workout_templates", "macrobay_preferences", "macrobay_food_library", "macrobay_progress_backfill_v1",
    "macrobay_progress_backfill_v2"].forEach((key) => {
    assert.strictEqual(values.has(key), false, key + " should be cleared");
  });
  assert.strictEqual(ctx.readJSON("macrobay_schema_version", null), CURRENT_SCHEMA_VERSION);
  assert.deepStrictEqual(JSON.parse(values.get("macrobay_unowned_key")), { keep: true });
});

test("A2 migration stamps existing unversioned records without rewriting them", () => {
  values.clear();
  const existingProfile = JSON.stringify(male);
  const existingNutrition = JSON.stringify({ "2026-10-01": { calories: 500, foods: [{ name: "Lunch" }] } });
  localStorage.setItem("macrobay_profile", existingProfile);
  localStorage.setItem("macrobay_nutrition", existingNutrition);

  assert.strictEqual(ctx.initializeMacroBayStorageSchema(), true);
  assert.strictEqual(values.get("macrobay_profile"), existingProfile);
  assert.strictEqual(values.get("macrobay_nutrition"), existingNutrition);
  assert.strictEqual(ctx.readJSON("macrobay_schema_version", null), CURRENT_SCHEMA_VERSION);
  assert.strictEqual(ctx.initializeMacroBayStorageSchema(), true);
  assert.strictEqual(values.get("macrobay_profile"), existingProfile);
});

test("A5 migrates schema v1 backups to an empty owned food library", () => {
  const legacyData = {
    macrobay_profile: {}, macrobay_targets: {}, macrobay_nutrition: {}, macrobay_planner: {},
    macrobay_history: {}, macrobay_workout_templates: [], macrobay_preferences: {}
  };
  ctx.importMacroBayData({ format: "macrobay-backup", schemaVersion: 1, data: legacyData });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.getFoodLibrary())), { customFoods: [], favorites: [], recents: [] });
  assert.strictEqual(ctx.readJSON("macrobay_schema_version", null), CURRENT_SCHEMA_VERSION);

  legacyData.macrobay_food_library = {
    customFoods: [{ name: "Saved meal", calories: 200 }], favorites: [], recents: []
  };
  ctx.importMacroBayData({ format: "macrobay-backup", schemaVersion: 0, data: legacyData });
  assert.strictEqual(ctx.getFoodLibrary().customFoods[0].name, "Saved meal");
});

test("A5 local schema migration stores a new empty food library without rewriting saved profile bytes", () => {
  values.clear();
  const profileJson = JSON.stringify(male);
  localStorage.setItem("macrobay_schema_version", "1");
  localStorage.setItem("macrobay_profile", profileJson);
  assert.strictEqual(ctx.initializeMacroBayStorageSchema(), true);
  assert.strictEqual(values.get("macrobay_profile"), profileJson);
  assert.deepStrictEqual(JSON.parse(values.get("macrobay_food_library")), { customFoods: [], favorites: [], recents: [] });
  assert.strictEqual(ctx.readJSON("macrobay_schema_version", null), CURRENT_SCHEMA_VERSION);
});

test("A2 leaves a newer local schema untouched and skips standalone calculators", () => {
  values.clear();
  ctx.writeJSON("macrobay_schema_version", CURRENT_SCHEMA_VERSION + 1);
  ctx.saveProfile(male);
  const before = values.get("macrobay_profile");
  assert.strictEqual(ctx.initializeMacroBayStorageSchema(), false);
  assert.strictEqual(values.get("macrobay_schema_version"), JSON.stringify(CURRENT_SCHEMA_VERSION + 1));
  assert.strictEqual(values.get("macrobay_profile"), before);

  const isolated = new Map();
  const sandbox = {
    localStorage: {
      getItem(key) { return isolated.has(key) ? isolated.get(key) : null; },
      setItem(key, value) { isolated.set(key, String(value)); },
      removeItem(key) { isolated.delete(key); }
    },
    document: { body: { hasAttribute(name) { return name === "data-calc"; } } },
    window: {}
  };
  vm.createContext(sandbox);
  ["constants.js", "store.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox);
  });
  assert.strictEqual(isolated.has("macrobay_schema_version"), false);
});

test("A2 does not stamp a schema over corrupt legacy data", () => {
  values.clear();
  const corrupt = "{";
  localStorage.setItem("macrobay_nutrition", corrupt);
  assert.throws(() => ctx.initializeMacroBayStorageSchema(), /not valid JSON/i);
  assert.strictEqual(values.get("macrobay_nutrition"), corrupt);
  assert.strictEqual(values.has("macrobay_schema_version"), false);
});

test("A3 editable targets persist through profile refresh and can reset to estimates", () => {
  values.clear();
  ctx.saveProfile(male);
  assert.strictEqual(ctx.refreshTargets(), true);
  assert.strictEqual(ctx.saveTargetOverrides({ calories: 2200, protein: 155 }), true);
  assert.strictEqual(ctx.getTargets().calories, 2200);
  assert.strictEqual(ctx.getTargets().protein, 155);

  ctx.updateProfile({ weight: 85 });
  assert.strictEqual(ctx.refreshTargets(), true);
  assert.strictEqual(ctx.getTargets().calories, 2200);
  assert.strictEqual(ctx.getTargets().protein, 155);
  assert.strictEqual(ctx.getTargets().tdee, ctx.computeTargets(ctx.getProfile()).tdee);
  assert.strictEqual(ctx.resetTargetOverrides(), true);
  assert.strictEqual(ctx.getTargets().calories, ctx.computeTargets(ctx.getProfile()).calories);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(ctx.getTargets(), "overrides"), false);
  assert.strictEqual(ctx.saveTargetOverrides({ calories: 10 }), false);
});

test("A3/A4 Settings units convert Profile fields while profile targets remain editable", () => {
  const app = loadProfileSandbox();
  const get = app.getElement;
  get("profile-age").value = "25";
  get("profile-sex").value = "male";
  get("profile-height").value = "180";
  get("profile-weight").value = "80";
  get("profile-activity").value = "moderate";
  get("profile-goal").value = "lose";
  get("profile-form").handlers.submit({ preventDefault() {} });
  assert.strictEqual(app.sandbox.getProfile().weight, 80);
  const calculatedTargetCalories = app.sandbox.getTargets().calories;
  assert.strictEqual(get("target-form").hidden, true);
  assert.strictEqual(get("profile-target-edit").hidden, false);

  get("unit-weight").value = "lb";
  get("unit-height").value = "ft-in";
  get("unit-preferences-form").handlers.submit({ preventDefault() {} });
  assert.strictEqual(get("profile-weight").value, "176.4");
  assert.strictEqual(get("profile-height").hidden, true);
  assert.strictEqual(get("profile-height-feet").value, 5);
  assert.strictEqual(get("profile-height-inches").value, 10.9);
  assert.strictEqual(get("profile-card-details").textContent, "25 years old | 5 ft 10.9 in | 176.4 lb");

  get("settings-theme").value = "system";
  get("settings-theme").handlers.change({});
  assert.strictEqual(app.sandbox.getMacroBayPreferences().theme, "system");
  assert.strictEqual(app.sandbox.getMacroBayPreferences().units.weight, "lb");
  assert.strictEqual(app.sandbox.getMacroBayPreferences().units.height, "ft-in");

  const editedTargets = { calories: 2450, protein: 170, carbs: 300, fat: 75, fiber: 35 };
  get("profile-target-edit").click();
  assert.strictEqual(get("target-form").hidden, false);
  assert.strictEqual(get("profile-target-list").hidden, true);
  assert.strictEqual(get("profile-target-edit").hidden, true);
  Object.entries(editedTargets).forEach(([key, value]) => { get("target-" + key).value = String(value); });
  get("target-cancel").click();
  assert.strictEqual(get("target-form").hidden, true);
  assert.strictEqual(get("profile-target-list").hidden, false);
  assert.strictEqual(app.sandbox.getTargets().calories, calculatedTargetCalories);

  get("profile-target-edit").click();
  Object.entries(editedTargets).forEach(([key, value]) => { get("target-" + key).value = String(value); });
  get("target-form").handlers.submit({ preventDefault() {} });
  assert.strictEqual(app.sandbox.getTargets().calories, 2450);
  assert.strictEqual(app.sandbox.getTargets().protein, 170);
  assert.strictEqual(get("target-form").hidden, true);
  assert.strictEqual(get("profile-target-list").hidden, false);

  get("profile-target-edit").click();
  get("reset-targets").click();
  assert.strictEqual(get("target-form").hidden, true);
  assert.strictEqual(app.sandbox.getTargets().calories, app.sandbox.computeTargets(app.sandbox.getProfile()).calories);
  assert.match(get("target-status").textContent, /reset to the calculated estimates/i);
});

test("Profile saves an optional trimmed name in the existing record and renders it as text", () => {
  const app = loadProfileSandbox();
  const get = app.getElement;
  assert.strictEqual(get("profile-details-card").hidden, false);
  assert.strictEqual(get("profile-edit").hidden, true);
  app.sandbox.updateProfile({ migrationMarker: "preserved" });
  get("profile-name").value = "  <b>Rin</b>  ";
  get("profile-age").value = "25";
  get("profile-sex").value = "female";
  get("profile-height").value = "165";
  get("profile-weight").value = "62.5";
  get("profile-activity").value = "moderate";
  get("profile-goal").value = "lose";
  get("profile-form").handlers.submit({ preventDefault() {} });

  const savedProfile = app.sandbox.getProfile();
  assert.strictEqual(savedProfile.name, "<b>Rin</b>");
  assert.strictEqual(savedProfile.migrationMarker, "preserved");
  assert.ok(app.storage.has("macrobay_profile"));
  assert.ok(!app.storage.has("macrobay_profile_name"));
  assert.strictEqual(get("profile-card-name").textContent, "<b>Rin</b>");
  assert.strictEqual(get("profile-card-name").innerHTML, undefined);
  assert.strictEqual(get("profile-card-details").textContent, "25 years old | 165.0 cm | 62.5 kg");
  assert.strictEqual(get("profile-card-activity").textContent, "Moderately active");
  assert.strictEqual(get("profile-card-activity").hidden, false);
  assert.strictEqual(get("profile-card-goal").textContent, "Lose weight");
  assert.strictEqual(get("profile-avatar-initial").textContent, "<");
  assert.strictEqual(get("profile-avatar-person").hidden, true);
  assert.strictEqual(get("profile-details-card").hidden, true);
  assert.strictEqual(get("profile-edit").hidden, false);
  get("profile-edit").click();
  assert.strictEqual(get("profile-details-card").hidden, false);
  assert.strictEqual(get("profile-edit").hidden, true);
  get("profile-cancel").click();
  assert.strictEqual(get("profile-details-card").hidden, true);

  const previousProfileJson = values.get("macrobay_profile");
  const originalGetElementById = ctx.document.getElementById;
  const homeName = { textContent: "" };
  ctx.document.getElementById = (id) => id === "home-user-name" ? homeName : null;
  try {
    ctx.saveProfile(savedProfile);
    ctx.updateHomeGreeting(new Date(2026, 0, 15, 12));
    assert.strictEqual(homeName.textContent, "<b>Rin</b>");
    assert.strictEqual(homeName.innerHTML, undefined);
  } finally {
    ctx.document.getElementById = originalGetElementById;
    if (previousProfileJson === undefined) values.delete("macrobay_profile");
    else values.set("macrobay_profile", previousProfileJson);
  }

  get("profile-edit").click();
  get("profile-name").value = "   ";
  get("profile-form").handlers.submit({ preventDefault() {} });
  assert.strictEqual(app.sandbox.getProfile().name, "");
  assert.strictEqual(get("profile-card-name").textContent, "Your name");
  assert.strictEqual(get("profile-avatar-initial").hidden, true);
  assert.strictEqual(get("profile-avatar-person").hidden, false);
  assert.strictEqual(get("profile-card-goal").hidden, false);
  assert.strictEqual(get("profile-card-goal").textContent, "Lose weight");
  assert.doesNotMatch(get("profile-status").textContent, /error/i);
});

test("Home greeting follows local time boundaries and uses the saved profile name", () => {
  const originalGetElementById = ctx.document.getElementById;
  const greeting = { textContent: "" };
  const name = { textContent: "" };
  const icon = { dataset: {} };
  const periods = new Map([[4, "night"], [5, "morning"], [11, "morning"], [12, "afternoon"], [16, "afternoon"], [17, "evening"], [20, "evening"], [21, "night"]]);
  const previous = values.get("macrobay_profile");
  ctx.document.getElementById = (id) => id === "home-greeting-label" ? greeting : (id === "home-user-name" ? name : (id === "home-greeting-icon" ? icon : null));
  try {
    ctx.saveProfile({ name: "Nia" });
    [
      [4, "Good night,"], [5, "Good morning,"], [11, "Good morning,"],
      [12, "Good afternoon,"], [16, "Good afternoon,"], [17, "Good evening,"],
      [20, "Good evening,"], [21, "Good night,"]
    ].forEach(([hour, expected]) => {
      ctx.updateHomeGreeting(new Date(2026, 0, 15, hour));
      assert.strictEqual(greeting.textContent, expected);
      assert.strictEqual(name.textContent, "Nia");
      assert.strictEqual(icon.dataset.period, periods.get(hour));
    });
  } finally {
    ctx.document.getElementById = originalGetElementById;
    if (previous === undefined) values.delete("macrobay_profile");
    else values.set("macrobay_profile", previous);
  }
});

test("first-run profile uses the existing activity and goal values and keeps Skip available", () => {
  const home = fs.readFileSync(__dirname + "/../index.html", "utf8");
  const profile = fs.readFileSync(__dirname + "/../profile/index.html", "utf8");
  ["sedentary", "light", "moderate", "active", "very_active"].forEach((value) => {
    assert.match(home, new RegExp('id="first-run-activity"[\\s\\S]*?value="' + value + '"'));
    assert.match(profile, new RegExp('id="profile-activity"[\\s\\S]*?value="' + value + '"'));
  });
  ["lose", "maintain", "gain"].forEach((value) => {
    assert.match(home, new RegExp('id="first-run-goal"[\\s\\S]*?value="' + value + '"'));
    assert.match(profile, new RegExp('id="profile-goal"[\\s\\S]*?value="' + value + '"'));
  });
  assert.match(home, /id="first-run-skip"/);
  assert.match(fs.readFileSync(__dirname + "/../script.js", "utf8"), /profileSetupDismissed/);
});

test("Profile page contains personal and fitness information without Settings-only sections", () => {
  const html = fs.readFileSync(__dirname + "/../profile/index.html", "utf8");
  const summaryCard = html.indexOf('class="card profile-summary-card"');
  const profileDetails = html.indexOf('id="profile-title"');
  assert.ok(summaryCard >= 0 && summaryCard < profileDetails);
  assert.doesNotMatch(html, /profile-goal-card|profile-goal-edit|>My Goal</);
  assert.match(html, /id="profile-card-goal"/);
  assert.match(html, /id="profile-edit"[^>]*>Edit<\/button>/);
  assert.match(html, /id="profile-cancel"/);
  const sections = ["profile-title", "profile-target-title"].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(sections.every((position) => position >= 0));
  assert.deepStrictEqual(sections, sections.slice().sort((a, b) => a - b));
  assert.strictEqual((html.match(/class="card tile profile-section/g) || []).length, 2);
  const formStart = html.indexOf('<form id="profile-form"');
  const profileFormMarkup = html.slice(formStart, html.indexOf('</form>', formStart));
  assert.match(profileFormMarkup, /<label for="profile-name">Name<\/label>/);
  const nameInput = profileFormMarkup.match(/<input type="text" id="profile-name"[^>]*>/)[0];
  assert.match(nameInput, /maxlength="30" autocomplete="given-name"/);
  assert.doesNotMatch(nameInput, /\brequired\b/);
  assert.ok(profileFormMarkup.indexOf('id="profile-name"') < profileFormMarkup.indexOf('id="profile-age"'));
  assert.ok(profileFormMarkup.indexOf('id="profile-age"') < profileFormMarkup.indexOf('id="profile-sex"'));
  assert.ok(profileFormMarkup.indexOf('id="profile-height"') < profileFormMarkup.indexOf('id="profile-weight"'));
  assert.ok(profileFormMarkup.indexOf('id="profile-activity"') < profileFormMarkup.indexOf('id="profile-goal"'));
  assert.match(profileFormMarkup, /profile-field-pair[\s\S]*id="profile-age"[\s\S]*id="profile-sex"/);
  assert.match(profileFormMarkup, /profile-field-pair[\s\S]*id="profile-height"[\s\S]*id="profile-weight"/);
  assert.doesNotMatch(html, /Health Integrations/i);

  const preservedIds = [
    "profile-form", "profile-name", "profile-age", "profile-sex", "profile-height", "profile-height-feet", "profile-height-inches",
    "profile-weight", "profile-activity", "profile-goal", "target-form", "target-calories", "target-protein",
    "target-carbs", "target-fat", "target-fiber", "reset-targets"
  ];
  preservedIds.forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  ["profile-units-title", "profile-data-title", "profile-appearance-title", "unit-preferences-form", "unit-weight", "unit-height",
    "export-data", "import-data-file", "reset-data", "profile-app-version"].forEach((id) => {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`));
  });
  ["Appearance", "Data management", "Export backup", "Restore from a MacroBay JSON backup", "Reset MacroBay data"]
    .forEach((label) => assert.ok(!html.includes(label), `${label} should live in Settings`));

  const topbar = html.match(/<header class="topbar">[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(topbar, /theme-toggle/);
  assert.match(html, /id="profile-target-edit"[^>]*>Edit<\/button>/);
  assert.match(html, /id="target-cancel">Cancel<\/button>/);
  assert.match(html, /id="reset-targets">Reset to calculated<\/button>/);
  assert.doesNotMatch(html, />Personalize<|>Edit daily targets</);
  assert.doesNotMatch(html, /href="[^"]*calculators?\//i);
  assert.doesNotMatch(html, /<script src="\.\.\/settings\.js"><\/script>/);
});

test("A9 calculator target values arrive in the Profile target editor for explicit review", () => {
  const app = loadProfileSandbox("?targetCalories=2240&targetProtein=155&targetCarbs=260&targetFat=70");
  app.sandbox.saveProfile(male);
  app.sandbox.refreshTargets();
  app.sandbox.renderProfileTargets();
  assert.strictEqual(app.getElement("target-calories").value, 2240);
  assert.strictEqual(app.getElement("target-protein").value, 155);
  assert.match(app.getElement("calculator-handoff-status").textContent, /review and save/i);

  app.getElement("target-form").handlers.submit({ preventDefault() {} });
  assert.strictEqual(app.sandbox.getTargets().calories, 2240);
  assert.strictEqual(app.sandbox.getTargets().protein, 155);
});

test("B unified search shows built-ins immediately and OFF retries before its compatibility endpoint", async () => {
  const app = loadFoodApiRetrySandbox();
  const status = app.document.getElementById("food-api-status");
  const results = app.document.getElementById("food-api-results");
  app.sandbox.searchBuiltInFoodList = function (query) {
    assert.strictEqual(query, "bread");
    return [{ name: "whole wheat bread", calories: 252, protein: 12.3, carbs: 43, fat: 3.5, fiber: 6, source: "MacroBay built-in" }];
  };
  app.sandbox.scheduleUnifiedFoodSearch("bread");
  assert.strictEqual(results.children.length, 1);
  assert.strictEqual(results.children[0].children[1].children[0].children[0].children[0].textContent, "whole wheat bread");
  assert.match(status.textContent, /searching online/i);
  app.sandbox.cancelUnifiedFoodSearch();

  const requests = [];
  app.sandbox.fetch = async function (url) {
    requests.push(url);
    if (url.includes("search.openfoodfacts.org")) return { ok: false, status: 503 };
    return {
      ok: true,
      json: async function () { return { products: [{ product_name: "whole wheat bread", nutriments: { "energy-kcal_100g": 252, proteins_100g: 12.3, carbohydrates_100g: 43, fat_100g: 3.5, fiber_100g: 6 } }] }; }
    };
  };
  const products = await app.sandbox.searchOpenFoodFacts("bread");
  assert.strictEqual(requests.length, 2);
  assert.ok(requests[0].includes("search.openfoodfacts.org/search"));
  assert.ok(requests[1].includes("/cgi/search.pl"));
  const legacySearch = new URL(requests[1]);
  assert.strictEqual(legacySearch.searchParams.get("lc"), "en");
  assert.strictEqual(legacySearch.searchParams.get("countries_tags"), "india");
  assert.strictEqual(products[0].name, "whole wheat bread");
});

test("Food search normalizes plurals and aliases, ranks local foods, and keeps query matches relevant", () => {
  const app = loadFoodApiRetrySandbox();
  const nutrition = loadNutritionSandbox();
  app.sandbox.searchBuiltInFoodList = (query) => nutrition.sandbox.searchBuiltInFoodList(query);
  app.sandbox.getFoodLibrary = () => ({ favorites: [], customFoods: [] });
  app.sandbox.indianFoodDatabase = vm.runInContext("indianFoodDatabase", nutrition.sandbox);
  const cases = [
    ["carrot", "carrot"], ["carrots", "carrot"], ["cucumber", "cucumber"], ["kheera", "cucumber"],
    ["egg", "egg"], ["paneer", "paneer"], ["roti", "chapati"], ["banana", "banana"],
    ["bread", "bread"], ["rice", "rice"], ["toor dal", "toor dal"]
  ];
  cases.forEach(([query, expected]) => {
    const results = app.sandbox.searchLocalFoodSources(query);
    assert.ok(results.length, query + " should return an offline result");
    assert.match(results[0].name.toLowerCase(), new RegExp(expected), query + " should rank its matching food first");
  });
  assert.strictEqual(app.sandbox.normalizeFoodSearchQuery("  tomatoes  "), "tomato");
  assert.strictEqual(nutrition.sandbox.normalizeFoodName("carrots"), "carrots", "plural search normalization must not alter existing preference keys");
  assert.strictEqual(app.sandbox.searchLocalFoodSources("carrot")[0].calories, 41);
  assert.strictEqual(app.sandbox.searchLocalFoodSources("cucumber")[0].calories, 15);
  const expected = {
    egg: [143, 12.6, 0.7, 9.5], paneer: [299, 15.9, 22.5, 15.5], roti: [297, 11.25, 46.36, 7.45],
    banana: [89, 1.1, 23, 0.3], bread: [252, 12.3, 43, 3.5], rice: [130, 2.7, 28, 0.3],
    "toor dal": [343, 21.7, 62.78, 1.49]
  };
  Object.entries(expected).forEach(([query, values]) => {
    const food = app.sandbox.searchLocalFoodSources(query)[0];
    [food.calories, food.protein, food.carbs, food.fat].forEach((value, index) => assert.strictEqual(value, values[index], query + " macro " + index));
  });
  assert.strictEqual(app.sandbox.normalizeFoodSearchQuery("glass"), "glass");
  [["onion", 170000], ["matar", 170419], ["papita", 169926], ["moong", 174256], ["kaju", 170162]].forEach(([query, fdcId]) => {
    const food = app.sandbox.searchLocalFoodSources(query)[0];
    assert.ok(food, query + " should be in the offline dataset");
    assert.strictEqual(food.fdcId, fdcId);
    assert.strictEqual(food.sourceTag, "USDA");
    assert.ok(food.unitGrams && Object.keys(food.unitGrams).length, query + " should retain source-backed portion weights");
  });
});

test("every pre-search food name and alias remains available from local search", () => {
  const app = loadNutritionSandbox();
  vm.runInContext(fs.readFileSync(__dirname + "/../food-api.js", "utf8"), app.sandbox);
  const baseline = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pre-search-foods-c6536d4.json", "utf8"));
  const failures = [];
  baseline.foods.forEach((food) => {
    [food.name].concat(food.aliases || []).forEach((query) => {
      const normalizedQuery = app.sandbox.normalizeFoodSearchQuery(query);
      const matches = app.sandbox.searchLocalFoodSources(query);
      const exactLocalMatch = matches.some((result) => [result.name].concat(result.aliases || [])
        .some((name) => app.sandbox.normalizeFoodSearchQuery(name) === normalizedQuery));
      if (!matches.length || !exactLocalMatch) failures.push(food.name + (query === food.name ? "" : " ← " + query));
    });
  });
  if (failures.length) console.error("Legacy food search failures:", failures.join(", "));
  assert.deepStrictEqual(failures, [], "Legacy local food searches with no exact result: " + failures.join(", "));
});

test("whole-word relevance filtering stays on external food results, not local foods", () => {
  const app = loadNutritionSandbox();
  vm.runInContext(fs.readFileSync(__dirname + "/../food-api.js", "utf8"), app.sandbox);
  app.sandbox.getFoodLibrary = () => ({
    favorites: [{ name: "Apple favorite", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 }],
    customFoods: [{ name: "Apple custom", calories: 55, protein: 0.4, carbs: 14, fat: 0.2, fiber: 2.1 }]
  });
  const local = app.sandbox.searchLocalFoodSources("app");
  assert.ok(local.some((food) => food.source === "Favorite"));
  assert.ok(local.some((food) => food.source === "Custom food"));
  assert.ok(local.some((food) => food.source === "MacroBay built-in"));
  assert.ok(app.sandbox.searchLocalFoodSources("car").some((food) => food.fdcId === 170393), "offline foods remain substring-searchable");
  assert.deepStrictEqual(app.sandbox.filterExternalFoodSearchResults([
    { name: "Apple cereal bar", calories: 150, protein: 3, carbs: 25, fat: 4, fiber: 2 }
  ], "app"), [], "external foods still require a whole-word match");
});

test("Food search groups local and packaged results, filters irrelevant external names, and exposes a named empty state", async () => {
  const app = loadFoodApiRetrySandbox();
  const matches = app.sandbox.filterExternalFoodSearchResults([
    { name: "Kimchi", calories: 30, protein: 1, carbs: 5, fat: 0, fiber: 1 },
    { name: "Carottes râpées with dressing", calories: 80, protein: 1, carbs: 8, fat: 4, fiber: 2 },
    { name: "Carrot salad", calories: 70, protein: 1, carbs: 8, fat: 2, fiber: 3 },
    { name: "Carrot drink", calories: null, protein: 1, carbs: 8, fat: 2, fiber: 3 }
  ], "carrots");
  assert.deepStrictEqual(matches.map((food) => food.name), ["Carrot salad"]);
  const requested = [];
  app.sandbox.requestFoodApiJson = async function (url, options) {
    requested.push({ url, options });
    if (url.includes("search.openfoodfacts.org")) return { hits: [{ product_name: "Carrot salad", nutriments: { "energy-kcal_100g": 60, proteins_100g: 1, carbohydrates_100g: 8, fat_100g: 2 } }] };
    return { products: [] };
  };
  const packagedResults = await app.sandbox.searchOpenFoodFacts("carrots");
  assert.strictEqual(packagedResults[0].name, "Carrot salad");
  assert.ok(requested[0].options.timeoutMs <= 4000);
  const requestBody = JSON.parse(requested[0].options.body);
  assert.deepStrictEqual(Array.from(requestBody.langs), ["en"]);
  app.sandbox.renderFoodApiResults([
    { name: "My food", calories: 10, source: "Favorite", resultGroup: "your" },
    ...Array.from({ length: 4 }, (_, i) => ({ name: "Packaged " + i, calories: 10, source: "Open Food Facts", resultGroup: "packaged" }))
  ], "nothing");
  const collectText = (node) => [node.textContent || "", ...(node.children || []).map(collectText)].join(" ");
  const resultText = collectText(app.document.getElementById("food-api-results"));
  assert.match(resultText, /Your foods/);
  assert.match(resultText, /Packaged \(Open Food Facts\)/);
  assert.match(resultText, /Show more/);
  const packaged = app.document.getElementById("food-api-results").children[1];
  const more = packaged.children[2];
  more.click();
  assert.strictEqual(packaged.children[1].children.length, 4);
  app.sandbox.renderFoodApiResults([], "dragonfruitxyz");
  const emptyText = collectText(app.document.getElementById("food-api-results"));
  assert.match(emptyText, /No match for 'dragonfruitxyz'/);
  assert.match(emptyText, /Add custom food/);
  app.document.getElementById("food-api-results").children[1].click();
  assert.strictEqual(app.document.getElementById("food-name").value, "dragonfruitxyz");
  assert.strictEqual(app.document.getElementById("custom-food-name").value, "dragonfruitxyz");
});

test("Food search keeps local results when Open Food Facts fails and shows only its muted note", async () => {
  const app = loadFoodApiRetrySandbox();
  app.sandbox.getFoodLibrary = () => ({ favorites: [], customFoods: [] });
  app.sandbox.searchBuiltInFoodList = () => [{ name: "carrot", calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, source: "MacroBay built-in" }];
  app.sandbox.fetch = async function () { throw new TypeError("offline"); };
  app.sandbox.beginFoodSearch("carrot", 0, null);
  await new Promise((resolve) => setImmediate(resolve));
  const status = app.document.getElementById("food-api-status");
  const root = app.document.getElementById("food-api-results");
  const text = (node) => [node.textContent || "", ...(node.children || []).map(text)].join(" ");
  assert.match(text(root), /carrot/);
  assert.match(text(root), /Packaged foods unavailable right now/);
  assert.doesNotMatch(status.textContent, /Some sources unavailable/);
});

test("Nutrition food entry puts barcode controls behind a disclosure and keeps the compact field order", () => {
  const html = fs.readFileSync(__dirname + "/../nutrition/index.html", "utf8");
  assert.match(html, /<details[^>]*id="food-barcode-disclosure"/);
  assert.match(html, /Scan or enter barcode/);
  assert.match(html, /placeholder="Search foods \(e\.g\. paneer, roti, banana\)"/);
  assert.match(html, /<label for="food-amount" id="food-amount-label">Amount<\/label>/);
  assert.doesNotMatch(html, /Searches saved foods|Type the barcode number\./);
  assert.match(html, /id="food-api-status"/);
  assert.match(html, /id="food-nutrition-preview"/);
  const nav = fs.readFileSync(__dirname + "/../main.css", "utf8");
  assert.match(nav, /\.mobile-tab\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0;/s);
  assert.match(nav, /\.mobile-tab\s*\{[^}]*font-size:\s*11px;/s);
  assert.match(nav, /\.mobile-tab\s*\{[^}]*letter-spacing:\s*0;/s);
  assert.match(nav, /\.mobile-tab\s*\{[^}]*white-space:\s*nowrap;/s);
});

test("B barcode lookup handles the real Nutella barcode, HTTP 404, and network failures separately", async () => {
  const app = loadFoodApiRetrySandbox();
  const code = "3017620422003";
  let requestedUrl = "";
  app.sandbox.fetch = async function (url) {
    requestedUrl = url;
    return {
      ok: true,
      json: async function () {
        return { status: "success", product: { code: code, product_name: "Nutella", serving_size: "15 g", nutriments: {
          "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0
        } } };
      }
    };
  };
  const product = await app.sandbox.lookupOpenFoodFactsBarcode(code);
  assert.ok(requestedUrl.includes("/api/v3/product/" + code));
  assert.strictEqual(product.name, "Nutella");
  assert.strictEqual(product.servingGrams, 15);
  assert.strictEqual(product.calories, 539);

  app.sandbox.fetch = async function () { return { ok: false, status: 404 }; };
  await assert.rejects(app.sandbox.lookupOpenFoodFactsBarcode(code), /Barcode not found\. Add it as a custom food instead\./);

  app.sandbox.fetch = async function () { throw new Error("Failed to fetch"); };
  await assert.rejects(app.sandbox.lookupOpenFoodFactsBarcode(code), function (error) { return error.kind === "network"; });
});

test("A10 exercise library errors include a working retry control", async () => {
  const app = loadExerciseApiRetrySandbox();
  await app.sandbox.searchExerciseLibrary("squat", 0, app.results);
  assert.match(app.results.children[0].textContent, /offline/);
  assert.strictEqual(app.results.children[1].textContent, "Retry search");

  let requests = 0;
  app.sandbox.fetch = async function () {
    requests += 1;
    return { ok: true, json: async function () { return { results: [], next: null }; } };
  };
  await app.results.children[1].click();
  assert.strictEqual(requests, 2);
  assert.match(app.results.textContent, /No matches in the currently loaded public results/);
});

test("R2-3 wger name search is used first and the client library is the fallback", async () => {
  const tooShort = loadExerciseApiRetrySandbox();
  let shortRequests = 0;
  tooShort.sandbox.fetch = async function () { shortRequests += 1; throw new Error("should not search"); };
  await tooShort.sandbox.searchExerciseLibrary("b", 0, tooShort.results);
  assert.strictEqual(shortRequests, 0);
  assert.match(tooShort.results.textContent, /at least two letters/);

  const serverSearch = loadExerciseApiRetrySandbox();
  const serverRequests = [];
  serverSearch.sandbox.fetch = async function (url) {
    serverRequests.push(url);
    return {
      ok: true,
      async json() {
        return {
          count: 27,
          next: "https://wger.de/api/v2/exerciseinfo/?language=2&limit=20&name__search=bench&offset=20",
          results: [{ id: 73, translations: [{ language: 2, name: "Bench Press" }], category: { name: "Chest" }, muscles: [] }]
        };
      }
    };
  };
  await serverSearch.sandbox.searchExerciseLibrary("bench", 0, serverSearch.results);
  assert.match(serverRequests[0], /name__search=bench/);
  assert.match(serverRequests[0], /limit=20/);
  assert.strictEqual(serverRequests.length, 1);
  assert.strictEqual(serverSearch.results.children[0].children[0].children[0].textContent, "Bench Press");

  const fallback = loadExerciseApiRetrySandbox();
  const fallbackRequests = [];
  fallback.sandbox.fetch = async function (url) {
    fallbackRequests.push(url);
    if (url.includes("name__search=")) throw new Error("search unavailable");
    return {
      ok: true,
      async json() {
        return {
          count: 1,
          next: null,
          results: [{ id: 73, translations: [{ language: 2, name: "Bench Press" }], category: { name: "Chest" }, muscles: [] }]
        };
      }
    };
  };
  await fallback.sandbox.searchExerciseLibrary("bench", 0, fallback.results);
  assert.strictEqual(fallbackRequests.length, 2);
  assert.ok(fallbackRequests[0].includes("name__search="));
  assert.match(fallbackRequests[1], /limit=100/);
  assert.strictEqual(fallback.results.children[0].children[0].children[0].textContent, "Bench Press");
});

test("R2-3 exercise library keeps parallel partial results and retries the failed page", async () => {
  const app = loadExerciseApiRetrySandbox();
  const requests = [];
  let failThirdPage = true;
  app.sandbox.fetch = async function (url) {
    requests.push(url);
    if (url.includes("name__search=")) throw new Error("server search unavailable");
    const offset = Number(new URL(url).searchParams.get("offset"));
    if (offset === 200 && failThirdPage) throw new Error("page 3 failed");
    return {
      ok: true,
      async json() {
        const pageIndex = offset / 100;
        const results = Array.from({ length: 100 }, (_unused, index) => ({
          id: offset + index + 1,
          translations: [{ language: 2, name: index === 0 ? "Bench Press page " + (pageIndex + 1) : "Exercise " + (offset + index + 1) }],
          category: { name: "Chest" }, muscles: []
        }));
        return {
          count: 300,
          next: offset < 200 ? "https://wger.de/api/v2/exerciseinfo/?language=2&limit=100&offset=" + (offset + 100) : null,
          results
        };
      }
    };
  };

  await app.sandbox.searchExerciseLibrary("bench", 0, app.results);
  assert.deepStrictEqual(requests.map((url) => url.includes("name__search=") ? "server" : new URL(url).searchParams.get("offset")), [
    "server", "0", "100", "200"
  ]);
  assert.strictEqual(app.results.children[0].children[0].children[0].textContent, "Bench Press page 1");
  assert.strictEqual(app.results.children[1].children[0].children[0].textContent, "Bench Press page 2");
  assert.match(app.results.children[2].textContent, /Searched 200 of ~300 exercises; some results may be missing/);
  assert.strictEqual(app.results.children[3].textContent, "Retry search");

  failThirdPage = false;
  await app.results.children[3].click();
  assert.strictEqual(app.results.children.length, 3);
  assert.strictEqual(app.results.children[2].children[0].children[0].textContent, "Bench Press page 3");
  assert.ok(app.results.children.every((child) => !/some results may be missing/.test(child.textContent)));
});

test("R2-4 Netlify syncs the service-worker cache before staging and Max HR age bounds match validation", () => {
  const netlify = fs.readFileSync(__dirname + "/../netlify.toml", "utf8");
  const buildCommand = netlify.match(/^command\s*=\s*"([^"]+)"/m);
  assert.ok(buildCommand);
  assert.deepStrictEqual(buildCommand[1].split(" && "), [
    "node scripts/sync-service-worker-cache.js",
    "node scripts/prepare-netlify.js"
  ]);

  const maxhr = fs.readFileSync(__dirname + "/../maxhr/index.html", "utf8");
  assert.match(maxhr, /id="age"[^>]*min="1" max="120"/);
});

test("B20 exercise search checks up to 20 pages and can find entries beyond the first 500", async () => {
  const app = loadExerciseApiRetrySandbox();
  let requests = 0;
  let activeRequests = 0;
  let maxConcurrentRequests = 0;
  app.sandbox.fetch = async function (url) {
    requests += 1;
    const urlObject = new URL(url);
    if (urlObject.searchParams.has("name__search")) {
      return { ok: true, async json() { return { count: 0, results: [], next: null }; } };
    }
    activeRequests += 1;
    maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
    await new Promise((resolve) => setTimeout(resolve, 2));
    activeRequests -= 1;
    const page = Number(urlObject.searchParams.get("offset")) / 100;
    const results = Array.from({ length: 100 }, (_unused, index) => ({
      id: page * 100 + index + 1,
      translations: [{ language: 2, name: page === 12 && index === 0 ? "Deep Squat" : "Exercise " + (page * 100 + index + 1) }]
    }));
    return {
      ok: true,
      async json() {
        return {
          count: 2000,
          results,
          next: page < 19
            ? "https://wger.de/api/v2/exerciseinfo/?language=2&limit=100&offset=" + ((page + 1) * 100)
            : null
        };
      }
    };
  };

  await app.sandbox.searchExerciseLibrary("deep squat", 0, app.results);
  assert.strictEqual(requests, 21);
  assert.strictEqual(maxConcurrentRequests, 4);
  assert.strictEqual(app.results.children.length, 1);
  assert.strictEqual(app.results.children[0].children[0].children[0].textContent, "Deep Squat");
});

test("A4 unit preferences convert display values while stored measurements stay metric", () => {
  values.clear();
  ctx.saveProfile(male);
  assert.strictEqual(ctx.formatWorkoutSet({ reps: 8, weight: 60 }), "8×60kg");
  ctx.saveMacroBayPreferences({ theme: "light" });
  ctx.saveMacroBayPreferences({ units: { weight: "lb", height: "ft-in" } });
  assert.strictEqual(ctx.getMacroBayWeightUnit(), "lb");
  assert.strictEqual(ctx.formatWorkoutSet({ reps: 8, weight: 60 }), "8×132.3lb");
  assert.strictEqual(ctx.getMacroBayPreferences().theme, "light");
  assert.ok(Math.abs(ctx.kilogramsToDisplayWeight(80) - 176.37) < 0.02);
  assert.ok(Math.abs(ctx.displayWeightToKilograms(176.37) - 80) < 0.02);
  const imperialHeight = ctx.centimetersToFeetInches(180);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(imperialHeight)), { feet: 5, inches: 10.9 });
  assert.ok(Math.abs(ctx.feetInchesToCentimeters(imperialHeight.feet, imperialHeight.inches) - 180) < 0.2);
  assert.strictEqual(ctx.getProfile().weight, 80);
  assert.strictEqual(ctx.getProfile().height, 180);
});

test("A4 planner displays and saves weigh-ins in the selected unit without changing stored kg", () => {
  const app = loadPlannerSandbox({ profile: male });
  const today = app.sandbox.getDateKey(new app.sandbox.Date());
  app.sandbox.savePlannerFor(today, { date: today, weight: 80, workouts: [], tasks: [] });
  app.sandbox.saveMacroBayPreferences({ units: { weight: "lb" } });
  app.sandbox.announceDataChange(today, "macrobay_preferences");

  assert.strictEqual(app.getElement("planner-weight-value").textContent, "176.4");
  assert.strictEqual(app.getElement("planner-weight-unit").textContent, "lb");
  app.getElement("planner-weight-input").value = "178.6";
  app.sandbox.saveWeight();
  assert.ok(Math.abs(app.sandbox.getPlannerFor(today).weight - 81.01) < 0.02);
  assert.ok(Math.abs(app.sandbox.getProfile().weight - 81.01) < 0.02);
});

test("C6 water target uses profile weight and recorded exercise duration", () => {
  assert.strictEqual(ctx.getWaterGoalLiters({}, {}), null);
  const profile = { weight: 80 };
  assert.strictEqual(ctx.getWaterGoalLiters(profile, { workouts: [] }), 2.64);
  const planner = { workouts: [{ exercises: [{ sets: [{ durationMinutes: 20 }, { durationMinutes: 40 }] }] }] };
  assert.strictEqual(ctx.getWaterGoalLiters(profile, planner), 3.34);
});

test("A8 adaptive insights use actual weight, protein, step, and activity history", () => {
  values.clear();
  ctx.saveProfile({ ...male, goal: "lose" });
  ctx.writeJSON("macrobay_targets", { calories: 2000, protein: 150 });
  const dateAtOffset = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return ctx.getDateKey(date);
  };
  const oldDate = dateAtOffset(8);
  ctx.savePlannerFor(oldDate, { date: oldDate, weight: 79, steps: 4000, workouts: [], tasks: [] });
  ctx.saveProgressRecord(oldDate);
  [3, 2, 1, 0].forEach((offset) => {
    const date = dateAtOffset(offset);
    ctx.savePlannerFor(date, {
      date,
      weight: offset === 0 ? 80 : null,
      steps: 4000,
      workouts: offset === 1 ? [{ name: "Session", completed: true, exercises: [] }] : [],
      tasks: []
    });
    ctx.saveNutritionFor(date, { calories: 1800, protein: 80, foods: [{ name: "Meal" }] });
    ctx.saveProgressRecord(date);
  });

  const insights = ctx.getAdaptiveHistoryInsights();
  assert.ok(insights.some((item) => item.includes("weight trend moved up")));
  assert.ok(insights.some((item) => item.includes("Protein has averaged")));
  assert.ok(insights.some((item) => item.includes("Steps have averaged")));
  assert.ok(insights.some((item) => item.includes("7-day review")));
  assert.ok(insights.some((item) => item.includes("consecutive days")));
});

test("Phase 5 CSS uses the shared 1199/850/768/480 viewport set", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const viewportBreakpoints = [...new Set(Array.from(css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g), (match) => Number(match[1])))];
  assert.deepStrictEqual(viewportBreakpoints.slice().sort((a, b) => b - a), [1199, 850, 768, 480, 340]);
  assert.doesNotMatch(css, /\.workspace\b/);
});

test("G1 shared typography keeps readable minimums, neutral tracking, and a wider canvas", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const navRefinement = css.indexOf("/* Food search and entry controls */");
  const fontSizes = Array.from(css.matchAll(/font-size\s*:\s*([^;]+);/g), (match) => ({ value: match[1].trim(), index: match.index }));
  for (const { value, index } of fontSizes) {
    const directPixels = value.match(/^(\d+(?:\.\d+)?)px/);
    if (directPixels && index < navRefinement) assert.ok(Number(directPixels[1]) >= 14, "font size below 14px: " + value);
    if (directPixels && index >= navRefinement) assert.ok(Number(directPixels[1]) >= 11, "font size below 11px: " + value);
  }
  assert.match(css, /--text-body:\s*16px/);
  assert.match(css, /--content-width:\s*840px/);
  assert.match(css, /h1,h2,h3,h4,h5,h6\s*\{[^}]*font-weight:\s*700/);
  assert.match(css, /label,\.field label,\.add-exercise-form label,\.pill-group label,\.page-kicker,\.section-kicker\s*\{[^}]*font-weight:\s*600[^}]*letter-spacing:\s*0/);
  const calculatorsLabelRule = /\.mobile-tab\[aria-label="Calculators"\] > span:last-child\s*\{\s*font-size:\s*11px;\s*letter-spacing:\s*-.06em;\s*\}/;
  assert.doesNotMatch(css.replace(calculatorsLabelRule, ""), /letter-spacing:\s*-/);
});

test("R6-2 History range controls are sticky pills and day summaries are tappable", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const historyStyles = css.slice(css.indexOf(".history-range {"), css.indexOf(".history-summary {"));
  assert.match(historyStyles, /position:\s*sticky/);
  assert.match(historyStyles, /top:\s*64px/);
  assert.match(historyStyles, /border-radius:\s*999px/);
  assert.match(css, /\.history-record-details\s*>\s*\.history-record-summary\s*\{[\s\S]*cursor:\s*pointer/);
});

test("Phase 5 Planner markup uses the shared page and card classes", () => {
  const planner = fs.readFileSync(__dirname + "/../planner/index.html", "utf8");
  assert.match(planner, /<main class="page-shell planner-page">/);
  assert.match(planner, /<header class="page-heading">/);
  assert.match(planner, /class="card planner-card/);
  assert.doesNotMatch(planner, /class="workspace|class="tile planner-card/);
  const navIndex = planner.indexOf("id=\"previous-day\"");
  const stepsIndex = planner.indexOf("id=\"steps-heading\"");
  const weightIndex = planner.indexOf("id=\"weight-heading\"");
  const workoutsIndex = planner.indexOf("id=\"workouts-heading\"");
  const tasksIndex = planner.indexOf("id=\"tasks-heading\"");
  assert.ok(navIndex < stepsIndex && stepsIndex < weightIndex && weightIndex < workoutsIndex && workoutsIndex < tasksIndex);
  assert.match(planner, /id="today-day"/);
  assert.match(planner, /id="planner-view-templates" aria-pressed="false">Templates/);
  assert.doesNotMatch(planner, /id="planner-view-all"/);
  assert.match(planner, /id="planner-workouts-card"/);
  assert.match(planner, /id="planner-task-card"/);
  const templatesIndex = planner.indexOf('id="planner-templates-card"');
  assert.ok(templatesIndex > planner.indexOf('id="planner-task-card"'));
  assert.match(planner, /id="new-workout"/);
  assert.match(planner, /id="workout-session"/);
  assert.match(planner, /id="exercise-search-sheet"/);
  assert.doesNotMatch(planner, /Search exercise library|Search library|planner-create-row/);
  const templateCard = planner.slice(templatesIndex, planner.indexOf("</section>", templatesIndex));
  assert.doesNotMatch(templateCard, /id="(?:workout-list|task-list)"/);
  ["planner-steps", "planner-steps-goal", "planner-weight-value", "planner-weight-unit", "completed-workouts", "completed-tasks"].forEach((id) => {
    assert.match(planner, new RegExp(`id="${id}"`));
  });
});

test("Planner focus tabs show Workouts, Tasks, or Templates without repeating the other lists", () => {
  const app = loadPlannerSandbox();
  const workouts = app.getElement("planner-workouts-card");
  const tasks = app.getElement("planner-task-card");
  const templates = app.getElement("planner-templates-card");
  assert.strictEqual(workouts.hidden, false);
  assert.strictEqual(tasks.hidden, true);
  assert.strictEqual(templates.hidden, true);

  app.getElement("planner-view-workouts").click();
  assert.strictEqual(workouts.hidden, false);
  assert.strictEqual(tasks.hidden, true);
  assert.strictEqual(templates.hidden, true);
  app.getElement("planner-view-tasks").click();
  assert.strictEqual(workouts.hidden, true);
  assert.strictEqual(tasks.hidden, false);
  assert.strictEqual(templates.hidden, true);
  app.getElement("planner-view-templates").click();
  assert.strictEqual(workouts.hidden, true);
  assert.strictEqual(tasks.hidden, true);
  assert.strictEqual(templates.hidden, false);
});

test("Phase 6 planner date navigation refreshes the selected day's activity", () => {
  const app = loadPlannerSandbox();
  const date = new Date(app.now());
  const today = app.sandbox.getDateKey(date);
  date.setDate(date.getDate() - 1);
  const yesterday = app.sandbox.getDateKey(date);
  app.sandbox.savePlannerFor(yesterday, { date: yesterday, steps: 2300, weight: 71.5, workouts: [], tasks: [] });
  app.sandbox.savePlannerFor(today, { date: today, steps: 4800, weight: 72.2, workouts: [], tasks: [] });

  app.getElement("previous-day").click();
  assert.strictEqual(app.getElement("planner-steps").textContent, 2300);
  assert.strictEqual(app.getElement("planner-weight-value").textContent, "71.5");
  app.getElement("next-day").click();
  assert.strictEqual(app.getElement("planner-steps").textContent, 4800);
  assert.strictEqual(app.getElement("planner-weight-value").textContent, "72.2");
  app.getElement("previous-day").click();
  app.getElement("today-day").click();
  assert.strictEqual(app.getElement("selected-day-label").textContent, "Today");
  assert.strictEqual(app.getElement("planner-steps").textContent, 4800);
});

test("Phase 6 profile rejects an under-18 age before changing stored profile data", () => {
  const app = loadProfileSandbox();
  const get = app.getElement;
  get("profile-age").value = "17";
  get("profile-sex").value = "male";
  get("profile-height").value = "180";
  get("profile-weight").value = "80";
  get("profile-activity").value = "moderate";
  get("profile-goal").value = "maintain";
  get("profile-form").handlers.submit({ preventDefault() {} });

  assert.deepStrictEqual(JSON.parse(JSON.stringify(app.sandbox.getProfile())), {});
  assert.match(get("profile-status").textContent, /age 18–100/);
  assert.strictEqual(get("profile-status").dataset.state, "error");
  assert.strictEqual(app.toasts.at(-1).type, "error");
});

test("Phase 6 global script builds consistent navigation and keyboard mobile controls", () => {
  const app = loadGlobalScriptSandbox();
  const expected = ["Home", "Calculators", "Activity", "Progress", "Profile"];
  const desktopLabels = Array.from(app.desktopNav.innerHTML.matchAll(/>(Home|Calculators|Activity|Progress|Profile)<\/a>/g), (match) => match[1]);
  const mobileLabels = Array.from(app.mobileMenu.innerHTML.matchAll(/<a class="[^"]*"[^>]*>([^<]+)<\/a>/g), (match) => match[1]);
  const bottomNav = app.appended.find((element) => element.className === "bottom-nav");
  const bottomLabels = Array.from(bottomNav.innerHTML.matchAll(/<span>(Home|Calculators|Activity|Progress|Profile)<\/span>/g), (match) => match[1]);
  assert.deepStrictEqual(desktopLabels, expected);
  assert.deepStrictEqual(mobileLabels, ["Nutrition", "Planner", "History", "All calculators", "Settings", "About", "Privacy"]);
  assert.deepStrictEqual(bottomLabels, ["Home", "Calculators", "Activity", "Progress", "Profile"]);
  assert.match(bottomNav.innerHTML, /aria-label="Calculators"[^>]*><span class="mobile-tab-icon">/);
  assert.doesNotMatch(app.mobileMenu.innerHTML, /Primary navigation|mobile-primary-link|mobile-tool-link/);
  assert.deepStrictEqual(Array.from(app.mobileMenu.innerHTML.matchAll(/mobile-menu-heading">([^<]+)</g), (match) => match[1]), ["Track", "Calculators", "App"]);
  const generatedLinks = Array.from(app.mobileMenu.innerHTML.matchAll(/href="([^"]+)"/g), (match) => match[1]);
  assert.strictEqual(generatedLinks.length, 7);
  generatedLinks.forEach((href) => {
    const destination = new URL(href, "https://macrobay.test/");
    assert.match(destination.pathname, /\/index\.html$/, `${href} should target an explicit page file`);
    const localFile = __dirname + "/../" + destination.pathname.replace(/^\/+/, "");
    assert.ok(fs.existsSync(localFile), `${href} should resolve to an existing app page`);
  });
  const calculatorsPage = loadGlobalScriptSandbox("https://macrobay.test/calculators/");
  const calculatorsBottomNav = calculatorsPage.appended.find((element) => element.className === "bottom-nav");
  assert.match(calculatorsBottomNav.innerHTML, /class="mobile-tab active" href="https:\/\/macrobay\.test\/calculators\/index\.html"/);
  assert.match(calculatorsPage.mobileMenu.innerHTML, /class="mobile-calculators-link active"[^>]*href="https:\/\/macrobay\.test\/calculators\/index\.html" aria-current="page">All calculators<\/a>/);
  assert.strictEqual(app.rootElement.dataset.theme, "dark");

  const calculatorPage = loadGlobalScriptSandbox("https://macrobay.test/bmi/index.html");
  const calculatorState = calculatorPage.sandbox.window.macrobayNavigation.getState();
  assert.strictEqual(calculatorState.primary, "Calculators");
  assert.strictEqual(calculatorState.tool, "BMI");
  assert.match(calculatorPage.mobileMenu.innerHTML, /class="mobile-calculators-link active"[^>]*>All calculators<\/a>/);

  const nutritionPage = loadGlobalScriptSandbox("https://macrobay.test/nutrition/index.html");
  assert.strictEqual(nutritionPage.sandbox.window.macrobayNavigation.getState().primary, null);
  assert.strictEqual(nutritionPage.sandbox.window.macrobayNavigation.getState().tracking, "Nutrition");
  assert.doesNotMatch(nutritionPage.appended.find((element) => element.className === "bottom-nav").innerHTML, /mobile-tab active/);
  assert.match(nutritionPage.mobileMenu.innerHTML, /mobile-track-link active[^>]*>Nutrition<\/a>/);

  const settingsPage = loadGlobalScriptSandbox("https://macrobay.test/settings/index.html");
  const settingsState = settingsPage.sandbox.window.macrobayNavigation.getState();
  assert.strictEqual(settingsState.primary, null);
  assert.strictEqual(settingsState.app, "Settings");
  assert.doesNotMatch(settingsPage.appended.find((element) => element.className === "bottom-nav").innerHTML, /mobile-tab active/);
  assert.match(settingsPage.mobileMenu.innerHTML, /mobile-app-link active[^>]*>Settings<\/a>/);
  settingsPage.sandbox.window.location.href = "https://macrobay.test/settings/index.html#settings-about";
  settingsPage.windowListeners.hashchange.forEach((handler) => handler());
  assert.strictEqual(settingsPage.sandbox.window.macrobayNavigation.getState().app, "About");
  assert.match(settingsPage.mobileMenu.innerHTML, /mobile-app-link active[^>]*>About<\/a>/);
  settingsPage.sandbox.window.location.href = "https://macrobay.test/profile/index.html";
  settingsPage.windowListeners.popstate.forEach((handler) => handler());
  assert.strictEqual(settingsPage.sandbox.window.macrobayNavigation.getState().primary, "Profile");
  assert.match(settingsPage.appended.find((element) => element.className === "bottom-nav").innerHTML, /mobile-tab active[\s\S]*?<span>Profile/);

  [
    ["https://macrobay.test/", "Home", "Home"],
    ["https://macrobay.test/calculators/index.html", "Calculators", "Calculators"],
    ["https://macrobay.test/planner/index.html", "Activity", "Activity"],
    ["https://macrobay.test/history/index.html", "Progress", "Progress"],
    ["https://macrobay.test/profile/index.html", "Profile", "Profile"]
  ].forEach(([href, expectedLabel, mobileLabel]) => {
    const route = loadGlobalScriptSandbox(href);
    assert.strictEqual(route.sandbox.window.macrobayNavigation.getState().primary, expectedLabel);
    assert.match(route.desktopNav.innerHTML, new RegExp('class="active"[^>]*aria-current="page">' + expectedLabel));
    assert.match(route.appended.find((element) => element.className === "bottom-nav").innerHTML, new RegExp('mobile-tab active[\\s\\S]*?<span>' + mobileLabel));
  });

  app.hamburger.click();
  assert.strictEqual(app.hamburger.getAttribute("aria-expanded"), "true");
  assert.strictEqual(app.mobileMenu.hidden, false);
  app.documentListeners.click({ target: {} });
  assert.strictEqual(app.hamburger.getAttribute("aria-expanded"), "false");
  assert.strictEqual(app.mobileMenu.hidden, true);
  app.hamburger.click();
  app.documentListeners.keydown({ key: "Escape" });
  assert.strictEqual(app.hamburger.getAttribute("aria-expanded"), "false");
  assert.strictEqual(app.mobileMenu.hidden, true);
  app.hamburger.click();
  app.mobileMenu.handlers.click({ target: { closest() { return {}; } } });
  assert.strictEqual(app.hamburger.getAttribute("aria-expanded"), "false");
  assert.strictEqual(app.mobileMenu.hidden, true);
  app.sandbox.window.macrobayApplyThemePreference("light");
  assert.strictEqual(app.rootElement.dataset.theme, "light");
});

test("Header theme buttons are removed from app pages while Settings keeps its theme control", () => {
  const htmlFiles = [];
  function collect(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      if (["tests", "android", "ios", "node_modules", ".git"].includes(entry.name)) return;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(fullPath);
    });
  }
  collect(path.join(__dirname, ".."));
  htmlFiles.forEach((file) => assert.doesNotMatch(fs.readFileSync(file, "utf8"), /class="theme-toggle"/, file));
  const settings = fs.readFileSync(__dirname + "/../settings/index.html", "utf8");
  assert.match(settings, /id="settings-theme"/);
  assert.match(settings, /<script src="\.\.\/settings\.js"><\/script>/);
  assert.match(fs.readFileSync(__dirname + "/../theme-init.js", "utf8"), /macrobayApplyThemePreference|dataset\.theme/);
});

test("Onboarding completion persists through refresh and legacy MacroBay data is migrated", () => {
  const freshStorage = new Map();
  const firstVisit = loadGlobalScriptSandbox("https://macrobay.test/", {
    includeSplash: true, withStore: true, storage: freshStorage
  });
  assert.strictEqual(firstVisit.splashScreen.hidden, false);
  assert.strictEqual(firstVisit.bodyClasses.has("splash-active"), true);
  assert.strictEqual(firstVisit.sandbox.hasCompletedMacroBayOnboarding(), false);

  firstVisit.splashStart.click();
  assert.strictEqual(firstVisit.splashScreen.hidden, true);
  assert.strictEqual(firstVisit.bodyClasses.has("splash-active"), false);
  assert.strictEqual(JSON.parse(freshStorage.get("macrobay_preferences")).onboardingComplete, true);

  const homeRefresh = loadGlobalScriptSandbox("https://macrobay.test/", {
    includeSplash: true, withStore: true, storage: freshStorage
  });
  assert.strictEqual(homeRefresh.splashScreen.hidden, true);
  assert.strictEqual(homeRefresh.bodyClasses.has("splash-active"), false);
  assert.strictEqual(homeRefresh.sandbox.window.macrobayNavigation.getState().primary, "Home");

  const existingProfileBytes = JSON.stringify(male);
  const legacyStorage = new Map([
    ["macrobay_profile", existingProfileBytes],
    ["macrobay_preferences", JSON.stringify({ theme: "light", units: { weight: "lb", height: "ft-in" } })]
  ]);
  const existingProfileHome = loadGlobalScriptSandbox("https://macrobay.test/", {
    includeSplash: true, withStore: true, storage: legacyStorage
  });
  assert.strictEqual(existingProfileHome.splashScreen.hidden, true);
  assert.strictEqual(legacyStorage.get("macrobay_profile"), existingProfileBytes);
  assert.deepStrictEqual(JSON.parse(legacyStorage.get("macrobay_preferences")), {
    theme: "light", units: { weight: "lb", height: "ft-in" }, onboardingComplete: true
  });

  const loggedDataStorage = new Map([
    ["macrobay_nutrition", JSON.stringify({ "2026-10-06": { calories: 180, foods: [{ name: "Oats", calories: 180 }] } })]
  ]);
  const existingActivityHome = loadGlobalScriptSandbox("https://macrobay.test/", {
    includeSplash: true, withStore: true, storage: loggedDataStorage
  });
  assert.strictEqual(existingActivityHome.splashScreen.hidden, true);
  assert.strictEqual(JSON.parse(loggedDataStorage.get("macrobay_preferences")).onboardingComplete, true);
});

test("Header keeps mauve controls, removes the bottom rule, and retains keyboard-only focus styling", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const topbar = css.match(/\.topbar\s*\{[^}]+\}/)[0];
  const homeTopbar = css.match(/body\.home-screen \.topbar\s*\{([^}]+)\}/)[1];
  const bmiTopbar = css.match(/body\[data-calc="bmi"\] \.topbar\s*\{([^}]+)\}/)[1];
  const controls = css.match(/\.theme-toggle,\.menu-toggle\s*\{[^}]+\}/)[0];
  assert.match(topbar, /border-bottom:\s*0/);
  assert.doesNotMatch(homeTopbar, /border-(?:left|right|inline)\s*:/);
  assert.doesNotMatch(bmiTopbar, /border-(?:left|right|inline)\s*:/);
  assert.match(controls, /background:\s*color-mix\(in srgb, var\(--mauve\)/);
  assert.match(controls, /color:\s*var\(--ink\)/);
  assert.doesNotMatch(controls, /background:\s*var\(--surface\)/);
  assert.match(css, /\.topbar \.theme-toggle:focus:not\(:focus-visible\)[\s\S]*?outline:\s*none/);
  assert.match(css, /\.topbar \.theme-toggle:focus-visible[\s\S]*?outline:\s*2px solid/);
});

test("Shared color tokens use the strict mauve and neutral palette", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const darkTokens = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  const lightTokens = css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(darkTokens, /--accent:\s*#b4748d/);
  assert.match(darkTokens, /--mauve:\s*#664250/);
  assert.match(darkTokens, /--accent-strong:\s*#d5aebd/);
  assert.match(darkTokens, /--page:\s*#141214/);
  assert.match(lightTokens, /--accent:\s*#704857/);
  assert.match(lightTokens, /--mauve:\s*#664250/);
  assert.match(lightTokens, /--page:\s*#f6f2f3/);
  assert.doesNotMatch(css, /--accent-blue|--accent-violet|--blue\s*:/);
  assert.doesNotMatch(css, /#(?:4d8dff|316bd7|73a6ff|3169cb|438cff|8c9dde|6c66aa)/i);
  assert.match(css, /--home-ring-active:\s*#b4748d/);
  assert.match(css, /--home-ring-active:\s*#8f5b70/);
});

test("Home Today's Overview Edit opens the existing Nutrition route", () => {
  const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
  assert.match(html, /id="home-overview-edit" href="nutrition\/index\.html"/);
  assert.ok(fs.existsSync(__dirname + "/../nutrition/index.html"));
});

test("Mobile navigation uses one detached capsule layout with room below page content", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const navRules = Array.from(css.matchAll(/\.bottom-nav\s*\{([^}]*)\}/g), (match) => match[1]);
  assert.strictEqual(navRules.length, 3, "desktop hide, shared mobile, and narrow-phone rules");
  assert.doesNotMatch(css, /body[^{}]*\.bottom-nav\s*\{/);
  const mobileNav = navRules.find((rule) => /position:\s*fixed/.test(rule));
  assert.ok(mobileNav);
  [
    /left:\s*50%/,
    /bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom\)\)/,
    /width:\s*min\(calc\(100% - 26px\),420px\)/,
    /height:\s*64px/,
    /border:\s*1px solid var\(--line\)/,
    /border-radius:\s*999px/,
    /background:\s*color-mix\(in srgb,var\(--surface\) 82%,transparent\)/,
    /box-shadow:\s*var\(--shadow-raised\)/,
    /backdrop-filter:\s*blur\(18px\)/
  ].forEach((rule) => assert.match(mobileNav, rule));
  assert.match(css, /\.mobile-tab\.active\s*\{\s*color:\s*var\(--accent-strong\);\s*background:\s*color-mix\(in srgb,var\(--accent\) 16%,transparent\)/);
  const navScript = fs.readFileSync(__dirname + "/../script.js", "utf8");
  assert.match(navScript, /label:\s*"Calculators",\s*mobileLabel:\s*"Calculators"/);
  assert.match(navScript, /item\.mobileLabel \? ' aria-label="' \+ item\.label/);
  assert.match(navScript, /\(item\.mobileLabel \|\| item\.label\)/);
  assert.match(css, /padding-bottom:\s*calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  assert.doesNotMatch(mobileNav, /border-top\s*:/);
  assert.match(mobileNav, /gap:\s*1px/);
  assert.match(mobileNav, /padding:\s*2px/);
  assert.match(css, /@media\s*\(max-width:\s*340px\)\s*\{\s*\.bottom-nav\s*\{\s*width:\s*min\(calc\(100% - 16px\),420px\)/);
  assert.match(css, /\.mobile-tab\s*\{[^}]*font-size:\s*12px[^}]*font-weight:\s*600[^}]*letter-spacing:\s*0/);
});

test("Settings exposes shared app preferences, data tools, and app information", () => {
  const html = fs.readFileSync(__dirname + "/../settings/index.html", "utf8");
  assert.match(html, /<title>Settings — MacroBay<\/title>/);
  assert.match(html, /<select id="settings-theme">[\s\S]*value="system">System[\s\S]*value="light">Light[\s\S]*value="dark">Dark/);
  assert.match(html, /id="unit-preferences-form"/);
  assert.match(html, /id="unit-weight"[\s\S]*value="kg"[\s\S]*value="lb"/);
  assert.match(html, /id="unit-height"[\s\S]*value="cm"[\s\S]*value="ft-in"/);
  ["export-data", "import-data-file", "reset-data", "settings-about", "settings-privacy", "settings-app-version", "usda-key-form", "usda-api-key", "clear-usda-key"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`));
  });
  assert.doesNotMatch(html, /id="profile-(?:name|age|sex|height|weight|activity|goal)"/);
  assert.match(html, /<script src="\.\.\/settings\.js"><\/script>/);
  assert.match(fs.readFileSync(__dirname + "/../service-worker.js", "utf8"), /"\.\/settings\/index\.html"/);
});

test("USDA API key is saved and cleared through the existing preferences storage key", () => {
  const app = loadProfileSandbox();
  app.getElement("usda-api-key").value = "user-provided-key";
  app.getElement("usda-key-form").handlers.submit({ preventDefault() {} });
  assert.strictEqual(app.sandbox.getMacroBayPreferences().usdaApiKey, "user-provided-key");
  assert.strictEqual(app.storage.has("macrobay_preferences"), true);

  app.getElement("clear-usda-key").click();
  assert.strictEqual(app.sandbox.getMacroBayPreferences().usdaApiKey, "");
  assert.strictEqual(app.getElement("usda-api-key").value, "");
});

test("B21 initial theme follows OS light preference unless a theme is stored", () => {
  const followsOS = loadGlobalScriptSandbox("https://macrobay.test/", { osLight: true });
  assert.strictEqual(followsOS.rootElement.dataset.theme, "light");

  const systemPreferenceFollowsOS = loadGlobalScriptSandbox("https://macrobay.test/settings/index.html", {
    osLight: true,
    preferences: { theme: "system" }
  });
  assert.strictEqual(systemPreferenceFollowsOS.rootElement.dataset.theme, "light");

  const storedChoiceWins = loadGlobalScriptSandbox("https://macrobay.test/", {
    osLight: true,
    preferences: { theme: "dark" }
  });
  assert.strictEqual(storedChoiceWins.rootElement.dataset.theme, "dark");
});

function runThemeInitializer(options = {}) {
  const source = fs.readFileSync(__dirname + "/../theme-init.js", "utf8");
  const root = { dataset: {} };
  const requestedKeys = [];
  const storedValues = Object.assign({}, options.values || {});
  const window = {
    MACROBAY_TEST_MODE: options.testMode === true,
    location: { pathname: options.pathname || "/" },
    matchMedia: options.matchMedia === false ? undefined : function (query) {
      assert.strictEqual(query, "(prefers-color-scheme: light)");
      if (options.throwMatchMedia) throw new Error("matchMedia unavailable");
      return { matches: options.osLight === true };
    }
  };
  window.top = window;
  const sandbox = {
    document: { documentElement: root }, window,
    localStorage: {
      getItem(key) {
        requestedKeys.push(key);
        if (options.throwStorage) throw new Error("storage unavailable");
        return Object.prototype.hasOwnProperty.call(storedValues, key) ? storedValues[key] : null;
      },
      setItem(key, value) { storedValues[key] = String(value); }
    }
  };
  vm.runInNewContext(source, sandbox);
  return { theme: root.dataset.theme, requestedKeys, values: storedValues };
}

test("R7 early theme initializer applies saved preference, OS fallback, and the test storage namespace", () => {
  const loadTheme = runThemeInitializer;

  assert.strictEqual(loadTheme({ osLight: true }).theme, "light");
  assert.strictEqual(loadTheme({ osLight: true, values: { macrobay_preferences: JSON.stringify({ theme: "system" }) } }).theme, "light");
  assert.strictEqual(loadTheme({ osLight: true, values: { macrobay_preferences: JSON.stringify({ theme: "dark" }) } }).theme, "dark");
  assert.strictEqual(loadTheme({ matchMedia: false }).theme, "dark");
  assert.strictEqual(loadTheme({ throwStorage: true, throwMatchMedia: true }).theme, "dark");
  const testPage = loadTheme({
    pathname: "/tests/profile.html", testMode: true, osLight: false,
    values: { test_macrobay_preferences: JSON.stringify({ theme: "light" }) }
  });
  assert.strictEqual(testPage.theme, "light");
  assert.strictEqual(testPage.requestedKeys.at(-1), "test_macrobay_preferences");
});

test("FitCalc storage keys migrate byte-for-byte to MacroBay keys without replacing newer data", () => {
  const loadTheme = runThemeInitializer;
  const mapping = [
    ["fitcalc_profile", "macrobay_profile"],
    ["fitcalc_history", "macrobay_history"],
    ["fitcalc_targets", "macrobay_targets"],
    ["fitcalc_nutrition", "macrobay_nutrition"],
    ["fitcalc_planner", "macrobay_planner"],
    ["fitcalc_preferences", "macrobay_preferences"],
    ["fitcalc_food_library", "macrobay_food_library"],
    ["fitcalc_workout_templates", "macrobay_workout_templates"],
    ["fitcalc_progress_backfill_v1", "macrobay_progress_backfill_v1"],
    ["fitcalc_progress_backfill_v2", "macrobay_progress_backfill_v2"],
    ["fitcalc_schema_version", "macrobay_schema_version"]
  ];
  const legacy = Object.fromEntries(mapping.map(([oldKey], index) => [oldKey, index === 0 ? "{\"name\":\"Existing user\",\"onboardingComplete\":true}" : `raw-${index}`]));
  legacy.fitcalc_nutrition = "null";
  legacy.fitcalc_history = "not-json";
  const existingUser = loadTheme({ osLight: false, values: legacy });
  assert.strictEqual(existingUser.values.macrobay_profile, legacy.fitcalc_profile);
  assert.strictEqual(existingUser.values.macrobay_preferences, legacy.fitcalc_preferences);
  assert.strictEqual(existingUser.theme, "dark", "malformed preferences fall back safely");
  const existingStorage = new Map([
    ["macrobay_profile", existingUser.values.macrobay_profile],
    ["macrobay_preferences", existingUser.values.macrobay_preferences]
  ]);
  const existingHome = loadGlobalScriptSandbox("https://macrobay.test/", { withStore: true, storage: existingStorage });
  assert.strictEqual(existingHome.sandbox.hasCompletedMacroBayOnboarding(), true, "existing users must not be sent through onboarding again");
  assert.strictEqual(JSON.parse(existingStorage.get("macrobay_profile")).name, "Existing user");
  assert.strictEqual(JSON.parse(existingStorage.get("macrobay_preferences")).onboardingComplete, true);

  const currentProfile = "{\"name\":\"Newer profile\"}";
  const migrated = loadTheme({ osLight: false, values: Object.assign({}, legacy, { macrobay_profile: currentProfile }) });

  for (const [oldKey, newKey] of mapping) {
    if (newKey === "macrobay_profile") assert.strictEqual(migrated.values[newKey], currentProfile, "new MacroBay profile must win");
    else assert.strictEqual(migrated.values[newKey], legacy[oldKey], `${oldKey} should be preserved exactly`);
  }
  assert.strictEqual(migrated.values.macrobay_storage_migration_v1, "1");
  assert.strictEqual(JSON.parse(migrated.values.macrobay_profile).name, "Newer profile");

  migrated.values.fitcalc_profile = "stale profile";
  const rerun = loadTheme({ osLight: false, values: migrated.values });
  assert.strictEqual(rerun.values.macrobay_profile, currentProfile, "rerunning migration must not overwrite existing data");
  assert.strictEqual(rerun.values.macrobay_storage_migration_v1, "1");

  const testMode = loadTheme({
    testMode: true, pathname: "/tests/migration.html", osLight: false,
    values: { test_fitcalc_preferences: "{\"theme\":\"light\"}", test_fitcalc_profile: "profile" }
  });
  assert.strictEqual(testMode.theme, "light");
  assert.strictEqual(testMode.values.test_macrobay_profile, "profile");
  assert.strictEqual(testMode.values.test_macrobay_storage_migration_v1, "1");
});

test("R7 theme tokens, page bootstraps, and service-worker shell cover both themes", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  [
    "--mauve: #664250", "--mauve-wash: linear-gradient(180deg, #664250 0%, rgb(102 66 80 / 0) 320px)",
    "--accent-strong: #d5aebd", "--progress: #b4748d",
    "--progress-gradient: linear-gradient(100deg, #704857 0%, #a3657d 52%, #d5aebd 100%)",
    "--accent: #b4748d",
    "--muted: #c8b9bf", "--home-ring-track: #3a3236", "--home-ring-active: #b4748d",
    "--home-icon-surface: #2b2529", "--home-plan-surface: #211d20", "--home-sparkline: #d5aebd",
    "--home-quote-mountain-back: #5b424d", "--home-quote-mountain-mid: #44353b",
    "--home-quote-mountain-front: #2c2428", "--home-quote-line: #bb9dab", "--bmi-marker: #f5f4ee",
    "--mauve-wash: linear-gradient(180deg, #ead7de 0%, rgb(234 215 222 / 0) 320px)",
    "--accent-strong: #704857", "--progress: #a7627d",
    "--progress-gradient: linear-gradient(100deg, #704857 0%, #87566a 52%, #a7627d 100%)",
    "--accent: #704857", "--muted: #6d5c63",
    "--home-ring-track: #e6dade", "--home-ring-active: #8f5b70",
    "--home-icon-surface: #f1e8ec", "--home-plan-surface: #f7f0f2", "--home-sparkline: #704857",
    "--home-quote-mountain-back: #e4d5da", "--home-quote-mountain-mid: #d4c0c7",
    "--home-quote-mountain-front: #bea6b0", "--home-quote-line: #775662", "--bmi-marker: #32242a",
    "--terminal-accent-secondary: #d5aebd", "--terminal-accent-secondary: #704857"
  ].forEach((token) => assert.ok(css.includes(token), `missing theme token ${token}`));
  assert.match(css, /\.brand-mark\s*\{[^}]*color:\s*var\(--accent-ink\)/);
  assert.match(css, /box-shadow:\s*0 0 14px color-mix\(in srgb, var\(--terminal-accent\) 24%, transparent\)/);
  assert.match(css, /\.macrobay-dialog::backdrop\s*\{\s*background:\s*rgba\(0,0,0,\.58\)/);

  function htmlFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (["android", "netlify-dist", "node_modules", "tests"].includes(entry.name)) return [];
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? htmlFiles(entryPath) : entry.name.endsWith(".html") ? [entryPath] : [];
    });
  }
  const appPages = htmlFiles(__dirname + "/..").filter((file) => /<script[^>]*src="[^\"]*script\.js"/.test(fs.readFileSync(file, "utf8")));
  assert.strictEqual(appPages.length, 20);
  appPages.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    const initializer = html.match(/<script src="([^\"]*theme-init\.js)"><\/script>/);
    assert.ok(initializer, `${file} should load the theme initializer`);
    assert.ok(html.indexOf(initializer[0]) < html.indexOf("</head>"), `${file} should load it in the head`);
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), initializer[1])), `${file} theme initializer path should resolve`);
  });
  const serviceWorker = fs.readFileSync(__dirname + "/../service-worker.js", "utf8");
  assert.match(serviceWorker, /"\.\/theme-init\.js"/);
  assert.match(serviceWorker, /"\.\/manifest\.webmanifest"/);
  const manifest = JSON.parse(fs.readFileSync(__dirname + "/../manifest.webmanifest", "utf8"));
  assert.strictEqual(manifest.background_color, "#141214");
  assert.strictEqual(manifest.theme_color, "#664250");
});

test("R8 feature icon accents are semantic in both themes while brand navigation stays mauve", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const darkTokens = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
  const lightTokens = css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)[1];
  const features = ["nutrition", "activity", "progress", "calculators", "planner", "history", "water", "calories", "protein", "carbs", "fat", "fiber", "workout", "weight"];
  features.forEach((feature) => {
    assert.match(darkTokens, new RegExp(`--feature-${feature}:\\s*#[0-9a-f]{6}`, "i"), `dark ${feature} token`);
    assert.match(lightTokens, new RegExp(`--feature-${feature}:\\s*#[0-9a-f]{6}`, "i"), `light ${feature} token`);
  });
  [
    [darkTokens, "--feature-nutrition: #C9B64A"], [darkTokens, "--feature-calculators: #6FB07A"],
    [darkTokens, "--feature-activity: #E8863F"], [darkTokens, "--feature-progress: #D97FA8"],
    [darkTokens, "--feature-profile: #D88BB0"], [darkTokens, "--feature-planner: #4F8FE0"],
    [darkTokens, "--feature-history: #C779A8"], [darkTokens, "--feature-calculator-tdee: #C98AA6"],
    [darkTokens, "--feature-calculator-calories: #6FB07A"], [darkTokens, "--feature-calculator-macro: #E8863F"],
    [darkTokens, "--feature-calculator-bmr: #E8863F"], [darkTokens, "--feature-steps-goal: #E8863F"],
    [darkTokens, "--feature-calories: #E26B4F"], [darkTokens, "--feature-protein: #E0524F"],
    [darkTokens, "--feature-carbs: #E8863F"], [darkTokens, "--feature-fat: #E2C35D"], [darkTokens, "--feature-fiber: #6FB07A"],
    [darkTokens, "--feature-steps: #D98A99"], [darkTokens, "--feature-water: #5AA0E6"],
    [lightTokens, "--feature-nutrition: #7A8A5A"], [lightTokens, "--feature-activity: #C8553D"],
    [lightTokens, "--feature-progress: #9A5668"], [lightTokens, "--feature-calories: #D9573B"],
    [lightTokens, "--feature-protein: #B83A3A"], [lightTokens, "--feature-carbs: #A94E0C"],
    [lightTokens, "--feature-fat: #846300"], [lightTokens, "--feature-fiber: #397747"],
    [lightTokens, "--feature-water: #3F8FCB"], [lightTokens, "--feature-workout: #A8566A"],
    [lightTokens, "--feature-steps: #B85C54"], [lightTokens, "--feature-steps-goal: #B66A33"],
    [lightTokens, "--feature-walk: #3787CB"], [lightTokens, "--feature-mobility: #617D49"]
  ].forEach(([tokens, expected]) => assert.ok(tokens.includes(expected), `missing ${expected}`));
  assert.match(css, /\.calculator-row-icon\s*\{[^}]*color:\s*var\(--calculator-icon-accent\)[^}]*border-color:\s*color-mix\(in srgb,var\(--calculator-icon-accent\) 25%,var\(--surface\)\)[^}]*background:\s*color-mix\(in srgb,var\(--calculator-icon-accent\) 14%,var\(--surface\)\)/);
  assert.match(css, /\.splash-feature-icon\s*\{[^}]*background:\s*color-mix\(in srgb,var\(--splash-feature-accent\) 15%,var\(--surface\)\)/);
  assert.match(css, /\.nutrition-page \.nutrition-progress-row \.nutrition-progress-fill\s*\{\s*background:\s*var\(--ui-nutrition-progress\)/);
  assert.match(css, /\.progress-chart\[aria-label\^="Weight trend"\]\s*\{\s*--chart-accent:\s*var\(--ui-chart-weight\)/);
  assert.match(css, /\.home-metric-card:has\(#terminal-protein\)\s*\{\s*--metric-accent:\s*var\(--feature-protein\)/);
  const calculatorHtml = fs.readFileSync(__dirname + "/../calculators/index.html", "utf8");
  const calculatorRows = Array.from(calculatorHtml.matchAll(/<a class="calculator-directory-row" href="[^"]+" data-category="([^"]+)" data-calc="([^"]+)">/g), ([, category, id]) => ({ category, id }));
  assert.strictEqual(calculatorRows.length, 14);
  const calculatorIds = ["bmi", "bmr", "tdee", "calorie", "macro", "protein", "bodyfat", "idealweight", "maxhr", "sleep", "water", "steps", "workout", "resttimer"];
  assert.deepStrictEqual(calculatorRows.map((row) => row.id), calculatorIds);
  calculatorRows.forEach((row, index) => {
    assert.match(darkTokens, new RegExp(`--calc-${row.id}:\\s*#[0-9a-f]{6}`, "i"), `dark calculator color ${row.id}`);
    assert.match(lightTokens, new RegExp(`--calc-${row.id}:\\s*#[0-9a-f]{6}`, "i"), `light calculator color ${row.id}`);
    const darkColor = darkTokens.match(new RegExp(`--calc-${row.id}:\\s*(#[0-9a-f]{6})`, "i"))[1].toLowerCase();
    const lightColor = lightTokens.match(new RegExp(`--calc-${row.id}:\\s*(#[0-9a-f]{6})`, "i"))[1].toLowerCase();
    if (index > 0) {
      const previousId = calculatorRows[index - 1].id;
      assert.notStrictEqual(darkColor, darkTokens.match(new RegExp(`--calc-${previousId}:\\s*(#[0-9a-f]{6})`, "i"))[1].toLowerCase());
      assert.notStrictEqual(lightColor, lightTokens.match(new RegExp(`--calc-${previousId}:\\s*(#[0-9a-f]{6})`, "i"))[1].toLowerCase());
    }
    calculatorRows.filter((candidate) => candidate.category === row.category && candidate.id !== row.id).forEach((candidate) => {
      assert.notStrictEqual(darkColor, darkTokens.match(new RegExp(`--calc-${candidate.id}:\\s*(#[0-9a-f]{6})`, "i"))[1].toLowerCase());
      assert.notStrictEqual(lightColor, lightTokens.match(new RegExp(`--calc-${candidate.id}:\\s*(#[0-9a-f]{6})`, "i"))[1].toLowerCase());
    });
  });
  assert.match(css, /\.calculator-directory-row\[data-calc="protein"\] \.calculator-row-icon\s*\{\s*--calculator-icon-accent:\s*var\(--calc-protein\)/);
  assert.match(css, /\.calculator-directory-row\[data-calc="maxhr"\] \.calculator-row-icon\s*\{\s*--calculator-icon-accent:\s*var\(--calc-maxhr\)/);
  assert.match(css, /\.calculator-directory-row\[data-calc="water"\] \.calculator-row-icon\s*\{\s*--calculator-icon-accent:\s*var\(--calc-water\)/);
  assert.match(css, /\.calculator-directory-row\[data-calc="steps"\] \.calculator-row-icon\s*\{\s*--calculator-icon-accent:\s*var\(--calc-steps\)/);
  assert.match(css, /\.calculator-directory-row\[data-calc="sleep"\] \.calculator-row-icon\s*\{\s*--calculator-icon-accent:\s*var\(--calc-sleep\)/);
  assert.match(css, /\.nutrition-remaining-card \.nutrition-remaining\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*8px/s);
  assert.match(css, /\.nutrition-remaining-card \.nutrition-remaining strong\s*\{[^}]*font-size:\s*17px;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.home-quick-tool\[href\$="protein\/index\.html"\] > span\s*\{[^}]*color:\s*var\(--feature-protein\)[^}]*background:\s*color-mix\(in srgb,var\(--feature-protein\) 15%,var\(--surface\)\)/);
  assert.match(css, /\.nutrition-page \.nutrition-progress-row:has\(#protein-progress\) \.nutrition-progress-fill\s*\{\s*background:\s*var\(--feature-protein\)/);
  assert.match(css, /\.nutrition-page \.nutrition-total-card:has\(#total-protein\) span/);
  assert.match(css, /body\[data-calc="protein"\] \.result-headline strong/);
  assert.match(fs.readFileSync(__dirname + "/../calculators.js", "utf8"), /bar\(s\[1\] \* 100, "var\(--feature-protein\)", "protein"/);
  assert.match(css, /\.home-metric-card:has\(#terminal-steps\)\s*\{\s*--metric-accent:\s*var\(--feature-steps\)/);
  assert.match(css, /\.home-metric-card:has\(#terminal-water\)\s*\{\s*--metric-accent:\s*var\(--feature-water\)/);
  assert.match(css, /:root\[data-theme="light"\] \.home-metric-card \.home-ring\s*\{[^}]*conic-gradient\(var\(--ink-soft\) var\(--ring-progress\)/);
  assert.match(css, /:root\[data-theme="light"\] \.planner-steps-card #steps-progress\s*\{\s*border:\s*1px solid var\(--ink-soft\)/);
  assert.match(css, /\.mobile-tab\.active\s*\{[^}]*color:\s*var\(--accent-strong\)/);
  assert.match(css, /mobile-tab:not\(\.active\).*feature-profile/);
  assert.match(css, /\.primary-btn\s*\{[^}]*background:\s*linear-gradient\(112deg,var\(--accent\),var\(--accent-strong\)\)/);
  assert.match(css, /button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible/);
  assert.match(css, /button:disabled/);
});

test("feature colors meet icon and text contrast thresholds in dark and light themes", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  const themes = [
    { name: "dark", background: "#141214", block: css.match(/:root\s*\{([\s\S]*?)\n\}/)[1] },
    { name: "light", background: "#fffdfd", block: css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)[1] }
  ];
  const textFeatures = ["--feature-protein", "--feature-carbs", "--feature-fat", "--feature-fiber"];
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255).map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  function resolve(name, values, seen = new Set()) {
    assert.ok(!seen.has(name), `cyclic feature token ${name}`);
    seen.add(name);
    const value = values[name];
    assert.ok(value, `missing feature token ${name}`);
    if (value.startsWith("var(")) return resolve(value.match(/var\((--[\w-]+)/)[1], values, seen);
    assert.match(value, /^#[0-9a-f]{6}$/i, `${name} must resolve to a six-digit color`);
    return value;
  }
  themes.forEach((theme) => {
    const values = Object.fromEntries(Array.from(theme.block.matchAll(/(--[\w-]+):\s*([^;]+);/g), ([, name, value]) => [name, value.trim()]));
    const featureNames = Object.keys(values).filter((name) => name.startsWith("--feature-"));
    assert.ok(featureNames.length, `${theme.name} feature tokens exist`);
    featureNames.forEach((name) => {
      const color = resolve(name, values);
      const a = luminance(color);
      const b = luminance(theme.background);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 3, `${theme.name} ${name} contrast ${ratio.toFixed(2)}:1 is below 3:1`);
      if (textFeatures.includes(name)) assert.ok(ratio >= 4.5, `${theme.name} ${name} text contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
    });
  });
});

test("mobile Calculators tab uses neutral tracking and a bounded label box", () => {
  const css = fs.readFileSync(__dirname + "/../main.css", "utf8");
  assert.doesNotMatch(css, /letter-spacing:\s*-\s*(?:\d|\.)/);
  assert.match(css, /\.mobile-tab\[aria-label="Calculators"\]\s*\{[^}]*flex:\s*1 1 0;[^}]*min-width:\s*0;[^}]*padding:\s*0 2px;[^}]*font-size:\s*11px;/s);
  assert.match(css, /\.mobile-tab\[aria-label="Calculators"\]\s*>\s*span:last-child\s*\{[^}]*font-size:\s*11px;[^}]*letter-spacing:\s*0;[^}]*overflow:\s*visible;/s);
});

test("Capacitor native runtime skips service-worker registration while browser PWA keeps it", () => {
  const browser = loadGlobalScriptSandbox("https://macrobay.test/");
  assert.strictEqual(browser.serviceWorkerRegistrations.length, 1);

  const native = loadGlobalScriptSandbox("https://localhost/", { capacitorNative: true });
  assert.strictEqual(native.serviceWorkerRegistrations.length, 0);
});

test("history-generated edit and empty-state navigation uses explicit page files", () => {
  const html = ctx.createHistoryRecordHTML({
    date: "2026-10-03", weight: null, calories: 0, water: 0, protein: 0, carbs: 0, fat: 0, steps: 0,
    workouts: [], tasks: [], foods: [], completedWorkouts: 0, completedTasks: 0
  });
  assert.match(html, /href="\.\.\/nutrition\/index\.html\?date=2026-10-03"/);
  assert.match(html, /href="\.\.\/planner\/index\.html\?date=2026-10-03"/);
  const historySource = fs.readFileSync(__dirname + "/../history.js", "utf8");
  assert.match(historySource, /href="\.\.\/nutrition\/index\.html">Log nutrition/);
  assert.match(historySource, /href="\.\.\/planner\/index\.html">Open planner/);
});

test("Phase 6 production query strings cannot switch localStorage into test mode", () => {
  const previousLocation = ctx.window.location;
  const previousFlag = ctx.window.MACROBAY_TEST_MODE;
  ctx.window.location = { pathname: "/index.html", search: "?test=1" };
  ctx.window.MACROBAY_TEST_MODE = true;
  try {
    assert.strictEqual(ctx.macrobayStorageKey("macrobay_profile"), "macrobay_profile");
  } finally {
    ctx.window.location = previousLocation;
    ctx.window.MACROBAY_TEST_MODE = previousFlag;
  }
});

test("R2-0 optional service worker icons cannot block the critical app-shell install", async () => {
  const listeners = {};
  let criticalAssets = [];
  const optionalAssets = [];
  let skippedWaiting = false;
  let openedCacheName = "";
  const sandbox = {
    Promise,
    self: {
      skipWaiting() { skippedWaiting = true; return Promise.resolve(); },
      addEventListener(type, handler) { listeners[type] = handler; }
    },
    caches: {
      open(name) {
        openedCacheName = name;
        return Promise.resolve({
          addAll(paths) { criticalAssets = paths; return Promise.resolve(); },
          add(path) {
            optionalAssets.push(path);
            return path.endsWith("icon_128x128.png")
              ? Promise.reject(new Error("optional icon is missing"))
              : Promise.resolve();
          }
        });
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../service-worker.js", "utf8"), sandbox);

  let installPromise;
  listeners.install({ waitUntil(value) { installPromise = value; } });
  await installPromise;

  assert.ok(criticalAssets.includes("./index.html"));
  assert.ok(criticalAssets.includes("./script.js"));
  assert.ok(!criticalAssets.some((path) => path.includes("build/icon.iconset")));
  assert.deepStrictEqual(optionalAssets, [
    "./build/icon.iconset/icon_128x128.png",
    "./build/icon.iconset/icon_512x512.png"
  ]);
  const packageVersion = JSON.parse(fs.readFileSync(__dirname + "/../package.json", "utf8")).version;
  assert.strictEqual(openedCacheName, `macrobay-app-shell-v${packageVersion}`);
  assert.strictEqual(skippedWaiting, true);
});

test("R5-7 B18 service worker uses safe navigation caching and cache-first for fonts and icons", async () => {
  const listeners = {};
  let cachedAssets = [];
  const savedResources = [];
  let cacheName = "";
  let fetchCount = 0;
  let failFetch = false;
  let fetchResponseOk = true;
  const cacheMatchOptions = [];
  const cache = {
    addAll(paths) { cachedAssets = paths; return Promise.resolve(); },
    add() { return Promise.resolve(); },
    put(_request, response) { savedResources.push(response); return Promise.resolve(); }
  };
  const sandbox = {
    URL,
    Promise,
    self: {
      location: { origin: "https://macrobay.test" },
      clients: { claim() { return Promise.resolve(); } },
      skipWaiting() { return Promise.resolve(); },
      addEventListener(type, handler) { listeners[type] = handler; }
    },
    caches: {
      open(name) { cacheName = name; return Promise.resolve(cache); },
      match(key, options) {
        cacheMatchOptions.push(options || null);
        if (key && typeof key === "object") {
          const requestPath = new URL(key.url).pathname;
          if (requestPath === "/planner/") return Promise.resolve(null);
          if (requestPath === "/profile/index.html") return Promise.resolve(options && options.ignoreSearch ? "profile-index-response" : null);
          return Promise.resolve("cached-response");
        }
        if (key === "/planner/index.html") return Promise.resolve("planner-index-response");
        return Promise.resolve("cached-response");
      },
      keys() { return Promise.resolve([]); },
      delete() { return Promise.resolve(true); }
    },
    fetch(request) {
      fetchCount += 1;
      if (failFetch) return Promise.reject(new Error("offline"));
      const resource = new URL(request.url).pathname;
      return Promise.resolve({ ok: fetchResponseOk, resource, clone() { return "cached:" + resource; } });
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../service-worker.js", "utf8"), sandbox);

  let installPromise;
  listeners.install({ waitUntil(value) { installPromise = value; } });
  await installPromise;
  const packageVersion = JSON.parse(fs.readFileSync(__dirname + "/../package.json", "utf8")).version;
  assert.strictEqual(cacheName, `macrobay-app-shell-v${packageVersion}`);
  assert.ok(cachedAssets.includes("./calculators.js"));
  assert.ok(cachedAssets.includes("./calculators/index.html"));
  assert.ok(cachedAssets.includes("./assets/fonts/Inter-Variable.ttf"));

  for (const resource of ["/main.js", "/main.css", "/planner/index.html"]) {
    let responsePromise;
    listeners.fetch({
      request: { method: "GET", url: "https://macrobay.test" + resource, mode: "cors", destination: "" },
      respondWith(value) { responsePromise = value; },
      waitUntil() {}
    });
    assert.strictEqual((await responsePromise).resource, resource);
  }
  assert.strictEqual(fetchCount, 3);
  assert.deepStrictEqual(savedResources, ["cached:/main.js", "cached:/main.css", "cached:/planner/index.html"]);

  failFetch = true;
  let offlineResponse;
  listeners.fetch({
    request: { method: "GET", url: "https://macrobay.test/offline.js", mode: "cors", destination: "script" },
    respondWith(value) { offlineResponse = value; },
    waitUntil() {}
  });
  assert.strictEqual(await offlineResponse, "cached-response");

  let directoryResponse;
  listeners.fetch({
    request: { method: "GET", url: "https://macrobay.test/planner/", mode: "navigate", destination: "document" },
    respondWith(value) { directoryResponse = value; },
    waitUntil() {}
  });
  assert.strictEqual(await directoryResponse, "planner-index-response");

  let queryResponse;
  listeners.fetch({
    request: { method: "GET", url: "https://macrobay.test/profile/index.html?targetCalories=2000", mode: "navigate", destination: "document" },
    respondWith(value) { queryResponse = value; },
    waitUntil() {}
  });
  assert.strictEqual(await queryResponse, "profile-index-response");
  assert.ok(cacheMatchOptions.some((options) => options && options.ignoreSearch === true));

  failFetch = false;
  fetchResponseOk = false;
  let notFoundResponse;
  listeners.fetch({
    request: { method: "GET", url: "https://macrobay.test/not-found/index.html", mode: "navigate", destination: "document" },
    respondWith(value) { notFoundResponse = value; },
    waitUntil() {}
  });
  assert.strictEqual((await notFoundResponse).resource, "/not-found/index.html");
  await Promise.resolve();
  assert.ok(!savedResources.includes("cached:/not-found/index.html"));
  fetchResponseOk = true;

  let fontResponse;
  let fontRefresh;
  listeners.fetch({
    request: { method: "GET", url: "https://macrobay.test/assets/fonts/Inter-Variable.ttf", mode: "cors", destination: "font" },
    respondWith(value) { fontResponse = value; },
    waitUntil(value) { fontRefresh = value; }
  });
  assert.strictEqual(await fontResponse, "cached-response");
  await fontRefresh;
  assert.strictEqual(fetchCount, 8);
  assert.ok(savedResources.includes("cached:/assets/fonts/Inter-Variable.ttf"));
});

test("R3-1 exercise search ignores stale responses and clearing the query invalidates an in-flight search", async () => {
  const responseWithNames = (names) => ({
    ok: true,
    async json() {
      return { results: names.map((name, index) => ({
        id: index + 1, translations: [{ language: 2, name }], category: { name: "Strength" }, muscles: []
      })) };
    }
  });
  const stale = loadExerciseApiRetrySandbox();
  let resolveBen;
  stale.sandbox.fetch = function (url) {
    return new Promise((resolve) => {
      if (new URL(url).searchParams.get("name__search") === "ben") resolveBen = resolve;
      else resolve(responseWithNames(["Bench Press"]));
    });
  };
  const slowBen = stale.sandbox.searchExerciseLibrary("ben", 0, stale.results);
  await stale.sandbox.searchExerciseLibrary("bench", 0, stale.results);
  resolveBen(responseWithNames(["Beneath the Bar"]));
  await slowBen;
  assert.strictEqual(stale.results.children.length, 1);
  assert.strictEqual(stale.results.children[0].children[0].children[0].textContent, "Bench Press");

  const cleared = loadExerciseApiRetrySandbox();
  let resolvePending;
  cleared.sandbox.fetch = function () {
    return new Promise((resolve) => { resolvePending = resolve; });
  };
  const pending = cleared.sandbox.searchExerciseLibrary("bench", 0, cleared.results);
  cleared.sandbox.invalidateExerciseSearch(cleared.results);
  cleared.results.replaceChildren();
  cleared.results.textContent = "Enter at least two letters to search.";
  resolvePending(responseWithNames(["Bench Press"]));
  await pending;
  assert.strictEqual(cleared.results.textContent, "Enter at least two letters to search.");
  assert.match(fs.readFileSync(__dirname + "/../planner.js", "utf8"), /invalidateExerciseSearch\(results\)/);
});

test("R3-2 exercise search errors explain connection and HTTP failures and retain manual entry", async () => {
  const offline = loadExerciseApiRetrySandbox();
  offline.sandbox.navigator = { onLine: false };
  offline.sandbox.fetch = async function () { throw new Error("fetch failed"); };
  await offline.sandbox.searchExerciseLibrary("bench", 0, offline.results);
  assert.strictEqual(offline.results.children[0].textContent, "Couldn't reach the exercise library. Check your connection. You can still add an exercise by name.");
  assert.strictEqual(offline.results.children[1].textContent, "Retry search");

  const http = loadExerciseApiRetrySandbox();
  http.sandbox.navigator = { onLine: true };
  http.sandbox.fetch = async function (url) {
    if (url.includes("name__search=")) return { ok: true, async json() { return { results: [] }; } };
    return { ok: false, status: 503 };
  };
  await http.sandbox.searchExerciseLibrary("bench", 0, http.results);
  assert.strictEqual(http.results.children[0].textContent, "Exercise library returned HTTP 503. You can still add an exercise by name.");
  assert.strictEqual(http.results.children[1].textContent, "Retry search");
});

test("R3-3 chart points are hidden from keyboard focus and each chart has an accessible summary", () => {
  const html = ctx.createLineChartHTML("Calories", "calories", "kcal", [
    { date: "2026-10-01", calories: 1800 },
    { date: "2026-10-02", calories: 2100 }
  ]);
  const points = Array.from(html.matchAll(/<span\s+class="chart-point"[\s\S]*?>/g), (match) => match[0]);
  assert.strictEqual(points.length, 2);
  points.forEach((point) => {
    assert.match(point, /aria-hidden="true"/);
    assert.match(point, /title="[^"]+"/);
    assert.doesNotMatch(point, /\btabindex=|\brole=/);
  });
  assert.match(html, /<section class="progress-chart" aria-label="Calories trend\. Latest value: 2,100 kcal\. Range: 1,800 to 2,100 kcal\.">/);
});

test("R4-1 chart summaries use actual data bounds rather than padded chart scale bounds", () => {
  const caloriesHTML = ctx.createLineChartHTML("Calories", "calories", "kcal", [
    { date: "2026-10-01", calories: 1800 },
    { date: "2026-10-02", calories: 2100 }
  ]);
  assert.match(caloriesHTML, /aria-label="Calories trend\. Latest value: 2,100 kcal\. Range: 1,800 to 2,100 kcal\."/);
  assert.doesNotMatch(caloriesHTML, /aria-label="Calories trend[^\"]*Range: 0 to 2,310/);

  const weightHTML = ctx.createLineChartHTML("Weight", "weight", "kg", [
    { date: "2026-10-01", weight: 72 },
    { date: "2026-10-02", weight: 80 }
  ]);
  assert.match(weightHTML, /aria-label="Weight trend\. Latest value: 80\.0 kg\. Range: 72\.0 to 80\.0 kg\."/);
  assert.doesNotMatch(weightHTML, /aria-label="Weight trend[^\"]*Range: 71\.2 to 80\.8/);
});

test("R3-4 History CSV uses the Food fallback for a food without a name", () => {
  const record = {
    date: "2026-10-03", weight: null, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0, steps: 0,
    completedWorkouts: 0, completedTasks: 0, foods: [{ meal: "Lunch", name: "", amount: 120 }], workouts: [], tasks: []
  };
  const csv = ctx.createHistoryCSV([record]);
  assert.match(csv, /Lunch: Food \(120 g\)/);
});
