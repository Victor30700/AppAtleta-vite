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
import '../styles/ChatGPTPage.css';

export default function ChatGPTPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content:
        'Eres Coach Nova, un asistente de entrenamiento 360°: nutrición, psicología deportiva y fisiología.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [error429, setError429] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [timerId, setTimerId] = useState(null);
  const messagesEndRef = useRef(null);
  const db = getFirestore(app);
  const navigate = useNavigate();

  // Auto‑ocultar recommendations tras 10s
  useEffect(() => {
    if (showRecommendation) {
      const id = setTimeout(() => setShowRecommendation(false), 10000);
      setTimerId(id);
    }
    return () => clearTimeout(timerId);
  }, [showRecommendation]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cierra la recomendación al vuelo
  const handleCloseRecommendation = () => {
    clearTimeout(timerId);
    setShowRecommendation(false);
  };

  // Descarga PDF (idem tu lógica)...
  const handleDownloadPDF = () => {
    clearTimeout(timerId);
    setShowRecommendation(false);
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const boxPadding = 6;
    const lineHeight = 14;
    let cursorY = margin;

    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text('SprinterApp Coach Nova', pageWidth/2, cursorY, { align: 'center' });
    cursorY += 24;

    doc.setDrawColor(200,200,200);
    doc.setLineWidth(0.5);
    doc.line(margin,cursorY,pageWidth-margin,cursorY);
    cursorY += 16;

    messages.slice(1).forEach(msg => {
      const isUser = msg.role==='user';
      const bg = isUser ? [230,244,255] : [245,245,245];
      const tc = isUser ? [0,60,120] : [50,50,50];
      const lines = doc.splitTextToSize(msg.content, pageWidth-2*margin-2*boxPadding);
      const h = lines.length*lineHeight + 2*boxPadding;
      const w = pageWidth - 2*margin;
      if(cursorY+h>pageHeight-margin) { doc.addPage(); cursorY=margin; }
      doc.setFillColor(...bg);
      doc.rect(margin,cursorY,w,h,'F');
      doc.setFontSize(12);
      doc.setTextColor(...tc);
      const label = isUser ? 'Tú:' : 'Coach Nova:';
      doc.text(label, margin+boxPadding, cursorY+boxPadding+lineHeight-4);
      lines.forEach((l,i)=>
        doc.text(l, margin+boxPadding, cursorY+boxPadding+lineHeight*(i+2)-4)
      );
      cursorY += h+12;
    });

    doc.save('SprinterApp_CoachNova_Conversación.pdf');
  };

  // --- NUEVAS FUNCIONES PARA TRAER PERFIL DE FIRESTORE ---
  const fetchUserProfile = async uid => {
    const snap = await getDoc(doc(db,'users',uid));
    return snap.exists() ? snap.data() : null;
  };
  // ----------------------------------------------

  const fetchTrainingRecords = async email => {
    const snap = await getDoc(doc(db,'registroEntreno',email));
    return snap.exists() ? snap.data().registros||[] : [];
  };
  const fetchGymRecords = async email => {
    const q = query(collection(db,'registrosGym'),where('metadata.email','==',email));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  };
  const fetchDailyGymRecords = async email => {
    const snap = await getDoc(doc(db,'registroGymDiario',email));
    return snap.exists()?snap.data().registros||[]:[];
  };
  const fetchControlesPB = async email => {
    const snap = await getDoc(doc(db,'controlesPB',email));
    return snap.exists()?snap.data():{};
  };

  const buildContextPrompt = ({ userData, trainingRecords, gymRecords, dailyGymRecords, controles }) => {
    const parts = [];
    // --- AGREGAMOS PERFIL: ---
    if(userData){
      parts.push(
        `Perfil: Nombre completo ${userData.fullName}, correo ${userData.email}, edad ${userData.age}, celular ${userData.celular}, sexo ${userData.sexo}, tipo de corredor ${userData.tipoCorredor}.`
      );
    }
    // -------------------------
    if(trainingRecords.length){
      const lt=trainingRecords[0];
      parts.push(`Entreno: plan "${lt.plan}", estado ${lt.estadoFisico}, ánimo ${lt.animo}.`);
    }
    if(gymRecords.length){
      const lg=[...gymRecords].sort((a,b)=>new Date(b.metadata.actualizadoEn)-new Date(a.metadata.actualizadoEn))[0];
      parts.push(`Gimnasio: peso ${lg.peso}kg, repeticiones ${lg.repeticiones}.`);
    }
    if(dailyGymRecords.length){
      const ld=[...dailyGymRecords].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0];
      parts.push(`Diario: ${ld.fecha}, zona ${ld.zona}, ${ld.ejercicios.length} ejercicios.`);
    }
    if(controles && Object.keys(controles).length){
      Object.entries(controles).forEach(([k,recs])=>{
        const lr=[...recs].sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
        parts.push(`Control ${k}: ${lr.valor}${lr.unidad} (${lr.fecha}).`);
      });
    }
    return parts.join(' ');
  };

  const handleSend = async () => {
    if(!input.trim()) return;
    if(showRecommendation){ clearTimeout(timerId); setShowRecommendation(false); }

    const userMsg={ role:'user', content:input };
    const updated=[...messages,userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setFallbackMessage('Lo siento, algo salió mal.');

    try {
      // pedimos perfil + registros
      const [ userData, tr, gr, dgr, ctrl ] = await Promise.all([
        fetchUserProfile(user.uid),
        fetchTrainingRecords(user.email),
        fetchGymRecords(user.email),
        fetchDailyGymRecords(user.email),
        fetchControlesPB(user.email),
      ]);
      const ctx = buildContextPrompt({ userData, trainingRecords:tr, gymRecords:gr, dailyGymRecords:dgr, controles:ctrl });
      const prompt = `${input}\n\nContexto: ${ctx}`;
      const reply = await sendMessageToGPT([ ...updated, {role:'user', content:prompt} ]);
      if(!reply?.trim()) throw new Error('Respuesta vacía');
      setMessages(m=>[...m,{role:'assistant',content:reply}]);
      setError429(false);
    } catch(err){
      console.error(err);
      if(err.message.includes('429')){
        setError429(true);
        setFallbackMessage('Límite alcanzado, inténtalo más tarde.');
        setTimeout(handleSend,5000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button" onClick={()=>navigate('/')}>Volver</button>
        <h2 className="chat-title">Coach Nova</h2>
        <button className="download-btn" onClick={handleDownloadPDF}>Descargar Conversación</button>
      </div>

      {showRecommendation && (
        <div className="recommendation-msg">
          <button className="close-btn" onClick={handleCloseRecommendation}>✖</button>
          <strong>💡 Recomendaciones de uso</strong><br/><br/>
          🔒 <strong>Las conversaciones no se almacenan automáticamente.</strong><br/>
          Usa “Descargar conversación” para guardarlas si las necesitas.<br/><br/>
          🧠 Formula preguntas claras y concisas.<br/>
          ⚠️ Evita saturar la IA para optimizar tu cuota mensual.
        </div>
      )}

      <div className="chat-box" ref={messagesEndRef}>
        {messages.slice(1).map((msg,i)=>(
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="role-label">{msg.role==='user'?'Tú':'Coach Nova'}</span>
              <button
                className="copy-btn"
                onClick={()=>navigator.clipboard.writeText(msg.content)}
                title="Copiar mensaje"
              >
                <Copy size={16}/>
              </button>
            </div>
            <div className="message-content">
              {msg.content.split('\n').map((l,idx)=><p key={idx}>{l}</p>)}
            </div>
          </div>
        ))}
        {loading && <div className="message assistant">Escribiendo...</div>}
        {!loading && error429 && <div className="message assistant">{fallbackMessage}</div>}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Escribe tu mensaje..."
        />
        <button onClick={handleSend} disabled={loading}>Enviar</button>
      </div>
    </div>
  );
}
