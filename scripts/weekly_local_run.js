// Runs the full weekly pipeline locally: fetch -> build -> commit data -> push -> deploy to
// GitHub Pages (gh-pages branch) -> (optional) YouTube upload. Meant to be triggered by Windows
// Task Scheduler as a stand-in for the GitHub Actions cron job.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function runAllowFail(cmd) {
  try {
    run(cmd);
    return true;
  } catch (err) {
    console.warn(`[warn] command failed, continuing: ${cmd}`);
    return false;
  }
}

function hasStagedChanges() {
  try {
    execSync("git diff --cached --quiet", { cwd: ROOT });
    return false;
  } catch {
    return true;
  }
}

function main() {
  const startedAt = new Date().toISOString();
  console.log(`=== Indie Weekly local run started ${startedAt} ===`);

  run("npm run fetch");
  run("npm run build");

  run("git add data/weekly");
  if (hasStagedChanges()) {
    const date = new Date().toISOString().slice(0, 10);
    run(`git commit -m "data: weekly song update ${date}"`);
    run("git push");
  } else {
    console.log("No new song data to commit.");
  }

  run("npm run deploy");

  // No-ops safely if YOUTUBE_* env vars aren't set (see scripts/upload_youtube_playlist.js).
  runAllowFail("npm run upload-youtube");

  console.log(`\n=== Indie Weekly local run finished ${new Date().toISOString()} ===`);
}

main();
