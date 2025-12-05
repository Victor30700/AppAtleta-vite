// src/pages/RegistroForm.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getLatestTime } from '../utils/controlesUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
// IMPORTANTE: Asegúrate de tener instalado recharts: npm install recharts
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label 
} from 'recharts';
import { 
  FaCalendarAlt, FaRunning, FaStopwatch, FaHeartbeat, FaBrain, FaBed, 
  FaTrash, FaPlus, FaSave, FaTimesCircle, FaArrowLeft, FaChartLine, FaTrophy,
  FaWind, FaThermometerHalf, FaShoePrints, FaMapMarkerAlt, FaSyncAlt
} from 'react-icons/fa';
import '../styles/RegistroForm.css';

const MOODS = [
  { value: 1, icon: '😢', label: 'Por los suelos' },
  { value: 2, icon: '😠', label: 'Malo' },
  { value: 3, icon: '😐', label: 'Normal' },
  { value: 4, icon: '🙂', label: 'Bueno' },
  { value: 5, icon: '🤩', label: '¡A tope!' },
];

// Componente personalizado para el Tooltip de la gráfica
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip-chart">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-time">{`Tiempo: ${data.tiempo}s`}</p>
        {data.isBest && <p className="tooltip-best">🔥 ¡Mejor de la sesión!</p>}
        {data.isWorst && <p className="tooltip-worst">⚠️ Punto de fatiga máxima</p>}
      </div>
    );
  }
  return null;
};

// Punto personalizado para destacar el mejor tiempo
const CustomizedDot = (props) => {
  const { cx, cy, payload } = props;
  if (payload.isBest) {
    return (
      <svg x={cx - 10} y={cy - 10} width={20} height={20} fill="#00ffe7" viewBox="0 0 1024 1024">
        <path d="M512 0C229.23 0 0 229.23 0 512s229.23 512 512 512 512-229.23 512-512S794.77 0 512 0zm0 853.33C323.84 853.33 170.67 700.16 170.67 512S323.84 170.67 512 170.67 853.33 323.84 853.33 512 700.16 853.33 512 853.33z" />
        <circle cx="512" cy="512" r="256" fill="#fff" />
      </svg>
    );
  }
  return <circle cx={cx} cy={cy} r={4} stroke="#007aff" strokeWidth={2} fill="#1e293b" />;
};

