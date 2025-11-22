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
