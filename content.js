/**
 * content.js — PromptPolish Enhanced Version (Cyber-Organic Design)
 * Features:
 * - Keyboard shortcuts (Ctrl+Shift+P)
 * - Undo functionality
 * - Visual error notifications
 * - Loading states
 * - Rate limiting
 * - Better button positioning
 * - Improved error handling
 * - Preview popup with click-to-apply
 */

if (
  location.protocol === "chrome:" ||
  location.protocol === "chrome-extension:" ||
  location.href.startsWith("about:") ||
  location.href.startsWith("edge:")
) {
  console.warn("[PromptPolish] Skipping internal browser page:", location.href);
  throw new Error("PromptPolish disabled on internal pages");
}

console.log("PromptPolish content script loaded (enhanced version).");

// ---------- GLOBAL STATE ----------
let customRules = [];
const managedInputs = new WeakMap();
const undoStack = new WeakMap();
let currentActiveButton = null;
let currentActivePopup = null;
let isEnabled = true;
let observer = null;
let lastApiCall = 0;
const API_RATE_LIMIT = 1000; // 1 second between calls

// ---------- CONSTANTS ----------
const ACCENT_COLOR = "#10B981"; // Emerald 500
const ACCENT_COLOR_DARK = "#059669";
const BORDER_COLOR = "rgba(255, 255, 255, 0.1)";
const CARD_BG = "rgba(15, 23, 42, 0.8)"; // Slate 900 with opacity
const TEXT_COLOR = "#F8FAFC";
const TEXT_DIM = "#94A3B8";
const ERROR_TEXT_COLOR = "#FCA5A5";
const ERROR_BG = "#7f1d1d";
const SUCCESS_COLOR = "#86efac";
const MIN_ELEMENT_WIDTH = 40;
const MIN_ELEMENT_HEIGHT = 20;

// Lucide-style Icons
const MAGIC_WAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 21l18-18"/></svg>`;
const UNDO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
const LOADING_SPINNER_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 12"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

// ---------- UTILS ----------
function debounce(fn, wait) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

