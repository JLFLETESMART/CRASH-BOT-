"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && fullPath.endsWith(".js") ? [fullPath] : [];
  });
}

const srcDir = path.resolve(__dirname, "..", "src");
const files = walk(srcDir);

files.forEach(file => {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
});

console.log(`Syntax OK (${files.length} files checked)`);
