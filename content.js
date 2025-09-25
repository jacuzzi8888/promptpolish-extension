/**
 * content.js for PromptPolish Chrome Extension
 * Version: v16.1 - Bug Fix
 * - Fixed a recursive loop in the showOverlayNearButton function that caused script crashes.
 * - All other features (Custom Rules, Diff View, Retry, Fade Logic) are retained.
 */

console.log("PromptPolish content script loaded (v16.1 - Bug Fix).");

// ================= State Variables =================
let customRules = []; // To store user-defined rules
const managedInputs = new WeakMap();
let currentActiveButton = null; 
let isEnabled = true; 
let observer = null;
let lastOriginalUserText = "";

// ================= Diff Utility =================
function generateDiffHtml(oldStr, newStr) {
    const oldWords = oldStr.split(/(\s+)/);
    const newWords = newStr.split(/(\s+)/);
    let i = 0, j = 0;
    const result = [];

    while (i < oldWords.length || j < newWords.length) {
        if (i < oldWords.length && j < newWords.length && oldWords[i] === newWords[j]) {
            result.push(oldWords[i]);
            i++;
            j++;
        } else {
            const delBuffer = [];
            const insBuffer = [];
            
            let syncPoint = -1;
            for (let k = i; k < oldWords.length; k++) {
                const idx = newWords.indexOf(oldWords[k], j);
                if (idx !== -1) {
                    syncPoint = idx;
                    for (let l = i; l < k; l++) {
                        delBuffer.push(oldWords[l]);
                    }
                    break;
                }
            }

            if (syncPoint !== -1) {
                for (let k = j; k < syncPoint; k++) {
                    insBuffer.push(newWords[k]);
                }
            } else {
                for (let k = i; k < oldWords.length; k++) {
                    delBuffer.push(oldWords[k]);
                }
                for (let k = j; k < newWords.length; k++) {
                    insBuffer.push(newWords[k]);
                }
            }
            
            if (delBuffer.length > 0) {
                result.push(`<del>${delBuffer.join('')}</del>`);
            }
            if (insBuffer.length > 0) {
                result.push(`<ins>${insBuffer.join('')}</ins>`);
            }
            
            if (syncPoint !== -1) {
                 i += delBuffer.length;
                 j += insBuffer.length;
            } else {
                 i = oldWords.length;
                 j = newWords.length;
            }
        }
    }
    return result.join('');
}


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
const ERROR_BG_COLOR = "#F8D7DA";
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
const FADE_BUTTON_DELAY = 3000;

