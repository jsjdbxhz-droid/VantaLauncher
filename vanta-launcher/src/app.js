import { launcherServices } from "./services.js";

const state = {
  screen: "splash",
  selectedVersion: "1.21.1",
  selectedInstallation: "BlazeMC 1.21.1",
  rememberAccount: true,
  toast: "",
  user: null,
  auth: null,
  progress: null,
  runtime: null,
  settings: {
    ram: "4096",
    resolution: "1280 × 720",
    language: "English (US)",
    fpsLimit: "120",
    renderDistance: "12 chunks",
    graphics: "Fast",
    particles: "Decreased"
  }
};

let versions = [
  { id: "1.21.1", type: "Vanilla", release: "Sep 2024", stable: true },
  { id: "1.21", type: "Fabric", release: "Jun 2024", stable: true },
  { id: "1.20.6", type: "Forge", release: "Apr 2024", stable: true },
  { id: "1.20.4", type: "NeoForge", release: "Dec 2023", stable: true },
  { id: "1.19.4", type: "Fabric", release: "Mar 2023", stable: false }
];

const navItems = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "versions", label: "Version Manager", icon: "◈" },
  { id: "installations", label: "Installations", icon: "▣" },
  { id: "performance", label: "Performance", icon: "⌁" },
  { id: "news", label: "News", icon: "▤" },
  { id: "status", label: "Server Status", icon: "◉" }
];

