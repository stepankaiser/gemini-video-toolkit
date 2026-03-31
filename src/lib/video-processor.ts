import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { VideoConfig } from "./config";

function runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args);

        let stderrData = "";
        proc.stderr.on("data", (data) => {
            stderrData += data.toString();
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                console.error(`FFmpeg Error (Exit ${code}): ${stderrData}`);
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        proc.on("error", (err) => {
            reject(err);
        });
    });
}

// Concurrency limiter — prevents overloading the machine with parallel FFmpeg processes
class Semaphore {
    private tasks: (() => void)[] = [];
    private count: number;

    constructor(private max: number) {
        this.count = max;
    }

    async acquire(): Promise<void> {
        if (this.count > 0) {
            this.count--;
            return;
        }
        return new Promise<void>((resolve) => {
            this.tasks.push(resolve);
        });
    }

    release(): void {
        this.count++;
        if (this.tasks.length > 0 && this.count > 0) {
            this.count--;
            const next = this.tasks.shift();
            if (next) next();
        }
    }
}

const ffmpegLimiter = new Semaphore(5);

// Get video duration via ffprobe
async function getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
        const proc = spawn("ffprobe", [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            filePath
        ]);
        let data = "";
        proc.stdout.on("data", (chunk) => data += chunk);
        proc.on("close", () => {
            const duration = parseFloat(data.trim());
            resolve(isNaN(duration) ? 0 : duration);
        });
    });
}

export interface ProcessResult {
    path: string;
    speedUsed: number;
    originalDuration: number;
}

/**
 * Process a video file with configurable resolution, speed, FPS, bitrate, and duration.
 *
 * Smart Speed Logic (when enabled):
 *   - Micro videos (<2s):  0.25x slow motion (gives AI more context)
 *   - Short videos (2-5s): 1x normal speed
 *   - Long videos (>5s):   Dynamic speed targeting ~15s output duration
 *
 * FFmpeg pipeline: duration cut → scale → speed (setpts) → fps → bitrate → strip audio
 */
export async function processVideo(inputPath: string, config: VideoConfig): Promise<ProcessResult> {
    await ffmpegLimiter.acquire();

    try {
        const TEMP_DIR = path.join(process.cwd(), "temp_processed");
        if (!fs.existsSync(TEMP_DIR)) {
            fs.mkdirSync(TEMP_DIR);
        }

        const filename = `processed_${Date.now()}_${path.basename(inputPath)}`;
        const outputPath = path.join(TEMP_DIR, filename);

        // Detect original duration
        const duration = await getVideoDuration(inputPath);
        let effectiveSpeed = config.speedMultiplier;

        // Smart Speed Logic
        if (config.useSmartSpeed) {
            if (duration > 0 && duration < 2.0) {
                // Micro video: slow down for more context
                effectiveSpeed = 0.25;
                console.log(`[VideoProcessor] Micro video (${duration.toFixed(1)}s) → 0.25x slow motion`);
            } else if (duration >= 2.0 && duration < 5.0) {
                // Short video: keep normal speed
                effectiveSpeed = 1;
                console.log(`[VideoProcessor] Short video (${duration.toFixed(1)}s) → 1x normal`);
            } else if (duration >= 5.0) {
                // Long video: dynamic speed targeting ~15s output
                const targetDuration = 15.0;
                const calculatedSpeed = duration / targetDuration;
                effectiveSpeed = Math.max(1, Math.min(calculatedSpeed, config.speedMultiplier));
                console.log(`[VideoProcessor] Long video (${duration.toFixed(1)}s) → ${effectiveSpeed.toFixed(2)}x speed`);
            }
        }

        // Resolution → FFmpeg scale filter
        const scaleMap: Record<string, string> = {
            "1080p": "scale=-2:1080",
            "720p": "scale=-2:720",
            "480p": "scale=-2:480"
        };
        const scaleFilter = scaleMap[config.targetResolution] || "scale=-2:480";

        // Speed → setpts filter (PTS = Presentation Time Stamp)
        const ptsFactor = 1 / effectiveSpeed;
        const speedFilter = `setpts=${ptsFactor}*PTS`;

        // Bitrate
        const bitrateMap: Record<string, string> = { "High": "5M", "Medium": "2.5M", "Low": "1M" };
        const bitrateVal = bitrateMap[config.targetBitrate] || "1M";

        // Build FFmpeg arguments
        const args = ["-y"];

        if (config.cutDurationSeconds > 0) {
            args.push("-t", config.cutDurationSeconds.toString());
        }

        args.push("-i", inputPath);
        args.push("-vf", `${scaleFilter},${speedFilter}`);
        args.push("-r", config.targetFps.toString());
        args.push("-b:v", bitrateVal);
        args.push("-an"); // Strip audio (not needed for AI analysis)
        args.push(outputPath);

        console.log(`[VideoProcessor] ffmpeg ${args.join(" ")}`);
        await runCommand("ffmpeg", args);

        return { path: outputPath, speedUsed: effectiveSpeed, originalDuration: duration };
    } finally {
        ffmpegLimiter.release();
    }
}
