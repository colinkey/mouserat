# Overview
mouserat is a terminal-based REST API request executor that allows for saving collections of API requests and managing environments. It is a wrapper on top of `curl` and `jq`, with a few other common tools as needed.

## Technical decisions
- Bun as the runtime
- TypeScript
- JSON as the definition language for collections and environments
- All config, including collections and environments, are stored in `~/.mouserat`
- TUI built with `ink` (React for the terminal)

## File structure

```
~/.mouserat/
  collections/
    <uuid>/
      collection.json       # collection metadata (name, optional root URL)
      requests/
        <uuid>.json         # one file per request
  environments/
    <uuid>.json             # one file per environment
```

## Data model

### collection.json
```json
{
  "id": "<uuid>",
  "name": "My Collection",
  "rootUrl": "https://api.example.com"
}
```

### requests/<uuid>.json
```json
{
  "id": "<uuid>",
  "name": "Get users",
  "method": "GET",
  "url": "/users",
  "headers": {},
  "body": null,
  "jqFilter": ".data[]"
}
```

### environments/<uuid>.json
```json
{
  "id": "<uuid>",
  "name": "Production",
  "rootUrl": "https://api.example.com",
  "auth": {
    "type": "basic",
    "email": "user@example.com",
    "password": "secret"
  },
  "variables": {
    "API_KEY": "abc123"
  }
}
```

## Product requirements

### Request execution
1. Execute an API request via `curl` and return the results to the user
2. Requests support all HTTP verbs
3. Authentication is read from the active environment
4. Requests support arbitrary header configuration
5. Requests support a body, defaulting to JSON (`Content-Type: application/json`)
6. URL construction: the request `url` is always appended to the root URL (collection root overrides environment root)
7. Environment variables are injected into the curl execution context as shell-level prefixes: `VAR=value curl ...`

### Environment management
1. Users define environments as JSON files in `~/.mouserat/environments/`
2. Each environment has a name, optional root URL, optional basic auth credentials (email + password), and an optional map of arbitrary key-value environment variables
3. One environment can be set as "active" at a time; the active environment is used for all request execution
4. Basic auth is the supported auth type for now; bearer token support is planned

### Collection management
1. Users define collections as directories in `~/.mouserat/collections/<uuid>/`
2. Each collection has a `collection.json` with a name and optional root URL
3. Individual requests live in `collections/<uuid>/requests/<uuid>.json`
4. Request metadata includes: name, HTTP verb, URL path, headers, body, and an optional default jq filter

### Filtering request responses
1. Each request can have a default `jqFilter` that is applied to the response automatically
2. At execution time, the user can press `f` on the request screen to enter an inline jq filter that overrides the request's default filter for that execution

### User experience

#### Layout
1. mouserat is an executable that opens a full terminal interface
2. A persistent status bar is shown at all times at the bottom of the screen. It displays:
   - The currently active environment (or "No environment" if none is set)
   - Context-sensitive keybind hints for the current screen
3. The request screen uses a split pane: request details on the left, response output on the right

#### Navigation
4. Arrow keys or vim `hjkl` keys navigate lists
5. Press `1` to go to the collections list
6. Press `2` to go to the environments list
7. Press `enter` on a collection to open it and view its requests
8. Press `enter` on a request to execute it
9. Press `enter` on an environment to set it as the active environment

#### Editing
10. Press `e` on a collection to open the full collection directory's `collection.json` in `$EDITOR` or `$VISUAL`
11. Press `e` on a request to open the full `collection.json` in `$EDITOR` or `$VISUAL` (individual request file editing is a future improvement)
12. Press `e` on an environment to open the environment JSON file in `$EDITOR` or `$VISUAL`
13. Press `r` to reload the file from disk and refresh the interface after editing

#### Creating new items
14. Press `n` on the collections screen to create a new collection
15. Press `n` inside a collection to create a new request
16. Press `n` on the environments screen to create a new environment
17. In all cases, a new file or directory is created with a generated UUID and sensible default values, then immediately opened in `$EDITOR` or `$VISUAL` for the user to fill in

#### jq filter
18. Press `f` on the request screen to open an inline input field for a runtime jq filter
19. The runtime filter overrides the request's default `jqFilter` for the current execution only
