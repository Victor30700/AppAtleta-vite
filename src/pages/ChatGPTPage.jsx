import React, { useState, useRef, useEffect } from 'react';
import { Copy, Send, Trash2, Download, Bot, User, ArrowLeft, Loader2 } from 'lucide-react';
import { sendMessageToGPT } from '../config/openai';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
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
Hola atleta. He cargado tu expediente completo con **tiempos detallados**, **clima**, **cargas de gimnasio** y **análisis de video**.

¿En qué nos enfocamos hoy?
* 📊 Analizar el rendimiento técnico de tu última sesión (fatiga, consistencia).
* 📹 Revisión biomecánica de tus videos recientes.
* 🧠 Estrategia competitiva basada en tus marcas.`
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

        // 2. Pista (Ordenado por fecha: Antiguo -> Nuevo)
        const trackSnap = await getDoc(doc(db, 'registroEntreno', user.email));
        const trackData = trackSnap.exists() ? trackSnap.data().registros : [];
        trackData.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        // 3. Gym (Ordenado por fecha: Nuevo -> Antiguo para el slice en context builder)
        const gymMensualSnap = await getDoc(doc(db, 'registrosGym', user.email));
        const gymDiarioSnap = await getDoc(doc(db, 'registroGymDiario', user.email));
        let gymData = [];
        if (gymDiarioSnap.exists()) gymData = [...gymData, ...gymDiarioSnap.data().registros];
        // Aquí ordenamos descendente para que [0] sea el más reciente en el builder
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

        // 6. Videos (NUEVO: Cargar los últimos 5 videos)
        const videosRef = collection(db, 'userVideos', user.uid, 'videos');
        const videoQuery = query(videosRef, orderBy('createdAt', 'desc'), limit(5));
        const videoSnap = await getDocs(videoQuery);
        
        const videoData = videoSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convertimos el timestamp de Firestore a Date JS para el builder
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));

        // Construir contexto inteligente pasando videoData
        const contextString = buildAthleteContext(userData, trackData, gymData, pbData, healthData, videoData);
        
        const systemPrompt = `
          Actúa como **Coach Nova**, un entrenador de alto rendimiento especializado en atletismo (velocidad y potencia).
          
          TIENES ACCESO A LOS DATOS CRUDOS DE CADA SERIE Y A LOS ANÁLISIS DE VIDEO.
          
          EXPEDIENTE DEL ATLETA:
          ${contextString}

          ### INSTRUCCIONES DE ANÁLISIS PROFUNDO:
          
          1. **ANÁLISIS DE TIEMPOS (LO MÁS IMPORTANTE):**
             - Cuando el atleta pregunte por su sesión, mira el array "Series" (ej: [7.47, 7.12, 7.22, 7.09]).
             - **Identifica el Mejor Tiempo (SB del día)**: Compara este valor específico con su PB histórico.
             - **Calcula la Fatiga Intra-sesión**: Diferencia entre el peor y mejor tiempo. Si hay mucha varianza, coméntalo.
             - **Consistencia**: Si los tiempos son muy estables (ej: todos en 7.2x), elogia la consistencia.

          2. **INTEGRACIÓN DE VIDEO Y BIOMECÁNICA:**
             - Tienes acceso a los metadatos de los videos recientes en la sección "BIBLIOTECA DE ANÁLISIS DE VIDEO".
             - Si el atleta menciona "mira mi video" o pregunta por técnica, revisa la descripción y título de los videos recientes.
             - Si el estado es "✅ Procesado" (completed), sugiere revisar la pestaña "Análisis de Video" para ver ángulos y trayectorias.
             - Relaciona la "Descripción" del video (ej: "partida estática") con los tiempos de pista de fechas cercanas.

          3. **CONTEXTO AMBIENTAL Y EQUIPO:**
             - **Viento**: Si el viento es > +2.0 m/s, advierte que los tiempos no son homologables. Si es negativo, valora el esfuerzo.
             - **Calzado**: Si usa CLAVOS (Spikes), exige tiempos rápidos. Si usa Zapatillas, sé tolerante.

          4. **ESTADO FÍSICO Y RECUPERACIÓN:**
             - Cruza el rendimiento con el sueño y el estado físico reportado.

          5. **FORMATO DE RESPUESTA:**
             - Sé directo, técnico y motivador.
             - Usa Markdown: **Negritas** para datos clave, Listas para puntos.
             - Estructura: 
               - 📊 **Diagnóstico** (Comparativa PB vs Mejor tiempo de hoy).
               - 🔬 **Análisis Técnico/Video** (Si aplica).
               - 🧠 **Conclusión y Consejos**.
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
            placeholder={loadingData ? "Cargando registros..." : "Consulta sobre tu entrenamiento, dieta o videos..."}
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
          IA v2.6 | Optimización con Análisis de Video
        </div>
      </div>
    </div>
  );
}