// src/pages/HealthProfilePage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../styles/HealthProfilePage.css';

export default function HealthProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const db = getFirestore(app);
  const ref = useMemo(() => user && doc(db, 'healthProfiles', user.email), [user, db]);

  const [view, setView] = useState('peso');
  const [busqueda, setBusqueda] = useState('');
  const [bodyEntries, setBodyEntries] = useState([]);
  const [allInjuries, setAllInjuries] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1️⃣ Cambia la vista ('peso' o 'lesiones')
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setView(params.get('view') === 'lesiones' ? 'lesiones' : 'peso');
  }, [location.search]);

  // 2️⃣ Carga inicial de datos
  const cargarDatos = useMemo(() => async () => {
    if (!ref) return;
    setLoading(true);
    try {
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};

      const bodies = data.bodyEntries || [];
      bodies.sort((a, b) => b.date.localeCompare(a.date));
      setBodyEntries(bodies);

      const inj = data.injuries || [];
      inj.sort((a, b) => b.date.localeCompare(a.date));
      setAllInjuries(inj);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // 3️⃣ Filtrado por mes/año
  const entradasFiltradas = useMemo(() => {
    const list = view === 'peso' ? bodyEntries : allInjuries;
    if (!busqueda) return list;
    return list.filter(e => e.date.startsWith(busqueda));
  }, [view, busqueda, bodyEntries, allInjuries]);

  // 4️⃣ Eliminar registro
  const handleDelete = async (type, idx) => {
    if (!window.confirm('¿Seguro que deseas eliminar?')) return;
    setLoading(true);
    const key = type === 'peso' ? 'bodyEntries' : 'injuries';
    const updated = [...(type === 'peso' ? bodyEntries : allInjuries)];
    updated.splice(idx, 1);
    await setDoc(ref, { [key]: updated }, { merge: true });
    type === 'peso' ? setBodyEntries(updated) : setAllInjuries(updated);
    setLoading(false);
  };

  // 5️⃣ Generar y descargar PDF
  const downloadPDF = () => {
    const doc = new jsPDF('p', 'pt', 'letter');
    const title = view === 'peso'
      ? 'RegistroPesoCorporal - SprinterApp'
      : 'SprinterApp - Registro de lesiones';

    doc.setFontSize(18);
    doc.text(title, 40, 40);

    let columns, rows;
    if (view === 'peso') {
      columns = [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Peso (kg)', dataKey: 'weightKg' },
        { header: 'Altura (m)', dataKey: 'heightM' },
        { header: '% Grasa', dataKey: 'bodyFat' },
        { header: 'Actividad', dataKey: 'activityLevel' },
        { header: 'Notas', dataKey: 'notes' },
        { header: 'IMC', dataKey: 'bmi' },
      ];
      rows = entradasFiltradas.map(e => ({
        date: e.date,
        weightKg: `${e.weightKg} (${e.weightLbs} lbs)`,
        heightM: `${e.heightM} (${e.heightFt})`,
        bodyFat: e.bodyFat ?? '—',
        activityLevel: e.activityLevel ?? '—',
        notes: e.notes ?? '—',
        bmi: `${e.bmi} (${e.category})`
      }));
    } else {
      columns = [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Lesión', dataKey: 'name' },
        { header: 'Estado', dataKey: 'active' },
        { header: 'Notas', dataKey: 'notes' }
      ];
      rows = entradasFiltradas.map(e => ({
        date: e.date,
        name: e.name,
        active: e.active ? 'Activa' : 'Recuperada',
        notes: e.notes ?? '—'
      }));
    }

    autoTable(doc, {
      startY: 60,
      head: [columns.map(col => col.header)],
      body: rows.map(row => columns.map(col => row[col.dataKey])),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [44, 62, 80], textColor: 255, halign: 'center' },
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
    });

    doc.save(`${title.replace(/\s+/g,'_')}-${busqueda || 'todos'}.pdf`);
  };

  return (
    <div className="health-profile-container">
      <button className="back-button" onClick={() => navigate('/home')}>
        ← Volver
      </button>

      <div className="header-controls">
        <div className="view-switch">
          <button
            className={view === 'peso' ? 'active' : ''}
            onClick={() => navigate('/health-profile?view=peso')}
            disabled={loading}
          >
            Peso & Altura
          </button>
          <button
            className={view === 'lesiones' ? 'active' : ''}
            onClick={() => navigate('/health-profile?view=lesiones')}
            disabled={loading}
          >
            Lesiones
          </button>
        </div>
        <div className="search-download">
          <input
            type="month"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            disabled={loading}
          />
          {/** ↓ Solo aparece si hay filtro y resultados ↓ */}
          {busqueda && entradasFiltradas.length > 0 && (
            <button onClick={downloadPDF} disabled={loading}>
              Descargar PDF
            </button>
          )}
        </div>
      </div>

      <div className="main-content">
        <button
          onClick={() =>
            navigate(
              view === 'peso'
                ? '/health-profile/peso-altura'
                : '/health-profile/lesiones'
            )
          }
          disabled={loading}
        >
          + Nuevo registro
        </button>

        {loading && <p>Cargando datos...</p>}

        <div className="entries-grid">
          {entradasFiltradas.map((e, i) => (
            <div
              key={i}
              className={`entry-card ${
                view === 'lesiones' && e.active === false ? 'recovered' : ''
              }`}
            >
              {view === 'peso' ? (
                <>
                  <h4>{e.date}</h4>
                  <p><strong>Peso:</strong> {e.weightKg} kg ({e.weightLbs} lbs)</p>
                  <p><strong>Altura:</strong> {e.heightM} m ({e.heightFt})</p>
                  <p><strong>% Grasa:</strong> {e.bodyFat || '—'}</p>
                  <p><strong>Actividad:</strong> {e.activityLevel || '—'}</p>
                  <p><strong>Notas:</strong> {e.notes || '—'}</p>
                  <hr/>
                  <p><strong>IMC:</strong> {e.bmi} ({e.category})</p>
                  <p><strong>Peso ideal:</strong> {e.idealMinKg}–{e.idealMaxKg} kg</p>
                </>
              ) : (
                <>
                  <h4>{e.date}</h4>
                  <p><strong>Lesión:</strong> {e.name}</p>
                  <p><strong>Estado:</strong> {e.active ? 'Activa' : 'Recuperada'}</p>
                  <p><strong>Notas:</strong> {e.notes || '—'}</p>
                </>
              )}
              <div className="entry-actions">
                <button
                  onClick={() =>
                    navigate(
                      `/health-profile/${
                        view === 'peso' ? 'peso-altura' : 'lesiones'
                      }?edit=${i}`
                    )
                  }
                  disabled={loading}
                >
                  Editar
                </button>
                <button onClick={() => handleDelete(view, i)} disabled={loading}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {!entradasFiltradas.length && !loading && <p>No hay registros aún.</p>}
        </div>
      </div>
    </div>
  );
}
