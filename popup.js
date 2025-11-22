/* popup.js - PromptPolish Settings UI (Cyber-Organic Version) */

const els = {
  optEnabled: document.getElementById('optEnabled'),
  autoClarify: document.getElementById('autoClarify'),
  whitelistEnabled: document.getElementById('whitelistEnabled'),
  whitelistDomains: document.getElementById('whitelistDomains'),
  whitelistContainer: document.getElementById('whitelistDomainsContainer'),
  modeBtns: document.querySelectorAll('.mode-btn'),
  customContainer: document.getElementById('customRulesContainer'),
  customInstruction: document.getElementById('customInstruction'),
  openSettings: document.getElementById('openSettings'),
  deepPolish: document.getElementById('deepPolishToggle'),
};

// Debounce utility
function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Update UI state based on mode
function updateModeUI(selectedMode) {
  // Update buttons
  els.modeBtns.forEach(btn => {
    if (btn.dataset.value === selectedMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Show/hide custom rules
  if (selectedMode === 'custom') {
    els.customContainer.classList.add('show');
  } else {
    els.customContainer.classList.remove('show');
  }
}

// Toggle whitelist container visibility
function toggleWhitelistContainer() {
  if (els.whitelistEnabled && els.whitelistContainer) {
    els.whitelistContainer.style.display = els.whitelistEnabled.checked ? 'block' : 'none';
  }
}

// Load settings from storage
function load() {
  chrome.storage.sync.get(
    ['optimizationEnabled', 'autoClarifyEnabled', 'optimizationMode', 'customInstruction', 'whitelistEnabled', 'whitelistDomains', 'deepPolish'],
    (data) => {
      if (chrome.runtime.lastError) {
        console.error('[PromptPolish] Load error:', chrome.runtime.lastError);
        return;
      }

      // Toggles
      if (els.optEnabled) els.optEnabled.checked = data.optimizationEnabled !== false; // Default true
      if (els.autoClarify) els.autoClarify.checked = data.autoClarifyEnabled !== false; // Default true
      if (els.whitelistEnabled) {
        els.whitelistEnabled.checked = data.whitelistEnabled || false; // Default false
        toggleWhitelistContainer();
      }
      if (els.deepPolish) els.deepPolish.checked = data.deepPolish || false; // Default false

      // Mode
      const currentMode = data.optimizationMode || 'concise';
      updateModeUI(currentMode);

      // Custom Instruction
      if (els.customInstruction) els.customInstruction.value = data.customInstruction || '';

      // Whitelist Domains
      if (els.whitelistDomains) {
        els.whitelistDomains.value = data.whitelistDomains || 'chatgpt.com\n*.openai.com\nclaude.ai\ngemini.google.com';
      }
    }
  );
}

// Save settings to storage
function save() {
  const activeBtn = document.querySelector('.mode-btn.active');
  const currentMode = activeBtn ? activeBtn.dataset.value : 'concise';

  const payload = {
    optimizationEnabled: els.optEnabled ? els.optEnabled.checked : true,
    autoClarifyEnabled: els.autoClarify ? els.autoClarify.checked : true,
    whitelistEnabled: els.whitelistEnabled ? els.whitelistEnabled.checked : false,
    whitelistDomains: els.whitelistDomains ? els.whitelistDomains.value.trim() : '',
    optimizationMode: currentMode,
    customInstruction: els.customInstruction ? els.customInstruction.value.trim() : '',
    deepPolish: els.deepPolish ? els.deepPolish.checked : false,
  };

  chrome.storage.sync.set(payload, () => {
    if (chrome.runtime.lastError) {
      console.error('[PromptPolish] Save error:', chrome.runtime.lastError);
    }
  });
}

const autoSaveText = debounce(save, 800);

// Event Listeners
document.addEventListener('DOMContentLoaded', load);

// Toggles (Save immediately)
if (els.optEnabled) els.optEnabled.addEventListener('change', save);
if (els.autoClarify) els.autoClarify.addEventListener('change', save);
if (els.whitelistEnabled) {
  els.whitelistEnabled.addEventListener('change', () => {
    toggleWhitelistContainer();
    save();
  });
}
if (els.deepPolish) els.deepPolish.addEventListener('change', save);

// Mode Buttons
els.modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    updateModeUI(btn.dataset.value);
    save();
  });
});

// Custom Instruction (Debounced save)
if (els.customInstruction) {
  els.customInstruction.addEventListener('input', autoSaveText);
}

// Whitelist Domains (Debounced save)
if (els.whitelistDomains) {
  els.whitelistDomains.addEventListener('input', autoSaveText);
}

// Settings Link
if (els.openSettings) {
  els.openSettings.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
}
