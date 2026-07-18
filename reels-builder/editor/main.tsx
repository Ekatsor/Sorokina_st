import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { EditorComp } from "../src/editor/EditorComp";
import type { TimelineEffect, EffectType } from "../src/editor/types";

const FPS = 30;
const uid = () => "e" + Math.random().toString(36).slice(2, 9);
const STORE = "sorokinaEditorV1";

type Project = { video: string; videoName: string; durationInSeconds: number; subs: any[]; effects: TimelineEffect[] };

const EFFECTS: { type: EffectType; label: string; make: (t: number) => TimelineEffect }[] = [
  { type: "zoom", label: "Зум", make: (t) => ({ id: uid(), type: "zoom", startTime: t, endTime: t + 1.2, trackId: "fx", enabled: true, layerIndex: 0, settings: { scale: 1.18 } }) },
  { type: "darken", label: "Затемнение", make: (t) => ({ id: uid(), type: "darken", startTime: t, endTime: t + 1.0, trackId: "fx", enabled: true, layerIndex: 0, settings: { amount: 0.5 } }) },
  { type: "blur", label: "Размытие", make: (t) => ({ id: uid(), type: "blur", startTime: t, endTime: t + 1.0, trackId: "fx", enabled: true, layerIndex: 0, settings: { px: 10 } }) },
  { type: "grayscale", label: "Ч/Б", make: (t) => ({ id: uid(), type: "grayscale", startTime: t, endTime: t + 1.2, trackId: "fx", enabled: true, layerIndex: 0, settings: {} }) },
];

const load = (): Project => {
  try { const j = JSON.parse(localStorage.getItem(STORE) || ""); if (j && Array.isArray(j.effects)) return j; } catch {}
  return { video: "", videoName: "", durationInSeconds: 10, subs: [], effects: [] };
};

