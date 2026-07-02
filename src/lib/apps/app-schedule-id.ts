/**
 * Composite DB id for app-manifest schedules: `app:<appId>:<scheduleId>`.
 *
 * Mirrors the plugin-schedule convention (`plugin:<pluginId>:<specId>`,
 * src/lib/schedules/installer.ts). A deterministic id makes the install-time
 * upsert idempotent and lets the scheduler recover the owning app at fire
 * time without a schema change.
 *
 * Kept in its own module (no DB imports) so both the pack installer and the
 * scheduler can import it statically without touching the runtime-registry
 * chain (TDR-032).
 */

export const APP_SCHEDULE_PREFIX = "app:";

export function appScheduleId(appId: string, scheduleId: string): string {
  return `${APP_SCHEDULE_PREFIX}${appId}:${scheduleId}`;
}

export function isAppScheduleId(id: string): boolean {
  return id.startsWith(APP_SCHEDULE_PREFIX);
}

/**
 * Recover `{ appId, scheduleId }` from a composite id, or null when the id
 * is not app-owned. appId is a clean slug (no colons), so the first two
 * colon-separated segments are unambiguous.
 */
export function parseAppScheduleId(
  id: string
): { appId: string; scheduleId: string } | null {
  if (!isAppScheduleId(id)) return null;
  const rest = id.slice(APP_SCHEDULE_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep === rest.length - 1) return null;
  return { appId: rest.slice(0, sep), scheduleId: rest.slice(sep + 1) };
}
