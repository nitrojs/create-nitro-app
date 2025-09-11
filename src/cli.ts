#!/usr/bin/env node
import { relative } from "node:path";
import { defineCommand, runMain } from "citty";
import { consola } from "consola";
import { downloadTemplate } from "giget";

// Based on: https://github.com/unjs/giget/blob/main/src/cli.ts

const DEFAULT_DIR = "nitro-app";
const DEFAULT_TEMPLATE = "v3-nightly-vite";

const mainCommand = defineCommand({
  // meta: {
  //   name: pkg.name,
  //   version: pkg.version,
  //   description: pkg.description,
  // },
  args: {
    dir: {
      type: "positional",
      description: "A relative or absolute path where to extract the template",
      default: DEFAULT_DIR,
      required: false,
    },
    template: {
      description: "Template name",
      type: "string",
      alias: "t",
      default: DEFAULT_TEMPLATE,
    },
    cwd: {
      type: "string",
      description:
        "Set current working directory to resolve dirs relative to it",
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
    if (args.verbose) {
      process.env.DEBUG = process.env.DEBUG || "true";
    }

    const template = `gh:nitrojs/starter#${args.template}`;

    const r = await downloadTemplate(template, {
      dir: args.dir,
      force: args.force,
      forceClean: args.forceClean,
      offline: args.offline,
      preferOffline: args.preferOffline,
      install: args.install,
    });

    const _from = r.name || r.url;
    const _to = relative(process.cwd(), r.dir) || "./";
    consola.log(`✨ Successfully cloned \`${_from}\` to \`${_to}\`\n`);
  },
});

runMain(mainCommand);
