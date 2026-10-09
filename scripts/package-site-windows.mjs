import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const [, , , projectArg, archiveArg] = process.argv;
if (!projectArg || !archiveArg) {
  throw new Error("Expected the Sites package script, project directory, and archive path.");
}

const project = resolve(projectArg);
const archive = resolve(archiveArg);
const pluginRoot = "C:\\Users\\16484\\.codex\\plugins\\cache\\openai-curated-remote\\sites\\0.1.75";
const prepare = join(pluginRoot, "skills", "sites-hosting", "scripts", "prepare-site-build.cjs");
const stage = mkdtempSync(join(tmpdir(), "sites-package-"));

try {
  execFileSync(process.execPath, [prepare, project, join(stage, "dist")], { stdio: "inherit" });
  mkdirSync(dirname(archive), { recursive: true });
  const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
  execFileSync(tar, ["-C", stage, "-czf", archive, "dist"], { stdio: "inherit" });
  const entries = execFileSync(tar, ["-tzf", archive], { encoding: "utf8" }).split(/\r?\n/);
  if (!entries.includes("dist/.openai/hosting.json") || !existsSync(archive)) {
    throw new Error("The Sites archive is missing its hosting configuration.");
  }
  JSON.parse(readFileSync(join(stage, "dist", ".openai", "hosting.json"), "utf8"));
  console.log(archive);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
