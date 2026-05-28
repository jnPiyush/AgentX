import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { brand } from "../brand";

interface Props {
  text: string;
  startFrame: number;
  durationFrames: number;
  accent: string;
  agent: string;
}

export const PromptTypewriter: React.FC<Props> = ({ text, startFrame, durationFrames, accent, agent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const charsVisible = Math.floor(
    interpolate(local, [0, durationFrames], [0, text.length], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );
  const visible = text.slice(0, charsVisible);
  const caretOn = Math.floor((local / fps) * 2) % 2 === 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        left: 120,
        right: 120,
        padding: "32px 40px",
        background: brand.bgPanel,
        border: `1px solid ${brand.border}`,
        borderRadius: 16,
        fontFamily: brand.fontMono,
        fontSize: 32,
        color: brand.text,
        boxShadow: `0 30px 80px -30px ${accent}55`,
      }}
    >
      <div
        style={{
          fontFamily: brand.fontSans,
          fontSize: 16,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: accent,
          marginBottom: 18,
          fontWeight: 600,
        }}
      >
        @{agent}
      </div>
      <div style={{ lineHeight: 1.55 }}>
        {visible}
        <span style={{ opacity: caretOn ? 1 : 0, color: accent }}>▊</span>
      </div>
    </div>
  );
};