const app = document.querySelector("#app");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function icon(name, className = "") {
  const paths = {
    chevron: '<path d="m6 9 6 6 6-6" />',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6" />',
    play: '<path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />',
    check: '<path d="m5 12 4 4L19 6" />',
    plus: '<path d="M12 5v14M5 12h14" />',
    external: '<path d="M14 5h5v5M19 5l-8 8M18 13v5H6V6h5" />',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12a2 2 0 0 1 2-2h.2a2 2 0 0 0 1.4-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 11.4 2h.2a2 2 0 0 1 2 2v.2A2 2 0 0 0 17 5.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a2 2 0 0 0 1.4 3.4h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.8 1.2Z"/>'
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function logo(compact = false) {
  return `<div class="brand ${compact ? "brand--compact" : ""}">
    <span class="brand-mark"><span></span><span></span><span></span></span>
    <span class="brand-copy"><strong>VANTA</strong><small>LAUNCHER</small></span>
  </div>`;
}

function badge(text, tone = "orange") {
  return `<span class="badge badge--${tone}">${escapeHtml(text)}</span>`;
}

function pageHeader(eyebrow, title, description = "") {
  return `<div class="page-header">
    <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ""}</div>
  </div>`;
}

function shell(content) {
  return `<div class="window-shell">
    <aside class="sidebar">
      <div class="sidebar-top">${logo(true)}</div>
      <nav class="main-nav" aria-label="Main navigation">
        <p class="nav-label">LAUNCHER</p>
        ${navItems.map((item) => `<button class="nav-item ${state.screen === item.id ? "is-active" : ""}" data-screen="${item.id}">
          <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
        </button>`).join("")}
        <p class="nav-label nav-label--space">SYSTEM</p>
        <button class="nav-item ${state.screen === "settings" ? "is-active" : ""}" data-screen="settings"><span class="nav-icon">⚙</span><span>Settings</span></button>
        <button class="nav-item ${state.screen === "about" ? "is-active" : ""}" data-screen="about"><span class="nav-icon">?</span><span>About Vanta</span></button>
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-version"><span class="status-dot"></span><span>Launcher ready</span><small>v0.1.0 alpha</small></div>
      </div>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <div class="topbar-title">${logo()}</div>
        <div class="topbar-actions">
          <button class="icon-button" data-screen="settings" aria-label="Open settings">${icon("settings")}</button>
          <div class="top-account">
            <div class="avatar avatar--small">${escapeHtml((state.user?.username || "B").slice(0, 1).toUpperCase())}</div>
            <div><strong>${escapeHtml(state.user?.username || "VantaPlayer")}</strong><span>${state.user ? "Microsoft account" : "Local profile"}</span></div>
            ${icon("chevron", "chevron-icon")}
          </div>
        </div>
      </header>
      <div class="content-scroll">${state.progress?.active ? `<div class="progress-strip"><div class="progress-strip-copy"><span class="progress-spinner"></span><strong data-progress-label>${escapeHtml(state.progress.label || "Working…")}</strong><span data-progress-detail>${escapeHtml(state.progress.detail || "")}</span></div><div class="progress-track"><span data-progress-bar style="width:${state.progress.percent || 0}%"></span></div><span class="progress-percent" data-progress-percent>${state.progress.indeterminate ? "…" : `${state.progress.percent || 0}%`}</span></div>` : ""}${content}</div>
    </main>
  </div>${state.toast ? `<div class="toast">${state.toast}</div>` : ""}`;
}

function renderSplash() {
  return `<div class="splash-screen">
    <div class="splash-glow"></div>
    <div class="splash-content">
      ${logo()}
      <div class="splash-loader"><span></span><span></span><span></span></div>
      <p>Preparing your launcher</p>
      <small>LIGHTWEIGHT. OFFICIAL. YOUR ADVENTURE.</small>
    </div>
    <div class="splash-footer"><span>BlazeMC</span><span>Desktop Edition · Windows</span></div>
  </div>`;
}

function renderLogin() {
  return `<div class="auth-screen">
    <div class="auth-decoration auth-decoration--one"></div><div class="auth-decoration auth-decoration--two"></div>
    <div class="auth-panel">
      ${logo()}
      <div class="auth-copy"><p class="eyebrow">WELCOME TO THE FIRE</p><h1>Ready to play?</h1><p>Sign in with your Microsoft account to access Minecraft Java Edition.</p></div>
      <button class="microsoft-button" data-action="microsoft-login" ${state.auth?.status === "pending" || state.auth?.status === "starting" ? "disabled" : ""}><span class="microsoft-logo"><i></i><i></i><i></i><i></i></span>${state.auth?.status === "starting" ? "Starting Microsoft sign-in…" : "Continue with Microsoft"} ${icon("arrow")}</button>
      <label class="check-row"><input type="checkbox" ${state.rememberAccount ? "checked" : ""} data-action="remember-account"><span class="checkmark"></span><span>Remember this account</span></label>
      ${state.auth ? `<div class="auth-device-card ${state.auth.status === "error" ? "auth-device-card--error" : ""}">
        ${state.auth.status === "pending" ? `<p class="eyebrow">ONE MORE STEP</p><strong>Enter this code at Microsoft</strong><code>${escapeHtml(state.auth.userCode || "…")}</code><button class="outline-button" data-action="open-auth">Open Microsoft sign-in ${icon("external")}</button><small>${escapeHtml(state.auth.message || "Waiting for confirmation…")}</small>` : `<p class="auth-device-message">${escapeHtml(state.auth.message || "")}</p>`}
        ${state.auth.status === "pending" ? `<button class="text-button" data-action="cancel-auth">Cancel sign-in</button>` : ""}
      </div>` : `<p class="auth-note">Vanta Launcher uses official Microsoft authentication.<br>Your credentials never pass through Vanta Launcher.</p>`}
      <div class="auth-divider"><span>or continue as</span></div>
      <button class="ghost-button auth-demo" data-action="demo-login">Preview launcher UI <span>→</span></button>
    </div>
    <div class="auth-footer"><span>Vanta Launcher Alpha</span><span>Privacy &amp; Security</span></div>
  </div>`;
}

function renderHome() {
  return shell(`<div class="home-page">
    <section class="hero-card">
      <div class="hero-copy"><p class="eyebrow">WELCOME BACK, VANTAPLAYER</p><h1>Make your mark.</h1><p>Everything you need to jump into your next Minecraft adventure.</p>
        <div class="hero-actions"><button class="primary-button primary-button--large" data-action="play">${icon("play")} PLAY NOW</button><button class="ghost-button" data-screen="installations">Manage installations ${icon("arrow")}</button></div>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="orb orb--orange"></div><div class="orb orb--purple"></div><div class="block block--one"></div><div class="block block--two"></div><div class="block block--three"></div><div class="hero-spark">✦</div></div>
      <div class="hero-bottom"><span>Selected installation</span><button class="select-button" data-screen="installations">${escapeHtml(state.selectedInstallation)} ${icon("chevron")}</button><span class="hero-divider"></span><span class="java-label">JAVA</span><strong>${state.runtime?.java?.major ? `Java ${state.runtime.java.major}` : "Detecting…"}</strong></div>
    </section>
    <div class="dashboard-grid">
      <section class="dashboard-card profile-card"><div class="card-heading"><span class="card-kicker">PLAYER PROFILE</span><button class="text-button" data-screen="settings">Edit ${icon("arrow")}</button></div><div class="profile-content"><div class="avatar avatar--large">${escapeHtml((state.user?.username || "B").slice(0, 1).toUpperCase())}</div><div><h2>${escapeHtml(state.user?.username || "VantaPlayer")}</h2><p>${state.user ? "Microsoft account connected" : "Local preview profile"}</p><div class="profile-meta">${badge("JAVA EDITION", "purple")}<span>${state.user ? "Official account" : "Sign in to launch"}</span></div></div></div></section>
      <section class="dashboard-card status-card"><div class="card-heading"><span class="card-kicker">SERVER STATUS</span><button class="status-online" data-screen="status"><span class="status-dot"></span>All systems operational</button></div><div class="status-main"><div class="server-icon">B<span>MC</span></div><div><h2>BlazeMC Network</h2><p>play.blazemc.net</p></div><strong class="online-count">1,284 <small>players online</small></strong></div></section>
    </div>
    <section class="section-block"><div class="section-heading"><div><p class="eyebrow">FROM THE COMMUNITY</p><h2>Latest news</h2></div><button class="text-button" data-screen="news">View all ${icon("arrow")}</button></div><div class="news-grid">${newsCards().slice(0, 3).join("")}</div></section>
  </div>`);
}

function newsCards() {
  return [
    { tag: "BLAZEMC", date: "SEP 24, 2024", title: "Welcome to the new BlazeMC season", copy: "Fresh worlds, new quests, and a community ready for your next build.", color: "orange" },
    { tag: "MINECRAFT", date: "SEP 18, 2024", title: "Minecraft Java 1.21.1 is now available", copy: "Update your installation and explore the latest stability improvements.", color: "purple" },
    { tag: "VANTA TIPS", date: "SEP 12, 2024", title: "Get more FPS on any setup", copy: "Our low-end performance presets help you spend less time tweaking.", color: "blue" }
  ].map((card) => `<article class="news-card"><div class="news-thumb news-thumb--${card.color}"><span>${card.tag}</span><b>✦</b></div><div class="news-card-body"><div class="news-meta"><span>${card.tag}</span><span>${card.date}</span></div><h3>${card.title}</h3><p>${card.copy}</p><button class="text-button">Read story ${icon("arrow")}</button></div></article>`);
}

function renderVersions() {
  return shell(`<div class="page">${pageHeader("GAME LIBRARY", "Version manager", "Choose a Minecraft version and mod loader for your next installation.")}<div class="toolbar"><div class="search-box"><span>⌕</span><input placeholder="Search versions" aria-label="Search versions"></div><div class="filter-tabs"><button class="filter-tab is-active">All</button><button class="filter-tab">Vanilla</button><button class="filter-tab">Modded</button></div></div><section class="panel"><div class="table-head"><span>VERSION</span><span>LOADER</span><span>RELEASED</span><span>STATUS</span><span></span></div>${versions.map((version) => `<div class="version-row"><div class="version-name"><span class="version-cube">${version.type === "Vanilla" ? "◆" : "◇"}</span><div><strong>Minecraft ${version.id}</strong><small>${version.stable ? "Recommended for most players" : "Legacy version"}</small></div></div><div>${badge(version.type, version.type === "Vanilla" ? "orange" : "purple")}</div><div class="muted">${version.release}</div><div>${version.stable ? `<span class="row-status"><span class="status-dot"></span>Official</span>` : `<span class="muted">Legacy</span>`}</div><button class="outline-button" data-action="install-version" data-version="${version.id}">Install ${icon("plus")}</button></div>`).join("")}</section><div class="info-callout">${icon("external")} <span>Versions and metadata are retrieved from Mojang's official Java Edition manifest.</span></div></div>`);
}

function renderInstallations() {
  return shell(`<div class="page">${pageHeader("YOUR PROFILES", "Installation manager", "Create dedicated profiles for vanilla, modded, and experimental play.")}<div class="install-layout"><section class="panel install-list"><div class="panel-heading"><div><h2>My installations</h2><p>3 profiles configured</p></div><button class="primary-button" data-action="create-installation">${icon("plus")} New installation</button></div>${[
    { name: "BlazeMC 1.21.1", version: "Minecraft 1.21.1 · Vanilla", last: "Played 2 hours ago", active: true },
    { name: "Fabric Performance", version: "Minecraft 1.21 · Fabric", last: "Played yesterday", active: false },
    { name: "Creative Lab", version: "Minecraft 1.20.6 · Forge", last: "Never played", active: false }
  ].map((installation) => `<button class="installation-row ${installation.active ? "is-selected" : ""}" data-action="select-installation" data-installation="${installation.name}"><span class="installation-icon">${installation.active ? "✦" : "◆"}</span><span class="installation-details"><strong>${installation.name}</strong><small>${installation.version}</small><small>${installation.last}</small></span>${installation.active ? badge("ACTIVE", "orange") : ""}${icon("chevron")}</button>`).join("")}</section><section class="panel config-panel"><div class="panel-heading"><div><p class="card-kicker">CONFIGURATION</p><h2>Create installation</h2></div><span class="draft-pill">DRAFT</span></div><div class="form-stack"><label class="field"><span>Installation name</span><input value="BlazeMC 1.21.1"></label><label class="field"><span>Minecraft version</span><select><option>1.21.1 — Latest release</option><option>1.21 — Release</option><option>1.20.6 — Release</option></select></label><label class="field"><span>Mod loader</span><select><option>Vanilla</option><option>Fabric</option><option>Forge</option><option>NeoForge</option></select></label><label class="field"><span>Game directory</span><div class="input-with-button"><input value="C:\\Users\\BlazePlayer\\AppData\\Roaming\\.minecraft"><button class="square-button">…</button></div></label><div class="form-row"><label class="field"><span>Java runtime</span><select><option>Java 21 (Recommended)</option><option>Auto-detect</option></select></label><label class="field"><span>Memory allocation</span><select><option>4 GB</option><option>6 GB</option><option>8 GB</option></select></label></div></div><div class="config-actions"><button class="ghost-button">Reset</button><button class="primary-button" data-action="save-installation">Save installation ${icon("check")}</button></div></section></div></div>`);
}

function renderSettings() {
  return shell(`<div class="page">${pageHeader("LAUNCHER PREFERENCES", "Settings", "Tune Vanta Launcher to your setup. Changes are saved locally on this device.")}<div class="settings-layout"><aside class="settings-nav"><button class="settings-tab is-active">General</button><button class="settings-tab" data-screen="performance">Performance</button><button class="settings-tab">Game</button><button class="settings-tab">Account</button><button class="settings-tab">About</button></aside><section class="panel settings-panel"><div class="settings-section"><div class="settings-heading"><div><h2>Launcher</h2><p>Basic app preferences</p></div></div><div class="settings-row"><div><strong>Language</strong><small>Choose the launcher language</small></div><select data-setting="language"><option>English (US)</option><option>Français</option><option>Deutsch</option><option>Español</option></select></div><div class="settings-row"><div><strong>Launcher resolution</strong><small>Window size at startup</small></div><select data-setting="resolution"><option>1280 × 720</option><option>1440 × 900</option><option>1920 × 1080</option></select></div><div class="settings-row"><div><strong>Start with Windows</strong><small>Open Vanta Launcher when you sign in</small></div><label class="toggle"><input type="checkbox"><span></span></label></div></div><div class="settings-section"><div class="settings-heading"><div><h2>Minecraft</h2><p>Default game paths and runtime</p></div></div><div class="settings-row"><div><strong>Java path</strong><small>Runtime used to launch Minecraft</small></div><div class="path-control"><span>${escapeHtml(state.runtime?.java?.path || "Auto-detected")}</span><button class="outline-button" data-action="browse-java">Browse</button></div></div><div class="settings-row"><div><strong>Game directory</strong><small>Where worlds, saves, and assets live</small></div><div class="path-control"><span>...\\.minecraft</span><button class="outline-button">Browse</button></div></div><div class="settings-row"><div><strong>Default RAM</strong><small>Memory allocated to new installations</small></div><div class="range-value"><input type="range" min="1" max="16" value="${state.settings.ram / 1024}" data-setting="ram-range"><strong>${state.settings.ram} MB</strong></div></div></div><div class="save-bar"><span>Settings are stored locally</span><button class="primary-button" data-action="save-settings">Save changes ${icon("check")}</button></div></section></div></div>`);
}

function renderPerformance() {
  const setting = (label, copy, key, options) => `<div class="settings-row"><div><strong>${label}</strong><small>${copy}</small></div><select data-setting="${key}">${options.map((option) => `<option ${state.settings[key] === option ? "selected" : ""}>${option}</option>`).join("")}</select></div>`;
  return shell(`<div class="page">${pageHeader("OPTIMIZE YOUR GAME", "Performance", "Choose a preset, then fine-tune the settings that matter to your setup.")}<section class="preset-grid">${[
    ["Potato", "Maximum FPS", "For very low-end PCs", "potato"],
    ["Low-End", "Smooth gameplay", "Recommended for older PCs", "low"],
    ["Balanced", "Quality + FPS", "A little bit of everything", "balanced"],
    ["High", "Maximum quality", "For powerful PCs", "high"]
  ].map((preset, index) => `<button class="preset-card ${index === 1 ? "is-selected" : ""}" data-action="preset" data-preset="${preset[0]}"><span class="preset-icon preset-icon--${preset[3]}">${index === 0 ? "▰" : index === 1 ? "▥" : index === 2 ? "◆" : "✦"}</span><strong>${preset[0]}</strong><small>${preset[1]}</small><em>${preset[2]}</em>${index === 1 ? `<span class="preset-check">${icon("check")}</span>` : ""}</button>`).join("")}</section><section class="panel performance-panel"><div class="panel-heading"><div><h2>Advanced settings</h2><p>These settings apply to the selected installation.</p></div><button class="text-button" data-action="reset-performance">Reset to preset</button></div>${setting("FPS limit", "Cap the maximum frames per second", "fpsLimit", ["60", "120", "144", "Unlimited"])}${setting("Render distance", "How far the world renders around you", "renderDistance", ["8 chunks", "12 chunks", "16 chunks", "24 chunks"])}${setting("Graphics", "Visual quality of blocks and effects", "graphics", ["Fast", "Fancy", "Fabulous"])}${setting("Particles", "Amount of gameplay particles", "particles", ["Minimal", "Decreased", "All"])}<div class="performance-tip"><span>✦</span><div><strong>Vanta recommendation</strong><p>Low-End is a good starting point for stable FPS without making your world feel empty.</p></div></div></section></div>`);
}

function renderNews() {
  return shell(`<div class="page">${pageHeader("KEEP UP WITH VANTA", "News", "Updates, guides, and stories from the BlazeMC community.")}<div class="news-filter"><button class="filter-tab is-active">All news</button><button class="filter-tab">BlazeMC</button><button class="filter-tab">Minecraft</button><button class="filter-tab">Guides</button></div><div class="news-list">${newsCards().map((card, index) => `<article class="news-list-item"><div class="news-thumb news-thumb--${card.color}"><span>${index === 0 ? "NEW" : "VANTA"}</span><b>✦</b></div><div class="news-list-copy"><div class="news-meta"><span>${card.tag}</span><span>${card.date}</span></div><h2>${card.title}</h2><p>${card.copy}</p><button class="text-button">Read story ${icon("arrow")}</button></div></article>`).join("")}</div></div>`);
}

function renderStatus() {
  return shell(`<div class="page">${pageHeader("BLAZEMC NETWORK", "Server status", "Live service health for the BlazeMC network.")}<section class="status-banner"><div class="status-banner-icon"><span class="status-dot status-dot--large"></span></div><div><p class="eyebrow">ALL SYSTEMS OPERATIONAL</p><h2>BlazeMC is online</h2><p>All services are responding normally.</p></div><div class="status-updated">Updated just now</div></section><div class="status-grid"><section class="panel"><div class="panel-heading"><div><h2>Services</h2><p>Current network health</p></div></div>${[["Minecraft Java servers", "Online", "1,284 players"], ["Authentication", "Online", "Operational"], ["Website &amp; store", "Online", "Operational"], ["Community Discord", "Online", "Connected"]].map((item) => `<div class="service-row"><span class="status-dot"></span><div><strong>${item[0]}</strong><small>${item[2]}</small></div><span class="service-state">${item[1]}</span></div>`).join("")}</section><section class="panel player-chart"><div class="panel-heading"><div><h2>Players online</h2><p>Across the network</p></div><strong class="chart-total">1,284</strong></div><div class="chart"><div class="chart-line"></div><div class="chart-labels"><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>Now</span></div></div></section></div></div>`);
}

function renderAbout() {
  return shell(`<div class="page about-page">${pageHeader("THE VANTA PROMISE", "About Vanta Launcher", "A focused, lightweight way to play Minecraft Java Edition.")}<section class="about-hero"><div class="about-mark">${logo()}</div><p>Vanta Launcher is being built for players who want fewer distractions between opening the launcher and joining their world.</p><div class="about-links"><button class="outline-button">BlazeMC website ${icon("external")}</button><button class="outline-button">Community Discord ${icon("external")}</button></div></section><div class="about-grid"><section class="panel"><span class="about-number">01</span><h2>Official by design</h2><p>Microsoft authentication and licensed Minecraft installs are the foundation. No cracked accounts, no bypasses, no shortcuts.</p></section><section class="panel"><span class="about-number">02</span><h2>Light on your PC</h2><p>The launcher keeps its interface fast and its resource use low, so your hardware can focus on the game.</p></section><section class="panel"><span class="about-number">03</span><h2>Made for BlazeMC</h2><p>Quick access to the network, useful performance defaults, and a launcher that feels like it belongs to the community.</p></section></div><div class="about-footer"><span>Vanta Launcher</span><span>Version 0.1.0 alpha</span><span>© 2024 BlazeMC</span></div></div>`);
}

function render() {
  const views = { splash: renderSplash, login: renderLogin, home: renderHome, versions: renderVersions, installations: renderInstallations, settings: renderSettings, performance: renderPerformance, news: renderNews, status: renderStatus, about: renderAbout };
  app.innerHTML = views[state.screen]();
  bindEvents();
}

function showToast(message) {
  state.toast = message;
  render();
  window.setTimeout(() => {
    if (state.toast === message) {
      state.toast = "";
      render();
    }
  }, 3400);
}

async function handlePlay() {
  try {
    const result = await launcherServices.minecraftLaunch.launch({
      name: state.selectedInstallation,
      versionId: state.selectedVersion,
      ramMb: state.settings.ram
    });
    showToast(result.ok ? `Minecraft ${result.versionId} started.` : (result.message || "Minecraft could not be started."));
  } catch (error) {
    showToast(error.message || "Minecraft could not be started.");
  }
}

function bindEvents() {
  document.querySelectorAll("[data-screen]").forEach((element) => {
    element.addEventListener("click", () => {
      state.screen = element.dataset.screen;
      state.toast = "";
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", async () => {
      const action = element.dataset.action;
      if (action === "microsoft-login") {
        state.auth = { status: "starting", message: "Contacting Microsoft securely…" };
        render();
        try {
          const result = await launcherServices.microsoftAuth.signIn();
          state.auth = { ...result, status: "pending" };
          render();
          pollMicrosoftAuth(result.interval || 5);
        } catch (error) {
          state.auth = { status: "error", message: error.message || "Microsoft sign-in could not be started." };
          render();
        }
      } else if (action === "open-auth") {
        await window.vantaDesktop.openExternal(state.auth?.verificationUri);
      } else if (action === "cancel-auth") {
        state.auth = null;
        render();
      } else if (action === "demo-login") {
        state.screen = "home";
        render();
      } else if (action === "remember-account") {
        state.rememberAccount = element.checked;
      } else if (action === "play") {
        await handlePlay();
      } else if (action === "install-version") {
        await handleInstall(element.dataset.version);
      } else if (action === "create-installation") {
        showToast("A new installation draft is ready to configure.");
      } else if (action === "select-installation") {
        state.selectedInstallation = element.dataset.installation;
        render();
      } else if (action === "save-installation") {
        showToast("Installation saved locally. Official files download when you install or press PLAY.");
      } else if (action === "save-settings") {
        showToast("Settings saved locally.");
      } else if (action === "browse-java") {
        try {
          const runtime = await window.vantaDesktop.chooseJava();
          if (!runtime.canceled) {
            state.runtime = runtime;
            render();
            showToast("Java runtime path saved.");
          }
        } catch (error) {
          showToast(error.message || "Java runtime could not be saved.");
        }
      } else if (action === "preset") {
        document.querySelectorAll(".preset-card").forEach((card) => card.classList.remove("is-selected"));
        element.classList.add("is-selected");
      } else if (action === "reset-performance") {
        state.settings = { ...state.settings, fpsLimit: "120", renderDistance: "12 chunks", graphics: "Fast", particles: "Decreased" };
        render();
      }
    });
  });

  document.querySelectorAll("[data-setting]").forEach((element) => {
    element.addEventListener("change", () => {
      const setting = element.dataset.setting;
      state.settings[setting] = element.value;
      if (setting === "ram-range") state.settings.ram = String(Number(element.value) * 1024);
      if (setting === "ram-range") render();
    });
  });

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      tab.parentElement.querySelectorAll(".filter-tab").forEach((item) => item.classList.remove("is-active"));
      tab.classList.add("is-active");
    });
  });
}

