#!/usr/bin/env node

import type { SelectPromptOptions } from "consola";
import type { DownloadTemplateResult } from "giget";
import type { PackageManagerName } from "nypm";

import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { downloadTemplate } from "giget";
import { hasTTY, isAgent } from "std-env";
import { installDependencies, packageManagers, runScriptCommand } from "nypm";

// Based on: https://github.com/unjs/giget/blob/main/src/cli.ts

const NAME = "Nitro";
const DEFAULT_DIR = "nitro-app";

const REGISTRY_URL = "https://raw.githubusercontent.com/nitrojs/starter/templates";

const TEMPLATES = [
  { name: "vite", description: "Full-stack with Vite" },
  { name: "cli", description: "Backend with Nitro CLI" },
];

const BANNER_RAW = `
     ⣴⠶⠶⠶⠶⢶⣤
    ⢸⡏    ⣼⠏
   ⢀⡿    ⣼⠏
   ⣼⠃   ⠸⣯⣤⣤⣤⣤⣤    ███╗   ██╗██╗████████╗██████╗  ██████╗
  ⣸⡏        ⢀⣾⠋    ████╗  ██║██║╚══██╔══╝██╔══██╗██╔═══██╗
  ⠻⠶⠶⢶⡄   ⢀⣴⠟⠁     ██╔██╗ ██║██║   ██║   ██████╔╝██║   ██║
     ⣼⠇  ⣠⡾⠋       ██║╚██╗██║██║   ██║   ██╔══██╗██║   ██║
    ⢠⡟ ⢀⣾⠏         ██║ ╚████║██║   ██║   ██║  ██║╚██████╔╝
    ⣸⢃⣴⠟⠁          ╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝
   ⢠⣿⡿⠋
   ⠘⠋
                     [Build any server with Nitro]
`;

declare global {
  var __pkg_name__: string | undefined;
  var __pkg_version__: string | undefined;
  var __pkg_description__: string | undefined;
}

const pmNames = packageManagers.map((pm) => pm.name);
const currentPackageManager = detectCurrentPackageManager();

