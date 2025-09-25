// PromptPolish Background Script (background.js)

// --- Constants ---
const CLOUDFLARE_WORKER_URL = "https://promptpolish-proxy.coolguyben126.workers.dev";

// --- Helper: Function to show Chrome Notification ---
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
    } catch (listenerError) { console.error("Error adding chrome.alarms.onAlarm listener:", listenerError); }
}

// --- Helper: Function to call the Cloudflare Worker ---
async function processTextWithWorker(inputText, mode, customInstruction, isSummaryRequest = false) {
    if (CLOUDFLARE_WORKER_URL === "YOUR_WORKER_URL_HERE" || !CLOUDFLARE_WORKER_URL) { return { success: false, error: "Extension configuration error: Worker URL missing." }; }
    const workerRequestBody = { inputText, mode, customInstruction, isSummaryRequest };
    try {
        const response = await fetch(CLOUDFLARE_WORKER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workerRequestBody) });
        if (!response.ok) { let errorMsg = `Worker request failed: ${response.status} ${response.statusText}`; try { const errorBody = await response.json(); if (errorBody.error) { errorMsg += ` - ${errorBody.error}`; } } catch(e) { /* Ignore */ } return { success: false, error: errorMsg }; }
        const result = await response.json(); if (!result || typeof result.success !== 'boolean') { return { success: false, error: "Invalid response format received from Worker." }; }
        return result;
    } catch (error) { return { success: false, error: error.message || "An unknown error occurred contacting the Worker." }; }
}

// --- Listener for Messages from Content Script ---
if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'optimizeText') {
            const { inputText, mode, customInstruction } = message.payload;
            processTextWithWorker(inputText, mode, customInstruction, false)
                .then(result => {
                    try {
                        if (sender.tab) {
                             sendResponse(result);
                        }
                    } catch (e) {
                        console.warn("Failed to send response back to content script (tab might have closed):", e.message);
                    }
                })
                .catch(error => {
                    try {
                         if (sender.tab) {
                            sendResponse({ success: false, error: error.message || "Unknown error processing request in background." });
                         }
                    } catch (e) {
                         console.warn("Failed to send error response back to content script (tab might have closed):", e.message);
                    }
                });
            return true; // Indicate asynchronous response
        }
        return false;
    });
}

console.log("PromptPolish background script loaded.");
