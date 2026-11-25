import { cache } from "react";
import {
  getProviderPhonePath,
  getPublicProviderProfileByPhone,
  getPublicProviderProfileBySlug,
} from "@/lib/publicProviders";

export const resolvePublicProfileRoute = cache(getPublicProviderProfileBySlug);
export const resolvePublicPhoneRoute = cache(getPublicProviderProfileByPhone);

export async function getPublicPhoneRedirectPath(pathname: string) {
  const match = /^\/telefono\/([^/]+)$/.exec(pathname);
  if (!match) return null;

  let phoneSlug: string;
  try {
    phoneSlug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const provider = await getPublicProviderProfileByPhone(phoneSlug);
  const canonicalPath = provider ? getProviderPhonePath(provider) : "";
  return canonicalPath && canonicalPath !== pathname ? canonicalPath : null;
}

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
