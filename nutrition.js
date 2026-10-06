const foodDatabase = [
    // per 100 g, approximate (USDA-style values)
    { name: "chicken breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    { name: "white rice", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
    { name: "brown rice", calories: 112, protein: 2.3, carbs: 24, fat: 0.8, fiber: 1.8 },
    { name: "banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
    { name: "apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
    { name: "orange", calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4 },
    { name: "egg", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 },
    { name: "oats", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, fiber: 10.6 },
    { name: "salmon", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
    { name: "tuna", calories: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0 },
    { name: "lean beef", calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0 },
    { name: "tofu", calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3 },
    { name: "milk", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0 },
    { name: "greek yogurt", calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0 },
    { name: "cottage cheese", calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0 },
    { name: "cheddar cheese", calories: 403, protein: 25, carbs: 1.3, fat: 33, fiber: 0 },
    { name: "lentils", calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9 },
    { name: "chickpeas", calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6 },
    { name: "potato", calories: 87, protein: 1.9, carbs: 20, fat: 0.1, fiber: 1.8 },
    { name: "sweet potato", calories: 90, protein: 2, carbs: 21, fat: 0.2, fiber: 3.3 },
    { name: "broccoli", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6 },
    { name: "spinach", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 },
    { name: "avocado", calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7 },
    { name: "almonds", calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 },
    { name: "peanut butter", calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6 },
    { name: "olive oil", calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
    { name: "whole wheat bread", calories: 252, protein: 12.3, carbs: 43, fat: 3.5, fiber: 6 },
    { name: "pasta", calories: 158, protein: 5.8, carbs: 31, fat: 0.9, fiber: 1.8 }
];



/*
 * DATE
 */

function getInitialNutritionDate() {
    try {
        const search = String(window.location.search || "");
        const match = search.match(/[?&]date=(\d{4}-\d{2}-\d{2})(?:&|$)/);
        const value = match && match[1];
        if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
            const date = new Date(value + "T00:00:00");
            if (!Number.isNaN(date.getTime()) && getDateKey(date) === value && value <= getDateKey(new Date())) return date;
        }
    } catch (error) { /* The page may be running in a test sandbox without a URL. */ }
    return new Date();
}

let selectedNutritionDate = getInitialNutritionDate();
let currentNutritionTodayKey = getDateKey(new Date());
let editingFoodIndex = -1;
let editingFoodDateKey = null;
let editingFoodSnapshot = null;
let previousWaterChange = null;

function getNutritionDateKey(date) {
    if (!date) refreshNutritionTodayIfNeeded();
    return getDateKey(date || selectedNutritionDate);
}

function getNutritionTargets() { return getTargets(); }


/*
 * GET TODAY'S NUTRITION
 */

function getNutrition() {

    const nutrition = Object.assign(
        emptyNutritionDay(),
        getNutritionFor(getNutritionDateKey())
    );


    nutrition.calories =
        Number(nutrition.calories) || 0;

    nutrition.protein =
        Number(nutrition.protein) || 0;

    nutrition.carbs =
        Number(nutrition.carbs) || 0;

    nutrition.fat =
        Number(nutrition.fat) || 0;

    nutrition.fiber =
        Number(nutrition.fiber) || 0;

    nutrition.water =
        Number(nutrition.water) || 0;


    if (!Array.isArray(nutrition.foods)) {

        nutrition.foods = [];

    }


    return nutrition;
}


/*
 * SAVE NUTRITION
 */

function saveNutrition(nutrition) {
    try {
        const saveDateKey = getNutritionDateKey();
        saveNutritionFor(saveDateKey, nutrition);
        return true;
    } catch (error) {
        return false;
    }
}

function updateNutritionDateDisplay() {
    const label = document.getElementById("nutrition-day-label");
    const date = document.getElementById("nutrition-date");
    if (!label || !date) return;
    const today = new Date();
    const key = getNutritionDateKey(selectedNutritionDate);
    label.textContent = key === getDateKey(today) ? "Today" : selectedNutritionDate.toLocaleDateString(undefined, { weekday: "long" });
    date.textContent = selectedNutritionDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const next = document.getElementById("nutrition-next-day");
    if (next) next.disabled = key === getDateKey(today);
}

function refreshNutritionTodayIfNeeded() {
    const now = new Date();
    const todayKey = getDateKey(now);
    if (todayKey === currentNutritionTodayKey) return false;

    const previousTodayKey = currentNutritionTodayKey;
    currentNutritionTodayKey = todayKey;
    if (getDateKey(selectedNutritionDate) === previousTodayKey) {
        selectedNutritionDate = now;
        refreshNutritionDay();
    } else {
        updateNutritionDateDisplay();
    }
    return true;
}

function shiftNutritionDate(offset) {
    refreshNutritionTodayIfNeeded();
    const today = new Date();
    const next = new Date(selectedNutritionDate);
    next.setDate(next.getDate() + offset);
    if (getDateKey(next) > getDateKey(today)) return;
    cancelFoodEdit();
    selectedNutritionDate = next;
    updateNutritionDateDisplay();
    updateNutritionDisplay();
    updateFoodList();
    renderFoodShortcuts();
    updateWaterDisplay();
}

document.getElementById("nutrition-previous-day")?.addEventListener("click", function () { shiftNutritionDate(-1); });
document.getElementById("nutrition-next-day")?.addEventListener("click", function () { shiftNutritionDate(1); });


/*
 * FIND FOOD
 */

function findFood(name) {

    const searchName =
        String(name)
            .toLowerCase()
            .trim();


    if (!searchName) {

        return null;

    }


    const availableFoods = foodDatabase.concat(getFoodLibrary().customFoods);
    const exactMatch = availableFoods.find(function (food) {
        return String(food.name).toLowerCase().trim() === searchName;
    });
    if (exactMatch) return exactMatch;

    const escapedName = searchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholeWordMatch = new RegExp("\\b" + escapedName + "\\b", "i");
    return availableFoods.find(function (food) {
        return wholeWordMatch.test(String(food.name));
    }) || null;
}

function normalizeFoodName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function foodDefinitionFromEntry(food) {
    const amount = Number(food && food.amount);
    const divisor = amount > 0 ? amount / 100 : 1;
    return {
        name: String(food && food.name || "").trim(),
        calories: (Number(food && food.calories) || 0) / divisor,
        protein: (Number(food && food.protein) || 0) / divisor,
        carbs: (Number(food && food.carbs) || 0) / divisor,
        fat: (Number(food && food.fat) || 0) / divisor,
        fiber: (Number(food && food.fiber) || 0) / divisor,
        servingGrams: Number(food && food.servingGrams) > 0 ? Number(food.servingGrams) : 100,
        source: food && food.source || "FitCalc local list",
        barcode: food && food.barcode || ""
    };
}

function saveCustomFood(food) {
    const name = String(food && food.name || "").trim().replace(/\s+/g, " ");
    if (!name) return false;
    const values = ["calories", "protein", "carbs", "fat", "fiber"].reduce(function (result, key) {
        result[key] = Number(food[key]);
        return result;
    }, {});
    if (Object.keys(values).some(function (key) {
        const maximum = key === "calories" ? 1000 : 100;
        return !Number.isFinite(values[key]) || values[key] < 0 || values[key] > maximum;
    })) return false;
    const servingGrams = Number(food.servingGrams || 100);
    if (!Number.isFinite(servingGrams) || servingGrams <= 0 || servingGrams > 5000) return false;

    const library = getFoodLibrary();
    const builtIn = foodDatabase.some(function (item) { return normalizeFoodName(item.name) === normalizeFoodName(name); });
    if (builtIn) return false;
    const existing = library.customFoods.findIndex(function (item) { return normalizeFoodName(item.name) === normalizeFoodName(name); });
    const definition = Object.assign({ name: name, servingGrams: servingGrams, source: "Custom food" }, values);
    if (existing >= 0) library.customFoods[existing] = definition;
    else library.customFoods.unshift(definition);
    ["favorites", "recents"].forEach(function (key) {
        library[key] = library[key].map(function (item) {
            return normalizeFoodName(item.name) === normalizeFoodName(name)
                ? Object.assign({}, definition)
                : item;
        });
    });
    try { saveFoodLibrary(library); } catch (error) { return false; }
    return true;
}

function isFoodFavorite(food) {
    const name = normalizeFoodName(food && food.name);
    return getFoodLibrary().favorites.some(function (item) { return normalizeFoodName(item.name) === name; });
}

function toggleFoodFavorite(food) {
    if (!food || !food.name) return false;
    const library = getFoodLibrary();
    const name = normalizeFoodName(food.name);
    const index = library.favorites.findIndex(function (item) { return normalizeFoodName(item.name) === name; });
    if (index >= 0) library.favorites.splice(index, 1);
    else library.favorites.unshift(foodDefinitionFromEntry(food));
    try { saveFoodLibrary(library); } catch (error) { return false; }
    renderFoodShortcuts();
    updateFoodList();
    return index < 0;
}

function rememberFood(food) {
    const library = getFoodLibrary();
    const definition = foodDefinitionFromEntry(food);
    const name = normalizeFoodName(definition.name);
    library.recents = [definition].concat(library.recents.filter(function (item) {
        return normalizeFoodName(item.name) !== name;
    })).slice(0, 8);
    try { saveFoodLibrary(library); } catch (error) { /* Logging remains saved even if recents cannot be updated. */ }
    renderFoodShortcuts();
}


/*
 * REMAINING
 */

function getRemaining(target, current) {

    const targetValue =
        Number(target) || 0;

    const currentValue =
        Number(current) || 0;


    return Math.max(
        targetValue - currentValue,
        0
    );
}


/*
 * PROGRESS PERCENTAGE
 */

function getNutritionPercentage(
    current,
    target
) {

    const currentValue =
        Number(current) || 0;

    const targetValue =
        Number(target) || 0;


    if (targetValue <= 0) {

        return 0;

    }


    return Math.min(
        (currentValue / targetValue) * 100,
        100
    );
}


/*
 * PROGRESS BAR
 */

function updateNutritionProgressBar(
    id,
    current,
    target
) {

    const element =
        document.getElementById(id);


    if (!element) {

        return;

    }


    const percentage =
        getNutritionPercentage(
            current,
            target
        );


    element.style.width =
        percentage + "%";
    const meter = element.closest('[role="progressbar"]');
    if (meter) meter.setAttribute("aria-valuenow", String(Math.round(percentage)));


    const percentageIdMap = {

        "calorie-progress":
            "total-calories-progress",

        "protein-progress":
            "total-protein-progress",

        "carbs-progress":
            "total-carbs-progress",

        "fat-progress":
            "total-fat-progress",

        "fiber-progress":
            "total-fiber-progress"

    };


    const percentageElement =
        document.getElementById(
            percentageIdMap[id]
        );


    if (percentageElement) {

        percentageElement.textContent =
            `${Math.round(percentage)}%`;

    }
}


/*
 * NUTRITION DISPLAY
 */

function updateNutritionDisplay() {

    const nutrition =
        getNutrition();

    const targets =
        getNutritionTargets();

    const targetNotice = document.getElementById("nutrition-profile-notice");
    if (targetNotice) targetNotice.hidden = Number(targets.calories) > 0;


    const values = [

        {
            total: "total-calories",
            progress: "calorie-progress",
            current: nutrition.calories,
            target: targets.calories
        },

        {
            total: "total-protein",
            progress: "protein-progress",
            current: nutrition.protein,
            target: targets.protein
        },

        {
            total: "total-carbs",
            progress: "carbs-progress",
            current: nutrition.carbs,
            target: targets.carbs
        },

        {
            total: "total-fat",
            progress: "fat-progress",
            current: nutrition.fat,
            target: targets.fat
        },

        {
            total: "total-fiber",
            progress: "fiber-progress",
            current: nutrition.fiber,
            target: targets.fiber
        }

    ];


    values.forEach(
        function (item) {

            const total =
                document.getElementById(
                    item.total
                );


            const target =
                Number(item.target) || 0;


            if (total) {

                total.textContent =
                    `${Math.round(item.current)} / ${Math.round(target)}`;

            }


            updateNutritionProgressBar(
                item.progress,
                item.current,
                target
            );

        }
    );


    updateNutritionRemaining(
        nutrition,
        targets
    );


    updateWaterDisplay(
        nutrition
    );
}


/*
 * REMAINING DISPLAY
 */

function updateNutritionRemaining(
    nutrition,
    targets
) {

    const remaining = [

        {
            id: "remaining-calories",
            value: getRemaining(
                targets.calories,
                nutrition.calories
            ),
            unit: "kcal"
        },

        {
            id: "remaining-protein",
            value: getRemaining(
                targets.protein,
                nutrition.protein
            ),
            unit: "g"
        },

        {
            id: "remaining-carbs",
            value: getRemaining(
                targets.carbs,
                nutrition.carbs
            ),
            unit: "g"
        },

        {
            id: "remaining-fat",
            value: getRemaining(
                targets.fat,
                nutrition.fat
            ),
            unit: "g"
        },

        {
            id: "remaining-fiber",
            value: getRemaining(
                targets.fiber,
                nutrition.fiber
            ),
            unit: "g"
        }

    ];


    remaining.forEach(
        function (item) {

            const element =
                document.getElementById(
                    item.id
                );


            if (element) {

                element.textContent =
                    `${Math.round(item.value)} ${item.unit}`;

            }

        }
    );
}


/*
 * FOOD LIST
 */

function updateFoodList() {

    const nutrition =
        getNutrition();


    const foodList =
        document.getElementById(
            "food-list"
        );


    if (!foodList) {

        return;

    }


    foodList.innerHTML = "";


    if (nutrition.foods.length === 0) {

        foodList.innerHTML =
            '<p class="empty-state"><strong>No food logged yet</strong><span>Add an item to see it here.</span></p>';

        return;

    }


    const orderedFoods = nutrition.foods.map(function (food, index) {
        return { food: food, index: index };
    }).sort(function (a, b) {
        const order = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };
        const mealA = a.food.meal || "Snack";
        const mealB = b.food.meal || "Snack";
        return (Object.prototype.hasOwnProperty.call(order, mealA) ? order[mealA] : 4) -
            (Object.prototype.hasOwnProperty.call(order, mealB) ? order[mealB] : 4) || a.index - b.index;
    });
    let lastMeal = "";

    orderedFoods.forEach(
        function (item) {

            const food = item.food;
            const index = item.index;
            const meal = food.meal || "Snack";
            if (meal !== lastMeal) {
                const heading = document.createElement("h3");
                heading.className = "food-meal-heading";
                heading.textContent = meal;
                foodList.appendChild(heading);
                lastMeal = meal;
            }

            const entry =
                document.createElement("div");


            entry.className =
                "nutrition-food-entry";


            entry.innerHTML = `

                <div class="nutrition-food-info">

                    <h3>
                        ${escapeHTML(food.name)}
                    </h3>

                    <p>${escapeHTML(food.servingCount ? food.servingCount + " × " + (food.servingGrams || 100) + " g serving" : food.amount + " g")}</p>

                    <p>${escapeHTML(food.meal || "Snack")}</p>

                    <p>
                        ${Math.round(food.calories)} kcal ·
                        ${Math.round(food.protein)}g protein ·
                        ${Math.round(food.carbs)}g carbs ·
                        ${Math.round(food.fat)}g fat
                    </p>

                </div>

                <div class="nutrition-food-actions">
                <button
                    type="button"
                    class="secondary-btn favorite-food"
                    data-index="${index}"
                    aria-pressed="${isFoodFavorite(food)}"
                    aria-label="${isFoodFavorite(food) ? "Remove from" : "Add to"} favorite foods"
                >${isFoodFavorite(food) ? "★ Saved" : "☆ Favorite"}</button>
                <button
                    type="button"
                    class="secondary-btn edit-food"
                    data-index="${index}"
                >
                    Edit
                </button>
                <button
                    type="button"
                    class="primary-btn remove-food"
                    data-index="${index}"
                >
                    Remove
                </button>
                </div>

            `;


            foodList.appendChild(entry);


            const removeButton =
                entry.querySelector(
                    ".remove-food"
                );


            removeButton.addEventListener(
                "click",
                function () {

                    removeFood(index);

                }
            );

            entry.querySelector(".edit-food").addEventListener("click", function () {
                editFood(index);
            });
            entry.querySelector(".favorite-food").addEventListener("click", function () {
                const added = toggleFoodFavorite(food);
                window.fitcalcToast(added ? "Food added to favorites." : "Food removed from favorites.");
            });

        }
    );
}

function renderFoodShortcuts() {
    const root = document.getElementById("food-shortcuts");
    if (!root) return;
    if (typeof root.replaceChildren === "function") root.replaceChildren();
    else { root.innerHTML = ""; root.children = []; }
    const library = getFoodLibrary();
    const sections = [
        { title: "Saved custom foods", items: library.customFoods.slice(0, 6) },
        { title: "Favorites", items: library.favorites.slice(0, 6) },
        { title: "Recent", items: library.recents.slice(0, 6) }
    ].filter(function (section) { return section.items.length > 0; });
    if (!sections.length) {
        const note = document.createElement("small");
        note.className = "muted-copy";
        note.textContent = "Favorite foods and your recent entries will appear here for quick logging.";
        root.appendChild(note);
        return;
    }
    sections.forEach(function (section) {
        const group = document.createElement("div");
        group.className = "food-shortcut-group";
        const heading = document.createElement("strong");
        heading.textContent = section.title;
        const list = document.createElement("div");
        list.className = "food-shortcut-list";
        section.items.forEach(function (food) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "secondary-btn food-shortcut";
            button.textContent = food.name + " · 1 serving";
            button.addEventListener("click", function () {
                const meal = document.getElementById("food-meal");
                addFoodToSelectedDay(food, Number(food.servingGrams) > 0 ? Number(food.servingGrams) : 100, meal ? meal.value : "Snack", "grams");
            });
            list.appendChild(button);
        });
        if (typeof group.append === "function") group.append(heading, list);
        else { group.appendChild(heading); group.appendChild(list); }
        root.appendChild(group);
    });
}


/*
 * REMOVE FOOD
 */

function removeFood(index) {

    const nutrition =
        getNutrition();


    const removedFood =
        nutrition.foods[index];


    if (!removedFood) {

        return;

    }

    nutrition.foods.splice(
        index,
        1
    );

    recalculateNutritionTotals(nutrition);


    if (!saveNutrition(
        nutrition
    )) return;

    if (editingFoodIndex === index) cancelFoodEdit();
    else if (editingFoodIndex > index) editingFoodIndex -= 1;


    updateNutritionDisplay();

    updateFoodList();

}

function editFood(index) {
    const food = getNutrition().foods[index];
    if (!food || !(Number(food.amount) > 0)) return;
    editingFoodIndex = index;
    editingFoodDateKey = getNutritionDateKey();
    editingFoodSnapshot = JSON.stringify(food);
    document.getElementById("food-name").value = food.name;
    const amountUnit = document.getElementById("food-amount-unit");
    const usesServings = Number(food.servingCount) > 0;
    if (amountUnit) amountUnit.value = usesServings ? "servings" : "grams";
    document.getElementById("food-amount").value = usesServings ? food.servingCount : food.amount;
    document.getElementById("food-meal").value = food.meal || "Snack";
    const per100 = function (key) { return (Number(food[key]) || 0) * 100 / Number(food.amount); };
    window.fitcalcPendingFood = { name: food.name, calories: per100("calories"), protein: per100("protein"), carbs: per100("carbs"), fat: per100("fat"), fiber: per100("fiber"), servingGrams: food.servingGrams, source: food.source, barcode: food.barcode };
    const button = document.getElementById("add-food");
    if (button) button.textContent = "Save changes";
    const cancel = document.getElementById("cancel-food-edit");
    if (cancel) cancel.hidden = false;
    document.getElementById("food-name").focus();
}

function updateFoodAmountLabel() {
    const unit = document.getElementById("food-amount-unit");
    const label = document.getElementById("food-amount-label");
    const input = document.getElementById("food-amount");
    const servings = unit && unit.value === "servings";
    if (label) label.textContent = servings ? "Number of servings" : "Amount in grams";
    if (input) {
        input.step = servings ? "0.25" : "1";
        input.placeholder = servings ? "1" : "100";
    }
}

document.getElementById("food-amount-unit")?.addEventListener("change", updateFoodAmountLabel);

function cancelFoodEdit() {
    editingFoodIndex = -1;
    editingFoodDateKey = null;
    editingFoodSnapshot = null;
    window.fitcalcPendingFood = null;
    const button = document.getElementById("add-food");
    if (button) button.textContent = "Add to log";
    const cancel = document.getElementById("cancel-food-edit");
    if (cancel) cancel.hidden = true;
    const name = document.getElementById("food-name");
    const amount = document.getElementById("food-amount");
    if (name) name.value = "";
    if (amount) amount.value = "";
}

const cancelFoodEditButton = document.getElementById("cancel-food-edit");
if (cancelFoodEditButton) cancelFoodEditButton.addEventListener("click", cancelFoodEdit);

function calculateLoggedFood(foodData, amount, meal, amountUnit) {
    const enteredAmount = Number(amount);
    const servingGrams = Number(foodData.servingGrams) > 0 ? Number(foodData.servingGrams) : 100;
    const usesServings = amountUnit === "servings";
    const actualGrams = usesServings ? enteredAmount * servingGrams : enteredAmount;
    const factor = actualGrams / 100;
    return {
        name: String(foodData.name), amount: actualGrams, meal: meal || "Snack",
        servingCount: usesServings ? enteredAmount : null,
        servingGrams: servingGrams,
        calories: (Number(foodData.calories) || 0) * factor,
        protein: (Number(foodData.protein) || 0) * factor,
        carbs: (Number(foodData.carbs) || 0) * factor,
        fat: (Number(foodData.fat) || 0) * factor,
        fiber: (Number(foodData.fiber) || 0) * factor,
        source: foodData.source || "FitCalc local list",
        barcode: foodData.barcode || ""
    };
}

function addFoodToSelectedDay(foodData, amount, meal, amountUnit) {
    const food = calculateLoggedFood(foodData, amount, meal, amountUnit);
    const nutrition = getNutrition();
    nutrition.foods.push(food);
    recalculateNutritionTotals(nutrition);
    if (!saveNutrition(nutrition)) return false;
    rememberFood(food);
    updateNutritionDisplay();
    updateFoodList();
    window.fitcalcToast("Food added to your log.");
    return true;
}

function recalculateNutritionTotals(nutrition) {
    ["calories", "protein", "carbs", "fat", "fiber"].forEach(function (key) {
        nutrition[key] = (nutrition.foods || []).reduce(function (sum, food) { return sum + (Number(food[key]) || 0); }, 0);
    });
}


/*
 * ADD FOOD
 */

const addFoodButton =
    document.getElementById(
        "add-food"
    );


if (addFoodButton) {

    addFoodButton.addEventListener(
        "click",
        function () {

            const foodName =
                document.getElementById(
                    "food-name"
                ).value;


            const foodAmount =
                Number(
                    document.getElementById(
                        "food-amount"
                    ).value
                );


            if (!foodName.trim()) {

                window.fitcalcToast("Enter a food name.", "error");

                return;

            }


            if (
                !Number.isFinite(foodAmount) ||
                foodAmount <= 0
            ) {

                window.fitcalcToast("Enter an amount greater than zero.", "error");

                return;

            }


            const pending = window.fitcalcPendingFood;
            const foodData = pending && pending.name.toLowerCase() === foodName.trim().toLowerCase()
                ? pending
                : findFood(foodName);


            if (!foodData) {

                window.fitcalcToast("That food is not in the local list. Search the food database or choose a listed item.", "error");

                return;

            }


            const amountUnit = document.getElementById("food-amount-unit")?.value || "grams";
            const food = calculateLoggedFood(foodData, foodAmount, document.getElementById("food-meal").value, amountUnit);
            if (food.amount > 10000) {
                window.fitcalcToast("Food amount cannot exceed 10,000 g.", "error");
                return;
            }


            const nutrition =
                getNutrition();


            const wasEditing = editingFoodIndex >= 0;
            if (wasEditing && nutrition.foods[editingFoodIndex]) {
                nutrition.foods[editingFoodIndex] = food;
            } else {
                nutrition.foods.push(food);
            }
            recalculateNutritionTotals(nutrition);


            if (!saveNutrition(
                nutrition
            )) return;

            rememberFood(food);


            document.getElementById(
                "food-name"
            ).value = "";


            document.getElementById(
                "food-amount"
            ).value = "";

            cancelFoodEdit();


            updateNutritionDisplay();

            updateFoodList();
            window.fitcalcToast(wasEditing ? "Food entry updated." : "Food added to your log.");

        }
    );

}

const customFoodForm = document.getElementById("custom-food-form");
if (customFoodForm) {
    customFoodForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const food = {
            name: document.getElementById("custom-food-name").value,
            calories: document.getElementById("custom-food-calories").value,
            protein: document.getElementById("custom-food-protein").value,
            carbs: document.getElementById("custom-food-carbs").value,
            fat: document.getElementById("custom-food-fat").value,
            fiber: document.getElementById("custom-food-fiber").value,
            servingGrams: document.getElementById("custom-food-serving").value
        };
        if (!saveCustomFood(food)) {
            window.fitcalcToast("Check the food name and nutrition values. Names from the built-in list cannot be replaced.", "error");
            return;
        }
        customFoodForm.reset();
        renderFoodShortcuts();
        window.fitcalcToast("Custom food saved per 100 g.");
    });
}

