export type ProviderSearchRouteKey =
  | "escorts"
  | "prepagos"
  | "acompanantes"
  | "damas-de-compania"
  | "chicas"
  | "masajistas"
  | "universitarias"
  | "putas";

export type ProviderSearchRoute = {
  key: ProviderSearchRouteKey;
  segment: string;
  label: string;
  title: string;
  baseTitle: string;
  noun: string;
  pluralNoun: string;
};

export const providerSearchRoutes: ProviderSearchRoute[] = [
  {
    key: "escorts",
    segment: "escorts",
    label: "Escorts",
    title: "Escorts",
    baseTitle: "Escorts en Colombia",
    noun: "escort",
    pluralNoun: "escorts",
  },
  {
    key: "prepagos",
    segment: "prepagos",
    label: "Prepagos",
    title: "Prepagos",
    baseTitle: "Prepagos en Colombia",
    noun: "prepago",
    pluralNoun: "prepagos",
  },
  {
    key: "acompanantes",
    segment: "acompanantes",
    label: "Acompañantes",
    title: "Acompañantes",
    baseTitle: "Acompañantes en Colombia",
    noun: "acompañante",
    pluralNoun: "acompañantes",
  },
  {
    key: "damas-de-compania",
    segment: "damas-de-compania",
    label: "Damas de compañía",
    title: "Damas de compañía",
    baseTitle: "Damas de compañía en Colombia",
    noun: "dama de compañía",
    pluralNoun: "damas de compañía",
  },
  {
    key: "chicas",
    segment: "chicas",
    label: "Chicas",
    title: "Chicas",
    baseTitle: "Chicas en Colombia",
    noun: "chica",
    pluralNoun: "chicas",
  },
  {
    key: "masajistas",
    segment: "masajistas",
    label: "Masajistas",
    title: "Masajistas",
    baseTitle: "Masajistas en Colombia",
    noun: "masajista",
    pluralNoun: "masajistas",
  },
  {
    key: "universitarias",
    segment: "universitarias",
    label: "Universitarias",
    title: "Universitarias",
    baseTitle: "Universitarias en Colombia",
    noun: "universitaria",
    pluralNoun: "universitarias",
  },
  {
    key: "putas",
    segment: "putas",
    label: "Putas",
    title: "Putas",
    baseTitle: "Putas en Colombia",
    noun: "puta",
    pluralNoun: "putas",
  },
];

export const providerSearchRoutesByKey = Object.fromEntries(
  providerSearchRoutes.map((route) => [route.key, route])
) as Record<ProviderSearchRouteKey, ProviderSearchRoute>;

export const formatProviderSearchRouteList = (items: string[]) => {
  if (items.length <= 1) return items[0] || "";

  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
};

export const getRelatedProviderSearchText = (
  routeKey: ProviderSearchRouteKey
) =>
  formatProviderSearchRouteList(
    providerSearchRoutes
      .filter((route) => route.key !== routeKey)
      .map((route) => route.pluralNoun)
  );

export const getProviderSearchKeywords = (
  route: ProviderSearchRoute,
  city: string
) => {
  const cityText = city || "Colombia";

  return [
    `${route.pluralNoun} en ${cityText}`,
    `${route.pluralNoun} ${cityText}`,
    `escorts en ${cityText}`,
    `escorts ${cityText}`,
    `escots en ${cityText}`,
    `escots ${cityText}`,
    `escrots en ${cityText}`,
    `escrots ${cityText}`,
    `prepagos en ${cityText}`,
    `prepagos ${cityText}`,
    `acompañantes en ${cityText}`,
    `acompanantes ${cityText}`,
    `damas de compañía en ${cityText}`,
    `damas de compania ${cityText}`,
    `chicas en ${cityText}`,
    `chicas ${cityText}`,
    `masajistas en ${cityText}`,
    `masajistas ${cityText}`,
    `universitarias en ${cityText}`,
    `universitarias ${cityText}`,
    `putas en ${cityText}`,
    `putas ${cityText}`,
    `BelaClub ${cityText}`,
  ];
};
