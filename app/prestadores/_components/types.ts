export type VerificationStatus = "pending" | "approved" | "rejected";
export type VisitVerificationStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";
export type VerificationBadge = "bronze" | "silver" | "gold" | "platinum";

export type MediaItem = {
  id?: string;
  type: "photo" | "video";
  url?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
};

export type DailyVideo = {
  url: string;
  duration?: number | null;
  expiresAt?: string | null;
};

export type Prestador = {
  id: string;
  name?: string;
  price?: number | string;
  rating?: number | string;
  photoUrl?: string;
  department?: string;
  city?: string;
  zone?: string;
  whatsapp?: string;
  description?: string;
  media?: MediaItem[];
  profileVisible?: boolean;
  verificationStatus?: VerificationStatus;
  visitVerified?: boolean;
  visitVerificationStatus?: VisitVerificationStatus;
  verificationBadge?: VerificationBadge | null;
  badgeVerificationLevel?: 1 | 2 | 3 | 4 | number | string | null;
  promotedUntil?: string | null;
  dailyVideo?: DailyVideo | null;
  profileSlug?: string;
  profilePath?: string;
};

export type PurchasedContentItem = {
  mediaUrl: string;
  mediaId?: string;
};

export type ApiResponse = {
  error?: string;
  success?: boolean;
};

export type PendingPurchase = {
  item: MediaItem;
  index: number;
};

export type CitySeoLink = {
  href: string;
  label: string;
};
