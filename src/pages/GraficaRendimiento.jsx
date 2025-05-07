import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import ConfirmModal from '../components/ConfirmModal';
import styles from '../styles/GraficaRendimiento.module.css';
import { CSVLink } from 'react-csv';
import jsPDF from 'jspdf';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

const DEFAULT_COMPARE_TEXT = 'Seleccionar mes';
const CHART_CONFIG = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      padding: 10
    }
  },
  animation: {
    duration: 400,
    easing: 'easeInOutQuad'
  }
};

export default function GraficaRendimiento() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [quitados, setQuitados] = useState(() => 
    JSON.parse(localStorage.getItem('quitados') || '[]')
  );
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState({ month1: DEFAULT_COMPARE_TEXT, month2: DEFAULT_COMPARE_TEXT });
  const [searchMonth, setSearchMonth] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [viewInfo, setViewInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('analisis');
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);

  // Carga segura de registros
  const loadRegistros = useCallback(async () => {
    if (!isMounted || !user) return;
    
    try {
      const snap = await getDoc(docRegistro);
      if (!isMounted) return;
      
      const data = snap.exists() ? snap.data().registros || [] : [];
      data.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setRegistros(data);
    } catch (error) {
      console.error('Error cargando registros:', error);
    } finally {
      if (isMounted) setLoadingRegs(false);
    }
  }, [isMounted, user, docRegistro]);

  useEffect(() => {
    setIsMounted(true);
    if (!loading && user) loadRegistros();
    return () => setIsMounted(false);
  }, [user, loading, loadRegistros]);

  // Persistencia optimizada
  useEffect(() => {
    if (isMounted) localStorage.setItem('quitados', JSON.stringify(quitados));
  }, [quitados, isMounted]);

  // Generación de datos memoizada
  const mesesDisponibles = useMemo(() => {
    // 1. Extraer los primeros 7 caracteres (YYYY-MM) de cada fecha
    const meses = registros.map(r => r.fecha.slice(0, 7));
    // 2. Crear un Set para quedarnos con valores únicos
    const unico = [...new Set(meses)];
    // 3. Ordenar (ascendente), luego invertir (para descendente)
    return unico.sort().reverse();
  }, [registros]);

  const getDataForMonth = useCallback((month) => {
    const registrosMes = registros.filter(r => r.fecha.startsWith(month));
    if (registrosMes.length === 0) return null;

    const metricas = registrosMes.reduce((acc, r) => ({
      estadoFisico: acc.estadoFisico + r.estadoFisico,
      animo: acc.animo + r.animo,
      sueño: acc.sueño + (r.sleepHours || 0),
      tiempos: r.promedios?.reduce((tAcc, p) => {
        const key = p.pruebaKey || p.distancia;
        tAcc[key] = tAcc[key] ? { total: tAcc[key].total + p.promedio, count: tAcc[key].count + 1 } 
                              : { total: p.promedio, count: 1 };
        return tAcc;
      }, acc.tiempos) || acc.tiempos
    }), {
      estadoFisico: 0,
      animo: 0,
      sueño: 0,
      tiempos: {}
    });

    const count = registrosMes.length;
    return {
      estadoFisico: Number((metricas.estadoFisico / count).toFixed(2)),
      animo: Number((metricas.animo / count).toFixed(2)),
      sueño: Number((metricas.sueño / count).toFixed(1)),
      tiempos: Object.fromEntries(
        Object.entries(metricas.tiempos).map(([k, v]) => [k, Number((v.total / v.count).toFixed(2))])
      )
    };
  }, [registros]);

  // Generación de PDF profesional
  const handleExportPDF = useCallback(async () => {
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      hotfixes: ["px_scaling"]
    });

    const addChartToPDF = async (chartRef, title, yPos) => {
      if (!chartRef.current) return;
      
      const canvas = chartRef.current.canvas;
      const originalWidth = canvas.width;
      const originalHeight = canvas.height;
      
      // Aumentar resolución
      canvas.width = 1440;
      canvas.height = 900;
      chartRef.current.resize();
      
      const image = chartRef.current.toBase64Image('image/jpeg', 1.0);
      const imgWidth = 180;
      const imgHeight = (originalHeight * imgWidth) / originalWidth;
      
      doc.setFontSize(16);
      doc.text(title, 15, yPos - 5);
      doc.addImage(image, 'JPEG', 15, yPos, imgWidth, imgHeight);
      
      // Restaurar tamaño original
      canvas.width = originalWidth;
      canvas.height = originalHeight;
      chartRef.current.resize();
    };

    await addChartToPDF(chartRef1, 'Comparativa Estado Físico/Ánimo', 20);
    doc.addPage();
    await addChartToPDF(chartRef2, 'Comparativa Tiempos', 20);
    
    doc.save(`rendimiento-${new Date().toISOString().slice(0,10)}.pdf`);
  }, []);

  // Datos CSV optimizados
  const csvData = useMemo(() => 
    registros.map(r => ({
      Fecha: r.fecha,
      Plan: r.plan || 'Sin plan',
      'Estado Físico': r.estadoFisico,
      Ánimo: r.animo,
      'Horas Sueño': r.sleepHours || 'N/A',
      'Series registradas': r.series?.map(s => 
        `${s.distancia || s.pruebaKey}: ${s.porcentaje}% → ${s.sugerido}s`
      ).join(' | ') || 'N/A',
      'Tiempos promedio': r.promedios?.map(p => 
        `${p.pruebaKey}: ${p.promedio}s`
      ).join(' | ') || 'N/A'
    })),
    [registros]
  );

  // Generación de gráficas
  const { month1, month2 } = selectedMonths;
  const dataGraficas = useMemo(() => {
    if (month1 === DEFAULT_COMPARE_TEXT) return null;
    
    const data1 = getDataForMonth(month1);
    const data2 = month2 !== DEFAULT_COMPARE_TEXT ? getDataForMonth(month2) : null;

    return {
      estadoFisico: {
        labels: ['Estado Físico', 'Ánimo', 'Horas Sueño'],
        datasets: [
          {
            label: month1,
            data: [data1.estadoFisico, data1.animo, data1.sueño],
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
            borderWidth: 1
          },
          ...(data2 ? [{
            label: month2,
            data: [data2.estadoFisico, data2.animo, data2.sueño],
            backgroundColor: 'rgba(255, 99, 132, 0.8)',
            borderWidth: 1
          }] : [])
        ]
      },
      tiempos: {
        labels: Object.keys(data1.tiempos),
        datasets: [
          {
            label: `Tiempos ${month1}`,
            data: Object.values(data1.tiempos),
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true
          },
          ...(data2 ? [{
            label: `Tiempos ${month2}`,
            data: Object.values(data2.tiempos),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true
          }] : [])
        ]
      }
    };
  }, [month1, month2, getDataForMonth]);

  if (loading || loadingRegs) return <div className={styles.loading}>Cargando...</div>;
  if (!user) return <div className={styles.denied}>Acceso denegado</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/home')}>&larr; Volver</button>
        <h1>Análisis de Rendimiento</h1>
        <div className={styles.exportButtons}>
          <CSVLink data={csvData} filename="rendimiento.csv" className={styles.button}>
            Exportar CSV
          </CSVLink>
          <button onClick={handleExportPDF} className={styles.button}>
            Exportar PDF
          </button>
        </div>
      </header>

      <nav className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'analisis' && styles.active}`}
          onClick={() => setActiveTab('analisis')}
        >
          Análisis Comparativo
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'registros' && styles.active}`}
          onClick={() => setActiveTab('registros')}
        >
          Registros Completos
        </button>
      </nav>

      {activeTab === 'analisis' ? (
        <>
          <div className={styles.controls}>
            <select
              value={selectedMonths.month1}
              onChange={e => setSelectedMonths(prev => ({ ...prev, month1: e.target.value }))}
              className={styles.select}
            >
              <option>{DEFAULT_COMPARE_TEXT}</option>
              {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select
              value={selectedMonths.month2}
              onChange={e => setSelectedMonths(prev => ({ ...prev, month2: e.target.value }))}
              className={styles.select}
              disabled={!mesesDisponibles.length}
            >
              <option>{DEFAULT_COMPARE_TEXT}</option>
              {mesesDisponibles
                .filter(m => m !== month1)
                .map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {month1 !== DEFAULT_COMPARE_TEXT && dataGraficas && (
            <div className={styles.graficasContainer}>
              <div className={styles.graficaWrapper}>
                <h2>Estado Físico y Métricas</h2>
                <div className={styles.chartContainer}>
                  <Bar
                    ref={chartRef1}
                    data={dataGraficas.estadoFisico}
                    options={{
                      ...CHART_CONFIG,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: { display: true, text: 'Puntuación' }
                        }
                      }
                    }}
                    redraw={false}
                  />
                </div>
              </div>

              <div className={styles.graficaWrapper}>
                <h2>Comparativa de Tiempos</h2>
                <div className={styles.chartContainer}>
                  <Line
                    ref={chartRef2}
                    data={dataGraficas.tiempos}
                    options={{
                      ...CHART_CONFIG,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: { display: true, text: 'Tiempo (segundos)' }
                        }
                      }
                    }}
                    redraw={false}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.searchContainer}>
            <input
              type="month"
              value={searchMonth}
              onChange={e => setSearchMonth(e.target.value)}
              className={styles.monthInput}
              placeholder="Filtrar por mes"
            />
          </div>

          <div className={styles.registrosContainer}>
            {registros
              .filter(r => searchMonth ? r.fecha.startsWith(searchMonth) : true)
              .map((r, idx) => (
                <article key={r.fecha} className={styles.registroCard}>
                  <div className={styles.registroHeader}>
                    <h3>{r.fecha} - {r.plan}</h3>
                    <div className={styles.registroActions}>
                      <button onClick={() => setViewInfo(r)}>Detalles</button>
                      <button onClick={() => handleDelete(idx)}>Quitar</button>
                    </div>
                  </div>
                  <div className={styles.registroMetrics}>
                    <span title="Estado físico">🏋️ {r.estadoFisico}/10</span>
                    <span title="Ánimo">😊 {r.animo}/5</span>
                    <span title="Horas de sueño">💤 {r.sleepHours || 'N/A'}h</span>
                  </div>
                </article>
              ))}
          </div>

          {quitados.length > 0 && (
            <section className={styles.quitadosSection}>
              <h3>Registros Quitados</h3>
              {quitados.map((r, idx) => (
                <article key={r.fecha} className={styles.registroCard}>
                  <div className={styles.registroHeader}>
                    <h3>{r.fecha} - {r.plan}</h3>
                    <div className={styles.registroActions}>
                      <button onClick={() => handleRestore(idx)}>Restaurar</button>
                      <button onClick={() => setViewInfo(r)}>Detalles</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Confirmar Eliminación"
        onConfirm={() => {
          const quitado = registros[deleteIdx];
          setQuitados(prev => [...prev, quitado]);
          setRegistros(prev => prev.filter((_, i) => i !== deleteIdx));
          setShowDeleteModal(false);
        }}
        onCancel={() => setShowDeleteModal(false)}
        confirmText="Eliminar"
      >
        <p>¿Estás seguro que deseas quitar este registro del análisis?</p>
      </ConfirmModal>

      {viewInfo && (
        <ConfirmModal
          isOpen={true}
          title={`Detalles del Registro - ${viewInfo.fecha}`}
          onConfirm={() => setViewInfo(null)}
          confirmText="Cerrar"
          showCancel={false}
        >
          <div className={styles.detalleContent}>
            <p><strong>Plan:</strong> {viewInfo.plan}</p>
            <div className={styles.metricGrid}>
              <div>
                <h4>Estado Físico</h4>
                <p>{viewInfo.estadoFisico}/10</p>
              </div>
              <div>
                <h4>Ánimo</h4>
                <p>{viewInfo.animo}/5</p>
              </div>
              <div>
                <h4>Horas Sueño</h4>
                <p>{viewInfo.sleepHours || 'N/A'}</p>
              </div>
            </div>

            {viewInfo.series?.length > 0 && (
              <>
                <h4>Series Registradas</h4>
                <ul className={styles.dataList}>
                  {viewInfo.series.map((s, i) => (
                    <li key={i}>
                      <span>{s.distancia || s.pruebaKey}</span>
                      <span>{s.porcentaje}%</span>
                      <span>{s.sugerido}s</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {viewInfo.promedios?.length > 0 && (
              <>
                <h4>Tiempos Promedio</h4>
                <ul className={styles.dataList}>
                  {viewInfo.promedios.map((p, i) => (
                    <li key={i}>
                      <span>{p.pruebaKey}</span>
                      <span>{p.promedio}s</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}