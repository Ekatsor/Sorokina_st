import React from "react";
import { Composition } from "remotion";
import { ReelComposition } from "./ReelComposition";
import { clientStoryScript, laserScript, pdrnScript } from "./sampleScript";
import { reelScriptSchema, type ReelScript } from "./types";

const FPS = 30;

// Duration comes from the script itself, so custom props (e.g. a reel built in
// the app) render at the right length without touching the composition.
const calc = ({ props }: { props: ReelScript }) => ({
  durationInFrames: Math.round(props.duration * FPS),
});

export const Root: React.FC = () => (
  <>
    {/* 30 сек · Лазер · спокойно-дорого-экспертно */}
    <Composition
      id="Laser-30s"
      component={ReelComposition}
      durationInFrames={laserScript.duration * FPS}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={laserScript}
      schema={reelScriptSchema}
      calculateMetadata={calc}
    />

    {/* 45 сек · PDRN · мягко-заботливо */}
    <Composition
      id="PDRN-45s"
      component={ReelComposition}
      durationInFrames={pdrnScript.duration * FPS}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={pdrnScript}
      schema={reelScriptSchema}
      calculateMetadata={calc}
    />

    {/* 60 сек · История клиента · живо с юмором */}
    <Composition
      id="ClientStory-60s"
      component={ReelComposition}
      durationInFrames={clientStoryScript.duration * FPS}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={clientStoryScript}
      schema={reelScriptSchema}
      calculateMetadata={calc}
    />
  </>
);
