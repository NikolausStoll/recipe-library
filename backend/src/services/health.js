/**
 * Health-check service (for Docker/HA).
 */
export function getHealth(port) {
  return {
    status: 'ok',
    port: port ?? null,
  }
}
