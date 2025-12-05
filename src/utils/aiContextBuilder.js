import { format, parseISO, subDays, isAfter, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const buildAthleteContext = (profile, trainings, gym, pbs, health) => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  // 1. Pre-cálculo de Métricas (Igual que en tus gráficas)
  const last30Days = subDays(today, 30);
  
  // Consistencia
  const recentTrainings = trainings.filter(t => isAfter(parseISO(t.fecha), last30Days));
  const recentGym = gym.filter(g => isAfter(parseISO(g.fecha), last30Days));
  const totalSessions = recentTrainings.length + recentGym.length;
  
  // Sueño (Promedio últimos 10 registros para detectar tendencia actual)
  const allSessionsSorted = [...trainings, ...gym].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const sleepData = allSessionsSorted
    .map(s => Number(s.sleepHours))
    .filter(h => !isNaN(h) && h > 0)
    .slice(0, 10); // Últimos 10
  
  const avgSleep = sleepData.length > 0 
    ? (sleepData.reduce((a, b) => a + b, 0) / sleepData.length).toFixed(1) 
    : '--';

  // Tendencia de Peso
  const weightEntries = health.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  const currentWeight = weightEntries[0]?.weightKg || '--';
  // Buscar peso de hace aprox 1 mes para comparar
  const prevWeightEntry = weightEntries.find(w => differenceInDays(today, parseISO(w.date)) > 20) || weightEntries[weightEntries.length - 1];
  const prevWeight = prevWeightEntry?.weightKg || currentWeight;
  
  let weightTrend = "Estable";
  if (currentWeight !== '--' && prevWeight !== '--') {
    const diff = parseFloat(currentWeight) - parseFloat(prevWeight);
    if (diff > 0.8) weightTrend = `Tendencia al alza (+${diff.toFixed(1)}kg)`;
    else if (diff < -0.8) weightTrend = `Tendencia a la baja (${diff.toFixed(1)}kg)`;
  }

  // --- CONSTRUCCIÓN DEL CONTEXTO (PROMPT) ---

  let context = `ROL: Eres Coach Nova, un entrenador olímpico de élite. Tu análisis se basa estrictamente en los datos biomecánicos y de rendimiento del atleta.\n\n`;
  
  context += `📋 REPORTE DE ESTADO ACTUAL (${todayStr})\n`;
  
  // 1. Perfil y Métricas de Salud
  context += `🔹 FISIOLOGÍA Y SALUD:\n`;
  if (profile) {
    context += `- Atleta: ${profile.fullName || 'Atleta'} (${profile.tipoCorredor || 'General'}) | Edad: ${profile.age || '--'}\n`;
  }
  context += `- Composición Corporal: ${currentWeight}kg | Altura: ${weightEntries[0]?.heightM || '--'}m | ${weightTrend}\n`;
  context += `- Recuperación (Sueño): ${avgSleep} horas/noche (Promedio reciente). ${parseFloat(avgSleep) < 7 ? '⚠️ ALERTA: Sueño insuficiente.' : '✅ Descanso adecuado.'}\n`;
  
  // 2. Estado de Lesiones (CRÍTICO)
  const activeInjuries = health.injuries.filter(i => i.active);
  if (activeInjuries.length > 0) {
    context += `\n🚨 ALERTA MÉDICA - LESIONES ACTIVAS:\n`;
    activeInjuries.forEach(i => {
        context += `  - ${i.name} (Desde: ${i.date}): ${i.notes || ''}\n`;
    });
    context += `  PROTOCOLO: Adapta todas las sugerencias para evitar impacto en estas zonas.\n`;
  } else {
    context += `- Estado Clínico: 🟢 100% APTO (Sin lesiones activas).\n`;
  }

  // 3. Rendimiento y PBs
  context += `\n🏆 RENDIMIENTO Y MARCAS (PBs):\n`;
  if (pbs && pbs.length > 0) {
    const bestPBs = {}; 
    pbs.forEach(pb => {
      if (!bestPBs[pb.prueba] || pb.valor < bestPBs[pb.prueba]) {
        bestPBs[pb.prueba] = pb.valor;
      }
    });
    Object.entries(bestPBs).forEach(([dist, time]) => {
      context += `- ${dist}: ${time}s\n`;
    });
  } else {
    context += "  (Sin registros de PB aún)\n";
  }

  // 4. Análisis de Carga Reciente (Lo que se ve en las gráficas)
  context += `\n📊 ANÁLISIS DE CARGA RECIENTE (Últimos 30 días):\n`;
  context += `- Volumen: ${totalSessions} sesiones totales (Pista + Gym).\n`;
  
  context += `\n🏃 ÚLTIMAS SESIONES DE PISTA:\n`;
  trainings.slice(-5).forEach(t => {
    // Detectar enfoque
    let enfoque = "Técnica/Rodaje";
    if (t.series?.some(s => (s.distancia || s.pruebaKey || '').match(/30m|60m|80m/))) enfoque = "Velocidad Pura/Aceleración";
    else if (t.series?.some(s => (s.distancia || s.pruebaKey || '').match(/150m|200m|300m/))) enfoque = "Resistencia a la Velocidad";
    else if (t.series?.some(s => (s.distancia || s.pruebaKey || '').match(/400m|500m|600m/))) enfoque = "Tolerancia al Lactato";
    
    context += `  📅 ${t.fecha} [${enfoque}]\n`;
    context += `     Subjetivo: Físico ${t.estadoFisico}/10 | Ánimo ${t.animo}/5\n`;
    
    if (t.promedios && t.promedios.length > 0) {
      const tiempos = t.promedios.map(p => `${p.pruebaKey}: ${p.promedio}s`).join(', ');
      context += `     Registros: ${tiempos}\n`;
    }
  });

  // 5. Gym
  if (gym.length > 0) {
    const lastGym = gym[0];
    context += `\n🏋️ ÚLTIMO GYM (${lastGym.fecha}):\n`;
    context += `   Enfoque: ${lastGym.zona || 'General'}\n`;
    if(lastGym.ejercicios) {
        const ejercicios = lastGym.ejercicios.slice(0, 3).map(e => `${e.nombre} (${e.pesos?.slice(-1)[0]}kg)`).join(', ');
        context += `   Cargas Top: ${ejercicios}\n`;
    }
  }

  return context;
};