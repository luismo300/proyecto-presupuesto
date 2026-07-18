const API_BASE_URL = 'https://us54vdx1if.execute-api.us-east-1.amazonaws.com/dev'; 

// Variables Globales de Estado
let vistaActual = 'lista';
let datosGastos = [];
let datosPresupuestos = [];
let instGraficaGastos = null;
let instGraficaPresupuesto = null;

// --- MOTOR DE CARGA ASÍNCRONA DE COMPONENTES HTML ---
async function cargarComponente(idContenedor, rutaArchivo) {
    const respuesta = await fetch(rutaArchivo);
    if (!respuesta.ok) throw new Error(`No se pudo cargar el componente: ${rutaArchivo}`);
    const html = await respuesta.text();
    document.getElementById(idContenedor).innerHTML = html;
}

// Función Principal de Inicialización del Ciclo de Vida
window.onload = async () => {
    try {
        // 1. Cargar la interfaz por partes paralelamente
        await Promise.all([
            cargarComponente('componente-navbar', 'components/navbar.html'),
            cargarComponente('componente-indicadores', 'components/indicators.html'),
            cargarComponente('componente-formularios', 'components/forms.html'),
            cargarComponente('componente-visor', 'components/viewer.html')
        ]);

        // 2. Definir fechas por defecto en los inputs ya inyectados
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('gasto-fecha').value = hoy;
        document.getElementById('pres-fecha').value = hoy;

        // 3. Vincular los listeners del DOM
        inicializarEventosYFormularios();

        // 4. Solicitar datos iniciales a AWS Lambda
        await actualizarResumen();

    } catch (error) {
        console.error("Fallo crítico en la inicialización modular:", error);
    }
};

// --- CONFIGURACIÓN DINÁMICA DE EVENTOS ---
function inicializarEventosYFormularios() {
    // Pestanas de Formularios (Gasto / Presupuesto)
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

    // Conmutadores de Visores (Listado / Analíticas)
    document.getElementById('btn-switch-lista').addEventListener('click', () => cambiarVista('lista'));
    document.getElementById('btn-switch-grafica').addEventListener('click', () => cambiarVista('grafica'));

    // Envío del Formulario Gasto (POST)
    formGasto.addEventListener('submit', async (e) => {
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
            const r = await fetch(`${API_BASE_URL}/gasto`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (r.ok) {
                formGasto.reset();
                document.getElementById('gasto-fecha').value = new Date().toISOString().split('T')[0];
                actualizarResumen();
                mostrarToast('¡Gasto registrado con éxito!', 'success');
            } else {
                const err = await r.json(); mostrarToast(`Error: ${err.error}`, 'error');
            }
        } catch { mostrarToast('Error al conectar con API Gateway', 'error'); }
    });

    // Envío del Formulario Presupuesto (POST)
    formPresupuesto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            Nombre: document.getElementById('pres-nombre').value,
            Tipo: document.getElementById('pres-tipo').value,
            Monto: parseFloat(document.getElementById('pres-monto').value),
            Fecha: document.getElementById('pres-fecha').value,
            Detalle: document.getElementById('pres-detalle').value
        };
        try {
            const r = await fetch(`${API_BASE_URL}/presupuesto`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (r.ok) {
                formPresupuesto.reset();
                document.getElementById('pres-fecha').value = new Date().toISOString().split('T')[0];
                actualizarResumen();
                mostrarToast('¡Límite de presupuesto definido!', 'success');
            } else {
                const err = await r.json(); mostrarToast(`Error: ${err.error}`, 'error');
            }
        } catch { mostrarToast('Error al conectar con API Gateway', 'error'); }
    });
}

// --- MANEJO DE TOASTS ---
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

