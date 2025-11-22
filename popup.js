/* popup.js - PromptPolish Settings UI (Cyber-Organic Version) */

const els = {
  optEnabled: document.getElementById('optEnabled'),
  autoClarify: document.getElementById('autoClarify'),
  modeBtns: document.querySelectorAll('.mode-btn'),
  customContainer: document.getElementById('customRulesContainer'),
  customInstruction: document.getElementById('customInstruction'),
  openSettings: document.getElementById('openSettings'),
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

// Load settings from storage
function load() {
  chrome.storage.sync.get(
    ['optimizationEnabled', 'autoClarifyEnabled', 'optimizationMode', 'customInstruction'],
    (data) => {
      if (chrome.runtime.lastError) {
        console.error('[PromptPolish] Load error:', chrome.runtime.lastError);
        return;
      }

      // Toggles
      if (els.optEnabled) els.optEnabled.checked = data.optimizationEnabled !== false; // Default true
      if (els.autoClarify) els.autoClarify.checked = data.autoClarifyEnabled !== false; // Default true

      // Mode
      const currentMode = data.optimizationMode || 'concise';
      updateModeUI(currentMode);

      // Custom Instruction
      if (els.customInstruction) els.customInstruction.value = data.customInstruction || '';
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
    optimizationMode: currentMode,
    customInstruction: els.customInstruction ? els.customInstruction.value.trim() : '',
  };

  chrome.storage.sync.set(payload, () => {
    if (chrome.runtime.lastError) {
      console.error('[PromptPolish] Save error:', chrome.runtime.lastError);
    } else {
      // Optional: Add subtle visual feedback if needed
      // console.log('Settings saved');
    }
  });
}

const autoSaveText = debounce(save, 800);

// Event Listeners
document.addEventListener('DOMContentLoaded', load);

// Toggles (Save immediately)
if (els.optEnabled) els.optEnabled.addEventListener('change', save);
if (els.autoClarify) els.autoClarify.addEventListener('change', save);

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
