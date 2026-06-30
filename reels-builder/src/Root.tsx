import React from "react";
import { Composition } from "remotion";
import { ReelComposition } from "./ReelComposition";
import { clientStoryScript, laserScript, pdrnScript } from "./sampleScript";
import { reelScriptSchema } from "./types";

export const Root: React.FC = () => (
  <>
    {/* 30 сек · Лазер · спокойно-дорого-экспертно */}
    <Composition
      id="Laser_30s"
      component={ReelComposition}
      durationInFrames={laserScript.duration * 30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={laserScript}
      schema={reelScriptSchema}
    />

    {/* 45 сек · PDRN · мягко-заботливо */}
    <Composition
      id="PDRN_45s"
      component={ReelComposition}
      durationInFrames={pdrnScript.duration * 30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={pdrnScript}
      schema={reelScriptSchema}
    />

    {/* 60 сек · История клиента · живо с юмором */}
    <Composition
      id="ClientStory_60s"
      component={ReelComposition}
      durationInFrames={clientStoryScript.duration * 30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={clientStoryScript}
      schema={reelScriptSchema}
    />
  </>
);
