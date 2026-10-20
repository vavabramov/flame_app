# flame-mcp

A local [Model Context Protocol](https://modelcontextprotocol.io) server that tells an AI client
(Claude Desktop or any MCP client) which habit templates FLAME supports, and lets the client
build and validate a habit **draft**. This is **Phase 3** of the AI constructor
(`docs/FLAME_AI_CONSTRUCTOR_TECH_SPEC.md`): catalog tools plus the draft lifecycle. Export comes
in Phase 4.

- **Transport:** stdio only. The server opens no network port and runs as your user.
- **No access to the iPhone.** FLAME keeps its data in SQLite on the phone, and this server
  can't read or change it. Blueprints will be moved to the phone by hand in a later phase.
- **Drafts live in memory**, for the current server process only. Nothing is written to disk.
  Drafts are lost when the client restarts the server. A session holds at most 20 drafts.
- **No file, network, shell or database access**, and no dynamic code. A test enforces this.
- **Source of truth:** the catalog lives in the app (`src/features/blueprint/catalog.ts`). The
  server imports it, so it can't advertise something the app doesn't implement.
- **Logging:** a single startup line on stderr. Prompts, arguments and blueprints are never
  logged.

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `get_capabilities` | none (any argument is rejected) | Schema and catalog versions; supported templates and modules; available tools; `supportedTransferMode: "manual-json"`; limitations such as `no-live-phone-database` and `no-cloud-sync` |
| `get_templates` | optional `templateId` (must be exactly `"read-more"`; unknown keys rejected) | The Read More template: required and optional fields, defaults, limits, icon and color tokens, fixed metrics, check-in and streak behavior, clarifying questions, unsupported features |
| `create_draft` | `templateId: "read-more"`, `templateVersion: "1.0.0"`, plus optional `name`, `direction`, `scheduleDays`, `reminderTime`, `dailyTargetMinutes`, `icon`, `colorToken` | A new draft (server-generated `draft_…` ID, revision 1, full blueprint) built from catalog defaults, already validated |
| `get_draft` | `draftId` | The draft and its `validationStatus` (`valid`, `invalid` or `not_validated`) |
| `update_draft` | `draftId`, `patch` with only the fields above | The changed draft. The revision goes up and `validationStatus` resets to `not_validated` |
| `validate_draft` | `draftId` | `valid`, `errors` (stable `code`, `path`, `message`), `warnings` and the normalized blueprint |

Notes:
- **Fixed parts come only from the catalog.** Modules, versions, metrics, widgets and the
  check-in policy can't be set or patched. Unknown keys, JSON-Patch-style operations and file
  paths are rejected.
- **Invalid choices are kept and reported, never silently rewritten.** For example,
  `direction: "break"` stays in the draft and validation explains that Read More is Build-only.
- **Annotations:** the read tools (`get_*`, `validate_draft`) are `readOnlyHint: true`. The draft
  writers only touch this session's memory. All tools are `destructiveHint: false` and
  `openWorldHint: false`.
- **Not implemented yet:** `export_draft` (Phase 4).

## Prerequisites

- Node.js 20 or newer (`node --version`).
- The FLAME repository checked out. The server imports the catalog from `../../src`.

## Install, build, test

Run from this folder (`tools/flame-mcp`). The package has its own `node_modules` and isn't
part of the Expo app or its bundle.

```bash
npm install
npm run build       # bundles src/ (and the shared catalog) into dist/index.js
npm run typecheck   # tsc --noEmit
npm test            # builds, then runs node:test: tool contracts, real stdio, isolation checks
npm start           # runs the server on stdio (waits for a client; Ctrl+C to stop)
```

## Connect Claude Desktop

1. Build once with `npm run build`.
2. Get the absolute path to the built file:
   ```bash
   echo "$(pwd)/dist/index.js"
   ```
3. In Claude Desktop, open **Settings → Developer → Edit Config**. On macOS this opens
   `~/Library/Application Support/Claude/claude_desktop_config.json`.
4. Add the server under `mcpServers`, using the absolute path from step 2 (relative paths don't
   work):
   ```json
   {
     "mcpServers": {
       "flame": {
         "command": "node",
         "args": ["/ABSOLUTE/PATH/TO/flame_app/tools/flame-mcp/dist/index.js"]
       }
     }
   }
   ```
   If Claude Desktop can't find `node`, put the full path from `which node` in `command`.
5. Quit Claude Desktop completely and reopen it. **flame** then appears under connectors, with
   six tools. After rebuilding, restart Claude Desktop again to load the new build.
6. Logs are in `~/Library/Logs/Claude/mcp-server-flame.log`. Only the startup line is written
   there.

No secrets or environment variables are needed.

## Layout

```text
src/
  index.ts                 stdio entry (stderr-only logging)
  server.ts                createServer(): registers the tools
  config.ts                server name/version, tools available in this phase
  catalog/index.ts         re-exports the app's catalog (single source of truth)
  blueprint/index.ts       re-exports the app's blueprint validator and types
  drafts/read-more-factory.ts  builds a blueprint from catalog defaults + allowed params
  drafts/draft-store.ts    in-memory drafts, revisions, validation invalidation
  security/                input limits and tool error codes
  tools/get-capabilities.ts
  tools/get-templates.ts
  tools/draft-inputs.ts    strict zod input schemas for the draft tools
tests/
  tools.test.ts            in-memory client: tool list, annotations, outputs, invalid input
  drafts.test.ts           draft lifecycle: create/get/update/validate, invalidation, limits
  stdio.test.ts            spawns dist/index.js and talks to it over real stdio
  isolation.test.ts        no fs/net/shell/db/dynamic code; app never imports this package
```
