const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { safeStorage } = require("electron");

const execFileAsync = promisify(execFile);

const VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const MICROSOFT_CLIENT_ID =
  process.env.BLAZE_MICROSOFT_CLIENT_ID || "00000000402b5328";
const MICROSOFT_SCOPE = "XboxLive.signin offline_access";
const DEVICE_CODE_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBOX_USER_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XBOX_XSTS_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_LOGIN_URL =
  "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";
const MINECRAFT_ENTITLEMENTS_URL =
  "https://api.minecraftservices.com/entitlements/mcstore";

let mainWindow = null;
let appRoot = null;
let pendingDeviceAuth = null;
let currentSession = null;
let activeMinecraftProcess = null;

function configure(window, userDataPath) {
  mainWindow = window;
  appRoot = path.join(userDataPath, "minecraft");
}

function emit(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function emitProgress(progress) {
  emit("launcher:progress", {
    phase: "working",
    current: 0,
    total: 0,
    percent: 0,
    ...progress
  });
}

function serviceError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function ensureRoot() {
  await fsp.mkdir(appRoot, { recursive: true });
  await fsp.mkdir(path.join(appRoot, "versions"), { recursive: true });
  await fsp.mkdir(path.join(appRoot, "libraries"), { recursive: true });
  await fsp.mkdir(path.join(appRoot, "assets"), { recursive: true });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeout || 30_000),
    ...options
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw serviceError(
      body.error || `HTTP_${response.status}`,
      body.errorMessage || body.error_description || body.error || `Request failed with HTTP ${response.status}.`,
      { status: response.status, body }
    );
  }
  return body;
}

async function requestForm(url, fields) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: response.ok, status: response.status, body };
}

async function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const input = fs.createReadStream(filePath);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

async function fileMatches(filePath, expectedSha1) {
  if (!expectedSha1) return false;
  try {
    return (await sha1File(filePath)).toLowerCase() === expectedSha1.toLowerCase();
  } catch {
    return false;
  }
}

async function downloadFile(url, filePath, expectedSha1, onBytes) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  if (await fileMatches(filePath, expectedSha1)) return { skipped: true };

  const tempPath = `${filePath}.partial`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(120_000),
    headers: { "User-Agent": "VantaLauncher/0.1.0 (official Minecraft launcher)" }
  });
  if (!response.ok || !response.body) {
    throw serviceError("DOWNLOAD_FAILED", `Could not download ${url} (HTTP ${response.status}).`);
  }

  const output = fs.createWriteStream(tempPath);
  const reader = response.body.getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      output.write(Buffer.from(value));
      if (onBytes) onBytes(value.byteLength);
    }
  } finally {
    output.end();
  }
  await new Promise((resolve, reject) => {
    output.once("close", resolve);
    output.once("error", reject);
  });
  if (!(await fileMatches(tempPath, expectedSha1))) {
    await fsp.rm(tempPath, { force: true });
    throw serviceError("CHECKSUM_MISMATCH", `Checksum verification failed for ${path.basename(filePath)}.`);
  }
  await fsp.rename(tempPath, filePath);
  return { bytes: total };
}

async function downloadMany(items, onProgress) {
  const totalBytes = items.reduce((sum, item) => sum + (item.size || 0), 0);
  let completedBytes = 0;
  let completedFiles = 0;
  let nextIndex = 0;
  const concurrency = Math.min(6, Math.max(1, items.length));

  const update = (extra = {}) => onProgress({
    totalBytes,
    completedBytes,
    completedFiles,
    totalFiles: items.length,
    percent: totalBytes ? Math.min(100, Math.round((completedBytes / totalBytes) * 100)) : Math.round((completedFiles / Math.max(items.length, 1)) * 100),
    ...extra
  });

  const worker = async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      let transferred = 0;
      await downloadFile(item.url, item.filePath, item.sha1, (bytes) => {
        transferred += bytes;
        completedBytes += bytes;
        update({ currentFile: item.label });
      });
      if (item.size && transferred < item.size) completedBytes += item.size - transferred;
      completedFiles += 1;
      update({ currentFile: item.label });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  update({ percent: 100 });
}

