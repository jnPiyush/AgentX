import { AbsoluteFill, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { PromptTypewriter } from "../components/PromptTypewriter";
import { ThinkingPulse } from "../components/ThinkingPulse";
import { ArtifactReveal } from "../components/ArtifactReveal";
import { MetricBadge } from "../components/MetricBadge";
import { Outro } from "../components/Outro";
import { personaAccent } from "../brand";

const prdLines: { kind: "h1" | "h2" | "p" | "bullet" | "code"; text: string }[] = [
  { kind: "h1", text: "PRD: Customer Feedback Widget" },
  { kind: "h2", text: "Problem Statement" },
  { kind: "p", text: "Users have no in-product channel to share friction. Support tickets miss 80% of small frustrations." },
  { kind: "h2", text: "Target Users" },
  { kind: "bullet", text: "Self-serve SaaS customers on Pro and Team plans" },
  { kind: "bullet", text: "PMs and CX leads triaging feedback weekly" },
  { kind: "h2", text: "Goals" },
  { kind: "bullet", text: "Capture >= 3x more qualitative signal than support tickets" },
  { kind: "bullet", text: "<= 30s median submission time" },
  { kind: "h2", text: "Requirements" },
  { kind: "bullet", text: "Floating widget, route-aware, dismissible per session" },
  { kind: "bullet", text: "Optional screenshot capture with redaction" },
  { kind: "bullet", text: "Sentiment + category auto-tag on submit" },
  { kind: "h2", text: "User Stories (12)" },
  { kind: "bullet", text: "As a user I can submit feedback in <=3 clicks" },
  { kind: "bullet", text: "As a PM I can filter feedback by route + plan" },
  { kind: "bullet", text: "As CX I can export weekly digests" },
  { kind: "h2", text: "Success Metrics" },
  { kind: "bullet", text: "Weekly active submitters / weekly active users" },
  { kind: "bullet", text: "Median time-to-triage" },
  { kind: "h2", text: "Risks & Open Questions" },
  { kind: "bullet", text: "PII redaction policy needs Legal sign-off" },
];

export const PMDemo: React.FC = () => {
  const { fps } = useVideoConfig();
  const accent = personaAccent.pm;
  return (
    <AbsoluteFill>
      <Backdrop accent={accent} />
      <PromptTypewriter
        text="Create a PRD for a customer feedback widget"
        startFrame={fps * 1}
        durationFrames={fps * 3}
        accent={accent}
        agent="product-manager"
      />
      <ThinkingPulse
        startFrame={fps * 5}
        durationFrames={fps * 3}
        accent={accent}
        label="AgentX is drafting the PRD"
        elapsedSeconds={8}
      />
      <ArtifactReveal
        startFrame={fps * 9}
        durationFrames={fps * 45}
        accent={accent}
        filename="docs/artifacts/prd/PRD-42.md"
        lines={prdLines}
      />
      <MetricBadge
        startFrame={fps * 48}
        accent={accent}
        primary="PRD ready in 47s"
        secondary="8 sections · 12 user stories · 1 Epic + 3 Features"
      />
      <Outro
        startFrame={fps * 54}
        accent={accent}
        title="From prompt to PRD"
        subtitle="product-manager.agent.md"
      />
    </AbsoluteFill>
  );
};
