type PayoutMethod = "nequi" | "bancolombia";

type CreateWompiBankPayoutInput = {
  withdrawalId: string;
  providerEmail?: string | null;
  accountHolder: string;
  payoutMethod: string;
  payoutAccount: string;
  payoutAccountType: string;
  legalIdType: string;
  legalId: string;
  releasedAmount: number;
};

type WompiPayoutsConfig = {
  apiKey: string;
  userPrincipalId: string;
  accountId: string;
  baseUrl: string;
  paymentType: string;
};

type WompiApiPayload = Record<string, unknown> | unknown[];

export class WompiPayoutsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WompiPayoutsConfigError";
  }
}

export class WompiPayoutsApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "WompiPayoutsApiError";
    this.status = status;
    this.details = details;
  }
}

const payoutMethodLabels: Record<PayoutMethod, string> = {
  nequi: "NEQUI",
  bancolombia: "BANCOLOMBIA",
};

const payoutMethodBankDefaults: Record<
  PayoutMethod,
  {
    code: string;
    idEnv: string;
    codeEnv: string;
  }
> = {
  nequi: {
    code: "NEQUI",
    idEnv: "WOMPI_PAYOUTS_NEQUI_BANK_ID",
    codeEnv: "WOMPI_PAYOUTS_NEQUI_BANK_CODE",
  },
  bancolombia: {
    code: "BANCOLOMBIA",
    idEnv: "WOMPI_PAYOUTS_BANCOLOMBIA_BANK_ID",
    codeEnv: "WOMPI_PAYOUTS_BANCOLOMBIA_BANK_CODE",
  },
};

const allowedLegalIdTypes = new Set(["CC", "CE", "NIT"]);
const bankIdCache = new Map<string, string>();

const env = (key: string) => process.env[key]?.trim() || "";

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getConfig = (): WompiPayoutsConfig => {
  const apiKey = env("WOMPI_PAYOUTS_API_KEY");
  const userPrincipalId = env("WOMPI_PAYOUTS_USER_PRINCIPAL_ID");
  const accountId = env("WOMPI_PAYOUTS_ACCOUNT_ID");
  const explicitBaseUrl = env("WOMPI_PAYOUTS_BASE_URL");
  const payoutsEnv = env("WOMPI_PAYOUTS_ENV").toLowerCase();
  const baseUrl = explicitBaseUrl
    ? withoutTrailingSlash(explicitBaseUrl)
    : payoutsEnv === "production"
      ? "https://api.payouts.wompi.co/v1"
      : "https://api.sandbox.payouts.wompi.co/v1";

  if (!apiKey || !userPrincipalId || !accountId) {
    throw new WompiPayoutsConfigError(
      "Configura WOMPI_PAYOUTS_API_KEY, WOMPI_PAYOUTS_USER_PRINCIPAL_ID y WOMPI_PAYOUTS_ACCOUNT_ID antes de aprobar retiros automaticos."
    );
  }

  return {
    apiKey,
    userPrincipalId,
    accountId,
    baseUrl,
    paymentType: env("WOMPI_PAYOUTS_PAYMENT_TYPE") || "PROVIDERS",
  };
};

export const isWompiPayoutsConfigured = () => {
  return Boolean(
    env("WOMPI_PAYOUTS_API_KEY") &&
      env("WOMPI_PAYOUTS_USER_PRINCIPAL_ID") &&
      env("WOMPI_PAYOUTS_ACCOUNT_ID")
  );
};

