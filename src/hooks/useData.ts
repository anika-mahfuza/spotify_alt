/**
 * Custom data fetching hook with loading and error states
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseDataOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  deps?: unknown[];
}

export interface UseDataReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: (data: T | null) => void;
}

export function useData<T>(
  fetchFn: () => Promise<T>,
  options: UseDataOptions<T> = {}
): UseDataReturn<T> {
  const { onSuccess, onError, enabled = true, deps = [] } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchFn();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, onSuccess, onError]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, fetchData, ...deps]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    setData,
  };
}

export function useLazyData<T>(
  fetchFn: (...args: unknown[]) => Promise<T>,
  options: Omit<UseDataOptions<T>, 'enabled'> = {}
): UseDataReturn<T> & { execute: (...args: unknown[]) => Promise<void> } {
  const { onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (...args: unknown[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchFn(...args);
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, onSuccess, onError]);

  return {
    data,
    isLoading,
    error,
    refetch: () => execute(),
    setData,
    execute,
  };
}
