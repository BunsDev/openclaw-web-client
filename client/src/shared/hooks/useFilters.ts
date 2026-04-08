import { useSearchParams } from 'react-router';
import { useCallback, useMemo } from 'react';

type UseFilters = <T extends Record<string, string | number | undefined>>(
  defaultValues: T
) => {
  filters: T;
  setFilter: (updates: Partial<T>) => void;
  resetFilters: () => void;
};

const useFilters: UseFilters = <T extends Record<string, string | number | undefined>>(
  defaultValues: T
) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaultValues };
    
    for (const key of Object.keys(defaultValues)) {
      const value = searchParams.get(key);
      if (value !== null) {
        // Preserve type: if default is number, parse as number
        if (typeof defaultValues[key] === 'number') {
          result[key as keyof T] = Number(value) as T[keyof T];
        } else {
          result[key as keyof T] = value as T[keyof T];
        }
      }
    }
    
    return result;
  }, [searchParams, defaultValues]);

  const setFilter = useCallback(
    (updates: Partial<T>) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === '' || value === defaultValues[key]) {
            newParams.delete(key);
          } else {
            newParams.set(key, String(value));
          }
        }
        
        return newParams;
      });
    },
    [setSearchParams, defaultValues]
  );

  const resetFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return {
    filters,
    setFilter,
    resetFilters,
  };
};

export default useFilters;
