/*
 * Curated Indian food search aliases using USDA FoodData Central SR Legacy
 * reference records. IFCT 2017 values are intentionally not bundled here:
 * its terms require NIN's prior written permission before storing its data
 * electronically in a product. See README.md for the source and reuse note.
 */
const indianFoodDatabase = [
    {
        name: "Chapati or roti, plain (commercially prepared)",
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
    }
];
