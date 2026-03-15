# create-nitro-app

CLI tool that scaffolds new [Nitro](https://nitro.build) applications with a single command. Part of the [nitrojs](https://github.com/nitrojs) ecosystem.

Keep AGENTS.md updated with project structure and architecture.

## Project Structure

```
src/cli.ts           # Main CLI entry point (single-file CLI)
nitro-app/           # Reference Nitro starter template
build.config.mjs     # obuild config (bundles CLI + injects pkg metadata)
dist/                # Compiled output (single bundled .mjs executable)
```

## Architecture

### CLI Flow (`src/cli.ts`)

1. Display ASCII banner
2. Prompt for target directory (default: `nitro-app`)
3. Handle existing directory (override/rename/abort)
4. Select template from registry
5. Download template via `giget` from `https://raw.githubusercontent.com/nitrojs/starter/templates`
6. Detect/select package manager and install dependencies
7. Optionally initialize git repo
8. Display next steps

### CLI Arguments

| Arg                             | Description                        |
| ------------------------------- | ---------------------------------- |
| `dir` (positional)              | Target directory                   |
| `--template/-t`                 | Template name                      |
| `--force`                       | Overwrite existing directory       |
| `--forceClean`                  | Remove existing dir before cloning |
| `--offline` / `--preferOffline` | Cache behavior                     |
| `--install`                     | Install deps (default: true)       |
| `--packageManager/-p`           | Specify PM (npm, pnpm, yarn, bun)  |
| `--gitInit`                     | Initialize git repo                |

### Templates

Hardcoded in `src/cli.ts`:

- **vite** - Full-stack with Vite
- **cli** - Backend with Nitro CLI

### Build System

Uses **obuild** (rolldown-based bundler) to produce a single `dist/cli.mjs` executable (~793KB). Build-time injected globals:

- `globalThis.__pkg_version__`
- `globalThis.__pkg_name__`
- `globalThis.__pkg_description__`

## Key Dependencies

| Package      | Purpose                                        |
| ------------ | ---------------------------------------------- |
| **citty**    | CLI framework (commands, args)                 |
| **consola**  | Logging and interactive prompts                |
| **giget**    | Template downloading from GitHub registry      |
| **nypm**     | Package manager detection and dep installation |
| **tinyexec** | Shell command execution (git init)             |

## Scripts

```bash
pnpm build            # Bundle CLI with obuild
pnpm create-nitro-app # Test CLI locally (node ./src/cli.ts)
pnpm lint             # ESLint + Prettier check
pnpm fmt         # automd + ESLint fix + Prettier format
pnpm test             # lint + type check
pnpm release          # test + changelog + publish + push
```

## Conventions

- ESM only (`"type": "module"`)
- UnJS ESLint preset
- Semantic commit messages with changelogen
- TypeScript strict mode
- 2-space indentation