// SVG Icons
const MAGIC_WAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M14 9l1-1"/><path d="M17 11l1-1"/><path d="M9 4l1-1"/><path d="M12 6l1-1"/><path d="M3 21l9-9"/><path d="M15 16l-4 4h6v-2Z"/></svg>`;
const WARNING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const INFO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
const QUESTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`;
const DISMISS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const LOADING_SPINNER_SVG = `<svg width="14" height="14" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="${TEXT_COLOR_MEDIUM}"><path d="M73,50c0-12.7-10.3-23-23-23S27,37.3,27,50 M30.9,50c0-10.5,8.5-19.1,19.1-19.1S69.1,39.5,69.1,50"><animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="0 50 50" to="360 50 50" repeatCount="indefinite"></animateTransform></path></svg>`;
const RECYCLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;

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
    return overlay;
}

function showSuggestionOverlay(inputElement, buttonElement, resultData, resultType = 'suggestion', originalMode = '', originalUserTextForComparison = '') {
    const overlay = createSuggestionOverlay();
    overlay.style.borderLeft = 'none'; overlay.style.padding = '8px'; overlay.style.backgroundColor = '#FFFFFF'; overlay.style.color = TEXT_COLOR_DARK; overlay.style.cursor = 'default'; overlay.style.maxWidth = '400px'; overlay.style.width = 'auto';

    switch (resultType) {
        case 'error': {
            const iconSvg = WARNING_SVG; const title = "Error:"; const borderColor = ERROR_BORDER_COLOR; const textColor = ERROR_TEXT_COLOR;
            const container = document.createElement('div'); container.style.display = 'flex'; container.style.alignItems = 'flex-start'; container.style.gap = '8px'; container.style.padding = '10px 12px'; container.style.paddingRight = '30px';
            const iconContainer = document.createElement('div'); iconContainer.innerHTML = iconSvg; iconContainer.style.marginTop = '2px'; iconContainer.style.color = textColor;
            const textContainer = document.createElement('div'); textContainer.style.flexGrow = '1';
            const displayData = resultData || "An unknown error occurred.";
            textContainer.innerHTML = `<strong style="color: ${textColor};">${title}</strong><br>${String(displayData).replace(/\n/g, '<br>')}`;
            container.appendChild(iconContainer); container.appendChild(textContainer);

            const retryButton = document.createElement('button');
            retryButton.textContent = "Retry";
            retryButton.className = 'promptpolish-retry-btn';
            retryButton.onclick = (e) => {
                e.stopPropagation();
                hideSuggestionOverlay();
                handleOptimizationRequest(inputElement, buttonElement, originalUserTextForComparison, originalMode, null);
            };
            textContainer.appendChild(document.createElement('br'));
            textContainer.appendChild(retryButton);

            overlay.appendChild(container);
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
                const listItem = document.createElement("li");
                listItem.style.padding = "10px 12px"; listItem.style.cursor = "pointer"; listItem.style.borderRadius = "6px"; listItem.style.transition = "background-color 0.15s ease"; listItem.style.display = 'flex'; listItem.style.alignItems = 'flex-start'; listItem.style.gap = '8px'; const numberSpan = document.createElement('span'); numberSpan.textContent = `${index + 1}.`; numberSpan.style.fontWeight = '500'; numberSpan.style.color = TEXT_COLOR_MEDIUM; numberSpan.style.minWidth = '15px'; numberSpan.style.textAlign = 'right'; const textSpan = document.createElement('span'); textSpan.textContent = suggestionText; textSpan.style.flexGrow = '1'; listItem.appendChild(numberSpan); listItem.appendChild(textSpan); if (index < suggestions.length - 1) { listItem.style.borderBottom = `1px solid ${BORDER_COLOR}`; } listItem.onmouseover = () => { listItem.style.backgroundColor = MEDIUM_GREY_BG; }; listItem.onmouseout = () => { listItem.style.backgroundColor = "transparent"; };
                
                listItem.addEventListener("click", (e) => { 
                    e.stopPropagation(); 
                    if (inputElement.isContentEditable) {
                        inputElement.focus();
                        const range = document.createRange();
                        range.selectNodeContents(inputElement);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(suggestionText));
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } else { 
                        inputElement.value = suggestionText; 
                    } 
                    inputElement.focus(); 
                    const inputEvent = new Event('input', { bubbles: true, composed: true }); 
                    inputElement.dispatchEvent(inputEvent); 
                    hideSuggestionOverlay(); 
                }); 
                list.appendChild(listItem);
            }); 
            overlay.appendChild(list);

            if (suggestions.length > 0 && originalUserTextForComparison && originalUserTextForComparison !== suggestions[0]) {
                const diffContainer = document.createElement('div');
                diffContainer.className = 'promptpolish-diff-container';
                diffContainer.style.display = 'none';
                diffContainer.style.padding = '8px 12px';
                diffContainer.style.borderTop = `1px solid ${BORDER_COLOR}`;
                diffContainer.style.marginTop = '8px';

                const diffContent = document.createElement('div');
                diffContent.className = 'promptpolish-diff-view';
                diffContent.innerHTML = generateDiffHtml(originalUserTextForComparison, suggestions[0]);
                diffContainer.appendChild(diffContent);
                
                const diffToggle = document.createElement('button');
                diffToggle.textContent = 'Compare Changes';
                diffToggle.className = 'promptpolish-diff-toggle';
                diffToggle.onclick = (e) => {
                    e.stopPropagation();
                    const isHidden = diffContainer.style.display === 'none';
                    diffContainer.style.display = isHidden ? 'block' : 'none';
                    diffToggle.textContent = isHidden ? 'Hide Changes' : 'Compare Changes';
                };
                
                overlay.appendChild(diffToggle);
                overlay.appendChild(diffContainer);
            }


            if (suggestions.length > 0 && originalUserTextForComparison) {
                const followUpContainer = document.createElement('div');
                followUpContainer.className = 'promptpolish-follow-up-actions';
                Object.assign(followUpContainer.style, { padding: '8px 12px 4px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap'});

                const actions = [
                    { label: "Make Formal", mode: "formal" }, { label: "More Creative", mode: "creative" },
                    { label: "More Concise", mode: "concise" }, { label: "Why is this better?", mode: "analyze_comparison" } 
                ];

                actions.forEach(action => {
                    if (action.mode === originalMode && originalMode !== 'analyze_comparison') return; 

                    const button = document.createElement('button');
                    button.className = 'promptpolish-follow-up-btn';
                    button.innerHTML = `${RECYCLE_SVG} ${action.label}`;
                    button.onclick = (e) => {
                        e.stopPropagation();
                        const currentSuggestionText = suggestions[0]; 
                        hideSuggestionOverlay(); 
                        
                        const buttonToAnimate = managedInputs.get(inputElement)?.button || currentActiveButton;

                        if (buttonToAnimate && inputElement) {
                            if (action.mode === "analyze_comparison") {
                                handleOptimizationRequest(inputElement, buttonToAnimate, originalUserTextForComparison, action.mode, currentSuggestionText);
                            } else {
                                handleOptimizationRequest(inputElement, buttonToAnimate, currentSuggestionText, action.mode, null);
                            }
                        } else {
                            console.warn("Cannot re-process: context not found.");
                            showOverlayNearButton(buttonElement, "Error: Could not initiate follow-up action.", "error");
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
    overlay.style.top = topPosition + "px";
    overlay.style.left = leftPosition + "px";
    overlay.style.display = "block";
}

function hideSuggestionOverlay() {
    const overlay = document.getElementById("promptpolish-suggestion-overlay");
    if (overlay) { 
        overlay.style.display = "none"; 
    }
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

async function callBackgroundForOptimization(text, mode, customInstructionPayload, isClarifyRequest = false) {
    return new Promise((resolve, reject) => {
        if (!chrome.runtime?.sendMessage) return reject(new Error("Messaging API unavailable."));
        chrome.runtime.sendMessage(
            { 
                type: "optimizeText", 
                payload: { 
                    inputText: text, 
                    mode: mode, 
                    customInstruction: customInstructionPayload,
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

async function handleOptimizationRequest(inputElement, buttonElement, initialText = null, initialMode = null, customInstructionForFollowUp = null) {
    let userTextForRequest; 
    let customInstructionPayloadForWorker;
    let originalTextForThisRequestCycle;

    if (initialMode === "analyze_comparison") {
        userTextForRequest = initialText;
        customInstructionPayloadForWorker = customInstructionForFollowUp;
        originalTextForThisRequestCycle = initialText;
    } else if (initialText !== null) {
        userTextForRequest = initialText;
        const settingsForCustom = await getSettings();
        customInstructionPayloadForWorker = (initialMode === "custom") ? settingsForCustom.customInstruction : "";
        originalTextForThisRequestCycle = lastOriginalUserText;
    } else {
        userTextForRequest = (inputElement.isContentEditable) ? inputElement.innerText.trim() : inputElement.value.trim();
        lastOriginalUserText = userTextForRequest;
        originalTextForThisRequestCycle = userTextForRequest;
        const settingsForCustom = await getSettings();
        customInstructionPayloadForWorker = settingsForCustom.customInstruction; 
    }

    const originalButtonContent = buttonElement.innerHTML;
    const originalButtonText = buttonElement.textContent;
    const isFloatingButton = buttonElement.closest('#promptpolish-chatgpt-float-btn');
    
    buttonElement.disabled = true; buttonElement.style.opacity = '0.7'; buttonElement.style.cursor = 'wait';
    if (isFloatingButton) { buttonElement.textContent = "Processing..."; buttonElement.style.backgroundColor = "#aaa"; buttonElement.style.boxShadow = "none"; } 
    else { buttonElement.innerHTML = LOADING_SPINNER_SVG; }
    
    if (initialText === null) {
        hideSuggestionOverlay(); 
    }

    try {
        const settings = await getSettings(); 
        let effectiveMode = initialMode || settings.mode;
        let isClarifyRequest = false;

        if (initialText === null && effectiveMode !== 'analyze' && effectiveMode !== 'analyze_comparison' && settings.autoClarifyEnabled && isPromptVague(userTextForRequest)) {
            effectiveMode = "clarify";
            isClarifyRequest = true;
        } else if (!userTextForRequest && !['analyze', 'clarify', 'analyze_comparison'].includes(effectiveMode) ) {
            showSuggestionOverlay(inputElement, buttonElement, "Input is empty. Please type a prompt.", 'error', effectiveMode, originalTextForThisRequestCycle);
            return;
        }
        
        let finalCustomInstructionForWorker;
        if (effectiveMode === "analyze_comparison") {
            finalCustomInstructionForWorker = customInstructionPayloadForWorker;
        } else if (effectiveMode === "custom") {
            finalCustomInstructionForWorker = customInstructionPayloadForWorker || settings.customInstruction;
        } else {
            finalCustomInstructionForWorker = "";
        }
        
        const response = await callBackgroundForOptimization(userTextForRequest, effectiveMode, finalCustomInstructionForWorker, isClarifyRequest);
        const displayType = response.type || (isClarifyRequest ? 'clarification' : (['analyze', 'analyze_comparison'].includes(effectiveMode) ? 'analysis' : 'suggestion'));
        
        if (displayType === 'analysis' || displayType === 'clarification') {
            showSuggestionOverlay(inputElement, buttonElement, response.data, displayType, effectiveMode, originalTextForThisRequestCycle);
        } else if (response.data) {
            let suggestions = Array.isArray(response.data) ? response.data : [response.data];
            suggestions = suggestions.map(s => s.trim().replace(/^"|"$/g, ''));

            const validSuggestions = (initialText !== null && effectiveMode !== "analyze_comparison") 
                ? suggestions 
                : suggestions.filter(text => text !== userTextForRequest);
            
            if (validSuggestions.length > 0) {
                showSuggestionOverlay(inputElement, buttonElement, validSuggestions, 'suggestion', effectiveMode, originalTextForThisRequestCycle);
            } else if (suggestions.length > 0 && suggestions[0] === userTextForRequest && initialText === null) { 
                 showSuggestionOverlay(inputElement, buttonElement, "No significant changes suggested by AI.", 'analysis', effectiveMode, originalTextForThisRequestCycle);
            } else if (suggestions.length > 0 && initialText !== null) {
                showSuggestionOverlay(inputElement, buttonElement, suggestions, 'suggestion', effectiveMode, originalTextForThisRequestCycle);
            } else {
                showSuggestionOverlay(inputElement, buttonElement, "No different suggestions found or AI returned empty.", 'error', effectiveMode, originalTextForThisRequestCycle);
            }
        } else {
             showSuggestionOverlay(inputElement, buttonElement, "Received no data from the AI.", 'error', effectiveMode, originalTextForThisRequestCycle);
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const currentModeForError = initialMode || (await getSettings()).mode;
        const originalTextForError = userTextForRequest;

        if (errorMsg.includes("Could not establish connection") || errorMsg.includes("Connection failed")) {
            showSuggestionOverlay(inputElement, buttonElement, "Error: Connection to background service failed.", 'error', currentModeForError, originalTextForError);
        } else if (errorMsg.includes("Worker URL missing")) {
             showSuggestionOverlay(inputElement, buttonElement, "Error: Extension configuration issue.", 'error', currentModeForError, originalTextForError);
        } else {
            showSuggestionOverlay(inputElement, buttonElement, `Operation failed: ${errorMsg}`, 'error', currentModeForError, originalTextForError);
        }
        console.error("[PromptPolish] Operation failed:", error);
    } finally {
        buttonElement.disabled = false; buttonElement.style.opacity = '1'; buttonElement.style.cursor = 'pointer';
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
        #promptpolish-chatgpt-float-btn button { font-family: system-ui, sans-serif; font-size: 14px; font-weight: 500; padding: 8px 16px; border: none; border-radius: 6px; background-color: ${ACCENT_COLOR}; color: #fff; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: background-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; }
        #promptpolish-chatgpt-float-btn button:hover:not(:disabled) { background-color: ${ACCENT_COLOR_DARK}; box-shadow: 0 4px 8px rgba(0,0,0,0.25); }
        #promptpolish-chatgpt-float-btn button:disabled { background-color: #aaa; cursor: wait; box-shadow: none; opacity: 0.7; }
        .promptpolish-optimize-btn { 
            position: absolute; width: 22px; height: 22px; border-radius: 4px; border: 1px solid ${BORDER_COLOR}; 
            background-color: #FFFFFF; color: ${TEXT_COLOR_MEDIUM}; cursor: pointer; padding: 0; z-index: 9999; 
            display: none; align-items: center; justify-content: center; line-height: 0; 
            box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
            transition: opacity 0.3s ease-in-out;
            opacity: 1;
        }
        .promptpolish-optimize-btn.faded {
            opacity: 0.3;
        }
        .promptpolish-optimize-btn:hover:not(:disabled) { 
            opacity: 1 !important;
        }
        .promptpolish-optimize-btn:disabled { cursor: wait; opacity: 0.7; }
        .promptpolish-analysis-content::-webkit-scrollbar { width: ${SCROLLBAR_WIDTH}; }
        .promptpolish-analysis-content::-webkit-scrollbar-track { background: ${SCROLLBAR_TRACK_COLOR}; border-radius: 3px; }
        .promptpolish-analysis-content::-webkit-scrollbar-thumb { background-color: ${SCROLLBAR_THUMB_COLOR}; border-radius: 3px; border: 1px solid ${SCROLLBAR_TRACK_COLOR}; }
        .promptpolish-analysis-content::-webkit-scrollbar-thumb:hover { background-color: ${SCROLLBAR_THUMB_HOVER_COLOR}; }
        .promptpolish-analysis-content { scrollbar-width: thin; scrollbar-color: ${SCROLLBAR_THUMB_COLOR} ${SCROLLBAR_TRACK_COLOR}; }
        .promptpolish-follow-up-btn { background-color: #f0f0f0; color: #333; border: 1px solid #ddd; padding: 4px 8px; font-size: 12px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: background-color 0.15s ease; margin-top: 4px; }
        .promptpolish-follow-up-btn:hover { background-color: #e0e0e0; }
        .promptpolish-retry-btn { background-color: ${ERROR_BG_COLOR}; color: ${ERROR_TEXT_COLOR}; border: 1px solid ${ERROR_BORDER_COLOR}; padding: 4px 10px; font-size: 13px; border-radius: 4px; cursor: pointer; transition: background-color 0.15s ease; margin-top: 8px; }
        .promptpolish-retry-btn:hover { background-color: #f1c6ca; }
        .promptpolish-diff-toggle { background: none; border: none; color: ${ACCENT_COLOR_DARK}; font-size: 13px; cursor: pointer; padding: 4px 0; margin: 4px 12px 0; }
        .promptpolish-diff-view { line-height: 1.6; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
        .promptpolish-diff-view del { background-color: #ffebe9; color: #c0392b; text-decoration: none; }
        .promptpolish-diff-view ins { background-color: #e6ffed; color: #27ae60; text-decoration: none; }
    `;
    document.head.appendChild(styleSheet);
}

