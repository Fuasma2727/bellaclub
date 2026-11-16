import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebaseAdmin";
import { withTimeout } from "@/lib/asyncTimeout";
import { parseSupportAdvisors } from "@/lib/supportAdvisors";

export const SUPPORT_ADVISORS_CACHE_TAG = "support-advisors";

export const supportAdvisorsRef = () =>
  adminDb.collection("siteSettings").doc("supportAdvisors");

export const readSupportAdvisorsSettings = async () => {
  const snapshot = await withTimeout(
    supportAdvisorsRef().get(),
    3000,
    "Support advisors"
  );
  const data = snapshot.data();
  return {
    advisors: parseSupportAdvisors(data?.advisors ?? []),
    revision: typeof data?.revision === "number" ? data.revision : 0,
  };
};

const readPublicSupportAdvisors = unstable_cache(
  async () => {
    const { advisors } = await readSupportAdvisorsSettings();
    return advisors.filter((advisor) => advisor.active);
  },
  ["public-support-advisors-v1"],
  { revalidate: 300, tags: [SUPPORT_ADVISORS_CACHE_TAG] }
);

export const getPublicSupportAdvisors = async () => {
  try {
    return await readPublicSupportAdvisors();
  } catch (error) {
    // A support outage must not take the public listing offline.
    console.error("Could not load support advisors:", error);
    return [];
  }
};
