"use client";
import { useState, useEffect } from "react";

interface Config {
    apiKey: string;
    model: string;
    speedMultiplier: number;
    targetResolution: string;
    targetBitrate: string;
    targetFps: number;
    cutDurationSeconds: number;
    includeReasoning: boolean;
    useSmartSpeed: boolean;
    prompt: string;
}

export default function Dashboard() {
    const [config, setConfig] = useState<Config | null>(null);
    const [result, setResult] = useState<string>("");
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testFile, setTestFile] = useState<File | null>(null);

    useEffect(() => {
        fetch("/api/config").then(r => r.json()).then(setConfig);
    }, []);

    const saveConfig = async () => {
        if (!config) return;
        setSaving(true);
        await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config)
        });
        setSaving(false);
    };

    const testAnalysis = async () => {
        if (!testFile) return;
        setTesting(true);
        setResult("Processing...");

        const formData = new FormData();
        formData.append("file", testFile);

        const res = await fetch("/api/analyze", {
            method: "POST",
            headers: config ? { "x-config-override": JSON.stringify(config) } : {},
            body: formData
        });
        const data = await res.json();
        setResult(JSON.stringify(data, null, 2));
        setTesting(false);
    };

    if (!config) return <div style={{ padding: 40, fontFamily: "monospace" }}>Loading...</div>;

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#e4e6ed", background: "#0f1117", minHeight: "100vh" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Gemini Video Toolkit</h1>
            <p style={{ color: "#9ca0b0", fontSize: 13, marginBottom: 32 }}>Configure video preprocessing and model settings before sending to Gemini.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Left: Config */}
                <div style={{ background: "#1a1d27", border: "1px solid #2d3140", borderRadius: 12, padding: 24 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: "#00c9a7", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Pipeline Configuration</h2>

                    <Label>Gemini API Key</Label>
                    <input type="password" placeholder="Leave empty to keep current" style={inputStyle}
                        onChange={e => e.target.value && setConfig({ ...config, apiKey: e.target.value })} />

                    <Label>Model</Label>
                    <select value={config.model} style={inputStyle}
                        onChange={e => setConfig({ ...config, model: e.target.value })}>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                        <option value="gemini-3-pro-preview">Gemini 3 Pro (Accurate)</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </select>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 8px" }}>
                        <input type="checkbox" checked={config.useSmartSpeed}
                            onChange={e => setConfig({ ...config, useSmartSpeed: e.target.checked })} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Smart Speed Logic</span>
                        <span style={{ fontSize: 11, color: "#6b7085" }}>(auto-adjusts speed by video duration)</span>
                    </div>
                    {config.useSmartSpeed && (
                        <div style={{ fontSize: 11, color: "#6b7085", marginBottom: 12, paddingLeft: 24 }}>
                            &lt;2s: 0.25x slow motion &middot; 2-5s: 1x normal &middot; &gt;5s: dynamic (target ~15s output)
                        </div>
                    )}

                    <Label>Speed Multiplier {!config.useSmartSpeed && `(${config.speedMultiplier}x)`}</Label>
                    <input type="range" min={1} max={40} value={config.speedMultiplier}
                        disabled={config.useSmartSpeed}
                        style={{ width: "100%", opacity: config.useSmartSpeed ? 0.3 : 1 }}
                        onChange={e => setConfig({ ...config, speedMultiplier: +e.target.value })} />

                    <Label>Resolution</Label>
                    <select value={config.targetResolution} style={inputStyle}
                        onChange={e => setConfig({ ...config, targetResolution: e.target.value })}>
                        <option value="1080p">1080p (High Quality)</option>
                        <option value="720p">720p (Balanced)</option>
                        <option value="480p">480p (Fastest, Lowest Tokens)</option>
                    </select>

                    <Label>Bitrate</Label>
                    <select value={config.targetBitrate} style={inputStyle}
                        onChange={e => setConfig({ ...config, targetBitrate: e.target.value })}>
                        <option value="High">High (5 Mbps)</option>
                        <option value="Medium">Medium (2.5 Mbps)</option>
                        <option value="Low">Low (1 Mbps)</option>
                    </select>

                    <Label>FPS</Label>
                    <select value={config.targetFps} style={inputStyle}
                        onChange={e => setConfig({ ...config, targetFps: +e.target.value })}>
                        <option value={30}>30 fps</option>
                        <option value={15}>15 fps (1/2)</option>
                        <option value={7.5}>7.5 fps (1/4)</option>
                    </select>

                    <Label>Duration Cut (seconds, 0 = full video)</Label>
                    <input type="number" min={0} value={config.cutDurationSeconds} style={inputStyle}
                        onChange={e => setConfig({ ...config, cutDurationSeconds: +e.target.value })} />

                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                        <input type="checkbox" checked={config.includeReasoning}
                            onChange={e => setConfig({ ...config, includeReasoning: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Include Reasoning</span>
                        <span style={{ fontSize: 11, color: "#f59e0b" }}>~2x output tokens</span>
                    </div>

                    <Label>Prompt</Label>
                    <textarea value={config.prompt} rows={4}
                        style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 11 }}
                        onChange={e => setConfig({ ...config, prompt: e.target.value })} />

                    <button onClick={saveConfig} disabled={saving}
                        style={{ ...btnStyle, background: "#00c9a7", color: "#000", marginTop: 16, width: "100%" }}>
                        {saving ? "Saving..." : "Save Configuration"}
                    </button>
                </div>

                {/* Right: Test */}
                <div style={{ background: "#1a1d27", border: "1px solid #2d3140", borderRadius: 12, padding: 24 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: "#00c9a7", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Test Analysis</h2>

                    <Label>Upload video (MP4, AVI, MOV)</Label>
                    <input type="file" accept="video/*" style={{ ...inputStyle, padding: 8 }}
                        onChange={e => setTestFile(e.target.files?.[0] || null)} />

                    <button onClick={testAnalysis} disabled={testing || !testFile}
                        style={{ ...btnStyle, background: "#3b82f6", color: "#fff", marginTop: 12, width: "100%" }}>
                        {testing ? "Analyzing..." : "Run Analysis"}
                    </button>

                    <p style={{ fontSize: 11, color: "#6b7085", margin: "8px 0" }}>
                        Uses current UI settings (not saved config) via x-config-override header.
                    </p>

                    {result && (
                        <pre style={{
                            marginTop: 16, padding: 16, background: "#0f1117", borderRadius: 8,
                            border: "1px solid #2d3140", fontSize: 11, fontFamily: "monospace",
                            color: "#e4e6ed", whiteSpace: "pre-wrap", maxHeight: 500, overflow: "auto"
                        }}>
                            {result}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 12, color: "#9ca0b0", marginTop: 12, marginBottom: 4 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", background: "#0f1117", border: "1px solid #2d3140",
    borderRadius: 6, color: "#e4e6ed", fontSize: 13, fontFamily: "inherit"
};

const btnStyle: React.CSSProperties = {
    padding: "10px 20px", borderRadius: 8, border: "none", fontWeight: 600,
    fontSize: 13, cursor: "pointer", fontFamily: "inherit"
};