// ---------- TOAST NOTIFICATIONS ----------
function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.promptpolish-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `promptpolish-toast promptpolish-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('promptpolish-toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('promptpolish-toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- STYLE INJECTION ----------
function injectStyles() {
  const id = "promptpolish-injected-styles";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
  :root {
    --pp-primary: #10B981;
    --pp-primary-glow: rgba(16, 185, 129, 0.4);
    --pp-bg-card: rgba(15, 23, 42, 0.85);
    --pp-border: rgba(255, 255, 255, 0.1);
    --pp-text: #F8FAFC;
    --pp-text-dim: #94A3B8;
    --pp-font: 'Inter', system-ui, sans-serif;
    --pp-blur: blur(12px);
    --pp-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }

  .promptpolish-fab {
    position:absolute;
    width:32px; height:32px; border-radius:50%;
    border:1px solid var(--pp-border); 
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg, #10B981, #059669);
    color:#fff; cursor:pointer; z-index:2147483647;
    box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);
    transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .promptpolish-fab:hover{ 
    transform:scale(1.1); 
    box-shadow:0 0 15px var(--pp-primary-glow);
    border-color: rgba(255,255,255,0.3);
  }
  .promptpolish-fab svg{ width:16px; height:16px; color:#fff; }
  .promptpolish-fab:disabled{ opacity:.7; cursor:wait; }
  
  .promptpolish-fab.loading svg { animation: promptpolish-spin 1s linear infinite; }
  @keyframes promptpolish-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  
  .promptpolish-undo-btn {
    position:absolute;
    width:26px; height:26px; border-radius:50%;
    border:1px solid var(--pp-border); 
    display:flex; align-items:center; justify-content:center;
    background:rgba(15, 23, 42, 0.9);
    color:var(--pp-text-dim); cursor:pointer; z-index:2147483646;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
    transition:all 0.2s ease;
    opacity:0;
    pointer-events:none;
    backdrop-filter: blur(4px);
  }
  .promptpolish-undo-btn.show {
    opacity:1;
    pointer-events:auto;
  }
  .promptpolish-undo-btn:hover{ 
    transform:scale(1.1); 
    color: #f59e0b;
    border-color: #f59e0b;
  }
  .promptpolish-undo-btn svg{ width:14px; height:14px; }

  .promptpolish-toast {
    position:fixed; bottom:24px; right:24px;
    padding:12px 20px;
    background:var(--pp-bg-card);
    border:1px solid var(--pp-border);
    border-radius:12px;
    color:var(--pp-text);
    font-family: var(--pp-font);
    font-size:14px; font-weight:500;
    box-shadow:var(--pp-shadow);
    backdrop-filter: var(--pp-blur);
    z-index:2147483647;
    opacity:0; transform:translateY(20px);
    transition:opacity .3s ease, transform .3s ease;
    max-width:320px;
  }
  .promptpolish-toast-show { opacity:1; transform:translateY(0); }
  .promptpolish-toast-error { border-color:#ef4444; color:#fca5a5; }
  .promptpolish-toast-success { border-color:#10B981; color:#86efac; }

  /* Preview Popup - Glassmorphism 2.0 */
  .promptpolish-preview-popup {
    position:absolute; min-width:340px; max-width:520px;
    background:var(--pp-bg-card); 
    border:1px solid var(--pp-border);
    border-radius:16px; 
    box-shadow:var(--pp-shadow);
    backdrop-filter: var(--pp-blur);
    z-index:2147483645; opacity:0;
    transform:translateY(10px) scale(0.98);
    transition:opacity .3s cubic-bezier(0.16, 1, 0.3, 1), transform .3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events:none; overflow:hidden;
    font-family: var(--pp-font);
  }
  .promptpolish-preview-popup.show { opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
  
  .promptpolish-preview-header { 
    display:flex; align-items:center; justify-content:space-between; 
    padding:14px 18px; 
    background:linear-gradient(to right, rgba(16, 185, 129, 0.1), transparent); 
    border-bottom:1px solid var(--pp-border); 
  }
  .promptpolish-preview-title { display:flex; align-items:center; gap:8px; color:var(--pp-text); font-size:14px; font-weight:600; }
  .promptpolish-preview-title svg { width:18px; height:18px; stroke:var(--pp-primary); }
  
  .promptpolish-preview-close { 
    width:28px; height:28px; border-radius:50%; border:none; 
    background:transparent; color:var(--pp-text-dim); 
    cursor:pointer; display:flex; align-items:center; justify-content:center; 
    transition:all .2s ease; 
  }
  .promptpolish-preview-close:hover { background:rgba(255,255,255,.1); color:var(--pp-text); }
  
  .promptpolish-preview-content { padding:18px; max-height:320px; overflow-y:auto; }
  
  .promptpolish-preview-text { 
    color:var(--pp-text); font-size:14px; line-height:1.6; 
    white-space:pre-wrap; word-wrap:break-word; 
    padding:14px; background:rgba(0,0,0,.2); 
    border-radius:10px; border:1px solid transparent; 
    transition:all .2s ease; cursor:pointer;
  }
  .promptpolish-preview-text:hover { background:rgba(0,0,0,.3); border-color:var(--pp-primary); }
  
  .promptpolish-preview-actions { 
    display:flex; gap:10px; padding:14px 18px; 
    border-top:1px solid var(--pp-border); 
    background:rgba(0,0,0,.2); 
  }
  
  .promptpolish-preview-btn { 
    flex:1; padding:10px 16px; border:none; border-radius:10px; 
    font-size:13px; font-weight:600; cursor:pointer; 
    display:flex; align-items:center; justify-content:center; gap:6px; 
    transition:all .2s ease; 
  }
  .promptpolish-preview-btn-primary { 
    background:var(--pp-primary); color:#020617; 
    box-shadow:0 4px 12px rgba(16, 185, 129, 0.25); 
  }
  .promptpolish-preview-btn-primary:hover { 
    transform:translateY(-1px); 
    box-shadow:0 6px 16px rgba(16, 185, 129, 0.4); 
    background:#34d399;
  }
  .promptpolish-preview-btn-secondary { 
    background:transparent; color:var(--pp-text-dim); 
    border:1px solid var(--pp-border); 
  }
  .promptpolish-preview-btn-secondary:hover { 
    background:rgba(255,255,255,.05); color:var(--pp-text); border-color:rgba(255,255,255,.2); 
  }
  `;
  document.head.appendChild(s);
}

