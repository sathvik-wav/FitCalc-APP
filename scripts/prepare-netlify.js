"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const publishRoot = path.join(projectRoot, "netlify-dist");
const excludedRootEntries = new Set([
    ".git", ".netlify", "node_modules", "tests", "scripts", "dist", "netlify-dist", "android", "ios"
]);

function shouldSkip(relativePath, name) {
    const parts = relativePath.split(path.sep);
    if (name.startsWith(".")) return true;
    if (parts.length === 1 && excludedRootEntries.has(name)) return true;
    if (/^package.*\.json$/i.test(name)) return true;
    if (relativePath === "capacitor.config.json") return true;
    if (relativePath === "main.js" || relativePath === "README.md" || relativePath === "netlify.toml") return true;
    if (parts[0] === "build" && parts.length > 1 && parts[1] !== "icon.iconset") return true;
    return false;
}

function copyPublicFiles(sourceRoot, destinationRoot, relativeDirectory) {
    const sourceDirectory = path.join(sourceRoot, relativeDirectory);
    const destinationDirectory = path.join(destinationRoot, relativeDirectory);
    fs.mkdirSync(destinationDirectory, { recursive: true });

    for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
        const relativePath = path.join(relativeDirectory, entry.name);
        if (shouldSkip(relativePath, entry.name) || (!entry.isDirectory() && !entry.isFile())) continue;

        const sourcePath = path.join(sourceRoot, relativePath);
        const destinationPath = path.join(destinationRoot, relativePath);
        if (entry.isDirectory()) {
            copyPublicFiles(sourceRoot, destinationRoot, relativePath);
        } else {
            fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
            fs.copyFileSync(sourcePath, destinationPath);
        }
    }
}

function prepareNetlifySite() {
    fs.rmSync(publishRoot, { recursive: true, force: true });
    fs.mkdirSync(publishRoot, { recursive: true });
    copyPublicFiles(projectRoot, publishRoot, "");
    return publishRoot;
}

if (require.main === module) {
    prepareNetlifySite();
    console.log("Prepared Netlify site in netlify-dist/.");
}

module.exports = { prepareNetlifySite };