// --- CONMUTADOR DE VISTAS (LISTA/GRÁFICAS) ---
function cambiarVista(vista) {
    const btnSwitchLista = document.getElementById('btn-switch-lista');
    const btnSwitchGrafica = document.getElementById('btn-switch-grafica');
    const contenedorLista = document.getElementById('vista-lista');
    const contenedorGrafica = document.getElementById('vista-grafica');
    const tituloSeccion = document.getElementById('titulo-seccion');

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

// --- CONSUMO DE API (GET RESUMEN) ---
async function actualizarResumen() {
    try {
        const response = await fetch(`${API_BASE_URL}/resumen`);
        if (!response.ok) throw new Error('Error al consultar datos');
        const data = await response.json();

        datosGastos = data.lista_gastos || [];
        datosPresupuestos = data.lista_presupuestos || [];

        let presTotal = 0, presSemanal = 0, presMensual = 0, presAnual = 0;
        let gasTotal = 0, gasSemanal = 0, gasMensual = 0, gasAnual = 0;

        datosPresupuestos.forEach(p => {
            const m = parseFloat(p.Monto || 0); presTotal += m;
            if (p.Tipo === 'Semanal') presSemanal += m;
            else if (p.Tipo === 'Mensual') presMensual += m;
            else if (p.Tipo === 'Anual') presAnual += m;
        });

        datosGastos.forEach(g => {
            const m = parseFloat(g.Monto || 0); gasTotal += m;
            const freq = g.Periodo || 'Mensual'; 
            if (freq === 'Semanal') gasSemanal += m;
            else if (freq === 'Mensual') gasMensual += m;
            else if (freq === 'Anual') gasAnual += m;
        });

        document.getElementById('total-presupuesto').innerText = `$${presTotal.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        document.getElementById('total-gastos').innerText = `-$${gasTotal.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        actualizarEstiloBalance('balance-actual', presTotal - gasTotal);

        document.getElementById('semanal-presupuesto').innerText = `$${presSemanal.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        document.getElementById('semanal-gastos').innerText = `-$${gasSemanal.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        actualizarEstiloBalance('semanal-balance', presSemanal - gasSemanal);

        document.getElementById('mensual-presupuesto').innerText = `$${presMensual.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        document.getElementById('mensual-gastos').innerText = `-$${gasMensual.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        actualizarEstiloBalance('mensual-balance', presMensual - gasMensual);

        document.getElementById('anual-presupuesto').innerText = `$${presAnual.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        document.getElementById('anual-gastos').innerText = `-$${gasAnual.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
        actualizarEstiloBalance('anual-balance', presAnual - gasAnual);

        renderizarListas();

        if (vistaActual === 'grafica') {
            renderizarGraficas(presSemanal, presMensual, presAnual, gasSemanal, gasMensual, gasAnual);
        }
    } catch (err) { console.error("Error cargando resumen:", err); }
}

function actualizarEstiloBalance(id, bal) {
    const el = document.getElementById(id);
    el.innerText = `$${bal.toLocaleString('es-PA', {minimumFractionDigits: 2})}`;
    el.className = bal < 0 ? "text-sm font-extrabold text-rose-600" : "text-sm font-extrabold text-emerald-600";
}

// --- RENDERIZADO DE LISTADOS ---
function renderizarListas() {
    const contenedorGastos = document.getElementById('lista-gastos-contenedor');
    const contenedorPresupuestos = document.getElementById('lista-presupuestos-contenedor');

    if (datosGastos.length === 0) {
        contenedorGastos.innerHTML = `<div class="py-12 text-center text-slate-400 italic text-xs">No hay gastos.</div>`;
    } else {
        contenedorGastos.innerHTML = datosGastos.map(g => `
            <div class="group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-100 flex justify-between items-center transition-all relative pr-10 shadow-xs">
                <div>
                    <p class="font-bold text-slate-800 text-xs">${g.Nombre}</p>
                    <div class="flex gap-1 items-center mt-0.5">
                        <span class="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${g.Tipo}</span>
                        <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${g.Periodo || 'Mensual'}</span>
                        <span class="text-[9px] text-slate-400">${g.Fecha}</span>
                    </div>
                </div>
                <span class="font-extrabold text-rose-600 text-xs">-$${parseFloat(g.Monto).toFixed(2)}</span>
                <button onclick="eliminarGasto('${g.id_gasto}')" class="absolute right-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1 rounded-md hover:bg-rose-50">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `).join('');
    }

    if (datosPresupuestos.length === 0) {
        contenedorPresupuestos.innerHTML = `<div class="py-12 text-center text-slate-400 italic text-xs">No hay límites.</div>`;
    } else {
        contenedorPresupuestos.innerHTML = datosPresupuestos.map(p => `
            <div class="group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-xl border border-slate-100 flex justify-between items-center transition-all relative pr-10 shadow-xs">
                <div>
                    <p class="font-bold text-slate-800 text-xs">${p.Nombre}</p>
                    <div class="flex gap-1 items-center mt-0.5">
                        <span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase">${p.Tipo}</span>
                        <span class="text-[9px] text-slate-400">${p.Fecha}</span>
                    </div>
                </div>
                <span class="font-extrabold text-emerald-600 text-xs">+$${parseFloat(p.Monto).toFixed(2)}</span>
                <button onclick="eliminarPresupuesto('${p.id_presupuesto}')" class="absolute right-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1 rounded-md hover:bg-rose-50">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `).join('');
    }
}

// --- ACCIONES DELETE ---
async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
        const r = await fetch(`${API_BASE_URL}/gasto?id_gasto=${id}`, { method: 'DELETE' });
        if (r.ok) { actualizarResumen(); mostrarToast('Gasto eliminado correctamente', 'success'); }
    } catch { mostrarToast('Error de red', 'error'); }
}

async function eliminarPresupuesto(id) {
    if (!confirm('¿Eliminar este límite?')) return;
    try {
        const r = await fetch(`${API_BASE_URL}/presupuesto?id_presupuesto=${id}`, { method: 'DELETE' });
        if (r.ok) { actualizarResumen(); mostrarToast('Límite de presupuesto eliminado', 'success'); }
    } catch { mostrarToast('Error de red', 'error'); }
}

// --- RENDERIZADO DE GRÁFICAS (CHART.JS) ---
function renderizarGraficas(presS, presM, presA, gasS, gasM, gasA) {
    if (instGraficaGastos) instGraficaGastos.destroy();
    if (instGraficaPresupuesto) instGraficaPresupuesto.destroy();

    const catValores = {};
    datosGastos.forEach(g => { catValores[g.Tipo || 'Otros'] = (catValores[g.Tipo || 'Otros'] || 0) + parseFloat(g.Monto || 0); });

    instGraficaGastos = new Chart(document.getElementById('canvasGraficaGastos').getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(catValores),
            datasets: [{ data: Object.values(catValores), backgroundColor: ['#f43f5e', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'], borderWidth: 2, borderColor: '#ffffff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
    });

    instGraficaPresupuesto = new Chart(document.getElementById('canvasGraficaPresupuesto').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Semanal', 'Mensual', 'Anual'],
            datasets: [
                { label: 'Límite', data: [presS, presM, presA], backgroundColor: '#10b981', borderRadius: 6 },
                { label: 'Gasto', data: [gasS, gasM, gasA], backgroundColor: '#f43f5e', borderRadius: 6 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
    });
}