async function pollMicrosoftAuth(intervalSeconds) {
  await new Promise((resolve) => window.setTimeout(resolve, Math.max(2, intervalSeconds) * 1000));
  if (!state.auth || state.auth.status !== "pending") return;
  try {
    const result = await launcherServices.microsoftAuth.poll(state.rememberAccount);
    if (result.status === "authenticated") {
      state.user = result.session;
      state.auth = null;
      state.screen = "home";
      render();
      showToast(`Signed in as ${result.session.username}.`);
      return;
    }
    state.auth.message = result.message || "Waiting for Microsoft sign-in…";
    render();
    pollMicrosoftAuth(intervalSeconds);
  } catch (error) {
    state.auth = { status: "error", message: error.message || "Microsoft sign-in failed." };
    render();
  }
}

async function handleInstall(versionId) {
  state.selectedVersion = versionId;
  state.progress = { active: true, label: `Preparing Minecraft ${versionId}`, percent: 0 };
  state.screen = "versions";
  render();
  try {
    await launcherServices.versionDownloader.downloadVersion(versionId);
    state.progress = null;
    state.screen = "installations";
    render();
    showToast(`Minecraft ${versionId} installed and ready to launch.`);
  } catch (error) {
    state.progress = null;
    render();
    showToast(error.message || `Minecraft ${versionId} could not be installed.`);
  }
}

