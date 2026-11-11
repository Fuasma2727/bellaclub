import { cache } from "react";
import { getPublicProviderProfileBySlug } from "@/lib/publicProviders";

export const resolvePublicProfileRoute = cache(getPublicProviderProfileBySlug);

export async function getPublicProfileRedirectPath(pathname: string) {
  const match = /^\/escorts\/[^/]+\/([^/]+)$/.exec(pathname);
  if (!match) return null;

  let profileSlug: string;
  try {
    profileSlug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  const provider = await getPublicProviderProfileBySlug(profileSlug);

  return provider && provider.profilePath !== pathname
    ? provider.profilePath
    : null;
}
