const PROFILE_KEY = "macrobay_profile";
const TARGETS_KEY = "macrobay_targets";
const NUTRITION_KEY = "macrobay_nutrition";
const PLANNER_KEY = "macrobay_planner";
const HISTORY_KEY = "macrobay_history";
const LEGACY_PROGRESS_BACKFILL_KEY = "macrobay_progress_backfill_v1";
const PROGRESS_BACKFILL_KEY = "macrobay_progress_backfill_v2";
const WORKOUT_TEMPLATES_KEY = "macrobay_workout_templates";
const PREFERENCES_KEY = "macrobay_preferences";
const FOOD_LIBRARY_KEY = "macrobay_food_library";
const SCHEMA_VERSION_KEY = "macrobay_schema_version";
const APP_SCHEMA_VERSION = 2;

// Daily goals (single place to change them)
const STEPS_GOAL = 10000;

// Target engine settings
const GOAL_ADJUSTMENT = { lose: -500, maintain: 0, gain: 300 };
const CALORIE_FLOOR = { male: 1500, female: 1200 };
