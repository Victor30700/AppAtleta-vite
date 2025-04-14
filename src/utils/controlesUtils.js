// src/utils/controlesUtils.js

/**
 * Dado un objeto controles { "60m": [{fecha, tiempo}, ...], ... }
 * y una clave de distancia (e.g. "60m" o "5km"),
 * devuelve el registro más reciente (por fecha) o null si no hay.
 */
export function getLatestTime(key, controles) {
    const registros = controles[key] || [];
    if (registros.length === 0) return null;
    // Orden descendente por fecha ISO
    const sorted = [...registros].sort((a, b) =>
      b.fecha.localeCompare(a.fecha)
    );
    return sorted[0].tiempo;
  }
  