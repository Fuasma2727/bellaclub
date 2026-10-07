type HeaderSource = Pick<Request, "headers">;

const localIps = new Set(["127.0.0.1", "::1", "localhost"]);

const getEnvCsv = (keys: string[]) => {
  return keys
    .flatMap((key) => String(process.env[key] || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getRequestIp = (request: HeaderSource) => {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];

  return (
    candidates
      .map((value) => value?.trim())
      .find(Boolean)
      ?.replace(/^::ffff:/, "") || "unknown"
  );
};

const ipv4ToNumber = (ip: string) => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte < 0 || byte > 255) return null;
    result = (result << 8) + byte;
  }

  return result >>> 0;
};

const matchesCidr = (ip: string, cidr: string) => {
  const [network, prefixText] = cidr.split("/");
  const prefix = Number(prefixText);
  const ipNumber = ipv4ToNumber(ip);
  const networkNumber = ipv4ToNumber(network);

  if (
    ipNumber === null ||
    networkNumber === null ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNumber & mask) === (networkNumber & mask);
};

export const hasIpAllowList = (keys: string[]) => {
  return getEnvCsv(keys).length > 0;
};

export const isIpAllowed = (request: HeaderSource, keys: string[]) => {
  const allowed = getEnvCsv(keys);

  if (allowed.length === 0) return true;

  const ip = getRequestIp(request);

  if (localIps.has(ip)) return true;

  return allowed.some((entry) => {
    if (entry === ip) return true;
    if (entry.includes("/")) return matchesCidr(ip, entry);
    return false;
  });
};

export const assertIpAllowed = (request: HeaderSource, keys: string[]) => {
  if (!isIpAllowed(request, keys)) {
    throw new Error("IP_NOT_ALLOWED");
  }
};

export const adminIpEnvKeys = ["ADMIN_ALLOWED_IPS", "OWNER_ALLOWED_IPS"];
export const siteIpEnvKeys = ["SITE_ALLOWED_IPS"];