function osRuleAllows(rules = [], features = {}) {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    if (rule.os && rule.os.name && rule.os.name !== "windows") continue;
    if (rule.features && Object.entries(rule.features).some(([name, value]) => features[name] !== value)) continue;
    if (rule.action === "disallow") return false;
    if (rule.action === "allow") allowed = true;
  }
  return allowed;
}

function versionDirectory(versionId) {
  return path.join(appRoot, "versions", versionId);
}

function versionClientPath(versionId) {
  return path.join(versionDirectory(versionId), `${versionId}.jar`);
}

function versionMetadataPath(versionId) {
  return path.join(versionDirectory(versionId), `${versionId}.json`);
}

function libraryFilePath(library) {
  return path.join(appRoot, "libraries", library.downloads.artifact.path);
}

function nativeFilePath(library) {
  const classifier = library.downloads.classifiers[library.natives.windows];
  return classifier ? path.join(appRoot, "libraries", classifier.path) : null;
}

async function fetchVersionManifest() {
  await ensureRoot();
  return requestJson(VERSION_MANIFEST_URL);
}

async function fetchVersionMetadata(versionId) {
  const manifest = await fetchVersionManifest();
  const entry = manifest.versions.find((version) => version.id === versionId);
  if (!entry) throw serviceError("VERSION_NOT_FOUND", `Minecraft version ${versionId} was not found in the official manifest.`);
  const metadata = await requestJson(entry.url);
  return { entry, metadata };
}

