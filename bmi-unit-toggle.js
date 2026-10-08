(function () {
  "use strict";

  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-bmi-unit]"));
  if (!buttons.length || typeof saveMacroBayPreferences !== "function") return;

  function updatePressedState() {
    var selected = getMacroBayUnits().weight === "lb" || getMacroBayUnits().height === "ft-in" ? "imperial" : "metric";
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.bmiUnit === selected));
    });
  }

  function setUnits(system) {
    var current = getMacroBayUnits();
    var heightInput = document.getElementById("height");
    var feetInput = document.getElementById("height-feet");
    var inchesInput = document.getElementById("height-inches");
    var weightInput = document.getElementById("weight");
    var heightCm = null;
    var weightKg = null;

    if (current.height === "ft-in") {
      if (feetInput.value.trim() || inchesInput.value.trim()) heightCm = feetInchesToCentimeters(feetInput.value, inchesInput.value);
    } else if (heightInput.value.trim()) {
      heightCm = Number(heightInput.value);
    }
    if (weightInput.value.trim()) weightKg = displayWeightToKilograms(weightInput.value);

    var next = system === "imperial"
      ? { weight: "lb", height: "ft-in" }
      : { weight: "kg", height: "cm" };
    try {
      saveMacroBayPreferences({ units: next });
    } catch (error) {
      if (window.macrobayToast) window.macrobayToast("MacroBay could not save your unit preference.", "error");
      return;
    }

    window.dispatchEvent(new CustomEvent("macrobay:data-change", { detail: { key: PREFERENCES_KEY } }));

    if (heightCm !== null && Number.isFinite(heightCm)) {
      if (system === "imperial") {
        var parts = centimetersToFeetInches(heightCm);
        feetInput.value = String(parts.feet);
        inchesInput.value = String(parts.inches);
      } else {
        heightInput.value = heightCm.toFixed(1);
      }
    }
    if (weightKg !== null && Number.isFinite(weightKg)) {
      weightInput.value = (system === "imperial" ? weightKg * 2.20462262185 : weightKg).toFixed(1);
    }
    updatePressedState();
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () { setUnits(button.dataset.bmiUnit); });
  });
  window.addEventListener("macrobay:data-change", updatePressedState);
  window.addEventListener("storage", updatePressedState);
  updatePressedState();
})();
