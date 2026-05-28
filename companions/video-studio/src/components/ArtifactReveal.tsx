import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { brand } from "../brand";

interface Props {
  startFrame: number;
  durationFrames: number;
  accent: string;
  filename: string;
  lines: { kind: "h1" | "h2" | "p" | "bullet" | "code"; text: string }[];
}

export const ArtifactReveal: React.FC<Props> = ({ startFrame, durationFrames, accent, filename, lines }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 110 } });
  const scrollProgress = interpolate(local, [fps * 1, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scrollPx = scrollProgress * Math.max(0, lines.length * 56 - 520);

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
        overflow: "hidden",
        transform: `translateY(${(1 - enter) * 30}px)`,
        opacity: enter,
        boxShadow: `0 40px 120px -40px ${accent}33`,
      }}
    >
      <div
        style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${brand.border}`,
          fontFamily: brand.fontMono,
          fontSize: 16,
          color: brand.textMuted,
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: brand.bgPanel,
        }}
      >
        <span style={{ color: accent }}>●</span>
        <span>{filename}</span>
      </div>
      <div style={{ padding: "32px 48px", position: "relative", height: "calc(100% - 56px)", overflow: "hidden" }}>
        <div style={{ transform: `translateY(${-scrollPx}px)`, transition: "transform linear" }}>
          {lines.map((line, i) => {
            const baseStyle: React.CSSProperties = {
              fontFamily: line.kind === "code" ? brand.fontMono : brand.fontSans,
              color: brand.text,
              marginBottom: 18,
              lineHeight: 1.45,
            };
            if (line.kind === "h1") return <div key={i} style={{ ...baseStyle, fontSize: 36, fontWeight: 700, color: accent }}>{line.text}</div>;
            if (line.kind === "h2") return <div key={i} style={{ ...baseStyle, fontSize: 26, fontWeight: 600, marginTop: 12 }}>{line.text}</div>;
            if (line.kind === "bullet") return <div key={i} style={{ ...baseStyle, fontSize: 22, color: brand.textMuted, paddingLeft: 24, position: "relative" }}><span style={{ position: "absolute", left: 0, color: accent }}>•</span>{line.text}</div>;
            if (line.kind === "code") return <div key={i} style={{ ...baseStyle, fontSize: 18, background: brand.bg, padding: "12px 18px", borderRadius: 8, border: `1px solid ${brand.border}` }}>{line.text}</div>;
            return <div key={i} style={{ ...baseStyle, fontSize: 22, color: brand.textMuted }}>{line.text}</div>;
          })}
        </div>
      </div>
    </div>
  );
};
