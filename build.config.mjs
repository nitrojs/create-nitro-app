import { defineBuildConfig } from "obuild/config";
import pkg from "./package.json" with { type: "json" };

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: "./src/cli.ts",
      rolldown: {
        transform: {
          define: {
            "globalThis.__pkg_version__": JSON.stringify(pkg.version),
            "globalThis.__pkg_name__": JSON.stringify(pkg.name),
            "globalThis.__pkg_description__": JSON.stringify(pkg.description),
          },
        },
      },
    },
  ],
});
