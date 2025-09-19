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
import { installDependencies, packageManagers, runScriptCommand } from "nypm";

// Based on: https://github.com/unjs/giget/blob/main/src/cli.ts

const NAME = "Nitro";
const DEFAULT_DIR = "nitro-app";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/nitrojs/starter/templates";

const TEMPLATES = [
  { name: "vite", description: "Full-stack with Vite" },
  { name: "cli", description: "Backend with Nitro CLI" },
];

const BANNER = `\u001B[38;2;255;99;126m
⠀⠀⠀⠀⠀⣴⠶⠶⠶⠶⢶⣤⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢸⡏⠀⠀⠀⠀⣼⠏⠀⠀⠀⠀⠀
⠀⠀⠀⢀⡿⠀⠀⠀⠀⣼⠏⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣼⠃⠀⠀⠀⠸⣯⣤⣤⣤⣤⣤⠀⠀ ▗▖  ▗▖▗▄▄▄▖▗▄▄▄▖▗▄▄▖  ▗▄▖
⠀⠀⣸⡏⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⠋⠀⠀ ▐▛▚▖▐▌  █    █  ▐▌ ▐▌▐▌ ▐▌
⠀⠀⠻⠶⠶⢶⡄⠀⠀⠀⢀⣴⠟⠁⠀⠀⠀ ▐▌ ▝▜▌  █    █  ▐▛▀▚▖▐▌ ▐▌
⠀⠀⠀⠀⠀⣼⠇⠀⠀⣠⡾⠋⠀⠀⠀⠀⠀ ▐▌  ▐▌▗▄█▄▖  █  ▐▌ ▐▌▝▚▄▞▘
⠀⠀⠀⠀⢠⡟⠀⢀⣾⠏⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣸⢃⣴⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⢠⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠘⠋⠀

                \u001B[1mWelcome to ${NAME}!\u001B[22m
\u001B[0m`;

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
      description:
        "Set current working directory to resolve dirs relative to it",
      valueHint: "directory",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Clone to existing directory even if exists",
    },
    forceClean: {
      type: "boolean",
      description:
        "Remove any existing directory or file recursively before cloning",
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
  },
  run: async ({ args }) => {
    process.stderr.write(BANNER);

    if (args.verbose) {
      process.env.DEBUG = process.env.DEBUG || "true";
    }

    // Prompt the user where to create the Nitro app
    if (!args.dir) {
      args.dir = await consola
        .prompt(`Where would you like to create your ${NAME} app?`, {
          placeholder: `./${DEFAULT_DIR}`,
          type: "text",
          default: DEFAULT_DIR,
          cancel: "reject",
        })
        .catch(() => process.exit(1));
    }

    const cwd = resolve(args.cwd);
    let templateDownloadPath = resolve(cwd, args.dir);
    consola.info(
      `Creating a new project in ${colors.cyan(relative(cwd, templateDownloadPath) || templateDownloadPath)}.`,
    );

    // Prompt the user if the template download directory already exists
    // when no `--force` flag is provided
    let shouldForce = Boolean(args.force);
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
      args.template = await consola.prompt(
        `What template would you like to use?`,
        {
          type: "select",
          options: TEMPLATES.map((t) => ({
            value: t.name,
            label: t.description,
          })),
          cancel: "reject"
        },
      ).catch(() => process.exit(1));
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
      args.gitInit = await consola
        .prompt("Initialize git repository?", {
          type: "confirm",
          cancel: "undefined",
        })
        .then(Boolean);
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
    consola.success(
      `${NAME} project has been created with the \`${template.name}\` template.`,
    );
    consola.info("Next steps:");
    const relativeTemplateDir = relative(process.cwd(), template.dir) || ".";
    if (relativeTemplateDir.length > 1) {
      consola.log(` › cd \`${relativeTemplateDir}\``);
    }
    if (selectedPackageManager) {
      consola.log(` › \`${runScriptCommand(selectedPackageManager, "dev")} \``);
    }
  },
});

runMain(mainCommand);

// ---- Internal utils ----

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
