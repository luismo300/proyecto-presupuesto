
const API_BASE_URL = 'https://us54vdx1if.execute-api.us-east-1.amazonaws.com/dev'; 
let HOY = new Date();

// Variables Globales de Estado
let vistaActual = 'lista';
let datosGastos = [];
let datosPresupuestos = [];
let instGraficaGastos = null;
let instGraficaPresupuesto = null;

// --- INICIALIZACIÓN ÚNICA DEL SISTEMA ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Establecer fechas iniciales en los formularios
    const hoyISO = HOY.toISOString().split('T')[0];
    document.getElementById('gasto-fecha').value = hoyISO;
    document.getElementById('pres-fecha').value = hoyISO;

    // 2. Renderizar la fecha formateada en el Nav
    actualizarFechaNav();

    // 3. EVENTO CLIC: Desplegar el calendario nativo de forma confiable
    document.getElementById('contenedor-fecha').addEventListener('click', () => {
        const inputFecha = document.getElementById('cambiar-fecha-input');
        if (typeof inputFecha.showPicker === 'function') {
            inputFecha.showPicker();
        }
    });

    // 4. EVENTO CHANGE: Escuchar cuando el usuario seleccione una fecha diferente
    document.getElementById('cambiar-fecha-input').addEventListener('change', (e) => {
        if (e.target.value) {
            const [anio, mes, dia] = e.target.value.split('-');
            // Creamos la fecha ignorando zonas horarias locales para evitar desfases
            HOY = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
            
            actualizarFechaNav();
            // Llamamos a actualizarResumen para recalcular todo y renderizar
            actualizarResumen();
            mostrarToast(`Simulando entorno al: ${HOY.toLocaleDateString('es-ES')}`, 'success');
        }
    });

    // 5. Filtro de tiempo por rango (Semana, Mes, Año)
    document.getElementById('filtro-tiempo').addEventListener('change', filtrarYAplicarListas);

    // 6. Carga inicial de datos desde el Servidor
    actualizarResumen();
});

// --- FUNCIONES DE INTERFAZ Y FLUJO ---
function toggleDetails(id) {
    const detalles = document.getElementById(id);
    if (detalles.classList.contains('hidden')) {
        detalles.classList.remove('hidden');
        detalles.classList.add('flex');
    } else {
        detalles.classList.add('hidden');
        detalles.classList.remove('flex');
    }
}

function actualizarFechaNav() {
    const fechaTexto = HOY.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('fecha-actual').textContent = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
}

function sumarMontos(arr) {
    return arr.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0).toFixed(2);
}

function actualizarEstiloBalance(idElemento, balance) {
    const el = document.getElementById(idElemento);
    el.innerText = `$${balance.toLocaleString('es-PA', {minimumFractionDigits: 2, maximumFractionDigits:2})}`;
    if (balance < 0) {
        el.className = "text-lg font-extrabold text-rose-600";
    } else {
        el.className = "text-lg font-extrabold text-emerald-600";
    }
}

// --- SISTEMA DE PESTAÑAS (TABS) ---
const tabBtnGasto = document.getElementById('tab-btn-gasto');
const tabBtnPresupuesto = document.getElementById('tab-btn-presupuesto');
const formGasto = document.getElementById('form-gasto');
const formPresupuesto = document.getElementById('form-presupuesto');

tabBtnGasto.addEventListener('click', () => {
    tabBtnGasto.className = "w-1/2 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 bg-white text-rose-600 shadow-sm flex justify-center items-center gap-2";
    tabBtnGasto.querySelector('span').className = "w-2 h-2 rounded-full bg-rose-500";
    tabBtnPresupuesto.className = "w-1/2 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 text-slate-500 hover:text-slate-800 flex justify-center items-center gap-2";
    tabBtnPresupuesto.querySelector('span').className = "w-2 h-2 rounded-full bg-transparent";
    formGasto.classList.remove('hidden');
    formPresupuesto.classList.add('hidden');
});

tabBtnPresupuesto.addEventListener('click', () => {
    tabBtnPresupuesto.className = "w-1/2 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 bg-white text-emerald-600 shadow-sm flex justify-center items-center gap-2";
    tabBtnPresupuesto.querySelector('span').className = "w-2 h-2 rounded-full bg-emerald-500";
    tabBtnGasto.className = "w-1/2 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 text-slate-500 hover:text-slate-800 flex justify-center items-center gap-2";
    tabBtnGasto.querySelector('span').className = "w-2 h-2 rounded-full bg-transparent";
    formPresupuesto.classList.remove('hidden');
    formGasto.classList.add('hidden');
});

