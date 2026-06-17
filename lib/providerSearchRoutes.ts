export type ProviderSearchRouteKey =
  | "escorts"
  | "prepagos"
  | "acompanantes"
  | "damas-de-compania"
  | "chicas";

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
];

export const providerSearchRoutesByKey = Object.fromEntries(
  providerSearchRoutes.map((route) => [route.key, route])
) as Record<ProviderSearchRouteKey, ProviderSearchRoute>;

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
    `prepagos en ${cityText}`,
    `prepagos ${cityText}`,
    `acompañantes en ${cityText}`,
    `acompanantes ${cityText}`,
    `damas de compañía en ${cityText}`,
    `damas de compania ${cityText}`,
    `chicas en ${cityText}`,
    `chicas ${cityText}`,
    `BelaClub ${cityText}`,
  ];
};
