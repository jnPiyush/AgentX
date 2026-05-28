import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { brand } from "../brand";

interface Props {
  startFrame: number;
  accent: string;
  title: string;
  subtitle: string;
}

export const Outro: React.FC<Props> = ({ startFrame, accent, title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;
  const enter = spring({ frame: local, fps, config: { damping: 16, stiffness: 80 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: `radial-gradient(800px 500px at 50% 50%, ${accent}22, transparent), ${brand.bg}f0`,
        opacity: enter,
      }}
    >
      <div
        style={{
          fontFamily: brand.fontSans,
          fontSize: 14,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: accent,
          fontWeight: 600,
        }}
      >
        AgentX
      </div>
      <div
        style={{
          fontFamily: brand.fontSans,
          fontSize: 64,
          fontWeight: 700,
          color: brand.text,
          textAlign: "center",
          maxWidth: 1200,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: brand.fontMono,
          fontSize: 22,
          color: brand.textMuted,
          textAlign: "center",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};
