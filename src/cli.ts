#!/usr/bin/env node
import type { DownloadTemplateResult } from "giget";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { downloadTemplate } from "giget";

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
      description: "Install dependencies after cloning",
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

    if (args.dir === "") {
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
            "Select different directory",
            "Override its contents",
            "Abort",
          ],
        },
      );
      switch (selectedAction) {
        case "Override its contents": {
          shouldForce = true;
          break;
        }
        case "Select different directory": {
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

    if (!args.template) {
      args.template = await consola.prompt(
        `What template would you like to use?`,
        {
          type: "select",
          options: TEMPLATES.map((t) => ({
            value: t.name,
            label: t.description,
          })),
        },
      );
    }
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

    const _from = template.name || template.url;
    const _to = relative(process.cwd(), template.dir) || "./";
    consola.log(`✨ Successfully cloned \`${_from}\` to \`${_to}\`\n`);
  },
});

runMain(mainCommand);
