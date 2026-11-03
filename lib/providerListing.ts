import type { Prestador } from "@/app/prestadores/_components/types";

// The gallery is fetched when a profile opens; listings only need its counts.
export const toProviderListingCard = (provider: Prestador): Prestador => ({
  id: provider.id,
  name: provider.name,
  price: provider.price,
  rating: provider.rating,
  photoUrl: provider.photoUrl,
  department: provider.department,
  city: provider.city,
  zone: provider.zone,
  whatsapp: provider.whatsapp,
  verificationBadge: provider.verificationBadge,
  badgeVerificationLevel: provider.badgeVerificationLevel,
  promotedUntil: provider.promotedUntil,
  dailyVideo: provider.dailyVideo,
  profileSlug: provider.profileSlug,
  profilePath: provider.profilePath,
  privateMediaCount:
    provider.privateMediaCount ??
    (provider.media || []).filter((item) => item.private).length,
  hasProfileVideo:
    provider.hasProfileVideo ??
    (provider.media || []).some((item) => item.type === "video"),
});
