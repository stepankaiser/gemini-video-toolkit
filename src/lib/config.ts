import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "config", "settings.json");

export interface VideoConfig {
    apiKey: string;
    model: string;
    speedMultiplier: number;
    targetResolution: "1080p" | "720p" | "480p";
    targetBitrate: "High" | "Medium" | "Low";
    targetFps: number;
    cutDurationSeconds: number;
    includeReasoning: boolean;
    useSmartSpeed: boolean;
    prompt: string;
}

export const DEFAULT_CONFIG: VideoConfig = {
    apiKey: "",
    model: "gemini-3-flash-preview",
    speedMultiplier: 10,
    targetResolution: "480p",
    targetBitrate: "Low",
    targetFps: 15,
    cutDurationSeconds: 0,
    includeReasoning: true,
    useSmartSpeed: true,
    prompt: "Analyze this video. Describe what you see in detail. Output JSON with keys: \"summary\" (text description), \"objects\" (array of detected objects), \"confidence\" (0.0-1.0)."
};

export function getConfig(): VideoConfig {
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
            return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        } catch (e) {
            console.error("Config parse error, using defaults");
        }
    }
    return DEFAULT_CONFIG;
}

export function updateConfig(newConfig: Partial<VideoConfig>): VideoConfig {
    const current = getConfig();
    const updated = { ...current, ...newConfig };

    const dirname = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    return updated;
}
