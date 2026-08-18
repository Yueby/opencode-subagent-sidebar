import solidPlugin from "@opentui/solid/bun-plugin";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["src/index.ts", "src/tui.tsx"],
  outdir: "dist",
  target: "bun",
  plugins: [solidPlugin],
  external: [
    "@opencode-ai/plugin",
    "@opencode-ai/sdk",
    "@opentui/core",
    "@opentui/solid",
    "solid-js",
  ],
});

if (!result.success) {
  console.error(...result.logs);
  process.exit(1);
}

const declarations = Bun.spawnSync(["bun", "x", "tsc", "-p", "tsconfig.build.json"]);
if (declarations.exitCode !== 0) {
  console.error(new TextDecoder().decode(declarations.stderr));
  process.exit(declarations.exitCode);
}
