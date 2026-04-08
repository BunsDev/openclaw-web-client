import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/**
 * Hook to extract validation errors from RTK Query error
 * Returns typed field errors or null
 */
export function useValidationErrors(error: unknown): Record<string, string[]> | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'data' in error &&
    typeof (error as { data: unknown }).data === 'object' &&
    (error as { data: unknown }).data !== null &&
    error.status === 422
  ) {
    return (error as { data: Record<string, string[]> }).data;
  }
  return null;
}
