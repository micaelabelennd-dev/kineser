let usuarioActual = null;
let tipoUsuarioActual = null;

function cambiarTipoUsuario() {
  const tipo = document.getElementById('tipoUsuario').value;
  const passwordContainer = document.getElementById('passwordContainer');
  const btnRegistrar = document.getElementById('btnRegistrar');
  const mensajeInfo = document.getElementById('mensajeInfo');
  const passwordInput = document.getElementById('passwordUsuario');
  
  if (tipo === 'kinesiologa') {
    passwordContainer.style.display = 'block';
    btnRegistrar.style.display = 'inline-block';
    passwordInput.required = true;
    passwordInput.setAttribute('required', 'required');
    // Cambiar placeholder según si está registrando o iniciando sesión
    if (passwordInput.value === '') {
      passwordInput.placeholder = 'Elija su contraseña (mínimo 4 caracteres)';
    }
    mensajeInfo.innerHTML = '⚠️ <strong>IMPORTANTE:</strong><br>• Si es la primera vez: Use "Registrar Nueva Kinesióloga" y <strong>elija su propia contraseña</strong>.<br>• Si ya está registrada: Use "Iniciar Sesión" con su nombre y la contraseña que eligió.';
    mensajeInfo.style.background = '#fff3cd';
    mensajeInfo.style.borderLeft = '4px solid #ffc107';
  } else {
    passwordContainer.style.display = 'none';
    btnRegistrar.style.display = 'none';
    passwordInput.required = false;
    passwordInput.removeAttribute('required');
    passwordInput.value = ''; // Limpiar contraseña al cambiar a paciente
    mensajeInfo.textContent = 'ℹ️ Los pacientes solo necesitan su nombre para acceder a sus ejercicios asignados.';
    mensajeInfo.style.background = '#e3f2fd';
    mensajeInfo.style.borderLeft = '4px solid #2196f3';
  }
}

function iniciarSesion() {
  const nombre = document.getElementById('nombreUsuario').value.trim();
  tipoUsuarioActual = document.getElementById('tipoUsuario').value;
  
  if (!nombre) {
    alert('⚠️ Por favor, ingrese su nombre');
    document.getElementById('nombreUsuario').focus();
    return;
  }

  if (tipoUsuarioActual === 'kinesiologa') {
    const password = document.getElementById('passwordUsuario').value;
    
    // Validación estricta de contraseña para kinesiólogas
    if (!password || password.length === 0) {
      alert('⚠️ ERROR: Debe ingresar su contraseña para iniciar sesión como kinesióloga.\n\nSi es la primera vez, use el botón "Registrar Nueva Kinesióloga" para crear su cuenta y elegir su contraseña.');
      document.getElementById('passwordUsuario').focus();
      return;
    }
    
    if (password.length < 4) {
      alert('⚠️ La contraseña debe tener al menos 4 caracteres');
      document.getElementById('passwordUsuario').focus();
      return;
    }
    
    // Deshabilitar botón mientras se procesa
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Iniciando sesión...';
    
    // Login de kinesióloga
    fetch('/login_kinesiologa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, password })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => {
          throw new Error(data.error || 'Error al iniciar sesión');
        });
      }
      return res.json();
    })
    .then(data => {
      if (data.error) {
        alert('❌ ' + data.error);
        return;
      }
      usuarioActual = nombre;
      mostrarPanelKinesiologa();
    })
    .catch(error => {
      console.error('Error en login:', error);
      alert('❌ ' + (error.message || 'Error al iniciar sesión. Verifique su nombre y contraseña.'));
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = originalText;
    });
  } else {
    // Login de paciente (sin contraseña)
    fetch('/registro_paciente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert('❌ ' + data.error);
        return;
      }
      usuarioActual = nombre;
      mostrarPanelPaciente();
    })
    .catch(error => {
      console.error('Error en registro:', error);
      alert('❌ Error al acceder');
    });
  }
}

