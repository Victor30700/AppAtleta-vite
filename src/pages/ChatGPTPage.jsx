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
  isSameDay,
  startOfWeek,
  endOfWeek,
  addDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import '../styles/ChatGPTPage.css';

const COMPONENTS = {
  GYM: 'gym',
  ATLETISMO: 'atletismo',
  CONTROLES: 'controles',
  USER: 'user'
};

const normalizeDate = dateStr => {
  try { return format(parseISO(dateStr), 'yyyy-MM-dd'); }
  catch { return dateStr; }
};

export default function ChatGPTPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([{
    role: 'system',
    content: `Eres Coach Nova, un entrenador 360° experto en:
• Nutrición deportiva
• Atletismo
• Psicología deportiva
• Fisioterapia

Respondes **solo** con los datos existentes del usuario cuando pregunte por sus registros,
pero en cada respuesta añades un consejo útil o un comentario amigable que dé un toque humano.`
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const messagesEndRef = useRef(null);
  const db = getFirestore(app);
  const navigate = useNavigate();

  // auto-hide recomendaciones
  useEffect(() => {
    if (showRecommendation) {
      const id = setTimeout(() => setShowRecommendation(false), 10000);
      return () => clearTimeout(id);
    }
  }, [showRecommendation]);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCloseRecommendation = () => setShowRecommendation(false);

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    let y = 20;
    pdf.setFontSize(18);
    pdf.text('Historial Coach Nova', 20, y);
    y += 10;
    messages.slice(1).forEach(msg => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${msg.role==='user'?'Tú':'Coach Nova'}:`, 20, y);
      y += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.splitTextToSize(msg.content, 170).forEach(line => {
        pdf.text(line, 20, y); y += 8;
      });
      y += 10;
    });
    pdf.save('historial_coach_nova.pdf');
  };

  // --- Fetchers ---
  const fetchTrainingRecords = async () => {
    const snap = await getDoc(doc(db, 'registroEntreno', user.email));
    return snap.exists()
      ? snap.data().registros.map(r => ({ ...r, fecha: normalizeDate(r.fecha), tipo: COMPONENTS.ATLETISMO }))
      : [];
  };
  const fetchGymRecords = async () => {
    const q = query(collection(db,'registrosGym'), where('metadata.email','==',user.email));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      ...d.data(),
      tipo: COMPONENTS.GYM,
      fecha: normalizeDate(d.data().metadata.actualizadoEn),
      plan: d.data().plan.descripcion || d.data().plan,
      zona: d.data().zona || 'General',
      ejercicios: d.data().ejercicios || []
    }));
  };
  const fetchDailyGymRecords = async () => {
    const snap = await getDoc(doc(db,'registroGymDiario',user.email));
    return snap.exists()
      ? snap.data().registros.map(r => ({
          ...r, tipo: COMPONENTS.GYM,
          fecha: normalizeDate(r.fecha),
          plan: r.plan,
          zona: r.zona || 'General',
          ejercicios: r.ejercicios
        }))
      : [];
  };
  const fetchControlesPB = async () => {
    const snap = await getDoc(doc(db,'controlesPB',user.email));
    if (!snap.exists()) return [];
    return Object.entries(snap.data()).flatMap(([prueba, regs]) =>
      regs.map(r => ({
        prueba,
        ...r,
        tipo: COMPONENTS.CONTROLES,
        fecha: normalizeDate(r.fecha)
      }))
    );
  };
  const fetchUserData = async () => {
    const snap = await getDoc(doc(db,'users',user.uid));
    return snap.exists() ? snap.data() : null;
  };

  // --- Fecha parser ---
  const parseDateFromText = text => {
    const today = new Date(), lower = text.toLowerCase();
    const days = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const found = days.find(d=>lower.includes(d));
    if (found) {
      const idx = days.indexOf(found);
      const start = startOfWeek(today,{locale:es}), target = addDays(start,idx);
      if (lower.includes('semana pasada')) return {start: subWeeks(target,1), end: subWeeks(target,1)};
      return {start: target, end: target};
    }
    let m = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) { const d=parseISO(m[1]); return {start:d,end:d}; }
    m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) { const d=parseISO(`${m[3]}-${m[2]}-${m[1]}`); return {start:d,end:d}; }
    if (/hoy/.test(lower)) return {start:today,end:today};
    if (/ayer/.test(lower)) { const d=subDays(today,1); return {start:d,end:d}; }
    if (/antes de ayer|anteayer/.test(lower)) { const d=subDays(today,2); return {start:d,end:d}; }
    if (/semana pasada/.test(lower)) {
      return {
        start: subWeeks(startOfWeek(today,{locale:es}),1),
        end:   subWeeks(endOfWeek(today,{locale:es}),1)
      };
    }
    return null;
  };

  const filterRecords = (recs, range) => {
    if (!range) return [];
    return recs.filter(r => {
      try { return isSameDay(parseISO(r.fecha), range.start); }
      catch { return false; }
    });
  };

  // --- Generadores ---
  const genUser = ud => ud
    ? `¡Hola ${ud.fullName.split(' ')[0]}! 👋
Soy Coach Nova, tu entrenador 360°.
Tipo de corredor: ${ud.tipoCorredor}
Edad: ${ud.age} años.
¡Vamos con todo!`
    : '';

  const genRecord = rec => {
    const fd = format(parseISO(rec.fecha),'dd/MM/yyyy');
    let header=`📅 ${fd} - `, body='', tip='';
    if (rec.tipo===COMPONENTS.ATLETISMO) {
      header+='🏃 Entrenamiento de pista\n';
      body=`Plan completo:\n${rec.plan}\n\n`+
        `Estado: ${rec.estadoFisico}/10 • Ánimo: ${rec.animo}/5 • Sueño: ${rec.sleepHours}h\n\n`+
        `Series:\n${rec.series.map(s=>`- ${s.pruebaKey}: base ${s.base}s, %${s.porcentaje}→${s.sugerido||'-'}`).join('\n')}\n\n`+
        `Promedios:\n${rec.promedios.map(p=>`- ${p.pruebaKey}: ${p.promedio}`).join('\n')}`+
        (rec.sensaciones?`\n\nSensaciones: ${rec.sensaciones}`:'');
      tip='💡 Consejo: Hidrátate bien y estira al finalizar.';
    }
    if (rec.tipo===COMPONENTS.GYM) {
      header+=`🏋️ Gimnasio (${rec.zona})\n`;
      body=`Plan completo:\n${rec.plan}\n\n`+
        `Ejercicios:\n${rec.ejercicios.map(e=>`- ${e.nombre}: ${e.repeticiones} reps, pesos ${e.pesos.join(', ')}`).join('\n')}`;
      tip='💡 Consejo: Controla la respiración y baja despacio.';
    }
    if (rec.tipo===COMPONENTS.CONTROLES) {
      header+=`⏱️ Control PB - ${rec.prueba}: ${rec.valor}${rec.unidad}\n`;
      if (rec.sensaciones) body=`Sensaciones: ${rec.sensaciones}\n`;
      tip='💡 Consejo: Trabaja tu salida y postura.';
    }
    return `${header}${body}\n\n${tip}`;
  };

  // --- Detección de tipo de petición ---
  const detect = text => {
    const l = text.toLowerCase();
    // Si pide consejo, plan de nutrición o charla libre
    if (/\b(consejo|sugerencia|plan de nutrici(o|ó)n|nutrici(o|ó)n|quiero hablar)\b/.test(l)) {
      return [];
    }
    // Perfil
    if (/\b(quien soy|quién soy|mi perfil|mi nombre)\b/i.test(l)) {
      return [COMPONENTS.USER];
    }
    const comps = [];
    if (/(gym|pesas|gimnasio)/i.test(l)) comps.push(COMPONENTS.GYM);
    if (/(atletismo|pista|entreno)/i.test(l)) comps.push(COMPONENTS.ATLETISMO);
    if (/(controles|marcas|pb|tiempos)/i.test(l)) comps.push(COMPONENTS.CONTROLES);
    return comps;
  };

  // --- Envío de mensaje ---
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setMessages(ms => [...ms, { role: 'user', content: input }]);

    // Cargar todos los registros
    const [ud, tren, gymM, gymD, ctr] = await Promise.all([
      fetchUserData(),
      fetchTrainingRecords(),
      fetchGymRecords(),
      fetchDailyGymRecords(),
      fetchControlesPB()
    ]);
    const all = [...tren, ...gymM, ...gymD, ...ctr];

    const comps = detect(input);
    const range = parseDateFromText(input);

    let reply = '';

    // 1) Perfil
    if (comps.length === 1 && comps[0] === COMPONENTS.USER) {
      reply = genUser(ud);
    }
    // 2) Registros con fecha y componente
    else if (range && comps.length) {
      const hits = filterRecords(all, range).filter(r => comps.includes(r.tipo));
      reply = hits.length
        ? hits.map(genRecord).join('\n\n')
        : `No encontré registros para "${input}".`;
    }
    // 3) Controles PB (sin fecha explícita)
    else if (!range && comps.includes(COMPONENTS.CONTROLES)) {
      reply = ctr.map(genRecord).join('\n\n') || 'No tienes controles PB registrados.';
    }
    // 4) Chat libre / consejos / planes nutricionales
    else {
      const systemCtx = messages[0].content;
      const snippet = JSON.stringify(all.slice(0, 5));
      const ai = await sendMessageToGPT([
        { role: 'system', content: systemCtx },
        { role: 'user', content: `${input}\n\nContexto (muestra solo 5 registros): ${snippet}…` }
      ]);
      reply = ai.trim();
    }

    setMessages(ms => [...ms, { role: 'assistant', content: reply }]);
    setLoading(false);
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
          <button className="close-btn" onClick={handleCloseRecommendation}>✖</button>
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
