import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["editor/main.tsx"],
  bundle: true,
  outfile: "../editor/app.js",
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  logLevel: "info",
});
console.log("editor bundled → ../editor/app.js");