async function installVersion(versionId) {
  await ensureRoot();
  emitProgress({ phase: "manifest", label: "Fetching official Minecraft manifest", percent: 2, indeterminate: true });
  const { entry, metadata } = await fetchVersionMetadata(versionId);
  await fsp.mkdir(versionDirectory(versionId), { recursive: true });
  await fsp.writeFile(versionMetadataPath(versionId), JSON.stringify(metadata, null, 2));
  emitProgress({ phase: "metadata", label: `Preparing Minecraft ${versionId}`, percent: 5, indeterminate: true });

  const client = metadata.downloads?.client;
  if (!client?.url || !client.sha1) {
    throw serviceError("CLIENT_DOWNLOAD_MISSING", `Official client metadata is missing for Minecraft ${versionId}.`);
  }
  const clientPath = versionClientPath(versionId);
  emitProgress({ phase: "client", label: "Downloading Minecraft client", percent: 7, totalFiles: 1, completedFiles: 0 });
  await downloadFile(client.url, clientPath, client.sha1, (bytes) => {
    emitProgress({ phase: "client", label: "Downloading Minecraft client", currentBytes: bytes });
  });
  emitProgress({ phase: "client", label: "Minecraft client ready", percent: 20, completedFiles: 1, totalFiles: 1 });

  const libraries = [];
  const nativeLibraries = [];
  for (const library of metadata.libraries || []) {
    if (!osRuleAllows(library.rules)) continue;
    if (library.downloads?.artifact) {
      libraries.push({
        url: library.downloads.artifact.url,
        sha1: library.downloads.artifact.sha1,
        size: library.downloads.artifact.size,
        filePath: libraryFilePath(library),
        label: library.name
      });
    }
    const native = library.downloads?.classifiers?.[library.natives?.windows];
    if (native && osRuleAllows(library.rules)) {
      nativeLibraries.push({
        url: native.url,
        sha1: native.sha1,
        size: native.size,
        filePath: path.join(appRoot, "libraries", native.path),
        label: `${library.name} native`
      });
    }
  }

  emitProgress({ phase: "libraries", label: `Downloading ${libraries.length + nativeLibraries.length} libraries`, percent: 21, completedFiles: 0, totalFiles: libraries.length + nativeLibraries.length });
  await downloadMany([...libraries, ...nativeLibraries], (progress) => {
    emitProgress({ phase: "libraries", label: progress.currentFile || "Downloading libraries", percent: 20 + Math.round(progress.percent * 0.25), ...progress });
  });

  const assetIndex = metadata.assetIndex;
  if (assetIndex?.url && assetIndex.id) {
    const indexPath = path.join(appRoot, "assets", "indexes", `${assetIndex.id}.json`);
    emitProgress({ phase: "asset-index", label: "Downloading asset index", percent: 46, indeterminate: true });
    await downloadFile(assetIndex.url, indexPath, assetIndex.sha1);
    const index = JSON.parse(await fsp.readFile(indexPath, "utf8"));
    const assets = Object.entries(index.objects || {}).map(([name, asset]) => ({
      url: `https://resources.download.minecraft.net/${asset.hash.slice(0, 2)}/${asset.hash}`,
      sha1: asset.hash,
      size: asset.size,
      filePath: path.join(appRoot, "assets", "objects", asset.hash.slice(0, 2), asset.hash),
      label: name
    }));
    emitProgress({ phase: "assets", label: `Downloading ${assets.length} game assets`, percent: 48, totalFiles: assets.length, completedFiles: 0 });
    await downloadMany(assets, (progress) => {
      emitProgress({ phase: "assets", label: progress.currentFile || "Downloading assets", percent: 48 + Math.round(progress.percent * 0.49), ...progress });
    });
  }

  await fsp.writeFile(path.join(versionDirectory(versionId), "installed.json"), JSON.stringify({
    versionId,
    installedAt: new Date().toISOString(),
    officialUrl: entry.url,
    assetIndex: assetIndex?.id || null
  }, null, 2));
  emitProgress({ phase: "complete", label: `Minecraft ${versionId} is ready to launch`, percent: 100, completedFiles: 1, totalFiles: 1, indeterminate: false });
  return { ok: true, versionId, metadata, root: appRoot };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function isVersionInstalled(versionId) {
  const marker = await readJsonIfExists(path.join(versionDirectory(versionId), "installed.json"));
  return Boolean(marker && await fileExists(versionClientPath(versionId)));
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findJava(configuredPath = null) {
  const exeName = process.platform === "win32" ? "java.exe" : "java";
  const candidates = [];
  if (configuredPath) candidates.push(configuredPath);
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, "bin", exeName));
  try {
    const result = await execFileAsync(process.platform === "win32" ? "where.exe" : "which", [exeName]);
    candidates.push(...result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  } catch {
    // A Java executable may still be in one of the common Windows locations.
  }
  if (process.platform === "win32") {
    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
      process.env.ProgramW6332
    ].filter(Boolean);
    for (const root of roots) {
      for (const folder of ["Eclipse Adoptium", "Java", "Microsoft", "Temurin"]) {
        const base = path.join(root, folder);
        try {
          const entries = await fsp.readdir(base, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) candidates.push(path.join(base, entry.name, "bin", exeName));
          }
        } catch {
          // This optional directory does not exist on most machines.
        }
      }
    }
  }
  for (const candidate of [...new Set(candidates)]) {
    if (!(await fileExists(candidate))) continue;
    try {
      const version = await execFileAsync(candidate, ["-version"]);
      const output = `${version.stdout || ""}\n${version.stderr || ""}`;
      const match = output.match(/version "(?:1\.)?(\d+)/i);
      return { path: candidate, major: match ? Number(match[1]) : null, version: output.trim() };
    } catch {
      // Keep looking for a working Java binary.
    }
  }
  return null;
}

function sessionPath() {
  return path.join(path.dirname(appRoot), "auth-session.enc");
}

async function loadSession() {
  if (currentSession) return currentSession;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fsp.readFile(sessionPath(), "utf8");
    currentSession = JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, "base64")));
    return currentSession;
  } catch {
    return null;
  }
}