const mainCommand = defineCommand({
  meta: {
    name: globalThis.__pkg_name__,
    version: globalThis.__pkg_version__,
    description: globalThis.__pkg_description__,
  },
  args: {
    dir: {
      type: "positional",
      description: "A relative or absolute path where to extract the template",
      default: "",
      required: false,
    },
    template: {
      description: "Template name",
      type: "string",
      alias: "t",
      default: "",
    },
    cwd: {
      type: "string",
      description: "Set current working directory to resolve dirs relative to it",
      valueHint: "directory",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Clone to existing directory even if exists",
    },
    forceClean: {
      type: "boolean",
      description: "Remove any existing directory or file recursively before cloning",
    },
    offline: {
      type: "boolean",
      description: "Do not attempt to download and use cached version",
    },
    preferOffline: {
      type: "boolean",
      description: "Use cache if exists otherwise try to download",
    },
    install: {
      type: "boolean",
      description: "Skip install dependencies step",
      default: true,
    },
    packageManager: {
      type: "string",
      description: `Package manager choice (${pmNames.join(", ")})`,
      alias: "p",
      valueHint: currentPackageManager,
    },
    gitInit: {
      type: "boolean",
      description: "Initialize git repository",
    },
    verbose: {
      type: "boolean",
      description: "Show verbose debugging info",
    },
    help: {
      type: "boolean",
      alias: "h",
      description: "Show usage information",
    },
  },
  run: async ({ args }) => {
    // Show usage and exit
    const hasArgs = args.dir || args.template;
    if (args.help || (isAgent && !hasArgs)) {
      console.log(getUsage());
      process.exit(args.help ? 0 : 1);
    }

    const interactive = hasTTY && !isAgent;

    await process.stderr.write(rainbow(BANNER_RAW) + "\n\n");

    if (args.verbose) {
      process.env.DEBUG = process.env.DEBUG || "true";
    }

    // Prompt the user where to create the Nitro app
    if (!args.dir) {
      if (!interactive) {
        (args as any).dir = DEFAULT_DIR;
      } else {
        (args as any) /* readonly */.dir = await consola
          .prompt(`Where would you like to create your ${NAME} app?`, {
            placeholder: `./${DEFAULT_DIR}`,
            type: "text",
            default: DEFAULT_DIR,
            cancel: "reject",
          })
          .catch(() => process.exit(1));
      }
    }

    const cwd = resolve(args.cwd);
    let templateDownloadPath = resolve(cwd, args.dir);
    consola.info(
      `Creating a new project in ${colors.cyan(relative(cwd, templateDownloadPath) || templateDownloadPath)}.`,
    );

    // Prompt the user if the template download directory already exists
    // when no `--force` flag is provided
    let shouldForce = Boolean(args.force);
    if (existsSync(templateDownloadPath) && !shouldForce && !interactive) {
      consola.error(
        `Directory ${colors.cyan(relative(process.cwd(), templateDownloadPath))} already exists. Use --force to override.`,
      );
      process.exit(1);
    }
    while (existsSync(templateDownloadPath) && !shouldForce) {
      const selectedAction = await consola.prompt(
        `The directory ${colors.cyan(relative(process.cwd(), templateDownloadPath))} already exists. What would you like to do?`,
        {
          type: "select",
          options: [
            { label: "Select different directory", value: "new-directory" },
            { label: "Override its contents", value: "override" },
            { label: "Abort", value: "abort" },
          ],
        },
      );
      switch (selectedAction) {
        case "override": {
          shouldForce = true;
          break;
        }
        case "new-directory": {
          templateDownloadPath = resolve(
            cwd,
            await consola
              .prompt("Please specify a different directory:", {
                type: "text",
                cancel: "reject",
              })
              .catch(() => process.exit(1)),
          );
          break;
        }
        // 'Abort' or Ctrl+C
        default: {
          process.exit(1);
        }
      }
    }

    // Prompt the user which template to use
    if (!args.template) {
      if (!interactive) {
        (args as any).template = TEMPLATES[0]!.name;
      } else {
        (args as any) /* readonly */.template = await consola
          .prompt(`What template would you like to use?`, {
            type: "select",
            options: TEMPLATES.map((t) => ({
              value: t.name,
              label: t.description,
            })),
            cancel: "reject",
          })
          .catch(() => process.exit(1));
      }
    }

    // Download the template
    let template: DownloadTemplateResult;
    try {
      template = await downloadTemplate(args.template, {
        registry: REGISTRY_URL,
        dir: templateDownloadPath,
        force: shouldForce,
        forceClean: args.forceClean,
        offline: args.offline,
        preferOffline: args.preferOffline,
      });
    } catch (error) {
      consola.error(error);
      process.exit(1);
    }

    // Prompt to install the dependencies
    const currentPackageManager = detectCurrentPackageManager();
    // Resolve package manager
    const packageManagerArg = args.packageManager as PackageManagerName;
    const selectedPackageManager = pmNames.includes(packageManagerArg)
      ? packageManagerArg
      : !interactive
        ? currentPackageManager || "npm"
        : await consola.prompt("Which package manager would you like to use?", {
            type: "select",
            initial: currentPackageManager,
            cancel: "undefined",
            options: [
              {
                label: "(none)",
                value: "" as PackageManagerName,
                hint: "Skip install dependencies step",
              },
              ...pmNames.map(
                (pm) =>
                  ({
                    label: pm,
                    value: pm,
                    hint: currentPackageManager === pm ? "current" : undefined,
                  }) satisfies SelectPromptOptions["options"][number],
              ),
            ],
          });

    // Install project dependencies
    // or skip installation based on the '--no-install' flag
    if (args.install === false || !selectedPackageManager) {
      consola.info("Skipping install dependencies step.");
    } else {
      consola.start("Installing dependencies...");

      try {
        await installDependencies({
          cwd: template.dir,
          packageManager: {
            name: selectedPackageManager,
            command: selectedPackageManager,
          },
        });
      } catch (error_) {
        if (process.env.DEBUG) {
          throw error_;
        }
        consola.error((error_ as Error).toString());
        process.exit(1);
      }

      consola.success("Installation completed.");
    }

    if (args.gitInit === undefined) {
      if (!interactive) {
        (args as any).gitInit = false;
      } else {
        (args as any) /* readonly */.gitInit = await consola
          .prompt("Initialize git repository?", {
            type: "confirm",
            cancel: "undefined",
          })
          .then(Boolean);
      }
    }
    if (args.gitInit) {
      try {
        const { x } = await import("tinyexec");
        await x("git", ["init", template.dir], {
          throwOnError: true,
          nodeOptions: {
            stdio: "ignore",
          },
        });
        consola.success("Git repository initialized.");
      } catch (error) {
        consola.warn(`Failed to initialize git repository:`, error);
      }
    }

    // Display next steps
    consola.success(`${NAME} project has been created with the \`${template.name}\` template.`);
    consola.info("Next steps:");
    const relativeTemplateDir = relative(process.cwd(), template.dir) || ".";
    if (relativeTemplateDir.length > 1) {
      consola.log(` › cd \`${relativeTemplateDir}\``);
    }
    if (selectedPackageManager) {
      consola.log(` › \`${runScriptCommand(selectedPackageManager, "dev")}\``);
    }
  },
});

runMain(mainCommand);

// ---- Internal utils ----

function getUsage() {
  const bin = globalThis.__pkg_name__ || "create-nitro-app";
  const templates = TEMPLATES.map((t) => t.name).join(", ");
  return `Usage: ${bin} <dir> [options]

Options:
  --template, -t <name>        Template name (${templates})
  --packageManager, -p <name>  Package manager (${pmNames.join(", ")})
  --force                      Overwrite existing directory
  --forceClean                 Remove existing directory before cloning
  --no-install                 Skip dependency installation
  --gitInit                    Initialize git repository
  --offline                    Do not attempt to download, use cache
  --preferOffline              Use cache if exists, otherwise download
  --help, -h                   Show this help message

Example:
  ${bin} my-app --template vite --packageManager npm --gitInit`;
}

function detectCurrentPackageManager() {
  const userAgent = process.env.npm_config_user_agent;
  if (!userAgent) {
    return;
  }
  const [name] = userAgent.split("/");
  if (pmNames.includes(name as PackageManagerName)) {
    return name as PackageManagerName;
  }
}

function rainbow(text: string, offset = Math.random() * 360): string {
  const visible = [...text].filter((c) => c !== " " && c !== "\n").length;
  let i = 0;
  return (
    [...text]
      .map((c) => {
        if (c === " " || c === "\n") return c;
        const [r, g, b] = hueToRgb(offset + (i++ / (visible - 1)) * 360);
        return `\u001B[38;2;${r};${g};${b}m${c}`;
      })
      .join("") + "\u001B[0m"
  );
}

function hueToRgb(h: number): [number, number, number] {
  // HSL with s=75%, l=70%
  // prettier-ignore
  h = ((h % 360) + 360) % 360;
  // prettier-ignore
  const c = 0.45, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = 0.475;
  // prettier-ignore
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
