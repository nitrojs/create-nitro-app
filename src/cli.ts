#!/usr/bin/env node
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { downloadTemplate } from "giget";
import type { DownloadTemplateResult } from "giget";
import { hasTTY } from "std-env";
// @ts-expect-error JSON import not supported for NodeNext but we use jiti here
import { name, version, description } from "../package.json" with { type: "json" }; // prettier-ignore
import { nitroIcon, themeColor } from "./utils/ascii.ts";

// TODO: Uncomment once create-nitro-app repository is public
// const DEFAULT_REGISTRY =
//   "https://raw.githubusercontent.com/nitrojs/create-nitro-app/registry";
const DEFAULT_REGISTRY =
  "https://raw.githubusercontent.com/nitrojs/starter/templates";

const mainCommand = defineCommand({
  meta: {
    name,
    version,
    description,
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
    if (hasTTY) {
      process.stdout.write(`\n${nitroIcon}\n\n`);
    }
    consola.info(
      colors.bold(
        [...`Welcome to Nitro!`].map((m) => `${themeColor}${m}`).join(""),
      ),
    );

    if (args.verbose) {
      process.env.DEBUG = process.env.DEBUG || "true";
    }

    if (args.dir === "") {
      args.dir = await consola
        .prompt("Where would you like to create your Nitro app?", {
          placeholder: "./nitro-app",
          type: "text",
          default: "nitro-app",
          cancel: "reject",
        })
        .catch(() => process.exit(1));
    }

    const cwd = resolve(args.cwd);
    let templateDownloadPath = resolve(cwd, args.dir);
    consola.info(
      `Creating a new project in ${colors.cyan(relative(cwd, templateDownloadPath) || templateDownloadPath)}.`,
    );

    let shouldForce = Boolean(args.force);
    // Prompt the user if the template download directory already exists
    // when no `--force` flag is provided
    const shouldVerify = !shouldForce && existsSync(templateDownloadPath);
    if (shouldVerify) {
      const selectedAction = await consola.prompt(
        `The directory ${colors.cyan(templateDownloadPath)} already exists. What would you like to do?`,
        {
          type: "select",
          options: [
            "Override its contents",
            "Select different directory",
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
          options: [
            { value: "vite", label: "Full-stack with Vite" },
            { value: "cli", label: "Backend with Nitro CLI" },
          ],
        },
      );
    }
    let template: DownloadTemplateResult;
    try {
      template = await downloadTemplate(args.template, {
        dir: templateDownloadPath,
        force: shouldForce,
        forceClean: args.forceClean,
        offline: args.offline,
        preferOffline: args.preferOffline,
        registry: DEFAULT_REGISTRY,
      });
    } catch (error_) {
      if (process.env.DEBUG) {
        throw error_;
      }
      consola.error((error_ as Error).toString());
      process.exit(1);
    }

    const _from = template.name || template.url;
    const _to = relative(process.cwd(), template.dir) || "./";
    consola.log(`✨ Successfully cloned \`${_from}\` to \`${_to}\`\n`);
  },
});

runMain(mainCommand);