async function saveSession(session, remember) {
  currentSession = session;
  if (!remember) {
    await fsp.rm(sessionPath(), { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw serviceError("SECURE_STORAGE_UNAVAILABLE", "Windows secure storage is unavailable, so Vanta Launcher will not save this session.");
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(session)).toString("base64");
  await fsp.writeFile(sessionPath(), encrypted, { mode: 0o600 });
}

async function exchangeForMinecraftSession(accessToken, remember, refreshToken, expiresIn) {
  let xbl;
  try {
    xbl = await requestJson(XBOX_USER_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${accessToken}` },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT"
      })
    });
  } catch (error) {
    throw serviceError("XBOX_AUTH_FAILED", "Xbox Live could not authenticate this Microsoft account. Try signing in again.");
  }
  let xsts;
  try {
    xsts = await requestJson(XBOX_XSTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Properties: { SandboxId: "RETAIL", UserTokens: [xbl.Token] }, RelyingParty: "rp://api.minecraftservices.com/", TokenType: "JWT" })
    });
  } catch (error) {
    throw serviceError("XSTS_AUTH_FAILED", "Xbox Live rejected the account token. Check that the Microsoft account can use Xbox services and try again.");
  }
  const user = xsts.DisplayClaims?.xui?.[0];
  if (!user?.uhs || !xsts.Token) throw serviceError("XBOX_AUTH_FAILED", "Xbox Live did not return a usable account token.");
  const minecraft = await requestJson(MINECRAFT_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${user.uhs};${xsts.Token}`, ensureLegacyEnabled: true })
  });
  if (!minecraft.access_token) throw serviceError("MINECRAFT_AUTH_FAILED", "Minecraft Services did not return a game token.");
  const entitlements = await requestJson(MINECRAFT_ENTITLEMENTS_URL, {
    headers: { Authorization: `Bearer ${minecraft.access_token}` }
  });
  if (!Array.isArray(entitlements.items) || entitlements.items.length === 0) {
    throw serviceError("NO_MINECRAFT_ENTITLEMENT", "This Microsoft account does not have a Minecraft Java Edition entitlement.");
  }
  const profile = await requestJson(MINECRAFT_PROFILE_URL, {
    headers: { Authorization: `Bearer ${minecraft.access_token}` }
  });
  if (!profile.id || !profile.name) {
    throw serviceError("NO_MINECRAFT_PROFILE", "This account has no Minecraft Java Edition profile.");
  }
  const session = {
    username: profile.name,
    uuid: profile.id,
    mcAccessToken: minecraft.access_token,
    refreshToken,
    expiresAt: Date.now() + (Number(expiresIn || 86400) * 1000),
    xuid: user.uhs,
    accountType: "msa"
  };
  await saveSession(session, remember);
  return session;
}

async function startMicrosoftLogin() {
  const result = await requestForm(DEVICE_CODE_URL, {
    client_id: MICROSOFT_CLIENT_ID,
    scope: MICROSOFT_SCOPE
  });
  if (!result.ok) throw serviceError("MICROSOFT_DEVICE_CODE_FAILED", result.body.error_description || "Microsoft sign-in could not be started.");
  pendingDeviceAuth = {
    ...result.body,
    nextPollAt: 0
  };
  return {
    ok: true,
    userCode: result.body.user_code,
    verificationUri: result.body.verification_uri || result.body.verification_uri_complete,
    message: result.body.message,
    expiresIn: result.body.expires_in,
    interval: result.body.interval || 5
  };
}

async function pollMicrosoftLogin(remember) {
  if (!pendingDeviceAuth) return { ok: false, status: "idle", message: "No Microsoft sign-in is pending." };
  if (Date.now() < pendingDeviceAuth.nextPollAt) return { ok: false, status: "pending", wait: true };
  const result = await requestForm(TOKEN_URL, {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: MICROSOFT_CLIENT_ID,
    device_code: pendingDeviceAuth.device_code
  });
  if (!result.ok) {
    if (result.body.error === "authorization_pending") {
      pendingDeviceAuth.nextPollAt = Date.now() + (Number(pendingDeviceAuth.interval || 5) * 1000);
      return { ok: false, status: "pending", message: "Waiting for Microsoft sign-in…" };
    }
    if (result.body.error === "slow_down") {
      pendingDeviceAuth.interval = Number(pendingDeviceAuth.interval || 5) + 5;
      pendingDeviceAuth.nextPollAt = Date.now() + (pendingDeviceAuth.interval * 1000);
      return { ok: false, status: "pending", message: "Microsoft asked us to slow down polling…" };
    }
    pendingDeviceAuth = null;
    throw serviceError("MICROSOFT_LOGIN_FAILED", result.body.error_description || "Microsoft sign-in failed.");
  }
  const tokens = result.body;
  pendingDeviceAuth = null;
  const session = await exchangeForMinecraftSession(tokens.access_token, remember, tokens.refresh_token, tokens.expires_in);
  return { ok: true, status: "authenticated", session: sanitizeSession(session) };
}

