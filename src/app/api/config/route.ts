import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/lib/config";

export async function GET() {
    const config = getConfig();
    // Don't expose the API key in GET responses
    return NextResponse.json({ ...config, apiKey: config.apiKey ? "***configured***" : "" });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const updated = updateConfig(body);
        return NextResponse.json({ success: true, config: { ...updated, apiKey: updated.apiKey ? "***configured***" : "" } });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
