# mouserat

Terminal-based REST API client. TUI built with `ink` (React for the terminal), wrapping `curl` and `jq`.

## Running

```sh
bun start
```

## Project structure

```
index.tsx                   # entry point
src/
  App.tsx                   # root component — all navigation, input handling, state
  types/index.ts            # shared TypeScript types
  storage/index.ts          # read/write ~/.mouserat (collections, requests, environments)
  utils/
    curl.ts                 # builds and executes curl | jq
    editor.ts               # opens $EDITOR / $VISUAL
  components/
    StatusBar.tsx           # bottom bar: keybind hints + active environment
    ConfirmDialog.tsx       # y/n confirmation prompt (replaces status bar when active)
  screens/
    CollectionsScreen.tsx
    CollectionScreen.tsx
    EnvironmentsScreen.tsx
    RequestScreen.tsx
    LogsScreen.tsx          # list of past request logs
    LogScreen.tsx           # detail view for a single log entry
```

## Data storage (`~/.mouserat/`)

```
collections/
  <uuid>/
    collection.json         # { id, name, rootUrl?, relativeUrl? }
    requests/
      <uuid>.json           # { id, name, method, rootUrl?, relativeUrl?, headers?, body?, jqFilter? }
environments/
  <uuid>.json               # { id, name, rootUrl?, auth?, variables? }
logs/
  <timestamp>-<uuid>.json  # RequestLog — { request: {id,name}, execution: Execution, ... }
last-execution/
  <request-uuid>.json      # last Execution context used for a request (persists across sessions)
```

## URL resolution

URLs are composed from three levels of configuration. `rootUrl` at any level overrides all parent `rootUrl` values. `relativeUrl` appends to the nearest `rootUrl` from its parent chain.

| Level | `rootUrl` | `relativeUrl` |
|-------|-----------|---------------|
| Environment | Base server URL | — |
| Collection | Overrides environment's `rootUrl` | Appended after the effective root URL |
| Request | Overrides collection + environment `rootUrl`; only request's `relativeUrl` is appended | Appended after the effective root URL |

**Examples:**
- `env.rootUrl=https://api.example.com`, `collection.relativeUrl=/v2`, `request.relativeUrl=/users` → `https://api.example.com/v2/users`
- `collection.rootUrl=https://staging.example.com`, `collection.relativeUrl=/v1`, `request.relativeUrl=/orders` → `https://staging.example.com/v1/orders`
- `request.rootUrl=https://other.example.com`, `request.relativeUrl=/ping` → `https://other.example.com/ping` (ignores collection/env)

## URL variables

Request URLs support `:varName` path variables (e.g. `/api/users/:id`). Variable values are supplied via the execution context (`v` key) and interpolated at execution time. Environment `variables` serve as lower-priority defaults; execution context `variables` override them.

If a referenced variable is missing when executing, an error is shown in the response pane and no request is sent.

## Keybinds

| Key | Action |
|-----|--------|
| `1` | Go to collections list |
| `2` | Go to environments list |
| `3` | Go to request logs |
| `↑↓` / `jk` | Navigate lists |
| `enter` | Open collection / execute request / activate environment |
| `esc` / `h` | Go back |
| `n` | New item (creates file with defaults, opens in `$EDITOR`) |
| `e` | Edit in `$EDITOR` / `$VISUAL` |
| `v` | Edit execution context (method, headers, body, variables) in `$EDITOR` (request screen) |
| `l` | Load last used execution context (request screen) |
| `d` | Delete selected item (prompts y/n confirmation) |
| `f` | Apply jq filter to response body (opens filter expression in `$EDITOR`) |
| `c` | Copy current jq filter to the request definition |
| `x` | Clear jq filter or execution context (request screen) |
| `r` | Reload from disk |
| `q` | Quit |

## After each unit of work

After completing any meaningful change, review and update `CLAUDE.md` and `README.md` as needed to reflect new features, screens, keybinds, storage layout, or other relevant changes.

## Testing

- Tests live alongside source files as `*.test.ts`
- Run with `bun test`; check coverage with `bun run test:coverage`
- **Strive for 100% test coverage.** Every new function or module should have corresponding tests before the work is considered complete.
- Storage tests inject `process.env.MOUSERAT_BASE_DIR` to redirect I/O to a temp directory — never write tests that touch `~/.mouserat`.
- CI runs typecheck + tests on every push and pull request (`.github/workflows/ci.yml`).

## Bun conventions

- Use `bun <file>` instead of `node` or `ts-node`
- Use `bun test` for tests
- Use `bun install` / `bun run <script>`
- Prefer `Bun.file` over `node:fs` readFile/writeFile
- Prefer `Bun.spawn` / `Bun.$` over `child_process` where possible