const btnSwitchLista = document.getElementById('btn-switch-lista');
const btnSwitchGrafica = document.getElementById('btn-switch-grafica');
const contenedorLista = document.getElementById('vista-lista');
const contenedorGrafica = document.getElementById('vista-grafica');
const tituloSeccion = document.getElementById('titulo-seccion');

function cambiarVista(vista) {
    if (vista === 'lista') {
        btnSwitchLista.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-indigo-600 shadow-xs";
        btnSwitchGrafica.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800";
        contenedorLista.classList.remove('hidden');
        contenedorGrafica.classList.add('hidden');
        tituloSeccion.innerText = 'Historial de Transacciones';
        vistaActual = 'lista';
    } else {
        btnSwitchGrafica.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-indigo-600 shadow-xs";
        btnSwitchLista.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800";
        contenedorLista.classList.add('hidden');
        contenedorGrafica.classList.remove('hidden');
        tituloSeccion.innerText = 'Distribución Visual de Recursos';
        vistaActual = 'grafica';
        actualizarResumen(); 
    }
}

btnSwitchLista.addEventListener('click', () => cambiarVista('lista'));
btnSwitchGrafica.addEventListener('click', () => cambiarVista('grafica'));

// --- COMUNICACIÓN CON EL SERVIDOR (API GATEWAY) ---
async function actualizarResumen() {
    try {
        const fechaFormateada = HOY.toISOString().split('T')[0];
        const response = await fetch(`${API_BASE_URL}/resumen?fecha=${fechaFormateada}`);
        if (!response.ok) throw new Error('Error al consultar datos');

        const data = await response.json();
        const { gastos, presupuestos, total_presupuesto, total_gastos, balance_general } = data.indicadores;

        // 1. Actualizar el Total
        document.getElementById('total-presupuesto').innerText = `$${total_presupuesto.toFixed(2)}`;
        document.getElementById('total-gastos').innerText = `-$${total_gastos.toFixed(2)}`;
        actualizarEstiloBalance('total-balance', balance_general);

        // 2. Actualizar UI de periodos
        const setUI = (p) => {
            const key = p.charAt(0).toUpperCase() + p.slice(1);
            const pVal = presupuestos[key];
            const gVal = gastos[key];
            
            document.getElementById(`${p}-presupuesto`).innerText = `$${pVal.toFixed(2)}`;
            document.getElementById(`${p}-gastos`).innerText = `-$${gVal.toFixed(2)}`;
            actualizarEstiloBalance(`${p}-balance`, pVal - gVal);
        };

        ['historico', 'semanal', 'mensual', 'anual'].forEach(setUI);

        // 3. Renderizado de listas y gráficas
        filtrarYAplicarListas(data.lista_gastos, data.lista_presupuestos);

        // Llamada a la gráfica pasando los indicadores extraídos
        renderizarGraficas(
            presupuestos.Semanal, presupuestos.Mensual, presupuestos.Anual,
            gastos.Semanal, gastos.Mensual, gastos.Anual,
            data.lista_gastos // Pasamos la lista para calcular el Pie Chart
        );
        
    } catch (err) {
        console.error("Error al cargar el resumen:", err);
    }
}

function filtrarYAplicarListas(gastos = datosGastos, presupuestos = datosPresupuestos) {
    const valor = document.getElementById('filtro-tiempo').value;

    // Usamos la variable global HOY
    const anioSeleccionado = HOY.getFullYear();
    const mesSeleccionado = HOY.getMonth();

    // Calcular inicio y fin de la semana de la fecha seleccionada
    let inicioSemana = new Date(HOY);
    inicioSemana.setDate(HOY.getDate() - HOY.getDay());
    inicioSemana.setHours(0, 0, 0, 0);

    let finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    // Función de filtrado
    const filtrar = (lista) => {
    return lista.filter(item => {
        if (!item.Fecha) return false;
        const fechaItem = parsearFechaLocal(item.Fecha);
        
        switch(valor) {
            case 'semanal':
                return fechaItem >= inicioSemana && fechaItem <= finSemana;
            case 'mensual':
                return fechaItem.getMonth() === mesSeleccionado && 
                        fechaItem.getFullYear() === anioSeleccionado;
            case 'anual':
                return fechaItem.getFullYear() === anioSeleccionado;
            default: // 'general'
                return true;
        }
    });
    };


    const gastosFiltrados = filtrar(gastos);
    const presupuestosFiltrados = filtrar(presupuestos);


    renderizarListas(gastosFiltrados, presupuestosFiltrados);
}


