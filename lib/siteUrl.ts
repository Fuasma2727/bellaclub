const FALLBACK_SITE_URL = "https://belaclub.co";
const BELACLUB_HOSTS = new Set(["belaclub.co", "www.belaclub.co"]);

const normalizeSiteUrl = (value?: string) => {
  const rawValue = (value || FALLBACK_SITE_URL).trim();

  try {
    const url = new URL(rawValue);

    if (BELACLUB_HOSTS.has(url.hostname.toLowerCase())) {
      url.protocol = "https:";
      url.hostname = "belaclub.co";
      url.port = "";
    }

    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/, "") || FALLBACK_SITE_URL;
  } catch {
    return FALLBACK_SITE_URL;
  }
};

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL);
export const siteHomeUrl = `${siteUrl}/`;

export const absoluteSiteUrl = (path = "/") =>
  `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
