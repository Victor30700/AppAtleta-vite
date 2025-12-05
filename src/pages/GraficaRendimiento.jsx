import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { processAnalyticsData, getBestPBs } from '../utils/analyticsHelpers';
import { FaArrowLeft, FaRunning, FaDumbbell, FaWeight, FaBed, FaTrophy, FaFileDownload, FaInfoCircle } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import styles from '../styles/GraficaRendimiento.module.css';

// Componente de Tooltip Personalizado para Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.customTooltip}>
        <p className={styles.tooltipDate}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color }} className={styles.tooltipItem}>
            <span>{entry.name}:</span>
            <strong>{entry.value} {entry.unit}</strong>
          </div>
        ))}
        {payload[0].payload.injury && (
          <div className={styles.tooltipInjury}>
            ⚠️ Lesión: {payload[0].payload.injury}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function GraficaRendimiento() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Refs para captura de PDF
  const kpiRef = useRef(null);
  const mainChartRef = useRef(null);
  const secondaryChartRef = useRef(null);
  
  const [rawData, setRawData] = useState(null);
  const [timeRange, setTimeRange] = useState(3); 
  const [selectedDistance, setSelectedDistance] = useState('100m');
  const [chartData, setChartData] = useState([]);
  const [pbs, setPbs] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Carga de datos unificada
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [trackSnap, gymMonthSnap, gymDaySnap, healthSnap, pbSnap] = await Promise.all([
          getDoc(doc(db, 'registroEntreno', user.email)),
          getDoc(doc(db, 'registrosGym', user.email)),
          getDoc(doc(db, 'registroGymDiario', user.email)),
          getDoc(doc(db, 'healthProfiles', user.email)),
          getDoc(doc(db, 'controlesPB', user.email))
        ]);

        const trackData = trackSnap.exists() ? trackSnap.data().registros : [];
        
        const gymData = [
           ...(gymMonthSnap.exists() ? gymMonthSnap.data().registros : []),
           ...(gymDaySnap.exists() ? gymDaySnap.data().registros : [])
        ];
        const healthData = {
           entries: healthSnap.exists() ? healthSnap.data().bodyEntries : [],
           injuries: healthSnap.exists() ? healthSnap.data().injuries : []
        };
        const pbData = pbSnap.exists() ? pbSnap.data() : {};

        setRawData({ trackData, gymData, healthData });
        setPbs(getBestPBs(pbData));
        
      } catch (error) {
        console.error("Error cargando analíticas:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (rawData) {
      const processed = processAnalyticsData(
        rawData.trackData, 
        rawData.gymData, 
        rawData.healthData, 
        pbs, 
        timeRange
      );
      setChartData(processed);
    }
  }, [rawData, timeRange, pbs]);

  const kpis = useMemo(() => {
    if (!chartData.length) return {};
    const sessions = chartData.filter(d => d.hasTrack || d.hasGym).length;
    const avgSleep = (chartData.reduce((acc, curr) => acc + (curr.sleep || 0), 0) / (sessions || 1)).toFixed(1);
    const lastWeight = chartData.slice().reverse().find(d => d.weight)?.weight || '--';
    const bestTimeInPeriod = chartData
        .map(d => d[selectedDistance])
        .filter(t => t > 0)
        .sort((a, b) => a - b)[0] || '--';

    return { sessions, avgSleep, lastWeight, bestTimeInPeriod };
  }, [chartData, selectedDistance]);

  const aiExplanation = useMemo(() => {
    if (!chartData.length) return "No hay suficientes datos para analizar.";
    
    const bestTime = kpis.bestTimeInPeriod;
    const pb = pbs[selectedDistance] || '--';
    const improvement = (bestTime !== '--' && pb !== '--') ? (parseFloat(bestTime) - parseFloat(pb)).toFixed(2) : null;
    
    let text = `En los últimos ${timeRange} meses, has realizado ${kpis.sessions} sesiones de entrenamiento. `;
    
    if (improvement !== null) {
      if (improvement <= 0) text += `¡Excelente! Has igualado o superado tu PB en ${selectedDistance}. Tu consistencia está dando frutos. `;
      else text += `Estás a ${improvement}s de tu mejor marca en ${selectedDistance}. Revisa tu descanso y peso corporal. `;
    }
    
    if (parseFloat(kpis.avgSleep) < 7) text += "⚠️ Tu promedio de sueño es bajo (<7h), lo que puede estar limitando tu recuperación y velocidad máxima.";
    else text += "✅ Tu descanso es adecuado, lo que favorece la adaptación muscular.";

    return text;
  }, [kpis, timeRange, selectedDistance, pbs]);

  // --- FUNCIÓN DE EXPORTACIÓN PROFESIONAL ---
  const handleExport = async () => {
    setExporting(true);
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // 1. Encabezado Corporativo
    doc.setFillColor(15, 23, 42); // Azul oscuro
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(0, 255, 231); // Cian
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME DE RENDIMIENTO - SPRINTERAPP', pageWidth / 2, 18, { align: 'center' });
    
    let yPos = 40;

    // Helper para capturar y añadir imagen
    const addSectionToPDF = async (ref, title) => {
        if(ref.current) {
            // Fondo temporal para asegurar legibilidad en PDF (evita transparencia)
            const originalBg = ref.current.style.backgroundColor;
            ref.current.style.backgroundColor = '#0f172a'; 
            
            const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = pageWidth - 20;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            if (yPos + pdfHeight > 280) {
                doc.addPage();
                yPos = 20;
            }
            
            if(title) {
                doc.setFontSize(14);
                doc.setTextColor(50, 50, 50);
                doc.text(title, 10, yPos);
                yPos += 8;
            }

            doc.addImage(imgData, 'PNG', 10, yPos, pdfWidth, pdfHeight);
            yPos += pdfHeight + 10;
            
            ref.current.style.backgroundColor = originalBg; // Restaurar
        }
    };

    try {
        // 2. Métricas Clave (KPIs)
        await addSectionToPDF(kpiRef, "Resumen del Periodo");

        // 3. Análisis de Texto (IA)
        doc.setFillColor(240, 240, 240);
        doc.rect(10, yPos, pageWidth - 20, 25, 'F');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text("ANÁLISIS TÉCNICO:", 15, yPos + 8);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(aiExplanation, pageWidth - 30);
        doc.text(splitText, 15, yPos + 15);
        yPos += 35;

        // 4. Gráfica Principal
        await addSectionToPDF(mainChartRef, `Evolución Velocidad ${selectedDistance} vs Peso`);

        // 5. Gráficas Secundarias
        await addSectionToPDF(secondaryChartRef, "Carga, Recuperación y Estado Físico");

        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generado el ${new Date().toLocaleDateString()} | Pág ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
        }

        doc.save(`Rendimiento_${selectedDistance}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
        console.error("Error generando PDF", err);
        alert("Error al generar el reporte. Intenta nuevamente.");
    } finally {
        setExporting(false);
    }
  };

  if (loading || loadingData) return <div className={styles.loadingContainer}><div className={styles.spinner}></div></div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/home')}>
            <FaArrowLeft />
          </button>
          <h1>Centro de Rendimiento</h1>
        </div>
        
        <div className={styles.controls}>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className={styles.select}
          >
            <option value={1}>Último Mes</option>
            <option value={3}>Últimos 3 Meses</option>
            <option value={6}>Últimos 6 Meses</option>
            <option value={12}>Año Completo</option>
          </select>
          
          <button onClick={handleExport} className={styles.exportBtn} disabled={exporting}>
            <FaFileDownload /> {exporting ? 'Generando...' : 'Reporte PDF'}
          </button>
        </div>
      </header>

      {/* KPI CARDS (Ref para captura) */}
      <div ref={kpiRef} className={styles.pdfSection}>
        <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}><FaRunning /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Sesiones (Periodo)</span>
                <span className={styles.kpiValue}>{kpis.sessions}</span>
            </div>
            </div>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{color: '#ffd700'}}><FaTrophy /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Mejor {selectedDistance} (Periodo)</span>
                <span className={styles.kpiValue}>{kpis.bestTimeInPeriod}s</span>
                <span className={styles.kpiSubLabel}>PB Histórico: {pbs[selectedDistance] || '--'}s</span>
            </div>
            </div>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{color: '#4ade80'}}><FaWeight /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Peso Actual</span>
                <span className={styles.kpiValue}>{kpis.lastWeight} kg</span>
            </div>
            </div>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{color: '#a78bfa'}}><FaBed /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Promedio Sueño</span>
                <span className={styles.kpiValue}>{kpis.avgSleep} h</span>
            </div>
            </div>
        </div>
      </div>

      {/* ANÁLISIS AUTOMÁTICO */}
      <div className={styles.aiInsightBox}>
        <div className={styles.aiHeader}>
            <FaInfoCircle /> <span>Análisis de Progreso</span>
        </div>
        <p>{aiExplanation}</p>
      </div>

      {/* GRÁFICA PRINCIPAL (Ref para captura) */}
      <div ref={mainChartRef} className={`${styles.chartSection} ${styles.pdfSection}`}>
        <div className={styles.chartHeader}>
          <h3>🚀 Evolución de Velocidad & Peso</h3>
          <div className={styles.chartControls}>
             {pbs[selectedDistance] && <span className={styles.pbBadge}>PB: {pbs[selectedDistance]}s</span>}
             <select 
                value={selectedDistance} 
                onChange={(e) => setSelectedDistance(e.target.value)}
                className={styles.metricSelect}
            >
                <option value="30m">30m</option>
                <option value="60m">60m</option>
                <option value="80m">80m</option>
                <option value="100m">100m</option>
                <option value="120m">120m</option>
                <option value="150m">150m</option>
                <option value="200m">200m</option>
                <option value="300m">300m</option>
                <option value="400m">400m</option>
            </select>
          </div>
        </div>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <defs>
                <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ffe7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00ffe7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" stroke="#94a3b8" tick={{fontSize: 12}} />
              
              {/* Eje Y Izquierdo (Tiempo) */}
              <YAxis yAxisId="left" stroke="#00ffe7" reversed={true} domain={['dataMin - 0.5', 'dataMax + 0.5']} unit="s" width={40}/>
              
              {/* Eje Y Derecho (Peso) */}
              <YAxis yAxisId="right" orientation="right" stroke="#4ade80" domain={['dataMin - 2', 'dataMax + 2']} unit="kg" width={40}/>
              
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey={selectedDistance} 
                name={`Tiempo ${selectedDistance}`} 
                stroke="#00ffe7" 
                fill="url(#colorTime)" 
                strokeWidth={3}
                connectNulls
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="weight" 
                name="Peso Corporal" 
                stroke="#4ade80" 
                strokeWidth={2} 
                dot={{r: 3}}
                connectNulls
              />
              
              {/* Línea de Referencia PB */}
              {pbs[selectedDistance] && (
                <ReferenceLine yAxisId="left" y={pbs[selectedDistance]} label={{ value: 'PB Histórico', fill: '#ffd700', fontSize: 12 }} stroke="#ffd700" strokeDasharray="3 3" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.chartFooterInfo}>
           <p>Comparativa: Tiempos <strong>{selectedDistance}</strong> vs <strong>Peso Corporal</strong>. Línea amarilla: <strong>Récord Personal (PB)</strong>.</p>
        </div>
      </div>

      {/* GRÁFICAS SECUNDARIAS (Ref para captura de todo el bloque) */}
      <div ref={secondaryChartRef} className={`${styles.gridTwoColumns} ${styles.pdfSection}`}>
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <h3>📊 Carga vs. Recuperación</h3>
          </div>
          <div className={styles.chartWrapperSmall}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                    <CartesianGrid stroke="#334155" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#a78bfa" hide />
                    <YAxis yAxisId="right" orientation="right" stroke="#f472b6" domain={[0, 12]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    <Bar yAxisId="left" dataKey="trackVolume" name="Volumen Pista" fill="#a78bfa" barSize={15} radius={[4,4,0,0]} />
                    <Line yAxisId="right" type="monotone" dataKey="sleep" name="Sueño (h)" stroke="#f472b6" strokeWidth={2} connectNulls dot={false} />
                </ComposedChart>
            </ResponsiveContainer>
          </div>
           <p className={styles.miniChartExplanation}>Volumen (barras) vs Horas de sueño (línea). Vigilar picos de carga con poco sueño.</p>
        </div>

        <div className={styles.chartSection}>
            <div className={styles.chartHeader}>
                <h3>🧠 Estado Físico & Ánimo</h3>
            </div>
            <div className={styles.chartWrapperSmall}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChartComponent data={chartData} />
                </ResponsiveContainer>
            </div>
             <p className={styles.miniChartExplanation}>Percepción física (azul) y estado de ánimo (amarillo). Deben mantenerse estables o subir.</p>
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar simple para la segunda gráfica pequeña
const LineChartComponent = ({ data }) => (
    <ComposedChart data={data}>
        <CartesianGrid stroke="#334155" vertical={false} />
        <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
        <YAxis domain={[0, 10]} stroke="#94a3b8" width={30}/>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="physique" name="Físico" stroke="#38bdf8" strokeWidth={2} connectNulls dot={false} />
        <Line type="monotone" dataKey="mood" name="Ánimo" stroke="#fbbf24" strokeWidth={2} connectNulls dot={false} />
    </ComposedChart>
);