// Función global, accesible desde cualquier parte
function parsearFechaLocal(fechaStr) {
    if (!fechaStr) return new Date();
    // Separa el string YYYY-MM-DD
    const [anio, mes, dia] = fechaStr.split('-');
    // Crea la fecha de forma segura
    return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
}

function renderizarListas(gastos = datosGastos, presupuestos = datosPresupuestos) {

    const contenedoresGastos = document.querySelectorAll('#lista-gastos-contenedor');
    const contenedoresPresupuestos = document.querySelectorAll('#lista-presupuestos-contenedor');

    // 1. Renderizado de la columna de Gastos
    contenedoresGastos.forEach(contenedor => {
        if (gastos.length === 0) {
            contenedor.innerHTML = `<div class="py-6 text-center text-slate-400 italic text-xs">No hay gastos registrados.</div>`;
        } else {
            contenedor.innerHTML = gastos.map(g => `
                    <div class="group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-100 flex justify-between items-center transition-all relative pr-10 shadow-xs">
                        <div class="space-y-1">
                            <p class="font-bold text-slate-800 text-xs tracking-tight">${g.Nombre}</p>
                            <div class="flex flex-wrap gap-1 items-center">
                                <!-- Muestra la Categoría (Comida, Transporte...) -->
                                <span class="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${g.Tipo || 'Gastos'}</span>
                                <!-- Muestra la Frecuencia (Semanal, Mensual, Anual) -->
                                <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${g.Periodo || 'Mensual'}</span>
                                <span class="text-[9px] font-medium text-slate-400 ml-1">${g.Fecha}</span>
                            </div>
                            ${g.Detalle ? `<p class="text-[10px] text-slate-400 italic mt-1 bg-white border border-slate-100/80 rounded px-1.5 py-0.5 inline-block">"${g.Detalle}"</p>` : ''}
                        </div>
                        <span class="font-extrabold text-rose-600 text-xs">-$${parseFloat(g.Monto).toFixed(2)}</span>
                        <button onclick="eliminarGasto('${g.id_gasto}')" class="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all duration-150 p-1 rounded-md hover:bg-rose-50">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                `).join('');
        }
    });

// 2. Renderizado de la columna de Presupuestos (CORREGIDO)
contenedoresPresupuestos.forEach(contenedor => {
    if (presupuestos.length === 0) {
        contenedor.innerHTML = `<div class="py-6 text-center text-slate-400 italic text-xs">No hay límites fijados.</div>`;
    } else {
        contenedor.innerHTML = presupuestos.map(p => `
            <div class="group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-100 flex justify-between items-center transition-all relative pr-10 shadow-xs">
                <div class="space-y-1">
                    <p class="font-bold text-slate-800 text-xs tracking-tight">${p.Nombre}</p>
                    <div class="flex flex-wrap gap-1 items-center">
                        <!-- NUEVO: Muestra la Categoría asignada al presupuesto -->
                        <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${p.Tipo || 'General'}</span>
                        <!-- Muestra el Periodo Límite (Semanal, Mensual, Anual) -->
                        <span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${p.Periodo}</span>
                        <span class="text-[9px] font-medium text-slate-400 ml-1">${p.Fecha}</span>
                    </div>
                    ${p.Detalle ? `<p class="text-[10px] text-slate-400 italic mt-1 bg-white border border-slate-100/80 rounded px-1.5 py-0.5 inline-block">"${p.Detalle}"</p>` : ''}
                </div>
                <span class="font-extrabold text-emerald-600 text-xs">+$${parseFloat(p.Monto).toFixed(2)}</span>
                <button onclick="eliminarPresupuesto('${p.id_presupuesto}')" class="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all duration-150 p-1 rounded-md hover:bg-rose-50">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `).join('');
    }
});
}

async function eliminarGasto(idGasto) {
    if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/gasto?id_gasto=${idGasto}`, { method: 'DELETE' });
        if (response.ok) {
            actualizarResumen();
            mostrarToast('Gasto eliminado correctamente', 'success');
        } else {
            mostrarToast('Error al eliminar el recurso.', 'error');
        }
    } catch (err) {
        mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
}

async function eliminarPresupuesto(idPresupuesto) {
    if (!confirm('¿Estás seguro de que deseas eliminar este presupuesto?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/presupuesto?id_presupuesto=${idPresupuesto}`, { method: 'DELETE' });
        if (response.ok) {
            actualizarResumen();
            mostrarToast('Límite de presupuesto eliminado', 'success');
        } else {
            mostrarToast('Error al eliminar el límite.', 'error');
        }
    } catch (err) {
        mostrarToast('No se pudo conectar con el servidor.', 'error');
    }
}

