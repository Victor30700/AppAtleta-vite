import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const buildAthleteContext = (profile, trainings, gym, pbs, health) => {
  const today = format(new Date(), "yyyy-MM-dd");
  let context = `INFORMACIÓN TÉCNICA DEL ATLETA (FECHA HOY: ${today})\n\n`;
  
  // 1. Perfil Biomecánico y Fisiológico
  context += `🔹 PERFIL FISIOLÓGICO:\n`;
  if (profile) {
    context += `- Atleta: ${profile.fullName || 'Atleta'} (${profile.tipoCorredor || 'General'})\n`;
    context += `- Edad: ${profile.age || '--'} | Género: ${profile.sexo || '--'}\n`;
  }
  const lastHealth = health.entries[0]; 
  if (lastHealth) {
    context += `- Composición Corporal: ${lastHealth.weightKg}kg | ${lastHealth.heightM}m | IMC: ${lastHealth.bmi}\n`;
  }
  
  // 2. Estado de Salud (CRÍTICO)
  const activeInjuries = health.injuries.filter(i => i.active);
  if (activeInjuries.length > 0) {
    context += `\n⚠️ ALERTA MÉDICA - LESIONES ACTIVAS:\n`;
    activeInjuries.forEach(i => {
        context += `- ${i.name} (Registrada: ${i.date}): ${i.notes || ''}\n`;
    });
    context += `PROTOCOLO: Prohibido sugerir ejercicios de alto impacto en zona lesionada. Sugerir rehabilitación activa.\n`;
  } else {
    context += `- Estado Clínico: APTO (Sin lesiones activas).\n`;
  }

  // 3. Marcas Personales (PB) - Referencia de rendimiento
  context += `\n🏆 RÉCORDS PERSONALES (PB):\n`;
  if (pbs && pbs.length > 0) {
    const summaryPB = {}; 
    pbs.forEach(pb => {
      if (!summaryPB[pb.prueba] || pb.valor < summaryPB[pb.prueba]) {
        summaryPB[pb.prueba] = pb.valor;
      }
    });
    Object.entries(summaryPB).forEach(([dist, time]) => {
      context += `- ${dist}: ${time}s\n`;
    });
  } else {
    context += "Sin registros de PB.\n";
  }

  // 4. Últimos Entrenamientos (PISTA) - Análisis de Carga
  context += `\n🏃 HISTORIAL DE PISTA RECIENTE (Últimas 5 sesiones):\n`;
  trainings.slice(-5).forEach(t => {
    // Detectar enfoque de la sesión
    let enfoqueSesion = "General";
    if (t.series?.some(s => (s.distancia || s.pruebaKey).includes('100m') || (s.distancia || s.pruebaKey).includes('60m'))) enfoqueSesion = "Velocidad Pura / Potencia";
    else if (t.series?.some(s => (s.distancia || s.pruebaKey).includes('400m') || (s.distancia || s.pruebaKey).includes('500m'))) enfoqueSesion = "Resistencia a la Velocidad";
    
    context += `📅 [${t.fecha}] (${enfoqueSesion}): ${t.plan || ''}\n`;
    context += `   Datos Subjetivos: Físico ${t.estadoFisico}/10 | Ánimo ${t.animo}/5 | Sueño ${t.sleepHours}h\n`;
    
    if (t.promedios && t.promedios.length > 0) {
      const resumen = t.promedios.map(p => `${p.pruebaKey} avg:${p.promedio}s`).join(' | ');
      context += `   Rendimiento Real: ${resumen}\n`;
    }
    context += `   ---\n`;
  });

  // 5. Último Gimnasio
  context += `\n🏋️ ÚLTIMA SESIÓN DE FUERZA:\n`;
  const lastGym = gym[0];
  if (lastGym) {
    context += `📅 [${lastGym.fecha}]: Enfoque ${lastGym.zona || 'General'}.\n`;
    if(lastGym.ejercicios) {
        const ejerciciosStr = lastGym.ejercicios.map(e => `${e.nombre} (${e.pesos?.join('-')}kg)`).slice(0, 4).join(', ');
        context += `   Cargas: ${ejerciciosStr}...\n`;
    }
  }

  return context;
};