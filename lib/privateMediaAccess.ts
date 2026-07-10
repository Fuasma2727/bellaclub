import crypto from "crypto";

const TOKEN_TTL_SECONDS = 30 * 60;

const getSecret = () => {
  const secret =
    process.env.PRIVATE_MEDIA_SECRET ||
    process.env.WOMPI_INTEGRITY_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.BUNNY_API_KEY;

  if (!secret) {
    throw new Error("PRIVATE_MEDIA_SECRET_NOT_CONFIGURED");
  }

  return secret;
};

const sign = (value: string) => {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
};

export const createPrivateMediaToken = (input: {
  buyerId: string;
  sellerId: string;
  mediaId: string;
  expiresAt?: number;
}) => {
  const expiresAt =
    input.expiresAt || Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${input.buyerId}.${input.sellerId}.${input.mediaId}.${expiresAt}`;

  return {
    expiresAt,
    signature: sign(payload),
  };
};

export const createPrivateMediaUrl = (
  _request: Request,
  input: {
    buyerId: string;
    sellerId: string;
    mediaId: string;
  }
) => {
  const { expiresAt, signature } = createPrivateMediaToken(input);
  const url = new URL("/api/private-media", "https://belaclub.local");

  url.searchParams.set("buyerId", input.buyerId);
  url.searchParams.set("sellerId", input.sellerId);
  url.searchParams.set("mediaId", input.mediaId);
  url.searchParams.set("expiresAt", String(expiresAt));
  url.searchParams.set("signature", signature);

  return `${url.pathname}${url.search}`;
};

export const verifyPrivateMediaToken = (input: {
  buyerId: string;
  sellerId: string;
  mediaId: string;
  expiresAt: number;
  signature: string;
}) => {
  if (!input.expiresAt || input.expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = createPrivateMediaToken({
    buyerId: input.buyerId,
    sellerId: input.sellerId,
    mediaId: input.mediaId,
    expiresAt: input.expiresAt,
  }).signature;

  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(input.signature, "hex");

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
};
