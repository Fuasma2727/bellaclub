export type SupportAdvisor = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
};

export const MAX_SUPPORT_ADVISORS = 550;
export const MAX_SUPPORT_ADVISORS_BODY_BYTES = 256 * 1024;

export class SupportAdvisorsValidationError extends Error {}

export const normalizeSupportPhone = (value: string): string | null => {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  // A Colombian mobile number can be entered without the country code.
  if (!trimmed.startsWith("+")) {
    if (/^3\d{9}$/.test(digits)) {
      digits = `57${digits}`;
    } else if (!/^573\d{9}$/.test(digits)) {
      return null;
    }
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
};

export const displaySupportPhone = (phone: string) =>
  /^\+573\d{9}$/.test(phone) ? `+57 ${phone.slice(3)}` : phone;

export const parseSupportAdvisors = (value: unknown): SupportAdvisor[] => {
  if (!Array.isArray(value) || value.length > MAX_SUPPORT_ADVISORS) {
    throw new SupportAdvisorsValidationError(
      `Puedes guardar hasta ${MAX_SUPPORT_ADVISORS} asesores.`
    );
  }

  const ids = new Set<string>();
  const contacts = new Set<string>();
  return value.map((item: unknown, index) => {
    const row = item as Partial<SupportAdvisor> | null;
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const phone = typeof row?.phone === "string"
      ? normalizeSupportPhone(row.phone)
      : null;

    if (
      typeof row?.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) ||
      ids.has(row.id)
    ) {
      throw new SupportAdvisorsValidationError(
        `El asesor ${index + 1} tiene un identificador inválido. Elimínalo y agrégalo de nuevo.`
      );
    }
    if (!name || name.length > 80) {
      throw new SupportAdvisorsValidationError(
        `Escribe un nombre de hasta 80 caracteres para el asesor ${index + 1}.`
      );
    }
    if (!phone) {
      throw new SupportAdvisorsValidationError(
        `Revisa el número de ${name}. Usa un celular colombiano de 10 dígitos o incluye el indicativo internacional.`
      );
    }
    const contactKey = JSON.stringify([name.toLocaleLowerCase("es"), phone]);
    if (contacts.has(contactKey)) {
      throw new SupportAdvisorsValidationError(
        `${name} ya está registrado con ese número.`
      );
    }
    if (typeof row.active !== "boolean") {
      throw new SupportAdvisorsValidationError(
        `Selecciona si ${name} estará visible.`
      );
    }

    ids.add(row.id);
    contacts.add(contactKey);
    return { id: row.id, name, phone, active: row.active };
  });
};
