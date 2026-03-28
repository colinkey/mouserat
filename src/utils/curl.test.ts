import { describe, expect, test } from "bun:test";
import { extractUrlVariables, interpolateUrl, buildUrl, applyJqFilter } from "./curl";
import type { Collection, Environment, Request } from "../types/index";

// ---------------------------------------------------------------------------
// extractUrlVariables
// ---------------------------------------------------------------------------

describe("extractUrlVariables", () => {
  test("extracts a single variable", () => {
    expect(extractUrlVariables("/api/users/:id")).toEqual(["id"]);
  });

  test("extracts multiple variables", () => {
    expect(extractUrlVariables("/api/:org/repos/:repo")).toEqual(["org", "repo"]);
  });

  test("returns empty array when no variables", () => {
    expect(extractUrlVariables("/api/users/123")).toEqual([]);
  });

  test("handles underscore in variable name", () => {
    expect(extractUrlVariables("/api/:user_id")).toEqual(["user_id"]);
  });

  test("does not match http:// as a variable", () => {
    expect(extractUrlVariables("https://api.example.com/users/:id")).toEqual(["id"]);
  });

  test("returns empty array for empty string", () => {
    expect(extractUrlVariables("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// interpolateUrl
// ---------------------------------------------------------------------------

describe("interpolateUrl", () => {
  test("replaces a single variable", () => {
    const { url, missing } = interpolateUrl("/api/users/:id", { id: "42" });
    expect(url).toBe("/api/users/42");
    expect(missing).toEqual([]);
  });

  test("replaces multiple variables", () => {
    const { url, missing } = interpolateUrl("/api/:org/repos/:repo", { org: "acme", repo: "app" });
    expect(url).toBe("/api/acme/repos/app");
    expect(missing).toEqual([]);
  });

  test("reports missing variables", () => {
    const { url, missing } = interpolateUrl("/api/users/:id", {});
    expect(url).toBe("/api/users/:id");
    expect(missing).toEqual(["id"]);
  });

  test("reports only missing variables when some are provided", () => {
    const { url, missing } = interpolateUrl("/api/:org/repos/:repo", { org: "acme" });
    expect(url).toBe("/api/acme/repos/:repo");
    expect(missing).toEqual(["repo"]);
  });

  test("leaves URL unchanged when no variables", () => {
    const { url, missing } = interpolateUrl("/api/users/123", {});
    expect(url).toBe("/api/users/123");
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildUrl
// ---------------------------------------------------------------------------

const col = (overrides: Partial<Collection> = {}): Collection => ({
  id: "col-1",
  name: "Test",
  ...overrides,
});

const req = (overrides: Partial<Request> = {}): Request => ({
  id: "req-1",
  name: "Test Request",
  method: "GET",
  ...overrides,
});

const env = (overrides: Partial<Environment> = {}): Environment => ({
  id: "env-1",
  name: "Test Env",
  ...overrides,
});

describe("buildUrl", () => {
  test("env rootUrl + collection relativeUrl + request relativeUrl", () => {
    const url = buildUrl(
      req({ relativeUrl: "/users" }),
      col({ relativeUrl: "/v2" }),
      env({ rootUrl: "https://api.example.com" }),
    );
    expect(url).toBe("https://api.example.com/v2/users");
  });

  test("collection rootUrl overrides environment rootUrl", () => {
    const url = buildUrl(
      req({ relativeUrl: "/orders" }),
      col({ rootUrl: "https://staging.example.com", relativeUrl: "/v1" }),
      env({ rootUrl: "https://api.example.com" }),
    );
    expect(url).toBe("https://staging.example.com/v1/orders");
  });

  test("request rootUrl overrides everything; only request relativeUrl is used", () => {
    const url = buildUrl(
      req({ rootUrl: "https://other.example.com", relativeUrl: "/ping" }),
      col({ rootUrl: "https://staging.example.com", relativeUrl: "/v1" }),
      env({ rootUrl: "https://api.example.com" }),
    );
    expect(url).toBe("https://other.example.com/ping");
  });

  test("no env, collection rootUrl + request relativeUrl", () => {
    const url = buildUrl(
      req({ relativeUrl: "/items" }),
      col({ rootUrl: "https://api.example.com" }),
      null,
    );
    expect(url).toBe("https://api.example.com/items");
  });

  test("no rootUrl anywhere produces relative-only URL", () => {
    const url = buildUrl(
      req({ relativeUrl: "/items" }),
      col({ relativeUrl: "/v1" }),
      null,
    );
    expect(url).toBe("/v1/items");
  });

  test("omitted relativeUrls produce no trailing segments", () => {
    const url = buildUrl(req(), col(), env({ rootUrl: "https://api.example.com" }));
    expect(url).toBe("https://api.example.com");
  });
});

// ---------------------------------------------------------------------------
// applyJqFilter
// ---------------------------------------------------------------------------

describe("applyJqFilter", () => {
  test("extracts a field", async () => {
    const { stdout, exitCode } = await applyJqFilter('{"name":"alice"}', ".name");
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('"alice"');
  });

  test("maps array", async () => {
    const { stdout, exitCode } = await applyJqFilter('[{"id":1},{"id":2}]', "[.[].id]");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual([1, 2]);
  });

  test("returns non-zero exit and stderr for invalid filter", async () => {
    const { exitCode, stderr } = await applyJqFilter("{}", "invalid!!filter");
    expect(exitCode).not.toBe(0);
    expect(stderr.length).toBeGreaterThan(0);
  });

  test("returns non-zero exit for invalid JSON input", async () => {
    const { exitCode } = await applyJqFilter("not json", ".");
    expect(exitCode).not.toBe(0);
  });
});
