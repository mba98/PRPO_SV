export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  const { assertJwtConfigForRuntime } = await import('./lib/jwtConfig.js');
  assertJwtConfigForRuntime();
}
