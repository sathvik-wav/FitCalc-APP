// FitCalc — calculator logic
// Each page sets <body data-calc="slug">; this file wires up that page's form.

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function num(id) { var el = $(id); if (!el) return NaN; return parseFloat(el.value); }
  function units() {
    if (typeof getFitCalcUnits === "function") return getFitCalcUnits();
    return { weight: "kg", height: "cm" };
  }
  function weightInKg(value) {
    return units().weight === "lb" ? value / 2.20462262185 : value;
  }
  function heightInCm() {
    if (units().height === "ft-in") {
      var feet = $("height-feet"), inches = $("height-inches");
      if (feet && inches) {
        if (typeof feetInchesToCentimeters === "function") return feetInchesToCentimeters(feet.value, inches.value);
        return (Number(feet.value) * 12 + Number(inches.value)) * 2.54;
      }
    }
    return num("height");
  }
  function displayWeight(valueKg) {
    return units().weight === "lb" ? valueKg * 2.20462262185 : valueKg;
  }
  function weightText(valueKg) {
    return round(displayWeight(valueKg), 1) + " " + units().weight;
  }
  function heightText(valueCm) {
    if (units().height === "cm") return round(valueCm, 1) + " cm";
    var totalInches = Math.round(valueCm / 2.54 * 10) / 10;
    var feet = Math.floor(totalInches / 12);
    var inches = Math.round((totalInches - feet * 12) * 10) / 10;
    if (inches >= 12) { feet += 1; inches = 0; }
    return feet + " ft " + inches + " in";
  }
  function validateRange(value, min, max, label, unit) {
    if (!Number.isFinite(value) || value < min || value > max) {
      showError(label + " must be between " + min + " and " + max + " " + unit + ".");
      return false;
    }
    return true;
  }
  function validateAdultAge(value) {
    if (!Number.isFinite(value) || value < 18) {
      showError("These estimates are for adults aged 18 and over.");
      return false;
    }
    if (value > 100) {
      showError("Age must be 100 years or younger for these estimates.");
      return false;
    }
    return true;
  }
  function validateWeight(valueKg) {
    var weightUnit = units().weight;
    var displayWeight = weightUnit === "lb" ? valueKg * 2.20462262185 : valueKg;
    var minimumWeight = weightUnit === "lb" ? 4.4 : 2;
    var maximumWeight = weightUnit === "lb" ? 1102.3 : 500;
    if (Number.isFinite(valueKg) && displayWeight >= minimumWeight && displayWeight <= maximumWeight) return true;
    showError(units().weight === "lb"
      ? "Weight must be between 4.4 and 1102.3 lb."
      : "Weight must be between 2 and 500 kg.");
    return false;
  }
  function checkedVal(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }
  function round(n, d) {
    if (d === undefined) d = 1;
    var f = Math.pow(10, d);
    return Math.round(n * f) / f;
  }

  function showResult(html) {
    var empty = $("result-empty");
    var content = $("result-content");
    if (empty) empty.hidden = true;
    if (content) { content.hidden = false; content.innerHTML = html; }
  }
  function showError(msg) {
    var empty = $("result-empty");
    var content = $("result-content");
    if (content) content.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.replaceChildren();
      var message = document.createElement("p");
      message.className = "result-error";
      message.setAttribute("role", "alert");
      message.textContent = msg;
      empty.appendChild(message);
    }
  }

  function headline(value, unit, tagText, tagClass) {
    return (
      '<div class="result-headline"><strong>' + value + "</strong><span>" + unit + "</span></div>" +
      '<span class="result-tag ' + tagClass + '">' + tagText + "</span>"
    );
  }
  function row(label, value) {
    return '<div class="row"><span>' + label + "</span><b>" + value + "</b></div>";
  }
  function rows(items) {
    return '<div class="result-rows">' + items.join("") + "</div>";
  }
  function useTargetValuesLink(values) {
    var params = Object.keys(values).map(function (key) {
      var value = Number(values[key]);
      if (!Number.isFinite(value) || value < 0) return "";
      return "target" + key.charAt(0).toUpperCase() + key.slice(1) + "=" + encodeURIComponent(String(Math.round(value)));
    }).filter(Boolean).join("&");
    return '<p class="calculator-use-value-row"><a class="secondary-btn" href="../profile/index.html?' + params + '">Use this value in Profile</a></p>';
  }
  function bar(pct, color, label, valueText) {
    return (
      '<div class="result-bar-wrap"><div class="row"><span>' + label + '</span><b>' + valueText + '</b></div>' +
      '<div class="result-bar"><i style="width:' + Math.min(100, Math.max(0, pct)) + '%;background:' + color + '"></i></div></div>'
    );
  }

  function onSubmit(fn) {
    var form = $("calc-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      try { fn(); } catch (err) {
        if (typeof console !== "undefined" && typeof console.error === "function") {
          console.error("Calculator submission failed:", err);
        }
        showError("check your inputs and try again");
      }
    });
  }

  function syncCalculatorUnits() {
    var selected = units();
    var heightLabel = $("height-label");
    var heightInput = $("height");
    var heightPair = $("height-imperial");
    var feet = $("height-feet");
    var inches = $("height-inches");
    var weightLabel = $("weight-label");
    var weightInput = $("weight");
    var imperialHeight = selected.height === "ft-in";
    if (heightLabel) {
      heightLabel.textContent = imperialHeight ? "Height (ft/in)" : "Height (cm)";
      heightLabel.htmlFor = imperialHeight ? "height-feet" : "height";
    }
    if (heightInput) {
      heightInput.hidden = imperialHeight;
      heightInput.disabled = imperialHeight;
      heightInput.required = !imperialHeight;
      heightInput.min = "50";
      heightInput.max = "272";
    }
    if (heightPair) heightPair.hidden = !imperialHeight;
    [feet, inches].forEach(function (input) {
      if (!input) return;
      input.disabled = !imperialHeight;
      input.required = imperialHeight;
    });
    if (weightLabel) {
      var optional = weightLabel.dataset && weightLabel.dataset.optional === "true";
      weightLabel.textContent = "Weight (" + selected.weight + ")" + (optional ? " — optional" : "");
    }
    if (weightInput) {
      weightInput.min = selected.weight === "lb" ? "4.4" : "2";
      weightInput.max = selected.weight === "lb" ? "1102.3" : "500";
      if (weightInput.placeholder && weightInput.placeholder.indexOf("e.g.") === 0) {
        weightInput.placeholder = selected.weight === "lb" ? "e.g. 150" : "e.g. 68";
      }
    }
  }

  var calculators = {

    // ---------------- BMI ----------------
    bmi: function () {
      onSubmit(function () {
        var h = heightInCm(), w = weightInKg(num("weight"));
        if (!Number.isFinite(h) || !Number.isFinite(w)) return showError("enter height and weight");
        if (!validateRange(h, 50, 272, "Height", "cm") || !validateWeight(w)) return;
        var m = h / 100;
        var bmi = w / (m * m);
        var cat, cls;
        if (bmi < 18.5) { cat = "underweight"; cls = "warn"; }
        else if (bmi < 25) { cat = "normal"; cls = "ok"; }
        else if (bmi < 30) { cat = "overweight"; cls = "warn"; }
        else { cat = "obese"; cls = "err"; }
        var lo = 18.5 * m * m, hi = 24.9 * m * m;
        var categoryLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        var marker = Math.max(0, Math.min((bmi / 40) * 100, 100));
        var guidance = {
          underweight: "Your BMI falls below the standard adult healthy range. Consider discussing it with a healthcare professional.",
          normal: "Your BMI falls within the standard adult healthy range.",
          overweight: "Your BMI is above the standard adult healthy range. A healthcare professional can help interpret it in context.",
          obese: "Your BMI is above the standard adult healthy range. Consider discussing the result with a healthcare professional."
        }[cat];
        showResult(
          '<section class="bmi-result-card" aria-labelledby="bmi-result-title">' +
            '<div class="bmi-result-heading"><h2 id="bmi-result-title">Your BMI</h2><span title="BMI is a screening estimate, not a diagnosis." aria-label="BMI is a screening estimate, not a diagnosis."><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg></span></div>' +
            '<div class="bmi-result-value"><strong>' + round(bmi, 1) + '</strong><span>kg/m²</span><span class="result-tag ' + cls + '">' + categoryLabel + '</span></div>' +
            '<div class="bmi-range-chart" role="img" aria-label="BMI ' + round(bmi, 1) + '. Underweight below 18.5, normal 18.5 to 24.9, overweight 25 to 29.9, obese 30 and above.">' +
              '<div class="bmi-range-track"><i class="bmi-range-under"></i><i class="bmi-range-normal"></i><i class="bmi-range-over"></i><i class="bmi-range-obese"></i><span class="bmi-range-marker" style="left:' + marker.toFixed(2) + '%"></span></div>' +
              '<div class="bmi-range-labels"><span>&lt;18.5</span><span>18.5–24.9</span><span>25–29.9</span><span>30+</span></div>' +
            '</div>' +
            '<p class="bmi-guidance">' + guidance + '</p>' +
          '</section>' +
          rows([
            row("healthy weight range", weightText(lo) + " – " + weightText(hi)),
            row("height used", heightText(h))
          ])
        );
      });
    },

    // ---------------- Calories / TDEE ----------------
    calories: function () {
      onSubmit(function () {
        var age = num("age"), h = heightInCm(), w = weightInKg(num("weight"));
        var sex = checkedVal("sex");
        var activity = $("activity") ? parseFloat($("activity").value) : NaN;
        var goal = $("goal") ? $("goal").value : "maintain";
        if (!Number.isFinite(age) || !Number.isFinite(h) || !Number.isFinite(w) || !sex || !activity) return showError("fill in every field");
        if (!validateAdultAge(age) || !validateRange(h, 50, 272, "Height", "cm") || !validateWeight(w)) return;
        var profile = { age: age, height: h, weight: w, sex: sex === "m" ? "male" : "female" };
        var activityName = ({ "1.2": "sedentary", "1.375": "light", "1.55": "moderate", "1.725": "active", "1.9": "very_active" })[String(activity)];
        var bmr = calculateBMR(profile);
        var tdee = calculateTDEE(bmr, activityName);
        var target = calculateCalorieTarget(tdee, goal, profile.sex);
        var goalLabel = "maintain weight";
        if (goal === "lose") goalLabel = units().weight === "lb" ? "lose ~1.1 lb/week" : "lose ~0.5 kg/week";
        if (goal === "gain") goalLabel = units().weight === "lb" ? "gain ~0.6 lb/week" : "gain ~0.25 kg/week";
        showResult(
          headline(Math.round(target), "kcal / day", goalLabel, "ok") +
          rows([
            row("bmr (resting)", Math.round(bmr) + " kcal"),
            row("maintenance tdee", Math.round(tdee) + " kcal"),
            row("goal calories", Math.round(target) + " kcal")
          ]) + useTargetValuesLink({ calories: target })
        );
      });
    },

    // ---------------- Body Fat (US Navy method) ----------------
    bodyfat: function () {
      var sexRadios = document.querySelectorAll('input[name="sex"]');
      var hipField = $("hip-field");
      function syncHip() {
        var sex = checkedVal("sex");
        if (hipField) hipField.style.display = sex === "f" ? "flex" : "none";
      }
      sexRadios.forEach(function (r) { r.addEventListener("change", syncHip); });
      syncHip();

      onSubmit(function () {
        var sex = checkedVal("sex");
        var h = heightInCm(), neck = num("neck"), waist = num("waist"), hip = num("hip");
        if (!sex || !h || !neck || !waist) return showError("fill in every field");
        if (sex === "f" && !hip) return showError("hip measurement is needed for the women's formula");
        if (waist - neck <= 0 || (sex === "f" && waist + hip - neck <= 0)) return showError("waist must be larger than neck");
        if (!validateRange(h, 50, 272, "Height", "cm")) return;
        if (neck < 20 || waist < 40) return showError("check your neck, waist, and hip measurements (cm)");
        var bf;
        if (sex === "m") {
          bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
        } else {
          bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450;
        }
        if (!isFinite(bf) || bf < 2 || bf > 70) return showError("those measurements give an unrealistic result");
        var cat, cls;
        var bands = sex === "m"
          ? [[0, 6, "essential fat"], [6, 14, "athletes"], [14, 18, "fitness"], [18, 25, "average"], [25, 100, "obese"]]
          : [[0, 14, "essential fat"], [14, 21, "athletes"], [21, 25, "fitness"], [25, 32, "average"], [32, 100, "obese"]];
        for (var i = 0; i < bands.length; i++) {
          if (bf >= bands[i][0] && bf < bands[i][1]) { cat = bands[i][2]; break; }
        }
        cls = cat === "obese" ? "err" : (cat === "average" ? "warn" : "ok");
        var leanMass = null;
        var w = weightInKg(num("weight"));
        var extraRows = [row("category", cat)];
        if ($("weight") && $("weight").value.trim() && !validateWeight(w)) return;
        if (w) {
          var fatMass = round(w * bf / 100, 1);
          leanMass = round(w - fatMass, 1);
          extraRows.push(row("fat mass", weightText(fatMass)));
          extraRows.push(row("lean mass", weightText(leanMass)));
        }
        showResult(headline(round(bf, 1), "% body fat", cat, cls) + rows(extraRows));
      });
    },

    // ---------------- Ideal Weight ----------------
    idealweight: function () {
      onSubmit(function () {
        var sex = checkedVal("sex"), h = heightInCm();
        if (!sex || !Number.isFinite(h)) return showError("fill in every field");
        if (!validateRange(h, 50, 272, "Height", "cm")) return;
        if (h < 152.4) return showError("The Devine estimate is not meaningful below 152 cm. Use the healthy BMI range instead.");
        var inches = h / 2.54;
        var over5ft = inches - 60;
        var devine = sex === "m" ? 50 + 2.3 * over5ft : 45.5 + 2.3 * over5ft;
        var m = h / 100;
        var lo = 18.5 * m * m, hi = 24.9 * m * m;
        showResult(
          headline(round(displayWeight(devine), 1), units().weight, "devine estimate", "ok") +
          rows([
            row("healthy bmi range", weightText(lo) + " – " + weightText(hi)),
            row("height used", heightText(h))
          ])
        );
      });
    },

    // ---------------- Water Intake ----------------
    water: function () {
      onSubmit(function () {
        var w = weightInKg(num("weight"));
        var ex = $("exercise") && $("exercise").value ? parseFloat($("exercise").value) : 0;
        var climate = checkedVal("climate") || "temperate";
        if (!Number.isFinite(w)) return showError("enter your weight");
        if (!validateWeight(w)) return;
        var liters = w * 0.033 + (ex / 30) * 0.35;
        if (climate === "hot") liters += 0.5;
        var ml = Math.round(liters * 1000);
        var cups = round(ml / 240, 1);
        showResult(
          headline(round(liters, 1), "L / day", "daily target", "ok") +
          rows([
            row("in millilitres", ml + " ml"),
            row("in cups (240ml)", cups + " cups"),
            row("exercise added", ex > 0 ? round((ex / 30) * 0.35, 2) + " L" : "0 L")
          ])
        );
      });
    },

    // ---------------- BMR ----------------
    bmr: function () {
      onSubmit(function () {
        var sex = checkedVal("sex"), age = num("age"), h = heightInCm(), w = weightInKg(num("weight"));
        if (!sex || !Number.isFinite(age) || !Number.isFinite(h) || !Number.isFinite(w)) return showError("fill in every field");
        if (!validateAdultAge(age) || !validateRange(h, 50, 272, "Height", "cm") || !validateWeight(w)) return;
        var bmr = calculateBMR({ sex: sex === "m" ? "male" : "female", age: age, height: h, weight: w });
        showResult(
          headline(Math.round(bmr), "kcal / day", "at complete rest", "ok") +
          rows([
            row("per week", Math.round(bmr * 7) + " kcal"),
            row("formula", "mifflin-st jeor")
          ])
        );
      });
    },

    // ---------------- Max Heart Rate ----------------
    maxhr: function () {
      onSubmit(function () {
        var age = num("age");
        if (!Number.isFinite(age)) return showError("enter your age");
        // Tanaka's max-heart-rate estimate is used here for ages 1–120; unlike Mifflin-St Jeor it is not restricted to adults.
        if (!validateRange(age, 1, 120, "Age", "years")) return;
        var mhr = Math.round(208 - 0.7 * age);
        var classic = 220 - age;
        var zones = [
          ["warm up", 0.5, 0.6],
          ["fat burn", 0.6, 0.7],
          ["aerobic", 0.7, 0.8],
          ["anaerobic", 0.8, 0.9],
          ["max effort", 0.9, 1.0]
        ];
        var zoneRows = zones.map(function (z) {
          return row(z[0], Math.round(mhr * z[1]) + " – " + Math.round(mhr * z[2]) + " bpm");
        });
        showResult(
          headline(mhr, "bpm max", "tanaka formula", "ok") +
          rows(zoneRows.concat([row("classic 220-age", classic + " bpm")]))
        );
      });
    },

    // ---------------- Protein Intake ----------------
    protein: function () {
      onSubmit(function () {
        var w = weightInKg(num("weight"));
        var goal = $("goal") ? $("goal").value : "active";
        if (!Number.isFinite(w)) return showError("enter your weight");
        if (!validateWeight(w)) return;
        var ranges = { sedentary: [0.8, 1.0], active: [1.2, 1.6], muscle: [1.6, 2.2] };
        var r = ranges[goal] || ranges.active;
        var lo = round(w * r[0]), hi = round(w * r[1]);
        var mid = round((lo + hi) / 2);
        showResult(
          headline(mid, "g / day", "suggested target", "ok") +
          rows([
            row("range", lo + " – " + hi + " g"),
            row("per meal (÷4)", round(mid / 4) + " g")
          ]) + useTargetValuesLink({ protein: mid })
        );
      });
    },

    // ---------------- Steps to Calories ----------------
    steptocalories: function () {
      onSubmit(function () {
        var steps = num("steps"), w = weightInKg(num("weight"));
        if (!Number.isFinite(steps) || !Number.isFinite(w) || steps <= 0) return showError("enter steps and weight");
        if (!validateWeight(w)) return;
        var calories = steps * w * 0.0005;
        var km = round(steps * 0.000762, 2);
        var usesMiles = units().height === "ft-in";
        showResult(
          headline(Math.round(calories), "kcal burned", "estimate", "ok") +
          rows([
            row("distance", round(usesMiles ? km * 0.621371 : km, 2) + (usesMiles ? " mi" : " km")),
            row("steps", Math.round(steps).toLocaleString())
          ])
        );
      });
    },

    // ---------------- Exercise Calories ----------------
    exercisecalories: function () {
      onSubmit(function () {
        var met = $("activity") ? parseFloat($("activity").value) : NaN;
        var w = weightInKg(num("weight")), mins = num("duration");
        if (!met || !Number.isFinite(w) || !Number.isFinite(mins) || mins <= 0) return showError("fill in every field");
        if (!validateWeight(w)) return;
        var calories = met * w * (mins / 60);
        showResult(
          headline(Math.round(calories), "kcal burned", "estimate", "ok") +
          rows([
            row("met value used", met),
            row("duration", mins + " min"),
            row("rate", round(calories / mins, 1) + " kcal/min")
          ])
        );
      });
    },

    // ---------------- Macro Calculator ----------------
    macro: function () {
      onSubmit(function () {
        var cal = num("calories");
        var goal = $("goal") ? $("goal").value : "balanced";
        if (!cal || cal <= 0) return showError("enter a daily calorie target");
        var splits = {
          balanced: [0.4, 0.3, 0.3],
          highprotein: [0.4, 0.4, 0.2],
          lowcarb: [0.25, 0.45, 0.3],
          keto: [0.05, 0.25, 0.7]
        };
        var s = splits[goal] || splits.balanced;
        // split arrays are [carbs, protein, fat]
        var carbCal = cal * s[0], proteinCal = cal * s[1], fatCal = cal * s[2];
        var proteinG = Math.round(proteinCal / 4), carbG = Math.round(carbCal / 4), fatG = Math.round(fatCal / 9);
        showResult(
          headline(Math.round(cal), "kcal / day", ({ balanced: "balanced", highprotein: "high protein", lowcarb: "low carb", keto: "keto" })[goal] || goal, "ok") +
          '<div class="result-rows">' +
            bar(s[1] * 100, "var(--feature-protein)", "protein", proteinG + " g") +
            bar(s[0] * 100, "var(--feature-carbs)", "carbs", carbG + " g") +
            bar(s[2] * 100, "var(--feature-fat)", "fat", fatG + " g") +
          "</div>" + useTargetValuesLink({ calories: cal, protein: proteinG, carbs: carbG, fat: fatG })
        );
      });
    },

    // ---------------- Sleep Calculator ----------------
    sleep: function () {
      onSubmit(function () {
        var mode = $("mode") ? $("mode").value : "wake";
        var timeVal = $("time") ? $("time").value : null;
        if (!timeVal) return showError("pick a time");
        var parts = timeVal.split(":");
        var base = new Date();
        base.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);

        var cycles = [6, 5, 4, 3];
        var items = cycles.map(function (c) {
                    var d = new Date(base.getTime() + (mode === "wake" ? -1 : 1) * (c * 90) * 60000);
          // apply 15 min fall-asleep buffer only for the "when to go to bed" direction
          d.setMinutes(d.getMinutes() + (mode === "wake" ? -15 : 15));
          var hh = d.getHours(), mm = d.getMinutes();
          var label = (hh % 12 === 0 ? 12 : hh % 12) + ":" + (mm < 10 ? "0" + mm : mm) + (hh >= 12 ? " pm" : " am");
          var hours = round(c * 1.5, 1);
          return row(c + " cycles (" + hours + "h sleep)", label);
        });
        showResult(
          '<div class="result-tag ok" style="margin-bottom:6px;display:inline-block">' +
            (mode === "wake" ? "go to bed at…" : "from that bedtime, wake up at…") +
          "</div>" +
          '<div class="sleep-list">' + items.join("") + "</div>" +
          '<p class="result-note" style="margin-top:10px">includes a 15-minute buffer to fall asleep. one sleep cycle ≈ 90 minutes.</p>'
        );
      });
    },

    // ---------------- Workout Rest Timer ----------------
    resttimer: function () {
      var ring = document.querySelector(".timer-ring .fg");
      var readout = $("timer-readout");
      var startBtn = $("timer-start");
      var resetBtn = $("timer-reset");
      var presetBtns = document.querySelectorAll("[data-preset]");
      if (!ring || !readout || !startBtn || !resetBtn) return;

      var radius = ring.r.baseVal.value;
      var circumference = 2 * Math.PI * radius;
      ring.style.strokeDasharray = circumference.toFixed(1);

      var total = 60, remaining = 60, timerId = null, deadline = null, running = false;

      function render() {
        var mm = Math.floor(remaining / 60), ss = remaining % 60;
        readout.innerHTML = "<strong>" + mm + ":" + (ss < 10 ? "0" + ss : ss) + "</strong>rest";
        var offset = circumference * (1 - remaining / total);
        ring.style.strokeDashoffset = offset.toFixed(1);
      }

      function beep() {
        try {
          var ctx = new (window.AudioContext || window.webkitAudioContext)();
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.start(); osc.stop(ctx.currentTime + 0.5);
        } catch (e) { /* audio not available, ignore */ }
      }

      function tick() {
        if (!running || deadline === null) return;
        remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        render();
        if (remaining <= 0) {
          stop();
          beep();
          return;
        }
      }
      function start() {
        if (running) return;
        if (remaining <= 0) remaining = total;
        running = true;
        deadline = Date.now() + remaining * 1000;
        startBtn.textContent = "pause";
        tick();
        if (running) timerId = setInterval(tick, 250);
      }
      function stop() {
        running = false;
        startBtn.textContent = "start";
        if (timerId !== null) clearInterval(timerId);
        timerId = null;
        deadline = null;
      }
      function pause() {
        if (!running) return;
        remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        stop();
        render();
      }
      function reset() {
        stop(); remaining = total; render();
      }

      startBtn.addEventListener("click", function () { running ? pause() : start(); });
      resetBtn.addEventListener("click", reset);
      presetBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          total = parseInt(btn.dataset.preset, 10);
          remaining = total;
          stop();
          render();
        });
      });

      render();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    syncCalculatorUnits();
    var slug = document.body.getAttribute("data-calc");
    if (slug && calculators[slug]) calculators[slug]();
  });
  if (typeof window.addEventListener === "function") {
    var preferencesKey = typeof PREFERENCES_KEY === "undefined" ? "fitcalc_preferences" : PREFERENCES_KEY;
    window.addEventListener("fitcalc:data-change", function (event) {
      if (!event.detail || !event.detail.key || event.detail.key === preferencesKey) syncCalculatorUnits();
    });
    window.addEventListener("storage", function (event) {
      if (typeof fitcalcStorageKey === "function" && event.key === fitcalcStorageKey(preferencesKey)) syncCalculatorUnits();
    });
  }
})();
