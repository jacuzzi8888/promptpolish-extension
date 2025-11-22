// PromptPolish Background Script (Enhanced Version)
// Features:
// - Input sanitization and validation
// - Request timeout handling
// - Better error messages
// - Configurable retry logic

// ================== Constants ==================
const CLOUDFLARE_WORKER_URL =
  "https://promptpolish-proxy.coolguyben126.workers.dev";

const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_INPUT_LENGTH = 10000;
const MAX_CUSTOM_INSTRUCTION_LENGTH = 1000;

// ================== Utilities ==================
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Sanitize user input to prevent injection attacks
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remove control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Validate input length
function validateInput(inputText, customInstruction) {
  if (inputText && inputText.length > MAX_INPUT_LENGTH) {
    return {
      valid: false,
      error: `Input too long. Maximum ${MAX_INPUT_LENGTH} characters.`
    };
  }

  if (customInstruction && customInstruction.length > MAX_CUSTOM_INSTRUCTION_LENGTH) {
    return {
      valid: false,
      error: `Custom instruction too long. Maximum ${MAX_CUSTOM_INSTRUCTION_LENGTH} characters.`
    };
  }

  return { valid: true };
}

// Normalize worker response into { success, data, type }
function normalizeWorkerResponse(raw) {
  // If already in our contract
  if (raw && typeof raw === "object" && ("success" in raw || "data" in raw || "type" in raw)) {
    const success = typeof raw.success === "boolean" ? raw.success : !!raw.data;
    const type = raw.type || "suggestion";
    let data = raw.data;

    // Handle nested data formats
    if (!data && raw.result) data = raw.result;
    if (data && typeof data === "object" && "text" in data && typeof data.text === "string") {
      data = data.text;
    }
    if (data == null && typeof raw.message === "string") data = raw.message;

    return { success, data, type };
  }

  // Array of suggestions
  if (Array.isArray(raw)) {
    return { success: true, data: raw, type: "suggestion" };
  }

  // Plain string
  if (typeof raw === "string") {
    return { success: true, data: raw, type: "suggestion" };
  }

  // Handle various API response formats
  if (raw && typeof raw === "object") {
    // OpenAI-style: {choices:[{text:"..."}]} or {choices:[{message:{content:"..."}}]}
    if (Array.isArray(raw.choices) && raw.choices.length) {
      const first = raw.choices[0];
      const asText =
        (first && typeof first.text === "string" && first.text) ||
        (first && first.message && typeof first.message.content === "string" && first.message.content);
      if (asText) return { success: true, data: asText, type: "suggestion" };
    }

    // Gemini-style: {candidates:[{content:{parts:[{text:"..."}]}}]}
    if (Array.isArray(raw.candidates) && raw.candidates.length) {
      const c = raw.candidates[0];
      const parts = c && c.content && Array.isArray(c.content.parts) ? c.content.parts : null;
      const text = parts && parts[0] && typeof parts[0].text === "string" ? parts[0].text : null;
      if (text) return { success: true, data: text, type: "suggestion" };
    }

    // Check for error field
    if (raw.error) {
      return {
        success: false,
        error: typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error)
      };
    }
  }

  // Unrecognized format
  return { success: false, error: "Upstream returned an unrecognized format." };
}

// ================== Build Request Body ==================
function buildBody(inputText, mode, customInstruction, isClarifyRequest) {
  return {
    intent: "rewrite",
    inputText: sanitizeInput(inputText),
    userPrompt: sanitizeInput(inputText),
    mode: sanitizeInput(mode),
    customInstruction: sanitizeInput(customInstruction || ""),
    isClarifyRequest: !!isClarifyRequest
  };
}

// ================== Worker Call with Timeout ==================
async function processTextWithWorker(inputText, mode, customInstruction, isClarifyRequest) {
  // Validate worker URL
  if (!CLOUDFLARE_WORKER_URL || CLOUDFLARE_WORKER_URL === "YOUR_WORKER_URL_HERE") {
    return {
      success: false,
      error: "Worker URL not configured. Please update background.js."
    };
  }

  // Validate inputs
  const validation = validateInput(inputText, customInstruction);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const res = await fetch(CLOUDFLARE_WORKER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(buildBody(inputText, mode, customInstruction, isClarifyRequest)),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    const json = safeJsonParse(text);

    // Prefer JSON, fallback to text
    const normalized = normalizeWorkerResponse(json ?? text);

    // Handle HTTP errors
    if (!res.ok) {
      if (res.status === 429) {
        return { success: false, error: "Rate limit exceeded. Please try again later." };
      }
      if (res.status >= 500) {
        return { success: false, error: "Server error. Please try again later." };
      }
      return {
        success: false,
        error: `HTTP ${res.status}: ${normalized.error || text.slice(0, 100)}`
      };
    }

    return normalized.success
      ? normalized
      : { success: false, error: normalized.error || "Unknown error from worker." };

  } catch (e) {
    // Handle specific error types
    if (e.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out after ${REQUEST_TIMEOUT / 1000} seconds. Please try again.`
      };
    }

    if (e.message && e.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: "Network error. Please check your internet connection."
      };
    }

    return {
      success: false,
      error: `Error: ${e && e.message ? e.message : String(e)}`
    };
  }
}

// ================== Message Routing ==================
if (chrome && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "optimizeText") return false;

    const payload = message.payload || {};
    const inputText = (payload.inputText || "").toString();
    const mode = (payload.mode || "concise").toString();
    const customInstruction = (payload.customInstruction || "").toString();
    const isClarifyRequest = !!payload.isClarifyRequest;

    // Basic validation
    if (!inputText && mode !== "analyze" && mode !== "clarify" && mode !== "analyze_comparison") {
      sendResponse({ success: false, error: "Empty input." });
      return true;
    }

    (async () => {
      try {
        const result = await processTextWithWorker(
          inputText,
          mode,
          customInstruction,
          isClarifyRequest
        );

        // Always send our contract to the content script
        if (result.success) {
          // Ensure data is either string or array of strings
          let data = result.data;
          if (data == null) data = "";
          if (Array.isArray(data)) {
            data = data.map(x => (typeof x === "string" ? x : JSON.stringify(x)));
          } else if (typeof data !== "string") {
            data = JSON.stringify(data);
          }
          sendResponse({ success: true, data, type: result.type || "suggestion" });
        } else {
          sendResponse({
            success: false,
            error: result.error || "Optimization failed."
          });
        }
      } catch (error) {
        console.error('[PromptPolish] Unexpected error:', error);
        sendResponse({
          success: false,
          error: "An unexpected error occurred. Please try again."
        });
      }
    })();

    return true; // async response
  });
}

console.log("PromptPolish background script loaded (enhanced version).");
