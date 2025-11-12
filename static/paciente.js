function cargarPlantillas() {
  fetch(`/plantillas/${encodeURIComponent(KINESIOLOGA)}`)
    .then(res => {
      if (!res.ok) {
        throw new Error('Error al cargar plantillas');
      }
      return res.json();
    })
    .then(plantillas => {
      const ul = document.getElementById('listaPlantillas');
      ul.innerHTML = '';
      if (!Array.isArray(plantillas) || plantillas.length === 0) {
        ul.innerHTML = '<li style="text-align: center; color: #666;">No hay plantillas disponibles aún. Cree ejercicios para generar plantillas.</li>';
        return;
      }
      plantillas.forEach(p => {
        const li = document.createElement('li');
        const fecha = p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleDateString('es-ES') : '';
        // Crear elementos de forma segura para prevenir XSS
        const div = document.createElement('div');
        div.style.flex = '1';
        
        const strong = document.createElement('strong');
        strong.style.color = '#00796b';
        strong.textContent = p.nombre_ejercicio;
        div.appendChild(strong);
        div.appendChild(document.createElement('br'));
        
        const span1 = document.createElement('span');
        span1.style.color = '#666';
        span1.textContent = p.modo_ejecucion;
        div.appendChild(span1);
        div.appendChild(document.createElement('br'));
        
        const span2 = document.createElement('span');
        span2.style.color = '#004d40';
        const strong2 = document.createElement('strong');
        strong2.textContent = p.repeticiones;
        span2.appendChild(strong2);
        span2.appendChild(document.createTextNode(' reps × '));
        const strong3 = document.createElement('strong');
        strong3.textContent = p.series;
        span2.appendChild(strong3);
        span2.appendChild(document.createTextNode(' series'));
        div.appendChild(span2);
        
        if (fecha) {
          div.appendChild(document.createElement('br'));
          const small = document.createElement('small');
          small.style.color = '#999';
          small.textContent = 'Creada: ' + fecha;
          div.appendChild(small);
        }
        
        li.appendChild(div);
        const btn = document.createElement('button');
        btn.textContent = 'Asignar';
        btn.className = 'btn';
        btn.onclick = () => asignarPlantilla(p.id);
        li.appendChild(btn);
        ul.appendChild(li);
      });
    })
    .catch(err => {
      console.error('Error cargando plantillas:', err);
      const ul = document.getElementById('listaPlantillas');
      ul.innerHTML = '<li style="color: #d32f2f;">Error al cargar plantillas. Por favor, recargue la página.</li>';
    });
}

function cargarEjerciciosAsignados() {
  fetch(`/ejercicios/${encodeURIComponent(PACIENTE)}`)
    .then(res => res.json())
    .then(ejercicios => {
      const ul = document.getElementById('listaEjercicios');
      ul.innerHTML = '';
      if (!Array.isArray(ejercicios) || ejercicios.length === 0) {
        ul.innerHTML = '<li style="text-align: center; color: #666;">No hay ejercicios asignados aún</li>';
        return;
      }
      ejercicios.forEach(e => {
        const li = document.createElement('li');
        const fecha = e.fecha_asignacion ? new Date(e.fecha_asignacion).toLocaleDateString('es-ES') : 'Fecha no disponible';
        // Crear elementos de forma segura para prevenir XSS
        const div = document.createElement('div');
        div.style.flex = '1';
        
        const strong = document.createElement('strong');
        strong.style.color = '#00796b';
        strong.style.fontSize = '1.1em';
        strong.textContent = e.nombre_ejercicio;
        div.appendChild(strong);
        div.appendChild(document.createElement('br'));
        
        const span1 = document.createElement('span');
        span1.style.color = '#666';
        span1.textContent = e.modo_ejecucion;
        div.appendChild(span1);
        div.appendChild(document.createElement('br'));
        
        const span2 = document.createElement('span');
        span2.style.color = '#004d40';
        const strong2 = document.createElement('strong');
        strong2.textContent = e.repeticiones;
        span2.appendChild(strong2);
        span2.appendChild(document.createTextNode(' repeticiones × '));
        const strong3 = document.createElement('strong');
        strong3.textContent = e.series;
        span2.appendChild(strong3);
        span2.appendChild(document.createTextNode(' series'));
        div.appendChild(span2);
        div.appendChild(document.createElement('br'));
        
        const small = document.createElement('small');
        small.style.color = '#999';
        small.textContent = 'Asignado: ' + fecha;
        div.appendChild(small);
        
        li.appendChild(div);
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '5px';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.className = 'btn';
        editBtn.onclick = () => editarEjercicio(e.id, e.nombre_ejercicio, e.modo_ejecucion, e.repeticiones, e.series);
        
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Borrar';
        delBtn.className = 'btn btn-secondary';
        delBtn.onclick = () => borrarEjercicio(e.id);
        
        btnContainer.appendChild(editBtn);
        btnContainer.appendChild(delBtn);
        li.appendChild(btnContainer);
        ul.appendChild(li);
      });
    })
    .catch(err => {
      console.error('Error cargando ejercicios asignados:', err);
      const ul = document.getElementById('listaEjercicios');
      ul.innerHTML = '<li style="color: #d32f2f;">Error al cargar ejercicios. Por favor, recargue la página.</li>';
    });
}

