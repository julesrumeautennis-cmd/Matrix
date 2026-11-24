export function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', ...headers },
  });
}