function updateProgress(progress) {
  state.progress = { active: true, ...progress };
  const label = document.querySelector("[data-progress-label]");
  const detail = document.querySelector("[data-progress-detail]");
  const bar = document.querySelector("[data-progress-bar]");
  const percent = document.querySelector("[data-progress-percent]");
  if (!label || !bar || !percent) return;
  label.textContent = progress.label || "Working…";
  if (detail) detail.textContent = progress.currentFile || "";
  bar.style.width = `${progress.percent || 0}%`;
  percent.textContent = progress.indeterminate ? "…" : `${progress.percent || 0}%`;
}

render();
window.vantaDesktop?.onProgress(updateProgress);
window.vantaDesktop?.onProcess((processState) => {
  if (processState.status === "started") {
    state.progress = null;
    render();
    showToast(`Minecraft ${processState.versionId} is launching.`);
  } else if (processState.status === "error") {
    state.progress = null;
    render();
    showToast(processState.message || "Minecraft stopped unexpectedly.");
  }
});

async function initialize() {
  try {
    const session = await launcherServices.microsoftAuth.session();
    if (session.authenticated) state.user = session.session;
  } catch {
    // Keep the login screen usable if the saved session cannot be read.
  }
  try {
    const manifest = await launcherServices.versionManifest.getManifest();
    versions = manifest.versions.slice(0, 40).map((version) => ({
      id: version.id,
      type: version.type === "release" ? "Vanilla" : version.type,
      release: new Date(version.releaseTime).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      stable: version.type === "release"
    }));
  } catch {
    // Keep the small local fallback list when offline.
  }
  try {
    state.runtime = await launcherServices.javaRuntime.detect();
  } catch {
    state.runtime = null;
  }
  state.screen = state.user ? "home" : "login";
  render();
}

window.setTimeout(initialize, 1600);