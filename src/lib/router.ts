import { useEffect, useState, useCallback } from 'react';

// Lightweight hash-based router. Supports path + query params.
// e.g. #/category/fruits-vegetables?sort=price_asc  →  { path, query, navigate }

export type Route = {
  path: string;
  query: Record<string, string>;
};

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');
  const query: Record<string, string> = {};
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      query[key] = value;
    });
  }
  return { path: path || '/', query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

export function navigate(to: string) {
  if (window.location.hash.slice(1) === to) {
    window.scrollTo(0, 0);
    return;
  }
  window.location.hash = to;
}

export function useNavigate() {
  return useCallback((to: string) => navigate(to), []);
}
