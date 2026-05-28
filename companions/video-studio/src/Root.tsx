import { Composition } from "remotion";
import { PMDemo } from "./compositions/PMDemo";
import { ArchitectDemo } from "./compositions/ArchitectDemo";
import { UXDemo } from "./compositions/UXDemo";

const FPS = 30;
const DURATION_SECONDS = 60;
const WIDTH = 1920;
const HEIGHT = 1080;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="PMDemo"
        component={PMDemo}
        durationInFrames={DURATION_SECONDS * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ArchitectDemo"
        component={ArchitectDemo}
        durationInFrames={DURATION_SECONDS * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="UXDemo"
        component={UXDemo}
        durationInFrames={DURATION_SECONDS * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
