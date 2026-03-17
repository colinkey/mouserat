import { describe, expect, test } from "bun:test";
import {
  stripVars,
  hasVars,
  parsePostmanUrl,
  parseRawUrl,
  parseHeaders,
  parseBody,
  flattenRequests,
  buildCollectionSpecs,
  type Warning,
  type PostmanCollection,
  type PostmanItem,
} from "./import-postman";

// ---------------------------------------------------------------------------
// stripVars / hasVars
// ---------------------------------------------------------------------------

describe("stripVars", () => {
  test("removes a single variable", () => {
    expect(stripVars("{{baseUrl}}/api")).toBe("/api");
  });

  test("removes multiple variables", () => {
    expect(stripVars("{{protocol}}://{{host}}/path")).toBe(":///path");
  });

  test("leaves strings without variables unchanged", () => {
    expect(stripVars("https://api.example.com/users")).toBe("https://api.example.com/users");
  });

  test("removes variable-only string", () => {
    expect(stripVars("{{baseUrl}}")).toBe("");
  });
});

describe("hasVars", () => {
  test("returns true when variable present", () => {
    expect(hasVars("{{baseUrl}}/api")).toBe(true);
  });

  test("returns false when no variables", () => {
    expect(hasVars("https://api.example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRawUrl
// ---------------------------------------------------------------------------

describe("parseRawUrl", () => {
  test("splits a full URL into rootUrl and relativeUrl", () => {
    expect(parseRawUrl("https://api.example.com/v1/users")).toEqual({
      rootUrl: "https://api.example.com",
      relativeUrl: "/v1/users",
    });
  });

  test("includes query string in relativeUrl", () => {
    expect(parseRawUrl("https://api.example.com/search?q=foo")).toEqual({
      rootUrl: "https://api.example.com",
      relativeUrl: "/search?q=foo",
    });
  });

  test("strips variable from host, keeps path as relativeUrl", () => {
    const result = parseRawUrl("{{baseUrl}}/api/users");
    expect(result.rootUrl).toBeUndefined();
    expect(result.relativeUrl).toBe("/api/users");
  });

  test("strips variable from path, keeps rootUrl", () => {
    const result = parseRawUrl("https://api.example.com/{{version}}/users");
    expect(result.rootUrl).toBe("https://api.example.com");
    expect(result.relativeUrl).toBe("//users"); // {{version}} stripped, slashes remain
  });

  test("root path only returns no relativeUrl", () => {
    const result = parseRawUrl("https://api.example.com/");
    expect(result.rootUrl).toBe("https://api.example.com");
    expect(result.relativeUrl).toBeUndefined();
  });

  test("non-URL string stored as relativeUrl", () => {
    expect(parseRawUrl("/just/a/path")).toEqual({ relativeUrl: "/just/a/path" });
  });
});

// ---------------------------------------------------------------------------
// parsePostmanUrl
// ---------------------------------------------------------------------------

describe("parsePostmanUrl", () => {
  test("handles string URL", () => {
    expect(parsePostmanUrl("https://api.example.com/users")).toEqual({
      rootUrl: "https://api.example.com",
      relativeUrl: "/users",
    });
  });

  test("handles object URL with host array and path array", () => {
    const result = parsePostmanUrl({
      protocol: "https",
      host: ["api", "example", "com"],
      path: ["v1", "users"],
    });
    expect(result.rootUrl).toBe("https://api.example.com");
    expect(result.relativeUrl).toBe("/v1/users");
  });

  test("includes port in rootUrl", () => {
    const result = parsePostmanUrl({
      protocol: "http",
      host: "localhost",
      port: "3000",
      path: ["api"],
    });
    expect(result.rootUrl).toBe("http://localhost:3000");
    expect(result.relativeUrl).toBe("/api");
  });

  test("falls back to raw when no protocol or host", () => {
    const result = parsePostmanUrl({ raw: "https://api.example.com/fallback" });
    expect(result.rootUrl).toBe("https://api.example.com");
    expect(result.relativeUrl).toBe("/fallback");
  });

  test("strips variable from host", () => {
    const result = parsePostmanUrl({
      protocol: "https",
      host: "{{host}}",
      path: ["api"],
    });
    expect(result.rootUrl).toBeUndefined();
    expect(result.relativeUrl).toBe("/api");
  });

  test("appends query string to relativeUrl", () => {
    const result = parsePostmanUrl({
      protocol: "https",
      host: "api.example.com",
      path: ["search"],
      query: [
        { key: "q", value: "foo" },
        { key: "page", value: "1" },
      ],
    });
    expect(result.rootUrl).toBe("https://api.example.com");
    expect(result.relativeUrl).toContain("q=foo");
    expect(result.relativeUrl).toContain("page=1");
  });

  test("skips disabled query params", () => {
    const result = parsePostmanUrl({
      protocol: "https",
      host: "api.example.com",
      path: ["search"],
      query: [
        { key: "q", value: "foo", disabled: false },
        { key: "debug", value: "true", disabled: true },
      ],
    });
    expect(result.relativeUrl).toContain("q=foo");
    expect(result.relativeUrl).not.toContain("debug");
  });

  test("returns empty object for empty object url with no raw", () => {
    expect(parsePostmanUrl({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseHeaders
// ---------------------------------------------------------------------------

describe("parseHeaders", () => {
  test("maps key-value headers", () => {
    const warnings: Warning[] = [];
    const result = parseHeaders(
      [{ key: "Accept", value: "application/json" }],
      "col", "req", warnings
    );
    expect(result).toEqual({ Accept: "application/json" });
    expect(warnings).toHaveLength(0);
  });

  test("skips disabled headers", () => {
    const warnings: Warning[] = [];
    const result = parseHeaders(
      [
        { key: "Accept", value: "application/json" },
        { key: "X-Debug", value: "true", disabled: true },
      ],
      "col", "req", warnings
    );
    expect(result).toEqual({ Accept: "application/json" });
  });

  test("copies header with variable verbatim and adds warning", () => {
    const warnings: Warning[] = [];
    const result = parseHeaders(
      [{ key: "X-Api-Key", value: "{{apiKey}}" }],
      "My API", "Get Users", warnings
    );
    expect(result).toEqual({ "X-Api-Key": "{{apiKey}}" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("X-Api-Key");
    expect(warnings[0].message).toContain("{{apiKey}}");
  });

  test("returns undefined for string header", () => {
    const warnings: Warning[] = [];
    expect(parseHeaders("raw header string", "col", "req", warnings)).toBeUndefined();
  });

  test("returns undefined for empty header array", () => {
    const warnings: Warning[] = [];
    expect(parseHeaders([], "col", "req", warnings)).toBeUndefined();
  });

  test("returns undefined for undefined input", () => {
    const warnings: Warning[] = [];
    expect(parseHeaders(undefined, "col", "req", warnings)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseBody
// ---------------------------------------------------------------------------

describe("parseBody", () => {
  test("parses raw JSON body", () => {
    const warnings: Warning[] = [];
    const result = parseBody({ mode: "raw", raw: '{"key":"value"}' }, "col", "req", warnings);
    expect(result).toEqual({ key: "value" });
    expect(warnings).toHaveLength(0);
  });

  test("returns raw string when body is not valid JSON", () => {
    const warnings: Warning[] = [];
    const result = parseBody({ mode: "raw", raw: "plain text body" }, "col", "req", warnings);
    expect(result).toBe("plain text body");
  });

  test("converts urlencoded to record", () => {
    const warnings: Warning[] = [];
    const result = parseBody(
      { mode: "urlencoded", urlencoded: [{ key: "name", value: "Alice" }, { key: "role", value: "admin" }] },
      "col", "req", warnings
    );
    expect(result).toEqual({ name: "Alice", role: "admin" });
  });

  test("skips disabled urlencoded entries", () => {
    const warnings: Warning[] = [];
    const result = parseBody(
      { mode: "urlencoded", urlencoded: [{ key: "name", value: "Alice" }, { key: "debug", value: "1", disabled: true }] },
      "col", "req", warnings
    );
    expect(result).toEqual({ name: "Alice" });
  });

  test("skips formdata body and adds warning", () => {
    const warnings: Warning[] = [];
    const result = parseBody({ mode: "formdata" }, "My API", "Upload", warnings);
    expect(result).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain("formdata");
  });

  test("skips file body and adds warning", () => {
    const warnings: Warning[] = [];
    const result = parseBody({ mode: "file" }, "col", "req", warnings);
    expect(result).toBeUndefined();
    expect(warnings[0].message).toContain("file");
  });

  test("skips graphql body and adds warning", () => {
    const warnings: Warning[] = [];
    const result = parseBody({ mode: "graphql" }, "col", "req", warnings);
    expect(result).toBeUndefined();
    expect(warnings[0].message).toContain("graphql");
  });

  test("returns undefined for null body", () => {
    const warnings: Warning[] = [];
    expect(parseBody(null, "col", "req", warnings)).toBeUndefined();
  });

  test("returns undefined for disabled body", () => {
    const warnings: Warning[] = [];
    expect(parseBody({ mode: "raw", raw: "hello", disabled: true }, "col", "req", warnings)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// flattenRequests
// ---------------------------------------------------------------------------

describe("flattenRequests", () => {
  test("returns flat items unchanged", () => {
    const items: PostmanItem[] = [
      { name: "A", request: { method: "GET" } },
      { name: "B", request: { method: "POST" } },
    ];
    expect(flattenRequests(items)).toHaveLength(2);
  });

  test("flattens one level of folders", () => {
    const items: PostmanItem[] = [
      {
        name: "Folder",
        item: [
          { name: "A", request: { method: "GET" } },
          { name: "B", request: { method: "POST" } },
        ],
      },
    ];
    const result = flattenRequests(items);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["A", "B"]);
  });

  test("flattens nested sub-folders", () => {
    const items: PostmanItem[] = [
      {
        name: "Top",
        item: [
          { name: "A", request: { method: "GET" } },
          {
            name: "Sub",
            item: [
              { name: "B", request: { method: "POST" } },
              { name: "C", request: { method: "DELETE" } },
            ],
          },
        ],
      },
    ];
    const result = flattenRequests(items);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(["A", "B", "C"]);
  });

  test("returns empty array for empty input", () => {
    expect(flattenRequests([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCollectionSpecs
// ---------------------------------------------------------------------------

describe("buildCollectionSpecs", () => {
  test("root-level requests go into a collection named after the Postman collection", () => {
    const collection: PostmanCollection = {
      info: { name: "My API", schema: "" },
      item: [
        { name: "Get Users", request: { method: "GET" } },
        { name: "Create User", request: { method: "POST" } },
      ],
    };
    const specs = buildCollectionSpecs(collection);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("My API");
    expect(specs[0].items).toHaveLength(2);
  });

  test("top-level folders each become a collection", () => {
    const collection: PostmanCollection = {
      info: { name: "My API", schema: "" },
      item: [
        { name: "Users", item: [{ name: "List", request: { method: "GET" } }] },
        { name: "Orders", item: [{ name: "Create", request: { method: "POST" } }] },
      ],
    };
    const specs = buildCollectionSpecs(collection);
    expect(specs).toHaveLength(2);
    expect(specs[0].name).toBe("Users");
    expect(specs[1].name).toBe("Orders");
  });

  test("sub-folders are flattened into their parent collection", () => {
    const collection: PostmanCollection = {
      info: { name: "My API", schema: "" },
      item: [
        {
          name: "Users",
          item: [
            { name: "List", request: { method: "GET" } },
            {
              name: "Admin",
              item: [{ name: "Delete", request: { method: "DELETE" } }],
            },
          ],
        },
      ],
    };
    const specs = buildCollectionSpecs(collection);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("Users");
    expect(specs[0].items).toHaveLength(2);
    expect(specs[0].items.map((i) => i.name)).toEqual(["List", "Delete"]);
  });

  test("mix of root requests and folders produces correct specs", () => {
    const collection: PostmanCollection = {
      info: { name: "My API", schema: "" },
      item: [
        { name: "Health", request: { method: "GET" } },
        { name: "Users", item: [{ name: "List", request: { method: "GET" } }] },
      ],
    };
    const specs = buildCollectionSpecs(collection);
    expect(specs).toHaveLength(2);
    expect(specs[0].name).toBe("My API");   // root requests
    expect(specs[1].name).toBe("Users");    // folder
  });

  test("returns empty array for empty collection", () => {
    const collection: PostmanCollection = { info: { name: "Empty", schema: "" }, item: [] };
    expect(buildCollectionSpecs(collection)).toEqual([]);
  });
});
