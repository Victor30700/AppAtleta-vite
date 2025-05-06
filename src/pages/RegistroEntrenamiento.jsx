import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import StatusModal from '../components/StatusModal';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../styles/RegistroEntrenamiento.css';

export default function RegistroEntrenamiento() {
  const { user, loading } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();

  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);

  useEffect(() => {
    if (!loading && user) loadRegistros();
  }, [user, loading]);

  const loadRegistros = async () => {
    const snap = await getDoc(docRegistro);
    const data = snap.exists() ? snap.data().registros || [] : [];
    data.sort((a, b) => b.fecha.localeCompare(a.fecha));
    setRegistros(data);
    setLoadingRegs(false);
  };

  const filteredRegistros = useMemo(
    () => registros.filter(r => {
      if (!searchQuery) return true;
      const [y, m] = searchQuery.split('-');
      const [ry, rm] = r.fecha.split('-');
      return ry === y && rm === m;
    }),
    [registros, searchQuery]
  );

  const handleDelete = idx => {
    setDeleteIdx(idx);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setStatusMessage('Eliminando registro...');
    setShowStatusModal(true);
    try {
      const next = registros.filter((_, i) => i !== deleteIdx);
      await setDoc(docRegistro, { registros: next });
      setRegistros(next);
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    } finally {
      setShowStatusModal(false);
      setShowDeleteModal(false);
    }
  };

  const handleCopy = idx => {
    const r = filteredRegistros[idx];
    let text = `Plan:\n${r.plan || 'Sin plan'}\n\n`;
    text += 'Series registradas:\n';
    if (r.series?.length) {
      r.series.forEach(s => {
        text += `• ${s.distancia || s.pruebaKey || '–'}: ${s.porcentaje}% → ${s.sugerido}s\n`;
      });
    } else {
      text += 'No registradas\n';
    }
    text += '\nRegistro de repeticiones:\n';
    if (r.promedios?.length) {
      r.promedios.forEach(p => {
        text += `• ${p.pruebaKey || '–'}: [${p.series.join(', ')}]\n`;
      });
    } else {
      text += 'No registradas\n';
    }
    text += '\nPromedio de series:\n';
    if (r.promedios?.length) {
      r.promedios.forEach(p => {
        text += `• ${p.pruebaKey || '–'}: ${p.promedio || '-'}\n`;
      });
    } else {
      text += 'No calculado\n';
    }
    text += `\nEstado físico: ${r.estadoFisico}/10\n`;
    text += `Ánimo: ${r.animo}/5\n`;
    text += `Horas de sueño (1–10): ${r.sleepHours ?? '–'}\n`;

    navigator.clipboard.writeText(text)
      .then(() => alert('Registro copiado al portapapeles'))
      .catch(() => alert('No se pudo copiar'));
  };

  const handleEdit = (r, idx) => {
    setStatusMessage('Cargando datos para edición...');
    setShowStatusModal(true);
    setTimeout(() => {
      setShowStatusModal(false);
      navigate('/registro/nuevo', { state: { editRecord: { ...r, index: idx } }});
    }, 500);
  };

  const generarPDF = () => {
    setStatusMessage('Generando PDF...');
    setShowStatusModal(true);
    setTimeout(() => {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      doc.setFontSize(18);
      doc.text('SprinterApp - Entrenamientos Registrados', 40, 40);

      const cols = [
        { header: 'Fecha', dataKey: 'fecha' },
        { header: 'Plan', dataKey: 'plan' },
        { header: 'Series Registradas', dataKey: 'series' },
        { header: 'Registro de Repeticiones', dataKey: 'registro' },
        { header: 'Promedio de Series', dataKey: 'promedio' },
        { header: 'Estado Físico', dataKey: 'estadoFisico' },
        { header: 'Ánimo', dataKey: 'animo' },
        { header: 'Horas de Sueño', dataKey: 'sleepHours' },
      ];

      const rows = filteredRegistros.map(r => ({
        fecha: r.fecha,
        plan: r.plan || 'N/A',
        series: r.series
          ? r.series.map(s => `${s.distancia||s.pruebaKey||'–'}:${s.porcentaje}%→${s.sugerido}s`).join('; ')
          : '–',
        registro: r.promedios
          ? r.promedios.map(p => `${p.pruebaKey||'–'}:[${p.series.join(',')}]`).join('; ')
          : '–',
        promedio: r.promedios
          ? r.promedios.map(p => `${p.pruebaKey||'–'}:${p.promedio||'-'}`).join('; ')
          : '–',
        estadoFisico: `${r.estadoFisico}/10`, 
        animo: `${r.animo}/5`, 
        sleepHours: r.sleepHours ?? '–'
      }));

      autoTable(doc, {
        startY: 70,
        head: [cols.map(c => c.header)],
        body: rows.map(row => cols.map(c => row[c.dataKey])),
        theme: 'grid',
        margin: { top: 80, left: 40, right: 40, bottom: 40 },
        styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
        headStyles: { fillColor: [33,47,61], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          fecha: { cellWidth: 60 },
          plan: { cellWidth: 120 },
          series: { cellWidth: 80 },
          registro: { cellWidth: 80 },
          promedio: { cellWidth: 80 },
          estadoFisico: { cellWidth: 60 },
          animo: { cellWidth: 50 },
          sleepHours: { cellWidth: 50 },
        },
        tableWidth: 'auto',
      });

      doc.save(`SprinterApp-Entrenamientos-${searchQuery||'todos'}.pdf`);
      setShowStatusModal(false);
    }, 500);
  };

  if (loading || loadingRegs) return <p>Cargando...</p>;
  if (!user) return <p>Acceso denegado</p>;

  return (
    <div className="registro-container">
      <div className="registro-header">
        <button className="btn btn-back" onClick={() => navigate('/home')}>⬅ Volver</button>
        <h2>Historial de Entrenamientos</h2>
      </div>

      <button onClick={() => navigate('/registro/nuevo')} className="btn">Nuevo Registro</button>

      <div className="form-group">
        <label>Buscar mes/año:</label>
        <input type="month" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {searchQuery && filteredRegistros.length > 0 && <button className="btn" onClick={generarPDF}>Descargar PDF</button>}

      {filteredRegistros.map((r, idx) => (
        <div key={idx} className="historial-row">
          <div className="registro-clave">
            <p><strong>{r.fecha}</strong></p>
            <ul>
              <li><strong>Plan:</strong> {r.plan || 'Sin plan'}</li>
              <li><strong>Series registradas:</strong>{r.series?.length
                  ? <ul>{r.series.map((s,i)=>(<li key={i}>{s.distancia||s.pruebaKey||'–'}: {s.porcentaje}% → {s.sugerido}s</li>))}</ul>
                  : ' No registradas'}</li>
              <li><strong>Registro de repeticiones:</strong>{r.promedios?.length
                  ? <ul>{r.promedios.map((p,i)=>(<li key={i}>{p.pruebaKey||'–'}: [{p.series.join(', ')}]</li>))}</ul>
                  : ' No registradas'}</li>
              <li><strong>Promedio de series:</strong>{r.promedios?.length
                  ? <ul>{r.promedios.map((p,i)=>(<li key={i}>{p.pruebaKey||'–'}: {p.promedio||'-'}</li>))}</ul>
                  : ' No calculado'}</li>
              <li><strong>Estado físico:</strong> {r.estadoFisico}/10</li>
              <li><strong>Ánimo:</strong> {r.animo}/5</li>
              <li><strong>Horas de sueño (1–10):</strong> {r.sleepHours ?? '–'}</li>
            </ul>
          </div>
          <div className="historial-actions">
            <button onClick={() => handleCopy(idx)}>Copiar</button>
            <button onClick={() => handleEdit(r, idx)}>Editar</button>
            <button onClick={() => handleDelete(idx)}>Eliminar</button>
          </div>
        </div>
      ))}

      <ConfirmModal isOpen={showDeleteModal} title="Eliminar Registro" onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} confirmText="Sí, eliminar">
        <p>¿Seguro que deseas eliminar este registro?</p>
      </ConfirmModal>

      <StatusModal
        isOpen={showStatusModal}
        message={statusMessage}
        onRequestClose={() => setShowStatusModal(false)}
      />
    </div>
  );
}