import { adminDb } from "@/lib/firebaseAdmin";

export type ProviderCitySeo = {
  city: string;
  department: string;
  slug: string;
  count: number;
};

export const citySlug = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export async function getPublicProviderCities(): Promise<ProviderCitySeo[]> {
  const snapshot = await adminDb
    .collection("users")
    .where("role", "==", "prestador")
    .where("profileVisible", "==", true)
    .where("verificationStatus", "==", "approved")
    .get();

  const bySlug = new Map<string, ProviderCitySeo>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();

    if (data.blocked === true) return;

    const city = String(data.city || "").trim();
    const department = String(data.department || "").trim();
    const slug = citySlug(city);

    if (!city || !slug) return;

    const current = bySlug.get(slug);

    bySlug.set(slug, {
      city,
      department: current?.department || department,
      slug,
      count: (current?.count || 0) + 1,
    });
  });

  return Array.from(bySlug.values()).sort((a, b) =>
    a.city.localeCompare(b.city, "es")
  );
}

export async function findProviderCityBySlug(slug: string) {
  const cities = await getPublicProviderCities();
  return cities.find((city) => city.slug === slug) || null;
}
