# FitCalc

Fitness tools made simple: 13 calculators plus a small tracking app (profile, targets, food log, planner, workouts, history). Desktop app built with Electron; the pages also work in a browser.

Inspired by Arch Linux / Hyprland. Built around food technology and biotechnology.

## Run

```bash
npm install
npm start        # launch the desktop app
npm test         # unit tests, asset checks, and Electron browser UI checks
npm run build    # package with electron-builder
npm run smoke:packaged # build and briefly launch the unpacked desktop app
```

## Android and iOS apps

Capacitor packages the existing vanilla web app from `netlify-dist/`; it does not
replace the Electron desktop app. Capacitor 8 is configured with app ID
`com.vikx.fitcalc`. Run `npm run mobile:prepare` before syncing so the service
worker cache version and staged web assets match the current source.

```bash
npm run mobile:add:android # once, to create android/
npm run mobile:sync:android
npm run mobile:run:android # requires Android Studio/SDK, Java, and a device/emulator
npm run mobile:open:android
```

On macOS with Xcode installed, use the matching `mobile:add:ios`, `mobile:sync:ios`,
`mobile:run:ios`, and `mobile:open:ios` scripts. Android and iOS platform projects
are separate from Electron. FitCalc keeps using its existing localStorage data
keys and JSON backup/import; browser, Electron, and installed-app storage are
separate, so transfer data with a backup. The Android project declares camera
permission for the existing barcode scanner. iOS needs
`NSCameraUsageDescription` in its generated `Info.plist` before enabling camera
scanning. Barcode scanning still depends on WebView `BarcodeDetector` support;
manual barcode entry remains available.

Mobile device builds and camera/download behavior must be tested on Android and
iOS. `npm test` continues to test the web application and Electron browser flow;
it does not build native apps.

The browser checks run in Electron's Chromium engine. `npm run build` also syncs
the service-worker cache identifier to the `package.json` version before packaging.
The application bundles the Inter variable font under the SIL Open Font License;
this keeps typography available offline and avoids a third-party font request, at
the cost of roughly 860 KB added to the app download.

## Architecture

- `constants.js` storage keys and daily goals
- `store.js` the only localStorage access layer; domain modules use its read/write helpers
- `store.js` tracks `fitcalc_schema_version` and owns versioned migrations plus JSON backup, restore, and reset
- `target.js` target engine: profile → BMR → TDEE → goal → targets
- `nutrition.js`, `planner.js`, `workout.js` own food/water, steps/workouts/tasks, templates
- `dashboard.js`, `adaptive.js` read the store and render today + priorities
- `progress.js`, `history.js` daily records and charts
- `calculators.js` standalone calculators (separate from app data)
- `script.js` + `main.css` global UI (navigation is defined once in `script.js`; shared and component-specific responsive rules live in `main.css`)

## Data ownership

- Profile owns profile values. `target.js` derives and stores targets from the profile.
- Users can override daily nutrition targets from Profile; overrides remain active when profile estimates refresh until reset to estimates.
- `fitcalc_preferences` owns theme and display units. Profile and planner show kg/lb and cm/ft-in while measurements stay stored as kg/cm.
- Standalone calculators use the selected weight and height units where applicable, convert to metric for calculations, and remain read-only with respect to app data.
- Nutrition owns food entries, nutrition totals, and water under a date key.
- The hydration target is estimated from profile weight plus recorded exercise duration for that date; it is a personal estimate, not a universal prescription.
- Planner owns steps, weight, workouts, and tasks under a date key. Workout templates use their own key.
- Dashboard reads current nutrition, targets, and planner data. It does not persist a second copy.
- Progress records are snapshots refreshed when nutrition or planner data changes. Opening History does not create an empty record for today. Legacy activity backfill writes history in one batch and remains retryable if storage rejects the write.
- Standalone calculators do not write to app data.
- Profile → Data & privacy exports and restores a versioned JSON backup, or resets FitCalc-owned local data. Schema upgrades preserve the existing unversioned v1 records and use `store.js` migration hooks for future changes.

## Food and exercise lookups

- Packaged food search and barcode lookup use the public Open Food Facts read API. No API key is needed. Nutrition values are community submitted, so verify labels for important decisions.
- Camera barcode scanning uses `getUserMedia` and the browser's built-in `BarcodeDetector` when supported. Camera use requires a secure context and permission; manual barcode lookup remains available when camera or detection support is missing.
- Exercise discovery uses wger's public read-only exercise information API. Terms of at least two letters first use the `name__search` filter on `/api/v2/exerciseinfo/`, with a limit of 20 results. The endpoint and parameters are based on wger's public API docs and should be re-checked before each release. If that request fails or returns no useful name matches, FitCalc searches a local library fetched in parallel batches of up to four pages, capped at 20 pages (2,000 entries). Successfully fetched pages remain available when another page fails; the UI reports the partial count and offers Retry. A complete client-side search that finds nothing says so explicitly. Manual exercise names remain available. Results can be added to a planner workout; actual sets/reps/weight or duration are entered separately and remain FitCalc-owned.
- These integrations need internet access. The local food list, manually entered exercise names, and tracking features continue to work without them.

## Web install and offline use

On an HTTPS web deployment, FitCalc can be installed as a Progressive Web App. The service worker requests HTML, JavaScript, and CSS from the network first, then falls back to cached copies offline; fonts and icons remain cache-first. User records remain in that browser's local storage. The Electron build does not use the service worker.

Netlify builds run `node scripts/sync-service-worker-cache.js && node scripts/prepare-netlify.js` and publish `netlify-dist/`. This updates the service-worker cache name from `package.json` before staging the web app.
The staging script copies the browser app and its required assets while excluding
`tests/`, `scripts/`, `package*.json`, Electron output, and development dependencies.

Application pages use a Content Security Policy that permits local scripts/styles,
camera media, and the Open Food Facts and wger API origins used by the app.

## Desktop packaging

Electron Builder is configured for macOS DMG, Windows NSIS, and Linux AppImage/DEB
targets. macOS packages declare camera use for the optional barcode scanner. A
Windows ICO and Linux PNG are generated from the FitCalc app icon. Cross-platform
packaging still requires running the corresponding target on a supported build host;
this repository does not include signing identities or notarization credentials.

## Integration boundaries

- Cloud sync is not enabled: this repository has no backend, authentication provider, or sync credentials. Do not put provider secrets in the browser. A production sync provider needs an authenticated backend endpoint before sync can be enabled.
- HealthKit requires a native iOS target, Apple entitlements, and permission flows; this web/Electron package does not contain those. Health data is not simulated.
- Native Android health integration likewise needs an Android app target and user-granted Health Connect access.

Results are estimates, not medical advice.

Found a bug? Open an issue.
