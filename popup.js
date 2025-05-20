// promptpolish/popup.js

document.addEventListener("DOMContentLoaded", function () {
    // Get references to the UI elements
    const toggleOptimization = document.getElementById("toggleOptimization");
    const toggleAutoClarify = document.getElementById("toggleAutoClarify"); // New toggle
    const modeSelect = document.getElementById("optimizationMode");
    const customInstructionContainer = document.querySelector(".custom-instruction-container");
    const customInstructionInput = document.getElementById("customInstruction");

    // Function to show/hide the custom instruction area based on selected mode
    function toggleCustomInstructionVisibility() {
        const selectedMode = modeSelect.value;
        if (selectedMode === "custom") {
            customInstructionContainer.classList.remove("hidden"); // Show the container
            customInstructionInput.disabled = false; // Enable the input
        } else {
            customInstructionContainer.classList.add("hidden"); // Hide the container
            customInstructionInput.disabled = true; // Disable the input
        }
    }

    // Function to enable/disable mode select and auto-clarify based on main toggle
    function updateDependentControlsState() {
        const isEnabled = toggleOptimization.checked;
        modeSelect.disabled = !isEnabled;
        toggleAutoClarify.disabled = !isEnabled; // Disable auto-clarify if main optimization is off

        // Re-evaluate custom input state based on both toggle and mode
        toggleCustomInstructionVisibility(); 
        if (!isEnabled) { // If main toggle is off, custom input must be disabled
             customInstructionInput.disabled = true;
        }
    }

    // Load saved settings from chrome.storage.sync
    chrome.storage.sync.get(
        ["optimizationEnabled", "autoClarifyEnabled", "optimizationMode", "customInstruction"], 
        function (data) {
            // Set initial states based on stored data or defaults
            toggleOptimization.checked = data.optimizationEnabled !== undefined ? data.optimizationEnabled : true; 
            toggleAutoClarify.checked = data.autoClarifyEnabled !== undefined ? data.autoClarifyEnabled : true; // Default to true

            const validModes = ["concise", "creative", "formal", "analyze", "custom"];
            modeSelect.value = (data.optimizationMode && validModes.includes(data.optimizationMode)) ? data.optimizationMode : "concise";
            
            customInstructionInput.value = data.customInstruction || "";

            // Initial UI setup based on loaded settings
            updateDependentControlsState(); // Use helper function
        }
    );

    // --- Event Listeners ---

    // Save settings and update UI when the Enable/Disable toggle changes
    toggleOptimization.addEventListener("change", function () {
        const isEnabled = toggleOptimization.checked;
        chrome.storage.sync.set({ optimizationEnabled: isEnabled });
        updateDependentControlsState(); // Use helper function
    });

    // Save settings when the Auto-Clarify toggle changes
    toggleAutoClarify.addEventListener("change", function () {
        chrome.storage.sync.set({ autoClarifyEnabled: toggleAutoClarify.checked });
    });

    // Save settings and update UI when the Optimization Mode dropdown changes
    modeSelect.addEventListener("change", function () {
        chrome.storage.sync.set({ optimizationMode: modeSelect.value });
        toggleCustomInstructionVisibility();
    });

    // Save settings dynamically as the Custom Instruction textarea changes
    customInstructionInput.addEventListener("input", function () {
        // Only save if it's actually enabled (visible and not disabled by the main toggle)
        if (modeSelect.value === "custom" && !customInstructionInput.disabled && toggleOptimization.checked) {
             chrome.storage.sync.set({ customInstruction: customInstructionInput.value });
        }
    });
});