const App: React.FC = () => {
  const [proj, setProj] = useState<Project>(load);
  const [hist, setHist] = useState<TimelineEffect[][]>([]);
  const [future, setFuture] = useState<TimelineEffect[][]>([]);
  const [playhead, setPlayhead] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  // автосохранение
  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(proj)); }, [proj]);

  // следим за позицией плеера
  useEffect(() => {
    const p = playerRef.current; if (!p) return;
    const onFrame = (e: any) => setPlayhead((e.detail.frame || 0) / FPS);
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  });

  const commit = (effects: TimelineEffect[]) => {
    setHist((h) => [...h, proj.effects].slice(-50));
    setFuture([]);
    setProj((p) => ({ ...p, effects }));
  };
  const undo = () => setHist((h) => { if (!h.length) return h; const prev = h[h.length - 1]; setFuture((f) => [proj.effects, ...f]); setProj((p) => ({ ...p, effects: prev })); return h.slice(0, -1); });
  const redo = () => setFuture((f) => { if (!f.length) return f; const next = f[0]; setHist((h) => [...h, proj.effects]); setProj((p) => ({ ...p, effects: next })); return f.slice(1); });

  const addEffect = (type: EffectType) => { const def = EFFECTS.find((e) => e.type === type)!; commit([...proj.effects, def.make(+playhead.toFixed(2))]); };
  const delEffect = (id: string) => commit(proj.effects.filter((e) => e.id !== id));
  const patch = (id: string, upd: Partial<TimelineEffect>) => commit(proj.effects.map((e) => (e.id === id ? { ...e, ...upd } : e)));

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => setProj((p) => ({ ...p, video: url, videoName: f.name, durationInSeconds: v.duration || 10 }));
    v.src = url;
  };
  const onUrl = (url: string) => {
    if (!url) return;
    const v = document.createElement("video"); v.preload = "metadata"; v.crossOrigin = "anonymous";
    v.onloadedmetadata = () => setProj((p) => ({ ...p, video: url, videoName: "URL", durationInSeconds: v.duration || 10 }));
    v.onerror = () => setProj((p) => ({ ...p, video: url, videoName: "URL" }));
    v.src = url;
  };

  const dur = Math.max(1, proj.durationInSeconds);
  const durationInFrames = Math.max(1, Math.round(dur * FPS));
  const inputProps = useMemo(() => ({ video: proj.video, durationInSeconds: dur, fps: FPS, width: 1080, height: 1920, safe: { top: 0.14, bottom: 0.2 }, subs: proj.subs, effects: proj.effects }), [proj, dur]);

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, fontFamily: "system-ui, sans-serif", color: "#eee", flexWrap: "wrap" }}>
      <div style={{ width: 300, flex: "0 0 300px" }}>
        <div style={{ position: "relative", width: 300, height: 533, background: "#000", borderRadius: 12, overflow: "hidden" }}>
          {proj.video ? (
            <Player ref={playerRef} component={EditorComp as any} inputProps={inputProps} durationInFrames={durationInFrames} fps={FPS} compositionWidth={1080} compositionHeight={1920} style={{ width: 300, height: 533 }} controls />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888", textAlign: "center", padding: 20 }}>Загрузи видео →</div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 320 }}>
        <h2 style={{ margin: "0 0 4px" }}>🎬 Монтажная SOROKINA ST <span style={{ fontSize: 12, color: "#888" }}>Этап 1</span></h2>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>Предпросмотр = экспорт (один и тот же Remotion). Загрузи ролик, добавь эффекты на таймлайне.</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ background: "#7A3FE0", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>Загрузить видео<input type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} /></label>
          <input placeholder="или ссылка на видео (mp4)" style={{ flex: 1, minWidth: 180, padding: "6px 8px", borderRadius: 8, border: "1px solid #444", background: "#1b1b1e", color: "#eee" }} onKeyDown={(e) => { if (e.key === "Enter") onUrl((e.target as HTMLInputElement).value.trim()); }} />
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{proj.videoName ? `Файл: ${proj.videoName} · ${dur.toFixed(1)}с` : "Видео не загружено"}</div>

        <div style={{ marginBottom: 10 }}>
          <b style={{ fontSize: 13 }}>Добавить эффект на {playhead.toFixed(1)}с:</b>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {EFFECTS.map((e) => (
              <button key={e.type} onClick={() => addEffect(e.type)} disabled={!proj.video} style={btn}>{e.label}</button>
            ))}
            <button onClick={undo} disabled={!hist.length} style={btnSec}>↶ Отменить</button>
            <button onClick={redo} disabled={!future.length} style={btnSec}>↷ Вернуть</button>
          </div>
        </div>

        {/* Таймлайн */}
        <div style={{ position: "relative", height: 46, background: "#1b1b1e", borderRadius: 8, marginBottom: 12, border: "1px solid #333" }}>
          {proj.effects.map((e) => (
            <div key={e.id} title={e.type} style={{ position: "absolute", top: 6, height: 34, left: `${(e.startTime / dur) * 100}%`, width: `${Math.max(2, ((e.endTime - e.startTime) / dur) * 100)}%`, background: e.enabled ? "#7A3FE0" : "#555", borderRadius: 6, fontSize: 10, color: "#fff", padding: 2, overflow: "hidden", boxSizing: "border-box" }}>{e.type}</div>
          ))}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(playhead / dur) * 100}%`, width: 2, background: "#fff" }} />
        </div>

        {/* Список эффектов */}
        <div>
          {proj.effects.length === 0 ? <div style={{ color: "#777", fontSize: 13 }}>Эффектов пока нет.</div> : proj.effects.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#1b1b1e", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
              <span style={{ width: 74 }}>{e.type}</span>
              <span style={{ color: "#999" }}>с</span>
              <input type="number" step="0.1" value={e.startTime} onChange={(ev) => patch(e.id, { startTime: +ev.target.value })} style={num} />
              <span style={{ color: "#999" }}>по</span>
              <input type="number" step="0.1" value={e.endTime} onChange={(ev) => patch(e.id, { endTime: Math.max(+ev.target.value, e.startTime + 0.1) })} style={num} />
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={e.enabled} onChange={(ev) => patch(e.id, { enabled: ev.target.checked })} /> вкл</label>
              <button onClick={() => delEffect(e.id)} style={{ ...btnSec, marginLeft: "auto", color: "#f88" }}>Удалить</button>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "#666", marginTop: 14, borderTop: "1px solid #333", paddingTop: 8 }}>
          Этап 1: зум · затемнение · размытие · ч-б, таймлайн, undo/redo, автосохранение. Дальше: split-screen, мемы, звуки, субтитры, экспорт.
        </div>
      </div>
    </div>
  );
};

const btn: React.CSSProperties = { background: "#7A3FE0", color: "#fff", border: 0, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const btnSec: React.CSSProperties = { background: "#2a2a2e", color: "#eee", border: "1px solid #444", padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const num: React.CSSProperties = { width: 56, padding: "3px 5px", borderRadius: 6, border: "1px solid #444", background: "#111", color: "#eee" };

createRoot(document.getElementById("root")!).render(<App />);