function agregarEjercicioNuevo() {
  const nombre = document.getElementById('nombreEjercicio').value.trim();
  const modo = document.getElementById('modoEjecucion').value.trim();
  const reps = parseInt(document.getElementById('repeticiones').value);
  const ser = parseInt(document.getElementById('series').value);
  
  // Validaciones mejoradas
  if (!nombre || !modo) {
    alert('Complete todos los campos de texto');
    return;
  }
  
  if (isNaN(reps) || reps < 1 || reps > 1000) {
    alert('Las repeticiones deben ser un número entre 1 y 1000');
    return;
  }
  
  if (isNaN(ser) || ser < 1 || ser > 100) {
    alert('Las series deben ser un número entre 1 y 100');
    return;
  }
  
  // Deshabilitar botón mientras se procesa
  const btn = event?.target || document.querySelector('button[onclick*="agregarEjercicioNuevo"]');
  const originalText = btn ? btn.textContent : 'Agregar ejercicio';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Agregando...';
  }
  
  fetch('/ejercicio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kinesiologa: KINESIOLOGA,
      paciente: PACIENTE,
      nombre_ejercicio: nombre,
      modo_ejecucion: modo,
      repeticiones: reps,
      series: ser
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.error || 'Error al agregar ejercicio');
      });
    }
    return res.json();
  })
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    // Limpiar formulario
    document.getElementById('nombreEjercicio').value = '';
    document.getElementById('modoEjecucion').value = '';
    document.getElementById('repeticiones').value = '';
    document.getElementById('series').value = '';
    // Recargar datos
    cargarPlantillas();
    cargarEjerciciosAsignados();
    // Mostrar mensaje de éxito
    mostrarMensaje('Ejercicio agregado exitosamente', 'success');
  })
  .catch(err => {
    console.error('Error agregando ejercicio:', err);
    alert(err.message || 'Error al agregar ejercicio. Por favor, intente nuevamente.');
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function mostrarMensaje(mensaje, tipo = 'info') {
  const mensajeDiv = document.createElement('div');
  mensajeDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${tipo === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    border-radius: 6px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  mensajeDiv.textContent = mensaje;
  document.body.appendChild(mensajeDiv);
  
  setTimeout(() => {
    mensajeDiv.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => mensajeDiv.remove(), 300);
  }, 3000);
}

function asignarPlantilla(plantillaId) {
  fetch('/asignar_plantilla', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kinesiologa: KINESIOLOGA,
      paciente: PACIENTE,
      plantilla_id: parseInt(plantillaId)
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.error || 'Error al asignar plantilla');
      });
    }
    return res.json();
  })
  .then(data => {
    if (data.error) {
      alert(data.error);
    } else {
      cargarEjerciciosAsignados();
      mostrarMensaje('Plantilla asignada exitosamente', 'success');
    }
  })
  .catch(err => {
    console.error('Error asignando plantilla:', err);
    alert(err.message || 'Error al asignar plantilla. Por favor, intente nuevamente.');
  });
}

function editarEjercicio(id, nombre, modo, reps, ser) {
  document.getElementById('editNombreEjercicio').value = nombre;
  document.getElementById('editModoEjecucion').value = modo;
  document.getElementById('editRepeticiones').value = reps;
  document.getElementById('editSeries').value = ser;
  const form = document.getElementById('editarEjercicioForm');
  form.style.display = 'block';
  form.dataset.id = id;
}

function guardarEdicionEjercicio() {
  const form = document.getElementById('editarEjercicioForm');
  const id = form.dataset.id;
  const nombre = document.getElementById('editNombreEjercicio').value.trim();
  const modo = document.getElementById('editModoEjecucion').value.trim();
  const reps = parseInt(document.getElementById('editRepeticiones').value);
  const ser = parseInt(document.getElementById('editSeries').value);
  if (!nombre || !modo || !reps || !ser) {
    alert('Complete todos los campos');
    return;
  }
  fetch(`/ejercicio/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_ejercicio: nombre, modo_ejecucion: modo, repeticiones: reps, series: ser })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) { alert(data.error); return; }
    form.style.display = 'none';
    cargarEjerciciosAsignados();
  })
  .catch(err => console.error('Error editando ejercicio:', err));
}

function cancelarEdicion() {
  document.getElementById('editarEjercicioForm').style.display = 'none';
}

function borrarEjercicio(id) {
  if (!confirm('¿Seguro que desea borrar este ejercicio?')) return;
  fetch(`/ejercicio/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.error) { alert(data.error); return; }
      cargarEjerciciosAsignados();
    })
    .catch(err => console.error('Error borrando ejercicio:', err));
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarPlantillas();
  cargarEjerciciosAsignados();
});


