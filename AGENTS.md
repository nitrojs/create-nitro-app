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

The CLI runs in three modes based on environment:

1. **Interactive (TTY)** — full prompts for all options
2. **Non-interactive (no TTY)** — skips prompts, uses defaults
3. **AI Agent (`isAgent` from `std-env`)** — no args: shows usage + exits 1; with args: uses defaults (non-interactive)

Interactive flow:

1. Check for agent/help — show usage if needed
2. Display ASCII banner
3. Prompt for target directory (default: `nitro-app`)
4. Handle existing directory (override/rename/abort)
5. Select template from registry
6. Download template via `giget` from `https://raw.githubusercontent.com/nitrojs/starter/templates`
7. Detect/select package manager and install dependencies
8. Optionally initialize git repo
9. Display next steps

Non-interactive/agent defaults: dir=`nitro-app`, template=`vite`, PM=detected or `npm`, gitInit=`false`.

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
| `--help/-h`                     | Show usage information             |

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
