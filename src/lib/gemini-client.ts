import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { VideoConfig } from "./config";

export interface AnalysisResult {
    response: Record<string, unknown>;
    raw: string;
    tokens: {
        input: number;
        output: number;
    };
    timeMs: number;
    model: string;
}

/**
 * Send a processed video to Gemini for analysis.
 *
 * - Supports any Gemini model (flash, pro, etc.)
 * - Enforces JSON response format
 * - Uses configurable prompt
 * - Tracks token usage and latency
 */
export async function analyzeVideo(videoPath: string, config: VideoConfig): Promise<AnalysisResult> {
    const genAI = new GoogleGenerativeAI(config.apiKey);

    const model = genAI.getGenerativeModel({
        model: config.model,
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    const videoBuffer = fs.readFileSync(videoPath);
    const videoBase64 = videoBuffer.toString("base64");

    let promptText = config.prompt;
    if (config.includeReasoning) {
        promptText += `\nInclude a key "reasoning" with a concise explanation of your analysis.`;
    }

    const startTime = Date.now();

    try {
        const result = await model.generateContent([
            promptText,
            {
                inlineData: {
                    data: videoBase64,
                    mimeType: "video/mp4",
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();
        const usage = response.usageMetadata;
        const timeMs = Date.now() - startTime;

        // Parse JSON response (handle markdown wrapping and array responses)
        let parsed: Record<string, unknown> = {};
        try {
            const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const json = JSON.parse(cleaned);
            parsed = Array.isArray(json) ? json[0] : json;
        } catch {
            console.error("JSON parse error, returning raw text");
            parsed = { raw_response: text };
        }

        return {
            response: parsed,
            raw: text,
            tokens: {
                input: usage?.promptTokenCount || 0,
                output: usage?.candidatesTokenCount || 0
            },
            timeMs,
            model: config.model
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Gemini API Error:", message);
        return {
            response: { error: message },
            raw: message,
            tokens: { input: 0, output: 0 },
            timeMs: Date.now() - startTime,
            model: config.model
        };
    }
}
