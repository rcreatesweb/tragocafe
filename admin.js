(function () {
  "use strict";

  const Config = window.BTKCoffeeConfig;
  const Data = window.BTKCoffeeData;
  const AUTH_CREDENTIAL_KEY = "btk-coffee-admin-prototype-credential-v1";
  const AUTH_SESSION_KEY = "btk-coffee-admin-prototype-session-v1";
  const LOGIN_ATTEMPT_KEY = "btk-coffee-admin-prototype-attempts-v1";
  const USERNAME = "superadmin";
  const ITERATIONS = 210000;
  const SESSION_LENGTH_MS = 30 * 60 * 1000;
  const LOCKOUT_MS = 60 * 1000;
  const MAX_ATTEMPTS = 5;
  const MAX_UPLOAD_BYTES = 180 * 1024;
  const MAX_PRICE_CENTS = 99999900;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = {
    saved: null,
    draft: null,
    activeSection: "overview",
    filterCategory: "All",
    dialogDirty: false,
    menuAddOnFormInvalid: false,
    contentFormInvalid: false,
    imageErrors: [],
    github: { owner: "", repo: "", branch: "main", token: "", configSha: "", configExists: false, configLoaded: false, lastCommitSha: "" },
    githubPendingFiles: new WeakMap(),
    githubPreviewUrls: new Set()
  };

  const PALETTE_FIELDS = [
    ["primary", "Primary brand color"],
    ["secondary", "Secondary brand color"],
    ["background", "Website background"],
    ["surface", "Card and surface"],
    ["heading", "Heading color"],
    ["text", "Body text color"],
    ["muted", "Muted text color"],
    ["buttonBg", "Primary button background"],
    ["buttonText", "Primary button text"],
    ["buttonHover", "Button hover color"],
    ["border", "Border color"],
    ["accent", "Accent color"]
  ];

  function safeStorageGet(storageName, key) {
    try { return window[storageName].getItem(key); } catch (_error) { return null; }
  }

  function safeStorageSet(storageName, key, value) {
    try { window[storageName].setItem(key, value); return true; } catch (_error) { return false; }
  }

  function safeStorageRemove(storageName, key) {
    try { window[storageName].removeItem(key); } catch (_error) { /* Browser storage may be unavailable. */ }
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function moneyFromCents(cents) {
    if (!Number.isSafeInteger(cents) || cents < 0) return "₱0";
    const amount = cents / 100;
    return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  }

  function pesosInput(cents) {
    if (!Number.isSafeInteger(cents) || cents < 0) return "";
    return (cents / 100).toFixed(2).replace(/\.00$/, "");
  }

  function parsePesos(value, allowEmpty) {
    const text = String(value == null ? "" : value).trim();
    if (!text && allowEmpty) return { ok: true, cents: 0 };
    if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) return { ok: false, error: "Enter a non-negative peso amount with up to two decimal places." };
    const amount = Number(text);
    const cents = Math.round(amount * 100);
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) return { ok: false, error: "Enter a price within the supported range." };
    return { ok: true, cents };
  }

  function updateMessage(element, message, isSuccess) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-success", Boolean(message && isSuccess));
    element.classList.toggle("is-error", Boolean(message && !isSuccess));
  }

  function toast(message, type) {
    const stack = $("#adminToastStack");
    if (!stack) return;
    const node = document.createElement("div");
    node.className = `admin-toast${type ? ` is-${type}` : ""}`;
    node.setAttribute("role", type === "error" ? "alert" : "status");
    node.textContent = message;
    stack.appendChild(node);
    window.setTimeout(() => node.remove(), 4600);
  }

  function parseJSON(value) {
    try { return JSON.parse(value); } catch (_error) { return null; }
  }

  function getCredential() {
    const raw = safeStorageGet("localStorage", AUTH_CREDENTIAL_KEY);
    if (!raw) return { missing: true, credential: null };
    const value = parseJSON(raw);
    if (!value || value.version !== 1 || typeof value.salt !== "string" || typeof value.hash !== "string" || !Number.isInteger(value.iterations) || value.iterations < 100000 || value.iterations > 1000000) {
      return { missing: false, corrupted: true, credential: null };
    }
    return { missing: false, corrupted: false, credential: value };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return window.btoa(binary);
  }

  function base64ToBytes(text) {
    const binary = window.atob(text);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function derivePasswordHash(password, saltText, iterations) {
    if (!window.crypto || !window.crypto.subtle) throw new Error("Secure browser crypto is unavailable. Open this site on HTTPS or localhost.");
    const encoder = new TextEncoder();
    const material = await window.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await window.crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64ToBytes(saltText), iterations, hash: "SHA-256" }, material, 256);
    return bytesToBase64(new Uint8Array(bits));
  }

  async function makeCredential(password) {
    if (!window.crypto || !window.crypto.getRandomValues) throw new Error("Secure browser crypto is unavailable. Open this site on HTTPS or localhost.");
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    const saltText = bytesToBase64(salt);
    const hash = await derivePasswordHash(password, saltText, ITERATIONS);
    return { version: 1, salt: saltText, hash, iterations: ITERATIONS, username: USERNAME };
  }

  function passwordPolicy(password) {
    if (password.length > 128) return "Use no more than 128 characters.";
    if (password.length < 12) return "Use at least 12 characters.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
    return "";
  }

  function makeSession() {
    const issuedAt = Date.now();
    const session = { username: USERNAME, issuedAt, expiresAt: issuedAt + SESSION_LENGTH_MS };
    if (!safeStorageSet("sessionStorage", AUTH_SESSION_KEY, JSON.stringify(session))) return false;
    return true;
  }

  function readValidSession() {
    const session = parseJSON(safeStorageGet("sessionStorage", AUTH_SESSION_KEY) || "null");
    if (!session || session.username !== USERNAME || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      safeStorageRemove("sessionStorage", AUTH_SESSION_KEY);
      return null;
    }
    return session;
  }

  function sessionActivity() {
    const session = readValidSession();
    if (!session) return;
    if (session.expiresAt - Date.now() < SESSION_LENGTH_MS - 60000) {
      session.expiresAt = Date.now() + SESSION_LENGTH_MS;
      safeStorageSet("sessionStorage", AUTH_SESSION_KEY, JSON.stringify(session));
    }
  }

  function loginAttemptState() {
    const record = parseJSON(safeStorageGet("sessionStorage", LOGIN_ATTEMPT_KEY) || "null");
    return record && Number.isInteger(record.count) && Number.isFinite(record.until) ? record : { count: 0, until: 0 };
  }

  function recordFailedAttempt() {
    const current = loginAttemptState();
    const count = current.until > Date.now() ? current.count : current.count + 1;
    const record = count >= MAX_ATTEMPTS ? { count: 0, until: Date.now() + LOCKOUT_MS } : { count, until: 0 };
    safeStorageSet("sessionStorage", LOGIN_ATTEMPT_KEY, JSON.stringify(record));
    return record;
  }

  function clearFailedAttempts() {
    safeStorageRemove("sessionStorage", LOGIN_ATTEMPT_KEY);
  }

  function updateCooldown() {
    const record = loginAttemptState();
    const remaining = record.until - Date.now();
    const button = $("#loginSubmitButton");
    const message = $("#cooldownMessage");
    if (remaining > 0) {
      if (button) button.disabled = true;
      if (message) message.textContent = `Try again in ${Math.ceil(remaining / 1000)} seconds.`;
    } else {
      if (button) button.disabled = false;
      if (message) message.textContent = "";
      if (record.until) clearFailedAttempts();
    }
  }

  function showLoginMode() {
    const root = $("#adminLoginRoot");
    if (!root) return;
    const auth = getCredential();
    const form = $("#adminLoginForm");
    const message = $("#loginMessage");
    const confirmField = $("#setupConfirmField");
    const policy = $("#setupPasswordPolicy");
    const button = $("#loginSubmitButton");
    const title = $("#authTitle");
    const intro = $("#authIntro");
    const password = $("#adminPassword");
    const passwordLabel = $("#adminPasswordLabel");
    if (auth.corrupted) {
      title.textContent = "Prototype login unavailable";
      intro.textContent = "The saved browser-local prototype credential could not be read.";
      updateMessage(message, "The local prototype credential is invalid. Clear this site's browser storage to initialize it again. This does not reset a real account.", false);
      button.disabled = true;
      return;
    }
    if (auth.missing) {
      form.dataset.mode = "setup";
      title.textContent = "Set up this browser";
      intro.textContent = "Create a local prototype password for the fixed superadmin username on this browser.";
      confirmField.hidden = false;
      policy.hidden = false;
      passwordLabel.textContent = "Create prototype password";
      password.autocomplete = "new-password";
      button.textContent = "Set Password and Continue";
      updateMessage(message, "This first-run setup is local to this browser and is not secure authentication.", false);
    } else {
      form.dataset.mode = "login";
      title.textContent = "Superadmin login";
      intro.textContent = "Sign in to manage the BTK Coffee website configuration.";
      confirmField.hidden = true;
      policy.hidden = true;
      passwordLabel.textContent = "Password";
      password.autocomplete = "current-password";
      button.textContent = "Log in";
      updateMessage(message, "", false);
    }
    updateCooldown();
  }

  function redirectToDashboard() {
    if (!makeSession()) {
      updateMessage($("#loginMessage"), "This browser could not start a local session. Check that session storage is enabled and try again.", false);
      return;
    }
    clearFailedAttempts();
    window.location.replace("./admin.html#dashboard");
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const message = $("#loginMessage");
    const form = $("#adminLoginForm");
    const username = $("#adminUsername").value.trim();
    const password = $("#adminPassword").value;
    const mode = form.dataset.mode;
    const auth = getCredential();
    if (loginAttemptState().until > Date.now()) {
      updateCooldown();
      return;
    }
    if (username !== USERNAME || !password) {
      if (mode === "setup") updateMessage(message, "Enter a password to initialize this browser's prototype login.", false);
      else {
        recordFailedAttempt();
        updateMessage(message, "Unable to sign in. Check your credentials and try again.", false);
        updateCooldown();
      }
      return;
    }

    const submit = $("#loginSubmitButton");
    submit.disabled = true;
    if (mode === "setup") {
      const confirm = $("#setupPasswordConfirm").value;
      const policyMessage = passwordPolicy(password);
      if (policyMessage) {
        submit.disabled = false;
        updateMessage(message, policyMessage, false);
        $("#adminPassword").focus();
        return;
      }
      if (password !== confirm) {
        submit.disabled = false;
        updateMessage(message, "The passwords do not match.", false);
        $("#setupPasswordConfirm").focus();
        return;
      }
      if (!auth.missing) {
        submit.disabled = false;
        showLoginMode();
        updateMessage(message, "This browser already has a prototype credential. Sign in instead.", false);
        return;
      }
      try {
        const credential = await makeCredential(password);
        if (!safeStorageSet("localStorage", AUTH_CREDENTIAL_KEY, JSON.stringify(credential))) throw new Error("This browser could not save the prototype credential. Check local storage access.");
        passwordInputCleanup();
        redirectToDashboard();
      } catch (error) {
        submit.disabled = false;
        updateMessage(message, error instanceof Error ? error.message : "The prototype password could not be set in this browser.", false);
      }
      return;
    }

    if (!auth.credential) {
      submit.disabled = false;
      showLoginMode();
      return;
    }
    try {
      const submittedHash = await derivePasswordHash(password, auth.credential.salt, auth.credential.iterations);
      if (username !== USERNAME || submittedHash !== auth.credential.hash) {
        recordFailedAttempt();
        updateMessage(message, "Unable to sign in. Check your credentials and try again.", false);
        updateCooldown();
        submit.disabled = loginAttemptState().until > Date.now();
        return;
      }
      passwordInputCleanup();
      redirectToDashboard();
    } catch (error) {
      submit.disabled = false;
      updateMessage(message, error instanceof Error ? error.message : "Unable to sign in. Check your credentials and try again.", false);
    }
  }

  function passwordInputCleanup() {
    ["#adminPassword", "#setupPasswordConfirm"].forEach((selector) => {
      const input = $(selector);
      if (input) input.value = "";
    });
  }

  function bindPasswordVisibility(root) {
    $$('[data-password-toggle]', root).forEach((button) => {
      button.addEventListener("click", () => {
        const input = $(`#${button.dataset.passwordToggle}`, root);
        if (!input) return;
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.textContent = reveal ? "Hide" : "Show";
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
        input.focus();
      });
    });
  }

  function installLoginPage() {
    if (!$("#adminLoginRoot")) return false;
    showLoginMode();
    $("#adminLoginForm").addEventListener("submit", handleLoginSubmit);
    bindPasswordVisibility($("#adminLoginRoot"));
    window.setInterval(updateCooldown, 1000);
    return true;
  }

  function formatSavedDate(value) {
    if (!value) return "No custom changes saved";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Saved in this browser" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  }

  function defaultProductImage(product) {
    if (!product) return "";
    if (typeof product.image === "string") return product.image;
    return (state.draft.images.products && state.draft.images.products[product.id]) || Data.productImages[product.id] || "";
  }

  function productRepositoryPath(product) {
    if (!product) return "";
    const defaultPath = Data.productImages[product.id];
    if (defaultPath) return defaultPath.replace(/^\.\//, "");
    return `assets/${product.id}.jpg`;
  }

  function renderOverview() {
    const count = state.draft.menu.length;
    const categoryCount = state.draft.categories.length;
    const colors = Object.values(state.draft.theme);
    const swatches = colors.slice(0, 5).map((color) => `<span class="metric-swatch" style="background:${escapeHTML(color)}" aria-hidden="true"></span>`).join("");
    $("#overviewMetrics").innerHTML = `
      <article class="metric"><span class="metric-label">Menu items</span><strong class="metric-value">${count}</strong><span class="metric-sub">${state.draft.menu.filter((product) => product.available).length} currently available</span></article>
      <article class="metric"><span class="metric-label">Menu categories</span><strong class="metric-value">${categoryCount}</strong><span class="metric-sub">Calculated from saved catalog draft</span></article>
      <article class="metric"><span class="metric-label">Current palette</span><strong class="metric-value" style="font-family:Lato,sans-serif;font-size:16px">${swatches}<span>${escapeHTML(state.draft.theme.primary)}</span></strong><span class="metric-sub">Primary brand color</span></article>
      <article class="metric"><span class="metric-label">Configuration</span><strong class="metric-value" style="font-family:Lato,sans-serif;font-size:16px">${state.github.configExists ? "Published" : "Defaults"}</strong><span class="metric-sub">${state.github.configExists ? "GitHub website settings" : "Built-in BTK defaults"}</span></article>`;

    const hasStoredConfig = Boolean(state.github.configExists);
    const dirty = isDirty();
    $("#configStatusText").textContent = dirty
      ? "There are unsaved website changes in this dashboard."
      : (hasStoredConfig
        ? "Published settings are read from the connected GitHub repository."
        : (state.github.configLoaded ? "GitHub has no published configuration file yet; the first validated commit will create it." : "Connect to GitHub before any Save action can commit changes."));
    $("#configStatusDot").style.background = dirty ? "#bd8446" : (state.github.configLoaded ? "#83956a" : "#a87943");
    $("#lastSavedText").textContent = hasStoredConfig ? formatSavedDate(state.saved.updatedAt) : (state.github.configLoaded ? "No GitHub config file yet" : "Not connected to GitHub");
    $("#overviewPublishingScope").textContent = state.github.configLoaded
      ? `${state.github.owner}/${state.github.repo} · ${state.github.branch}`
      : "Connect a GitHub repository to publish changes";
    setGithubConnectionMessage(state.github.configLoaded
      ? `Connected: ${state.github.owner}/${state.github.repo} · ${state.github.branch}`
      : "Not connected", Boolean(state.github.token && state.github.configLoaded));
  }

  function normalizedForCompare(config) {
    const copy = Config.clone(config);
    copy.updatedAt = "";
    return JSON.stringify(copy);
  }

  function isDirty() {
    return Boolean(state.menuAddOnFormInvalid || state.contentFormInvalid || (state.saved && state.draft && normalizedForCompare(state.saved) !== normalizedForCompare(state.draft)));
  }

  function setSection(sectionName) {
    if (!state.draft) return;
    const valid = $("[data-dashboard-section='" + CSS.escape(sectionName) + "']");
    if (!valid) return;
    state.activeSection = sectionName;
    $$("[data-dashboard-section]").forEach((section) => {
      const active = section.dataset.dashboardSection === sectionName;
      section.hidden = !active;
      section.classList.toggle("is-visible", active);
    });
    $$(".dashboard-nav-button[data-section-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.sectionTarget === sectionName));
    closeMobileNav();
    if (sectionName === "overview") renderOverview();
    if (sectionName === "appearance") renderPaletteFields();
    if (sectionName === "images") renderImageManager();
    if (sectionName === "menu") renderMenuManager();
    if (sectionName === "contact") renderContactForm();
    if (sectionName === "content") renderContentForm();
    if (sectionName === "store-status") renderStoreStatusForm();
    if (sectionName === "github-settings") renderGithubSettings();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMobileNav() {
    $("#dashboardSidebar").classList.add("is-open");
    $("#dashboardScrim").hidden = false;
    $("#mobileNavToggle").setAttribute("aria-expanded", "true");
    $("#mobileNavToggle").setAttribute("aria-label", "Close dashboard navigation");
  }

  function closeMobileNav() {
    const sidebar = $("#dashboardSidebar");
    if (!sidebar) return;
    sidebar.classList.remove("is-open");
    $("#dashboardScrim").hidden = true;
    $("#mobileNavToggle").setAttribute("aria-expanded", "false");
    $("#mobileNavToggle").setAttribute("aria-label", "Open dashboard navigation");
  }

  function renderPaletteFields() {
    $("#paletteFields").innerHTML = PALETTE_FIELDS.map(([key, label]) => `
      <div class="palette-field" data-palette-field="${key}">
        <input class="palette-color" type="color" value="${escapeHTML(state.draft.theme[key])}" data-theme-picker="${key}" aria-label="${escapeHTML(label)} color picker">
        <div class="palette-field-copy"><label for="paletteHex-${key}">${escapeHTML(label)}</label><input class="palette-hex" id="paletteHex-${key}" type="text" value="${escapeHTML(state.draft.theme[key])}" maxlength="7" spellcheck="false" data-theme-hex="${key}" aria-label="${escapeHTML(label)} HEX value"><small data-color-error hidden>Enter a HEX value such as #A89F79.</small></div>
      </div>`).join("");
    updatePalettePreview();
  }

  function updatePalettePreview() {
    const theme = state.draft.theme;
    const preview = $("#palettePreview");
    preview.style.setProperty("--preview-primary", theme.primary);
    preview.style.setProperty("--preview-bg", theme.background);
    preview.style.setProperty("--preview-surface", theme.surface);
    preview.style.setProperty("--preview-heading", theme.heading);
    preview.style.setProperty("--preview-text", theme.text);
    preview.style.setProperty("--preview-muted", theme.muted);
    preview.style.setProperty("--preview-button", theme.buttonBg);
    preview.style.setProperty("--preview-button-text", theme.buttonText);
    preview.style.setProperty("--preview-border", theme.border);
    const warnings = paletteContrastWarnings(theme);
    const note = $("#paletteContrastNote");
    note.textContent = warnings.length
      ? `Improve contrast before saving: ${warnings.join("; ")}.`
      : "Text and button contrast meet the dashboard's minimum readability checks.";
    note.classList.toggle("is-warning", warnings.length > 0);
  }

  function relativeLuminance(hex) {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrastRatio(first, second) {
    const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  function paletteContrastWarnings(theme) {
    const checks = [
      ["body text / background", theme.text, theme.background, 4.5],
      ["body text / surface", theme.text, theme.surface, 4.5],
      ["muted text / surface", theme.muted, theme.surface, 4.5],
      ["button text / button background", theme.buttonText, theme.buttonBg, 4.5],
      ["button text / hover background", theme.buttonText, theme.buttonHover, 4.5],
      ["heading / surface", theme.heading, theme.surface, 3]
    ];
    return checks.filter(([, first, second, minimum]) => contrastRatio(first, second) < minimum).map(([label]) => label);
  }

  function setPaletteColor(key, value) {
    const upper = value.toUpperCase();
    if (!Config.isHexColor(upper)) return false;
    state.draft.theme[key] = upper;
    const field = $(`[data-palette-field="${CSS.escape(key)}"]`);
    if (field) {
      const picker = $(`[data-theme-picker="${CSS.escape(key)}"]`, field);
      const text = $(`[data-theme-hex="${CSS.escape(key)}"]`, field);
      const error = $(`[data-color-error]`, field);
      if (picker) picker.value = upper;
      if (text) { text.value = upper; text.removeAttribute("aria-invalid"); }
      if (error) error.hidden = true;
    }
    updatePalettePreview();
    renderOverview();
    return true;
  }

  function imageCardMarkup({ title, subtitle, src, scope, key, assetPath, wide }) {
    const preview = src ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(title)} image preview" loading="lazy">` : `<span class="image-empty-label">${scope === "logo" ? "BTK monogram fallback" : "No custom image"}</span>`;
    const repoTools = scope === "product" ? `
      <small class="image-repo-path">Repository file: <code data-image-repository-path>${escapeHTML(assetPath)}</code></small>
      <button class="github-image-commit" type="button" data-github-commit disabled>Replace in GitHub</button>` : "";
    return `<article class="image-manager-card${wide ? " wide-image-card" : ""}" data-image-card data-image-scope="${escapeHTML(scope)}" data-image-key="${escapeHTML(key)}">
      ${assetPath ? `<span data-asset-path="${escapeHTML(assetPath)}" hidden></span>` : ""}
      <div class="image-card-top"><div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(subtitle)}</p></div></div>
      <div class="image-card-preview${src ? "" : " image-empty"}" data-image-preview>${preview}</div>
      <div class="image-card-form">
        <label for="imageUrl-${escapeHTML(scope)}-${escapeHTML(key)}">Image URL</label>
        <input id="imageUrl-${escapeHTML(scope)}-${escapeHTML(key)}" type="url" inputmode="url" data-image-url value="${escapeHTML(src)}" placeholder="https://... or assets/... path" aria-label="${escapeHTML(title)} image URL">
        <div class="image-card-actions"><label class="file-label">Choose image <input type="file" data-image-upload accept="image/jpeg,image/png,image/webp" aria-label="Choose ${escapeHTML(title)} image"></label><button class="admin-button admin-button-quiet" type="button" data-image-restore>Restore default</button><button class="admin-button admin-button-quiet" type="button" data-image-clear>Remove image</button>${repoTools}</div>
        <small class="image-source-note">JPG, PNG and WebP are supported. Product replacement files are converted to JPEG and committed to GitHub at the path above.</small>
      </div>
    </article>`;
  }

  function renderImageManager() {
    clearGithubImagePreviews();
    const cards = [
      { title: "Main hero", subtitle: "Full-bleed homepage image", src: state.draft.images.hero, scope: "global", key: "hero", wide: true },
      { title: "Brand logo", subtitle: "Optional transparent logo image", src: state.draft.images.logo, scope: "global", key: "logo" },
      { title: "Our story", subtitle: "Story section photograph", src: state.draft.images.story, scope: "global", key: "story" },
      { title: "Contact section", subtitle: "Find us photograph", src: state.draft.images.contact, scope: "global", key: "contact" }
    ];
    state.draft.menu.forEach((product) => {
      cards.push({
        title: product.name,
        subtitle: `${product.category}${product.featured ? " · Featured" : ""} · Product image`,
        src: defaultProductImage(product),
        scope: "product",
        key: product.id,
        assetPath: productRepositoryPath(product)
      });
    });
    $("#imageManagerGrid").innerHTML = cards.map(imageCardMarkup).join("");
    $$("[data-image-card]").forEach((card) => {
      const image = $("[data-image-preview] img", card);
      if (image) {
        image.addEventListener("error", () => {
          const preview = $("[data-image-preview]", card);
          preview.classList.add("image-empty");
          preview.innerHTML = "<span class=\"image-empty-label\">Image failed to load</span>";
        }, { once: true });
      }
    });
    updateGithubCommitButtons();
  }

  function clearGithubImagePreviews() {
    state.githubPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    state.githubPreviewUrls.clear();
  }

  function updateImageDraft(scope, key, src) {
    if (scope === "global") state.draft.images[key] = src;
    if (scope === "product") {
      const product = state.draft.menu.find((item) => item.id === key);
      if (product) product.image = src;
    }
    renderOverview();
  }

  function renderCategorySelects() {
    const options = state.draft.categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
    $("#productCategory").innerHTML = options;
    const filter = $("#productCategoryFilter");
    const previous = state.filterCategory;
    filter.innerHTML = `<option value="All">All categories</option>${options}`;
    filter.value = state.draft.categories.includes(previous) ? previous : "All";
    state.filterCategory = filter.value;
  }

  function categoryItemCount(category) {
    return state.draft.menu.filter((product) => product.category === category).length;
  }

  function renderCategoryList() {
    const groupOptions = Object.entries(state.draft.addOns.groups).map(([id, group]) => `<option value="${escapeHTML(id)}">${escapeHTML(group.label)}</option>`).join("");
    $("#categoryList").innerHTML = state.draft.categories.map((category) => `
      <div class="category-row" data-category-row="${escapeHTML(category)}">
        <span class="category-row-name">${escapeHTML(category)}</span>
        <span class="category-row-count">${categoryItemCount(category)} items</span>
        <label class="category-addon-picker"><span>Extras</span><select data-category-addon-group aria-label="Optional extras for ${escapeHTML(category)}"><option value="">None</option>${groupOptions}</select></label>
        <span><button class="category-action" type="button" data-category-action="rename">Rename</button><button class="category-action is-danger" type="button" data-category-action="delete">Remove</button></span>
      </div>`).join("");
    $$("[data-category-row]").forEach((row) => {
      const select = $("[data-category-addon-group]", row);
      select.value = state.draft.addOns.categoryGroups[row.dataset.categoryRow] || "";
    });
  }

  function renderAddOnManager() {
    const groupMarkup = Object.entries(state.draft.addOns.groups).map(([groupId, group]) => `
      <section class="addon-group-card" data-addon-group-editor="${escapeHTML(groupId)}">
        <div class="addon-group-heading"><div><p class="eyebrow">${escapeHTML(groupId === "drinkExtras" ? "Coffee / Non-Coffee / Frappe" : "Ramyeon and Fries")}</p><label class="admin-field addon-group-label-field"><span>Extras group name</span><input type="text" data-addon-group-label value="${escapeHTML(group.label)}" maxlength="60" required></label></div><button class="admin-button admin-button-outline" type="button" data-addon-add>+ Add extra</button></div>
        <div class="addon-editor-list">${group.items.map((item) => `
          <div class="addon-editor-row" data-addon-item-row>
            <input type="hidden" data-addon-item-id value="${escapeHTML(item.id)}">
            <label>Extra name<input type="text" data-addon-item-name value="${escapeHTML(item.name)}" maxlength="60" required></label>
            <label>Price (PHP)<input type="number" data-addon-item-price min="0" max="999999" step="0.01" inputmode="decimal" value="${escapeHTML(pesosInput(item.priceCents))}" required></label>
            <button class="remove-option-button" type="button" data-addon-remove>Remove</button>
          </div>`).join("")}</div>
        <p class="addon-group-error form-message" data-addon-group-error role="alert"></p>
      </section>`).join("");
    $("#addonGroupManager").innerHTML = groupMarkup;
  }

  function productPricesMarkup(product) {
    return `<span class="price-list">${product.options.map((option) => `<span>${escapeHTML(option.label || "Listed price")}: ${moneyFromCents(option.priceCents)}${option.takeoutBoxCents ? ` · Box ${moneyFromCents(option.takeoutBoxCents)}` : ""}</span>`).join("")}</span>`;
  }

  function productRowMarkup(product) {
    const image = defaultProductImage(product);
    const imageMarkup = image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : "";
    const status = product.available ? `<span class="availability-tag">Available</span>` : `<span class="availability-tag unavailable">Unavailable</span>`;
    const feature = product.featured ? `<span class="featured-tag">Featured</span>` : "";
    return `<tr data-product-row="${escapeHTML(product.id)}">
      <td><div class="product-table-name"><span class="product-table-thumb">${imageMarkup}</span><span>${escapeHTML(product.name)}${feature}</span></div></td>
      <td>${escapeHTML(product.category)}</td>
      <td>${productPricesMarkup(product)}</td>
      <td>${status}</td>
      <td><div class="row-actions"><button class="row-action" type="button" data-product-action="edit">Edit</button><button class="row-action delete" type="button" data-product-action="delete">Delete</button></div></td>
    </tr>`;
  }

  function mobileProductMarkup(product) {
    const status = product.available ? "Available" : "Unavailable";
    const image = defaultProductImage(product);
    const firstPrice = product.options.length ? moneyFromCents(product.options[0].priceCents) : "No price";
    return `<article class="mobile-product-row" data-product-row="${escapeHTML(product.id)}"><div><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.category)} · ${firstPrice}${product.featured ? " · Featured" : ""}</small></div><span class="availability-tag${product.available ? "" : " unavailable"}">${status}</span><div class="row-actions"><button class="row-action" type="button" data-product-action="edit">Edit product</button><button class="row-action delete" type="button" data-product-action="delete">Delete</button></div>${image ? `<span class="sr-only">Product image is configured.</span>` : ""}</article>`;
  }

  function renderMenuManager() {
    renderCategorySelects();
    renderCategoryList();
    renderAddOnManager();
    const products = state.draft.menu.filter((product) => state.filterCategory === "All" || product.category === state.filterCategory);
    $("#productCount").textContent = String(state.draft.menu.length);
    $("#productTable").innerHTML = products.length ? products.map(productRowMarkup).join("") : `<tr><td colspan="5"><div class="empty-table">No products in this category.</div></td></tr>`;
    $("#mobileProductList").innerHTML = products.length ? products.map(mobileProductMarkup).join("") : `<div class="empty-table">No products in this category.</div>`;
  }

  function renderContactForm() {
    const contact = state.draft.contact;
    const fields = {
      "#contactBusinessName": contact.businessName,
      "#contactTagline": contact.tagline,
      "#contactHeading": contact.heading,
      "#contactDescription": contact.description,
      "#contactMessenger": contact.messengerUrl,
      "#contactFacebook": contact.facebookUrl,
      "#contactMaps": contact.mapsUrl,
      "#contactPhone": contact.phone,
      "#contactEmail": contact.email,
      "#contactAddress": contact.address,
      "#contactInstructions": contact.instructions,
      "#deliveryFreeArea": state.draft.delivery.freeArea,
      "#deliveryPinLocation": state.draft.delivery.pinLocation,
      "#deliveryContactNames": state.draft.delivery.contactNames,
      "#deliveryContactNumber": state.draft.delivery.contactNumber
    };
    Object.entries(fields).forEach(([selector, value]) => { $(selector).value = value || ""; });
  }

  const CONTENT_INPUTS = {
    announcement: "#contentAnnouncement",
    heroHeading: "#contentHeroHeading",
    heroDescription: "#contentHeroDescription",
    heroPrimaryCta: "#contentHeroPrimaryCta",
    heroSecondaryCta: "#contentHeroSecondaryCta",
    featuredEyebrow: "#contentFeaturedEyebrow",
    featuredHeading: "#contentFeaturedHeading",
    featuredDescription: "#contentFeaturedDescription",
    menuEyebrow: "#contentMenuEyebrow",
    menuHeading: "#contentMenuHeading",
    menuDescription: "#contentMenuDescription",
    emptyMenuHeading: "#contentEmptyMenuHeading",
    emptyMenuDescription: "#contentEmptyMenuDescription",
    storyEyebrow: "#contentStoryEyebrow",
    storyHeading: "#contentStoryHeading",
    storyParagraphOne: "#contentStoryParagraphOne",
    storyParagraphTwo: "#contentStoryParagraphTwo",
    orderEyebrow: "#contentOrderEyebrow",
    orderHeading: "#contentOrderHeading",
    orderDescription: "#contentOrderDescription",
    orderNote: "#contentOrderNote",
    contactEyebrow: "#contentContactEyebrow",
    contactMessageCta: "#contentContactMessageCta",
    contactDirectionsCta: "#contentContactDirectionsCta",
    contactOrderCta: "#contentContactOrderCta",
    footerExploreHeading: "#contentFooterExploreHeading",
    footerMenuHeading: "#contentFooterMenuHeading",
    footerMessengerLabel: "#contentFooterMessengerLabel",
    footerFacebookLabel: "#contentFooterFacebookLabel",
    footerMapsLabel: "#contentFooterMapsLabel",
    footerBrandLine: "#contentFooterBrandLine",
    footerCopyrightText: "#contentFooterCopyrightText",
    footerOrderNotice: "#contentFooterOrderNotice"
  };
  const CONTENT_NAV_INPUTS = {
    home: "#navHome", menu: "#navMenu", story: "#navStory", findUs: "#navFindUs", contact: "#navContact"
  };
  const FOOTER_DESTINATIONS = [["home", "Home"], ["menu", "Menu"], ["story", "Our Story"], ["ordering", "How to Order"], ["findUs", "Find Us"]];
  const STORE_DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];

  function renderOrderStepsEditor(steps) {
    $("#orderStepsEditor").innerHTML = steps.map((step, index) => `
      <article class="editable-copy-row" data-order-step-row>
        <span class="editable-row-index">${String(index + 1).padStart(2, "0")}</span>
        <div class="editable-row-fields">
          <label>Step title<textarea data-order-step-title rows="2" maxlength="140" required>${escapeHTML(step.title)}</textarea></label>
          <label>Step description<textarea data-order-step-description rows="3" maxlength="500" required>${escapeHTML(step.description)}</textarea></label>
        </div>
        <button class="remove-option-button" type="button" data-order-step-remove>Remove step</button>
      </article>`).join("");
  }

  function renderFooterLinksEditor(links) {
    $("#footerLinksEditor").innerHTML = links.map((link) => `
      <article class="editable-footer-link" data-footer-link-row>
        <input type="hidden" data-footer-link-id value="${escapeHTML(link.id)}">
        <label>Link label<textarea data-footer-link-label rows="2" maxlength="60" required>${escapeHTML(link.label)}</textarea></label>
        <label>Destination<select data-footer-link-target>${FOOTER_DESTINATIONS.map(([value, label]) => `<option value="${value}"${link.target === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <button class="remove-option-button" type="button" data-footer-link-remove>Remove link</button>
      </article>`).join("");
  }

  function renderContentForm() {
    const content = state.draft.content;
    Object.entries(CONTENT_INPUTS).forEach(([key, selector]) => { $(selector).value = content[key] || ""; });
    Object.entries(CONTENT_NAV_INPUTS).forEach(([key, selector]) => { $(selector).value = content.navigation[key] || ""; });
    renderOrderStepsEditor(content.orderSteps);
    renderFooterLinksEditor(content.footerQuickLinks);
    updateMessage($("#contentFormMessage"), "", false);
  }

  function renderStoreStatusForm() {
    const status = state.draft.storeStatus;
    $("#storeIsOpen").checked = status.isOpen;
    $("#storeFollowHours").checked = status.followHours;
    $("#storeHoursEditor").innerHTML = STORE_DAYS.map(([key, label]) => {
      const day = status.days[key];
      return `<div class="store-hour-row" data-store-day="${key}">
        <strong>${label}</strong>
        <label class="store-day-closed"><input type="checkbox" data-store-day-closed${day.closed ? " checked" : ""}> Closed</label>
        <label>Opens<input type="time" data-store-open value="${escapeHTML(day.openTime)}"${day.closed ? " disabled" : ""}></label>
        <label>Closes<input type="time" data-store-close value="${escapeHTML(day.closeTime)}"${day.closed ? " disabled" : ""}></label>
      </div>`;
    }).join("");
    updateStoreStatusEditorMode();
  }

  function updateStoreStatusEditorMode() {
    const followsHours = $("#storeFollowHours").checked;
    $("#storeHoursPanel").hidden = !followsHours;
    $("#manualStoreStatusPanel").hidden = followsHours;
    const isOpen = $("#storeIsOpen").checked;
    $("#storeStatusChoiceLabel").textContent = isOpen ? "Open" : "Closed";
    $("#storeStatusChoiceDescription").textContent = isOpen ? "Customers will see Open in the site header." : "Customers will see Closed in the site header.";
  }

  function collectStoreStatusDraft() {
    const days = {};
    $$("[data-store-day]").forEach((row) => {
      days[row.dataset.storeDay] = {
        closed: $(`[data-store-day-closed]`, row).checked,
        openTime: $(`[data-store-open]`, row).value,
        closeTime: $(`[data-store-close]`, row).value
      };
    });
    state.draft.storeStatus = {
      isOpen: $("#storeIsOpen").checked,
      followHours: $("#storeFollowHours").checked,
      timezone: "Asia/Manila",
      days
    };
  }

  function collectContentFormDraft() {
    const content = Config.clone(state.draft.content);
    for (const [key, selector] of Object.entries(CONTENT_INPUTS)) {
      const input = $(selector);
      const value = input.value.trim();
      if (!value) return { ok: false, error: "Fill in the required website text fields before publishing.", input };
      content[key] = value;
    }
    content.navigation = {};
    for (const [key, selector] of Object.entries(CONTENT_NAV_INPUTS)) {
      const input = $(selector);
      const value = input.value.trim();
      if (!value) return { ok: false, error: "Fill in all public navigation labels before publishing.", input };
      content.navigation[key] = value;
    }
    const steps = $$("[data-order-step-row]", $("#orderStepsEditor"));
    if (!steps.length || steps.length > 12) return { ok: false, error: "Ordering instructions must contain between 1 and 12 steps." };
    content.orderSteps = [];
    for (const [index, row] of steps.entries()) {
      const titleInput = $(`[data-order-step-title]`, row);
      const descriptionInput = $(`[data-order-step-description]`, row);
      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();
      if (!title || !description) return { ok: false, error: `Complete both fields in order step ${index + 1}.`, input: title ? descriptionInput : titleInput };
      content.orderSteps.push({ title, description });
    }
    const footerRows = $$("[data-footer-link-row]", $("#footerLinksEditor"));
    if (!footerRows.length || footerRows.length > 10) return { ok: false, error: "Footer quick links must contain between 1 and 10 links." };
    content.footerQuickLinks = [];
    for (const [index, row] of footerRows.entries()) {
      const labelInput = $(`[data-footer-link-label]`, row);
      const label = labelInput.value.trim();
      if (!label) return { ok: false, error: `Enter a label for footer link ${index + 1}.`, input: labelInput };
      let id = $(`[data-footer-link-id]`, row).value || generateSlug(label);
      let suffix = 2;
      while (content.footerQuickLinks.some((item) => item.id === id)) { id = `${generateSlug(label)}-${suffix}`; suffix += 1; }
      content.footerQuickLinks.push({ id, label, target: $(`[data-footer-link-target]`, row).value });
    }
    state.draft.content = content;
    return { ok: true, content };
  }

  function updateContentDraft() {
    const result = collectContentFormDraft();
    state.contentFormInvalid = !result.ok;
    updateMessage($("#contentFormMessage"), result.ok ? "" : result.error, false);
    renderOverview();
    return result;
  }

  function renderStoreStatusForm() {
    const status = state.draft.storeStatus;
    $("#storeIsOpen").checked = status.isOpen;
    $("#storeFollowHours").checked = status.followHours;
    const dayLabels = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
    $("#storeHoursEditor").innerHTML = dayLabels.map(([day, label]) => {
      const hours = status.days[day];
      return `<div class="store-hour-row" data-store-day="${day}">
        <strong>${label}</strong>
        <label class="store-day-closed"><input type="checkbox" data-store-day-closed${hours.closed ? " checked" : ""}> Closed</label>
        <label>Opens<input type="time" data-store-open value="${escapeHTML(hours.openTime)}"${hours.closed ? " disabled" : ""}></label>
        <label>Closes<input type="time" data-store-close value="${escapeHTML(hours.closeTime)}"${hours.closed ? " disabled" : ""}></label>
      </div>`;
    }).join("");
    updateStoreStatusEditorMode();
  }

  function updateStoreStatusEditorMode() {
    const followsHours = $("#storeFollowHours").checked;
    $("#storeHoursPanel").hidden = !followsHours;
    $("#manualStoreStatusPanel").hidden = followsHours;
    const isOpen = $("#storeIsOpen").checked;
    $("#storeStatusChoiceLabel").textContent = isOpen ? "Open" : "Closed";
    $("#storeStatusChoiceDescription").textContent = isOpen ? "Customers will see Open in the site header." : "Customers will see Closed in the site header.";
  }

  function collectStoreStatusDraft() {
    const days = {};
    $$("[data-store-day]").forEach((row) => {
      days[row.dataset.storeDay] = {
        closed: $(`[data-store-day-closed]`, row).checked,
        openTime: $(`[data-store-open]`, row).value,
        closeTime: $(`[data-store-close]`, row).value
      };
    });
    state.draft.storeStatus = { isOpen: $("#storeIsOpen").checked, followHours: $("#storeFollowHours").checked, timezone: "Asia/Manila", days };
    return state.draft.storeStatus;
  }

  const CONTENT_INPUTS = {
    announcement: "#contentAnnouncement",
    heroHeading: "#contentHeroHeading",
    heroDescription: "#contentHeroDescription",
    heroPrimaryCta: "#contentHeroPrimaryCta",
    heroSecondaryCta: "#contentHeroSecondaryCta",
    featuredEyebrow: "#contentFeaturedEyebrow",
    featuredHeading: "#contentFeaturedHeading",
    featuredDescription: "#contentFeaturedDescription",
    menuEyebrow: "#contentMenuEyebrow",
    menuHeading: "#contentMenuHeading",
    menuDescription: "#contentMenuDescription",
    emptyMenuHeading: "#contentEmptyMenuHeading",
    emptyMenuDescription: "#contentEmptyMenuDescription",
    storyEyebrow: "#contentStoryEyebrow",
    storyHeading: "#contentStoryHeading",
    storyParagraphOne: "#contentStoryParagraphOne",
    storyParagraphTwo: "#contentStoryParagraphTwo",
    orderEyebrow: "#contentOrderEyebrow",
    orderHeading: "#contentOrderHeading",
    orderDescription: "#contentOrderDescription",
    orderNote: "#contentOrderNote",
    contactEyebrow: "#contentContactEyebrow",
    contactMessageCta: "#contentContactMessageCta",
    contactDirectionsCta: "#contentContactDirectionsCta",
    contactOrderCta: "#contentContactOrderCta",
    footerExploreHeading: "#contentFooterExploreHeading",
    footerMenuHeading: "#contentFooterMenuHeading",
    footerMessengerLabel: "#contentFooterMessengerLabel",
    footerFacebookLabel: "#contentFooterFacebookLabel",
    footerMapsLabel: "#contentFooterMapsLabel",
    footerBrandLine: "#contentFooterBrandLine",
    footerCopyrightText: "#contentFooterCopyrightText",
    footerOrderNotice: "#contentFooterOrderNotice"
  };

  const CONTENT_NAV_INPUTS = {
    home: "#navHome",
    menu: "#navMenu",
    story: "#navStory",
    findUs: "#navFindUs",
    contact: "#navContact"
  };

  const FOOTER_DESTINATIONS = [
    ["home", "Home section"],
    ["menu", "Menu section"],
    ["story", "Our Story section"],
    ["ordering", "How to Order section"],
    ["findUs", "Find Us section"]
  ];

  const STORE_DAYS = [
    ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"],
    ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]
  ];

  function renderOrderStepsEditor(steps) {
    $("#orderStepsEditor").innerHTML = steps.map((step, index) => `
      <article class="editable-copy-row" data-order-step-row>
        <span class="editable-row-index">${String(index + 1).padStart(2, "0")}</span>
        <div class="editable-row-fields">
          <label>Step title<textarea data-order-step-title rows="2" maxlength="140" required>${escapeHTML(step.title)}</textarea></label>
          <label>Step description<textarea data-order-step-description rows="3" maxlength="500" required>${escapeHTML(step.description)}</textarea></label>
        </div>
        <button class="remove-option-button" type="button" data-order-step-remove>Remove step</button>
      </article>`).join("");
  }

  function renderFooterLinksEditor(links) {
    $("#footerLinksEditor").innerHTML = links.map((link, index) => `
      <article class="editable-footer-link" data-footer-link-row>
        <input type="hidden" data-footer-link-id value="${escapeHTML(link.id)}">
        <label>Link label<textarea data-footer-link-label rows="2" maxlength="60" required>${escapeHTML(link.label)}</textarea></label>
        <label>Destination<select data-footer-link-target>${FOOTER_DESTINATIONS.map(([value, label]) => `<option value="${value}"${link.target === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
        <button class="remove-option-button" type="button" data-footer-link-remove>Remove link</button>
      </article>`).join("");
  }

  function renderContentForm() {
    const content = state.draft.content;
    Object.entries(CONTENT_INPUTS).forEach(([key, selector]) => { $(selector).value = content[key] || ""; });
    Object.entries(CONTENT_NAV_INPUTS).forEach(([key, selector]) => { $(selector).value = content.navigation[key] || ""; });
    renderOrderStepsEditor(content.orderSteps);
    renderFooterLinksEditor(content.footerQuickLinks);
    updateMessage($("#contentFormMessage"), "", false);
  }

  function collectContentDraft() {
    const content = Config.clone(state.draft.content);
    for (const [key, selector] of Object.entries(CONTENT_INPUTS)) {
      const input = $(selector);
      const value = input.value.trim();
      if (!value) return { ok: false, error: "Fill in the required website text fields before publishing.", input };
      content[key] = value;
    }
    content.navigation = {};
    for (const [key, selector] of Object.entries(CONTENT_NAV_INPUTS)) {
      const input = $(selector);
      const value = input.value.trim();
      if (!value) return { ok: false, error: "Fill in all public navigation labels before publishing.", input };
      content.navigation[key] = value;
    }
    const stepRows = $$("[data-order-step-row]", $("#orderStepsEditor"));
    if (!stepRows.length || stepRows.length > 12) return { ok: false, error: "Ordering instructions must contain between 1 and 12 steps." };
    content.orderSteps = [];
    for (const [index, row] of stepRows.entries()) {
      const titleInput = $(`[data-order-step-title]`, row);
      const descriptionInput = $(`[data-order-step-description]`, row);
      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();
      if (!title || !description) return { ok: false, error: `Complete both fields in order step ${index + 1}.`, input: title ? descriptionInput : titleInput };
      content.orderSteps.push({ title, description });
    }
    const footerRows = $$("[data-footer-link-row]", $("#footerLinksEditor"));
    if (!footerRows.length || footerRows.length > 10) return { ok: false, error: "Footer quick links must contain between 1 and 10 links." };
    content.footerQuickLinks = [];
    for (const [index, row] of footerRows.entries()) {
      const idInput = $(`[data-footer-link-id]`, row);
      const labelInput = $(`[data-footer-link-label]`, row);
      const targetInput = $(`[data-footer-link-target]`, row);
      const label = labelInput.value.trim();
      if (!label) return { ok: false, error: `Enter a label for footer link ${index + 1}.`, input: labelInput };
      let id = idInput.value || generateSlug(label);
      let suffix = 2;
      while (content.footerQuickLinks.some((item) => item.id === id)) { id = `${generateSlug(label)}-${suffix}`; suffix += 1; }
      content.footerQuickLinks.push({ id, label, target: targetInput.value });
    }
    return { ok: true, content };
  }

  function renderStoreStatusForm() {
    const status = state.draft.storeStatus;
    $("#storeIsOpen").checked = status.isOpen;
    $("#storeFollowHours").checked = status.followHours;
    $("#storeHoursEditor").innerHTML = STORE_DAYS.map(([key, label]) => {
      const hours = status.days[key];
      return `<div class="store-hour-row" data-store-day="${key}">
        <strong>${label}</strong>
        <label class="store-day-closed"><input type="checkbox" data-store-day-closed${hours.closed ? " checked" : ""}> Closed</label>
        <label>Opens<input type="time" data-store-open value="${escapeHTML(hours.openTime)}"${hours.closed ? " disabled" : ""}></label>
        <label>Closes<input type="time" data-store-close value="${escapeHTML(hours.closeTime)}"${hours.closed ? " disabled" : ""}></label>
      </div>`;
    }).join("");
    updateStoreStatusEditorMode();
  }

  function updateStoreStatusEditorMode() {
    const followsHours = $("#storeFollowHours").checked;
    $("#storeHoursPanel").hidden = !followsHours;
    $("#manualStoreStatusPanel").hidden = followsHours;
    const isOpen = $("#storeIsOpen").checked;
    $("#storeStatusChoiceLabel").textContent = isOpen ? "Open" : "Closed";
    $("#storeStatusChoiceDescription").textContent = isOpen ? "Customers will see Open in the site header." : "Customers will see Closed in the site header.";
  }

  function collectStoreStatusDraft() {
    const days = {};
    $$("[data-store-day]").forEach((row) => {
      days[row.dataset.storeDay] = {
        closed: $(`[data-store-day-closed]`, row).checked,
        openTime: $(`[data-store-open]`, row).value,
        closeTime: $(`[data-store-close]`, row).value
      };
    });
    state.draft.storeStatus = {
      isOpen: $("#storeIsOpen").checked,
      followHours: $("#storeFollowHours").checked,
      timezone: "Asia/Manila",
      days
    };
    return state.draft.storeStatus;
  }

  function showValidationErrors(errors) {
    const message = errors.slice(0, 3).join(" ");
    toast(message || "These settings could not be validated.", "error");
  }

  function collectAddOnManagerDraft() {
    const groups = {};
    for (const [groupId, currentGroup] of Object.entries(state.draft.addOns.groups)) {
      const card = $(`[data-addon-group-editor="${CSS.escape(groupId)}"]`);
      const label = $(`[data-addon-group-label]`, card).value.trim();
      if (!label || label.length > 60) return { ok: false, error: `Enter a group name up to 60 characters for ${currentGroup.label}.` };
      const items = [];
      const ids = new Set();
      const rows = $$("[data-addon-item-row]", card);
      if (rows.length > 30) return { ok: false, error: `${label} can contain up to 30 extra choices.` };
      for (const [index, row] of rows.entries()) {
        const name = $(`[data-addon-item-name]`, row).value.trim();
        const price = parsePesos($(`[data-addon-item-price]`, row).value, false);
        if (!name || name.length > 60) return { ok: false, error: `Enter an extra name up to 60 characters in ${label}.` };
        if (!price.ok) return { ok: false, error: `${name}: ${price.error}` };
        const baseId = generateSlug(name);
        let id = $(`[data-addon-item-id]`, row).value || baseId;
        let suffix = 2;
        while (ids.has(id)) { id = `${baseId}-${suffix}`; suffix += 1; }
        ids.add(id);
        items.push({ id, name, priceCents: price.cents });
      }
      groups[groupId] = { label, items };
    }
    const categoryGroups = {};
    $$("[data-category-row]").forEach((row) => {
      const groupId = $(`[data-category-addon-group]`, row).value;
      if (groupId) categoryGroups[row.dataset.categoryRow] = groupId;
    });
    state.draft.addOns = { groups, categoryGroups };
    return { ok: true };
  }

  function mergeSavedSection(target, section) {
    if (section === "appearance") target.theme = Config.clone(state.draft.theme);
    if (section === "images") {
      target.images = Config.clone(state.draft.images);
      const draftProducts = new Map(state.draft.menu.map((product) => [product.id, product]));
      target.menu.forEach((product) => {
        const draftProduct = draftProducts.get(product.id);
        if (draftProduct) product.image = draftProduct.image || "";
      });
    }
    if (section === "menu") {
      target.categories = Config.clone(state.draft.categories);
      target.menu = Config.clone(state.draft.menu);
      target.addOns = Config.clone(state.draft.addOns);
    }
    if (section === "content") target.content = Config.clone(state.draft.content);
    if (section === "store-status") target.storeStatus = Config.clone(state.draft.storeStatus);
    if (section === "contact") {
      target.contact = Config.clone(state.draft.contact);
      target.delivery = Config.clone(state.draft.delivery);
    }
  }

  async function saveSection(section) {
    if (!readValidSession()) {
      window.location.replace("./admin.html");
      return;
    }
    if (!state.github.token || !state.github.configLoaded) {
      toast("Connect to GitHub in Image Manager before saving. Changes are not stored locally as a substitute for a repository commit.", "error");
      setSection("images");
      return;
    }
    if (section === "contact") updateContactDraft();
    if (section === "menu") {
      const addOnResult = collectAddOnManagerDraft();
      if (!addOnResult.ok) {
        state.menuAddOnFormInvalid = true;
        toast(addOnResult.error, "error");
        return;
      }
      state.menuAddOnFormInvalid = false;
    }
    const contrastWarnings = paletteContrastWarnings(state.draft.theme);
    if (contrastWarnings.length) {
      toast(`Color contrast is too low for ${contrastWarnings.join(", ")}. Adjust those colors before saving.`, "error");
      return;
    }
    const invalidImageField = $$("[data-image-url]").find((input) => !Config.isSafeImage(input.value.trim(), true));
    if (invalidImageField) {
      invalidImageField.setAttribute("aria-invalid", "true");
      toast("Correct or clear the invalid image URL before saving.", "error");
      setSection("images");
      invalidImageField.focus();
      return;
    }
    const checked = Config.validate(state.draft);
    if (!checked.ok) {
      showValidationErrors(checked.errors);
      return;
    }
    const saveButtons = $$(`[data-save-section="${CSS.escape(section)}"]`);
    saveButtons.forEach((button) => { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = "Validating & committing..."; });
    const result = await commitConfigToGithub(checked.config);
    if (!result.ok) {
      showValidationErrors(result.errors);
      saveButtons.forEach((button) => { button.disabled = false; button.textContent = button.dataset.originalText || "Validate & Commit to GitHub"; });
      return;
    }
    state.saved = Config.clone(result.config);
    state.draft = Config.clone(result.config);
    state.menuAddOnFormInvalid = false;
    state.github.lastCommitSha = result.commitSha;
    const localCache = Config.save(result.config);
    saveButtons.forEach((button) => { button.disabled = false; button.textContent = button.dataset.originalText || "Validate & Commit to GitHub"; });
    toast(localCache.ok
      ? `All website changes were validated and committed to GitHub (${result.commitSha.slice(0, 7)}). GitHub Pages will publish after its deployment completes.`
      : `All website changes were validated and committed to GitHub (${result.commitSha.slice(0, 7)}). Local browser cache failed, but the repository commit succeeded.`, localCache.ok ? "success" : "error");
    refreshCurrentSection();
    renderOverview();
  }

  function sectionLabel(section) {
    return ({ appearance: "Website colors", images: "Website images", menu: "Menu", contact: "Contact and location" })[section] || "Website settings";
  }

  function resetSection(section) {
    if (section === "appearance") state.draft.theme = Config.clone(state.saved.theme);
    if (section === "images") {
      state.draft.images = Config.clone(state.saved.images);
      const savedProducts = new Map(state.saved.menu.map((product) => [product.id, product.image || ""]));
      state.draft.menu.forEach((product) => { product.image = savedProducts.get(product.id) || ""; });
    }
    if (section === "menu") {
      state.draft.menu = Config.clone(state.saved.menu);
      state.draft.categories = Config.clone(state.saved.categories);
      state.draft.addOns = Config.clone(state.saved.addOns);
      state.menuAddOnFormInvalid = false;
    }
    if (section === "contact") {
      state.draft.contact = Config.clone(state.saved.contact);
      state.draft.delivery = Config.clone(state.saved.delivery);
    }
    refreshCurrentSection();
    renderOverview();
    toast(`${sectionLabel(section)} draft reset to its last saved values.`);
  }

  function restoreDefaults(section) {
    if (section === "appearance") {
      if (!window.confirm("Restore the BTK default color palette in your draft? Save Changes to publish it to this browser's public page.")) return;
      state.draft.theme = Config.defaultConfig().theme;
    }
    if (section === "images") {
      if (!window.confirm("Restore the default BTK website images in your draft? This will clear custom logo and product image overrides.")) return;
      const defaults = Config.defaultConfig();
      state.draft.images = Config.clone(defaults.images);
      state.draft.menu.forEach((product) => { product.image = Data.productImages[product.id] || ""; });
    }
    if (section === "contact") {
      if (!window.confirm("Restore the default BTK contact, map, and delivery details in your draft?")) return;
      const defaults = Config.defaultConfig();
      state.draft.contact = Config.clone(defaults.contact);
      state.draft.delivery = Config.clone(defaults.delivery);
    }
    refreshCurrentSection();
    renderOverview();
    toast(`Default ${sectionLabel(section).toLowerCase()} loaded as an unsaved draft.`);
  }

  function refreshCurrentSection() {
    if (state.activeSection === "overview") renderOverview();
    if (state.activeSection === "appearance") renderPaletteFields();
    if (state.activeSection === "images") renderImageManager();
    if (state.activeSection === "menu") renderMenuManager();
    if (state.activeSection === "contact") renderContactForm();
  }

  function previewDraft() {
    if (!readValidSession()) {
      window.location.replace("./admin.html");
      return;
    }
    const checked = Config.validate(state.draft);
    if (!checked.ok) {
      showValidationErrors(checked.errors);
      return;
    }
    const result = Config.savePreview(checked.config);
    if (!result.ok) {
      showValidationErrors(result.errors);
      return;
    }
    const url = new URL("./index.html", window.location.href);
    url.searchParams.set("admin-preview", "1");
    const opened = window.open(url.href, "_blank", "noopener,noreferrer");
    if (!opened) toast("Preview is ready. Your browser blocked the new tab; open the preview link again or allow pop-ups.", "error");
    else toast("Preview opened in a new tab. Unsaved changes are labelled as an admin preview.", "success");
  }

  function updateContactDraft() {
    const values = {
      businessName: $("#contactBusinessName").value.trim(),
      tagline: $("#contactTagline").value.trim(),
      heading: $("#contactHeading").value.trim(),
      description: $("#contactDescription").value.trim(),
      messengerUrl: $("#contactMessenger").value.trim(),
      facebookUrl: $("#contactFacebook").value.trim(),
      mapsUrl: $("#contactMaps").value.trim(),
      phone: $("#contactPhone").value.trim(),
      email: $("#contactEmail").value.trim(),
      address: $("#contactAddress").value.trim(),
      instructions: $("#contactInstructions").value.trim()
    };
    state.draft.contact = Object.assign({}, state.draft.contact, values);
    state.draft.delivery = Object.assign({}, state.draft.delivery, {
      freeArea: $("#deliveryFreeArea").value.trim(),
      pinLocation: $("#deliveryPinLocation").value.trim(),
      contactNames: $("#deliveryContactNames").value.trim(),
      contactNumber: $("#deliveryContactNumber").value.trim()
    });
  }

  function updateImagePreview(card, src) {
    const preview = $(`[data-image-preview]`, card);
    if (!preview) return;
    if (!src) {
      preview.classList.add("image-empty");
      preview.innerHTML = `<span class="image-empty-label">${card.dataset.imageScope === "global" && card.dataset.imageKey === "logo" ? "BTK monogram fallback" : "No custom image"}</span>`;
      return;
    }
    preview.classList.remove("image-empty");
    const img = document.createElement("img");
    img.alt = `${$("h3", card).textContent} image preview`;
    img.loading = "lazy";
    img.addEventListener("error", () => {
      preview.classList.add("image-empty");
      preview.innerHTML = "<span class=\"image-empty-label\">Image could not be loaded</span>";
    }, { once: true });
    img.src = src;
    preview.replaceChildren(img);
  }

  function readUploadedImage(file) {
    return new Promise((resolve, reject) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!file || !allowed.includes(file.type)) {
        reject(new Error("Choose a JPG, PNG, or WebP image."));
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        reject(new Error("Image uploads must be 180 KB or smaller for browser storage."));
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (typeof reader.result !== "string" || !Config.isSafeImage(reader.result, false)) {
          reject(new Error("This image could not be prepared for the local configuration."));
          return;
        }
        resolve(reader.result);
      });
      reader.addEventListener("error", () => reject(new Error("The selected image could not be read.")));
      reader.readAsDataURL(file);
    });
  }

  function setGithubConnectionMessage(message, connected) {
    const status = $("#githubConnectionStatus");
    if (status) {
      status.textContent = message;
      status.classList.toggle("is-connected", Boolean(connected));
    }
    const headerText = $("#githubHeaderText");
    const headerDot = $("#githubHeaderDot");
    if (headerText) headerText.textContent = connected ? `GitHub connected · ${state.github.owner}/${state.github.repo}` : "GitHub not connected";
    if (headerDot) headerDot.classList.toggle("is-connected", Boolean(connected));
    const headerControl = $("#githubHeaderControl");
    if (headerControl) headerControl.setAttribute("aria-label", connected ? `Connected to ${state.github.owner}/${state.github.repo}. Open GitHub settings.` : "GitHub not connected. Open GitHub settings.");
  }

  function renderGithubSettings() {
    if (!$("#githubSettingsTitle")) return;
    if (!$("#githubOwner").value && state.github.owner) $("#githubOwner").value = state.github.owner;
    if (!$("#githubRepo").value && state.github.repo) $("#githubRepo").value = state.github.repo;
    if (!$("#githubBranch").value && state.github.branch) $("#githubBranch").value = state.github.branch;
    $("#githubDisconnectButton").hidden = !state.github.token;
    $("#githubPublishedState").textContent = !state.github.configLoaded
      ? "Connect a repository to load or create the website configuration."
      : (state.github.configExists
        ? "A validated website configuration is loaded from this repository and branch."
        : "No configuration file exists yet. The first validated Save will create it.");
    $("#githubCommitSha").textContent = state.github.lastCommitSha ? `Last commit: ${state.github.lastCommitSha.slice(0, 7)}` : "";
    setGithubConnectionMessage(state.github.configLoaded
      ? `Connected: ${state.github.owner}/${state.github.repo} · ${state.github.branch}`
      : "Not connected", Boolean(state.github.token && state.github.configLoaded));
  }

  function updateGithubCommitButtons() {
    $$("[data-github-commit]").forEach((button) => {
      const card = button.closest("[data-image-card]");
      const pending = card && state.githubPendingFiles.has(card);
      button.disabled = !state.github.token || !pending || button.classList.contains("is-busy");
      button.title = !state.github.token
        ? "Connect a GitHub repository before replacing the repository file."
        : (!pending ? "Choose an image file first." : "Commit this image to the mapped repository file." );
    });
  }

  async function githubApiRequest(url, method, body) {
    if (!state.github.token) throw new Error("Connect a GitHub repository before uploading.");
    let response;
    try {
      response = await fetch(url, {
        method: method || "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${state.github.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    } catch (_error) {
      throw new Error("Could not reach GitHub. Check your connection and repository access.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error("GitHub rejected the token. Reconnect with a valid fine-grained token.");
      if (response.status === 403) throw new Error("GitHub denied access. Check the token's Contents: read and write permission and repository scope.");
      if (response.status === 404) throw Object.assign(new Error("GitHub file or repository was not found."), { status: 404 });
      if (response.status === 409 || response.status === 422) throw new Error("GitHub reported a conflict or validation error. Refresh the repository connection and try again.");
      throw new Error(`GitHub request failed (${response.status}). Check repository, branch, and token permissions.`);
    }
    return payload;
  }

  function githubContentsUrl(path) {
    return `https://api.github.com/repos/${encodeURIComponent(state.github.owner)}/${encodeURIComponent(state.github.repo)}/contents/${encodeRepoPath(path)}`;
  }

  function decodeBase64Text(value) {
    const normalized = String(value || "").replace(/\s/g, "");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function encodeBase64Text(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    return btoa(binary);
  }

  async function getPublishedConfigFromGithub() {
    const url = `${githubContentsUrl(Config.publishedPath)}?ref=${encodeURIComponent(state.github.branch)}`;
    const file = await githubApiRequest(url, "GET");
    if (!file || file.type !== "file" || typeof file.sha !== "string" || file.encoding !== "base64" || typeof file.content !== "string") {
      throw new Error("The published configuration file is not a readable JSON file.");
    }
    let parsed;
    try { parsed = JSON.parse(decodeBase64Text(file.content)); }
    catch (_error) { throw new Error("The published configuration file contains invalid JSON. No changes were committed."); }
    const checked = Config.validate(parsed);
    if (!checked.ok) throw new Error(`The published GitHub configuration is invalid. ${checked.errors[0]}`);
    return { config: checked.config, sha: file.sha };
  }

  async function loadGithubConfigIntoDashboard() {
    const previousDraft = Config.clone(state.draft);
    const keepDraft = isDirty() && !window.confirm("A published configuration already exists in this repository. Press OK to load it into the dashboard. Press Cancel to keep your current local draft for review.");
    try {
      const remote = await getPublishedConfigFromGithub();
      state.github.configExists = true;
      state.github.configSha = remote.sha;
      state.github.configLoaded = true;
      state.saved = Config.clone(remote.config);
      state.draft = keepDraft ? previousDraft : Config.clone(remote.config);
      state.menuAddOnFormInvalid = false;
      renderOverview();
      if (state.activeSection === "menu") renderMenuManager();
      if (state.activeSection === "appearance") renderPaletteFields();
      if (state.activeSection === "images") renderImageManager();
      if (state.activeSection === "contact") renderContactForm();
      return { found: true };
    } catch (error) {
      if (error.status === 404) {
        state.github.configExists = false;
        state.github.configSha = "";
        state.github.configLoaded = true;
        return { found: false };
      }
      state.github.configLoaded = false;
      throw error;
    }
  }

  async function commitConfigToGithub(rawConfig) {
    if (!state.github.token || !state.github.configLoaded) {
      return { ok: false, errors: ["Connect to GitHub and load the published configuration before saving. No local-only save was made."] };
    }
    const checked = Config.validate(rawConfig);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    checked.config.updatedAt = new Date().toISOString();
    const finalCheck = Config.validate(checked.config);
    if (!finalCheck.ok) return { ok: false, errors: finalCheck.errors };
    try {
      let currentSha = "";
      try {
        const current = await githubApiRequest(`${githubContentsUrl(Config.publishedPath)}?ref=${encodeURIComponent(state.github.branch)}`, "GET");
        if (!current || current.type !== "file" || typeof current.sha !== "string") throw new Error("The existing GitHub configuration could not be verified.");
        currentSha = current.sha;
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      if (state.github.configExists && currentSha !== state.github.configSha) {
        return { ok: false, errors: ["The GitHub configuration changed since you connected. Reconnect to load the latest published settings, then review and save again."] };
      }
      if (!state.github.configExists && currentSha) {
        return { ok: false, errors: ["A configuration file was created in GitHub after you connected. Reconnect and load the latest settings before saving."] };
      }
      const request = {
        message: `Update BTK Coffee website settings (${new Date().toISOString().slice(0, 10)})`,
        content: encodeBase64Text(JSON.stringify(finalCheck.config, null, 2)),
        branch: state.github.branch
      };
      if (currentSha) request.sha = currentSha;
      const committed = await githubApiRequest(githubContentsUrl(Config.publishedPath), "PUT", request);
      if (!committed || !committed.content || typeof committed.content.sha !== "string" || !committed.commit || typeof committed.commit.sha !== "string") {
        return { ok: false, errors: ["GitHub did not return a verifiable commit receipt. Reconnect and check the repository before retrying."] };
      }
      state.github.configExists = true;
      state.github.configSha = committed.content.sha;
      return { ok: true, config: finalCheck.config, commitSha: committed.commit.sha, errors: [] };
    } catch (error) {
      return { ok: false, errors: [error.message || "GitHub rejected the configuration commit."] };
    }
  }

  function validateGithubFields() {
    const owner = $("#githubOwner").value.trim();
    const repo = $("#githubRepo").value.trim();
    const branch = $("#githubBranch").value.trim();
    const token = $("#githubToken").value.trim();
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner)) return { ok: false, error: "Enter a valid GitHub username or organization." };
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo) || repo === "." || repo === "..") return { ok: false, error: "Enter a valid GitHub repository name." };
    if ((branch && !/^[A-Za-z0-9._/-]{1,120}$/.test(branch)) || branch.includes("..") || branch.includes("//") || branch.endsWith("/") || branch.startsWith("/")) {
      return { ok: false, error: "Enter a valid branch name, such as main." };
    }
    if (!token || token.length > 500) return { ok: false, error: "Paste a fine-grained GitHub token for this session." };
    return { ok: true, owner, repo, branch, token };
  }

  async function connectGithubRepository() {
    const button = $("#githubConnectButton");
    const fields = validateGithubFields();
    if (!fields.ok) {
      toast(fields.error, "error");
      return;
    }
    button.disabled = true;
    button.textContent = "Connecting...";
    state.github = Object.assign({}, fields);
    try {
      const url = `https://api.github.com/repos/${encodeURIComponent(fields.owner)}/${encodeURIComponent(fields.repo)}`;
      const repository = await githubApiRequest(url, "GET");
      if (!repository || !repository.default_branch) throw new Error("GitHub returned incomplete repository details.");
      if (!fields.branch) {
        state.github.branch = repository.default_branch;
        $("#githubBranch").value = repository.default_branch;
      }
      const published = await loadGithubConfigIntoDashboard();
      setGithubConnectionMessage(`Connected: ${fields.owner}/${fields.repo} · ${state.github.branch}${published.found ? " · Settings loaded" : " · First settings commit pending"}`, true);
      $("#githubDisconnectButton").hidden = false;
      $("#githubToken").value = "";
      $("#githubToken").placeholder = "Connected for this page session only";
      $("#githubConnectButton").textContent = "Reconnect Repository";
      updateGithubCommitButtons();
      toast(published.found
        ? "GitHub connected. Latest published settings loaded; validated Save actions will commit changes to the repository."
        : "GitHub connected. No settings file exists yet; the next validated Save will create it.", "success");
    } catch (error) {
      state.github = { owner: "", repo: "", branch: "main", token: "", configSha: "", configExists: false, configLoaded: false, lastCommitSha: "" };
      setGithubConnectionMessage(error.message || "GitHub connection failed.", false);
      $("#githubDisconnectButton").hidden = true;
      updateGithubCommitButtons();
      toast(error.message || "GitHub connection failed.", "error");
    } finally {
      button.disabled = false;
      if (!state.github.token) button.textContent = "Connect Repository";
    }
  }

  function disconnectGithubRepository() {
    state.github = { owner: "", repo: "", branch: "main", token: "", configSha: "", configExists: false, configLoaded: false, lastCommitSha: "" };
    $("#githubToken").value = "";
    $("#githubToken").placeholder = "Paste token for this session only";
    $("#githubConnectButton").textContent = "Connect Repository";
    $("#githubDisconnectButton").hidden = true;
    setGithubConnectionMessage("Not connected", false);
    updateGithubCommitButtons();
    toast("GitHub access token cleared from this page session.");
  }

  function stageGithubProductImage(card, file) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast("Choose a JPG, PNG, or WebP image.", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Choose an image smaller than 8 MB before uploading.", "error");
      return;
    }
    const previous = state.githubPendingFiles.get(card);
    if (previous && previous.previewUrl) {
      URL.revokeObjectURL(previous.previewUrl);
      state.githubPreviewUrls.delete(previous.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    state.githubPreviewUrls.add(previewUrl);
    state.githubPendingFiles.set(card, { file, previewUrl });
    updateImagePreview(card, previewUrl);
    updateGithubCommitButtons();
    toast(state.github.token
      ? "Image staged. Use Replace in GitHub to commit it to the mapped file."
      : "Image preview staged only. Connect GitHub to replace the repository file.", state.github.token ? "success" : "error");
  }

  async function imageAsJpeg(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_error) {
      throw new Error("This browser could not decode the selected image. Try another JPG, PNG, or WebP file.");
    }
    const maxEdge = 1800;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      bitmap.close();
      throw new Error("This browser could not prepare the image for GitHub.");
    }
    context.fillStyle = "#FFFDF7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!jpeg) throw new Error("The image could not be converted to JPEG.");
    if (jpeg.size > 4 * 1024 * 1024) throw new Error("The optimized image is still too large (over 4 MB). Choose a smaller photo.");
    return jpeg;
  }

  async function blobBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const step = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += step) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + step, bytes.length)));
    }
    return btoa(binary);
  }

  function encodeRepoPath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function replaceProductImageInGithub(card, button) {
    if (!state.github.token) {
      toast("Connect a GitHub repository before replacing an image.", "error");
      return;
    }
    const staged = state.githubPendingFiles.get(card);
    const product = state.draft.menu.find((item) => item.id === card.dataset.imageKey);
    if (!staged || !product) {
      toast("Choose an image file for this menu item first.", "error");
      return;
    }
    const assetPath = productRepositoryPath(product);
    if (!/^assets\/[a-z0-9][a-z0-9._-]*\.jpe?g$/i.test(assetPath) || assetPath.includes("..")) {
      toast("The mapped repository path is invalid. Restore the product's default image mapping first.", "error");
      return;
    }
    button.disabled = true;
    button.classList.add("is-busy");
    button.textContent = "Preparing...";
    try {
      const jpeg = await imageAsJpeg(staged.file);
      const pathUrl = `https://api.github.com/repos/${encodeURIComponent(state.github.owner)}/${encodeURIComponent(state.github.repo)}/contents/${encodeRepoPath(assetPath)}`;
      let currentSha = "";
      try {
        const current = await githubApiRequest(`${pathUrl}?ref=${encodeURIComponent(state.github.branch)}`, "GET");
        if (current && current.type === "file" && typeof current.sha === "string") currentSha = current.sha;
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      button.textContent = "Committing...";
      const body = {
        message: `Update BTK Coffee product image: ${product.name}`,
        content: await blobBase64(jpeg),
        branch: state.github.branch
      };
      if (currentSha) body.sha = currentSha;
      const result = await githubApiRequest(pathUrl, "PUT", body);
      if (!result || !result.commit || !result.commit.sha) throw new Error("GitHub did not confirm the image commit.");

      const localPath = `./${assetPath}`;
      product.image = localPath;
      delete state.draft.images.products[product.id];
      const imageInput = $("[data-image-url]", card);
      imageInput.value = localPath;
      imageInput.removeAttribute("aria-invalid");
      const preview = $("[data-image-preview]", card);
      preview.classList.remove("image-empty");
      const previewImage = document.createElement("img");
      previewImage.alt = `${product.name} image preview`;
      previewImage.src = staged.previewUrl;
      preview.replaceChildren(previewImage);
      state.githubPendingFiles.delete(card);
      updateGithubCommitButtons();

      const next = Config.clone(state.saved);
      mergeSavedSection(next, "images");
      const checked = Config.validate(next);
      const localSave = checked.ok ? Config.save(checked.config) : { ok: false, errors: checked.errors };
      if (localSave.ok) {
        state.saved = Config.clone(localSave.config);
        state.draft.images = Config.clone(localSave.config.images);
      }
      renderOverview();
      $("#githubCommitStatus").textContent = `Committed ${assetPath} · ${result.commit.sha.slice(0, 7)}. GitHub Pages may take a short time to redeploy.`;
      toast(localSave.ok
        ? `${assetPath} committed to GitHub. The browser also saved the image path locally.`
        : `${assetPath} committed to GitHub. The image path could not be saved in this browser; the built-in product mapping still uses this file.`, "success");
    } catch (error) {
      $("#githubCommitStatus").textContent = "GitHub image commit failed. The selected image was not applied to the repository.";
      toast(error.message || "GitHub image commit failed.", "error");
    } finally {
      button.classList.remove("is-busy");
      button.textContent = "Replace in GitHub";
      updateGithubCommitButtons();
    }
  }

  function currentImageValue(scope, key) {
    if (scope === "global") return state.draft.images[key] || "";
    const product = state.draft.menu.find((item) => item.id === key);
    return product ? (product.image || (state.draft.images.products[key] || "")) : "";
  }

  function updateImageCardValue(card, src) {
    const input = $("[data-image-url]", card);
    input.value = src;
    input.removeAttribute("aria-invalid");
    updateImageDraft(card.dataset.imageScope, card.dataset.imageKey, src);
    updateImagePreview(card, src || (card.dataset.imageScope === "product" ? defaultProductImage(state.draft.menu.find((product) => product.id === card.dataset.imageKey)) : ""));
  }

  function generateSlug(value) {
    return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "menu-item";
  }

  function uniqueProductId(name, currentId) {
    const base = generateSlug(name);
    let candidate = base;
    let suffix = 2;
    while (state.draft.menu.some((product) => product.id === candidate && candidate !== currentId)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return currentId || candidate;
  }

  function uniqueOptionId(label, used, index, preferred) {
    let candidate = preferred && /^[a-z0-9][a-z0-9-]{0,79}$/.test(preferred) ? preferred : generateSlug(label || `option-${index + 1}`);
    if (candidate === "menu-item") candidate = `option-${index + 1}`;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${generateSlug(label || `option-${index + 1}`)}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  }

  function renderOptionRow(option) {
    const safeOption = option || { id: "", label: "", priceCents: 0, takeoutBoxCents: 0 };
    return `<div class="option-editor-row" data-option-row>
      <input type="hidden" data-option-id value="${escapeHTML(safeOption.id || "")}" aria-hidden="true">
      <div class="admin-field"><label>Size / serving label</label><input type="text" maxlength="40" data-option-label value="${escapeHTML(safeOption.label || "")}" placeholder="e.g. 16 oz (optional)"></div>
      <div class="admin-field"><label>Menu price (PHP)</label><input type="number" min="0" max="999999" step="0.01" inputmode="decimal" data-option-price value="${safeOption.priceCents ? escapeHTML(pesosInput(safeOption.priceCents)) : ""}" placeholder="e.g. 99" required></div>
      <div class="admin-field"><label>Take-out box fee (PHP)</label><input type="number" min="0" max="999999" step="0.01" inputmode="decimal" data-option-box value="${safeOption.takeoutBoxCents ? escapeHTML(pesosInput(safeOption.takeoutBoxCents)) : ""}" placeholder="Optional"></div>
      <button class="remove-option-button" type="button" data-remove-option>Remove option</button>
    </div>`;
  }

  function previewEditorImage(src) {
    const preview = $("#productImagePreview");
    if (!src) {
      preview.classList.add("is-empty");
      preview.textContent = "No custom image selected";
      return;
    }
    preview.classList.remove("is-empty");
    const image = document.createElement("img");
    image.alt = "Product image preview";
    image.addEventListener("error", () => {
      preview.classList.add("is-empty");
      preview.textContent = "Image could not be loaded";
    }, { once: true });
    image.src = src;
    preview.replaceChildren(image);
  }

  function openProductDialog(productId) {
    const dialog = $("#productDialog");
    const product = productId ? state.draft.menu.find((item) => item.id === productId) : null;
    if (productId && !product) {
      toast("This product is no longer available in the draft.", "error");
      return;
    }
    $("#productFormMessage").textContent = "";
    $("#productDialogTitle").textContent = product ? "Edit menu item" : "Add new product";
    $("#editingProductId").value = product ? product.id : "";
    $("#productName").value = product ? product.name : "";
    renderCategorySelects();
    $("#productCategory").value = product ? product.category : (state.draft.categories[0] || "");
    $("#productDescription").value = product ? product.description : "";
    const productImage = product ? (product.image || state.draft.images.products[product.id] || "") : "";
    $("#productImageUrl").value = productImage;
    $("#productAvailable").checked = product ? product.available : true;
    $("#productFeatured").checked = product ? product.featured : false;
    const options = product ? product.options : [{ id: "", label: "", priceCents: 0, takeoutBoxCents: 0 }];
    $("#optionEditorList").innerHTML = options.map(renderOptionRow).join("");
    previewEditorImage(productImage || (product ? defaultProductImage(product) : ""));
    state.dialogDirty = false;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(() => $("#productName").focus(), 0);
  }

  function closeProductDialog(force) {
    const dialog = $("#productDialog");
    if (state.dialogDirty && !force && !window.confirm("Discard the unsaved product form?")) return;
    state.dialogDirty = false;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function collectProductOptions() {
    const rows = $$("[data-option-row]", $("#optionEditorList"));
    if (!rows.length) return { ok: false, error: "Add at least one size, serving, or price option." };
    const options = [];
    const used = new Set();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const label = $(`[data-option-label]`, row).value.trim();
      const price = parsePesos($(`[data-option-price]`, row).value, false);
      const box = parsePesos($(`[data-option-box]`, row).value, true);
      if (!price.ok) return { ok: false, error: `Option ${index + 1}: ${price.error}` };
      if (!box.ok) return { ok: false, error: `Option ${index + 1} take-out box fee: ${box.error}` };
      if (label.length > 40) return { ok: false, error: `Option ${index + 1} label is too long.` };
      const id = uniqueOptionId(label, used, index, $(`[data-option-id]`, row).value);
      const option = { id, label, priceCents: price.cents };
      if (box.cents) option.takeoutBoxCents = box.cents;
      options.push(option);
    }
    return { ok: true, options };
  }

  function saveProduct(event) {
    event.preventDefault();
    const name = $("#productName").value.trim();
    const category = $("#productCategory").value;
    const description = $("#productDescription").value.trim();
    const id = $("#editingProductId").value;
    const image = $("#productImageUrl").value.trim();
    const message = $("#productFormMessage");
    if (!name || name.length > 80) {
      updateMessage(message, "Enter a product name from 1 to 80 characters.", false);
      $("#productName").focus();
      return;
    }
    if (!state.draft.categories.includes(category)) {
      updateMessage(message, "Choose an existing menu category.", false);
      $("#productCategory").focus();
      return;
    }
    if (description.length > 500) {
      updateMessage(message, "Keep the product description to 500 characters or fewer.", false);
      $("#productDescription").focus();
      return;
    }
    if (!Config.isSafeImage(image, true)) {
      updateMessage(message, "Use an HTTPS image URL, a local assets image, or upload a supported image.", false);
      $("#productImageUrl").focus();
      return;
    }
    const optionResult = collectProductOptions();
    if (!optionResult.ok) {
      updateMessage(message, optionResult.error, false);
      return;
    }
    const productId = uniqueProductId(name, id);
    const updated = {
      id: productId,
      name,
      category,
      description,
      image,
      available: $("#productAvailable").checked,
      featured: $("#productFeatured").checked,
      options: optionResult.options
    };
    const index = state.draft.menu.findIndex((item) => item.id === id);
    if (index >= 0) state.draft.menu[index] = updated;
    else state.draft.menu.push(updated);
    if (state.draft.images.products[productId]) delete state.draft.images.products[productId];
    state.dialogDirty = false;
    closeProductDialog(true);
    renderMenuManager();
    renderOverview();
    toast(`${name} is updated in your draft. Save Menu Changes to apply it to this browser's website.`, "success");
  }

  function deleteProduct(productId) {
    const product = state.draft.menu.find((item) => item.id === productId);
    if (!product) return;
    if (!window.confirm(`Delete ${product.name} from the menu draft? Existing saved-cart selections will be marked unavailable and must be removed before checkout.`)) return;
    state.draft.menu = state.draft.menu.filter((item) => item.id !== productId);
    delete state.draft.images.products[productId];
    if (state.filterCategory !== "All" && !state.draft.categories.includes(state.filterCategory)) state.filterCategory = "All";
    renderMenuManager();
    renderOverview();
    toast("Product deleted from the draft. Save Menu Changes to apply it.", "success");
  }

  function handleProductAction(event) {
    const button = event.target.closest("[data-product-action]");
    if (!button) return;
    const row = button.closest("[data-product-row]");
    if (!row) return;
    if (button.dataset.productAction === "edit") openProductDialog(row.dataset.productRow);
    if (button.dataset.productAction === "delete") deleteProduct(row.dataset.productRow);
  }

  function handleAddCategory(event) {
    event.preventDefault();
    const input = $("#newCategoryName");
    const name = input.value.trim();
    if (name.length < 2 || name.length > 50 || name === "All") {
      toast("Category names must be 2 to 50 characters and cannot be All.", "error");
      input.focus();
      return;
    }
    if (state.draft.categories.some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      toast("That category already exists.", "error");
      input.focus();
      return;
    }
    state.draft.categories.push(name);
    input.value = "";
    renderMenuManager();
    renderOverview();
    toast(`${name} added to the category draft. Save Menu Changes to apply it.`, "success");
  }

  function handleCategoryAction(event) {
    const button = event.target.closest("[data-category-action]");
    if (!button) return;
    const row = button.closest("[data-category-row]");
    if (!row) return;
    const oldName = row.dataset.categoryRow;
    if (button.dataset.categoryAction === "rename") {
      const nextName = window.prompt(`Rename "${oldName}" to:`, oldName);
      if (nextName === null) return;
      const cleanName = nextName.trim();
      if (cleanName.length < 2 || cleanName.length > 50 || cleanName === "All") {
        toast("Category names must be 2 to 50 characters and cannot be All.", "error");
        return;
      }
      if (state.draft.categories.some((category) => category !== oldName && category.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
        toast("That category already exists.", "error");
        return;
      }
      if (cleanName === oldName) return;
      if (!window.confirm(`Rename ${oldName} to ${cleanName}? Products in this category will move with it.`)) return;
      state.draft.categories = state.draft.categories.map((category) => category === oldName ? cleanName : category);
      state.draft.menu.forEach((product) => { if (product.category === oldName) product.category = cleanName; });
      if (state.draft.addOns.categoryGroups[oldName]) {
        state.draft.addOns.categoryGroups[cleanName] = state.draft.addOns.categoryGroups[oldName];
        delete state.draft.addOns.categoryGroups[oldName];
      }
      if (state.filterCategory === oldName) state.filterCategory = cleanName;
      renderMenuManager();
      renderOverview();
      toast("Category and its products updated in the draft.", "success");
      return;
    }
    if (button.dataset.categoryAction === "delete") {
      const count = categoryItemCount(oldName);
      if (state.draft.categories.length <= 1) {
        toast("Keep at least one menu category.", "error");
        return;
      }
      if (count) {
        toast(`Move ${count} product${count === 1 ? "" : "s"} out of ${oldName} before removing this category.`, "error");
        return;
      }
      if (!window.confirm(`Remove the empty category "${oldName}" from the menu draft?`)) return;
      state.draft.categories = state.draft.categories.filter((category) => category !== oldName);
      delete state.draft.addOns.categoryGroups[oldName];
      if (state.filterCategory === oldName) state.filterCategory = "All";
      renderMenuManager();
      renderOverview();
      toast("Category removed from the draft. Save Menu Changes to apply it.", "success");
    }
  }

  function installDashboardEvents() {
    const root = $("#adminDashboardRoot");
    bindPasswordVisibility(root);
    root.addEventListener("click", (event) => {
      const navTarget = event.target.closest("[data-section-target]");
      if (navTarget) {
        event.preventDefault();
        setSection(navTarget.dataset.sectionTarget);
        return;
      }
      const saveButton = event.target.closest("[data-save-section]");
      if (saveButton) { saveSection(saveButton.dataset.saveSection); return; }
      const resetButton = event.target.closest("[data-reset-section]");
      if (resetButton) { resetSection(resetButton.dataset.resetSection); return; }
      if (event.target.closest("[data-preview-changes]")) { previewDraft(); return; }
      const closeButton = event.target.closest("[data-close-dialog]");
      if (closeButton) { closeProductDialog(false); return; }
    });

    $("#mobileNavToggle").addEventListener("click", () => {
      if ($("#dashboardSidebar").classList.contains("is-open")) closeMobileNav();
      else openMobileNav();
    });
    $("#dashboardScrim").addEventListener("click", closeMobileNav);
    $("#sidebarLogoutButton").addEventListener("click", logout);
    $("#topLogoutButton").addEventListener("click", logout);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if ($("#dashboardSidebar").classList.contains("is-open")) closeMobileNav();
      }
    });

    $("#paletteFields").addEventListener("input", (event) => {
      const picker = event.target.closest("[data-theme-picker]");
      const hex = event.target.closest("[data-theme-hex]");
      if (picker) { setPaletteColor(picker.dataset.themePicker, picker.value); return; }
      if (hex) {
        const field = hex.closest("[data-palette-field]");
        const error = $(`[data-color-error]`, field);
        const valid = Config.isHexColor(hex.value.trim());
        hex.setAttribute("aria-invalid", String(!valid));
        error.hidden = valid;
        if (valid) setPaletteColor(hex.dataset.themeHex, hex.value.trim());
      }
    });
    $("#paletteFields").addEventListener("change", (event) => {
      const hex = event.target.closest("[data-theme-hex]");
      if (hex && !Config.isHexColor(hex.value.trim())) {
        const field = hex.closest("[data-palette-field]");
        const error = $(`[data-color-error]`, field);
        hex.setAttribute("aria-invalid", "true");
        error.hidden = false;
      }
    });
    $("#restorePaletteButton").addEventListener("click", () => restoreDefaults("appearance"));
    $("#restoreImagesButton").addEventListener("click", () => restoreDefaults("images"));
    $("#restoreContactButton").addEventListener("click", () => restoreDefaults("contact"));

    $("#imageManagerGrid").addEventListener("input", (event) => {
      const input = event.target.closest("[data-image-url]");
      if (!input) return;
      const card = input.closest("[data-image-card]");
      const value = input.value.trim();
      if (!Config.isSafeImage(value, true)) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      input.removeAttribute("aria-invalid");
      updateImageDraft(card.dataset.imageScope, card.dataset.imageKey, value);
      updateImagePreview(card, value || (card.dataset.imageScope === "product" ? defaultProductImage(state.draft.menu.find((product) => product.id === card.dataset.imageKey)) : ""));
    });
    $("#imageManagerGrid").addEventListener("change", async (event) => {
      const input = event.target.closest("[data-image-upload]");
      if (!input || !input.files || !input.files[0]) return;
      const card = input.closest("[data-image-card]");
      try {
        if (card.dataset.imageScope === "product") {
          stageGithubProductImage(card, input.files[0]);
          return;
        }
        const dataUrl = await readUploadedImage(input.files[0]);
        updateImageCardValue(card, dataUrl);
        toast("Image preview added to the draft. Save Changes to keep this non-product image in this browser.", "success");
      } catch (error) {
        toast(error.message || "Image upload failed.", "error");
      } finally {
        input.value = "";
      }
    });
    $("#imageManagerGrid").addEventListener("click", (event) => {
      const githubCommit = event.target.closest("[data-github-commit]");
      if (githubCommit) {
        replaceProductImageInGithub(githubCommit.closest("[data-image-card]"), githubCommit);
        return;
      }
      const restore = event.target.closest("[data-image-restore]");
      const clear = event.target.closest("[data-image-clear]");
      const button = restore || clear;
      if (!button) return;
      const card = button.closest("[data-image-card]");
      if (restore && !window.confirm(`Restore the default image for ${$("h3", card).textContent}?`)) return;
      if (clear && !window.confirm(`Remove the custom image for ${$("h3", card).textContent}? The public page will use its fallback.`)) return;
      const staged = state.githubPendingFiles.get(card);
      if (staged && staged.previewUrl) {
        URL.revokeObjectURL(staged.previewUrl);
        state.githubPreviewUrls.delete(staged.previewUrl);
      }
      state.githubPendingFiles.delete(card);
      const defaultImage = restore
        ? (card.dataset.imageScope === "global"
          ? (Config.defaultConfig().images[card.dataset.imageKey] || "")
          : (Data.productImages[card.dataset.imageKey] || ""))
        : "";
      updateImageCardValue(card, defaultImage);
      updateGithubCommitButtons();
    });

    $("#githubConnectButton").addEventListener("click", connectGithubRepository);
    $("#githubDisconnectButton").addEventListener("click", disconnectGithubRepository);
    [$("#githubOwner"), $("#githubRepo"), $("#githubBranch")].forEach((input) => input.addEventListener("input", () => {
      if (state.github.token) disconnectGithubRepository();
    }));

    $("#addProductButton").addEventListener("click", () => openProductDialog("") );
    $("#productForm").addEventListener("input", () => { state.dialogDirty = true; });
    $("#productForm").addEventListener("submit", saveProduct);
    $("#productCategoryFilter").addEventListener("change", (event) => { state.filterCategory = event.target.value; renderMenuManager(); });
    $("#productTable").addEventListener("click", handleProductAction);
    $("#mobileProductList").addEventListener("click", handleProductAction);
    $("#categoryList").addEventListener("click", handleCategoryAction);
    $("#categoryList").addEventListener("change", (event) => {
      if (!event.target.matches("[data-category-addon-group]")) return;
      const row = event.target.closest("[data-category-row]");
      const category = row.dataset.categoryRow;
      const groupId = event.target.value;
      if (groupId) state.draft.addOns.categoryGroups[category] = groupId;
      else delete state.draft.addOns.categoryGroups[category];
      renderOverview();
    });
    $("#addonGroupManager").addEventListener("input", () => {
      const result = collectAddOnManagerDraft();
      state.menuAddOnFormInvalid = !result.ok;
      renderOverview();
    });
    $("#addonGroupManager").addEventListener("click", (event) => {
      const add = event.target.closest("[data-addon-add]");
      const remove = event.target.closest("[data-addon-remove]");
      if (add) {
        const groupCard = add.closest("[data-addon-group-editor]");
        const rows = $$("[data-addon-item-row]", groupCard);
        if (rows.length >= 30) {
          toast("An add-on group can contain up to 30 items.", "error");
          return;
        }
        $(".addon-editor-list", groupCard).insertAdjacentHTML("beforeend", `<div class="addon-editor-row" data-addon-item-row><input type="hidden" data-addon-item-id value=""><label>Extra name<input type="text" data-addon-item-name maxlength="60" placeholder="Add an extra" required></label><label>Price (PHP)<input type="number" data-addon-item-price min="0" max="999999" step="0.01" inputmode="decimal" placeholder="0" required></label><button class="remove-option-button" type="button" data-addon-remove>Remove</button></div>`);
        state.menuAddOnFormInvalid = true;
        $("[data-addon-item-name]", groupCard).focus();
        renderOverview();
        return;
      }
      if (remove) {
        const groupCard = remove.closest("[data-addon-group-editor]");
        if (!window.confirm("Remove this optional extra from the menu draft?")) return;
        remove.closest("[data-addon-item-row]").remove();
        const result = collectAddOnManagerDraft();
        state.menuAddOnFormInvalid = !result.ok;
        renderOverview();
      }
    });
    $("#addCategoryForm").addEventListener("submit", handleAddCategory);
    $("#addOptionButton").addEventListener("click", () => {
      $("#optionEditorList").insertAdjacentHTML("beforeend", renderOptionRow({ id: "", label: "", priceCents: 0, takeoutBoxCents: 0 }));
      state.dialogDirty = true;
    });
    $("#optionEditorList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-option]");
      if (!button) return;
      const rows = $$("[data-option-row]", $("#optionEditorList"));
      if (rows.length <= 1) {
        updateMessage($("#productFormMessage"), "A product needs at least one size, serving, or price option.", false);
        return;
      }
      button.closest("[data-option-row]").remove();
      state.dialogDirty = true;
    });
    $("#productImageUrl").addEventListener("input", (event) => {
      const value = event.target.value.trim();
      if (!Config.isSafeImage(value, true)) {
        event.target.setAttribute("aria-invalid", "true");
        return;
      }
      event.target.removeAttribute("aria-invalid");
      previewEditorImage(value);
    });
    $("#productDialog").addEventListener("click", (event) => {
      if (event.target === $("#productDialog")) closeProductDialog(false);
    });
    $("#productDialog").addEventListener("cancel", (event) => {
      if (state.dialogDirty && !window.confirm("Discard the unsaved product form?")) event.preventDefault();
      else state.dialogDirty = false;
    });

    const contactInputs = $("#contactForm");
    contactInputs.addEventListener("input", updateContactDraft);
    contactInputs.addEventListener("change", updateContactDraft);
    $("#changePasswordForm").addEventListener("submit", handleChangePassword);
    document.addEventListener("pointerdown", sessionActivity, { passive: true });
    document.addEventListener("keydown", sessionActivity);
    window.setInterval(() => {
      if (!readValidSession()) {
        safeStorageRemove("sessionStorage", AUTH_SESSION_KEY);
        toast("Your local dashboard session expired. Sign in again.", "error");
        window.setTimeout(() => window.location.replace("./admin.html"), 900);
      }
    }, 15000);
    window.addEventListener("beforeunload", (event) => {
      if (isDirty() || state.dialogDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    window.addEventListener("pagehide", () => { state.github.token = ""; clearGithubImagePreviews(); });
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    const current = $("#currentAdminPassword").value;
    const next = $("#newAdminPassword").value;
    const confirm = $("#confirmAdminPassword").value;
    const message = $("#passwordChangeMessage");
    const auth = getCredential();
    if (!current || !next || !confirm) {
      updateMessage(message, "Enter the current password, new password, and confirmation.", false);
      return;
    }
    if (auth.missing || auth.corrupted || !auth.credential) {
      updateMessage(message, "The browser-local prototype credential could not be read. Sign out and initialize it again after reviewing the local-storage limitations.", false);
      return;
    }
    try {
      const currentHash = await derivePasswordHash(current, auth.credential.salt, auth.credential.iterations);
      if (currentHash !== auth.credential.hash) {
        updateMessage(message, "The current password is incorrect.", false);
        $("#currentAdminPassword").focus();
        return;
      }
      const policyError = passwordPolicy(next);
      if (policyError) {
        updateMessage(message, policyError, false);
        $("#newAdminPassword").focus();
        return;
      }
      if (next === current) {
        updateMessage(message, "Choose a new password that differs from the current password.", false);
        $("#newAdminPassword").focus();
        return;
      }
      if (next !== confirm) {
        updateMessage(message, "The new password and confirmation do not match.", false);
        $("#confirmAdminPassword").focus();
        return;
      }
      const newCredential = await makeCredential(next);
      newCredential.username = USERNAME;
      if (!safeStorageSet("localStorage", AUTH_CREDENTIAL_KEY, JSON.stringify(newCredential))) throw new Error("The browser could not save the new prototype password.");
      $("#changePasswordForm").reset();
      updateMessage(message, "Prototype password changed for this browser. The fixed username remains superadmin.", true);
      toast("Browser-local prototype password changed.", "success");
    } catch (error) {
      updateMessage(message, error instanceof Error ? error.message : "The prototype password could not be changed.", false);
    }
  }

  function logout() {
    if (isDirty() || state.dialogDirty) {
      if (!window.confirm("You have unsaved dashboard changes. Log out and discard them?")) return;
    }
    safeStorageRemove("sessionStorage", AUTH_SESSION_KEY);
    state.github.token = "";
    clearGithubImagePreviews();
    closeMobileNav();
    window.location.replace("./admin.html");
  }

  function initializeDashboard() {
    if (!$("#adminDashboardRoot")) return false;
    if (!readValidSession()) {
      window.location.replace("./admin.html");
      return true;
    }
    const loaded = Config.load();
    state.saved = Config.clone(loaded.config);
    state.draft = Config.clone(loaded.config);
    if (loaded.warning) window.setTimeout(() => toast(loaded.warning, "error"), 300);
    installDashboardEvents();
    renderOverview();
    renderMenuManager();
    if (loaded.warning) $("#configStatusText").textContent = loaded.warning;
    return true;
  }

  function initialize() {
    const loginRoot = $("#adminLoginRoot");
    const dashboardRoot = $("#adminDashboardRoot");
    if (loginRoot && dashboardRoot && window.location.hash === "#dashboard" && readValidSession()) {
      loginRoot.hidden = true;
      dashboardRoot.hidden = false;
      initializeDashboard();
      return;
    }
    if (loginRoot) {
      loginRoot.hidden = false;
      if (dashboardRoot) dashboardRoot.hidden = true;
      installLoginPage();
      return;
    }
    initializeDashboard();
  }

  initialize();
})();