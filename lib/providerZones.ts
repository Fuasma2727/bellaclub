const cityZoneMap: Record<string, string[]> = {
  medellin: [
    "Laureles",
    "Belen",
    "Estadio",
    "Poblado",
    "Sur",
    "Centro",
    "Ciudad del Rio",
  ],
  rionegro: ["San Antonio", "Centro"],
};

export const normalizeLocationValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export const getProviderZoneOptions = (city: string) => {
  return cityZoneMap[normalizeLocationValue(city)] || [];
};
