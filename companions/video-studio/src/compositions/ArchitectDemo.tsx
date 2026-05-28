import { AbsoluteFill, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { PromptTypewriter } from "../components/PromptTypewriter";
import { ThinkingPulse } from "../components/ThinkingPulse";
import { ArtifactReveal } from "../components/ArtifactReveal";
import { MetricBadge } from "../components/MetricBadge";
import { Outro } from "../components/Outro";
import { personaAccent } from "../brand";

const adrLines: { kind: "h1" | "h2" | "p" | "bullet" | "code"; text: string }[] = [
  { kind: "h1", text: "ADR-42: Feedback Widget Architecture" },
  { kind: "h2", text: "Context" },
  { kind: "p", text: "Widget must persist feedback, classify it, and stream to PM dashboards with low latency." },
  { kind: "h2", text: "Options Considered" },
  { kind: "code", text: "Option A: REST API + Postgres + worker queue" },
  { kind: "bullet", text: "Pros: mature, easy to reason about, strong SQL ecosystem" },
  { kind: "bullet", text: "Cons: extra infra to manage, higher cold-start cost" },
  { kind: "code", text: "Option B: Serverless functions + DynamoDB streams" },
  { kind: "bullet", text: "Pros: scales to zero, pay-per-request, near-zero ops" },
  { kind: "bullet", text: "Cons: harder cross-record queries, vendor coupling" },
  { kind: "code", text: "Option C: Edge functions + KV + async classifier" },
  { kind: "bullet", text: "Pros: lowest latency at submit, global by default" },
  { kind: "bullet", text: "Cons: KV not ideal for analytical queries, dual-store needed" },
  { kind: "h2", text: "Decision" },
  { kind: "p", text: "Choose Option B. Submission volume is bursty, ops budget is tight, and DynamoDB streams cleanly feed the classifier." },
  { kind: "h2", text: "Consequences" },
  { kind: "bullet", text: "Need a nightly export to the analytics warehouse" },
  { kind: "bullet", text: "Adopt a thin repository layer to isolate DynamoDB specifics" },
  { kind: "bullet", text: "Plan a fallback if classifier latency exceeds 2s" },
  { kind: "h2", text: "Sequence (Tech Spec)" },
  { kind: "code", text: "Client -> Edge -> Lambda -> DynamoDB -> Stream -> Classifier -> Dashboard" },
];

export const ArchitectDemo: React.FC = () => {
  const { fps } = useVideoConfig();
  const accent = personaAccent.architect;
  return (
    <AbsoluteFill>
      <Backdrop accent={accent} />
      <PromptTypewriter
        text="Design the architecture for the feedback widget"
        startFrame={fps * 1}
        durationFrames={fps * 3}
        accent={accent}
        agent="architect"
      />
      <ThinkingPulse
        startFrame={fps * 5}
        durationFrames={fps * 3}
        accent={accent}
        label="AgentX is evaluating options"
        elapsedSeconds={11}
      />
      <ArtifactReveal
        startFrame={fps * 9}
        durationFrames={fps * 45}
        accent={accent}
        filename="docs/artifacts/adr/ADR-42.md"
        lines={adrLines}
      />
      <MetricBadge
        startFrame={fps * 48}
        accent={accent}
        primary="ADR + Spec in 1m 04s"
        secondary="3 options scored · sequence diagram · 0 code examples in spec"
      />
      <Outro
        startFrame={fps * 54}
        accent={accent}
        title="From prompt to defensible architecture"
        subtitle="architect.agent.md"
      />
    </AbsoluteFill>
  );
};