// ---------- PREVIEW POPUP MANAGEMENT ----------
function createPreviewPopup(inputEl, optimizedText) {
  // Close any existing popup
  closePreviewPopup();

  const popup = document.createElement('div');
  popup.className = 'promptpolish-preview-popup';

  // Header
  const header = document.createElement('div');
  header.className = 'promptpolish-preview-header';

  const title = document.createElement('div');
  title.className = 'promptpolish-preview-title';
  title.innerHTML = `${CHECK_SVG}<span>Optimized Prompt</span>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'promptpolish-preview-close';
  closeBtn.innerHTML = CLOSE_SVG;
  closeBtn.setAttribute('aria-label', 'Close preview');
  closeBtn.onclick = () => closePreviewPopup();

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Content
  const content = document.createElement('div');
  content.className = 'promptpolish-preview-content';

  const textDiv = document.createElement('div');
  textDiv.className = 'promptpolish-preview-text';
  textDiv.textContent = optimizedText;
  textDiv.setAttribute('title', 'Click to apply this text');

  content.appendChild(textDiv);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'promptpolish-preview-actions';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'promptpolish-preview-btn promptpolish-preview-btn-primary';
  applyBtn.innerHTML = `${CHECK_SVG}<span>Apply</span>`;
  applyBtn.onclick = () => applyOptimizedText(inputEl, optimizedText);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'promptpolish-preview-btn promptpolish-preview-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => closePreviewPopup();

  actions.appendChild(cancelBtn);
  actions.appendChild(applyBtn);

  // Assemble popup
  popup.appendChild(header);
  popup.appendChild(content);
  popup.appendChild(actions);

  document.body.appendChild(popup);
  currentActivePopup = popup;

  // Position popup below input
  positionPreviewPopup(inputEl, popup);

  // Show with animation
  setTimeout(() => popup.classList.add('show'), 10);

  // Click on text to apply
  textDiv.onclick = () => applyOptimizedText(inputEl, optimizedText);

  return popup;
}

function positionPreviewPopup(inputEl, popup) {
  try {
    const inputRect = inputEl.getBoundingClientRect();
    const popupWidth = popup.offsetWidth || 320;

    // Position below input with some spacing
    let top = inputRect.bottom + window.scrollY + 8;
    let left = inputRect.left + window.scrollX;

    // Adjust if popup goes off-screen horizontally
    const viewportWidth = window.innerWidth;
    if (left + popupWidth > viewportWidth - 20) {
      left = viewportWidth - popupWidth - 20;
    }
    if (left < 20) left = 20;

    // Adjust if popup goes off-screen vertically (show above instead)
    const popupHeight = popup.offsetHeight || 200;
    if (top + popupHeight > window.innerHeight + window.scrollY - 20) {
      top = inputRect.top + window.scrollY - popupHeight - 8;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  } catch (e) {
    console.warn('[PromptPolish', e);
  }
}

function closePreviewPopup() {
  if (currentActivePopup) {
    currentActivePopup.classList.remove('show');
    setTimeout(() => {
      if (currentActivePopup) {
        currentActivePopup.remove();
        currentActivePopup = null;
      }
    }, 250);
  }
}

function applyOptimizedText(inputEl, optimizedText) {
  // Store original for undo
  const originalText = inputEl.value || inputEl.textContent || '';
  undoStack.set(inputEl, originalText);

  // Apply the optimized text
  if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
    inputEl.value = optimizedText;
  } else {
    inputEl.textContent = optimizedText;
  }

  inputEl.dispatchEvent(new Event("input", { bubbles: true }));

  // Show undo button
  const managed = managedInputs.get(inputEl);
  if (managed && managed.undoBtn) {
    managed.undoBtn.classList.add('show');
  }

  closePreviewPopup();
  showToast('✓ Prompt applied!', 'success');
}


// ---------- INPUT RELEVANCE CHECK ----------
function isRelevantInput(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  const type = (el.type || "text").toLowerCase();
  const isField =
    tag === "TEXTAREA" ||
    (tag === "INPUT" &&
      ["text", "search", "url", "email", "tel", "number"].includes(type)) ||
    (el.hasAttribute("contenteditable") &&
      el.getAttribute("contenteditable") !== "false");
  if (!isField) return false;

  // Skip invisible or offscreen
  try {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
  } catch { }

  try {
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_ELEMENT_WIDTH || rect.height < MIN_ELEMENT_HEIGHT)
      return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
  } catch { }

  return true;
}

// ---------- MANAGE INPUT + FAB ----------
function manageFoundInput(inputElement) {
  console.log('[PromptPolish] manageFoundInput called for:', inputElement.tagName, 'isEnabled:', isEnabled);
  if (!isEnabled || !isRelevantInput(inputElement) || managedInputs.has(inputElement)) {
    console.log('[PromptPolish] Skipping input. isEnabled:', isEnabled, 'isRelevant:', isRelevantInput(inputElement), 'alreadyManaged:', managedInputs.has(inputElement));
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "promptpolish-fab";
  button.innerHTML = MAGIC_WAND_SVG;
  button.setAttribute('title', 'Optimize prompt (Ctrl+Shift+P)');
  button.style.display = 'none'; // Start hidden, show on focus
  document.body.appendChild(button);
  console.log('[PromptPolish] FAB button created and appended to body');

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "promptpolish-undo-btn";
  undoBtn.innerHTML = UNDO_SVG;
  undoBtn.setAttribute('title', 'Undo optimization');
  document.body.appendChild(undoBtn);

  managedInputs.set(inputElement, { button, undoBtn });

  const position = () => {
    try {
      const r = inputElement.getBoundingClientRect();
      const bw = button.offsetWidth || 28;
      const insetX = Math.max(8, Math.min(14, r.width / 12));
      const insetY = Math.max(8, Math.min(14, r.height / 12));
      const top = r.top + window.scrollY + insetY;
      const left = r.right + window.scrollX - bw - insetX;

      button.style.top = `${top}px`;
      button.style.left = `${left}px`;

      // Position undo button to the left of main button
      undoBtn.style.top = `${top + 2}px`;
      undoBtn.style.left = `${left - 32}px`;
    } catch (e) {
      button.style.display = "none";
      undoBtn.style.display = "none";
    }
  };

  const cleanup = () => {
    button.remove();
    undoBtn.remove();
    window.removeEventListener("scroll", position, true);
    window.removeEventListener("resize", position);
  };

  inputElement.addEventListener("focus", () => {
    if (!isEnabled) return;
    button.style.display = "flex";
    button.style.opacity = "1";
    if (undoStack.has(inputElement)) {
      undoBtn.classList.add('show');
    }
    position();
  });

  inputElement.addEventListener("blur", () => {
    setTimeout(() => {
      button.style.display = "none";
      undoBtn.classList.remove('show');
    }, 200);
  });

  button.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = inputElement.value || inputElement.textContent;
    await handleOptimizationRequest(inputElement, button, undoBtn, text);
  });

  undoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleUndo(inputElement, undoBtn);
  });

  inputElement.addEventListener("input", debounce(position, 100));
  window.addEventListener("scroll", position, true);
  window.addEventListener("resize", position);

  // Store cleanup function
  managedInputs.set(inputElement, { button, undoBtn, cleanup });
}

// ---------- HANDLE UNDO ----------
function handleUndo(inputEl, undoBtn) {
  const original = undoStack.get(inputEl);
  if (!original) return;

  if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
    inputEl.value = original;
  } else {
    inputEl.textContent = original;
  }

  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  undoStack.delete(inputEl);
  undoBtn.classList.remove('show');
  showToast('✓ Reverted to original', 'success');
}

// ---------- HANDLE OPTIMIZATION ----------
async function handleOptimizationRequest(inputEl, button, undoBtn, text) {
  // Immediate visual feedback
  const originalIcon = button.innerHTML;
  button.disabled = true;
  button.classList.add('loading');
  button.innerHTML = LOADING_SPINNER_SVG;

  try {
    // Rate limiting
    const now = Date.now();
    if (now - lastApiCall < API_RATE_LIMIT) {
      showToast('Please wait a moment before optimizing again', 'error');
      return;
    }

    lastApiCall = now;

    // Get Settings (Mode & Deep Polish)
    let deepPolish = false;
    let optimizationMode = 'concise';
    try {
      const settings = await chrome.storage.sync.get(['deepPolish', 'optimizationMode']);
      deepPolish = settings.deepPolish || false;
      optimizationMode = settings.optimizationMode || 'concise';
    } catch (e) {
      console.warn('[PromptPolish] Failed to get settings:', e);
    }

    // Send optimization request to background script
    const resp = await chrome.runtime.sendMessage({
      type: 'optimizeText',
      payload: {
        inputText: text,
        mode: optimizationMode,
        customInstruction: Array.isArray(customRules) ? customRules.join('\n') : '',
        deepPolish: deepPolish
      }
    });

    if (resp && resp.success && resp.data) {
      // Show preview popup instead of directly replacing
      createPreviewPopup(inputEl, resp.data);
    } else {
      const errorMsg = resp?.error || 'Optimization failed';
      showToast(errorMsg, 'error');
      console.warn("[PromptPolish] optimization failed:", resp?.error);
    }
  } catch (e) {
    showToast(e.message || 'Network error occurred', 'error');
    console.error("[PromptPolish] optimization error:", e);
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = MAGIC_WAND_SVG;
  }
}

// ---------- KEYBOARD SHORTCUT ----------
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+P (or Cmd+Shift+P on Mac)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
    e.preventDefault();

    const activeEl = document.activeElement;
    if (!isRelevantInput(activeEl)) return;

    const managed = managedInputs.get(activeEl);
    if (managed && managed.button && !managed.button.disabled) {
      const text = activeEl.value || activeEl.textContent;
      handleOptimizationRequest(activeEl, managed.button, managed.undoBtn, text);
    }
  }
});

// ---------- SETTINGS ----------
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        "optimizationMode",
        "customInstruction",
        "autoClarifyEnabled",
        "optimizationEnabled",
      ],
      (r) => {
        if (chrome.runtime.lastError) {
          console.error('[PromptPolish] Storage error:', chrome.runtime.lastError);
        }
        resolve({
          mode: r.optimizationMode || "concise",
          customInstruction: r.customInstruction || "",
          autoClarifyEnabled:
            r.autoClarifyEnabled !== undefined ? r.autoClarifyEnabled : true,
          enabled: r.optimizationEnabled === true,
        });
      }
    );
  });
}

// ---------- OBSERVER & FOCUS ----------
function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    document
      .querySelectorAll("textarea, input, [contenteditable='true']")
      .forEach((el) => {
        if (isRelevantInput(el) && !managedInputs.has(el)) manageFoundInput(el);
      });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener(
  "focusin",
  (e) => {
    const el = e.target;
    if (isRelevantInput(el) && !managedInputs.has(el)) manageFoundInput(el);
  },
  true
);

// ---------- STORAGE CHANGE LISTENER ----------
if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, ns) => {
    if (ns === "sync" && changes.optimizationEnabled !== undefined) {
      isEnabled = changes.optimizationEnabled.newValue === true;
      if (!isEnabled) {
        document
          .querySelectorAll(".promptpolish-fab, .promptpolish-undo-btn")
          .forEach((b) => (b.style.display = "none"));
      }
    }
  });
}

// ---------- CLEANUP ON PAGE UNLOAD ----------
window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
  // WeakMap cannot be iterated, rely on GC
});

// ---------- INIT ----------
function runInitialization() {
  injectStyles();
  chrome.storage.sync.get(
    ["optimizationEnabled", "customRules"],
    (data) => {
      if (chrome.runtime.lastError) {
        console.warn("[PromptPolish] storage error:", chrome.runtime.lastError);
      } else {
        isEnabled = data.optimizationEnabled !== false;
        customRules = Array.isArray(data.customRules)
          ? data.customRules
          : [];
      }
    }
  );

  document
    .querySelectorAll("textarea, input, [contenteditable='true']")
    .forEach((el) => {
      if (isRelevantInput(el)) manageFoundInput(el);
    });

  startObserver();
}


// ---------- CLOSE POPUP ON CLICK OUTSIDE ----------
document.addEventListener('click', (e) => {
  if (currentActivePopup && !currentActivePopup.contains(e.target)) {
    // Don't close if clicking on the optimization button
    if (!e.target.closest('.promptpolish-fab, .promptpolish-undo-btn')) {
      closePreviewPopup();
    }
  }
}, true);

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", runInitialization);
else runInitialization();

