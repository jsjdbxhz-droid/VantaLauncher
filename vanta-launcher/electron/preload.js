const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vantaDesktop", {
  getPlatform: () => ipcRenderer.invoke("launcher:get-platform"),
  getVersionManifest: () => ipcRenderer.invoke("launcher:get-version-manifest"),
  getVersionMetadata: (versionId) => ipcRenderer.invoke("launcher:get-version-metadata", versionId),
  installVersion: (versionId) => ipcRenderer.invoke("launcher:install-version", versionId),
  startMicrosoftLogin: () => ipcRenderer.invoke("launcher:auth-start"),
  pollMicrosoftLogin: (remember) => ipcRenderer.invoke("launcher:auth-poll", remember),
  getAuthSession: () => ipcRenderer.invoke("launcher:auth-session"),
  logout: () => ipcRenderer.invoke("launcher:auth-logout"),
  getRuntimeState: () => ipcRenderer.invoke("launcher:runtime-state"),
  setJavaPath: (javaPath) => ipcRenderer.invoke("launcher:set-java-path", javaPath),
  chooseJava: () => ipcRenderer.invoke("launcher:choose-java"),
  launchMinecraft: (installation) =>
    ipcRenderer.invoke("launcher:launch-minecraft", installation),
  openFolder: (folderPath) =>
    ipcRenderer.invoke("launcher:open-folder", folderPath),
  openExternal: (url) => ipcRenderer.invoke("launcher:open-external", url),
  onProgress: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("launcher:progress", handler);
    return () => ipcRenderer.removeListener("launcher:progress", handler);
  },
  onProcess: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("launcher:process", handler);
    return () => ipcRenderer.removeListener("launcher:process", handler);
  }
});