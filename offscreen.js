// PromptPolish Offscreen Script (offscreen.js) V2

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'copyToClipboardOffscreen') {
        const textToCopy = message.text;
        console.log("[Offscreen] Received request to copy via navigator.clipboard:", textToCopy?.substring(0, 100) + "...");

        // Input validation
        if (typeof textToCopy !== 'string') {
             console.error("[Offscreen] Invalid text received:", textToCopy);
             sendResponse({ success: false, error: 'Invalid text received for copying.' });
             return false; // No async response needed
        }

        // Use the modern Clipboard API directly.
        // The offscreen document context *should* allow this.
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                console.log("[Offscreen] navigator.clipboard.writeText successful.");
                sendResponse({ success: true });
            })
            .catch(err => {
                // If navigator.clipboard fails, report the specific error.
                // Do NOT fall back to execCommand as it's unreliable here.
                console.error("[Offscreen] navigator.clipboard.writeText failed:", err);
                // Try to provide a more informative error message
                const errorMessage = err instanceof Error ? err.message : String(err);
                sendResponse({ success: false, error: `Clipboard API Error: ${errorMessage}` });
            });

        // Return true to indicate you wish to send a response asynchronously
        return true;
    }

    // Handle other message types if needed in the future
    console.log("[Offscreen] Received unknown message type:", message.type);
    return false; // No async response for unknown types
});

console.log("Offscreen script v2 loaded and listener added.");

// Optional: Add a keepalive mechanism if the offscreen document closes too quickly,
// although for clipboard triggered by user action it should generally stay open long enough.
// let keepaliveInterval;
// function startKeepalive() {
//     if (!keepaliveInterval) {
//         keepaliveInterval = setInterval(() => {
//             // Simple check to keep the context alive
//             chrome.runtime.getPlatformInfo(info => {});
//             console.log("[Offscreen] Keepalive ping");
//         }, 20 * 1000); // Every 20 seconds
//     }
// }
// function stopKeepalive() {
//     if (keepaliveInterval) {
//         clearInterval(keepaliveInterval);
//         keepaliveInterval = null;
//     }
// }
// startKeepalive(); // Start keepalive when script loads

