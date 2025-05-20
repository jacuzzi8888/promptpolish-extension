/**
 * content.js for PromptPolish Chrome Extension
 * Version: v13.1 - Comparative Analysis Follow-up Actions (Reduced Comments)
 */

console.log("PromptPolish content script loaded (v13.1 - Comparative Follow-up).");

// ================= Debounce Utility =================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ================= Constants =================
const ACCENT_COLOR = "#44BC95";
const ACCENT_COLOR_DARK = "#3DAA86";
const BORDER_COLOR = "#E2E8F0";
const LIGHT_GREY_BG = "#F8FAFC";
const MEDIUM_GREY_BG = "#F1F5F8";
const TEXT_COLOR_DARK = "#1E293B";
const TEXT_COLOR_MEDIUM = "#475569";
const ERROR_TEXT_COLOR = "#721C24";
const ERROR_BORDER_COLOR = "#F5C6CB";
const ANALYSIS_TEXT_COLOR = "#004085";
const ANALYSIS_BORDER_COLOR = "#B0E0E6";
const CLARIFICATION_TEXT_COLOR = "#553c7b";
const CLARIFICATION_BORDER_COLOR = "#d1c4e9";
const MIN_ELEMENT_WIDTH = 40;
const MIN_ELEMENT_HEIGHT = 20;
const ANALYSIS_MAX_HEIGHT = "250px";
const ANALYSIS_FIXED_WIDTH = "380px";
const SCROLLBAR_TRACK_COLOR = "transparent";
const SCROLLBAR_THUMB_COLOR = "#CBD5E1";
const SCROLLBAR_THUMB_HOVER_COLOR = "#A0AEC0";
const SCROLLBAR_WIDTH = "6px";
const VAGUE_PROMPT_WORD_THRESHOLD = 5;

// SVG Icons
const MAGIC_WAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M14 9l1-1"/><path d="M17 11l1-1"/><path d="M9 4l1-1"/><path d="M12 6l1-1"/><path d="M3 21l9-9"/><path d="M15 16l-4 4h6v-2Z"/></svg>`;
const WARNING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const INFO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
const QUESTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`;
const DISMISS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const LOADING_SPINNER_SVG = `<svg width="14" height="14" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="${TEXT_COLOR_MEDIUM}"><path d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50"><animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform></path></svg>`;
const RECYCLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;

// ================= State Variables =================
const managedInputs = new Map();
let hideButtonTimeout = null;
let currentOptimizeButton = null; 
let isEnabled = true; 
let observer = null;
let lastOriginalUserText = ""; // Store the very first user prompt for comparison

