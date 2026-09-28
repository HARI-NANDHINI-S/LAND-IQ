import type { PostgrestError } from '@supabase/supabase-js';

export type AppError = {
  name: string;
  message: string;
  code?: string;
  details?: string;
};

export function makeAppError(message: string, code?: string, details?: string): AppError {
  return { name: 'AppError', message, code, details };
}

export function handleSupabaseError(error: PostgrestError): AppError {
  const code = error.code;
  if (code === '23505') return makeAppError('This record already exists. A duplicate entry was detected.', code, error.details ?? undefined);
  if (code === '23503') return makeAppError('This operation failed because a related record does not exist.', code, error.details ?? undefined);
  if (code === '42501') return makeAppError('You do not have permission to perform this action.', code);
  if (code === 'PGRST301') return makeAppError('Session expired. Please log in again.', code);
  return makeAppError(error.message || 'An unexpected database error occurred.', code, error.details ?? undefined);
}

export function toAppError(err: unknown): AppError {
  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'AppError') return err as AppError;
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return handleSupabaseError(err as PostgrestError);
  }
  if (err instanceof Error) return makeAppError(err.message);
  return makeAppError('An unexpected error occurred.');
}