function manageFoundInput(inputElement) {
    if (!isEnabled || !isRelevantInput(inputElement) || managedInputs.has(inputElement)) {
        return;
    }

    const button = document.createElement('button');
    button.type = "button"; 
    button.innerHTML = MAGIC_WAND_SVG; 
    button.title = 'Optimize with PromptPolish'; 
    button.classList.add('promptpolish-optimize-btn');
    document.body.appendChild(button);

    managedInputs.set(inputElement, { button: button, hideTimeout: null, fadeTimeout: null });

    button.addEventListener('click', async (event) => {
        event.stopPropagation();
        event.preventDefault();
        const managedData = managedInputs.get(inputElement);
        if (managedData) {
            if (managedData.hideTimeout) clearTimeout(managedData.hideTimeout);
            if (managedData.fadeTimeout) clearTimeout(managedData.fadeTimeout);
        }
        await handleOptimizationRequest(inputElement, button, null, null, null);
    });

    const startFadeTimer = () => {
        const managedData = managedInputs.get(inputElement);
        if (!managedData) return;
        if (managedData.fadeTimeout) clearTimeout(managedData.fadeTimeout);
        managedData.fadeTimeout = setTimeout(() => {
            button.classList.add('faded');
        }, FADE_BUTTON_DELAY);
    };

    inputElement.addEventListener('focus', () => {
        const managedData = managedInputs.get(inputElement);
        if (!managedData) return;

        if (managedData.hideTimeout) clearTimeout(managedData.hideTimeout);
        
        button.classList.remove('faded');
        if (currentActiveButton && currentActiveButton !== button) {
            currentActiveButton.style.display = 'none';
        }
        positionButton(button, inputElement);
        button.style.display = 'flex';
        currentActiveButton = button;
        startFadeTimer();
    });

    inputElement.addEventListener('input', () => {
        const managedData = managedInputs.get(inputElement);
        if (!managedData) return;
        button.classList.remove('faded');
        if (managedData.fadeTimeout) clearTimeout(managedData.fadeTimeout);
        startFadeTimer();
    });

    inputElement.addEventListener('blur', () => {
        const managedData = managedInputs.get(inputElement);
        if (!managedData) return;
        
        if (managedData.fadeTimeout) clearTimeout(managedData.fadeTimeout);

        managedData.hideTimeout = setTimeout(() => {
            if (document.activeElement !== button && !document.activeElement.closest('#promptpolish-suggestion-overlay')) {
                 button.style.display = 'none';
                 if (currentActiveButton === button) {
                     currentActiveButton = null;
                 }
            }
        }, 150);
    });
}

