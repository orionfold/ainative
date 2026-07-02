/**
 * Gate for the destructive data ops routes (`/api/data/seed`, `/api/data/clear`).
 *
 * Historically these 404'd on `NODE_ENV === "production"` — which also locked
 * them out of the STAGING harness, whose whole point is to run the real prod
 * build (`next start`, post-#10). The staging recipe opts in explicitly with
 * `RELAY_STAGING=true`; a customer install never sets it, so customer prod
 * runs keep the 404. The opt-in is exact-match ("true") — an env var that
 * leaks in with a junk value must not open destructive endpoints.
 */
export function isDataOpsAllowed(
  env: { NODE_ENV?: string; RELAY_STAGING?: string } = process.env
): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.RELAY_STAGING === "true";
}
