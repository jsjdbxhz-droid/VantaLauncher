export const launcherServices = {
  versionManifest: {
    async getManifest() {
      return window.vantaDesktop.getVersionManifest();
    },
    async getMetadata(versionId) {
      return window.vantaDesktop.getVersionMetadata(versionId);
    }
  },
  versionDownloader: {
    async downloadVersion(versionId) {
      return window.vantaDesktop.installVersion(versionId);
    }
  },
  librariesDownloader: {
    async downloadLibraries(versionId) {
      return window.vantaDesktop.installVersion(versionId);
    }
  },
  assetsDownloader: {
    async downloadAssets(assetIndexId) {
      return window.vantaDesktop.installVersion(assetIndexId);
    }
  },
  javaRuntime: {
    async detect() {
      return window.vantaDesktop.getRuntimeState();
    },
    async install(runtimeVersion) {
      return { ok: false, code: "JAVA_INSTALL_NOT_IMPLEMENTED", runtimeVersion };
    },
    async setPath(javaPath) {
      return window.vantaDesktop.setJavaPath(javaPath);
    }
  },
  installations: {
    async list() {
      return { ok: true, installations: [] };
    },
    async save(installation) {
      return { ok: true, installation };
    }
  },
  microsoftAuth: {
    async signIn() {
      return window.vantaDesktop.startMicrosoftLogin();
    },
    async poll(remember) {
      return window.vantaDesktop.pollMicrosoftLogin(remember);
    },
    async session() {
      return window.vantaDesktop.getAuthSession();
    },
    async signOut() {
      return window.vantaDesktop.logout();
    }
  },
  minecraftLaunch: {
    async launch(installation) {
      return window.vantaDesktop.launchMinecraft(installation);
    }
  }
};