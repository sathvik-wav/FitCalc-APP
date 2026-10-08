/*
 * Curated Indian food search aliases using USDA FoodData Central SR Legacy
 * reference records. IFCT 2017 values are intentionally not bundled here:
 * its terms require NIN's prior written permission before storing its data
 * electronically in a product. See README.md for the source and reuse note.
 */
const indianFoodDatabase = [
    {
        name: "Chapati or roti, plain (commercially prepared)",
        aliases: ["roti", "chapati", "atta roti"],
        brand: "",
        calories: 297,
        protein: 11.25,
        carbs: 46.36,
        fat: 7.45,
        fiber: 4.9,
        pieceGrams: 68,
        servingGrams: 68,
        unitGrams: { oz: 28.35, piece: 68 },
        units: ["g", "oz", "piece"],
        defaultUnit: "piece",
        source: "USDA FoodData Central",
        barcode: "",
        fdcId: 171844
    },
    {
        name: "Curd or dahi, plain whole-milk (yogurt equivalent)",
        aliases: ["curd", "dahi", "plain yogurt"],
        brand: "",
        calories: 61,
        protein: 3.47,
        carbs: 4.66,
        fat: 3.25,
        fiber: 0,
        pieceGrams: null,
        servingGrams: 245,
        unitGrams: {
            oz: 28.35,
            ml: 245 / 240,
            tsp: 245 / 48,
            tbsp: 245 / 16,
            cup: 245,
            glass: 245 * 250 / 240
        },
        units: ["g", "oz", "ml", "tsp", "tbsp", "cup", "glass"],
        defaultUnit: "cup",
        source: "USDA FoodData Central",
        barcode: "",
        fdcId: 171284
    },
    {
        name: "Carrot, raw",
        aliases: ["carrot", "carrots", "gajar"],
        calories: 41, protein: 0.93, carbs: 9.58, fat: 0.24, fiber: 2.8,
        servingGrams: 61,
        unitGrams: { oz: 28.35, piece: 61, cup: 128 },
        units: ["g", "oz", "piece", "cup"], defaultUnit: "piece",
        preparation: "raw",
        source: "USDA", barcode: "", fdcId: 170393
    },
    {
        name: "Cucumber, with peel, raw",
        aliases: ["cucumber", "cucumbers", "kheera", "khira"],
        calories: 15, protein: 0.65, carbs: 3.63, fat: 0.11, fiber: 0.5,
        servingGrams: 301,
        unitGrams: { oz: 28.35, piece: 301, cup: 52 },
        units: ["g", "oz", "piece", "cup"], defaultUnit: "piece",
        preparation: "raw, with peel",
        source: "USDA", barcode: "", fdcId: 168409
    },
    {
        name: "Onions, raw",
        aliases: ["onion", "onions", "pyaz"],
        calories: 40, protein: 1.1, carbs: 9.34, fat: 0.1, fiber: 1.7,
        servingGrams: 160, unitGrams: { oz: 28.35, cup: 160 },
        units: ["g", "oz", "cup"], defaultUnit: "cup",
        preparation: "raw, chopped", source: "USDA", barcode: "", fdcId: 170000
    },
    {
        name: "Peas, green, raw",
        aliases: ["green peas", "peas", "matar", "matar dana"],
        calories: 81, protein: 5.42, carbs: 14.45, fat: 0.4, fiber: 5.1,
        servingGrams: 145, unitGrams: { oz: 28.35, cup: 145 },
        units: ["g", "oz", "cup"], defaultUnit: "cup",
        preparation: "raw", source: "USDA", barcode: "", fdcId: 170419
    },
    {
        name: "Tomato, red, ripe, raw",
        aliases: ["tomato", "tomatoes", "tamatar"],
        calories: 18, protein: 0.88, carbs: 3.89, fat: 0.2, fiber: 1.2,
        servingGrams: 123,
        unitGrams: { oz: 28.35, piece: 123, cup: 180 },
        units: ["g", "oz", "piece", "cup"], defaultUnit: "piece",
        preparation: "raw",
        source: "USDA", barcode: "", fdcId: 170457
    },
    {
        name: "Pigeon peas (toor dal), mature seeds, raw",
        aliases: ["toor dal", "toor", "arhar dal", "pigeon pea", "red gram"],
        calories: 343, protein: 21.7, carbs: 62.78, fat: 1.49, fiber: 15,
        servingGrams: 100, unitGrams: { oz: 28.35 },
        units: ["g", "oz", "serving"], defaultUnit: "g",
        preparation: "mature seeds, raw",
        source: "USDA", barcode: "", fdcId: 172436
    },
    {
        name: "Mung beans, mature seeds, raw",
        aliases: ["mung bean", "mung beans", "moong", "whole moong", "green gram"],
        calories: 347, protein: 23.86, carbs: 62.62, fat: 1.15, fiber: 16.3,
        servingGrams: 100, unitGrams: { oz: 28.35 },
        units: ["g", "oz"], defaultUnit: "g",
        preparation: "mature seeds, raw", source: "USDA", barcode: "", fdcId: 174256
    },
    {
        name: "Cheese, paneer",
        aliases: ["paneer", "indian cottage cheese"],
        calories: 299, protein: 15.9, carbs: 22.5, fat: 15.5, fiber: 0,
        servingGrams: 113, unitGrams: { oz: 28.35, piece: 28, cup: 246 },
        units: ["g", "oz", "piece", "cup", "serving"], defaultUnit: "serving",
        preparation: "plain",
        source: "USDA", barcode: "", fdcId: 2705740
    },
    {
        name: "Wheat flour, whole-grain",
        aliases: ["whole wheat flour", "atta", "wholemeal flour"],
        calories: 340, protein: 13.21, carbs: 71.97, fat: 2.5, fiber: 10.7,
        servingGrams: 120, unitGrams: { oz: 28.35, cup: 120 },
        units: ["g", "oz", "cup", "serving"], defaultUnit: "cup",
        preparation: "whole-grain, dry",
        source: "USDA", barcode: "", fdcId: 168893
    },
    {
        name: "Mango, raw",
        aliases: ["mango", "mangoes", "aam"],
        calories: 60, protein: 0.82, carbs: 14.98, fat: 0.38, fiber: 1.6,
        servingGrams: 336, unitGrams: { oz: 28.35, piece: 336, cup: 165 },
        units: ["g", "oz", "piece", "cup"], defaultUnit: "piece",
        preparation: "raw, edible portion",
        source: "USDA", barcode: "", fdcId: 169910
    },
    {
        name: "Papayas, raw",
        aliases: ["papaya", "papayas", "papita"],
        calories: 43, protein: 0.47, carbs: 10.82, fat: 0.26, fiber: 1.7,
        servingGrams: 145, unitGrams: { oz: 28.35, cup: 145 },
        units: ["g", "oz", "cup"], defaultUnit: "cup",
        preparation: "raw, edible portion", source: "USDA", barcode: "", fdcId: 169926
    },
    {
        name: "Peanuts, all types, raw",
        aliases: ["peanut", "groundnuts", "moongphali"],
        calories: 567, protein: 25.8, carbs: 16.13, fat: 49.24, fiber: 8.5,
        servingGrams: 28.35, unitGrams: { oz: 28.35 },
        units: ["g", "oz", "serving"], defaultUnit: "serving",
        preparation: "raw",
        source: "USDA", barcode: "", fdcId: 172430
    },
    {
        name: "Nuts, cashew nuts, raw",
        aliases: ["cashew", "cashews", "kaju"],
        calories: 553, protein: 18.22, carbs: 30.19, fat: 43.85, fiber: 3.3,
        servingGrams: 28.35, unitGrams: { oz: 28.35 },
        units: ["g", "oz", "serving"], defaultUnit: "serving",
        preparation: "raw", source: "USDA", barcode: "", fdcId: 170162
    },
    {
        name: "Seeds, chia seeds, dried",
        aliases: ["chia", "chia seed", "chia seeds"],
        calories: 486, protein: 16.54, carbs: 42.12, fat: 30.74, fiber: 34.4,
        servingGrams: 28.35, unitGrams: { oz: 28.35 },
        units: ["g", "oz", "serving"], defaultUnit: "serving",
        preparation: "dried",
        source: "USDA", barcode: "", fdcId: 170554
    }
];
// These records have an FDC match in the bundled dataset by ID or normalized
// name. Keep unmatched local reference entries labeled neutrally.
const INDIAN_FOODS_WITH_USDA_MATCH = new Set([
    171844, 170393, 168409, 170000, 170419, 170457, 172436,
    174256, 168893, 169910, 169926, 172430, 170162, 170554
]);
indianFoodDatabase.forEach(function (food) {
    food.sourceTag = INDIAN_FOODS_WITH_USDA_MATCH.has(Number(food.fdcId)) ? "USDA" : "Reference";
});
