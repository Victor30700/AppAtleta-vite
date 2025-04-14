import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getLatestTime } from '../utils/controlesUtils';
import ModalPB from '../components/ModalPB';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/ControlesPB.css';
import { FiArrowLeft } from 'react-icons/fi';

export default function ControlesPB() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [distancia, setDistancia] = useState('');
  const [unidad, setUnidad] = useState('m');
  const [tiempo, setTiempo] = useState('');
  const [fecha, setFecha] = useState(null);
  const [sensaciones, setSensaciones] = useState('');
  const [controles, setControles] = useState({});

  const [modalType, setModalType] = useState(null);
  const [modalData, setModalData] = useState({});

  const docRef = user?.email && doc(db, 'controlesPB', user.email);

  useEffect(() => {
    if (!loading && user?.email) loadControles();
  }, [user, loading]);

  async function loadControles() {
    const snap = await getDoc(docRef);
    setControles(snap.exists() ? snap.data() : {});
  }

  const guardarControl = async () => {
    if (!distancia || !tiempo) return alert('Completa distancia y tiempo');
    const fechaStr = fecha
      ? fecha.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const key = `${distancia}${unidad}`;
    const nuevo = {
      fecha: fechaStr,
      tiempo: parseFloat(tiempo),
      sensaciones: sensaciones.trim() || null
    };

    const data = { ...controles };
    const arr = data[key] ? [nuevo, ...data[key]] : [nuevo];
    data[key] = arr;
    await setDoc(docRef, data);
    resetForm();
    loadControles();
  };

  const resetForm = () => {
    setDistancia('');
    setTiempo('');
    setFecha(null);
    setSensaciones('');
  };

  const openEditModal = (key, idx) => {
    setModalType('edit');
    setModalData({ key, idx, ...controles[key][idx] });
  };
  const openDeleteModal = (key, idx) => {
    setModalType('delete');
    setModalData({ key, idx });
  };
  const closeModal = () => setModalType(null);

  const handleEdit = async () => {
    const { key, idx, fecha: oldFecha, tiempo: oldTiempo, sensaciones: oldSensaciones } = modalData;
    const newFecha = modalData.newFecha
      ? modalData.newFecha.toISOString().split('T')[0]
      : oldFecha;
    const newTiempo = parseFloat(modalData.newTiempo ?? oldTiempo);
    const newSensaciones = modalData.newSensaciones ?? oldSensaciones;

    const arr = [...controles[key]];
    arr[idx] = {
      fecha: newFecha,
      tiempo: newTiempo,
      sensaciones: newSensaciones?.trim() || null
    };

    const data = { ...controles, [key]: arr };
    await setDoc(docRef, data);
    closeModal();
    loadControles();
  };

  const handleDelete = async () => {
    const { key, idx } = modalData;
    const arr = [...controles[key]];
    arr.splice(idx, 1);
    const data = { ...controles };
    if (arr.length) data[key] = arr;
    else delete data[key];
    await setDoc(docRef, data);
    closeModal();
    loadControles();
  };

  if (loading) return <p className="controles-empty">Cargando...</p>;
  if (!user) return <p className="controles-empty">Acceso denegado</p>;

  return (
    <div className="controles-container">
      <button className="back-button" onClick={() => navigate('/home')}>
        <FiArrowLeft /> Volver
      </button>
      <h2 className="controles-title">Controles PB</h2>

      {/* Formulario */}
      <div className="controles-form">
        <input
          type="text"
          placeholder="Distancia (ej. 60)"
          value={distancia}
          onChange={e => setDistancia(e.target.value)}
        />
        <select value={unidad} onChange={e => setUnidad(e.target.value)}>
          <option value="m">m</option>
          <option value="km">km</option>
        </select>
        <input
          type="number"
          placeholder="Tiempo (s)"
          value={tiempo}
          onChange={e => setTiempo(e.target.value)}
        />
        <DatePicker
          selected={fecha}
          onChange={date => setFecha(date)}
          placeholderText="Fecha (opcional)"
          className="datepicker-input"
        />

        {/* Campo sensaciones */}
        <textarea
          placeholder="Describe tus sensaciones (opcional)"
          value={sensaciones}
          onChange={e => setSensaciones(e.target.value)}
          className="textarea-sensaciones"
        />

        <button onClick={guardarControl}>Guardar</button>
      </div>

      {/* Lista de registros */}
      {Object.keys(controles).length === 0 ? (
        <p className="controles-empty">No hay registros aún.</p>
      ) : (
        <div className="controles-list">
          {Object.entries(controles).map(([key, registros]) => {
            const sorted = [...registros].sort((a, b) =>
              b.fecha.localeCompare(a.fecha)
            );
            const latest = getLatestTime(key, controles);
            return (
              <div key={key} className="controles-distance">
                <div className="controles-distance-header">
                  <h3>{key}</h3>
                  <span>Último: {latest ? `${latest}s` : '-'}</span>
                </div>
                <ul>
                  {sorted.map((r, idx) => (
                    <li key={idx} className="controles-item">
                      <span>
                        {r.fecha} — {r.tiempo}s
                        {r.sensaciones && (
                          <div className="sensaciones-text">
                            <strong>Sensaciones:</strong> {r.sensaciones}
                          </div>
                        )}
                      </span>
                      <span className="actions">
                        <button onClick={() => openEditModal(key, idx)}>Editar</button>
                        <button onClick={() => openDeleteModal(key, idx)}>Eliminar</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {modalType === 'edit' && (
        <ModalPB isOpen onRequestClose={closeModal} title="Editar Registro">
          <div className="mb-2">
            <label>Fecha:</label>
            <DatePicker
              selected={modalData.newFecha || new Date(modalData.fecha)}
              onChange={date => setModalData(d => ({ ...d, newFecha: date }))}
            />
          </div>
          <div className="mb-2">
            <label>Tiempo (s):</label>
            <input
              type="number"
              value={modalData.newTiempo ?? modalData.tiempo}
              onChange={e => setModalData(d => ({ ...d, newTiempo: e.target.value }))}
            />
          </div>
          <div className="mb-2">
            <label>Sensaciones:</label>
            <textarea
              value={modalData.newSensaciones ?? modalData.sensaciones ?? ''}
              onChange={e => setModalData(d => ({ ...d, newSensaciones: e.target.value }))}
              className="textarea-sensaciones"
            />
          </div>
          <button className="modal-action" onClick={handleEdit}>
            Guardar Cambios
          </button>
        </ModalPB>
      )}

      {modalType === 'delete' && (
        <ModalPB isOpen onRequestClose={closeModal} title="Eliminar Registro">
          <p>¿Seguro que deseas eliminar este registro?</p>
          <button className="modal-action danger" onClick={handleDelete}>
            Sí, eliminar
          </button>
        </ModalPB>
      )}
    </div>
  );
}
