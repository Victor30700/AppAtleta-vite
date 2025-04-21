import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from '../styles/RegistroGymList.module.css';

export default function RegistroGymList() {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  const [mode, setMode] = useState('mensual'); // 'mensual' o 'diario'
  const [busqueda, setBusqueda] = useState('');
  const [mensual, setMensual] = useState([]);
  const [diario, setDiario] = useState([]);

  // Cargar registros mensuales
  const cargarMensual = async () => {
    if (!user) return;
    const snap = await getDocs(collection(db, 'registrosGym'));
    const datos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => (r.metadata?.email || r.email) === user.email);
    setMensual(datos);
  };

  // Cargar registros diarios con ID
  const cargarDiario = async () => {
    if (!user) return;
    const docRef = doc(db, 'registroGymDiario', user.email);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data().registros || [] : [];
    setDiario(data.map(r => ({ id: r.id, ...r })));
  };

  useEffect(() => {
    cargarMensual();
    cargarDiario();
  }, [user]);

  // Filtrar por mes-año
  const filtrar = array => {
    if (!busqueda) return array;
    return array.filter(r => {
      const fechaStr = mode === 'mensual'
        ? (r.plan?.fechaInicio || '')
        : r.fecha;
      if (!fechaStr) return false;
      const dt = new Date(fechaStr);
      const mes = String(dt.getMonth() + 1).padStart(2, '0');
      const anio = dt.getFullYear();
      return `${anio}-${mes}`.includes(busqueda);
    });
  };

  // Eliminar mensual
  const handleEliminarMensual = async id => {
    if (!window.confirm('¿Seguro quieres eliminar este registro mensual?')) return;
    await deleteDoc(doc(db, 'registrosGym', id));
    setMensual(prev => prev.filter(r => r.id !== id));
  };

  // Eliminar diario
  const handleEliminarDiario = async id => {
    if (!window.confirm('¿Seguro quieres eliminar este registro diario?')) return;
    const docRef = doc(db, 'registroGymDiario', user.email);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data().registros || [] : [];
    const updated = existing.filter(r => r.id !== id);
    await setDoc(docRef, { registros: updated });
    setDiario(prev => prev.filter(r => r.id !== id));
  };

  // Listas filtradas y ordenadas
  const mensualFiltrada = useMemo(() => {
    return filtrar(mensual).sort((a, b) => new Date(b.plan?.fechaInicio || 0) - new Date(a.plan?.fechaInicio || 0));
  }, [mensual, busqueda]);

  const diarioFiltrado = useMemo(() => {
    return filtrar(diario).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [diario, busqueda]);

  // Función para descargar PDF
  const downloadPDF = () => {
    const docPdf = new jsPDF({ unit: 'pt', format: 'letter' });
    if (mode === 'mensual') {
      docPdf.setFontSize(18);
      docPdf.text('SprinterApp - RegistroGym Mensual', 40, 40);

      // Columnas y filas
      const cols = [
        'Plan',
        'Fechas',
        'Peso Corporal',
        '% Carga Calculados',
        'Veces Cumplidas'
      ];
      const rows = mensualFiltrada.map(r => [
        r.plan?.descripcion || '–',
        `${r.plan?.fechaInicio || '–'} → ${r.plan?.fechaFin || '–'}`,
        r.pesocorporal ?? r.peso ?? '–',
        (r.calculos || []).map(c => `${c.porcentaje}%→${c.pesoCalculado}`).join('\n'),
        r.vecesQueCumplisteElPlan ?? r.repeticiones ?? 0
      ]);

      autoTable(docPdf, {
        startY: 70,
        head: [cols],
        body: rows,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [33,47,61], textColor: 255 }
      });
    } else {
      docPdf.setFontSize(18);
      docPdf.text('SprinterApp - RegistroGym - Diario', 40, 40);

      const cols = ['Fecha','Zona','Plan','Unidad','Ejercicios'];
      const rows = diarioFiltrado.map(r => [
        r.fecha,
        r.zona,
        r.plan,
        r.unidadPeso,
        (r.ejercicios || []).map(e => `${e.nombre}(${e.repeticiones}r)`).join('\n')
      ]);

      autoTable(docPdf, {
        startY: 70,
        head: [cols],
        body: rows,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [33,47,61], textColor: 255 }
      });
    }
    docPdf.save(`SprinterApp_${mode === 'mensual' ? 'Mensual' : 'Diario'}_${busqueda || 'todos'}.pdf`);
  };

  return (
    <div className={styles.listaWrapper}>
      <div className={styles.listaContainer}>
        {/* Header y switch */}
        <div className={styles.listaHeader}>
          <button className={styles.btn} onClick={() => navigate('/home')}>← Volver</button>
          <div className={styles.modeSwitch}>
            <button
              className={`${styles.btn} ${mode==='mensual'?styles.active:''}`}
              onClick={() => setMode('mensual')}
            >Mensual</button>
            <button
              className={`${styles.btn} ${mode==='diario'?styles.active:''}`}
              onClick={() => setMode('diario')}
            >Diario</button>
          </div>
          {mode==='mensual'
            ? <button className={styles.btn} onClick={() => navigate('/registro-gym/nuevo')}>+ Nuevo Registro Mensual</button>
            : <button className={styles.btn} onClick={() => navigate('/registro-gym/diario')}>+ Nuevo Registro Diario</button>
          }
        </div>

        {/* Buscador y descarga PDF */}
        <div className={styles.formGroup}>
          <label htmlFor="busqueda">Buscar por mes y año</label>
          <input
            id="busqueda"
            type="month"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        {busqueda && (mensualFiltrada.length || diarioFiltrado.length) > 0 && (
          <button className={styles.btn} onClick={downloadPDF}>
            Descargar PDF
          </button>
        )}

        {/* Listado */}
        <div className={styles.listaItems}>
          {mode==='mensual'
            ? mensualFiltrada.map(r => (
                <div key={r.id} className={styles.listaItem}>
                  <div><strong>Plan:</strong> {r.plan?.descripcion || '–'}</div>
                  <div><strong>Fechas:</strong> {r.plan?.fechaInicio || '–'} → {r.plan?.fechaFin || '–'}</div>
                  <div><strong>Peso Corporal:</strong> {r.pesocorporal ?? r.peso ?? '–'} kg</div>
                  <div><strong>% Carga Calculados:</strong></div>
                  <ul>
                    {(r.calculos || []).map((c, i) => (
                      <li key={i}>{c.porcentaje}% → {c.pesoCalculado} kg</li>
                    ))}
                  </ul>
                  <div><strong>Veces cumpliste el plan:</strong> {r.vecesQueCumplisteElPlan ?? r.repeticiones ?? 0}</div>
                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={() => navigate(`/registro-gym/nuevo?id=${r.id}`)}>Editar</button>
                    <button className={styles.btn} onClick={() => handleEliminarMensual(r.id)}>Eliminar</button>
                  </div>
                </div>
              ))
            : diarioFiltrado.map(r => (
                <div key={r.id} className={styles.listaItem}>
                  <div><strong>Fecha:</strong> {r.fecha}</div>
                  <div><strong>Zona:</strong> {r.zona}</div>
                  <div><strong>Plan:</strong> {r.plan}</div>
                  <div><strong>Unidad:</strong> {r.unidadPeso}</div>
                  <div><strong>Ejercicios:</strong>
                    <ul>
                      {r.ejercicios.map((e, i) => (
                        <li key={i}>{e.nombre} - Reps: {e.repeticiones}, Desc: {e.descanso}min, Next: {e.descansoSiguiente}min, Pesos: [{e.pesos.join(', ')}]</li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={() => navigate(`/registro-gym/diario?id=${r.id}`)}>Editar</button>
                    <button className={styles.btn} onClick={() => handleEliminarDiario(r.id)}>Eliminar</button>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}