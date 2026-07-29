import { useEffect, useState, useCallback } from 'react';

// Lightweight History API router. Supports path + query params.
// e.g. /category/fruits-vegetables?sort=price_asc  →  { path, query, navigate }

export type Route = {
  path: string;
  query: Record<string, string>;
};

function parseLocation(): Route {
  const path = window.location.pathname || '/';
  const query: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((value, key) => {
    query[key] = value;
  });
  return { path, query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseLocation());

  useEffect(() => {
    const onLocationChange = () => {
      setRoute(parseLocation());
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onLocationChange);
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  return route;
}

export function navigate(to: string) {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === to) {
    window.scrollTo(0, 0);
    return;
  }
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useNavigate() {
  return useCallback((to: string) => navigate(to), []);
}
