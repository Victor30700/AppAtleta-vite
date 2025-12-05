import React, { useState, useRef, useEffect } from 'react';
import { Copy, Send, Trash2, Download, Bot, User, ArrowLeft, Loader2 } from 'lucide-react';
import { sendMessageToGPT } from '../config/openai';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { buildAthleteContext } from '../utils/aiContextBuilder';
import ReactMarkdown from 'react-markdown'; 
import remarkGfm from 'remark-gfm';
import '../styles/ChatGPTPage.css';

export default function ChatGPTPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore(app);
  const messagesEndRef = useRef(null);

  const [systemContext, setSystemContext] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `### 🚀 Sistema Coach Nova Iniciado
Hola atleta. He cargado tu expediente completo: **tiempos**, **cargas de gimnasio** y **estado físico**.

¿En qué nos enfocamos hoy?
* 📊 Analizar el rendimiento de la última sesión.
* 🥗 Planificar nutrición pre/post entreno.
* 🧠 Estrategia para la próxima competencia.`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // --- CARGA DE DATOS MASIVA ---
  useEffect(() => {
    const loadAllData = async () => {
      if (!user) return;
      try {
        setLoadingData(true);
        
        // 1. Perfil
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.exists() ? userSnap.data() : null;

        // 2. Pista (Ordenado por fecha)
        const trackSnap = await getDoc(doc(db, 'registroEntreno', user.email));
        const trackData = trackSnap.exists() ? trackSnap.data().registros : [];
        trackData.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        // 3. Gym (Unificado y ordenado)
        const gymMensualSnap = await getDoc(doc(db, 'registrosGym', user.email));
        const gymDiarioSnap = await getDoc(doc(db, 'registroGymDiario', user.email));
        let gymData = [];
        if (gymDiarioSnap.exists()) gymData = [...gymData, ...gymDiarioSnap.data().registros];
        gymData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        // 4. PBs
        const pbSnap = await getDoc(doc(db, 'controlesPB', user.email));
        let pbData = [];
        if (pbSnap.exists()) {
          const data = pbSnap.data();
          Object.keys(data).forEach(key => {
            if(Array.isArray(data[key])) data[key].forEach(reg => pbData.push({...reg, prueba: key}));
          });
        }

        // 5. Salud
        const healthSnap = await getDoc(doc(db, 'healthProfiles', user.email));
        const healthData = {
            entries: healthSnap.exists() ? (healthSnap.data().bodyEntries || []) : [],
            injuries: healthSnap.exists() ? (healthSnap.data().injuries || []) : []
        };
        healthData.entries.sort((a,b) => new Date(b.date) - new Date(a.date));

        // Construir contexto inteligente
        const contextString = buildAthleteContext(userData, trackData, gymData, pbData, healthData);
        
        const systemPrompt = `
          Actúa como Coach Nova, un entrenador de alto rendimiento especializado en atletismo, biomecánica y nutrición deportiva.
          
          EXPEDIENTE DEL ATLETA:
          ${contextString}

          DIRECTRICES DE RESPUESTA:
          1. **Análisis Basado en Datos:** Si preguntan por rendimiento, compara el último entreno con los PBs. Usa porcentajes (ej: "Estás al 92% de tu máximo").
          2. **Nutrición Específica:**
             - Entrenos de Potencia/Fuerza: Recomienda Proteína (20-25g) + Carbos Rápidos post-entreno.
             - Entrenos Lácticos/Resistencia: Prioriza reposición de glucógeno y antioxidantes.
          3. **Tono Profesional:** Directo, técnico pero motivador. Usa formato Markdown (negritas, listas) para facilitar la lectura rápida.
          4. **Seguridad:** Si detectas fatiga alta (estado físico < 6) o sueño bajo (< 6h), sugiere reducir la carga o descanso activo.
        `;

        setSystemContext(systemPrompt);

      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setLoadingData(false);
      }
    };
    loadAllData();
  }, [user, db]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const newUserMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const recentMessages = messages.slice(-8); 
      const payload = [{ role: 'system', content: systemContext }, ...recentMessages, newUserMsg];
      const replyContent = await sendMessageToGPT(payload);
      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ **Error de conexión.** Verifica tu internet e intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{ role: 'assistant', content: 'Chat reiniciado. **¿Cuál es el siguiente objetivo?** 🎯' }]);
  };

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    let y = 20;
    
    // Header Profesional
    pdf.setFillColor(15, 23, 42); // Azul oscuro corporativo
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(0, 255, 231); // Cian Neón
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('COACH NOVA - INFORME TÉCNICO', pageWidth / 2, 25, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(200, 200, 200);
    pdf.text(`Generado: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: 'center' });
    
    y = 55;
    
    messages.slice(1).forEach(msg => {
      // Manejo de salto de página
      if (y > 270) { pdf.addPage(); y = 30; }
      
      const isUser = msg.role === 'user';
      
      // Etiqueta del rol
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(isUser ? 100 : 0, isUser ? 100 : 0, isUser ? 100 : 0);
      pdf.text(isUser ? 'ATLETA' : 'ANÁLISIS TÉCNICO', 20, y);
      
      // Línea separadora
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, y + 2, pageWidth - 20, y + 2);
      y += 8;
      
      // Contenido
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(40, 40, 40);
      
      // Limpieza básica de Markdown para PDF
      const cleanText = msg.content
        .replace(/\*\*/g, '')
        .replace(/###/g, '')
        .replace(/- /g, '• ');
        
      const lines = pdf.splitTextToSize(cleanText, 170);
      pdf.text(lines, 20, y);
      
      y += (lines.length * 6) + 15; // Espacio entre mensajes
    });
    
    pdf.save(`CoachNova_Reporte_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="chat-container">
      {/* HEADER */}
      <header className="chat-header-pro">
        <div className="header-left">
          <button className="btn-back-pro" onClick={() => navigate('/home')}>
            <ArrowLeft size={18} style={{marginRight: '6px'}}/> <span className="hide-mobile">Volver</span>
          </button>
          <div className="bot-identity">
            <div className={`status-dot ${loadingData ? 'loading' : 'online'}`}></div>
            <div>
              <h1>Coach Nova <span>PRO</span></h1>
              <p>{loadingData ? 'Sincronizando datos...' : 'Asistente de Alto Rendimiento'}</p>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={handleClearChat} className="action-icon" title="Limpiar sesión">
            <Trash2 size={20}/>
          </button>
          <button onClick={handleDownloadPDF} className="action-icon" title="Descargar Informe PDF">
            <Download size={20}/>
          </button>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="chat-viewport">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.role}`}>
            <div className="avatar">
              {msg.role === 'assistant' ? <Bot size={24} /> : <User size={24} />}
            </div>
            <div className="bubble">
              <div className="bubble-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
              <button 
                className="copy-text" 
                onClick={() => navigator.clipboard.writeText(msg.content)}
                title="Copiar"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-row assistant">
            <div className="avatar"><Bot size={24} /></div>
            <div className="bubble typing-indicator">
              <Loader2 className="animate-spin" size={20} />
              <span style={{marginLeft: '10px'}}>Analizando datos...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="input-zone">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={loadingData ? "Cargando registros..." : "Consulta sobre tu entrenamiento, dieta o estrategia..."}
            disabled={loadingData || loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loadingData || loading || !input.trim()}
            className={loading ? 'sending' : ''}
          >
            <Send size={20} />
          </button>
        </div>
        <div className="input-footer">
          IA v2.5 | Optimización de rendimiento deportivo
        </div>
      </div>
    </div>
  );
}