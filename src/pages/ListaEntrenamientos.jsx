import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import styles from '../styles/ListaEntrenamientos.module.css';
import { CSVLink } from 'react-csv';


export default function ListaEntrenamientos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [registros, setRegistros] = useState([]);
  const [quitados, setQuitados] = useState(() => {
    const saved = localStorage.getItem('quitados');
    return saved ? JSON.parse(saved) : [];
  });
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [searchMonth, setSearchMonth] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [viewInfo, setViewInfo] = useState(null);

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

  useEffect(() => {
    localStorage.setItem('quitados', JSON.stringify(quitados));
  }, [quitados]);

  const handleDelete = idx => {
    setDeleteIdx(idx);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    const quitado = registros[deleteIdx];
    setQuitados(prev => [...prev, quitado]);
    setRegistros(prev => prev.filter((_, i) => i !== deleteIdx));
    setShowDeleteModal(false);
  };

  const handleRestore = idx => {
    const toRestore = quitados[idx];
    setRegistros(prev => [toRestore, ...prev]);
    setQuitados(prev => prev.filter((_, i) => i !== idx));
  };

  const handleView = item => {
    setViewInfo(item);
  };

  const filtered = registros.filter(r => {
    if (!searchMonth) return true;
    const [y, m] = searchMonth.split('-');
    const [ry, rm] = r.fecha.split('-');
    return ry === y && rm === m;
  });

  if (loading || loadingRegs) return <p>Cargando...</p>;
  if (!user) return <p>Acceso denegado</p>;

  const csvData = registros.map(r => {
    const promSeries = r.series?.length
      ? (r.series.reduce((a, s) => a + Number(s.sugerido || 0), 0) / r.series.length).toFixed(2)
      : '—';
    const promPromedios = r.promedios?.length
      ? (r.promedios.reduce((a, p) => a + Number(p.promedio || 0), 0) / r.promedios.length).toFixed(2)
      : '—';

    return {
      Fecha: r.fecha,
      Plan: r.plan,
      Gym: r.gymDone ? 'Sí' : 'No',
      'Estado Físico': r.estadoFisico,
      Ánimo: r.animo,
      Sensaciones: r.sensaciones || '',
      'Series (dist: % → sugerido)': r.series?.map(s => `${s.distancia}: ${s.porcentaje}%→${s.sugerido}s`).join('; '),
      'Promedios (dist: avg)': r.promedios?.map(p => `${p.distancia}: ${p.promedio}s`).join('; '),
      'Promedio sugerido series': promSeries,
      'Promedio de promedios': promPromedios,
    };
  });

  return (
    <div className={styles.listaContainer}>
      <div className={styles.listaHeader}>
        <button className={styles.back} onClick={() => navigate('/home')}>← Volver</button>
        <h2>Historial de Entrenamientos</h2>

      </div>

      <div className={styles.formGroup}>
        <label>Buscar mes/año:</label>
        <input
          type="month"
          value={searchMonth}
          onChange={e => setSearchMonth(e.target.value)}
        />
      </div>

      <div className={styles.listaItems}>
        {filtered.length === 0 && <p>No hay registros para esta fecha.</p>}
        {filtered.map((r, idx) => (
          <div key={idx} className={styles.listaItem}>
            <div>
              <strong>{r.fecha}</strong> — {r.plan} — {r.estadoFisico}/10
            </div>
            <div className={styles.actions}>
              <button onClick={() => handleView(r)}>Ver detalles</button>
              <button onClick={() => handleDelete(idx)}>Quitar</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.quitadosSection}>
        <h3>Registros Quitados</h3>
        {quitados.length === 0 && <p>No hay registros quitados</p>}
        {quitados.map((r, idx) => (
          <div key={idx} className={`${styles.listaItem} ${styles.quitado}`}>
            <div>
              <strong>{r.fecha}</strong> — {r.plan} — {r.estadoFisico}/10
            </div>
            <div className={styles.actions}>
              <button onClick={() => handleRestore(idx)}>Restaurar</button>
              <button onClick={() => handleView(r)}>Ver detalles</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Quitar Registro"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        confirmText="Sí, quitar"
      >
        <p>¿Seguro que deseas quitar este registro de la lista?</p>
      </ConfirmModal>

      {viewInfo && (
        <ConfirmModal
          isOpen
          title={`Detalle ${viewInfo.fecha}`}
          onConfirm={() => setViewInfo(null)}
          onCancel={() => setViewInfo(null)}
          confirmText="Cerrar"
        >
          <div className={styles.detalleContent}>
            <p><strong>Fecha:</strong> {viewInfo.fecha}</p>
            <p><strong>Plan:</strong> {viewInfo.plan}</p>
            <p><strong>Gym cumplido:</strong> {viewInfo.gymDone ? 'Sí' : 'No'}</p>
            <p><strong>Estado físico:</strong> {viewInfo.estadoFisico}/10</p>
            <p><strong>Ánimo:</strong> {viewInfo.animo}</p>
            {viewInfo.sensaciones && (
              <p><strong>Sensaciones:</strong> {viewInfo.sensaciones}</p>
            )}
            <h4>Series registradas</h4>
            <ul>
              {viewInfo.series?.map((s, i) => (
                <li key={i}>{s.distancia}: {s.porcentaje}% → {s.sugerido}s</li>
              ))}
            </ul>
            {viewInfo.series?.length > 0 && (
              <p>
                <strong>Promedio sugerido series:</strong>{' '}
                {(viewInfo.series.reduce((a, s) => a + Number(s.sugerido || 0), 0) /
                  viewInfo.series.length).toFixed(2)}s
              </p>
            )}
            <h4>Promedios de repeticiones</h4>
            <ul>
              {viewInfo.promedios?.map((p, i) => (
                <li key={i}>{p.distancia}: {p.promedio}s</li>
              ))}
            </ul>
            {viewInfo.promedios?.length > 0 && (
              <p>
                <strong>Promedio de series:</strong>{' '}
                {(viewInfo.promedios.reduce((a, p) => a + Number(p.promedio || 0), 0) /
                  viewInfo.promedios.length).toFixed(2)}s
              </p>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
