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
```

## Data storage (`~/.mouserat/`)

```
collections/
  <uuid>/
    collection.json         # { id, name, rootUrl? }
    requests/
      <uuid>.json           # { id, name, method, url, headers?, body?, jqFilter? }
environments/
  <uuid>.json               # { id, name, rootUrl?, auth?, variables? }
```

## Keybinds

| Key | Action |
|-----|--------|
| `1` | Go to collections list |
| `2` | Go to environments list |
| `↑↓` / `jk` | Navigate lists |
| `enter` | Open collection / execute request / activate environment |
| `esc` / `h` | Go back |
| `n` | New item (creates file with defaults, opens in `$EDITOR`) |
| `e` | Edit in `$EDITOR` / `$VISUAL` |
| `d` | Delete selected item (prompts y/n confirmation) |
| `f` | Set runtime jq filter (request screen) |
| `r` | Reload from disk |
| `q` | Quit |

## Bun conventions

- Use `bun <file>` instead of `node` or `ts-node`
- Use `bun test` for tests
- Use `bun install` / `bun run <script>`
- Prefer `Bun.file` over `node:fs` readFile/writeFile
- Prefer `Bun.spawn` / `Bun.$` over `child_process` where possible
