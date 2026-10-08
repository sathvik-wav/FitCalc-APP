"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");

const root = path.resolve(__dirname, "..");
const sources = [
  { dataset: "Foundation", label: "Foundation", root: path.join(root, "data-src/foundation/FoodData_Central_foundation_food_csv_2026-04-30"), foodsFile: "foundation_food.csv" },
  { dataset: "SR Legacy", label: "SR Legacy", root: path.join(root, "data-src/sr-legacy/FoodData_Central_sr_legacy_food_csv_2018-04"), foodsFile: "sr_legacy_food.csv" }
];
const outputPath = path.join(root, "foods-usda.json");
const excludedCategory = /baby foods|fast foods|meals, entrees, and side dishes|restaurant foods|branded food products database|quality control materials/i;

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      fields.push(field);
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

async function readCsv(filePath, onRow) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let headers = null;
  let count = 0;
  for await (const line of lines) {
    if (headers === null) {
      headers = parseCsvLine(line).map((value) => value.replace(/^\uFEFF/, ""));
      continue;
    }
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = Object.create(null);
    headers.forEach((header, index) => { row[header] = values[index] === undefined ? "" : values[index]; });
    await onRow(row);
    count += 1;
  }
  return count;
}

function normalizeName(value) {
  return String(value || "").normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function cleanName(value) {
  const source = String(value || "").normalize("NFKC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  if (!source) return "";
  const hasLowercase = /[a-z]/.test(source) && source !== source.toUpperCase();
  if (hasLowercase) return source;
  return source.toLocaleLowerCase().replace(/(^|[\s,(\/-])([a-z])/g, (match, separator, letter) => separator + letter.toLocaleUpperCase());
}

function looksBranded(description) {
  // SR Legacy includes branded products mixed into generic categories. Brand
  // names often appear as all-caps words, sometimes inside a title-case
  // segment ("SILK Coffee"). USDA Food Distribution Program notes are not
  // brands, so ignore the USDA token when it is the only uppercase marker.
  const text = String(description || "");
  const tokens = text.match(/\b[A-Z][A-Z0-9&.'-]{2,}\b/g) || [];
  if (tokens.some((token) => token !== "USDA")) return true;
  return /\b(?:Rudi's|Schar|Udi's|Kashi|Silk|Chobani|Fage|Oikos|Yoplait|Dannon|Kellogg's|Cheerios|Quaker|Planters|Goya|Campbell's|Kraft|Ocean Spray)\b/i.test(text);
}

function generatedAliases(name) {
  const first = String(name).split(",")[0].trim();
  const aliases = new Set();
  if (first && normalizeName(first) !== normalizeName(name)) {
    aliases.add(first.toLocaleLowerCase());
    const singular = first.toLocaleLowerCase().replace(/ies$/, "y").replace(/oes$/, "o").replace(/s$/, "");
    if (singular && singular !== first.toLocaleLowerCase()) aliases.add(singular);
  }
  return Array.from(aliases);
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round1(value) {
  return value === null ? null : Math.round((value + Number.EPSILON) * 10) / 10;
}

async function loadCategories(source) {
  const categories = new Map();
  await readCsv(path.join(source.root, "food_category.csv"), (row) => categories.set(row.id, row.description.trim()));
  return categories;
}

async function loadNutrientRules(source) {
  const nutrients = [];
  await readCsv(path.join(source.root, "nutrient.csv"), (row) => {
    const id = Number(row.id);
    const name = String(row.name || "").trim().toLocaleLowerCase();
    const unit = String(row.unit_name || "").trim().toLocaleLowerCase();
    let key = "";
    let priority = 0;
    if (unit === "kcal" && /^energy(?:\b|,)/.test(name)) {
      key = "kcal";
      priority = name === "energy" ? 30 : name.includes("specific") ? 20 : name.includes("general") ? 10 : 5;
    } else if (unit === "g" && name === "protein") {
      key = "protein"; priority = 30;
    } else if (unit === "g" && /^(?:total lipid \(fat\)|fat, total lipid)$/.test(name)) {
      key = "fat"; priority = 30;
    } else if (unit === "g" && /^carbohydrate, by difference$/.test(name)) {
      key = "carbs"; priority = 30;
    } else if (unit === "g" && /^carbohydrate, by summation$/.test(name)) {
      key = "carbs"; priority = 20;
    } else if (unit === "g" && /^(?:carbohydrates|carbohydrate)$/.test(name)) {
      key = "carbs"; priority = 10;
    } else if (unit === "g" && /(?:fiber|fibre).*total|total.*(?:fiber|fibre)/.test(name)) {
      key = "fiber";
      priority = /aoac 2011\.25/.test(name) ? 30 : (/total dietary/.test(name) ? 25 : 10);
    }
    if (key && Number.isFinite(id)) nutrients.push({ id, key, priority, unit });
  });
  return nutrients;
}

async function buildDataset(source) {
  const categories = await loadCategories(source);
  const genericIds = new Set();
  await readCsv(path.join(source.root, source.foodsFile), (row) => genericIds.add(row.fdc_id));
  const foods = new Map();
  const categoryCounts = new Map();
  const droppedCategories = new Map();
  let eligibleRows = 0;
  let droppedBranded = 0;
  await readCsv(path.join(source.root, "food.csv"), (row) => {
    if (!genericIds.has(row.fdc_id)) return;
    const category = categories.get(row.food_category_id) || "Uncategorized";
    if (excludedCategory.test(category)) {
      droppedCategories.set(category, (droppedCategories.get(category) || 0) + 1);
      return;
    }
    if (looksBranded(row.description)) {
      droppedBranded += 1;
      return;
    }
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    const name = cleanName(row.description);
    if (!name) return;
    foods.set(row.fdc_id, {
      name,
      aliases: generatedAliases(name),
      fdcId: Number(row.fdc_id),
      dataset: source.dataset,
      source: "USDA",
      category,
      nutrients: Object.create(null),
      nutrientPriorities: Object.create(null),
      portions: []
    });
    eligibleRows += 1;
  });

  const nutrientRules = await loadNutrientRules(source);
  const nutrientIds = new Map();
  nutrientRules.forEach((rule) => {
    if (!nutrientIds.has(rule.id) || nutrientIds.get(rule.id).priority < rule.priority) nutrientIds.set(rule.id, rule);
  });
  let skippedNoKcal = 0;
  const nutrientRows = await readCsv(path.join(source.root, "food_nutrient.csv"), (row) => {
    const food = foods.get(row.fdc_id);
    const rule = nutrientIds.get(Number(row.nutrient_id));
    if (!food || !rule) return;
    const amount = numberOrNull(row.amount);
    if (amount === null || amount < 0 || amount > 1000) return;
    const previousPriority = food.nutrientPriorities[rule.key] || 0;
    if (rule.priority >= previousPriority) {
      food.nutrients[rule.key] = amount;
      food.nutrientPriorities[rule.key] = rule.priority;
    }
  });

  const units = new Map();
  await readCsv(path.join(source.root, "measure_unit.csv"), (row) => units.set(row.id, row.name.trim()));
  const portionRows = await readCsv(path.join(source.root, "food_portion.csv"), (row) => {
    const food = foods.get(row.fdc_id);
    if (!food) return;
    const gramWeight = numberOrNull(row.gram_weight);
    const amount = numberOrNull(row.amount) || 1;
    if (gramWeight === null || gramWeight <= 0 || amount <= 0) return;
    const measure = units.get(row.measure_unit_id) || "";
    const description = String(row.portion_description || "").trim();
    const modifier = String(row.modifier || "").trim();
    const label = description || [String(amount === 1 ? "" : amount).trim(), measure, modifier].filter(Boolean).join(" ") || modifier || measure || "portion";
    const grams = round1(gramWeight * amount);
    if (grams > 0) food.portions.push({ label: label.replace(/\s+/g, " ").trim(), grams });
  });

  let missingKcal = 0;
  const result = [];
  foods.forEach((food) => {
    const kcal = food.nutrients.kcal;
    if (kcal === undefined || kcal === null || !Number.isFinite(kcal) || kcal < 0 || kcal > 900) {
      missingKcal += 1;
      return;
    }
    const portions = [];
    const seenPortions = new Set();
    food.portions.forEach((portion) => {
      const key = normalizeName(portion.label) + "\u0000" + portion.grams;
      if (!portion.label || seenPortions.has(key)) return;
      seenPortions.add(key);
      portions.push(portion);
    });
    result.push({
      name: food.name,
      aliases: food.aliases,
      source: "USDA",
      fdcId: food.fdcId,
      dataset: food.dataset,
      category: food.category,
      kcal: round1(kcal),
      protein: round1(food.nutrients.protein === undefined ? null : food.nutrients.protein),
      carbs: round1(food.nutrients.carbs === undefined ? null : food.nutrients.carbs),
      fat: round1(food.nutrients.fat === undefined ? null : food.nutrients.fat),
      fiber: round1(food.nutrients.fiber === undefined ? null : food.nutrients.fiber),
      portions
    });
  });
  skippedNoKcal = missingKcal;
  return {
    foods: result,
    report: {
      dataset: source.dataset,
      genericFoodIds: genericIds.size,
      eligibleCategoryRows: eligibleRows,
      skippedNoKcal,
      droppedBranded,
      nutrientRows,
      portionRows,
      keptCategories: Array.from(categoryCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      droppedCategories: Array.from(droppedCategories.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    }
  };
}

function sanityCheck(foods) {
  const checks = [
    { label: "raw carrot", find: (food) => /^carrots?, raw\b/i.test(food.name), expected: { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2 }, tolerance: { kcal: 2, protein: 0.4, carbs: 0.5, fat: 0.3 } },
    { label: "egg whole raw", find: (food) => /^eggs?, whole, raw\b/i.test(food.name), expected: { kcal: 143, protein: 12.6 }, tolerance: { kcal: 3, protein: 0.8 } },
    { label: "banana raw", find: (food) => /^bananas?, raw\b/i.test(food.name), expected: { kcal: 89 }, tolerance: { kcal: 2 } },
    { label: "white rice cooked", find: (food) => /^rice, white, long-grain, regular, enriched, cooked$/i.test(food.name), expected: { kcal: 130 }, tolerance: { kcal: 5 } }
  ];
  const failures = [];
  checks.forEach((check) => {
    const food = foods.find(check.find);
    if (!food) {
      failures.push(check.label + ": no matching generic record with usable kcal");
      return;
    }
    Object.entries(check.expected).forEach(([key, expected]) => {
      const actual = food[key];
      if (actual === null || Math.abs(actual - expected) > check.tolerance[key]) {
        failures.push(`${check.label}: ${food.name} ${key}=${actual} (expected about ${expected})`);
      }
    });
  });
  if (failures.length) throw new Error("USDA sanity checks failed:\n" + failures.join("\n"));
  return checks.map((check) => {
    const food = foods.find(check.find);
    return `${check.label}: ${food.name} ${food.kcal} kcal, P${food.protein}, C${food.carbs}, F${food.fat}`;
  });
}

async function build() {
  for (const source of sources) {
    for (const filename of ["food.csv", source.foodsFile, "food_nutrient.csv", "nutrient.csv", "food_category.csv", "food_portion.csv", "measure_unit.csv"]) {
      if (!fs.existsSync(path.join(source.root, filename))) throw new Error("Required USDA source file missing: " + path.join(source.root, filename));
    }
  }
  const builds = [];
  for (const source of sources) builds.push(await buildDataset(source));

  const byName = new Map();
  builds.forEach(({ foods }) => foods.forEach((food) => {
    const key = normalizeName(food.name);
    const previous = byName.get(key);
    if (!previous) {
      byName.set(key, food);
      return;
    }
    const preferred = food.dataset === "Foundation" ? food : previous;
    const other = preferred === food ? previous : food;
    preferred.aliases = Array.from(new Set(preferred.aliases.concat(other.aliases)));
    byName.set(key, preferred);
  }));
  const foods = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  const sanity = sanityCheck(foods);
  if (foods.length < 2500) throw new Error(`Only ${foods.length} foods passed the source filters; expected at least 2,500 generic USDA foods.`);

  const datasetCounts = foods.reduce((counts, food) => {
    counts[food.dataset] = (counts[food.dataset] || 0) + 1;
    return counts;
  }, {});
  const json = JSON.stringify(foods);
  const gzippedBytes = zlib.gzipSync(Buffer.from(json)).byteLength;
  if (gzippedBytes >= 1024 * 1024) throw new Error(`USDA bundle is ${gzippedBytes} gzipped bytes; budget is under 1 MB.`);

  const report = {
    foods: foods.length,
    datasetCounts,
      skippedNoKcal: builds.reduce((total, buildResult) => total + buildResult.report.skippedNoKcal, 0),
    droppedBranded: builds.reduce((total, buildResult) => total + buildResult.report.droppedBranded, 0),
    categories: builds.map((buildResult) => ({ dataset: buildResult.report.dataset, kept: buildResult.report.keptCategories, dropped: buildResult.report.droppedCategories })),
    sanity,
    jsonBytes: Buffer.byteLength(json),
    gzippedBytes
  };
  fs.writeFileSync(outputPath, json + "\n");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${path.relative(root, outputPath)} (${report.jsonBytes} bytes, ${report.gzippedBytes} bytes gzipped).`);
}

if (require.main === module) {
  build().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { build, parseCsvLine, cleanName, normalizeName };
