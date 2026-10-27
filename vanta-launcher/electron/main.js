const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const minecraft = require("./minecraft");

const isDevelopment = process.env.NODE_ENV === "development";

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#08080b",
    show: false,
    title: "Vanta Launcher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, "..", "src", "index.html"));
  window.once("ready-to-show", () => window.show());
  minecraft.configure(window, app.getPath("userData"));

  if (isDevelopment) {
    window.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  ipcMain.handle("launcher:get-platform", () => process.platform);
  ipcMain.handle("launcher:get-version-manifest", () => minecraft.fetchVersionManifest());
  ipcMain.handle("launcher:get-version-metadata", (_event, versionId) => minecraft.fetchVersionMetadata(versionId));
  ipcMain.handle("launcher:install-version", (_event, versionId) => minecraft.installVersion(versionId));
  ipcMain.handle("launcher:auth-start", () => minecraft.startMicrosoftLogin());
  ipcMain.handle("launcher:auth-poll", (_event, remember) => minecraft.pollMicrosoftLogin(Boolean(remember)));
  ipcMain.handle("launcher:auth-session", () => minecraft.getSession());
  ipcMain.handle("launcher:auth-logout", () => minecraft.logout());
  ipcMain.handle("launcher:runtime-state", () => minecraft.getRuntimeState());
  ipcMain.handle("launcher:set-java-path", (_event, javaPath) => minecraft.setJavaPath(javaPath));
  ipcMain.handle("launcher:choose-java", async () => {
    const result = await dialog.showOpenDialog({ title: "Choose Java executable", properties: ["openFile"], filters: [{ name: "Java executable", extensions: ["exe"] }] });
    return result.canceled || !result.filePaths[0] ? { canceled: true } : minecraft.setJavaPath(result.filePaths[0]);
  });
  ipcMain.handle("launcher:launch-minecraft", (_event, installation) => minecraft.launchMinecraft(installation));

  ipcMain.handle("launcher:open-folder", async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== "string") return { ok: false };
    const error = await shell.openPath(folderPath);
    return { ok: !error, error: error || null };
  });
  ipcMain.handle("launcher:open-external", async (_event, url) => {
    let hostname = "";
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return { ok: false, error: "Only official Microsoft and Minecraft URLs can be opened." };
    }
    const allowed = hostname === "login.microsoftonline.com" ||
      hostname === "microsoft.com" || hostname.endsWith(".microsoft.com") ||
      hostname === "minecraft.net" || hostname.endsWith(".minecraft.net");
    if (!allowed || !url.toLowerCase().startsWith("https://")) {
      return { ok: false, error: "Only official Microsoft and Minecraft URLs can be opened." };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});