function positionButton(button, inputElement) {
    try {
        const rect = inputElement.getBoundingClientRect();
        button.style.visibility = 'hidden';
        button.style.display = 'flex';
        const buttonHeight = button.offsetHeight; 
        const buttonWidth = button.offsetWidth;
        button.style.display = 'none';
        button.style.visibility = 'visible';

        if (!buttonHeight || !buttonWidth) return;
        
        const topOffset = Math.max(3, Math.min(5, rect.height / 4));
        const rightOffset = Math.max(3, Math.min(5, rect.width / 10));

        let top = rect.top + window.scrollY + topOffset;
        let left = rect.right + window.scrollX - buttonWidth - rightOffset;

        button.style.top = `${top}px`;
        button.style.left = `${left}px`;
    } catch (error) {
        console.error("Error positioning button:", error);
        button.style.display = 'none';
    }
}

// ================= Initialization and Control =================
function findAndManageAllInputs(rootNode = document.body) {
    if (!isEnabled || !rootNode) return;
    const potentialInputs = rootNode.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="number"], div[contenteditable="true"], p[contenteditable="true"]');
    potentialInputs.forEach(manageFoundInput);
}

function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutationsList) => {
        if (!isEnabled) return;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        manageFoundInput(node);
                        findAndManageAllInputs(node);
                    }
                });
            }
        }
        if (window.location.hostname.includes("chat.openai.com")) {
            injectFloatingButtonForChatGPT();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserverAndCleanup() {
    if (observer) { observer.disconnect(); observer = null; }
    if (currentActiveButton) {
        currentActiveButton.style.display = 'none';
        currentActiveButton = null;
    }
    document.getElementById("promptpolish-chatgpt-float-btn")?.remove();
    hideSuggestionOverlay();
}

function initializeSingletonClickHandler() {
    document.addEventListener("click", (e) => {
        const overlay = document.getElementById("promptpolish-suggestion-overlay");
        if (!overlay || overlay.style.display === 'none') {
            return;
        }
        const isClickInsideOverlay = overlay.contains(e.target);
        const isClickOnAnyOptimizeButton = e.target.closest('.promptpolish-optimize-btn, #promptpolish-chatgpt-float-btn button');
        
        if (!isClickInsideOverlay && !isClickOnAnyOptimizeButton) {
            hideSuggestionOverlay();
        }
    }, true);
}

function runInitialization() {
    if (!chrome.runtime?.sendMessage || !chrome.storage?.sync) {
        console.error("[PromptPolish] Core Chrome APIs unavailable.");
        isEnabled = false; return;
    }

    chrome.storage.sync.get(["optimizationEnabled", "customRules"], (data) => {
        if (chrome.runtime.lastError) { 
            console.error("[PromptPolish] Storage get error:", chrome.runtime.lastError.message);
            isEnabled = true; 
        } else { 
            isEnabled = data.optimizationEnabled !== false;
            customRules = data.customRules || [];
        }

        if (isEnabled) {
            injectStyles();
            findAndManageAllInputs();
            startObserver();
            initializeSingletonClickHandler();
            if (window.location.hostname.includes("chat.openai.com")) {
                injectFloatingButtonForChatGPT();
            }
        } else {
            stopObserverAndCleanup();
        }
    });
}

if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'sync') return;

        if (changes.optimizationEnabled !== undefined) {
            const wasEnabled = isEnabled;
            isEnabled = changes.optimizationEnabled.newValue ?? true;
            if (isEnabled && !wasEnabled) { runInitialization(); }
            else if (!isEnabled && wasEnabled) { stopObserverAndCleanup(); }
        }

        if (changes.customRules !== undefined) {
            customRules = changes.customRules.newValue || [];
            if (isEnabled) {
                findAndManageAllInputs();
            }
        }
    });
}

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
            if (!currentInputElement) { 
                showOverlayNearButton(button, "Could not find the text area to optimize.", 'error'); 
                return; 
            }
            await handleOptimizationRequest(currentInputElement, button, null, null, null); 
        });
        floatContainer.appendChild(button); document.body.appendChild(floatContainer);
    }
}

function showOverlayNearButton(buttonElement, message, type, originalMode = '', originalUserTextForComparison = '') { 
    const rect = buttonElement.getBoundingClientRect();
    const pseudoInputElement = { 
        getBoundingClientRect: () => rect,
        isContentEditable: false, 
        value: '' 
    };
    showSuggestionOverlay(pseudoInputElement, buttonElement, message, type, originalMode, originalUserTextForComparison);
}
