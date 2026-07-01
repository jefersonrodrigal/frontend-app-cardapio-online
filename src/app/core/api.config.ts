import { environment } from '../../environments/environment';

const FALLBACK_ORIGIN = 'http://localhost';

export const apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

function resolveUrl(url: string): URL {
  const baseOrigin = globalThis.location?.origin ?? FALLBACK_ORIGIN;
  return new URL(url, baseOrigin);
}

function apiUrl(): URL {
  return resolveUrl(apiBaseUrl);
}

export function isApiRequest(url: string): boolean {
  const requestUrl = resolveUrl(url);
  const baseApiUrl = apiUrl();

  return requestUrl.origin === baseApiUrl.origin && requestUrl.pathname.startsWith(baseApiUrl.pathname);
}

export function isProtectedApiRequest(url: string, method: string): boolean {
  if (!isApiRequest(url)) {
    return false;
  }

  const requestUrl = resolveUrl(url);
  const normalizedMethod = method.toUpperCase();
  const apiPathPrefix = apiUrl().pathname.replace(/\/+$/, '');
  const requestPath = requestUrl.pathname.slice(apiPathPrefix.length) || '/';

  if (requestPath.startsWith('/Uploads')) {
    return true;
  }

  if (requestPath.startsWith('/Clients/authenticate')) {
    return false;
  }

  if (requestPath.startsWith('/Auth/login')) {
    return false;
  }

  if (requestPath.startsWith('/Orders/client') || requestPath.startsWith('/Orders/track')) {
    return false;
  }

  if (requestPath.startsWith('/Estabelecimento')) {
    return normalizedMethod !== 'GET';
  }

  if (requestPath.startsWith('/Products')) {
    return normalizedMethod !== 'GET';
  }

  if (requestPath.startsWith('/Inventory')) {
    return true;
  }

  if (requestPath.startsWith('/Clients')) {
    return normalizedMethod === 'GET';
  }

  if (requestPath.startsWith('/Orders')) {
    return normalizedMethod === 'GET' || normalizedMethod === 'PUT';
  }

  if (requestPath.startsWith('/Categories')) {
    return normalizedMethod !== 'GET';
  }

  if (requestPath.startsWith('/Integrations')) {
    return true;
  }

  if (requestPath.startsWith('/NeighborhoodDeliveryFees')) {
    return true;
  }

  return false;
}
