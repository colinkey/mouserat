# mouserat

**M**odular **O**ffline **U**nopinionated **S**hareable **E**nvironment **R**EST **A**PI **T**ool

A terminal-based REST API client for saving and executing collections of HTTP requests. Built on top of `curl` and `jq`.

## Requirements

- [Bun](https://bun.sh) v1.0+
- `curl` (system)
- `jq` (system)

## Installation

```sh
git clone <repo>
cd mouserat
bun install
```

## Usage

```sh
bun start
```

## Features

- **Collections** — group related requests together, with an optional root URL
- **Requests** — define HTTP requests (any verb) with headers, body, and a default `jq` filter
- **Environments** — configure root URLs, basic auth credentials, and environment variables per environment
- **URL variables** — use `:varName` syntax in URLs (e.g. `/api/users/:id`); supply values via execution context
- **Execution context** — per-run overrides for method, headers, body, and URL variables; last used context is remembered across sessions
- **Request execution** — runs via `curl`, pipes output through `jq`
- **Split pane** — view request details and response side by side
- **Request history** — every executed request is logged; browse and inspect past responses with `3`
- **Editor integration** — press `e` to edit any item in `$EDITOR` or `$VISUAL`

## Keybinds

| Key | Action |
|-----|--------|
| `1` | Collections list |
| `2` | Environments list |
| `3` | Request logs |
| `↑↓` / `jk` | Navigate |
| `enter` | Open collection / execute request / activate environment |
| `esc` / `h` | Back |
| `n` | New item |
| `e` | Edit in `$EDITOR` |
| `v` | Edit execution context — method, headers, body, URL variables (request screen) |
| `l` | Load last used execution context (request screen) |
| `d` | Delete (y/n confirmation) |
| `f` | Set runtime jq filter (request screen) |
| `r` | Reload from disk |
| `q` | Quit |

## Data storage

All config is stored in `~/.mouserat/`:

```
~/.mouserat/
  collections/
    <uuid>/
      collection.json
      requests/
        <uuid>.json
  environments/
    <uuid>.json
  logs/
    <timestamp>-<uuid>.json
  last-execution/
    <request-uuid>.json
```
