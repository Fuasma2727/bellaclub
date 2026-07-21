export const getPhoneSeoValues = (value?: string) => {
  const raw = value?.trim() || "";
  const digits = raw.replace(/\D/g, "");
  const normalizedDigits = digits.startsWith("00") ? digits.slice(2) : digits;
  const localDigits =
    normalizedDigits.length === 12 && normalizedDigits.startsWith("57")
      ? normalizedDigits.slice(2)
      : normalizedDigits.length === 10 && normalizedDigits.startsWith("3")
        ? normalizedDigits
        : "";
  const internationalDigits = localDigits
    ? `57${localDigits}`
    : normalizedDigits.length >= 10
      ? normalizedDigits
      : "";
  const formattedLocal =
    localDigits.length === 10
      ? `${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`
      : "";
  const formattedInternational = formattedLocal
    ? `+57 ${formattedLocal}`
    : raw;

  return {
    raw,
    digits,
    localDigits,
    internationalDigits,
    formattedLocal,
    formattedInternational,
    canonicalDigits: localDigits || internationalDigits,
    variants: Array.from(
      new Set(
        [
          raw,
          digits,
          normalizedDigits,
          localDigits,
          internationalDigits,
          formattedLocal,
          formattedInternational,
        ].filter(Boolean)
      )
    ),
  };
};
