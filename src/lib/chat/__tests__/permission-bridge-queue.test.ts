import { describe, it, expect } from "vitest";
import { AsyncQueue } from "../permission-bridge";

/**
 * Regression guard for the compose "silent second gate" deadlock.
 *
 * The Claude chat engine's SSE generator drains the permission side-channel
 * only when the SDK emits an event. But the Agent SDK's canUseTool callback
 * pauses the SDK indefinitely while a gate is pending, so no SDK events flow
 * and a *second* gate's UI event was never surfaced (60s+ silent wait).
 *
 * The fix races the SDK iterator against a blocking side-channel consumer.
 * That requires AsyncQueue to expose a `pull()` that resolves on the NEXT
 * push even when the consumer began awaiting BEFORE the push arrived — the
 * exact "loop is parked, then an event is emitted" scenario. These tests pin
 * that wake-signal behavior at the primitive level.
 */
describe("AsyncQueue.pull — blocking consumer (wake signal)", () => {
  it("resolves an already-awaiting pull() when an item is pushed later", async () => {
    const q = new AsyncQueue<string>();

    // Consumer begins awaiting BEFORE any item exists (the parked-loop case).
    const pending = q.pull();

    // Producer pushes only after the consumer is already waiting.
    queueMicrotask(() => q.push("gate-2"));

    await expect(pending).resolves.toBe("gate-2");
  });

  it("drains a buffered item immediately when pull() is called after push", async () => {
    const q = new AsyncQueue<string>();
    q.push("gate-1");
    await expect(q.pull()).resolves.toBe("gate-1");
  });

  it("delivers items in FIFO order across interleaved push/pull", async () => {
    const q = new AsyncQueue<number>();
    q.push(1);
    q.push(2);
    // Buffered items drain in push order as pull() consumes them.
    expect(await q.pull()).toBe(1);
    expect(await q.pull()).toBe(2);
    // Buffer now empty: the next pull() parks and is woken by the next push.
    const parked = q.pull();
    q.push(3);
    expect(await parked).toBe(3);
  });

  it("resolves an outstanding pull() with the closed sentinel when the queue closes", async () => {
    const q = new AsyncQueue<string>();
    const pending = q.pull();
    q.close();
    // Closing must not hang a parked consumer — it resolves with a sentinel
    // the loop can detect (undefined) so the generator can exit.
    await expect(pending).resolves.toBeUndefined();
    expect(q.isClosed()).toBe(true);
  });

  it("returns the closed sentinel from pull() after the queue is already closed", async () => {
    const q = new AsyncQueue<string>();
    q.close();
    await expect(q.pull()).resolves.toBeUndefined();
  });
});