function copyPreviousDayNutrition() {
    const previousDate = new Date(selectedNutritionDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousKey = getNutritionDateKey(previousDate);
    const source = getNutritionFor(previousKey);
    if (!source.foods.length && !(Number(source.water) > 0)) {
        window.fitcalcToast("There is no food or water logged on the previous day.", "error");
        return false;
    }
    const current = getNutrition();
    if ((current.foods.length || current.water > 0) && typeof window.confirm === "function" &&
        !window.confirm("Replace this day's food and water with the previous day's entries?")) return false;
    current.foods = source.foods.map(function (food) { return Object.assign({}, food); });
    current.water = Number(source.water) || 0;
    recalculateNutritionTotals(current);
    if (!saveNutrition(current)) return false;
    updateNutritionDisplay();
    updateFoodList();
    window.fitcalcToast("Previous day's nutrition copied.");
    return true;
}

document.getElementById("copy-previous-day")?.addEventListener("click", copyPreviousDayNutrition);


/*
 * WATER
 */

function updateWaterDisplay(
    nutrition
) {

    if (!nutrition) {

        nutrition =
            getNutrition();

    }


    const water =
        Number(nutrition.water) || 0;


    const waterEl =
        document.getElementById(
            "planner-water"
        );


    if (waterEl) {

        waterEl.textContent =
            water.toFixed(2);

    }

    const dateKey = getNutritionDateKey();
    const targetLiters = getWaterGoalLiters(getProfile(), getPlannerFor(dateKey));
    const waterGoal = document.getElementById("nutrition-water-goal");
    if (waterGoal) waterGoal.textContent = targetLiters ? targetLiters.toFixed(2) : "—";

    const waterProgressEl =
        document.getElementById(
            "water-progress"
        );


    if (waterProgressEl) {

        const percentage = targetLiters
            ? Math.min((water / targetLiters) * 100, 100)
            : 0;


        waterProgressEl.style.width =
            percentage + "%";
        const meter = waterProgressEl.closest('[role="progressbar"]');
        if (meter) meter.setAttribute("aria-valuenow", String(Math.round(percentage)));

    }

}


/* Add custom amounts while keeping the quick 250 ml action. */

function setWaterAmount(nextWater) {
    const nutrition = getNutrition();
    const currentWater = Number(nutrition.water) || 0;
    const amount = Number(nextWater);
    if (!Number.isFinite(amount) || amount < 0) return false;
    nutrition.water = Math.round(amount * 1000) / 1000;
    if (!saveNutrition(nutrition)) return false;
    previousWaterChange = {
        date: getNutritionDateKey(),
        before: currentWater,
        after: nutrition.water
    };
    updateNutritionDisplay();
    return true;
}

function addWaterAmount(liters) {
    const amount = Number(liters);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10) return false;
    const nutrition = getNutrition();
    return setWaterAmount((Number(nutrition.water) || 0) + amount);
}

