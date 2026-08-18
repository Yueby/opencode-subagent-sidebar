import { describe, expect, test } from "bun:test";
import { VERSION } from "../src/version.js";

describe("SubagentSidebar metadata and configuration", () => {
  test("exports valid semver package version string", () => {
    expect(VERSION).toBe("0.1.2");
  });
});