function registrarUsuario() {
  const nombre = document.getElementById('nombreUsuario').value.trim();
  const password = document.getElementById('passwordUsuario').value;
  
  if (!nombre) {
    alert('⚠️ Por favor, ingrese un nombre');
    document.getElementById('nombreUsuario').focus();
    return;
  }
  
  if (!password || password.length < 4) {
    alert('⚠️ La contraseña es obligatoria y debe tener al menos 4 caracteres');
    document.getElementById('passwordUsuario').focus();
    return;
  }
  
  // Deshabilitar botón mientras se procesa
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Registrando...';
  
  // Registrar nueva kinesióloga
  fetch('/registro_kinesiologa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, password })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.error || 'Error al registrar');
      });
    }
    return res.json();
  })
  .then(data => {
    if (data.error) {
      alert('❌ ' + data.error);
      return;
    }
    let mensaje = '✅ Kinesióloga registrada exitosamente.\n\nSu cuenta ha sido creada con la contraseña que eligió.\n\nAhora puede usar el botón "Iniciar Sesión" con su nombre y la contraseña que acaba de definir.';
    if (data.kinesiologas_registradas && data.limite) {
      mensaje += `\n\n(Registradas: ${data.kinesiologas_registradas}/${data.limite})`;
    }
    alert(mensaje);
    // Limpiar solo la contraseña, mantener el nombre
    document.getElementById('passwordUsuario').value = '';
    // Cambiar placeholder para indicar que ahora debe usar la contraseña que eligió
    document.getElementById('passwordUsuario').placeholder = 'Ingrese la contraseña que eligió';
  })
  .catch(error => {
    console.error('Error en registro:', error);
    alert('❌ ' + (error.message || 'Error al registrar. El nombre ya podría estar en uso.'));
  })
  .finally(() => {
    btn.disabled = false;
    btn.textContent = originalText;
  });
}

function mostrarPanelKinesiologa() {
  document.getElementById('registro').style.display = 'none';
  document.getElementById('kinesiologaPanel').style.display = 'block';
  document.getElementById('nombreKinesiologa').textContent = usuarioActual;
  cargarPacientes();
  cargarPlantillas();  // Nueva: cargar plantillas al iniciar
}

function cargarPacientes() {
  fetch(`/pacientes/${encodeURIComponent(usuarioActual)}`)
    .then(res => res.json())
    .then(pacientes => {
      if (pacientes.error) {
        alert(pacientes.error);
        return;
      }
      const select = document.getElementById('listaPacientes');
      select.innerHTML = '<option value="">Seleccionar paciente</option>';  // Opción por defecto
      pacientes.forEach(p => {
        const option = document.createElement('option');
        option.value = p.nombre;
        option.textContent = p.nombre;
        select.appendChild(option);
      });
      // Poblar lista de gestión con botón borrar
      const ulPac = document.getElementById('listaPacientesGestion');
      if (ulPac) {
        ulPac.innerHTML = '';
        pacientes.forEach(p => {
          const li = document.createElement('li');
          li.textContent = p.nombre;
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Borrar';
          delBtn.onclick = () => borrarPaciente(p.nombre);
          li.appendChild(document.createTextNode(' '));
          li.appendChild(delBtn);
          ulPac.appendChild(li);
        });
      }
      cargarEjerciciosDePacienteSeleccionado();
    })
    .catch(error => console.error('Error cargando pacientes:', error));
}

// Nueva función: Cargar plantillas de la kinesiologa
function cargarPlantillas() {
  fetch(`/plantillas/${encodeURIComponent(usuarioActual)}`)
    .then(res => res.json())
    .then(plantillas => {
      if (plantillas.error) {
        alert(plantillas.error);
        return;
      }
      // Poblar select para asignar plantilla
      const select = document.getElementById('listaPlantillas');
      select.innerHTML = '<option value="">Seleccionar plantilla</option>';
      plantillas.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.nombre_ejercicio} (${p.repeticiones} reps, ${p.series} series)`;
        select.appendChild(option);
      });
      // Poblar lista de gestión
      const ul = document.getElementById('listaPlantillasGestion');
      ul.innerHTML = '';
      plantillas.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.nombre_ejercicio} - ${p.modo_ejecucion} (${p.repeticiones} reps, ${p.series} series)`;
        // Nota: textContent es seguro, no innerHTML
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.onclick = () => editarPlantilla(p.id, p.nombre_ejercicio, p.modo_ejecucion, p.repeticiones, p.series);
        li.appendChild(editBtn);
        ul.appendChild(li);
      });
    })
    .catch(error => console.error('Error cargando plantillas:', error));
}

