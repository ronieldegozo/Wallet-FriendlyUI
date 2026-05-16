import "./StagingBanner.css";

/**
 * Renders a top-of-page banner whenever the app is running outside of
 * the production environment. Driven by the build-time env var
 * `VITE_ENV` (set per-environment via `netlify.toml`):
 *
 *   - production  -> banner is hidden
 *   - staging     -> yellow "STAGING ENVIRONMENT" banner
 *   - anything else (e.g. local dev) -> blue "DEVELOPMENT" banner
 *
 * The banner is intentionally lightweight: no portals, no global state,
 * just a sticky bar at the top of the page that anyone reviewing the
 * site can immediately recognise as non-prod.
 */
export default function StagingBanner() {
  const env = (import.meta.env.VITE_ENV || "").toLowerCase();
  if (!env || env === "production" || env === "prod") {
    return null;
  }

  const isStaging = env === "staging" || env === "stage";
  const label = isStaging ? "STAGING ENVIRONMENT" : "DEVELOPMENT";
  const subtitle = isStaging
    ? "This is a preview build for testing — data here is isolated from production."
    : "Local development build.";

  return (
    <div
      className={`sb-banner ${isStaging ? "sb-banner--staging" : "sb-banner--dev"}`}
      role="status"
      aria-live="polite"
    >
      <span className="sb-banner__pill">{label}</span>
      <span className="sb-banner__text">{subtitle}</span>
    </div>
  );
}
