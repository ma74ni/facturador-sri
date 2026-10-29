/** El mensaje de algo capturado en un `catch`, que puede no ser un `Error`. */
export function errorMessage(error: unknown, fallback = 'error desconocido'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return fallback;
}
