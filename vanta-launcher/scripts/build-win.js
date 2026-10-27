const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectDir = path.resolve(__dirname, "..");
const stagingDir = path.join(projectDir, ".build", "win-app");
const outputDir = path.join(projectDir, "dist");
const unpackedDir = path.join(outputDir, "win-unpacked");
const rootPackagePath = path.join(projectDir, "package.json");

function copyDirectory(name) {
  fs.cpSync(path.join(projectDir, name), path.join(stagingDir, name), {
    recursive: true,
    force: true
  });
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(path.join(stagingDir, "node_modules"), { recursive: true });

copyDirectory("electron");
copyDirectory("src");

const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf8"));
const stagedBuild = {
  ...rootPackage.build,
  electronVersion: String(rootPackage.devDependencies.electron).replace(/^[^0-9]*/, ""),
  directories: {
    ...(rootPackage.build.directories || {}),
    output: path.relative(stagingDir, outputDir)
  }
};
if (process.platform !== "win32") {
  stagedBuild.win = {
    ...stagedBuild.win,
    signAndEditExecutable: false
  };
  stagedBuild.toolsets = {
    ...(stagedBuild.toolsets || {}),
    wine: "1.0.1"
  };
}

const stagedPackage = {
  name: rootPackage.name,
  version: rootPackage.version,
  description: rootPackage.description,
  main: rootPackage.main,
  author: rootPackage.author,
  license: rootPackage.license,
  private: true,
  dependencies: rootPackage.dependencies || {},
  devDependencies: {},
  build: stagedBuild
};
fs.writeFileSync(
  path.join(stagingDir, "package.json"),
  `${JSON.stringify(stagedPackage, null, 2)}\n`
);

const builderBin = path.join(
  projectDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);
function runBuilder(args) {
  return spawnSync(builderBin, args, {
    cwd: projectDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NODE_ENV: "production",
      LD_LIBRARY_PATH: [
        process.env.LD_LIBRARY_PATH,
        process.env.REPLIT_LD_LIBRARY_PATH
      ].filter(Boolean).join(path.delimiter)
    }
  });
}

if (fs.existsSync(unpackedDir)) {
  fs.rmSync(unpackedDir, { recursive: true, force: true });
}
const directoryBuild = runBuilder(["--projectDir", stagingDir, "--win", "--x64", "--dir"]);
const unpackedBuildExists =
  fs.existsSync(path.join(unpackedDir, "VantaLauncher.exe")) &&
  fs.existsSync(path.join(unpackedDir, "resources", "app.asar"));

if (!unpackedBuildExists) {
  if (directoryBuild.error) console.error(directoryBuild.error.message);
  process.exit(directoryBuild.status ?? 1);
}
if (directoryBuild.status !== 0) {
  console.warn("electron-builder returned a nonzero status after producing the fresh Windows app payload; continuing with the verified files.");
}

if (process.argv.includes("--dir")) {
  process.exit(0);
}

const installerBuild = runBuilder([
  "--projectDir",
  stagingDir,
  "--prepackaged",
  unpackedDir,
  "--win",
  "--x64"
]);
const installerPath = path.join(
  outputDir,
  `Vanta Launcher Setup ${rootPackage.version}.exe`
);
if (installerBuild.status !== 0 || installerBuild.error) {
  if (installerBuild.error) console.error(installerBuild.error.message);
  try {
    if (fs.statSync(installerPath).size < 1024 * 1024) {
      fs.rmSync(installerPath, { force: true });
      fs.rmSync(
        path.join(outputDir, `${rootPackage.name}-${rootPackage.version}-x64.nsis.7z`),
        { force: true }
      );
      console.error("Removed incomplete NSIS artifacts; the unpacked Windows build is preserved.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  process.exit(installerBuild.status ?? 1);
}

if (!fs.existsSync(installerPath) || fs.statSync(installerPath).size < 1024 * 1024) {
  console.error("The NSIS installer was not created as a complete Windows installer.");
  process.exit(1);
}
process.exit(0);