// ================= Overlay Helper Functions =================
function createSuggestionOverlay() {
    let overlay = document.getElementById("promptpolish-suggestion-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "promptpolish-suggestion-overlay";
        Object.assign(overlay.style, { position: "absolute", backgroundColor: "#FFFFFF", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.08)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif", fontSize: "14px", color: TEXT_COLOR_DARK, zIndex: "10000", border: "none", borderTop: `3px solid ${ACCENT_COLOR}`, lineHeight: "1.5", display: "none", overflow: "hidden", animation: "fadeInSlideUp 0.2s ease-out forwards" });
        document.body.appendChild(overlay);
        const dismissButton = document.createElement("button");
        dismissButton.innerHTML = DISMISS_SVG;
        Object.assign(dismissButton.style, { position: "absolute", top: "6px", right: "6px", width: "20px", height: "20px", padding: "0", border: "none", background: "none", color: TEXT_COLOR_MEDIUM, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", transition: "background-color 0.15s ease, color 0.15s ease" });
        dismissButton.ariaLabel = "Dismiss";
        dismissButton.onmouseover = () => { dismissButton.style.backgroundColor = LIGHT_GREY_BG; dismissButton.style.color = TEXT_COLOR_DARK; };
        dismissButton.onmouseout = () => { dismissButton.style.backgroundColor = "transparent"; dismissButton.style.color = TEXT_COLOR_MEDIUM; };
        dismissButton.addEventListener("click", (e) => { e.stopPropagation(); hideSuggestionOverlay(); });
        overlay.appendChild(dismissButton);
        const styleSheet = document.getElementById("promptpolish-styles") || document.createElement("style");
        styleSheet.id = "promptpolish-styles";
        if (!styleSheet.textContent.includes("fadeInSlideUp")) { styleSheet.textContent += `@keyframes fadeInSlideUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`; }
        if (!document.head.contains(styleSheet)) { document.head.appendChild(styleSheet); }
    }
    const dismissButtonStored = overlay.querySelector('button[aria-label="Dismiss"]');
    overlay.innerHTML = '';
    if (dismissButtonStored) { overlay.appendChild(dismissButtonStored); }
    else { 
        const newDismissButton = document.createElement("button"); newDismissButton.innerHTML = DISMISS_SVG; Object.assign(newDismissButton.style, { position: "absolute", top: "6px", right: "6px", width: "20px", height: "20px", padding: "0", border: "none", background: "none", color: TEXT_COLOR_MEDIUM, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", transition: "background-color 0.15s ease, color 0.15s ease" }); newDismissButton.ariaLabel = "Dismiss"; newDismissButton.onmouseover = () => { newDismissButton.style.backgroundColor = LIGHT_GREY_BG; newDismissButton.style.color = TEXT_COLOR_DARK; }; newDismissButton.onmouseout = () => { newDismissButton.style.backgroundColor = "transparent"; newDismissButton.style.color = TEXT_COLOR_MEDIUM; }; newDismissButton.addEventListener("click", (e) => { e.stopPropagation(); hideSuggestionOverlay(); }); overlay.appendChild(newDismissButton);
    }
    return overlay;
}

// Added originalUserTextForComparison parameter
function showSuggestionOverlay(inputElement, resultData, resultType = 'suggestion', originalMode = '', originalUserTextForComparison = '') {
    const overlay = createSuggestionOverlay();
    overlay.style.borderLeft = 'none'; overlay.style.padding = '8px'; overlay.style.backgroundColor = '#FFFFFF'; overlay.style.color = TEXT_COLOR_DARK; overlay.style.cursor = 'default'; overlay.style.maxWidth = '400px'; overlay.style.width = 'auto';

    if (resultType !== 'analysis' && resultType !== 'clarification' && resultType !== 'error') {
        if (overlay._promptPolishHideTimer) { clearTimeout(overlay._promptPolishHideTimer); overlay._promptPolishHideTimer = null; }
    }
    if (resultType === 'error' && overlay._promptPolishHideTimer) { 
        clearTimeout(overlay._promptPolishHideTimer);
    }

    switch (resultType) {
        case 'error': {
            const iconSvg = WARNING_SVG; const title = "Error:"; const borderColor = ERROR_BORDER_COLOR; const textColor = ERROR_TEXT_COLOR;
            const container = document.createElement('div'); container.style.display = 'flex'; container.style.alignItems = 'flex-start'; container.style.gap = '8px'; container.style.padding = '10px 12px'; container.style.paddingRight = '30px';
            const iconContainer = document.createElement('div'); iconContainer.innerHTML = iconSvg; iconContainer.style.marginTop = '2px'; iconContainer.style.color = textColor;
            const textContainer = document.createElement('div'); textContainer.style.flexGrow = '1';
            const displayData = resultData || "An unknown error occurred.";
            textContainer.innerHTML = `<strong style="color: ${textColor};">${title}</strong><br>${String(displayData).replace(/\n/g, '<br>')}`;
            container.appendChild(iconContainer); container.appendChild(textContainer); overlay.appendChild(container);
            overlay.style.borderLeft = `4px solid ${borderColor}`; overlay.style.paddingLeft = '0'; container.style.paddingLeft = '12px';
            overlay.dataset.activeType = resultType;
            break;
        }
        case 'analysis':
        case 'clarification': {
            const isAnalysis = resultType === 'analysis';
            const iconSvg = isAnalysis ? INFO_SVG : QUESTION_SVG; 
            const title = isAnalysis ? "Analysis:" : "Need More Info:";
            const borderColor = isAnalysis ? ANALYSIS_BORDER_COLOR : CLARIFICATION_BORDER_COLOR;
            const textColor = isAnalysis ? ANALYSIS_TEXT_COLOR : CLARIFICATION_TEXT_COLOR;
            const container = document.createElement('div');
            container.className = 'promptpolish-analysis-content';
            Object.assign(container.style, { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', paddingRight: '12px', maxHeight: ANALYSIS_MAX_HEIGHT, overflowY: 'auto', overflowX: 'hidden' });
            overlay.style.width = ANALYSIS_FIXED_WIDTH; overlay.style.maxWidth = ANALYSIS_FIXED_WIDTH;
            const headerContainer = document.createElement('div'); headerContainer.style.display = 'flex'; headerContainer.style.alignItems = 'flex-start'; headerContainer.style.gap = '8px'; headerContainer.style.flexShrink = '0'; headerContainer.style.paddingBottom = '4px';
            const iconContainer = document.createElement('div'); iconContainer.innerHTML = iconSvg; iconContainer.style.marginTop = '2px'; iconContainer.style.color = textColor;
            const titleElement = document.createElement('strong'); titleElement.textContent = title; titleElement.style.color = textColor;
            headerContainer.appendChild(iconContainer); headerContainer.appendChild(titleElement);
            const textContainer = document.createElement('div'); textContainer.style.flexGrow = '1';
            const displayData = resultData || (isAnalysis ? "Analysis complete." : "Please provide more details.");
            textContainer.innerHTML = String(displayData).replace(/\n/g, '<br>');
            container.appendChild(headerContainer); container.appendChild(textContainer); overlay.appendChild(container);
            overlay.style.borderLeft = `4px solid ${borderColor}`; overlay.style.paddingLeft = '0';
            overlay.dataset.activeType = resultType;
            break;
        }
        case 'suggestion':
        default: {
            overlay.dataset.activeType = 'suggestion'; overlay.style.padding = "5px 0"; overlay.style.maxWidth = '400px';
            const suggestions = Array.isArray(resultData) ? resultData : [resultData];
            const list = document.createElement("ol"); list.style.listStyle = "none"; list.style.margin = "0"; list.style.padding = "4px";
            
            suggestions.forEach((suggestionText, index) => {
                const listItem = document.createElement("li"); listItem.style.padding = "10px 12px"; listItem.style.cursor = "pointer"; listItem.style.borderRadius = "6px"; listItem.style.transition = "background-color 0.15s ease"; listItem.style.display = 'flex'; listItem.style.alignItems = 'flex-start'; listItem.style.gap = '8px'; const numberSpan = document.createElement('span'); numberSpan.textContent = `${index + 1}.`; numberSpan.style.fontWeight = '500'; numberSpan.style.color = TEXT_COLOR_MEDIUM; numberSpan.style.minWidth = '15px'; numberSpan.style.textAlign = 'right'; const textSpan = document.createElement('span'); textSpan.textContent = suggestionText; textSpan.style.flexGrow = '1'; listItem.appendChild(numberSpan); listItem.appendChild(textSpan); if (index < suggestions.length - 1) { listItem.style.borderBottom = `1px solid ${BORDER_COLOR}`; } listItem.onmouseover = () => { listItem.style.backgroundColor = MEDIUM_GREY_BG; }; listItem.onmouseout = () => { listItem.style.backgroundColor = "transparent"; };
                listItem.addEventListener("click", (e) => { 
                    e.stopPropagation(); 
                    if (inputElement.isContentEditable) { 
                        inputElement.focus(); 
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            if (inputElement.contains(range.commonAncestorContainer)) {
                                range.deleteContents(); range.insertNode(document.createTextNode(suggestionText)); range.collapse(false); selection.removeAllRanges(); selection.addRange(range);
                            } else { inputElement.innerText = suggestionText; }
                        } else { inputElement.innerText = suggestionText; }
                    } else { inputElement.value = suggestionText; } 
                    inputElement.focus(); 
                    const inputEvent = new Event('input', { bubbles: true, composed: true }); 
                    inputElement.dispatchEvent(inputEvent); 
                    hideSuggestionOverlay(); 
                }); 
                list.appendChild(listItem);
            }); 
            overlay.appendChild(list);

            if (suggestions.length > 0) {
                const followUpContainer = document.createElement('div');
                followUpContainer.className = 'promptpolish-follow-up-actions';
                Object.assign(followUpContainer.style, { padding: '8px 12px 4px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap'});

                const actions = [
                    { label: "Make Formal", mode: "formal" }, { label: "More Creative", mode: "creative" },
                    { label: "More Concise", mode: "concise" }, { label: "Analyze This", mode: "analyze_comparison" } // Use new mode
                ];

                actions.forEach(action => {
                    if (action.mode === originalMode && originalMode !== 'analyze_comparison') return; 

                    const button = document.createElement('button');
                    button.className = 'promptpolish-follow-up-btn';
                    button.innerHTML = `${RECYCLE_SVG} ${action.label}`;
                    button.onclick = (e) => {
                        e.stopPropagation();
                        const textToReProcess = suggestions[0]; 
                        hideSuggestionOverlay(); 
                        if (currentOptimizeButton && currentOptimizeButton.inputElement && currentOptimizeButton.button) {
                            if (action.mode === "analyze_comparison") {
                                // For comparative analysis, inputText is original, customInstruction is the optimized one
                                handleOptimizationRequest(currentOptimizeButton.inputElement, currentOptimizeButton.button, originalUserTextForComparison, action.mode, textToReProcess);
                            } else {
                                // For other follow-ups, initialText is the current suggestion
                                handleOptimizationRequest(currentOptimizeButton.inputElement, currentOptimizeButton.button, textToReProcess, action.mode, null);
                            }
                        } else {
                            console.warn("Cannot re-process: currentOptimizeButton or its elements are not defined.");
                            showOverlayNearButton(inputElement, "Error: Could not initiate follow-up action. Please try optimizing again.", "error");
                        }
                    };
                    followUpContainer.appendChild(button);
                });
                if (followUpContainer.hasChildNodes()) { 
                    overlay.appendChild(followUpContainer);
                }
            }
            break;
        }
    }

    const rect = inputElement.getBoundingClientRect(); const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight; let leftPosition = window.scrollX + rect.left; let topPosition = window.scrollY + rect.bottom + 5; overlay.style.visibility = 'hidden'; overlay.style.display = 'block'; const overlayWidth = overlay.offsetWidth; const overlayHeight = overlay.offsetHeight; overlay.style.display = 'none'; overlay.style.visibility = 'visible';
    if (leftPosition + overlayWidth > viewportWidth - 10) { leftPosition = viewportWidth - overlayWidth - 10; } if (leftPosition < 10) { leftPosition = 10; } if (topPosition + overlayHeight > viewportHeight + window.scrollY - 10 && rect.top - overlayHeight - 5 > window.scrollY) { topPosition = window.scrollY + rect.top - overlayHeight - 5; } else if (topPosition + overlayHeight > viewportHeight + window.scrollY - 10) { topPosition = window.scrollY + 10; } if (topPosition < window.scrollY + 10) { topPosition = window.scrollY + 10; }
    overlay.style.top = topPosition + "px"; overlay.style.left = leftPosition + "px"; overlay.style.display = "block";

    const handlerKey = '_promptPolishOutsideClickHandler'; if (document[handlerKey]) { document.removeEventListener("click", document[handlerKey], true); }
    document[handlerKey] = function (e) {
        const overlayElement = document.getElementById("promptpolish-suggestion-overlay");
        const activeInputElement = currentOptimizeButton?.inputElement;
        const isClickInsideOverlay = overlayElement && overlayElement.contains(e.target);
        const isClickOnActiveInput = activeInputElement && activeInputElement === e.target;
        const isClickOnAnyOptimizeButton = e.target.closest('.promptpolish-optimize-btn, #promptpolish-chatgpt-float-btn button, .promptpolish-follow-up-btn');
        if (!isClickInsideOverlay && !isClickOnActiveInput && !isClickOnAnyOptimizeButton) {
            hideSuggestionOverlay();
        }
    };
    document.addEventListener("click", document[handlerKey], true);
}

function hideSuggestionOverlay() {
    const overlay = document.getElementById("promptpolish-suggestion-overlay");
    if (overlay) { overlay.style.display = "none"; const handlerKey = '_promptPolishOutsideClickHandler'; if (document[handlerKey]) { document.removeEventListener("click", document[handlerKey], true); delete document[handlerKey]; } if (overlay._promptPolishHideTimer) { clearTimeout(overlay._promptPolishHideTimer); overlay._promptPolishHideTimer = null; } }
}

// ================= Message Passing Logic =================
async function getSettings() {
    return new Promise((resolve, reject) => {
        if (!chrome.storage?.sync) return reject(new Error("Storage API unavailable."));
        chrome.storage.sync.get(["optimizationMode", "customInstruction", "autoClarifyEnabled"], (result) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve({ 
                mode: result.optimizationMode || "concise", 
                customInstruction: result.customInstruction || "",
                autoClarifyEnabled: result.autoClarifyEnabled !== undefined ? result.autoClarifyEnabled : true
            });
        });
    });
}

function isPromptVague(text) {
    if (!text) return true;
    const words = text.trim().split(/\s+/);
    return words.length < VAGUE_PROMPT_WORD_THRESHOLD;
}

// Added customInstructionForFollowUp to payload for analyze_comparison
async function callBackgroundForOptimization(text, mode, customInstructionPayload, isClarifyRequest = false) {
    return new Promise((resolve, reject) => {
        if (!chrome.runtime?.sendMessage) return reject(new Error("Messaging API unavailable."));
        chrome.runtime.sendMessage(
            { 
                type: "optimizeText", 
                payload: { 
                    inputText: text, 
                    mode: mode, 
                    customInstruction: customInstructionPayload, // This will carry the optimized prompt for 'analyze_comparison'
                    isClarifyRequest: isClarifyRequest 
                } 
            },
            (response) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message || "Connection failed."));
                else if (response && typeof response === 'object') {
                    if(response.success === false) reject(new Error(response.error || "Optimization failed."));
                    else if (response.success === true) resolve(response);
                    else reject(new Error("Invalid response format."));
                }
                else reject(new Error("Invalid response received."));
            }
        );
    });
}

// Modified to accept optional initialText, initialMode, and customInstructionForFollowUp
async function handleOptimizationRequest(inputElement, buttonElement, initialText = null, initialMode = null, customInstructionForFollowUp = null) {
    let userTextForRequest; // This will be the primary text sent as 'inputText' to the worker
    let customInstructionPayload; // This will be sent as 'customInstruction' to the worker

    if (initialMode === "analyze_comparison") {
        userTextForRequest = initialText; // The original user prompt
        customInstructionPayload = customInstructionForFollowUp; // The AI-optimized prompt
    } else if (initialText !== null) {
        userTextForRequest = initialText; // The current AI-optimized prompt for other follow-ups
        customInstructionPayload = (await getSettings()).customInstruction; // Standard custom instruction from settings
    } else {
        userTextForRequest = (inputElement.isContentEditable) ? inputElement.innerText.trim() : inputElement.value.trim();
        lastOriginalUserText = userTextForRequest; // Store the very first user prompt
        customInstructionPayload = (await getSettings()).customInstruction; // Standard custom instruction
    }

    const originalButtonContent = buttonElement.innerHTML;
    const originalButtonText = buttonElement.textContent;
    const isFloatingButton = buttonElement.closest('#promptpolish-chatgpt-float-btn');
    
    buttonElement.disabled = true; buttonElement.style.opacity = '0.7'; buttonElement.style.cursor = 'wait'; buttonElement.style.pointerEvents = 'none';

    if (isFloatingButton) { buttonElement.textContent = "Processing..."; buttonElement.style.backgroundColor = "#aaa"; buttonElement.style.boxShadow = "none"; } 
    else { buttonElement.innerHTML = LOADING_SPINNER_SVG; }
    
    if (initialText === null || initialMode !== "analyze_comparison") { // Don't hide for analyze_comparison follow-up as it's a new analysis
        hideSuggestionOverlay(); 
    }

    try {
        const settings = await getSettings(); // Still need this for autoClarifyEnabled and default customInstruction
        let effectiveMode = initialMode || settings.mode;
        let isClarifyRequest = false;

        if (initialText === null && effectiveMode !== 'analyze' && settings.autoClarifyEnabled && isPromptVague(userTextForRequest)) {
            effectiveMode = "clarify";
            isClarifyRequest = true;
        } else if (!userTextForRequest && effectiveMode !== 'analyze' && effectiveMode !== 'clarify' && effectiveMode !== 'analyze_comparison') {
            showSuggestionOverlay(inputElement, "Input is empty. Please type a prompt.", 'error', effectiveMode, lastOriginalUserText);
            buttonElement.disabled = false; buttonElement.style.opacity = '1'; buttonElement.style.cursor = 'pointer'; buttonElement.style.pointerEvents = 'auto';
            if (isFloatingButton) { buttonElement.textContent = originalButtonText; buttonElement.style.backgroundColor = ACCENT_COLOR; buttonElement.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)"; }
            else { buttonElement.innerHTML = originalButtonContent; }
            return;
        }
        
        // For analyze_comparison, customInstructionPayload is already set to the optimized prompt.
        // For other modes, use settings.customInstruction if effectiveMode is 'custom'.
        let finalCustomInstruction = (effectiveMode === "analyze_comparison") 
                                     ? customInstructionPayload 
                                     : (effectiveMode === "custom" ? settings.customInstruction : "");

        const response = await callBackgroundForOptimization(userTextForRequest, effectiveMode, finalCustomInstruction, isClarifyRequest);
        
        const displayType = response.type || (isClarifyRequest ? 'clarification' : (effectiveMode === 'analyze' || effectiveMode === 'analyze_comparison' ? 'analysis' : 'suggestion'));
        const textForOverlayComparison = (effectiveMode === "analyze_comparison" || (initialText === null && displayType === 'suggestion')) ? lastOriginalUserText : '';


        if (displayType === 'analysis' || displayType === 'clarification') {
            showSuggestionOverlay(inputElement, response.data, displayType, effectiveMode, textForOverlayComparison);
        } else if (response.data) {
            const suggestions = Array.isArray(response.data) ? response.data : [response.data];
            const currentInputTextForFilter = (inputElement.isContentEditable ? inputElement.innerText.trim() : inputElement.value.trim());
            
            const validSuggestions = (initialText !== null && effectiveMode !== "analyze_comparison") 
                ? suggestions // For most follow-ups, show the direct result
                : suggestions.filter(text => text !== userTextForRequest); // For initial opt or comparison, filter if same as input
            
            if (validSuggestions.length > 0) {
                showSuggestionOverlay(inputElement, validSuggestions, 'suggestion', effectiveMode, textForOverlayComparison);
            } else if (suggestions.length > 0 && suggestions[0] === userTextForRequest && initialText === null) { 
                 showSuggestionOverlay(inputElement, "No significant changes suggested by AI.", 'analysis', effectiveMode, textForOverlayComparison);
            } else if (suggestions.length > 0 && initialText !== null) { // For follow-up, show even if same as the text re-processed
                showSuggestionOverlay(inputElement, suggestions, 'suggestion', effectiveMode, textForOverlayComparison);
            }
            else {
                showSuggestionOverlay(inputElement, "No different suggestions found or AI returned empty.", 'error', effectiveMode, textForOverlayComparison);
            }
        } else {
             showSuggestionOverlay(inputElement, "Received no data from the AI.", 'error', effectiveMode, textForOverlayComparison);
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const currentModeForError = initialMode || (await getSettings()).mode;
        if (errorMsg.includes("Could not establish connection") || errorMsg.includes("Connection failed")) {
            showSuggestionOverlay(inputElement, "Error: Connection to background service failed. Please reload the page or extension.", 'error', currentModeForError, lastOriginalUserText);
        } else if (errorMsg.includes("Worker URL missing")) {
             showSuggestionOverlay(inputElement, "Error: Extension configuration issue. Please contact support.", 'error', currentModeForError, lastOriginalUserText);
        } else {
            showSuggestionOverlay(inputElement, `Operation failed: ${errorMsg}`, 'error', currentModeForError, lastOriginalUserText);
        }
        console.error("[PromptPolish] Operation failed:", error);
    } finally {
        buttonElement.disabled = false; buttonElement.style.opacity = '1'; buttonElement.style.cursor = 'pointer'; buttonElement.style.pointerEvents = 'auto';
        if (isFloatingButton) { buttonElement.textContent = originalButtonText; buttonElement.style.backgroundColor = ACCENT_COLOR; buttonElement.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)"; }
        else { buttonElement.innerHTML = originalButtonContent; }
    }
}

// ================= Button Injection & Focus Logic =================
function injectStyles() {
    const styleId = "promptpolish-injected-styles"; if (document.getElementById(styleId)) return;
    const styleSheet = document.createElement("style"); styleSheet.id = styleId;
    styleSheet.textContent = `
        #promptpolish-chatgpt-float-btn { position: fixed; bottom: 20px; right: 25px; z-index: 9999; }
        #promptpolish-chatgpt-float-btn button { font-family: system-ui, sans-serif; font-size: 14px; font-weight: 500; padding: 8px 16px; border: none; border-radius: 6px; background-color: ${ACCENT_COLOR}; color: #fff; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: background-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; pointer-events: auto; }
        #promptpolish-chatgpt-float-btn button:hover:not(:disabled) { background-color: ${ACCENT_COLOR_DARK}; box-shadow: 0 4px 8px rgba(0,0,0,0.25); }
        #promptpolish-chatgpt-float-btn button:disabled { background-color: #aaa; cursor: wait; box-shadow: none; opacity: 0.7; pointer-events: none; }
        .promptpolish-optimize-btn { position: absolute; width: 22px; height: 22px; border-radius: 4px; border: 1px solid ${BORDER_COLOR}; background-color: #FFFFFF; color: ${TEXT_COLOR_MEDIUM}; cursor: pointer; padding: 0; z-index: 9999; display: none; align-items: center; justify-content: center; line-height: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.2s ease; pointer-events: auto; }
        .promptpolish-optimize-btn:hover:not(:disabled) { background-color: ${LIGHT_GREY_BG}; border-color: #adb5bd; color: ${ACCENT_COLOR_DARK}; }
        .promptpolish-optimize-btn:disabled { cursor: wait; opacity: 0.7; pointer-events: none;}
        .promptpolish-analysis-content::-webkit-scrollbar { width: ${SCROLLBAR_WIDTH}; }
        .promptpolish-analysis-content::-webkit-scrollbar-track { background: ${SCROLLBAR_TRACK_COLOR}; border-radius: 3px; }
        .promptpolish-analysis-content::-webkit-scrollbar-thumb { background-color: ${SCROLLBAR_THUMB_COLOR}; border-radius: 3px; border: 1px solid ${SCROLLBAR_TRACK_COLOR}; }
        .promptpolish-analysis-content::-webkit-scrollbar-thumb:hover { background-color: ${SCROLLBAR_THUMB_HOVER_COLOR}; }
        .promptpolish-analysis-content { scrollbar-width: thin; scrollbar-color: ${SCROLLBAR_THUMB_COLOR} ${SCROLLBAR_TRACK_COLOR}; }
        .promptpolish-follow-up-btn { background-color: #f0f0f0; color: #333; border: 1px solid #ddd; padding: 4px 8px; font-size: 12px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: background-color 0.15s ease; margin-top: 4px; }
        .promptpolish-follow-up-btn:hover { background-color: #e0e0e0; }
        .promptpolish-follow-up-btn svg { /* SVG styles are inline via innerHTML */ }
    `;
    document.head.appendChild(styleSheet);
}

function isRelevantInput(element) {
    if (!element || element.closest('#promptpolish-suggestion-overlay')) return false;
    const hostname = window.location.hostname;
    try {
        if (hostname.includes("chat.openai.com")) { if (element.matches('textarea[id="prompt-textarea"], textarea[data-id="root"]')) return true; }
        else if (hostname.includes("gemini.google.com")) { if (element.matches('div.ql-editor[contenteditable="true"]')) return true; }
        else if (hostname.includes("claude.ai")) { if (element.matches('div.ProseMirror[contenteditable="true"]')) return true; }
    } catch (e) { /* Minimal logging */ }
    const tagName = element.tagName;
    const isContentEditable = element.isContentEditable;
    if (tagName === 'TEXTAREA' && !element.readOnly) return isElementVisibleAndSufficientSize(element);
    if (tagName === 'INPUT') {
        const type = element.type.toLowerCase();
        const relevantTypes = ['text', 'search', 'url', 'email', 'tel', 'number'];
        if (relevantTypes.includes(type) && !element.readOnly) return isElementVisibleAndSufficientSize(element);
    }
    if (isContentEditable && (tagName === 'DIV' || tagName === 'P')) return isElementVisibleAndSufficientSize(element);
    return false;
}

function isElementVisibleAndSufficientSize(element) {
    try {
        const styles = window.getComputedStyle(element);
        if (!styles || styles.display === 'none' || styles.visibility === 'hidden' || parseFloat(styles.opacity) < 0.1) return false;
        if (element.offsetWidth < MIN_ELEMENT_WIDTH || element.offsetHeight < MIN_ELEMENT_HEIGHT) {
            const rect = element.getBoundingClientRect();
            if (!rect || rect.width < MIN_ELEMENT_WIDTH || rect.height < MIN_ELEMENT_HEIGHT) return false;
        }
        return true;
    } catch (e) { /* Minimal logging */ return false; }
}

function findAndManageInputs(node) {
    if (!isEnabled || !node) return;
    if (node.nodeType === Node.ELEMENT_NODE && isRelevantInput(node)) addOptimizeButtonIfNeeded(node);
    if (node.querySelectorAll) {
        const potentialInputs = node.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="number"], div[contenteditable="true"], p[contenteditable="true"]');
        potentialInputs.forEach(el => { if (isRelevantInput(el)) addOptimizeButtonIfNeeded(el); });
    }
}
const debouncedFindAndManageInputs = debounce(findAndManageInputs, 350);

function createOptimizeButtonElement(inputElement) {
    try {
        const button = document.createElement('button');
        button.type = "button"; button.innerHTML = MAGIC_WAND_SVG; button.title = 'Optimize with PromptPolish'; button.classList.add('promptpolish-optimize-btn');
        button.addEventListener('click', async (event) => {
            event.stopPropagation(); event.preventDefault();
            clearTimeout(hideButtonTimeout);
            await handleOptimizationRequest(inputElement, button, null, null, null); 
        });
        return button;
    } catch (error) { console.error("PromptPolish: Failed to create button:", error); return null; }
}

function addOptimizeButtonIfNeeded(inputElement) {
    if (!isEnabled || managedInputs.has(inputElement)) return;
    const optimizeButton = createOptimizeButtonElement(inputElement);
    if (!optimizeButton) return;
    document.body.appendChild(optimizeButton);
    managedInputs.set(inputElement, { button: optimizeButton });
    try { positionButton(optimizeButton, inputElement); }
    catch (e) { /* Minimal logging */ }
}

function positionButton(button, inputElement) {
    try {
        const rect = inputElement.getBoundingClientRect();
        const wasHidden = button.style.display === 'none';
        if (wasHidden) { button.style.visibility = 'hidden'; button.style.display = 'flex'; }
        const buttonHeight = button.offsetHeight; const buttonWidth = button.offsetWidth;
        if (wasHidden) { button.style.display = 'none'; button.style.visibility = 'visible'; }
        if (!buttonHeight || !buttonWidth) { button.style.display = 'none'; return; }
        const topOffset = Math.max(3, Math.min(5, rect.height / 4));
        const rightOffset = Math.max(3, Math.min(5, rect.width / 10));
        let top = rect.top + window.scrollY + topOffset;
        let left = rect.right + window.scrollX - buttonWidth - rightOffset;
        const viewportWidth = window.innerWidth; const viewportHeight = window.innerHeight;
        if (left + buttonWidth > viewportWidth + window.scrollX - 5) left = viewportWidth + window.scrollX - buttonWidth - 5;
        if (left < window.scrollX + 5) left = window.scrollX + 5;
        if (top + buttonHeight > rect.bottom + window.scrollY - 3) { top = rect.bottom + window.scrollY - buttonHeight - 3; }
        if (top < rect.top + window.scrollY + 3) { top = rect.top + window.scrollY + 3; }
        if (top + buttonHeight > viewportHeight + window.scrollY - 5) top = viewportHeight + window.scrollY - buttonHeight - 5;
        if (top < window.scrollY + 5) top = window.scrollY + 5;
        button.style.top = `${top}px`; button.style.left = `${left}px`;
    } catch (error) { console.error("Error positioning button:", error); button.style.display = 'none'; }
}

document.body.addEventListener('focusin', (event) => {
    if (!isEnabled) return;
    clearTimeout(hideButtonTimeout);
    const target = event.target;
    if (isRelevantInput(target)) {
        addOptimizeButtonIfNeeded(target);
        const managedData = managedInputs.get(target);
        if (!managedData) return;
        const { button } = managedData;
        if (currentOptimizeButton && currentOptimizeButton.button !== button) currentOptimizeButton.button.style.display = 'none';
        positionButton(button, target);
        button.style.display = 'flex';
        currentOptimizeButton = { button: button, inputElement: target };
    } else {
         if (currentOptimizeButton && !event.target.closest('.promptpolish-optimize-btn') && !event.target.closest('#promptpolish-suggestion-overlay') && !event.target.closest('.promptpolish-follow-up-btn')) {
             currentOptimizeButton.button.style.display = 'none';
             currentOptimizeButton = null;
         }
    }
}, true);

document.body.addEventListener('focusout', (event) => {
    if (!isEnabled) return;
    clearTimeout(hideButtonTimeout);
    const targetLosingFocus = event.target;
    if (currentOptimizeButton && targetLosingFocus === currentOptimizeButton.inputElement) {
        const buttonElement = currentOptimizeButton.button;
        hideButtonTimeout = setTimeout(() => {
            const newlyFocusedElement = document.activeElement;
            const focusMovedToButton = buttonElement.contains(newlyFocusedElement);
            const focusMovedToManaged = isRelevantInput(newlyFocusedElement);
            const focusMovedToOverlay = newlyFocusedElement?.closest('#promptpolish-suggestion-overlay');
            const focusMovedToFollowUp = newlyFocusedElement?.closest('.promptpolish-follow-up-btn');
            if (!focusMovedToButton && !focusMovedToManaged && !focusMovedToOverlay && !focusMovedToFollowUp) {
                buttonElement.style.display = 'none';
                if (currentOptimizeButton && currentOptimizeButton.button === buttonElement) currentOptimizeButton = null;
            }
        }, 150);
    }
}, true);

// ================= Initialization and Control =================
function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutationsList) => {
        if (!isEnabled) return;
        let potentiallyRelevantChange = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                         if (node.matches('textarea, input, div[contenteditable="true"], p[contenteditable="true"]') || node.querySelector('textarea, input, div[contenteditable="true"], p[contenteditable="true"]')) {
                             potentiallyRelevantChange = true; break;
                         }
                    }
                }
            }
            if (potentiallyRelevantChange) break;
        }
        if (potentiallyRelevantChange) {
             debouncedFindAndManageInputs(document.body);
             if (window.location.hostname.includes("chat.openai.com")) injectFloatingButtonForChatGPT();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserverAndCleanup() {
    if (observer) { observer.disconnect(); observer = null; }
    managedInputs.forEach(({ button }) => button.remove());
    managedInputs.clear();
    currentOptimizeButton = null;
    document.getElementById("promptpolish-chatgpt-float-btn")?.remove();
    hideSuggestionOverlay();
}

function runInitialization() {
    if (!chrome.runtime?.sendMessage || !chrome.storage?.sync) {
        console.error("[PromptPolish] Core Chrome APIs unavailable.");
        isEnabled = false; return;
    }
    chrome.storage.sync.get(["optimizationEnabled"], (data) => {
        if (chrome.runtime.lastError) { 
            console.error("[PromptPolish] Storage get error:", chrome.runtime.lastError.message);
            isEnabled = true; 
        } else { 
            isEnabled = data.optimizationEnabled !== undefined ? data.optimizationEnabled : true;
        }
        if (isEnabled) {
            injectStyles();
            findAndManageInputs(document.body);
            startObserver();
            if (window.location.hostname.includes("chat.openai.com")) injectFloatingButtonForChatGPT();
        } else {
            stopObserverAndCleanup();
        }
    });
}

if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.optimizationEnabled !== undefined) {
            const wasEnabled = isEnabled;
            isEnabled = changes.optimizationEnabled.newValue ?? true;
            if (isEnabled && !wasEnabled) { runInitialization(); }
            else if (!isEnabled && wasEnabled) { stopObserverAndCleanup(); }
        }
    });
} else { console.warn("[PromptPolish] chrome.storage.onChanged API not available."); }

