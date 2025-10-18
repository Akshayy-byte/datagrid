import { useState, useCallback, useRef, useEffect } from 'react';
import type { ResolvedThemeTokens, ThemeTokens } from '../types';
import { resolveTheme, ThemeResolver } from '../themes/themeSystem';

type ThemeInput = Partial<ThemeTokens> | Partial<ResolvedThemeTokens> | null | undefined;

interface UseGridThemeOptions {
  initialTheme?: ThemeInput;
  resolver?: ThemeResolver | null;
}

function normalizeThemeInput(input: ThemeInput): Partial<ThemeTokens> {
  if (!input) return {};
  const normalized: Partial<ThemeTokens> = {};
  for (const key of Object.keys(input) as (keyof ThemeTokens)[]) {
    const value = (input as any)[key];
    if (value !== undefined && value !== null) {
      (normalized as any)[key] = value;
    }
  }
  return normalized;
}

function shallowEqualThemePartials(a: Partial<ThemeTokens>, b: Partial<ThemeTokens>): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!(key in b)) return false;
    if ((a as any)[key] !== (b as any)[key]) return false;
  }
  return true;
}

function resolveWithFallback(
  resolver: ThemeResolver | null,
  overrides: Partial<ThemeTokens>,
): ResolvedThemeTokens {
  if (resolver) {
    return resolver.resolve(overrides);
  }
  return resolveTheme(overrides);
}

export function useGridTheme(options: UseGridThemeOptions = {}) {
  const { initialTheme, resolver = null } = options;

  const resolverRef = useRef<ThemeResolver | null>(resolver ?? null);
  resolverRef.current = resolver ?? null;

  const propOverridesRef = useRef<Partial<ThemeTokens>>({});
  const dynamicOverridesRef = useRef<Partial<ThemeTokens>>({});

  const [theme, setThemeState] = useState<ResolvedThemeTokens>(() => {
    const normalized = normalizeThemeInput(initialTheme);
    propOverridesRef.current = normalized;
    dynamicOverridesRef.current = {};
    return resolveWithFallback(resolverRef.current, normalized);
  });

  const recomputeTheme = useCallback(() => {
    setThemeState((prev) => {
      const merged: Partial<ThemeTokens> = {
        ...propOverridesRef.current,
        ...dynamicOverridesRef.current,
      };
      const next = resolveWithFallback(resolverRef.current, merged);
      if (shallowEqualThemePartials(prev, next)) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const normalized = normalizeThemeInput(initialTheme);
    if (shallowEqualThemePartials(normalized, propOverridesRef.current)) {
      return;
    }
    propOverridesRef.current = normalized;
    recomputeTheme();
  }, [initialTheme, recomputeTheme]);

  useEffect(() => {
    recomputeTheme();
  }, [resolver, recomputeTheme]);

  const updateTheme = useCallback((partial: Partial<ResolvedThemeTokens>) => {
    if (!partial) return;
    const next = { ...dynamicOverridesRef.current } as Partial<ThemeTokens>;
    let changed = false;

    for (const key of Object.keys(partial) as (keyof ThemeTokens)[]) {
      const value = (partial as any)[key];
      if (value === undefined || value === null) {
        if (key in next) {
          delete next[key];
          changed = true;
        }
      } else if ((next as any)[key] !== value) {
        (next as any)[key] = value;
        changed = true;
      }
    }

    if (!changed) return;

    dynamicOverridesRef.current = next;
    recomputeTheme();
  }, [recomputeTheme]);

  return {
    theme,
    setTheme: updateTheme,
  };
}