// --- FORMULARIOS DE REGISTRO (POST) ---
document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        Nombre: document.getElementById('gasto-nombre').value,
        Tipo: document.getElementById('gasto-tipo').value,
        Periodo: document.getElementById('gasto-periodo').value,
        Monto: parseFloat(document.getElementById('gasto-monto').value),
        Fecha: document.getElementById('gasto-fecha').value,
        Detalle: document.getElementById('gasto-detalle').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/gasto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            document.getElementById('form-gasto').reset();
            document.getElementById('gasto-fecha').value = HOY.toISOString().split('T')[0];
            actualizarResumen();
            mostrarToast('¡Gasto registrado con éxito!', 'success');
        } else {
            mostrarToast('Error al guardar la transacción.', 'error');
        }
    } catch (err) {
        mostrarToast('Error al conectar con API Gateway', 'error');
    }
});

document.getElementById('form-presupuesto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        Nombre: document.getElementById('pres-nombre').value,
        Tipo: document.getElementById('pres-tipo').value,
        Periodo: document.getElementById('pres-periodo').value,
        Monto: parseFloat(document.getElementById('pres-monto').value),
        Fecha: document.getElementById('pres-fecha').value,
        Detalle: document.getElementById('pres-detalle').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/presupuesto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            document.getElementById('form-presupuesto').reset();
            document.getElementById('pres-fecha').value = HOY.toISOString().split('T')[0];
            actualizarResumen();
            mostrarToast('¡Límite de presupuesto definido!', 'success');
        } else {
            mostrarToast('No se pudo establecer el límite.', 'error');
        }
    } catch (err) {
        mostrarToast('Error al conectar con el backend', 'error');
    }
});

// --- GRÁFICAS (CHART.JS) ---
function renderizarGraficas(presS, presM, presA, gasS, gasM, gasA, listaGastosActual) {
    if (instGraficaGastos) instGraficaGastos.destroy();
    if (instGraficaPresupuesto) instGraficaPresupuesto.destroy();

    // Lógica para el gráfico de PIE (Gastos por categoría)
    const ctxGastos = document.getElementById('canvasGraficaGastos').getContext('2d');
    const catValores = {};
    listaGastosActual.forEach(g => {
        const categoria = g.Tipo || 'Otros';
        const monto = parseFloat(g.Monto || 0);
        catValores[categoria] = (catValores[categoria] || 0) + monto;
    });

    instGraficaGastos = new Chart(ctxGastos, {
        type: 'pie',
        data: {
            labels: Object.keys(catValores),
            datasets: [{
                data: Object.values(catValores),
                backgroundColor: ['#f43f5e', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, family: 'Plus Jakarta Sans' } } }
            }
        }
    });

    // Lógica para el gráfico de BARRAS (Comparativa Presupuesto vs Gasto)
    const ctxPresupuesto = document.getElementById('canvasGraficaPresupuesto').getContext('2d');
    instGraficaPresupuesto = new Chart(ctxPresupuesto, {
        type: 'bar',
        data: {
            labels: ['Semanal', 'Mensual', 'Anual'],
            datasets: [
                {
                    label: 'Límite Presupuestado',
                    data: [presS, presM, presA],
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Gasto Realizado',
                    data: [gasS, gasM, gasA],
                    backgroundColor: '#f43f5e',
                    borderRadius: 6
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 9, family: 'Plus Jakarta Sans' } } },
                x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Plus Jakarta Sans' } } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, family: 'Plus Jakarta Sans' } } }
            }
        }
    });
}

// --- SISTEMA DE NOTIFICACIONES TOAST ---
function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgClass = tipo === 'success' ? 'bg-emerald-600' : 'bg-rose-600';
    const icon = tipo === 'success' 
        ? `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0"/></svg>`
        : `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

    toast.className = `flex items-center gap-3 ${bgClass} text-white px-4 py-3 rounded-xl shadow-lg transform translate-y-8 opacity-0 transition-all duration-300 pointer-events-auto max-w-sm`;
    toast.innerHTML = `${icon}<span class="text-xs font-semibold">${mensaje}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-8', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-8', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
