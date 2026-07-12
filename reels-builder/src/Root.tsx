import React from "react";
import { Composition } from "remotion";
import { ReelComposition } from "./ReelComposition";
import { SubtitledVideo, subSchema, type SubProps } from "./SubtitledVideo";
import { clientStoryScript, laserScript, pdrnScript } from "./sampleScript";
import { reelScriptSchema, type ReelScript } from "./types";

const FPS = 30;

// Duration comes from the script itself, so custom props (e.g. a reel built in
// the app) render at the right length without touching the composition.
const calc = ({ props }: { props: ReelScript }) => ({
  durationInFrames: Math.round(props.duration * FPS),
});

// Длительность и размеры берём из props (готовит edit-plan.mjs по видео).
const calcSub = ({ props }: { props: SubProps }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationInSeconds * (props.fps || FPS))),
  fps: props.fps || FPS,
  width: props.width || 1080,
  height: props.height || 1920,
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

    {/* Твоё видео + фирменные субтитры Sorokina (очищенная речь, хуки, zoom) */}
    <Composition
      id="Subtitle-Edit"
      component={SubtitledVideo}
      durationInFrames={300}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{
        video: "",
        durationInSeconds: 10,
        fps: FPS,
        width: 1080,
        height: 1920,
        format: "reels" as const,
        subs: [
          { from: 0, to: 1.4, words: ["Я", "вообще"], accent: 1, hook: false },
          { from: 1.4, to: 2.6, words: ["не", "против"], accent: 1, hook: false },
          { from: 2.6, to: 4.2, words: ["дарят", "процедуры"], accent: 1, hook: true },
        ],
      }}
      schema={subSchema}
      calculateMetadata={calcSub}
    />
  </>
);