async function refreshSession(session) {
  if (!session?.refreshToken) return null;
  const result = await requestForm(TOKEN_URL, {
    grant_type: "refresh_token",
    client_id: MICROSOFT_CLIENT_ID,
    scope: MICROSOFT_SCOPE,
    refresh_token: session.refreshToken
  });
  if (!result.ok) return null;
  return exchangeForMinecraftSession(result.body.access_token, true, result.body.refresh_token || session.refreshToken, result.body.expires_in);
}

function sanitizeSession(session) {
  if (!session) return null;
  return { username: session.username, uuid: session.uuid, xuid: session.xuid, accountType: session.accountType, expiresAt: session.expiresAt };
}

async function getSession() {
  let session = await loadSession();
  if (session && session.expiresAt && session.expiresAt < Date.now() + 60_000) {
    session = await refreshSession(session);
  }
  return session ? { ok: true, authenticated: true, session: sanitizeSession(session) } : { ok: true, authenticated: false };
}

async function logout() {
  currentSession = null;
  pendingDeviceAuth = null;
  await fsp.rm(sessionPath(), { force: true });
  return { ok: true };
}

function argumentValues(argument, substitutions) {
  const values = typeof argument === "string"
    ? [argument]
    : argument.value !== undefined
      ? [argument.value]
      : argument.values || [];
  if (typeof argument === "object" && !osRuleAllows(argument.rules, {
    is_demo_user: false,
    has_custom_resolution: false,
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false
  })) return [];
  return values.map((value) => String(value).replace(/\$\{([^}]+)\}/g, (_, key) => substitutions[key] ?? ""));
}

function metadataArguments(metadata, section, substitutions) {
  const args = metadata.arguments?.[section];
  if (Array.isArray(args)) return args.flatMap((argument) => argumentValues(argument, substitutions));
  if (section === "game" && metadata.minecraftArguments) {
    return metadata.minecraftArguments.split(/\s+/).filter(Boolean).map((value) =>
      value.replace(/\$\{([^}]+)\}/g, (_, key) => substitutions[key] ?? "")
    );
  }
  return [];
}

async function ensureNatives(metadata, versionId) {
  const nativesDirectory = path.join(versionDirectory(versionId), "natives");
  await fsp.rm(nativesDirectory, { recursive: true, force: true });
  await fsp.mkdir(nativesDirectory, { recursive: true });
  for (const library of metadata.libraries || []) {
    const classifierName = library.natives?.windows;
    const native = library.downloads?.classifiers?.[classifierName];
    if (!classifierName || !native || !osRuleAllows(library.rules)) continue;
    const zipPath = path.join(appRoot, "libraries", native.path);
    if (await fileExists(zipPath)) {
      try {
        await execFileAsync(process.platform === "win32" ? "tar.exe" : "tar", ["-xf", zipPath, "-C", nativesDirectory]);
      } catch (error) {
        throw serviceError("NATIVE_EXTRACTION_FAILED", `Could not extract the Windows native libraries: ${error.message}`);
      }
    }
  }
  return nativesDirectory;
}

