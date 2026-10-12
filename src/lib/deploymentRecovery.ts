/* Recover a retired code chunk only after the server confirms a different
   application build. No cache purge, hidden integrity bypass or reload loop. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .* failed|unable to preload css/i.test(
    message,
  );
}
let checking: Promise<string | null> | undefined;
let navigating = false;
async function latestBuild(): Promise<string | null> {
  if (checking) return checking;
  checking = (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 2500);
    try {
      const response = await fetch("/build.json", {
        cache: "no-store",
        signal: abort.signal,
      });
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.includes("application/json")
      )
        return null;
      const value = await response.json();
      return typeof value.build === "string" &&
        /^[a-f0-9]{10}$/.test(value.build)
        ? value.build
        : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  try {
    return await checking;
  } finally {
    checking = undefined;
  }
}
export async function recoverFromDeployment(
  station?: string,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  const next = await latestBuild();
  if (!isCurrent()) return false;
  if (navigating) return true;
  if (!next || next === __BUILD_ID__) return false;
  const key = `harbor-update-from-${__BUILD_ID__}`;
  try {
    if (sessionStorage.getItem(key) === next) return false;
    sessionStorage.setItem(key, next);
  } catch {
    return false;
  } // no durable loop guard means no automatic reload
  const url = new URL(location.href);
  if (station && url.searchParams.get("st") !== station) {
    url.searchParams.set("st", station);
    for (const key of ["at", "view", "inspect"]) url.searchParams.delete(key);
  }
  navigating = true;
  location.replace(url.href);
  return true;
}