function undoWaterChange() {
    if (!previousWaterChange || previousWaterChange.date !== getNutritionDateKey()) {
        window.fitcalcToast("There is no recent water change to undo.", "error");
        return false;
    }
    const nutrition = getNutrition();
    if (Math.abs((Number(nutrition.water) || 0) - previousWaterChange.after) > 0.001) {
        previousWaterChange = null;
        window.fitcalcToast("Water changed since that action, so it cannot be undone safely.", "error");
        return false;
    }
    const previous = previousWaterChange;
    previousWaterChange = null;
    const restored = setWaterAmount(previous.before);
    if (restored) {
        previousWaterChange = null;
        window.fitcalcToast("Last water change undone.");
    }
    return restored;
}

document.getElementById("add-water")?.addEventListener("click", function () {
    if (addWaterAmount(0.25)) window.fitcalcToast("250 ml added.");
});

document.getElementById("add-custom-water")?.addEventListener("click", function () {
    const input = document.getElementById("custom-water-amount");
    const amount = Number(input && input.value);
    if (!input || !String(input.value).trim() || !Number.isFinite(amount) || amount <= 0 || amount > 10) {
        window.fitcalcToast("Enter a water amount from 0.01 to 10 litres.", "error");
        return;
    }
    if (addWaterAmount(amount)) {
        input.value = "";
        window.fitcalcToast(amount.toFixed(2) + " L added.");
    }
});