if (document.readyState === 'complete') { runInitialization(); }
else { window.addEventListener('load', runInitialization, { once: true }); }

// ================= Floating Button Logic (ChatGPT Specific) =================
function injectFloatingButtonForChatGPT() {
    if (!isEnabled) return;
    const containerId = "promptpolish-chatgpt-float-btn";
    const targetInputElement = document.querySelector('textarea[id="prompt-textarea"], textarea[data-id="root"]');
    if (!targetInputElement) { document.getElementById(containerId)?.remove(); return; }
    if (!document.getElementById(containerId)) {
        const floatContainer = document.createElement("div"); floatContainer.id = containerId;
        const button = document.createElement("button"); button.type = "button"; button.id = "promptpolish-chatgpt-float-btn-button"; button.textContent = "Optimize";
        button.addEventListener("click", async (e) => {
            e.preventDefault(); e.stopPropagation();
            const currentInputElement = document.querySelector('textarea[id="prompt-textarea"], textarea[data-id="root"]');
            if (!currentInputElement) { showOverlayNearButton(button, "Could not find the text area to optimize.", 'error'); return; }
            await handleOptimizationRequest(currentInputElement, button, null, null, null); 
        });
        floatContainer.appendChild(button); document.body.appendChild(floatContainer);
    }
}

function showOverlayNearButton(buttonElement, message, type) { 
    const rect = buttonElement.getBoundingClientRect();
    const pseudoInputElement = { 
        getBoundingClientRect: () => rect,
        isContentEditable: false, 
        value: '' 
    };
    showSuggestionOverlay(pseudoInputElement, message, type, '', ''); // Pass empty originalUserTextForComparison
}