async function launchMinecraft(installation = {}) {
  const versionId = installation.versionId || installation.version || "1.21.1";
  let session = await loadSession();
  if (!session) throw serviceError("NOT_AUTHENTICATED", "Sign in with a Microsoft account before launching Minecraft.");
  if (session.expiresAt && session.expiresAt < Date.now() + 60_000) {
    const refreshed = await refreshSession(session);
    if (!refreshed) throw serviceError("SESSION_EXPIRED", "Your Microsoft session expired. Sign in again before launching.");
    session = refreshed;
  }
  if (activeMinecraftProcess && !activeMinecraftProcess.killed) {
    return { ok: false, code: "ALREADY_RUNNING", message: "Minecraft is already running.", pid: activeMinecraftProcess.pid };
  }

  const installed = await isVersionInstalled(versionId);
  let metadata;
  if (!installed) {
    await installVersion(versionId);
    metadata = JSON.parse(await fsp.readFile(versionMetadataPath(versionId), "utf8"));
  } else {
    metadata = await readJsonIfExists(versionMetadataPath(versionId));
  }
  if (!metadata) throw serviceError("VERSION_METADATA_MISSING", `Metadata for Minecraft ${versionId} is missing.`);
  const configuredJava = await readJsonIfExists(path.join(path.dirname(appRoot), "launcher-config.json"));
  const java = await findJava(configuredJava?.javaPath);
  if (!java) throw serviceError("JAVA_NOT_FOUND", "Java was not found. Install the Java runtime required by this Minecraft version or set its path in Settings.");
  const requiredJava = Number(metadata.javaVersion?.majorVersion || 8);
  if (java.major && java.major < requiredJava) {
    throw serviceError("JAVA_VERSION_TOO_OLD", `Minecraft ${versionId} requires Java ${requiredJava}, but the detected runtime is Java ${java.major}.`);
  }

  const gameDirectory = installation.gameDirectory || appRoot;
  await fsp.mkdir(gameDirectory, { recursive: true });
  const nativesDirectory = await ensureNatives(metadata, versionId);
  const classpath = [];
  for (const library of metadata.libraries || []) {
    if (library.downloads?.artifact && osRuleAllows(library.rules)) classpath.push(libraryFilePath(library));
  }
  classpath.push(versionClientPath(versionId));
  const assetRoot = path.join(appRoot, "assets");
  const substitutions = {
    natives_directory: nativesDirectory,
    launcher_name: "VantaLauncher",
    launcher_version: "0.1.0",
    classpath: classpath.join(path.delimiter),
    library_directory: path.join(appRoot, "libraries"),
    version_name: versionId,
    game_directory: gameDirectory,
    assets_root: assetRoot,
    assets_index_name: metadata.assetIndex?.id || "",
    auth_player_name: session.username,
    auth_uuid: session.uuid,
    auth_access_token: session.mcAccessToken,
    user_type: session.accountType || "msa",
    user_properties: "{}",
    clientid: MICROSOFT_CLIENT_ID,
    auth_xuid: session.xuid || "",
    version_type: metadata.type || "release"
  };
  const jvmArguments = metadataArguments(metadata, "jvm", substitutions);
  const gameArguments = metadataArguments(metadata, "game", substitutions);
  const ram = Math.max(1024, Math.min(32768, Number(installation.ramMb || 4096)));
  const hasMetadataClasspath = jvmArguments.some((value) => value === "-cp" || value === "-classpath");
  const args = [
    `-Xms512M`,
    `-Xmx${ram}M`,
    ...jvmArguments,
    ...(hasMetadataClasspath ? [] : ["-cp", substitutions.classpath]),
    metadata.mainClass,
    ...gameArguments
  ];
  emitProgress({ phase: "launch", label: `Launching Minecraft ${versionId}`, percent: 100, indeterminate: true });
  const child = spawn(java.path, args, {
    cwd: gameDirectory,
    detached: false,
    windowsHide: false,
    stdio: "ignore"
  });
  activeMinecraftProcess = child;
  child.once("error", (error) => {
    emit("launcher:process", { status: "error", message: error.message });
    activeMinecraftProcess = null;
  });
  child.once("exit", (code) => {
    emit("launcher:process", { status: "exited", code });
    activeMinecraftProcess = null;
  });
  emit("launcher:process", { status: "started", pid: child.pid, versionId });
  return { ok: true, pid: child.pid, versionId, javaPath: java.path, gameDirectory };
}

async function getRuntimeState() {
  const config = await readJsonIfExists(path.join(path.dirname(appRoot), "launcher-config.json"));
  const java = await findJava(config?.javaPath);
  return {
    root: appRoot,
    java: java ? { path: java.path, major: java.major, version: java.version } : null,
    session: (await getSession()).session || null
  };
}

async function setJavaPath(javaPath) {
  if (javaPath && !(await fileExists(javaPath))) throw serviceError("JAVA_NOT_FOUND", "The selected Java executable does not exist.");
  const configPath = path.join(path.dirname(appRoot), "launcher-config.json");
  const config = (await readJsonIfExists(configPath)) || {};
  config.javaPath = javaPath || null;
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
  return getRuntimeState();
}

module.exports = {
  configure,
  fetchVersionManifest,
  fetchVersionMetadata,
  installVersion,
  startMicrosoftLogin,
  pollMicrosoftLogin,
  getSession,
  logout,
  launchMinecraft,
  getRuntimeState,
  setJavaPath
};