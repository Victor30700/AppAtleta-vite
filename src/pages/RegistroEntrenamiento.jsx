import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/RegistroEntrenamiento.css';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const generarPDF = () => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AppSprinterGallo - Registros de Entrenamiento', 20, 20);

  const columns = [
    { header: 'Fecha', dataKey: 'fecha' },
    { header: 'Plan', dataKey: 'plan' },
    { header: 'Estado Físico', dataKey: 'estadoFisico' },
    { header: 'Ánimo', dataKey: 'animo' },
    { header: 'Sensaciones', dataKey: 'sensaciones' },
  ];

  const rows = filteredRegistros.map((registro) => ({
    fecha: registro.fecha || 'N/A',
    plan: registro.plan || 'Sin plan',
    estadoFisico: registro.estadoFisico ? `${registro.estadoFisico}/10` : 'N/A',
    animo: registro.animo || 'N/A',
    sensaciones: registro.sensaciones || 'N/A',
  }));

  autoTable(doc, {
    startY: 30,
    columns,
    body: rows,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [44, 62, 80],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      textColor: [50, 50, 50],
    },
    margin: { left: 20, right: 20 },
  });

  doc.save(`AppSprinterGallo-${searchQuery || 'todos'}.pdf`);
};
// IMPORTANTE para que funcione autoTable

export default function RegistroEntrenamiento() {
  const { user, loading } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const navigate = useNavigate();

  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);

  useEffect(() => {
    if (!loading && user) {
      loadRegistros();
    }
  }, [user, loading]);

  // 🔍 Verificación de autoTable
  useEffect(() => {
    const doc = new jsPDF();
    if (typeof doc.autoTable !== 'function') {
      console.error('❌ autoTable no está disponible en jsPDF');
    } else {
      console.log('✅ autoTable está cargado correctamente');
    }
  }, []);

  const loadRegistros = async () => {
    const snap = await getDoc(docRegistro);
    const data = snap.exists() ? snap.data().registros || [] : [];
    data.sort((a, b) => b.fecha.localeCompare(a.fecha));
    setRegistros(data);
    setLoadingRegs(false);
  };

  const handleDelete = idx => {
    setDeleteIdx(idx);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const filtered = registros.filter((_, i) => i !== deleteIdx);
    await setDoc(docRegistro, { registros: filtered });
    setRegistros(filtered);
    setShowDeleteModal(false);
  };

  const handleEdit = idx => {
    const record = { ...registros[idx], index: idx };
    navigate('/registro/nuevo', { state: { editRecord: record } });
  };

  const filteredRegistros = registros.filter(r => {
    if (!searchQuery) return true;
    const [year, month] = searchQuery.split('-');
    const [rYear, rMonth] = r.fecha.split('-');
    return (!year || rYear === year) && (!month || rMonth === month);
  });

const generarPDF = () => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AppSprinterGallo - Registros de Entrenamiento', 20, 20);

  const columns = [
    { header: 'Fecha', dataKey: 'fecha' },
    { header: 'Plan', dataKey: 'plan' },
    { header: 'Estado Físico', dataKey: 'estadoFisico' },
    { header: 'Ánimo', dataKey: 'animo' },
    { header: 'Sensaciones', dataKey: 'sensaciones' },
  ];

  const rows = filteredRegistros.map((registro) => ({
    fecha: registro.fecha || 'N/A',
    plan: registro.plan || 'Sin plan',
    estadoFisico: registro.estadoFisico ? `${registro.estadoFisico}/10` : 'N/A',
    animo: registro.animo || 'N/A',
    sensaciones: registro.sensaciones || 'N/A',
  }));

  autoTable(doc, {
    startY: 30,
    columns,
    body: rows,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [44, 62, 80],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      textColor: [50, 50, 50],
    },
    margin: { left: 20, right: 20 },
  });

  doc.save(`AppSprinterGallo-${searchQuery || 'todos'}.pdf`);
};


  if (loading || loadingRegs) return <p>Cargando...</p>;
  if (!user) return <p>Acceso denegado</p>;

  return (
    <div className="registro-container">
      <div className="registro-header">
        <button className="btn btn-back" onClick={() => navigate('/home')}>
          ⬅ Volver
        </button>
        <h2>Historial de Entrenamientos</h2>
      </div>

      <button onClick={() => navigate('/registro/nuevo')} className="btn">
        Nuevo Registro
      </button>

      <div className="form-group">
        <label>Buscar por mes/año (ej: 2025-04)</label>
        <input
          type="month"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {searchQuery && filteredRegistros.length > 0 && (
        <button className="btn" onClick={generarPDF}>
          Descargar PDF
        </button>
      )}

      {filteredRegistros.map((r, idx) => (
        <div key={idx} className="historial-row">
          <div>
            <strong>{r.fecha}</strong> — {r.plan || 'Sin plan especificado'} — {r.estadoFisico}/10
          </div>
          <div className="historial-actions">
            <button onClick={() => handleEdit(idx)}>Editar</button>
            <button onClick={() => handleDelete(idx)}>Eliminar</button>
          </div>
        </div>
      ))}

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar Registro"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        confirmText="Sí, eliminar"
      >
        <p>¿Seguro que deseas eliminar este registro?</p>
      </ConfirmModal>
    </div>
  );
}
