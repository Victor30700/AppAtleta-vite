// src/pages/ChatGPTPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { sendMessageToGPT } from '../config/openai';
import { useAuth } from '../context/AuthContext';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import {
  format,
  subDays,
  subWeeks,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  isWithinInterval,
  differenceInCalendarWeeks
} from 'date-fns';
import { es } from 'date-fns/locale';
import '../styles/ChatGPTPage.css';

const COMPONENTS = {
  USER: 'user',
  ATLETISMO: 'atletismo',
  GYM: 'gym',
  CONTROLES: 'controles',
  HEALTH: 'health'
};

const normalizeDate = dateStr => {
  try { return format(parseISO(dateStr), 'yyyy-MM-dd'); }
  catch { return dateStr; }
};

export default function ChatGPTPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore(app);
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([{
    role: 'system',
    content: `Eres Coach Nova, un entrenador 360° experto en nutrición deportiva, atletismo, psicología deportiva y fisioterapia.
Cuando el usuario pregunte por sus registros, respondes solo con sus datos existentes y siempre añades un consejo útil y amigable.`
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);

  useEffect(() => {
    if (showRecommendation) {
      const id = setTimeout(() => setShowRecommendation(false), 10000);
      return () => clearTimeout(id);
    }
  }, [showRecommendation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    let y = 20;
    pdf.setFontSize(18);
    pdf.text('Historial Coach Nova', 20, y);
    y += 10;
    messages.slice(1).forEach(msg => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.setFont('helvetica', 'bold').setFontSize(12);
      pdf.text(`${msg.role === 'user' ? 'Tú' : 'Coach Nova'}:`, 20, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.splitTextToSize(msg.content, 170).forEach(line => {
        pdf.text(line, 20, y); y += 8;
      });
      y += 10;
    });
    pdf.save('historial_coach_nova.pdf');
  };

  // Funciones de obtención de datos mejoradas
  const fetchTrainingRecords = async () => {
    const snap = await getDoc(doc(db, 'registroEntreno', user.email));
    return snap.exists()
      ? snap.data().registros.map(r => ({
          ...r,
          fecha: normalizeDate(r.fecha),
          tipo: COMPONENTS.ATLETISMO
        }))
      : [];
  };

  const fetchGymRecords = async () => {
    const [mensual, diario] = await Promise.all([
      getDoc(doc(db, 'registrosGym', user.email)),
      getDoc(doc(db, 'registroGymDiario', user.email))
    ]);
    
    return [
      ...(mensual.exists() ? mensual.data().registros : []),
      ...(diario.exists() ? diario.data().registros : [])
    ].map(r => ({
      ...r,
      fecha: normalizeDate(r.fecha),
      tipo: COMPONENTS.GYM
    }));
  };

  const fetchControlesPB = async () => {
    const snap = await getDoc(doc(db, 'controlesPB', user.email));
    if (!snap.exists()) return [];
    return Object.entries(snap.data()).flatMap(([prueba, regs]) =>
      regs.map(r => ({
        ...r,
        prueba: prueba.replace('n', 'm'), // Corregir typo 120n => 120m
        fecha: normalizeDate(r.fecha),
        tipo: COMPONENTS.CONTROLES
      }))
    );
  };

  const fetchHealthData = async () => {
    const snap = await getDoc(doc(db, 'healthProfiles', user.email));
    if (!snap.exists()) return { entries: [], injuries: [] };
    
    return {
      entries: (snap.data().bodyEntries || []).map(e => ({
        ...e,
        fecha: normalizeDate(e.date),
        tipo: COMPONENTS.HEALTH
      })),
      injuries: (snap.data().injuries || []).map(i => ({
        ...i,
        fecha: normalizeDate(i.date),
        tipo: COMPONENTS.HEALTH,
        active: i.active === true
      }))
    };
  };

  const fetchUserData = async () => {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return snap.exists() ? snap.data() : null;
  };

  // Mejorado: Manejo preciso de fechas relativas
  const parseDateFromText = text => {
    const today = new Date();
    const lower = text.toLowerCase();
    
    // Manejar semanas completas
    if (/semana pasada/.test(lower)) {
      return {
        start: subWeeks(startOfWeek(today, { locale: es }), 1),
        end: subWeeks(endOfWeek(today, { locale: es }), 1)
      };
    }

    // Manejar días de la semana
    const days = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const foundDay = days.find(d => lower.includes(d));
    
    if (foundDay) {
      const targetDayIndex = days.indexOf(foundDay);
      const currentDayIndex = today.getDay();
      let diff = currentDayIndex - (targetDayIndex === 0 ? 7 : targetDayIndex);
      
      if (diff < 0) diff += 7;
      const date = subDays(today, diff);
      
      if (differenceInCalendarWeeks(today, date) >= 1) {
        return { start: subWeeks(date, 1), end: subWeeks(date, 1) };
      }
      return { start: date, end: date };
    }

    // Manejar fechas absolutas
    const dateFormats = [
      { regex: /(\d{4})-(\d{2})-(\d{2})/, fn: (y, m, d) => parseISO(`${y}-${m}-${d}`) },
      { regex: /(\d{2})\/(\d{2})\/(\d{4})/, fn: (d, m, y) => parseISO(`${y}-${m}-${d}`) }
    ];
    
    for (const format of dateFormats) {
      const match = text.match(format.regex);
      if (match) {
        const date = format.fn(...match.slice(1));
        return { start: date, end: date };
      }
    }

    // Manejar referencias relativas
    const relativeDates = {
      hoy: today,
      ayer: subDays(today, 1),
      anteayer: subDays(today, 2)
    };
    
    for (const [key, date] of Object.entries(relativeDates)) {
      if (lower.includes(key)) return { start: date, end: date };
    }

    return null;
  };

  // Filtrado mejorado por fecha y tipo
  const filterRecords = (records, range, types) => {
    if (!range || !types.length) return [];
    
    return records.filter(r => {
      const recordDate = parseISO(r.fecha);
      return (
        isWithinInterval(recordDate, { 
          start: startOfDay(range.start), 
          end: endOfDay(range.end)
        }) && types.includes(r.tipo)
      );
    });
  };

  // Generadores de respuestas mejorados
  const genUserProfile = (userData, healthData) => {
    const latestHealth = healthData.entries[0] || {};
    return `¡Hola ${userData.fullName.split(' ')[0]}! 👋
🏃 Tipo de corredor: ${userData.tipoCorredor}
📅 Edad: ${userData.age} años
⚖️ Peso actual: ${latestHealth.weightKg || '--'} kg
📏 Altura: ${latestHealth.heightM || '--'} m
${healthData.injuries.some(i => i.active) ? '⚠️ Lesiones activas: ' + healthData.injuries.filter(i => i.active).map(i => i.name).join(', ') : '✅ Sin lesiones activas'}`;
  };

  const genTrainingDetails = (training) => {
    const date = format(parseISO(training.fecha), 'dd/MM/yyyy');
    return `📅 ${date} - 🏃 Entrenamiento de pista
📝 Plan: ${training.plan}
⚡ Estado: ${training.estadoFisico}/10 | 😄 Ánimo: ${training.animo}/5 | 💤 Sueño: ${training.sleepHours}h
${training.series?.length ? '🔁 Series:\n' + training.series.map(s => 
  `- ${s.pruebaKey}: ${s.repeticiones}x${s.distancia} @ ${s.porcentaje}% (${s.base}s)`
).join('\n') : ''}
${training.sensaciones ? '\n💬 Sensaciones: ' + training.sensaciones : ''}
💡 Consejo: ${training.animo < 3 ? 'Trabaja en tu motivación con metas a corto plazo. ' : ''}
${training.sleepHours < 7 ? 'Prioriza el descanso para mejor recuperación.' : 'Mantén una buena hidratación.'}`;
  };

  const genGymSession = (session) => {
    const date = format(parseISO(session.fecha), 'dd/MM/yyyy');
    return `📅 ${date} - 🏋️ Gimnasio (${session.zona})
📝 Plan: ${session.plan}
💪 Ejercicios:
${session.ejercicios.map(e => `- ${e.nombre}: ${e.repeticiones} reps × ${e.pesos.join(' → ')} kg`).join('\n')}
💡 Consejo: ${session.zona?.toLowerCase().includes('superior') ? 
  'Mantén la técnica correcta en press de banca' : 
  'Controla el movimiento excéntrico'}`;
  };

  const genHealthEntry = (entry, injuries) => {
    const date = format(parseISO(entry.fecha), 'dd/MM/yyyy');
    let response = `📅 ${date} - Registro Corporal
⚖️ Peso: ${entry.weightKg} kg | 📏 Altura: ${entry.heightM} m
📊 IMC: ${entry.bmi} (${entry.category}) | 🎯 Ideal: ${entry.idealMinKg}-${entry.idealMaxKg} kg
${entry.bodyFat ? `📉 Grasa corporal: ${entry.bodyFat}\n` : ''}`;

    if (entry.notes) {
      const goalMatch = entry.notes.match(/objetivo pesar (\d+) kg/);
      if (goalMatch) response += `🎯 Objetivo: ${goalMatch[1]} kg\n`;
    }

    if (injuries.some(i => i.active)) {
      response += `\n⚠️ Lesiones activas detectadas:\n${injuries.filter(i => i.active)
        .map(i => `- ${i.name} (desde ${format(parseISO(i.fecha), 'dd/MM')})`).join('\n')}`;
    }

    response += `\n💡 Nutrición: ${
      entry.activityLevel === 'Alto' ? 
      'Aumenta proteínas (2g/kg) y carbohidratos complejos' :
      'Mantén dieta balanceada con énfasis en vegetales'
    }${injuries.length ? '\n🍴 Alimentos antiinflamatorios: Pescado, nueces, cúrcuma' : ''}`;

    return response;
  };

  const genPBControl = (control) => {
    const date = format(parseISO(control.fecha), 'dd/MM/yyyy');
    return `📅 ${date} - ⏱️ ${control.prueba}: ${control.valor}${control.unidad}
${control.sensaciones ? '💬 ' + control.sensaciones : ''}
💡 Consejo: ${control.prueba <= 100 ? 'Mejora tu salida' : 'Trabaja la distribución de esfuerzo'}`;
  };

  // Detección de intenciones mejorada
  const detectIntent = (text) => {
    const lower = text.toLowerCase();
    const intents = new Set();
    
    if (/(peso|altura|imc|grasa|masa)/.test(lower)) intents.add(COMPONENTS.HEALTH);
    if (/(lesión|lesion|desgarre|dolor)/.test(lower)) intents.add(COMPONENTS.HEALTH);
    if (/(tiempo|marca|control|pb|prueba|segundo)/.test(lower)) intents.add(COMPONENTS.CONTROLES);
    if (/(entreno|atletismo|pista)/.test(lower)) intents.add(COMPONENTS.ATLETISMO);
    if (/(gym|pesas|ejercicio|musculación)/.test(lower)) intents.add(COMPONENTS.GYM);
    if (/(quien soy|mi perfil|mis datos)/.test(lower)) intents.add(COMPONENTS.USER);
    
    return Array.from(intents);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setMessages(ms => [...ms, { role: 'user', content: input }]);

    try {
      const [userData, trainings, gyms, pbControls, healthData] = await Promise.all([
        fetchUserData(),
        fetchTrainingRecords(),
        fetchGymRecords(),
        fetchControlesPB(),
        fetchHealthData()
      ]);
      
      const allRecords = [
        ...trainings,
        ...gyms,
        ...pbControls,
        ...healthData.entries,
        ...healthData.injuries
      ].sort((a, b) => b.fecha.localeCompare(a.fecha));

      const intents = detectIntent(input);
      const dateRange = parseDateFromText(input);
      
      let reply = '';

      // Manejo de consultas específicas
      if (intents.includes(COMPONENTS.USER)) {
        reply = genUserProfile(userData, healthData);
      }
      else if (input.match(/\b(\d+m)\b/)) {
        const distance = input.match(/(\d+m)/)[0].replace('m', '') + 'm';
        const controls = pbControls.filter(c => c.prueba === distance);
        reply = controls.length ? 
          controls.map(genPBControl).join('\n\n') :
          `No hay registros para ${distance}`;
      }
      else if (dateRange && intents.length) {
        const filtered = filterRecords(allRecords, dateRange, intents);
        reply = filtered.map(record => {
          switch(record.tipo) {
            case COMPONENTS.ATLETISMO: return genTrainingDetails(record);
            case COMPONENTS.GYM: return genGymSession(record);
            case COMPONENTS.CONTROLES: return genPBControl(record);
            case COMPONENTS.HEALTH: 
              return record.weightKg ? 
                genHealthEntry(record, healthData.injuries) : 
                `📅 ${format(parseISO(record.fecha), 'dd/MM/yyyy')} - Lesión: ${record.name} (${record.active ? 'Activa' : 'Recuperada'})`;
            default: return '';
          }
        }).filter(Boolean).join('\n\n') || 'No encontré registros para esta fecha';
      }
      else {
        const context = [
          ...trainings.slice(0, 3),
          ...gyms.slice(0, 2),
          ...healthData.entries.slice(0, 1)
        ].map(r => JSON.stringify(r)).join('\n');
        
        const aiResponse = await sendMessageToGPT([
          { role: 'system', content: messages[0].content },
          { role: 'user', content: `Pregunta: ${input}\nContexto:\n${context}` }
        ]);
        reply = aiResponse.trim();
      }

      setMessages(ms => [...ms, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages(ms => [...ms, { 
        role: 'assistant', 
        content: '⚠️ Ocurrió un error al procesar tu solicitud. Intenta nuevamente.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button" onClick={() => navigate('/')}>⬅ Volver</button>
        <h2 className="chat-title">Coach Nova</h2>
        <button className="download-btn" onClick={handleDownloadPDF}>Descargar Conversación</button>
      </div>

      {showRecommendation && (
        <div className="recommendation-msg">
          <button className="close-btn" onClick={() => setShowRecommendation(false)}>✖</button>
          <strong>💡 Recomendaciones de uso</strong>
          <p>🔒 Las conversaciones no se almacenan automáticamente.</p>
          <p>🧠 Haz preguntas claras y específicas.</p>
        </div>
      )}

      <div className="chat-box" ref={messagesEndRef}>
        {messages.slice(1).map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="role-label">{msg.role === 'user' ? 'Tú' : 'Coach Nova'}</span>
              <button
                className="copy-btn"
                onClick={() => navigator.clipboard.writeText(msg.content)}
                title="Copiar mensaje"
              >
                <Copy size={16} />
              </button>
            </div>
            <div className="message-content">
              {msg.content.split('\n').map((l, idx) => <p key={idx}>{l}</p>)}
            </div>
          </div>
        ))}
        {loading && <div className="message assistant">Escribiendo...</div>}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu mensaje..."
        />
        <button onClick={handleSend} disabled={loading}>Enviar</button>
      </div>
    </div>
  );
}
