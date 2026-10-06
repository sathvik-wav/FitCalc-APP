(function () {
  "use strict";

  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-bmi-unit]"));
  if (!buttons.length || typeof saveFitCalcPreferences !== "function") return;

  function updatePressedState() {
    var selected = getFitCalcUnits().weight === "lb" || getFitCalcUnits().height === "ft-in" ? "imperial" : "metric";
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.bmiUnit === selected));
    });
  }

  function setUnits(system) {
    var current = getFitCalcUnits();
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
      saveFitCalcPreferences({ units: next });
    } catch (error) {
      if (window.fitcalcToast) window.fitcalcToast("FitCalc could not save your unit preference.", "error");
      return;
    }

    window.dispatchEvent(new CustomEvent("fitcalc:data-change", { detail: { key: PREFERENCES_KEY } }));

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
  window.addEventListener("fitcalc:data-change", updatePressedState);
  window.addEventListener("storage", updatePressedState);
  updatePressedState();
})();
