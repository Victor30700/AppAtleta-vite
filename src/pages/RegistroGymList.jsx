import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import styles from '../styles/RegistroGymList.module.css';

export default function RegistroGymList() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const auth = getAuth();
  const user = auth.currentUser;

  const cargarRegistros = async () => {
    if (!user) return;
    const snapshot = await getDocs(collection(db, 'registrosGym'));
    const datos = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => doc.email === user.email); // Solo registros del usuario actual
    setRegistros(datos);
  };

  useEffect(() => {
    cargarRegistros();
  }, [user]);

  const filtrados = registros.filter(r => {
    const fecha = new Date(r.fechaInicio);
    const mes = fecha.getMonth() + 1;
    const anio = fecha.getFullYear();
    const filtroMesAnio = `${anio}-${mes.toString().padStart(2, '0')}`;
    return filtroMesAnio.includes(busqueda);
  });

  const handleEliminar = async id => {
    const confirmacion = window.confirm('¿Estás seguro de que deseas eliminar este registro?');
    if (confirmacion) {
      await deleteDoc(doc(db, 'registrosGym', id));
      setRegistros(registros.filter(r => r.id !== id));
    }
  };

  return (
    <div className={styles.listaWrapper}>
      <div className={styles.listaContainer}>
        <div className={styles.listaHeader}>
          <button className={styles.btn} onClick={() => navigate('/home')}>
            Volver
          </button>
          <button className={styles.btn} onClick={() => navigate('/registro-gym/nuevo')}>
            Nuevo Registro
          </button>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="busqueda">Buscar por mes y año</label>
          <input
            id="busqueda"
            type="month"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <div className={styles.listaItems}>
          {filtrados.map(reg => (
            <div key={reg.id} className={styles.listaItem}>
              <div><strong>Inicio:</strong> {reg.fechaInicio}</div>
              <div><strong>Fin:</strong> {reg.fechaFin}</div>
              <div>
                <strong>Peso:</strong> {reg.peso}kg,{' '}
                <strong>Porcentaje:</strong> {reg.porcentaje}%,{' '}
                <strong>Resultado:</strong> {reg.resultado}kg
              </div>
              <div><strong>Repeticiones:</strong> {reg.repeticiones}</div>
              {reg.descripcion && <div><strong>Descripción:</strong> {reg.descripcion}</div>}
              <div className={styles.actions}>
                <button
                  className={styles.btn}
                  onClick={() => navigate(`/registro-gym/nuevo?id=${reg.id}`)}
                >
                  Editar
                </button>
                <button
                  className={styles.btn}
                  onClick={() => handleEliminar(reg.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
