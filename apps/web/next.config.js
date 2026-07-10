import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

// @copilotkit/react-core/v2 side-effect-imports its compiled Tailwind v4
// stylesheet, which this app's Tailwind v3 PostCSS pipeline rejects
// ("@layer base is used but no matching @tailwind base directive"). We only
// consume hooks (useAgent/useCopilotKit) from that entry, never its styled
// components, so the stylesheet can be dropped from the bundle entirely.
const copilotV2Css = path.join(
  path.dirname(require.resolve("@copilotkit/react-core/v2")),
  "index.css",
);

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  transpilePackages: ["@lessonbuild/db", "@lessonbuild/shared"],
  webpack(config) {
    config.resolve.alias[copilotV2Css] = false;
    return config;
  },
};