// Nueva función: Cambiar entre nuevo ejercicio o plantilla
function cambiarTipoEjercicio() {
  const tipo = document.getElementById('tipoEjercicio').value;
  document.getElementById('nuevoEjercicio').style.display = tipo === 'nuevo' ? 'block' : 'none';
  document.getElementById('seleccionarPlantilla').style.display = tipo === 'plantilla' ? 'block' : 'none';
}

// Nueva función: abrir pantalla de gestión por paciente
function abrirGestionPaciente() {
  const paciente = document.getElementById('listaPacientes').value;
  if (!paciente) { alert('Selecciona un paciente'); return; }
  window.location.href = `/gestionar/${encodeURIComponent(usuarioActual)}/${encodeURIComponent(paciente)}`;
}

// Nueva función: abrir pantalla de gestión de plantillas
function abrirGestionPlantillas() {
  window.location.href = `/gestionar_plantillas/${encodeURIComponent(usuarioActual)}`;
}

function cargarEjerciciosDePacienteSeleccionado() {
  const paciente = document.getElementById('listaPacientes').value;
  if (!paciente) {
    // No hace nada aquí, gestión es en otra pantalla
    return;
  }
  // La visualización se trasladó a gestionar.html
}

// Renombrada: Agregar ejercicio nuevo (crea plantilla si no existe)
function agregarEjercicioNuevo() {
  const paciente = document.getElementById('listaPacientes').value;
  const nombreEjercicio = document.getElementById('nombreEjercicio').value.trim();
  const modoEjecucion = document.getElementById('modoEjecucion').value.trim();
  const repeticiones = parseInt(document.getElementById('repeticiones').value);
  const series = parseInt(document.getElementById('series').value);

  if (!paciente || !nombreEjercicio || !modoEjecucion || !repeticiones || !series) {
    alert('Complete todos los campos');
    return;
  }

  fetch('/ejercicio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kinesiologa: usuarioActual,
      paciente,
      nombre_ejercicio: nombreEjercicio,
      modo_ejecucion: modoEjecucion,
      repeticiones,
      series
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
    } else {
      // Limpiar campos
      document.getElementById('nombreEjercicio').value = '';
      document.getElementById('modoEjecucion').value = '';
      document.getElementById('repeticiones').value = '';
      document.getElementById('series').value = '';
      cargarEjerciciosDePacienteSeleccionado();
      cargarPlantillas();  // Recargar plantillas por si se creó una nueva
    }
  })
  .catch(error => console.error('Error agregando ejercicio:', error));
}

// Alta de paciente (desde panel kinesiologa)
function agregarPaciente() {
  const nombre = document.getElementById('nuevoPacienteNombre').value.trim();
  if (!nombre) {
    alert('⚠️ Por favor, ingrese el nombre del paciente');
    document.getElementById('nuevoPacienteNombre').focus();
    return;
  }
  
  // Deshabilitar botón mientras se procesa
  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Agregando...';
  
  fetch('/registro_paciente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.error || 'Error al agregar paciente');
      });
    }
    return res.json();
  })
  .then(data => {
    if (data.error) {
      alert('❌ ' + data.error);
      return;
    }
    document.getElementById('nuevoPacienteNombre').value = '';
    cargarPacientes();
    alert('✅ Paciente agregado exitosamente');
  })
  .catch(err => {
    console.error('Error agregando paciente:', err);
    alert('❌ ' + (err.message || 'Error al agregar paciente. El nombre ya podría estar en uso.'));
  })
  .finally(() => {
    btn.disabled = false;
    btn.textContent = originalText;
  });
}

