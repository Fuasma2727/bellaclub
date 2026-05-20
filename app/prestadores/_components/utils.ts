import { Prestador } from "./types";

export const depositAmounts = [50000, 100000, 300000, 500000];

export const formatMoney = (value?: number | string | null) => {
  const numberValue = Number(value || 0);

  if (!numberValue) return "";

  return `$${numberValue.toLocaleString("es-CO")}`;
};

export const getDisplayName = (provider: Prestador) => {
  return provider.name?.trim() || "Prestador verificado";
};

export const getLocation = (provider: Prestador) => {
  return [provider.city, provider.department].filter(Boolean).join(", ");
};

export const getWhatsAppUrl = (phone?: string) => {
  const rawDigits = phone?.replace(/\D/g, "") || "";
  const digits = rawDigits.startsWith("00") ? rawDigits.slice(2) : rawDigits;
  const colombianMobile =
    digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;

  if (colombianMobile.length < 10) return "";

  return `https://wa.me/${colombianMobile}`;
};
