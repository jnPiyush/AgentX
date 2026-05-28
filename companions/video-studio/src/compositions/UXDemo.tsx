import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { PromptTypewriter } from "../components/PromptTypewriter";
import { ThinkingPulse } from "../components/ThinkingPulse";
import { MetricBadge } from "../components/MetricBadge";
import { Outro } from "../components/Outro";
import { personaAccent, brand } from "../brand";

const Wireframe: React.FC<{ startFrame: number; durationFrames: number; accent: string }> = ({ startFrame, durationFrames, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;
  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 110 } });
  const fade = interpolate(local, [durationFrames - fps, durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        left: 120,
        right: 120,
        height: 580,
        background: brand.surface,
        border: `1px solid ${brand.border}`,
        borderRadius: 18,
        padding: 48,
        fontFamily: brand.fontMono,
        color: brand.textMuted,
        fontSize: 22,
        lineHeight: 1.7,
        opacity: enter * fade,
        transform: `translateY(${(1 - enter) * 30}px)`,
      }}
    >
      <div style={{ color: accent, marginBottom: 18, fontFamily: brand.fontSans, fontSize: 16, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
        Lo-fi wireframe
      </div>
      <pre style={{ margin: 0, color: brand.textMuted, fontFamily: brand.fontMono, fontSize: 22, whiteSpace: "pre" }}>{`+----------------------------------------------------+
|  [ Send us feedback ]                          x   |
+----------------------------------------------------+
|                                                    |
|  How was your experience today?                    |
|  ( ) Great    ( ) Okay    ( ) Frustrating          |
|                                                    |
|  Tell us more (optional)                           |
|  +----------------------------------------------+  |
|  |                                              |  |
|  +----------------------------------------------+  |
|                                                    |
|  [x] Include screenshot      [   Send   ]          |
+----------------------------------------------------+`}</pre>
    </div>
  );
};

const LivePrototype: React.FC<{ startFrame: number; accent: string }> = ({ startFrame, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;
  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 110 } });

  return (
    <div
      style={{
        position: "absolute",
        top: 360,
        left: 120,
        right: 120,
        height: 580,
        background: brand.surface,
        border: `1px solid ${brand.border}`,
        borderRadius: 18,
        padding: 0,
        overflow: "hidden",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 20}px)`,
      }}
    >
      <div style={{ padding: "16px 28px", borderBottom: `1px solid ${brand.border}`, fontFamily: brand.fontMono, fontSize: 16, color: brand.textMuted, background: brand.bgPanel, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ color: accent }}>●</span>
        <span>docs/ux/prototypes/feedback-widget/index.html</span>
      </div>
      <div style={{ display: "flex", height: "calc(100% - 56px)" }}>
        <div style={{ flex: 1.6, padding: "40px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: brand.fontSans, fontSize: 28, fontWeight: 700, color: brand.text, marginBottom: 24 }}>Send us feedback</div>
          <div style={{ fontFamily: brand.fontSans, fontSize: 18, color: brand.textMuted, marginBottom: 18 }}>How was your experience today?</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            {["Great", "Okay", "Frustrating"].map((label, i) => (
              <div key={label} style={{ padding: "12px 20px", border: `1px solid ${i === 0 ? accent : brand.border}`, borderRadius: 10, color: i === 0 ? accent : brand.textMuted, fontFamily: brand.fontSans, fontSize: 16, background: i === 0 ? `${accent}14` : "transparent" }}>{label}</div>
            ))}
          </div>
          <div style={{ border: `1px solid ${brand.border}`, borderRadius: 10, padding: "14px 18px", color: brand.textDim, fontFamily: brand.fontSans, fontSize: 16, marginBottom: 24 }}>Tell us more (optional)</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: brand.fontSans, fontSize: 14, color: brand.textMuted }}>Include screenshot</div>
            <div style={{ padding: "12px 24px", background: accent, color: "#03110b", borderRadius: 10, fontFamily: brand.fontSans, fontSize: 16, fontWeight: 600 }}>Send feedback</div>
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${brand.border}`, background: brand.bgPanel, padding: "32px 36px", fontFamily: brand.fontMono, fontSize: 14, color: brand.textMuted }}>
          <div style={{ fontFamily: brand.fontSans, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: accent, fontWeight: 600, marginBottom: 18 }}>axe-core a11y scan</div>
          <div style={{ color: brand.mint, fontSize: 22, marginBottom: 14 }}>0 violations</div>
          <div style={{ marginBottom: 10 }}>WCAG 2.1 AA: pass</div>
          <div style={{ marginBottom: 10 }}>Keyboard nav: pass</div>
          <div style={{ marginBottom: 10 }}>Color contrast: 7.2:1</div>
          <div style={{ marginBottom: 10 }}>Focus order: logical</div>
          <div style={{ color: brand.textDim, marginTop: 24, fontSize: 12 }}>Report: prototypes/feedback-widget/audit/axe-report.json</div>
        </div>
      </div>
    </div>
  );
};

export const UXDemo: React.FC = () => {
  const { fps } = useVideoConfig();
  const accent = personaAccent.ux;
  return (
    <AbsoluteFill>
      <Backdrop accent={accent} />
      <PromptTypewriter
        text="Design the UX for the feedback widget"
        startFrame={fps * 1}
        durationFrames={fps * 3}
        accent={accent}
        agent="ux-designer"
      />
      <ThinkingPulse
        startFrame={fps * 5}
        durationFrames={fps * 3}
        accent={accent}
        label="AgentX is sketching wireframes"
        elapsedSeconds={9}
      />
      <Wireframe startFrame={fps * 9} durationFrames={fps * 18} accent={accent} />
      <LivePrototype startFrame={fps * 28} accent={accent} />
      <MetricBadge
        startFrame={fps * 48}
        accent={accent}
        primary="Wireframe → Prototype in 58s"
        secondary="WCAG 2.1 AA · 0 axe violations · mobile + desktop variants"
      />
      <Outro
        startFrame={fps * 54}
        accent={accent}
        title="From prompt to accessible prototype"
        subtitle="ux-designer.agent.md"
      />
    </AbsoluteFill>
  );
};