document.getElementById("undo-water")?.addEventListener("click", undoWaterChange);

/*
 * RESET WATER
 */

const resetWaterButton =
    document.getElementById(
        "reset-water"
    );


if (resetWaterButton) resetWaterButton.addEventListener("click", function () {
    if (setWaterAmount(0)) window.fitcalcToast("Water total reset.");
});


/*
 * INITIALIZE
 */

function refreshNutritionDay() {
    if (editingFoodIndex >= 0) {
        const dateKey = getNutritionDateKey();
        const foods = getNutritionFor(dateKey).foods || [];
        const currentFood = editingFoodDateKey === dateKey ? foods[editingFoodIndex] : null;
        if (!currentFood || JSON.stringify(currentFood) !== editingFoodSnapshot) cancelFoodEdit();
    }
    updateNutritionDateDisplay();
    updateNutritionDisplay();
    updateFoodList();
    updateWaterDisplay();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("focus", refreshNutritionTodayIfNeeded);
    if (typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState !== "hidden") refreshNutritionTodayIfNeeded();
        });
    }
    window.addEventListener("fitcalc:data-change", function (event) {
        const detail = event.detail || {};
        const relevantKeys = [NUTRITION_KEY, PLANNER_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY, FOOD_LIBRARY_KEY];
        if (detail.key && relevantKeys.indexOf(detail.key) === -1) return;
        if (detail.key === FOOD_LIBRARY_KEY) {
            renderFoodShortcuts();
            updateFoodList();
            return;
        }
        if (detail.date && detail.date !== getNutritionDateKey() &&
            (detail.key === NUTRITION_KEY || detail.key === PLANNER_KEY)) return;
        refreshNutritionDay();
    });

    window.addEventListener("storage", function (event) {
        if (event.key === fitcalcStorageKey(FOOD_LIBRARY_KEY)) {
            renderFoodShortcuts();
            updateFoodList();
            return;
        }
        if ([NUTRITION_KEY, PLANNER_KEY, PROFILE_KEY, TARGETS_KEY, PREFERENCES_KEY, FOOD_LIBRARY_KEY].some(function (key) {
            return event.key === fitcalcStorageKey(key);
        })) refreshNutritionDay();
    });
}

updateNutritionDisplay();

updateFoodList();
renderFoodShortcuts();

updateWaterDisplay();
updateNutritionDateDisplay();
updateFoodAmountLabel();
