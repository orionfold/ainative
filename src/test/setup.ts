import "@testing-library/jest-dom/vitest";
import { mkdtempSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// DOM shims only apply under the default jsdom environment. Test files that
// opt into `@vitest-environment node` (pure fs/network modules) have no
// HTMLElement, and this setup file runs for every environment.
if (typeof HTMLElement !== "undefined") {
  // Mock ResizeObserver for cmdk
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock scrollIntoView for cmdk
  HTMLElement.prototype.scrollIntoView = () => {};

  // Mock pointer-capture API for Radix DropdownMenu / Select / etc.
  // JSDOM lacks these, and Radix bails out of opening menus when they're missing.
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = () => {};
}

if (!process.env.RELAY_DATA_DIR) {
  const tempDataDir = mkdtempSync(join(tmpdir(), "relay-vitest-"));
  mkdirSync(tempDataDir, { recursive: true });
  process.env.RELAY_DATA_DIR = tempDataDir;
}