// Baja de paciente (y sus ejercicios)
function borrarPaciente(nombre) {
  if (!confirm(`¿Seguro que desea borrar al paciente "${nombre}" y sus ejercicios?`)) return;
  fetch(`/paciente/${encodeURIComponent(nombre)}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        // Si el paciente borrado estaba seleccionado, limpiar selección
        const select = document.getElementById('listaPacientes');
        if (select && select.value === nombre) {
          select.value = '';
          document.getElementById('listaEjerciciosKinesiologa').innerHTML = '<li>Selecciona un paciente</li>';
        }
        cargarPacientes();
      }
    })
    .catch(err => console.error('Error borrando paciente:', err));
}

// Nueva función: Asignar plantilla existente a paciente
function asignarPlantilla() {
  const paciente = document.getElementById('listaPacientes').value;
  const plantillaId = document.getElementById('listaPlantillas').value;
  if (!paciente || !plantillaId) {
    alert('Selecciona paciente y plantilla');
    return;
  }

  fetch('/asignar_plantilla', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kinesiologa: usuarioActual,
      paciente,
      plantilla_id: parseInt(plantillaId)
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
    } else {
      alert('Plantilla asignada');
      cargarEjerciciosDePacienteSeleccionado();
    }
  })
  .catch(error => console.error('Error asignando plantilla:', error));
}

// Nueva función: Editar ejercicio asignado
function editarEjercicio(id, nombre, modo, reps, ser) {
  document.getElementById('editNombreEjercicio').value = nombre;
  document.getElementById('editModoEjecucion').value = modo;
  document.getElementById('editRepeticiones').value = reps;
  document.getElementById('editSeries').value = ser;
  document.getElementById('editarEjercicioForm').style.display = 'block';
  document.getElementById('editarEjercicioForm').dataset.id = id;  // Guardar ID
}

// Nueva función: Guardar edición de ejercicio
function guardarEdicionEjercicio() {
  const id = document.getElementById('editarEjercicioForm').dataset.id;
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
    body: JSON.stringify({
      nombre_ejercicio: nombre,
      modo_ejecucion: modo,
      repeticiones: reps,
      series: ser
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
    } else {
      alert('Ejercicio editado');
      document.getElementById('editarEjercicioForm').style.display = 'none';
      cargarEjerciciosDePacienteSeleccionado();
    }
  })
  .catch(error => console.error('Error editando ejercicio:', error));
}

// Nueva función: Editar plantilla
function editarPlantilla(id, nombre, modo, reps, ser) {
  document.getElementById('editPlantillaNombre').value = nombre;
  document.getElementById('editPlantillaModo').value = modo;
  document.getElementById('editPlantillaRepeticiones').value = reps;
  document.getElementById('editPlantillaSeries').value = ser;
  document.getElementById('editarPlantillaForm').style.display = 'block';
  document.getElementById('editarPlantillaForm').dataset.id = id;
}

// Nueva función: Guardar edición de plantilla
function guardarEdicionPlantilla() {
  const id = document.getElementById('editarPlantillaForm').dataset.id;
  const nombre = document.getElementById('editPlantillaNombre').value.trim();
  const modo = document.getElementById('editPlantillaModo').value.trim();
  const reps = parseInt(document.getElementById('editPlantillaRepeticiones').value);
  const ser = parseInt(document.getElementById('editPlantillaSeries').value);
  if (!nombre || !modo || !reps || !ser) {
    alert('Complete todos los campos');
    return;
  }

  fetch(`/plantilla/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre_ejercicio: nombre,
      modo_ejecucion: modo,
      repeticiones: reps,
      series: ser
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
    } else {
      alert('Plantilla editada');
      document.getElementById('editarPlantillaForm').style.display = 'none';
      cargarPlantillas();
    }
  })
  .catch(error => console.error('Error editando plantilla:', error));
}

