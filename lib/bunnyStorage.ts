import { randomUUID } from "node:crypto";

const getHost = (value: string) => value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

export const hasBunnyStorageCredentials = () => Boolean(process.env.BUNNY_API_KEY);

export async function putUserFileInBunny({
  body, contentLength, contentType, extension, uid, signal,
}: {
  body: BodyInit;
  contentLength?: number;
  contentType: string;
  extension: string;
  uid: string;
  signal?: AbortSignal;
}) {
  const storageHost = getHost(process.env.BUNNY_STORAGE_HOST || "ny.storage.bunnycdn.com");
  const cdnHost = getHost(process.env.BUNNY_CDN_HOST || "pp-profile-photos-cdn.b-cdn.net");
  const storageZone = process.env.BUNNY_STORAGE_ZONE || "pp-profile-photos";
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  const uploadPath = `users/${safeUid}/${Date.now()}-${randomUUID()}.${extension}`;

  const headers: Record<string, string> = {
    AccessKey: process.env.BUNNY_API_KEY || "",
    "Content-Type": contentType,
  };
  if (contentLength && contentLength > 0) headers["Content-Length"] = String(contentLength);

  const init: RequestInit & { duplex?: "half" } = {
    method: "PUT",
    headers,
    body,
    signal,
    redirect: "error",
  };
  if (body instanceof ReadableStream) init.duplex = "half";

  const storageUrl = `https://${storageHost}/${storageZone}/${uploadPath}`;
  const response = await fetch(storageUrl, init);
  return {
    response,
    url: `https://${cdnHost}/${uploadPath}`,
    async discard() {
      const removed = await fetch(storageUrl, {
        method: "DELETE",
        headers: { AccessKey: headers.AccessKey },
        signal: AbortSignal.timeout(5_000),
        redirect: "error",
      });
      await removed.body?.cancel();
      if (!removed.ok && removed.status !== 404) {
        throw new Error(`Bunny cleanup failed with status ${removed.status}`);
      }
    },
  };
}
