# Postman Collection Import

Standalone script to import a Postman Collection v2.1.0 JSON file into mouserat.

## Usage

```sh
bun run import-postman path/to/collection.json
```

## Schema reference

The Postman v2.1.0 JSON schema is saved at `postman-collection-v2.1.0.schema.json` in the project root.

## Collection → mouserat mapping

### Folder structure

- Root-level `item-group` (folders) → one mouserat **Collection** per folder
- Root-level `item` (requests not in any folder) → one mouserat **Collection** named after `info.name`
- Nested sub-folders are **flattened** into their top-level parent collection (not created as separate collections)

### Request field mapping

| Postman field | mouserat field | Notes |
|---|---|---|
| `item.name` | `Request.name` | fallback to `"Unnamed"` |
| `item.request.method` | `Request.method` | skip if not in `GET\|POST\|PUT\|PATCH\|DELETE\|HEAD\|OPTIONS` |
| URL `protocol + host + port` | `Request.rootUrl` | strip `{{...}}` tokens, keep surrounding text |
| URL `path + query string` | `Request.relativeUrl` | strip `{{...}}` tokens, keep surrounding text |
| `item.request.header[]` (enabled) | `Request.headers` | skip `disabled: true` headers; headers containing `{{...}}` are copied verbatim and added to warnings |
| `item.request.body` (`raw` mode) | `Request.body` | try `JSON.parse`, fallback to raw string |
| `item.request.body` (`urlencoded` mode) | `Request.body` | convert `{key, value}[]` → `Record<string, string>` |
| `item.request.body` (`formdata`/`file`/`graphql` mode) | — | skipped; added to warnings |
| `item.request.auth` | — | skipped entirely |

### Variables (`{{variableName}}`)

Postman variable syntax is handled differently depending on context:

- **Auth context**: removed entirely (since auth is skipped)
- **URL context**: `{{...}}` tokens are stripped; surrounding text is preserved. The result is split normally into `rootUrl` / `relativeUrl`.
- **All other contexts** (headers, body): copied verbatim as-is and added to the post-import warnings list

### Dropped fields (no mouserat equivalent)

- Pre/post scripts (`event`)
- SSL certificates, proxy config, `protocolProfileBehavior`
- Sample responses (`item[].response[]`)
- Collection/folder-level variables
- All auth types

## Output

The script prints a summary to stdout on completion:

```
Imported 3 collections, 24 requests.

Warnings:
  - [Collection Name / Request Name] Skipped: unsupported method PURGE
  - [Collection Name / Request Name] Body mode "formdata" not supported, body skipped
  - [Collection Name / Request Name] Variable {{apiVersion}} found in header X-API-Version — copied verbatim
```

## Implementation

- **File**: `scripts/import-postman.ts`
- **package.json script**: `"import-postman": "bun run scripts/import-postman.ts"`
- Writes directly to `~/.mouserat/` using the same directory layout as `src/storage/index.ts`
- Does not use the interactive storage helper functions (which create placeholder defaults)