// Nueva función: Cancelar edición
function cancelarEdicion() {
  document.getElementById('editarEjercicioForm').style.display = 'none';
  document.getElementById('editarPlantillaForm').style.display = 'none';
}

function borrarEjercicio(id) {
  if (!confirm('¿Seguro que desea borrar este ejercicio?')) return;
  fetch(`/ejercicio/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        cargarEjerciciosDePacienteSeleccionado();
      }
    })
    .catch(error => console.error('Error borrando ejercicio:', error));
}

function mostrarPanelPaciente() {
  document.getElementById('registro').style.display = 'none';
  document.getElementById('pacientePanel').style.display = 'block';
  document.getElementById('nombrePaciente').textContent = usuarioActual;
  cargarEjercicios();
  // Actualizar ejercicios cada 30 segundos para reflejar cambios
  setInterval(cargarEjercicios, 30000);
}

function cargarEjercicios() {
  fetch(`/ejercicios/${encodeURIComponent(usuarioActual)}`)
    .then(res => res.json())
    .then(ejercicios => {
      if (ejercicios.error) {
        alert(ejercicios.error);
        return;
      }
      const ul = document.getElementById('listaEjercicios');
      ul.innerHTML = '';
      if (!Array.isArray(ejercicios) || ejercicios.length === 0) {
        ul.innerHTML = '<li style="text-align: center; color: #666; padding: 20px;">No hay ejercicios asignados aún. Su kinesióloga le asignará ejercicios pronto.</li>';
        return;
      }
      
      // Agregar resumen
      const totalEjercicios = ejercicios.length;
      const resumen = document.createElement('div');
      resumen.style.cssText = 'background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;';
      const strong = document.createElement('strong');
      strong.textContent = `Total de ejercicios asignados: ${totalEjercicios}`;
      resumen.appendChild(strong);
      ul.appendChild(resumen);
      
      ejercicios.forEach(e => {
        const li = document.createElement('li');
        const fecha = e.fecha_asignacion ? new Date(e.fecha_asignacion).toLocaleDateString('es-ES') : '';
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
        
        if (fecha) {
          div.appendChild(document.createElement('br'));
          const small = document.createElement('small');
          small.style.color = '#999';
          small.textContent = 'Asignado: ' + fecha;
          div.appendChild(small);
        }
        
        li.appendChild(div);
        ul.appendChild(li);
      });
    })
    .catch(error => {
      console.error('Error cargando ejercicios:', error);
      const ul = document.getElementById('listaEjercicios');
      ul.innerHTML = '<li style="color: #d32f2f;">Error al cargar ejercicios. Por favor, recargue la página.</li>';
    });
}

function volverAlInicio() {
  // Cerrar sesión
  if (tipoUsuarioActual === 'kinesiologa') {
    fetch('/logout', { method: 'POST' })
      .catch(err => console.error('Error al cerrar sesión:', err));
  }
  
  // Mostrar registro y ocultar paneles
  document.getElementById('registro').style.display = 'block';
  document.getElementById('kinesiologaPanel').style.display = 'none';
  document.getElementById('pacientePanel').style.display = 'none';
  // Reset de estado
  usuarioActual = null;
  tipoUsuarioActual = null;
  document.getElementById('nombreUsuario').value = '';
  document.getElementById('passwordUsuario').value = '';
  document.getElementById('listaPacientes').innerHTML = '';
  document.getElementById('listaEjerciciosKinesiologa').innerHTML = '';
  document.getElementById('listaEjercicios').innerHTML = '';
  // Ocultar formularios de edición
  document.getElementById('editarEjercicioForm').style.display = 'none';
  document.getElementById('editarPlantillaForm').style.display = 'none';
}

// Función para cargar y mostrar lista de kinesiólogas (solo para administración)
function cargarKinesiologas() {
  fetch('/admin/kinesiologas', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.error || 'Error al cargar kinesiólogas');
      });
    }
    return res.json();
  })
  .then(data => {
    const container = document.getElementById('listaKinesiologas');
    container.innerHTML = '';
    
    if (!data.kinesiologas || data.kinesiologas.length === 0) {
      container.innerHTML = '<p style="color: #666; padding: 10px;">No hay kinesiólogas registradas.</p>';
      return;
    }
    
    // Mostrar resumen
    const resumen = document.createElement('div');
    resumen.style.cssText = 'background: #fff3cd; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #ff9800;';
    const strong = document.createElement('strong');
    strong.textContent = `Total registradas: ${data.total}/${data.limite}`;
    resumen.appendChild(strong);
    container.appendChild(resumen);
    
    // Lista de kinesiólogas
    const ul = document.createElement('ul');
    ul.style.marginTop = '10px';
    
    data.kinesiologas.forEach(kin => {
      const li = document.createElement('li');
      const esMiCuenta = kin.nombre === usuarioActual;
      
      // Crear elementos de forma segura
      const div = document.createElement('div');
      div.style.flex = '1';
      
      const strong = document.createElement('strong');
      strong.style.color = '#00796b';
      strong.textContent = kin.nombre;
      div.appendChild(strong);
      
      if (esMiCuenta) {
        const span = document.createElement('span');
        span.style.color = '#4caf50';
        span.style.marginLeft = '10px';
        span.textContent = '(Su cuenta)';
        div.appendChild(span);
      }
      
      li.appendChild(div);
      
      // Solo mostrar botón eliminar si no es su propia cuenta
      if (!esMiCuenta) {
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Eliminar';
        delBtn.className = 'btn btn-secondary';
        delBtn.style.backgroundColor = '#f44336';
        delBtn.onclick = () => eliminarKinesiologa(kin.id, kin.nombre);
        li.appendChild(delBtn);
      } else {
        const infoSpan = document.createElement('span');
        infoSpan.textContent = 'No puede eliminar su propia cuenta';
        infoSpan.style.color = '#999';
        infoSpan.style.fontSize = '0.9em';
        li.appendChild(infoSpan);
      }
      
      ul.appendChild(li);
    });
    
    container.appendChild(ul);
  })
  .catch(error => {
    console.error('Error cargando kinesiólogas:', error);
    const container = document.getElementById('listaKinesiologas');
    const p = document.createElement('p');
    p.style.color = '#d32f2f';
    p.style.padding = '10px';
    p.textContent = '❌ ' + (error.message || 'Error al cargar kinesiólogas');
    container.appendChild(p);
  });
}

// Función para eliminar una kinesióloga
function eliminarKinesiologa(id, nombre) {
  if (!confirm(`⚠️ ¿Está segura de que desea eliminar a la kinesióloga "${nombre}"?\n\nEsta acción eliminará:\n• Todos sus ejercicios asignados\n• Todas sus plantillas\n• Su cuenta de kinesióloga\n\nEsta acción NO se puede deshacer.`)) {
    return;
  }
  
  fetch(`/admin/kinesiologa/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(data => {
        throw new Error(data.error || 'Error al eliminar kinesióloga');
      });
    }
    return res.json();
  })
  .then(data => {
    if (data.error) {
      alert('❌ ' + data.error);
      return;
    }
    alert('✅ ' + (data.mensaje || 'Kinesióloga eliminada exitosamente'));
    cargarKinesiologas(); // Recargar lista
  })
  .catch(error => {
    console.error('Error eliminando kinesióloga:', error);
    alert('❌ ' + (error.message || 'Error al eliminar kinesióloga'));
  });
}

// Verificar si hay sesión activa al cargar la página
function verificarSesionActiva() {
  if (window.location.pathname === '/') {
    fetch('/verificar_sesion')
      .then(res => res.json())
      .then(data => {
        if (data.autenticada && data.tipo === 'kinesiologa') {
          usuarioActual = data.nombre;
          tipoUsuarioActual = 'kinesiologa';
          mostrarPanelKinesiologa();
        }
      })
      .catch(err => {
        console.log('No hay sesión activa o error al verificar:', err);
      });
  }
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  cambiarTipoUsuario();
  verificarSesionActiva();
});