export default function RegistroForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editRecord = location.state?.editRecord || null;

  // --- ESTADOS ---
  const [controles, setControles] = useState({});
  const [fecha, setFecha] = useState(editRecord?.fecha || new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState(editRecord?.plan || '');
  
  // Estado físico y Contexto (NUEVO: Clima y Calzado)
  const [estadoFisico, setEstadoFisico] = useState(editRecord?.estadoFisico || 5);
  const [clima, setClima] = useState(editRecord?.clima || { temp: '', wind: '' });
  const [calzado, setCalzado] = useState(editRecord?.calzado || 'clavos'); // clavos | zapatillas
  
  const [animo, setAnimo] = useState(editRecord?.animo || 3);
  const [sensaciones, setSensaciones] = useState(editRecord?.sensaciones || '');
  const [sleepHours, setSleepHours] = useState(editRecord?.sleepHours?.toString() || '');
  
  // Estructuras de datos
  const [seriesInputs, setSeriesInputs] = useState(editRecord?.series || []);
  const [promedios, setPromedios] = useState(editRecord?.promedios || []);
  
  // Estado para controlar la visualización de las gráficas
  const [showCharts, setShowCharts] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  // Modales
  const [showDeleteBlockModal, setShowDeleteBlockModal] = useState(false);
  const [blockToDeleteIndex, setBlockToDeleteIndex] = useState(null);
  
  const [showDeleteRepModal, setShowDeleteRepModal] = useState(false);
  const [repToDeleteInfo, setRepToDeleteInfo] = useState({ blockIdx: null, repIdx: null });

  // Refs
  const autoSaveTimeoutRef = useRef(null);
  const isFirstLoad = useRef(true);

  const docControles = user?.email && doc(db, 'controlesPB', user.email);
  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);
  const docBorrador = user?.email && doc(db, 'borradores', user.email);

  // --- FUNCIÓN PARA OBTENER CLIMA AUTOMÁTICO ---
  const obtenerClima = () => {
    if (!navigator.geolocation) {
      alert("Geolocalización no soportada.");
      return;
    }
    setLoadingWeather(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // API Gratuita Open-Meteo (windspeed_unit=ms es clave para atletismo)
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&windspeed_unit=ms`
          );
          const data = await response.json();
          if (data.current_weather) {
            setClima({
              temp: data.current_weather.temperature,
              wind: data.current_weather.windspeed
            });
          }
        } catch (error) {
          console.error("Error obteniendo clima:", error);
          alert("Error obteniendo el clima. Intenta de nuevo.");
        } finally {
          setLoadingWeather(false);
        }
      },
      (error) => {
        console.error("Error de ubicación:", error);
        alert("No se pudo obtener la ubicación. Verifica los permisos.");
        setLoadingWeather(false);
      }
    );
  };

  // --- LÓGICA DE GRÁFICAS INTELIGENTE ---
  const datosGraficas = useMemo(() => {
    const grupos = {};
    
    // Agrupar bloques por distancia (ej: "300m")
    promedios.forEach((p, index) => {
      if (!p.pruebaKey) return;
      if (!grupos[p.pruebaKey]) grupos[p.pruebaKey] = [];
      grupos[p.pruebaKey].push({ ...p, originalIndex: index + 1 });
    });

    return grupos;
  }, [promedios]);

  // --- CARGA INICIAL ---
  useEffect(() => {
    if (user) {
      getDoc(docControles).then(snap => setControles(snap.exists() ? snap.data() : {}));

      if (!editRecord) {
        // Cargar borrador si existe
        getDoc(docBorrador).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.plan || data.series?.length > 0) {
                setFecha(data.fecha || new Date().toISOString().split('T')[0]);
                setPlan(data.plan || '');
                setEstadoFisico(data.estadoFisico || 5);
                setClima(data.clima || { temp: '', wind: '' });
                setCalzado(data.calzado || 'clavos');
                setAnimo(data.animo || 3);
                setSensaciones(data.sensaciones || '');
                setSleepHours(data.sleepHours || '');
                setSeriesInputs(data.series || []);
                setPromedios(data.promedios || []);
            } else {
                // Si no hay borrador relevante, intentar cargar clima automáticamente al inicio
                // obtenerClima(); // Opcional: Descomentar si quieres auto-carga al inicio
            }
          } else {
             // Si no existe documento borrador
             // obtenerClima(); // Opcional
          }
        });
      }
    }
  }, [user, editRecord]);

  // --- AUTO-SAVE ---
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (!editRecord && user) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      setAutoSaved(false);
      autoSaveTimeoutRef.current = setTimeout(async () => {
        const borradorData = {
          fecha, plan, estadoFisico, clima, calzado, animo, sensaciones, sleepHours,
          series: seriesInputs, promedios, lastUpdated: new Date()
        };
        await setDoc(docBorrador, borradorData);
        setAutoSaved(true);
      }, 1500);
    }
  }, [fecha, plan, estadoFisico, clima, calzado, animo, sensaciones, sleepHours, seriesInputs, promedios, user, editRecord]);

  // --- LÓGICA SERIES (PLANIFICACIÓN) ---
  const handleSeriesChange = (idx, field, val) => {
    setSeriesInputs(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      
      if (field === 'pruebaKey') {
        const baseValor = getLatestTime(val, controles);
        copy[idx].base = baseValor ?? null;
      }
      // Cálculo automático sugerido
      const item = copy[idx];
      if (item.base && item.porcentaje) {
        const porcentaje = parseFloat(item.porcentaje);
        item.sugerido = porcentaje > 0 ? ((item.base * 100) / porcentaje).toFixed(2) : null;
      } else {
        item.sugerido = null;
      }
      return copy;
    });
  };

  const agregarSerie = (e) => {
    if(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    setSeriesInputs(prev => [...prev, { pruebaKey: '', base: null, porcentaje: '', sugerido: null }]);
  };

  const eliminarSerie = (idx) => {
    setSeriesInputs(prev => prev.filter((_, i) => i !== idx));
  };

  // --- LÓGICA REPETICIONES (EJECUCIÓN) ---
  const agregarPromedioBloque = (e) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    const defaultKey = seriesInputs.length > 0 ? seriesInputs[0].pruebaKey : '';
    setPromedios(prev => [...prev, { pruebaKey: defaultKey, series: [], promedio: null }]);
  };

  const handleRepeticionChange = (bloqueIdx, repIdx, val) => {
    setPromedios(prev => {
      return prev.map((bloque, idx) => {
        if (idx === bloqueIdx) {
            const nuevasSeries = [...bloque.series];
            nuevasSeries[repIdx] = val;
            
            const valoresValidos = nuevasSeries.map(s => parseFloat(s)).filter(n => !isNaN(n) && n > 0);
            const nuevoPromedio = valoresValidos.length > 1 ? (valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length).toFixed(2) : null;
            
            return { ...bloque, series: nuevasSeries, promedio: nuevoPromedio };
        }
        return bloque;
      });
    });
  };

  const agregarRepeticion = (bloqueIdx, e) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    setPromedios(prev => {
      return prev.map((bloque, idx) => {
        if (idx === bloqueIdx) {
            return {
                ...bloque,
                series: [...bloque.series, ''] 
            };
        }
        return bloque;
      });
    });
  };

  const requestEliminarRepeticion = (bloqueIdx, repIdx) => {
    setRepToDeleteInfo({ blockIdx: bloqueIdx, repIdx });
    setShowDeleteRepModal(true);
  };

  const confirmarEliminarRepeticion = () => {
    const { blockIdx, repIdx } = repToDeleteInfo;
    setPromedios(prev => {
      return prev.map((bloque, idx) => {
        if (idx === blockIdx) {
            const nuevasSeries = bloque.series.filter((_, i) => i !== repIdx);
            const valoresValidos = nuevasSeries.map(s => parseFloat(s)).filter(n => !isNaN(n) && n > 0);
            const nuevoPromedio = valoresValidos.length > 1 ? (valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length).toFixed(2) : null;
            
            return { ...bloque, series: nuevasSeries, promedio: nuevoPromedio };
        }
        return bloque;
      });
    });
    setShowDeleteRepModal(false);
  };

  const requestEliminarBloque = (idx) => {
    setBlockToDeleteIndex(idx);
    setShowDeleteBlockModal(true);
  };

  const confirmarEliminarBloque = () => {
    setPromedios(prev => prev.filter((_, i) => i !== blockToDeleteIndex));
    setShowDeleteBlockModal(false);
  };

  // --- GUARDAR ---
  const handleGuardar = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const nuevo = {
        fecha, plan: plan.trim(), estadoFisico, 
        clima, calzado, // Guardamos los nuevos datos profesionales
        animo, sensaciones: sensaciones.trim() || null,
        sleepHours: sleepHours ? Number(sleepHours) : null,
        series: seriesInputs, promedios
      };
      const snap = await getDoc(docRegistro);
      const existing = snap.exists() ? snap.data().registros || [] : [];
      const updated = editRecord ? existing.map((r, i) => (i === editRecord.index ? nuevo : r)) : [nuevo, ...existing];
      await setDoc(docRegistro, { registros: updated });
      if (!editRecord) await setDoc(docBorrador, {});
      navigate('/registro');
    } catch (error) {
        console.error("Error:", error);
        alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const sleepRecommendation = useMemo(() => {
    const h = Number(sleepHours);
    if (isNaN(h) || h < 1) return '';
    return h <= 5 ? '⚠️ Insuficiente' : h <= 7 ? '✅ Aceptable' : '🔥 Óptimo';
  }, [sleepHours]);

  // --- RENDERIZADO DE GRÁFICA DETALLADA PRO ---
  const renderGrafica = (distancia, bloques) => {
    let data = [];
    let title = "";
    let colorLine = "#00ffe7"; 
    let totalMetros = 0;

    const distNumber = parseInt(distancia) || 0;

    // Preparar Datos
    if (bloques.length > 1) {
      // Comparativa Bloques
      data = bloques.map((b, i) => ({
        name: `Bloque ${i + 1}`,
        tiempo: parseFloat(b.promedio) || 0,
        originalObj: b
      })).filter(d => d.tiempo > 0);
      title = "Evolución Macro (Bloques)";
      totalMetros = bloques.reduce((acc, b) => acc + (b.series.filter(s=>s).length * distNumber), 0);

    } else if (bloques.length === 1) {
      // Detalle Repeticiones (Intra-bloque)
      const bloque = bloques[0];
      data = bloque.series.map((t, i) => ({
        name: `Rep ${i + 1}`,
        tiempo: parseFloat(t) || 0
      })).filter(d => d.tiempo > 0);
      title = "Fatiga Intra-Bloque";
      colorLine = "#007aff"; 
      totalMetros = data.length * distNumber;
    }

    if(data.length < 2) return null;

    const tiempos = data.map(d => d.tiempo);
    const minTime = Math.min(...tiempos);
    const maxTime = Math.max(...tiempos);
    const avgTime = (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(2);
    
    // Índice de Fatiga: Diferencia porcentual entre el mejor y el peor
    const fatigaIndex = ((maxTime - minTime) / minTime * 100).toFixed(1);
    
    let fatigaLabel = "Estable";
    if (fatigaIndex > 10) fatigaLabel = "Alta Caída (Láctico)";
    else if (fatigaIndex > 5) fatigaLabel = "Pérdida Moderada";
    else if (fatigaIndex < 2) fatigaLabel = "Muy Constante";

    data = data.map(d => ({
        ...d,
        isBest: d.tiempo === minTime,
        isWorst: d.tiempo === maxTime
    }));

    return (
      <div key={distancia} className="chart-card">
        <div className="chart-title">
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
             <FaTrophy style={{color: '#ffd700'}}/> 
             <span>{distancia}</span>
          </div>
          <span className="chart-badge">{title}</span>
        </div>
        
        <div className="chart-stats-row">
            <div className="stat-item best">
                <small>Mejor (PB Session)</small>
                <strong>{minTime}s</strong>
            </div>
            <div className="stat-item volume">
                <small>Volumen Total</small>
                <strong>{totalMetros}m</strong>
            </div>
            <div className="stat-item fatigue">
                <small>Índice Fatiga</small>
                <strong style={{ color: fatigaIndex > 5 ? '#ef4444' : '#10b981' }}>{fatigaIndex}%</strong>
            </div>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`colorGradient-${distancia}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorLine} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={colorLine} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis 
                dataKey="name" stroke="#94a3b8" fontSize={11} 
                tickLine={false} axisLine={false} dy={10}
              />
              <YAxis 
                reversed={true} stroke="#94a3b8" fontSize={11} 
                domain={['dataMin - 0.2', 'dataMax + 0.2']} 
                tickFormatter={(val) => `${val}s`}
                width={40} tickLine={false} axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={minTime} stroke="#ffd700" strokeDasharray="3 3" opacity={0.8}>
                 <Label value="👑 PICO" position="insideTopRight" fill="#ffd700" fontSize={10} fontWeight="bold" offset={10}/>
              </ReferenceLine>
              <ReferenceLine y={avgTime} stroke="#94a3b8" strokeDasharray="5 5" opacity={0.5}>
                 <Label value="AVG" position="insideBottomLeft" fill="#94a3b8" fontSize={10} />
              </ReferenceLine>
              <Area 
                type="monotone" dataKey="tiempo" stroke={colorLine} strokeWidth={3} 
                fillOpacity={1} fill={`url(#colorGradient-${distancia})`} 
                dot={<CustomizedDot />} activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-insight-footer">
            <small>Tendencia: <span style={{color: '#fff', fontWeight:'bold'}}>{fatigaLabel}</span></small>
            <br/>
            <small className="chart-footer-hint">* Gráfica invertida: arriba es más rápido.</small>
        </div>
      </div>
    );
  };

  return (
    <div className="registro-container">
      {/* HEADER STICKY */}
      <div className="registro-header-sticky">
        <button type="button" className="btn-icon-nav" onClick={() => navigate('/registro')} disabled={saving}><FaArrowLeft /></button>
        <div className="header-title-column">
              <h3>{editRecord ? 'Editar' : 'Registrar'}</h3>
              {!editRecord && <span className="status-autosave">{autoSaved ? '☁️ Guardado' : '...'}</span>}
        </div>
        <button type="button" className="btn-save-mini" onClick={handleGuardar} disabled={saving}>
          {saving ? '...' : <FaSave />}
        </button>
      </div>

      <div className="form-body-content">
        
        {/* --- DATOS GENERALES Y CONTEXTO PROFESIONAL --- */}
        <div className="section-container">
            <div className="form-group">
                <label>Fecha <FaCalendarAlt /></label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={saving} />
            </div>
            
            {/* BOTÓN GRANDE PARA OBTENER CLIMA (NUEVO) */}
            <div style={{ marginBottom: '1rem' }}>
                <button 
                    type="button" 
                    className={`btn-detect-full ${loadingWeather ? 'loading' : ''}`} 
                    onClick={obtenerClima}
                    disabled={loadingWeather}
                >
                    {loadingWeather ? (
                        <>
                            <FaSyncAlt className="spin-icon" /> Obteniendo datos...
                        </>
                    ) : (
                        <>
                            <FaMapMarkerAlt /> 📍 Obtener Clima Actual (GPS)
                        </>
                    )}
                </button>
            </div>

            {/* NUEVA FILA DE CONTEXTO (Clima y Calzado) */}
            <div className="context-row">
                <div className="form-group small">
                    <label><FaWind /> Viento (m/s)</label>
                    <input 
                        type="number" 
                        placeholder="+0.0" 
                        step="0.1" 
                        value={clima.wind} 
                        onChange={e => setClima({...clima, wind: e.target.value})} 
                    />
                </div>
                <div className="form-group small">
                    <label><FaThermometerHalf /> Temp ºC</label>
                    <input 
                        type="number" 
                        placeholder="25" 
                        value={clima.temp} 
                        onChange={e => setClima({...clima, temp: e.target.value})} 
                    />
                </div>
                <div className="form-group medium">
                    <label><FaShoePrints /> Calzado</label>
                    <select 
                        value={calzado} 
                        onChange={e => setCalzado(e.target.value)}
                        className="select-calzado-highlight"
                    >
                        <option value="clavos">👟 Clavos (Spikes)</option>
                        <option value="zapatillas">👟 Zapatillas</option>
                        <option value="mixto">🔄 Mixto</option>
                    </select>
                </div>
            </div>

            <div className="form-group" style={{marginTop: '1rem'}}>
                <label>Plan de entrenamiento <FaRunning /></label>
                <textarea className="textarea-plan" placeholder="Detalles del plan..." value={plan} onChange={e => setPlan(e.target.value)} disabled={saving} />
            </div>
        </div>

        {/* --- SECCIÓN PRUEBAS / SERIES (PLANIFICACIÓN) --- */}
        <div className="section-container">
            <h3><FaStopwatch /> Series (Planificación)</h3>
            <p className="section-subtitle">Define tus series. Pulsa + para agregar la siguiente.</p>
            
            {seriesInputs.map((e, i) => (
            <div key={i} className="series-card-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.9rem' }}>
                            Serie #{i + 1}
                        </span>
                        {e.base && (
                            <span style={{ 
                                backgroundColor: '#0ea5e9', 
                                color: 'white', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontWeight: 'bold', 
                                fontSize: '0.9rem',
                                boxShadow: '0 0 10px rgba(14, 165, 233, 0.4)'
                            }}>
                                PB: {e.base}
                            </span>
                        )}
                    </div>
                    <button type="button" className="btn-delete-icon" onClick={() => eliminarSerie(i)} style={{ padding: '4px', margin: 0 }}>
                        <FaTrash />
                    </button>
                </div>

                <div className="series-content-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="series-input-row-main" style={{ flex: '2 1 150px' }}>
                        <div className="series-input-group full-width">
                            <label>Prueba</label>
                            <select value={e.pruebaKey} onChange={v => handleSeriesChange(i, 'pruebaKey', v.target.value)} disabled={saving} className="select-prueba">
                                <option value="">Seleccionar...</option>
                                {Object.keys(controles).map(key => <option key={key} value={key}>{key}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="series-input-row-secondary" style={{ flex: '1 1 80px' }}>
                        <div className="series-input-group">
                            <label>%</label>
                            <input type="number" placeholder="Ej: 80" value={e.porcentaje} onChange={v => handleSeriesChange(i, 'porcentaje', v.target.value)} disabled={saving} />
                        </div>
                    </div>
                    
                    <div className="series-result" style={{ flex: '1 1 80px', paddingBottom: '12px' }}>
                        <label>Meta</label>
                        <div className="sugerido-display">
                            {e.sugerido ? (
                                <strong style={{ textShadow: 'none', filter: 'none' }}>{e.sugerido}s</strong>
                            ) : (
                                <span style={{opacity:0.3}}>-</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            ))}
            
            <button type="button" className="btn-add-outline" onClick={agregarSerie} disabled={saving}>
                <FaPlus /> Agregar Serie
            </button>
        </div>

        {/* --- SECCIÓN REPETICIONES (EJECUCIÓN) --- */}
        <div className="section-container highlight-section">
            <h3><FaRunning /> Repeticiones (Tiempos)</h3>
            {promedios.map((p, i) => (
            <div key={i} className="bloque-reps-card">
                <div className="bloque-reps-header">
                    <div className="smart-select-wrapper">
                        <select value={p.pruebaKey} onChange={e => { const copy = [...promedios]; copy[i].pruebaKey = e.target.value; setPromedios(copy); }} className="select-distancia-reps">
                            <option value="">Distancia...</option>
                            {seriesInputs.length > 0 && <optgroup label="Del Plan">{seriesInputs.map((s, idx) => s.pruebaKey && <option key={`s-${idx}`} value={s.pruebaKey}>{s.pruebaKey} (Plan)</option>)}</optgroup>}
                            <optgroup label="Todas">{Object.keys(controles).map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
                        </select>
                    </div>
                    <button type="button" className="btn-delete-bloque-mini" onClick={() => requestEliminarBloque(i)}>Eliminar</button>
                </div>
                <div className="reps-grid-container">
                    {p.series.map((s, j) => (
                        <div key={j} className="rep-input-item">
                            <span className="rep-idx">#{j+1}</span>
                            <input type="number" placeholder="--" value={s} onChange={e => handleRepeticionChange(i, j, e.target.value)} disabled={saving} />
                            <button type="button" className="btn-x-rep" onClick={() => requestEliminarRepeticion(i, j)}><FaTimesCircle /></button>
                        </div>
                    ))}
                    <button type="button" className="btn-add-rep-big" onClick={(e) => agregarRepeticion(i, e)}><FaPlus /></button>
                </div>
                {p.promedio && <div className="bloque-promedio-footer">Promedio: <strong>{p.promedio}</strong></div>}
            </div>
            ))}
            <button type="button" className="btn-add-main" onClick={agregarPromedioBloque} disabled={saving}>Crear Bloque de Tiempos</button>
        </div>

        {/* --- BOTÓN PARA GENERAR GRÁFICAS --- */}
        <button 
            type="button" 
            className="btn-generate-charts" 
            onClick={() => setShowCharts(!showCharts)}
        >
            <FaChartLine /> {showCharts ? 'Ocultar Análisis' : 'Analizar Rendimiento'}
        </button>

        {/* --- SECCIÓN: ANÁLISIS DE RENDIMIENTO (CONDICIONAL) --- */}
        {showCharts && (
          <div className="section-container">
            <h3><FaChartLine /> Análisis Técnico</h3>
            {Object.keys(datosGraficas).length > 0 ? (
                <>
                    <p className="section-subtitle">Fatiga, consistencia y picos de velocidad.</p>
                    <div className="charts-grid">
                        {Object.entries(datosGraficas).map(([distancia, bloques]) => renderGrafica(distancia, bloques))}
                    </div>
                </>
            ) : (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>
                    No hay suficientes datos registrados para generar gráficas. <br/>
                    <small>Añade al menos un bloque con tiempos completos.</small>
                </p>
            )}
          </div>
        )}

        {/* --- ESTADÍSTICAS --- */}
        <div className="section-container">
            <label>Estado de Ánimo</label>
            <div className="mood-selector-row">
                {MOODS.map(m => (
                    <div key={m.value} className={`mood-item ${animo === m.value ? 'selected' : ''}`} onClick={() => !saving && setAnimo(m.value)}>
                        <span className="mood-icon">{m.icon}</span>
                        <span className="mood-text">{m.label}</span>
                    </div>
                ))}
            </div>

            <div className="stats-row-inputs">
                {/* SUEÑO */}
                <div className="form-group half">
                    <label>Sueño (Horas) <FaBed /></label>
                    <input type="number" value={sleepHours} onChange={e => setSleepHours(e.target.value)} disabled={saving} />
                    <small className="sleep-hint">{sleepRecommendation}</small>
                </div>
            </div>
            
            <div className="form-group">
                <label>Sensaciones</label>
                <textarea placeholder="Comentarios..." value={sensaciones} onChange={e => setSensaciones(e.target.value)} className="textarea-small" />
            </div>
        </div>

        {/* --- ESTADO FÍSICO (GIGANTE Y SOLO) --- */}
        <div className="fisico-large-container">
            <label><FaHeartbeat /> Estado Físico Hoy</label>
            <div className="fisico-display">
                <span className={`fisico-number val-${estadoFisico}`}>{estadoFisico}</span>
                <span className="fisico-scale">/ 10</span>
            </div>
            <input 
                type="range" 
                min="1" 
                max="10" 
                step="1"
                value={estadoFisico} 
                onChange={e => setEstadoFisico(+e.target.value)} 
                disabled={saving}
                className="fisico-slider-large"
            />
            <div className="fisico-labels">
                <span>Agotado</span>
                <span>Óptimo</span>
            </div>
        </div>

        {/* BOTÓN GUARDAR FINAL */}
        <div className="footer-actions">
            <button type="button" className="btn-save-full" onClick={handleGuardar} disabled={saving}>
                {editRecord ? 'ACTUALIZAR' : 'GUARDAR ENTRENAMIENTO'}
            </button>
        </div>
      </div>

      {/* MODALES */}
      <ConfirmModal isOpen={showDeleteBlockModal} title="Eliminar Bloque" onConfirm={confirmarEliminarBloque} onCancel={() => setShowDeleteBlockModal(false)} confirmText="Sí, eliminar">
        <p>¿Eliminar este bloque de tiempos?</p>
      </ConfirmModal>

      <ConfirmModal isOpen={showDeleteRepModal} title="Borrar Tiempo" onConfirm={confirmarEliminarRepeticion} onCancel={() => setShowDeleteRepModal(false)} confirmText="Borrar">
        <p>¿Borrar este tiempo?</p>
      </ConfirmModal>
    </div>
  );
}