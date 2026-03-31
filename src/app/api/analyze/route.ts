import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { processVideo } from "@/lib/video-processor";
import { analyzeVideo } from "@/lib/gemini-client";
import fs from "fs";
import path from "path";
import { writeFile } from "fs/promises";

export async function POST(req: NextRequest) {
    const config = getConfig();

    // Allow runtime config overrides via header (useful for testing different settings)
    const overrideHeader = req.headers.get("x-config-override");
    const effectiveConfig = overrideHeader
        ? { ...config, ...JSON.parse(overrideHeader) }
        : config;

    if (!effectiveConfig.apiKey) {
        return NextResponse.json(
            { error: "No API key configured. Set it via /api/config or config/settings.json" },
            { status: 400 }
        );
    }

    const TEMP_DIR = path.join(process.cwd(), "temp_uploads");
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `upload_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const uploadPath = path.join(TEMP_DIR, filename);
        await writeFile(uploadPath, buffer);

        console.log(`[Analyze] File: ${filename} (${(file.size / 1024).toFixed(0)} KB)`);

        // 1. Process video (FFmpeg: scale, speed, fps, bitrate)
        const processed = await processVideo(uploadPath, effectiveConfig);

        // 2. Send to Gemini
        const result = await analyzeVideo(processed.path, effectiveConfig);

        // 3. Cleanup temp files
        fs.unlinkSync(uploadPath);
        fs.unlinkSync(processed.path);

        // 4. Response
        return NextResponse.json({
            success: true,
            processing: {
                model: effectiveConfig.model,
                speedUsed: processed.speedUsed,
                originalDuration: processed.originalDuration,
                resolution: effectiveConfig.targetResolution,
                fps: effectiveConfig.targetFps,
                bitrate: effectiveConfig.targetBitrate,
                smartSpeed: effectiveConfig.useSmartSpeed
            },
            analysis: result.response,
            tokens: result.tokens,
            timeMs: result.timeMs
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[Analyze] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
