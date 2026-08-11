import type { Metadata } from "next";

export const EXPLICIT_CONTENT_RATING = "adult";

export const explicitContentMetadata: NonNullable<Metadata["other"]> = {
  rating: EXPLICIT_CONTENT_RATING,
};

export const explicitContentHeader = {
  key: "Rating",
  value: EXPLICIT_CONTENT_RATING,
} as const;
