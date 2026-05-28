import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { brand } from "../brand";

interface Props {
  startFrame: number;
  durationFrames: number;
  accent: string;
  label: string;
  elapsedSeconds: number;
}

export const ThinkingPulse: React.FC<Props> = ({ startFrame, durationFrames, accent, label, elapsedSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  const pulse = (Math.sin((local / fps) * Math.PI * 2) + 1) / 2;
  const opacity = interpolate(local, [0, 8, durationFrames - 8, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "20px 32px",
        background: brand.bgPanel,
        border: `1px solid ${accent}55`,
        borderRadius: 999,
        fontFamily: brand.fontSans,
        fontSize: 22,
        color: brand.textMuted,
        opacity,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 ${12 + pulse * 28}px ${accent}`,
        }}
      />
      <span>{label}</span>
      <span style={{ color: brand.textDim, fontFamily: brand.fontMono, fontSize: 18 }}>
        {elapsedSeconds}s elapsed
      </span>
    </div>
  );
};
