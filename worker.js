/**
 * PromptPolish Cloudflare Worker (v2.0)
 * Features:
 * - CO-STAR Framework Prompts
 * - XML Spotlighting for Security
 * - 7 Optimization Modes (Concise, Creative, Professional, Casual, Persuasive, Synthesizer, Debugger)
 * - Deep Polish Mode (Chain-of-Thought)
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
        }

        try {
            const { inputText, mode, customInstruction, deepPolish } = await request.json();

            if (!inputText) {
                return new Response(JSON.stringify({ error: "Input text is required" }), {
                    status: 400,
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }

            // Select System Prompt based on Mode
            let systemPrompt = getSystemPrompt(mode, customInstruction);

            // Adjust for Deep Polish (Chain-of-Thought)
            if (deepPolish) {
                systemPrompt = getDeepPolishPrompt(customInstruction);
            }

            // Call Gemini API
            // const apiKey = "AIzaSyA4WxbQ2ba5EaWXivIYM9-2g9d4SyFZbOw"; // Hardcoded for debugging
            const apiKey = env.GEMINI_API_KEY;

            if (!apiKey) {
                throw new Error("Configuration Error: GEMINI_API_KEY is missing in worker environment.");
            }

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: systemPrompt + "\n\n<user_input>\n" + inputText + "\n</user_input>" }]
                    }
                ],
                generationConfig: {
                    temperature: deepPolish ? 0.7 : (mode === 'creative' ? 0.9 : 0.3),
                    maxOutputTokens: deepPolish ? 2048 : 1000,
                }
            };

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.error?.message || "Gemini API error";
                console.error("Gemini API Failed:", JSON.stringify(data));
                throw new Error(`Gemini API Error: ${errorMessage}`);
            }

            let optimizedText = data.candidates[0].content.parts[0].text;

            // Clean up Deep Polish output (remove reasoning steps if present)
            if (deepPolish) {
                // In a real implementation, we might want to parse out the final output
                // For now, we assume the model follows instructions to output ONLY the final text
                // or we could use regex to extract it if we enforced a specific tag in the output
            }

            return new Response(JSON.stringify({ success: true, data: optimizedText }), {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });

        } catch (error) {
            console.error("Worker Error:", error.message);
            return new Response(JSON.stringify({ success: false, error: error.message }), {
                status: 500,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }
    },
};

// ================== PROMPT LIBRARY ==================

function getSystemPrompt(mode, customRules) {
    const rules = customRules ? `<user_constraints>${customRules}</user_constraints>` : "";

    const prompts = {
        concise: `You are an Expert Editor utilizing the "Brevity" framework.
<mission>
Rewrite the <user_input> to be ruthlessly efficient. Eliminate redundancy, filter out filler words, and maximize information density.
</mission>
<constraints>
1. Use active voice exclusively.
2. Maintain the original meaning without deviation.
3. ${rules}
</constraints>`,

        creative: `You are a Creative Writing Specialist with a flair for engagement.
<mission>
Transform the <user_input> into compelling, evocative text. Use vivid imagery, varied sentence structure, and engaging rhetorical devices to capture attention.
</mission>
<style_guide>
1. Prioritize "Show, Don't Tell" principles.
2. Use strong verbs and sensory details.
3. ${rules}
</style_guide>`,

        professional: `You are a Corporate Communications Director.
<mission>
Refine the <user_input> into polished, executive-ready business correspondence. The tone should be authoritative, respectful, and results-oriented.
</mission>
<guidelines>
1. Use standard business English.
2. Ensure tone is diplomatic and objective.
3. ${rules}
</guidelines>`,

        casual: `You are a Social Media Manager and conversationalist.
<mission>
Relax the <user_input> into a friendly, approachable, and conversational message. It should sound authentic and human.
</mission>
<guidelines>
1. Use contractions (e.g., "don't" instead of "do not").
2. Adopt a warm, peer-to-peer tone.
3. ${rules}
</guidelines>`,

        persuasive: `You are a Senior Copywriter and Behavioral Psychologist.
<mission>
Rewrite the <user_input> to drive action and agreement. Utilize psychological triggers such as urgency, social proof, and benefit-focused framing.
</mission>
<strategy>
1. Focus on "WIIFM" (What's In It For Me) for the reader.
2. Use strong calls to action (CTA).
3. ${rules}
</strategy>`,

        synthesizer: `You are an Academic Researcher.
<mission>
Restructure the <user_input> into a logical, coherent argument. Use formal academic language and clear hierarchical structure.
</mission>
<structure>
1. Ensure logical flow: Premise -> Evidence -> Conclusion.
2. Use precise terminology.
3. ${rules}
</structure>`,

        debugger: `You are a Technical Documentation Lead.
<mission>
Clarify the <user_input> for a technical audience. Ensure maximum precision and eliminate ambiguity. If code is present, preserve syntax but correct logic/comments.
</mission>
<rules>
1. Prioritize accuracy over style.
2. Use standard technical terminology.
3. ${rules}
</rules>`
    };

    return prompts[mode] || prompts.concise;
}

function getDeepPolishPrompt(customRules) {
    const rules = customRules ? `<user_constraints>${customRules}</user_constraints>` : "";

    return `You are an elite Communication Strategist. Your task is to perform a "Deep Polish" on the user's input using a multi-step reasoning process.

${rules}

<instructions>
You must follow this strict step-by-step process. Do not skip steps.

Step 1: Intent Analysis
Analyze the <user_input>. Identify the core message, the implied audience, and the emotional subtext. List the weaknesses in the current draft (e.g., ambiguity, weak verbs, tonal inconsistency).

Step 2: Strategy Formulation
Based on the analysis and <user_constraints>, formulate a plan to optimize the text. Choose the best rhetorical devices and structural changes to maximize impact.

Step 3: Drafting
Draft the optimized version of the text.

Step 4: Review
Critique your draft from Step 3. Does it meet all constraints? Is it significantly better than the original? if not, refine it.

Step 5: Final Output
Present ONLY the final optimized text. Do not output the reasoning steps or the draft.
</instructions>`;
}
