// PromptPolish Background Script (background.js) V10 - Context Menu Removed
// Only handles messages from content script and calls Worker.

// --- Initial API Availability Check ---
console.log('Initial check: chrome.offscreen =', typeof chrome.offscreen, chrome.offscreen); // Offscreen API no longer used here
console.log('Initial check: chrome.alarms =', typeof chrome.alarms, chrome.alarms);
// console.log('Initial check: chrome.contextMenus =', typeof chrome.contextMenus, chrome.contextMenus); // Context Menu API no longer used
console.log('Initial check: chrome.storage =', typeof chrome.storage, chrome.storage);
console.log('Initial check: chrome.notifications =', typeof chrome.notifications, chrome.notifications);
console.log('Initial check: chrome.runtime =', typeof chrome.runtime, chrome.runtime);

// --- Constants ---
// Removed context menu IDs
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html'; // Keep in case needed later, but functions removed

// !!! User's Cloudflare Worker URL !!!
const CLOUDFLARE_WORKER_URL = "https://promptpolish-proxy.coolguyben126.workers.dev";

// --- Helper: Function to show Chrome Notification ---
// (Kept for showing errors from message handler)
function showNotification(title, message, notificationIdSuffix = Date.now()) {
    const notificationId = `promptpolish-notify-${notificationIdSuffix}`;
    const alarmName = `clear-notification-${notificationId}`;
    if (!chrome.notifications) { console.error("chrome.notifications API not available."); return; }
    chrome.notifications.create(notificationId, { type: 'basic', iconUrl: 'icons/icon48_circle.png', title: title, message: message, priority: 0 }, (createdId) => {
        if (chrome.runtime.lastError) { console.error("Notification creation error:", chrome.runtime.lastError.message);
        } else if (chrome.alarms) { try { chrome.alarms.create(alarmName, { delayInMinutes: 4.5 / 60 }); } catch (alarmError) { console.error("Error creating notification clear alarm:", alarmError); }
        } else { console.warn("chrome.alarms API not available, cannot schedule notification clearing."); }
    });
}

// Listener for alarms to clear notifications
if (chrome.alarms) {
    try {
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name.startsWith('clear-notification-')) {
                const notificationId = alarm.name.replace('clear-notification-', '');
                if (chrome.notifications) { chrome.notifications.clear(notificationId, () => { if (chrome.runtime.lastError) {/* Ignore */} }); }
            }
        });
    } catch (listenerError) { console.error("Error adding chrome.alarms.onAlarm listener:", listenerError); showNotification("PromptPolish Warning", "Failed to set up automatic notification clearing."); }
} else { console.warn("chrome.alarms API not available. Automatic notification clearing via alarms is disabled."); }


// --- Offscreen Document Management Functions REMOVED ---
// copyViaOffscreen, createOffscreenDocument, hasOffscreenDocument, closeOffscreenDocument
// are removed as they were only used by the context menu click handler.

// --- Helper: Function to call the Cloudflare Worker ---
// (Unchanged - still needed for message handler)
async function processTextWithWorker(inputText, mode, customInstruction, isSummaryRequest = false) {
    console.log(`[Background] Processing text via Worker. Mode: ${mode}, Summary: ${isSummaryRequest}`);
    if (CLOUDFLARE_WORKER_URL === "YOUR_WORKER_URL_HERE" || !CLOUDFLARE_WORKER_URL) { console.error("Cloudflare Worker URL is not configured."); return { success: false, error: "Extension configuration error: Worker URL missing." }; }
    const workerRequestBody = { inputText, mode, customInstruction, isSummaryRequest };
    try {
        console.log(`[Background] Fetching from Worker URL: ${CLOUDFLARE_WORKER_URL}`);
        const response = await fetch(CLOUDFLARE_WORKER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workerRequestBody) });
        console.log(`[Background] Worker response status: ${response.status}`);
        if (!response.ok) { let errorMsg = `Worker request failed: ${response.status} ${response.statusText}`; try { const errorBody = await response.json(); if (errorBody.error) { errorMsg += ` - ${errorBody.error}`; } } catch(e) { /* Ignore */ } console.error("Error response from Worker:", errorMsg); return { success: false, error: errorMsg }; }
        const result = await response.json(); if (!result || typeof result.success !== 'boolean') { console.error("Invalid response format from Worker:", result); return { success: false, error: "Invalid response format received from Worker." }; }
        console.log("[Background] Received result from Worker:", result); return result;
    } catch (error) { console.error("[Background] Worker Fetch Operation failed:", error); return { success: false, error: error.message || "An unknown error occurred contacting the Worker." }; }
}


// --- Setup Context Menus on Installation REMOVED ---
// chrome.runtime.onInstalled listener is removed.

// --- Listen for Context Menu Clicks REMOVED ---
// chrome.contextMenus.onClicked listener is removed.


// --- Listener for Messages from Content Script ---
// (This remains essential for the in-page buttons)
if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'optimizeText') {
            console.log('[Background] Received optimizeText message from content script:', message.payload);
            const { inputText, mode, customInstruction } = message.payload;
            // Call the function that contacts the Worker
            processTextWithWorker(inputText, mode, customInstruction, false) // isSummaryRequest is false here
                .then(result => {
                    console.log("[Background] Sending response back to content script:", result);
                    try {
                        // Check if sendResponse is still valid before calling
                        if (sender.tab) { // Basic check if sender context might still exist
                             sendResponse(result);
                        } else {
                             console.warn("Sender context lost, cannot send response back to content script.");
                        }
                    } catch (e) {
                        // Catch errors if the tab/frame was closed before response sent
                        console.warn("Failed to send response back to content script (tab might have closed):", e.message);
                    }
                })
                .catch(error => {
                    // Handle potential errors during the async processing
                    console.error("[Background] Error processing optimizeText message:", error);
                    try {
                         if (sender.tab) { // Basic check if sender context might still exist
                            sendResponse({ success: false, error: error.message || "Unknown error processing request in background." });
                         } else {
                              console.warn("Sender context lost, cannot send error response back to content script.");
                         }
                    } catch (e) {
                         console.warn("Failed to send error response back to content script (tab might have closed):", e.message);
                    }
                });
            return true; // Indicate asynchronous response
        }
        // Handle other message types in the future if needed
        // else if (message.type === 'someOtherType') { ... }

        return false; // Indicate synchronous response or no response for unhandled messages
    });
} else {
    console.warn("chrome.runtime.onMessage API not available.");
}

console.log("PromptPolish background script loaded (v10 - Context Menu Removed).");
