export const getPhoneSeoValues = (value?: string) => {
  const raw = value?.trim() || "";
  const digits = raw.replace(/\D/g, "");
  const localDigits =
    digits.length === 12 && digits.startsWith("57")
      ? digits.slice(2)
      : digits.length === 10 && digits.startsWith("3")
        ? digits
        : "";
  const internationalDigits = localDigits
    ? `57${localDigits}`
    : digits.length >= 10
      ? digits
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
          localDigits,
          internationalDigits,
          formattedLocal,
          formattedInternational,
        ].filter(Boolean)
      )
    ),
  };
};
