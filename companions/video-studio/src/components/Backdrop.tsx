import { AbsoluteFill } from "remotion";
import { brand } from "../brand";

export const Backdrop: React.FC<{ accent: string }> = ({ accent }) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at 20% 10%, ${accent}22, transparent 60%), radial-gradient(1000px 700px at 80% 90%, ${brand.violet}1a, transparent 55%), ${brand.bg}`,
      }}
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0, opacity: 0.18 }}
      >
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </AbsoluteFill>
  );
};