export const getWompiPayoutReference = (withdrawalId: string) => {
  return `withdrawal-${withdrawalId}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
};

const getHeaders = (config: WompiPayoutsConfig, idempotencyKey: string) => ({
  "Content-Type": "application/json",
  "x-api-key": config.apiKey,
  "user-principal-id": config.userPrincipalId,
  "idempotency-key": idempotencyKey,
});

const getAuthHeaders = (config: WompiPayoutsConfig) => ({
  "x-api-key": config.apiKey,
  "user-principal-id": config.userPrincipalId,
});

const parseWompiResponse = async (response: Response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as WompiApiPayload;
  } catch {
    return { raw: text };
  }
};

const normalize = (value: unknown) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
};

const extractArray = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    );
  }

  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.data,
    record.banks,
    record.accounts,
    record.items,
    record.results,
  ];

  for (const candidate of candidates) {
    const extracted = extractArray(candidate);
    if (extracted.length > 0) return extracted;
  }

  return [];
};

const getStringField = (
  record: Record<string, unknown>,
  names: string[]
) => {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
};

const isPayoutMethod = (value: string): value is PayoutMethod => {
  return value === "nequi" || value === "bancolombia";
};

const getBankIdForMethod = async (
  config: WompiPayoutsConfig,
  payoutMethod: string
) => {
  if (!isPayoutMethod(payoutMethod)) {
    throw new WompiPayoutsConfigError("Metodo de retiro no soportado por Wompi.");
  }

  const defaults = payoutMethodBankDefaults[payoutMethod];
  const explicitBankId = env(defaults.idEnv);
  if (explicitBankId) return explicitBankId;

  const bankCode = env(defaults.codeEnv) || defaults.code;
  const cacheKey = `${config.baseUrl}:${bankCode}`;
  const cachedBankId = bankIdCache.get(cacheKey);
  if (cachedBankId) return cachedBankId;

  const url = new URL(`${config.baseUrl}/banks`);
  url.searchParams.set("bankCodes", bankCode);

  const response = await fetch(url, {
    headers: getAuthHeaders(config),
    cache: "no-store",
  });
  const payload = await parseWompiResponse(response);

  if (!response.ok) {
    throw new WompiPayoutsApiError(
      "Wompi no permitio consultar el banco del retiro.",
      response.status,
      payload
    );
  }

  const banks = extractArray(payload);
  const expectedCode = normalize(bankCode);
  const expectedLabel = normalize(payoutMethodLabels[payoutMethod]);
  const bank =
    banks.find((item) => {
      const code = normalize(
        getStringField(item, ["code", "bankCode", "achCode"])
      );
      const name = normalize(getStringField(item, ["name", "bankName"]));

      return (
        code === expectedCode ||
        name === expectedLabel ||
        name.includes(expectedLabel)
      );
    }) || banks[0];

  const bankId = bank ? getStringField(bank, ["id", "bankId", "uuid"]) : "";

  if (!bankId) {
    throw new WompiPayoutsConfigError(
      `No pude resolver el bankId de ${payoutMethodLabels[payoutMethod]}. Configura ${defaults.idEnv} con el id que devuelve Wompi en /banks.`
    );
  }

  bankIdCache.set(cacheKey, bankId);
  return bankId;
};

const getNestedRecord = (payload: unknown, name: string) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const direct = record[name];

  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>)[name];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  return null;
};

const getFirstTransaction = (payload: unknown) => {
  const payout = getNestedRecord(payload, "payout") || payload;
  if (!payout || typeof payout !== "object" || Array.isArray(payout)) return null;

  const transactions = (payout as Record<string, unknown>).transactions;
  const extracted = extractArray(transactions);

  return extracted[0] || null;
};

const summarizeWompiResponse = (payload: unknown) => {
  const payout = getNestedRecord(payload, "payout");
  const transaction = getFirstTransaction(payload);
  const root =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {};

  const payoutSource = payout || data || root;

  return {
    payoutId: getStringField(payoutSource, ["id", "payoutId"]),
    payoutStatus: getStringField(payoutSource, ["status", "payoutStatus"]),
    transactionId: transaction
      ? getStringField(transaction, ["id", "transactionId"])
      : "",
    transactionStatus: transaction
      ? getStringField(transaction, ["status", "transactionStatus"])
      : "",
  };
};

export const createWompiBankPayout = async (
  input: CreateWompiBankPayoutInput
) => {
  const config = getConfig();
  const payoutMethod = input.payoutMethod.toLowerCase();
  const accountType = input.payoutAccountType.toUpperCase();
  const legalIdType = input.legalIdType.toUpperCase();
  const providerEmail = String(input.providerEmail || "").trim();

  if (!providerEmail) {
    throw new WompiPayoutsConfigError(
      "El prestador no tiene correo registrado para enviar el retiro a Wompi."
    );
  }

  if (!allowedLegalIdTypes.has(legalIdType)) {
    throw new WompiPayoutsConfigError(
      "El tipo de documento del retiro no es compatible con Wompi."
    );
  }

  const bankId = await getBankIdForMethod(config, payoutMethod);
  const reference = getWompiPayoutReference(input.withdrawalId);
  const idempotencyKey = reference;
  const amount = Math.floor(Number(input.releasedAmount || 0) * 100);

  if (amount <= 0) {
    throw new WompiPayoutsConfigError("El monto del retiro no es valido.");
  }

  const body = {
    reference,
    accountId: config.accountId,
    paymentType: config.paymentType,
    transactions: [
      {
        legalIdType,
        legalId: input.legalId,
        bankId,
        accountType,
        accountNumber: input.payoutAccount,
        name: input.accountHolder,
        email: providerEmail,
        amount,
        reference,
      },
    ],
  };

  const response = await fetch(`${config.baseUrl}/payouts`, {
    method: "POST",
    headers: getHeaders(config, idempotencyKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await parseWompiResponse(response);

  if (!response.ok) {
    throw new WompiPayoutsApiError(
      "Wompi no pudo crear la dispersion del retiro.",
      response.status,
      payload
    );
  }

  return {
    ...summarizeWompiResponse(payload),
    reference,
    idempotencyKey,
    bankId,
    amountInCents: amount,
  };
};

export const getWompiPayoutsErrorMessage = (error: unknown) => {
  if (error instanceof WompiPayoutsConfigError) return error.message;

  if (error instanceof WompiPayoutsApiError) {
    const details =
      error.details && typeof error.details === "object"
        ? JSON.stringify(error.details).slice(0, 500)
        : String(error.details || "");

    return details
      ? `${error.message} ${details}`
      : `${error.message} Codigo HTTP ${error.status}.`;
  }

  return error instanceof Error
    ? error.message
    : "No pudimos conectar con Wompi Payouts.";
};
