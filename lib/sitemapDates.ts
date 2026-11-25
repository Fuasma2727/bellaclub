type ProviderDates = {
  updatedAt?: string | null;
  createdAt?: string | null;
};

/** Use recorded changes, rather than the time somebody fetched the sitemap. */
export function latestProviderModification(providers: readonly ProviderDates[]): Date | undefined {
  let latest = 0;
  const now = Date.now();
  for (const provider of providers) {
    for (const value of [provider.updatedAt, provider.createdAt]) {
      if (!value) continue;
      const timestamp = Date.parse(value);
      if (Number.isFinite(timestamp) && timestamp <= now && timestamp > latest) {
        latest = timestamp;
      }
    }
  }
  return latest ? new Date(latest) : undefined;
}
