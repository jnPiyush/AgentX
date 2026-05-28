import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { brand } from "../brand";

interface Props {
  startFrame: number;
  accent: string;
  primary: string;
  secondary: string;
}

export const MetricBadge: React.FC<Props> = ({ startFrame, accent, primary, secondary }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;
  const enter = spring({ frame: local, fps, config: { damping: 14, stiffness: 90 } });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        right: 120,
        padding: "20px 28px",
        background: brand.bgPanel,
        border: `1px solid ${accent}66`,
        borderRadius: 14,
        fontFamily: brand.fontSans,
        boxShadow: `0 20px 60px -20px ${accent}55`,
        transform: `translateX(${(1 - enter) * 60}px)`,
        opacity: enter,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: accent, marginBottom: 4 }}>{primary}</div>
      <div style={{ fontSize: 16, color: brand.textMuted }}>{secondary}</div>
    </div>
  );
};
