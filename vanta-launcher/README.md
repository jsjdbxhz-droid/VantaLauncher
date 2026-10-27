# Vanta Launcher

Vanta Launcher is a standalone Electron desktop application for Windows. It is intentionally separate from the BlazeMC store website. It uses Mojang's official Java Edition metadata/files and Microsoft's official device authentication flow; it does not support cracked or offline authentication.

## Run locally

```bash
npm install
npm start
```

The app opens as an Electron desktop window. The **Preview launcher UI** action on the login screen enters the local UI preview without implementing authentication.

## Package for Windows

```bash
npm run build:win
```

This stages only `electron/`, `src/`, and a production-only `package.json` into a clean temporary directory before electron-builder runs. It creates an x64 NSIS installer in `dist/` named `Vanta Launcher Setup <version>.exe`. The installed executable is named `VantaLauncher.exe`. `npm run build:win:dir` creates an unpacked Windows directory for smoke testing without creating the installer.

The app has no runtime npm dependencies. Electron and electron-builder are development/build dependencies; the packaged app includes the Electron runtime plus every file under `electron/` and `src/` through the explicit `build.files` list.

### Build on Windows

```powershell
cd path\to\vanta-launcher
npm install
npm run build:win
```

The installer will be written to `dist\Vanta Launcher Setup <version>.exe`. Run that installer, launch **VantaLauncher**, sign in through Microsoft, install a Minecraft version, and press **PLAY NOW**. For a faster first smoke test, use:

```powershell
npm run build:win:dir
```

Then open the generated `dist\win-unpacked\VantaLauncher.exe`.

Linux builds request electron-builder's bundled Wine for the NSIS helper step. Some Linux environments cannot run that bundled helper; if NSIS fails, the verified unpacked app remains available and the installer should be built on Windows with the commands above.

## Architecture

- `electron/main.js` — Electron main process, secure window setup, IPC handlers, and future native integrations.
- `electron/preload.js` — minimal context-isolated bridge for desktop-only operations.
- `src/index.html` — renderer entry point.
- `src/styles.css` — lightweight dark gaming UI with Vanta orange and purple accents.
- `src/app.js` — screen rendering, navigation, local app state, mock data, and UI events.
- `src/services.js` — renderer-side contracts for the launcher services.

The service implementation in `electron/minecraft.js` now handles:

1. Official Minecraft version manifest
2. Official version metadata and SHA-1 verified client download
3. SHA-1 verified library download
4. Asset index and asset object download
5. Windows Java runtime detection and configured Java path
6. Encrypted session storage using Electron `safeStorage`
7. Microsoft device login → Xbox Live → XSTS → Minecraft Services exchange
8. Entitlement and profile checks
9. Minecraft launch command construction from official metadata
10. Electron progress and process events

Native libraries are extracted with the `tar` command available on modern Windows installations, keeping the launcher dependency-light.

The PLAY button launches only after a Microsoft account has a Minecraft Java Edition entitlement and profile. The first launch downloads any missing official files, detects a suitable Java runtime, extracts Windows natives, and starts the version's official main class.

## Test the real launcher

### 1. Install dependencies and start the desktop app

```bash
cd vanta-launcher
npm install
npm start
```

Use a Windows machine for the full test. The official launcher files and the encrypted session are stored under Electron's per-user app data directory, inside the `minecraft` and `auth-session.enc` entries respectively.

### 2. Install a Minecraft version

1. Open **Version Manager** from the sidebar.
2. Confirm the list has loaded from Mojang's official `version_manifest_v2.json`.
3. Click **Install** on a release, preferably the current release shown in the list.
4. Watch the progress strip as the launcher downloads the client JAR, libraries, asset index, and assets.
5. When complete, open **Installations** or return to Home. The selected version is the version passed to PLAY.

If the network is interrupted, run the same install again. Existing files are SHA-1 verified and valid files are skipped.

### 3. Log in with Microsoft

1. On the login screen, click **Continue with Microsoft**.
2. Click **Open Microsoft sign-in** in the device-code panel.
3. Enter the displayed code on Microsoft's page and approve the requested sign-in.
4. Vanta Launcher exchanges the result through Xbox Live, XSTS, and Minecraft Services.
5. The launcher checks for a Minecraft Java Edition entitlement and profile before accepting the account.
6. If **Remember this account** is checked, the session is encrypted with Windows-backed Electron `safeStorage`. Tokens are never written to renderer storage or plaintext files.

The public OAuth client ID can be overridden for a registered application with `BLAZE_MICROSOFT_CLIENT_ID`; do not put a client secret in the renderer or source tree.

### 4. Configure and detect Java

1. Open **Settings**.
2. The Java row shows the runtime that Vanta Launcher detects through `JAVA_HOME`, `where java.exe`, or common Windows Java install folders.
3. Use **Browse** to choose a `java.exe` manually if detection finds nothing.
4. Minecraft metadata declares the required Java major version. Launch is blocked with an actionable error if the detected runtime is too old.

### 5. Press PLAY and launch Minecraft

1. Return to **Home**.
2. Ensure the desired version is selected and the Microsoft account is connected.
3. Press **PLAY NOW**.
4. If the version is not fully installed, the same official download pipeline runs first.
5. Vanta Launcher builds the Java command using the official client metadata: JVM arguments, libraries, natives directory, asset index, game directory, authenticated profile, and access token.
6. A successful start shows a launch toast. Minecraft runs as a separate process; closing Vanta Launcher does not terminate it.

Common errors are shown in the launcher: missing Java, Java too old, expired session, failed Microsoft login, no Minecraft entitlement, missing profile, failed download, and checksum mismatch.
