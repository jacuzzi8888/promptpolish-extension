// promptpolish/popup.js

document.addEventListener("DOMContentLoaded", function () {
    // --- Get references to UI elements ---
    const toggleOptimization = document.getElementById("toggleOptimization");
    const toggleAutoClarify = document.getElementById("toggleAutoClarify");
    const modeSelect = document.getElementById("optimizationMode");
    const customInstructionContainer = document.querySelector(".custom-instruction-container");
    const customInstructionInput = document.getElementById("customInstruction");
    
    // New elements for custom rules
    const addRuleBtn = document.getElementById("addRuleBtn");
    const ruleDomainInput = document.getElementById("ruleDomain");
    const ruleSelectorInput = document.getElementById("ruleSelector");
    const rulesListContainer = document.getElementById("rulesList");

    // --- Helper Functions ---
    function toggleCustomInstructionVisibility() {
        const selectedMode = modeSelect.value;
        customInstructionContainer.classList.toggle("hidden", selectedMode !== "custom");
        customInstructionInput.disabled = selectedMode !== "custom";
    }

    function updateDependentControlsState() {
        const isEnabled = toggleOptimization.checked;
        modeSelect.disabled = !isEnabled;
        toggleAutoClarify.disabled = !isEnabled;
        toggleCustomInstructionVisibility(); 
        if (!isEnabled) {
             customInstructionInput.disabled = true;
        }
    }

    // --- Custom Rules Logic ---
    function renderRules(rules = []) {
        rulesListContainer.innerHTML = ''; // Clear existing list
        if (rules.length === 0) {
            rulesListContainer.innerHTML = '<p style="color: #64748b; font-size: 13px;">No custom rules added yet.</p>';
            return;
        }
        rules.forEach((rule, index) => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <div class="rule-details">
                    <strong>${rule.domain}</strong>
                    <code>${rule.selector}</code>
                </div>
                <button class="delete-rule-btn" data-index="${index}" title="Delete Rule">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            rulesListContainer.appendChild(ruleItem);
        });
    }

    async function saveRules(rules) {
        await chrome.storage.sync.set({ customRules: rules });
        renderRules(rules);
    }

    addRuleBtn.addEventListener('click', async () => {
        const domain = ruleDomainInput.value.trim();
        const selector = ruleSelectorInput.value.trim();

        if (!domain || !selector) {
            alert("Both domain and selector fields are required.");
            return;
        }

        const { customRules = [] } = await chrome.storage.sync.get("customRules");
        customRules.push({ domain, selector });
        await saveRules(customRules);

        // Clear input fields
        ruleDomainInput.value = '';
        ruleSelectorInput.value = '';
    });

    rulesListContainer.addEventListener('click', async (event) => {
        const deleteButton = event.target.closest('.delete-rule-btn');
        if (deleteButton) {
            const indexToDelete = parseInt(deleteButton.dataset.index, 10);
            const { customRules = [] } = await chrome.storage.sync.get("customRules");
            customRules.splice(indexToDelete, 1);
            await saveRules(customRules);
        }
    });

    // --- Load saved settings from chrome.storage.sync ---
    chrome.storage.sync.get(
        ["optimizationEnabled", "autoClarifyEnabled", "optimizationMode", "customInstruction", "customRules"], 
        function (data) {
            toggleOptimization.checked = data.optimizationEnabled !== false; 
            toggleAutoClarify.checked = data.autoClarifyEnabled !== false;
            
            const validModes = ["concise", "creative", "formal", "analyze", "custom"];
            modeSelect.value = (data.optimizationMode && validModes.includes(data.optimizationMode)) ? data.optimizationMode : "concise";
            
            customInstructionInput.value = data.customInstruction || "";

            updateDependentControlsState();
            renderRules(data.customRules || []);
        }
    );

    // --- Event Listeners for Main Settings ---
    toggleOptimization.addEventListener("change", function () {
        chrome.storage.sync.set({ optimizationEnabled: this.checked });
        updateDependentControlsState();
    });

    toggleAutoClarify.addEventListener("change", function () {
        chrome.storage.sync.set({ autoClarifyEnabled: this.checked });
    });

    modeSelect.addEventListener("change", function () {
        chrome.storage.sync.set({ optimizationMode: this.value });
        toggleCustomInstructionVisibility();
    });

    customInstructionInput.addEventListener("input", function () {
        if (modeSelect.value === "custom" && !this.disabled) {
             chrome.storage.sync.set({ customInstruction: this.value });
        }
    });
});
