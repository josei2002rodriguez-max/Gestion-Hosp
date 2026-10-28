// =========================================================================
// MEDIPISO v3.0 — MOTOR PRINCIPAL (JERARQUÍA, NUMERACIÓN 1..N, TRASLADOS Y PWA)
// =========================================================================

const STORAGE_KEY_V2 = "medipiso_hospital_state_v2";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby9aSi54X_TvzqXTChnq5k_CSrR--8fSEiRJJjwcfzjt6vD3fA7RlOdubvreja-GYo/exec";

let appState = null;
let currentEditingRef = null; // { serviceId, roomId, bedId }
let currentShareRef = null;   // { serviceId, roomId, bedId }
let currentMoveOriginRef = null; // { serviceId, roomId, bedId }

let modalTempPathogens = [];
let modalTempAtbs = [];
let modalTempDevices = [];
let modalTempTasks = [];
let modalTempMilestones = [];
let parsedImportPatientData = null;
let deferredPwaPrompt = null;

// =========================================================================
// 1. INICIALIZACIÓN, MIGRACIÓN Y PERSISTENCIA
// =========================================================================
function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.services) && parsed.services.length > 0) {
        appState = parsed;
        if (!appState.navState) {
          appState.navState = {
            level: "services",
            selectedServiceId: appState.services[0].id,
            selectedRoomId: appState.services[0].rooms[0]?.id || "",
            showAllRoomsBedsInService: false
          };
        }
        return;
      }
    }
  } catch (err) {
    console.error("Error cargando estado v2:", err);
  }
  appState = generateDefaultHospitalState();
  saveAppState();
}

function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(appState));
  } catch (err) {
    console.error("Error guardando estado v2:", err);
  }
}

// =========================================================================
// 2. NUMERACIÓN CORRELATIVA DE CAMAS POR SERVICIO (EJ: CIRUGÍA 1 A 55)
// =========================================================================
function recalculateServiceBedNumbers(serviceId) {
  const srv = appState.services.find(s => s.id === serviceId);
  if (!srv || !srv.continuousNumbering) return;

  let counter = Number(srv.startBedNumber || 1);
  srv.rooms.forEach(room => {
    room.beds.forEach(bed => {
      bed.number = counter;
      bed.code = `Cama ${counter}`;
      counter++;
    });
  });
}

function getRoomBedRangeText(room) {
  if (!room.beds || room.beds.length === 0) return "Sin camas";
  const first = room.beds[0].number || room.beds[0].code;
  const last = room.beds[room.beds.length - 1].number || room.beds[room.beds.length - 1].code;
  if (room.beds.length === 1) return `Cama ${first}`;
  return `Camas ${first} a la ${last}`;
}

function findEntity(serviceId, roomId, bedId) {
  const service = appState.services.find(s => s.id === serviceId);
  if (!service) return null;
  if (!roomId) return { service };
  const room = service.rooms.find(r => r.id === roomId);
  if (!room) return null;
  if (!bedId) return { service, room };
  const bed = room.beds.find(b => b.id === bedId);
  return bed ? { service, room, bed } : null;
}

function getServiceById(serviceId) {
  return appState.services.find(s => s.id === serviceId) || null;
}

// =========================================================================
// 3. UTILIDADES VISUALES Y HELPERS
// =========================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  const colors = {
    success: "bg-slate-900 dark:bg-teal-600 text-white",
    info: "bg-indigo-600 text-white",
    warning: "bg-amber-600 text-white",
    danger: "bg-rose-600 text-white"
  };
  el.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2 pointer-events-auto transition-all duration-300 ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 250);
  }, 3000);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function getIsolationMeta(type) {
  const map = {
    none: { label: "Sin aislamiento", short: "", badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", borderClass: "" },
    contacto: { label: "Aislamiento Contacto", short: "Contacto", badgeClass: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/90 dark:text-amber-200 dark:border-amber-700", borderClass: "ring-2 ring-amber-400/80" },
    gotitas: { label: "Aislamiento Gotitas", short: "Gotitas", badgeClass: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/90 dark:text-sky-200 dark:border-sky-700", borderClass: "ring-2 ring-sky-400/80" },
    aereo: { label: "Aislamiento Aéreo", short: "Aéreo", badgeClass: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/90 dark:text-purple-200 dark:border-purple-700", borderClass: "ring-2 ring-purple-400/80" },
    contacto_gotitas: { label: "Contacto + Gotitas", short: "Contacto+Gotitas", badgeClass: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/90 dark:text-orange-200 dark:border-orange-700", borderClass: "ring-2 ring-orange-400/80" },
    contacto_aereo: { label: "Contacto + Aéreo", short: "Contacto+Aéreo", badgeClass: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 dark:bg-fuchsia-950/90 dark:text-fuchsia-200 dark:border-fuchsia-700", borderClass: "ring-2 ring-fuchsia-400/80" },
    protector: { label: "Aislamiento Protector", short: "Protector", badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/90 dark:text-emerald-200 dark:border-emerald-700", borderClass: "ring-2 ring-emerald-400/80" }
  };
  return map[type] || map.none;
}

function getRoomIsolationBanner(roomIsolation, note) {
  if (!roomIsolation || roomIsolation === "none") return "";
  const map = {
    cohorte_contacto: { text: "⚠️ SALA EN COHORTE DE CONTACTO", cls: "bg-amber-500 text-white" },
    cohorte_gotitas: { text: "💧 SALA EN COHORTE DE GOTITAS", cls: "bg-sky-600 text-white" },
    cohorte_aereo: { text: "🟣 SALA DE AISLAMIENTO AÉREO", cls: "bg-purple-600 text-white" },
    protector: { text: "🛡️ SALA DE AISLAMIENTO PROTECTOR", cls: "bg-emerald-600 text-white" }
  };
  const item = map[roomIsolation] || map.cohorte_contacto;
  return `
    <div class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wide inline-flex items-center gap-1.5 ${item.cls} shadow-xs">
      <span>${item.text}</span>
      ${note ? `<span class="font-normal opacity-95">(${escapeHtml(note)})</span>` : ""}
    </div>
  `;
}

function formatTaskTimingBadge(task) {
  const timeStr = task.dueTime ? ` ⏰ ${task.dueTime}` : "";
  if (task.timing === "today") {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">HOY${timeStr}</span>`;
  }
  if (task.timing === "later") {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Más tarde${timeStr}</span>`;
  }
  if (task.timing === "tomorrow") {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Mañana${timeStr}</span>`;
  }
  const d = Number(task.daysRemaining || 1);
  if (d <= 0) {
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">¡Cumple Hoy!${timeStr}</span>`;
  }
  return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">En ${d}d${timeStr}</span>`;
}

// =========================================================================
// 4. ORQUESTADOR DE RENDERIZADO PRINCIPAL Y NAVEGACIÓN JERÁRQUICA
// =========================================================================
function renderAll() {
  // Título del hospital y selector de Mi Servicio
  document.getElementById("headerHospitalName").querySelector("span").textContent = appState.hospitalName || "Mi Hospital";

  const myServiceSelect = document.getElementById("headerMyServiceSelect");
  myServiceSelect.innerHTML = appState.services.map(s =>
    `<option value="${s.id}" ${s.id === appState.myServiceId ? "selected" : ""}>${escapeHtml(s.icon)} ${escapeHtml(s.name)}</option>`
  ).join("");

  // Fecha actual
  const now = new Date();
  document.getElementById("currentDateLabel").textContent = now.toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short"
  });

  // Calcular KPIs globales
  let totalBeds = 0;
  let occupiedBeds = 0;
  let myBedsTotal = 0;
  let myBedsSeen = 0;
  let isolatedBeds = 0;
  let activeTasksCount = 0;

  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        totalBeds++;
        if (bed.status === "occupied") occupiedBeds++;
        if (bed.isMyBed) {
          myBedsTotal++;
          if (bed.seenToday) myBedsSeen++;
        }
        const p = bed.patient || {};
        if (bed.status === "occupied" && ((p.isolationType && p.isolationType !== "none") || (room.roomIsolation && room.roomIsolation !== "none"))) {
          isolatedBeds++;
        }
        if (Array.isArray(p.tasks)) {
          activeTasksCount += p.tasks.filter(t => !t.completed).length;
        }
      });
    });
  });

  document.getElementById("kpiOccupied").textContent = `${occupiedBeds}/${totalBeds}`;
  document.getElementById("kpiMyBeds").textContent = `${myBedsTotal}`;
  document.getElementById("kpiIsolated").textContent = `${isolatedBeds}`;
  document.getElementById("kpiPendingTasks").textContent = `${activeTasksCount}`;
  document.getElementById("globalRoundProgressText").textContent = `${myBedsSeen}/${myBedsTotal} mis camas vistas hoy`;

  document.getElementById("badgeCountFloor").textContent = totalBeds;
  document.getElementById("badgeCountMyBeds").textContent = myBedsTotal;
  document.getElementById("badgeCountTasks").textContent = activeTasksCount;

  // Estilo de pestañas principales
  ["floor", "mybeds", "tasks", "summary"].forEach(tab => {
    const btn = document.getElementById(`tabBtn-${tab}`);
    const sec = document.getElementById(`view-${tab}`);
    if (appState.activeTab === tab) {
      btn.className = "tab-nav-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap bg-teal-600 text-white shadow-xs transition";
      sec.classList.remove("hidden");
    } else {
      btn.className = "tab-nav-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition";
      sec.classList.add("hidden");
    }
  });

  // Chips de filtro rápido
  document.querySelectorAll("[data-filter-chip]").forEach(chip => {
    const val = chip.getAttribute("data-filter-chip");
    if (val === appState.floorFilter) {
      chip.className = "filter-chip px-2.5 py-1 rounded-lg font-bold bg-teal-600 text-white shadow-xs transition";
    } else {
      chip.className = "filter-chip px-2.5 py-1 rounded-lg font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition";
    }
  });
  document.getElementById("floorQuickFilter").value = appState.floorFilter;

  renderHierarchicalFloorView();
  renderMyBedsView();
  renderCentralTasksView();
  renderSummaryView();
  evaluateNotificationsAndBell();
}

function changeMyService(newServiceId) {
  appState.myServiceId = newServiceId;
  saveAppState();
  renderAll();
  const srv = getServiceById(newServiceId);
  if (srv) showToast(`🏥 Tu servicio base ahora es: ${srv.name}`);
}

function switchMainTab(tab) {
  appState.activeTab = tab;
  saveAppState();
  renderAll();
}

function setFloorFilter(filterVal) {
  appState.floorFilter = filterVal;
  saveAppState();
  renderAll();
}

function handleSearchInput(val) {
  appState.searchQuery = val.trim().toLowerCase();
  document.getElementById("clearSearchBtn").classList.toggle("hidden", !appState.searchQuery);
  renderAll();
}

function clearSearch() {
  document.getElementById("globalSearchInput").value = "";
  handleSearchInput("");
}

function navigateHierarchy(level, serviceId = null, roomId = null) {
  appState.navState.level = level;
  if (serviceId) appState.navState.selectedServiceId = serviceId;
  if (roomId) appState.navState.selectedRoomId = roomId;
  if (level === "rooms") appState.navState.showAllRoomsBedsInService = false;
  saveAppState();
  renderAll();
}

function toggleShowAllRoomsBedsInService() {
  appState.navState.showAllRoomsBedsInService = !appState.navState.showAllRoomsBedsInService;
  saveAppState();
  renderAll();
}

function doesBedMatchFilterAndSearch(bed, room, service) {
  const f = appState.floorFilter;
  const p = bed.patient || {};
  const activeTasks = (p.tasks || []).filter(t => !t.completed);
  const isIsolated = (p.isolationType && p.isolationType !== "none") || (room.roomIsolation && room.roomIsolation !== "none");
  const ownerServiceId = bed.patientServiceId || service.id;

  if (f === "mine" && !bed.isMyBed) return false;
  if (f === "unseen" && (bed.status !== "occupied" || bed.seenToday)) return false;
  if (f === "seen" && (bed.status !== "occupied" || !bed.seenToday)) return false;
  if (f === "my_service" && ownerServiceId !== appState.myServiceId) return false;
  if (f === "other_service" && (bed.status !== "occupied" || ownerServiceId === service.id)) return false;
  if (f === "isolated" && (!isIsolated || bed.status !== "occupied")) return false;
  if (f === "with_tasks" && activeTasks.length === 0) return false;
  if (f === "free" && bed.status !== "free") return false;

  if (appState.searchQuery) {
    const q = appState.searchQuery;
    // Adaptación a la nueva estructura JSON v3.0
    let diagText = Array.isArray(p.diagnoses) ? p.diagnoses.map(d => d.main).join(" ") : (p.diagnoses || "");
    let planText = p.evolution ? (p.evolution.subjective + " " + p.evolution.currentStatus) : (p.clinicalPlan || "");
    let medText = p.hospitalMedications || p.medications || "";

    const haystack = [
      bed.code, room.name, service.name, p.name, p.rut, p.recordNumber, 
      diagText, planText, medText, p.allergies,
      ...(p.pathogens || []), ...(p.antibiotics || []).map(a => a.name), ...(p.tasks || []).map(t => t.text)
    ].join(" ").toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}
// =========================================================================
// 5. RENDERIZADO DEL MENÚ JERÁRQUICO: SERVICIOS -> SALAS -> CAMAS
// =========================================================================
function renderHierarchicalFloorView() {
  const bcContainer = document.getElementById("hierarchyBreadcrumbs");
  const actionsContainer = document.getElementById("hierarchyContextActions");
  const contentContainer = document.getElementById("hierarchyContentContainer");

  // Si hay búsqueda activa o filtro específico distinto de 'all', o si estamos navegando:
  const nav = appState.navState;
  const currentService = getServiceById(nav.selectedServiceId) || appState.services[0];
  const currentRoom = currentService ? (currentService.rooms.find(r => r.id === nav.selectedRoomId) || currentService.rooms[0]) : null;

  // Render Breadcrumbs
  let bcHtml = `
    <button onclick="navigateHierarchy('services')" class="px-2.5 py-1 rounded-lg ${nav.level === 'services' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'} transition">
      🏥 Todos los Servicios (${appState.services.length})
    </button>
  `;

  if ((nav.level === "rooms" || nav.level === "beds") && currentService) {
    bcHtml += `<span class="text-slate-400">/</span>`;
    bcHtml += `
      <button onclick="navigateHierarchy('rooms', '${currentService.id}')" class="px-2.5 py-1 rounded-lg ${nav.level === 'rooms' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'} transition">
        ${escapeHtml(currentService.icon)} ${escapeHtml(currentService.name)}
      </button>
    `;
  }

  if (nav.level === "beds" && currentService && currentRoom && !nav.showAllRoomsBedsInService) {
    bcHtml += `<span class="text-slate-400">/</span>`;
    bcHtml += `
      <span class="px-2.5 py-1 rounded-lg bg-teal-600 text-white">
        🚪 ${escapeHtml(currentRoom.name)} (${escapeHtml(getRoomBedRangeText(currentRoom))})
      </span>
    `;
  }
  bcContainer.innerHTML = bcHtml;

  // Render Contextual Buttons according to level
  if (nav.level === "services") {
    actionsContainer.innerHTML = `
      <button onclick="openHospitalConfigModal()" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs">
        + Crear / Configurar Servicio
      </button>
    `;
    renderLevel1ServicesGrid(contentContainer);
  } else if (nav.level === "rooms" && currentService) {
    actionsContainer.innerHTML = `
      <button onclick="navigateHierarchy('services')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
        ← Volver a Servicios
      </button>
      <button onclick="toggleShowAllRoomsBedsInService()" class="px-3 py-1.5 rounded-xl text-xs font-bold ${nav.showAllRoomsBedsInService ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200'}">
        ${nav.showAllRoomsBedsInService ? '🗂️ Ver Resumen por Salas' : '🛏️ Desplegar Todas las Camas del Servicio'}
      </button>
      <button onclick="openAddRoomModal('${currentService.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white">
        + Nueva Sala en ${escapeHtml(currentService.name)}
      </button>
    `;
    if (nav.showAllRoomsBedsInService) {
      renderAllRoomsWithBedsForService(contentContainer, currentService);
    } else {
      renderLevel2RoomsGrid(contentContainer, currentService);
    }
  } else if (nav.level === "beds" && currentService && currentRoom) {
    // Selector rápido para saltar entre salas del mismo servicio
    const roomOptions = currentService.rooms.map(r =>
      `<option value="${r.id}" ${r.id === currentRoom.id ? "selected" : ""}>🚪 ${escapeHtml(r.name)} (${escapeHtml(getRoomBedRangeText(r))})</option>`
    ).join("");

    actionsContainer.innerHTML = `
      <button onclick="navigateHierarchy('rooms', '${currentService.id}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
        ← Volver a Salas de ${escapeHtml(currentService.name)}
      </button>
      <select onchange="navigateHierarchy('beds', '${currentService.id}', this.value)" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
        ${roomOptions}
      </select>
      <button onclick="quickAddBedToRoom('${currentService.id}', '${currentRoom.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100">
        + Agregar Cama
      </button>
      <button onclick="openEditRoomModal('${currentService.id}', '${currentRoom.id}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800">
        ⚙️ Configurar Sala
      </button>
    `;
    renderLevel3SingleRoomBeds(contentContainer, currentService, currentRoom);
  }
}

// --- NIVEL 1: TARJETAS DE SERVICIOS DEL HOSPITAL ---
function renderLevel1ServicesGrid(container) {
  let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

  appState.services.forEach(srv => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let myPatientsInSrv = 0;
    let myUnseenInSrv = 0;
    let isolatedRoomsCount = 0;
    let isolatedBedsCount = 0;
    let pendingTasksCount = 0;

    srv.rooms.forEach(room => {
      if (room.roomIsolation && room.roomIsolation !== "none") isolatedRoomsCount++;
      room.beds.forEach(bed => {
        totalBeds++;
        if (bed.status === "occupied") {
          occupiedBeds++;
          if (bed.isMyBed) {
            myPatientsInSrv++;
            if (!bed.seenToday) myUnseenInSrv++;
          }
          if ((bed.patient?.isolationType && bed.patient.isolationType !== "none") || (room.roomIsolation && room.roomIsolation !== "none")) {
            isolatedBedsCount++;
          }
          if (bed.patient?.tasks) {
            pendingTasksCount += bed.patient.tasks.filter(t => !t.completed).length;
          }
        }
      });
    });

    const firstBedNum = srv.rooms[0]?.beds[0]?.number || 1;
    const lastRoom = srv.rooms[srv.rooms.length - 1];
    const lastBedNum = lastRoom?.beds[lastRoom.beds.length - 1]?.number || totalBeds;
    const isMyBaseService = srv.id === appState.myServiceId;

    html += `
      <div onclick="navigateHierarchy('rooms', '${srv.id}')" class="card-hover cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 ${isMyBaseService ? 'border-teal-500 dark:border-teal-500' : 'border-slate-200/90 dark:border-slate-800'} shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${escapeHtml(srv.icon || "🏥")}</span>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">${escapeHtml(srv.name)}</h3>
                  ${isMyBaseService ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">MI SERVICIO</span>` : ""}
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  ${srv.rooms.length} sala${srv.rooms.length === 1 ? '' : 's'} • Numeración: <strong>Cama ${firstBedNum} a la ${lastBedNum}</strong>
                </p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              ${occupiedBeds}/${totalBeds} ocupadas
            </span>
          </div>

          <!-- Indicadores Clave del Servicio -->
          <div class="grid grid-cols-2 gap-2 mt-4">
            <div class="p-2.5 rounded-xl ${myPatientsInSrv > 0 ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800/40'}">
              <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">⭐ Mis Pacientes aquí</div>
              <div class="text-sm font-extrabold ${myPatientsInSrv > 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'}">
                ${myPatientsInSrv > 0 ? `${myPatientsInSrv} paciente${myPatientsInSrv === 1 ? '' : 's'} (${myUnseenInSrv} por ver)` : 'Ninguno'}
              </div>
            </div>

            <div class="p-2.5 rounded-xl ${isolatedBedsCount > 0 || isolatedRoomsCount > 0 ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/40'}">
              <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">⚠️ Aislamientos</div>
              <div class="text-sm font-extrabold ${isolatedBedsCount > 0 || isolatedRoomsCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400'}">
                ${isolatedBedsCount} cama${isolatedBedsCount === 1 ? '' : 's'} / ${isolatedRoomsCount} sala${isolatedRoomsCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span class="${pendingTasksCount > 0 ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-400'}">
            📌 ${pendingTasksCount} pendiente${pendingTasksCount === 1 ? '' : 's'} activo${pendingTasksCount === 1 ? '' : 's'}
          </span>
          <span class="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
            Ver Salas (${srv.rooms.length}) →
          </span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// --- NIVEL 2: TARJETAS DE SALAS DENTRO DEL SERVICIO SELECCIONADO ---
function renderLevel2RoomsGrid(container, service) {
  if (!service.rooms.length) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
        <p class="text-base font-bold">Este servicio aún no tiene salas creadas</p>
        <button onclick="openAddRoomModal('${service.id}')" class="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white">+ Crear Primera Sala</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="bg-teal-50/70 dark:bg-teal-950/30 px-4 py-3 rounded-2xl border border-teal-200 dark:border-teal-800 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div>
        <strong class="text-teal-900 dark:text-teal-200">${escapeHtml(service.icon)} ${escapeHtml(service.name)} — Vista por Salas:</strong>
        <span class="text-teal-800 dark:text-teal-300 ml-1">Selecciona una sala para abrir sus camas. Aquí puedes ver de inmediato dónde tienes pacientes asignados (⭐) y qué salas tienen aislamiento.</span>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  `;

  service.rooms.forEach(room => {
    const matchingBeds = room.beds.filter(b => doesBedMatchFilterAndSearch(b, room, service));
    if (matchingBeds.length === 0 && (appState.floorFilter !== "all" || appState.searchQuery)) {
      return;
    }

    const occupiedBeds = room.beds.filter(b => b.status === "occupied");
    const myBedsInRoom = occupiedBeds.filter(b => b.isMyBed);
    const isolatedBedsInRoom = occupiedBeds.filter(b => b.patient?.isolationType && b.patient.isolationType !== "none");
    const roomIsoBanner = getRoomIsolationBanner(room.roomIsolation, room.roomIsolationNote);
    const hasRoomIsolation = room.roomIsolation && room.roomIsolation !== "none";

    html += `
      <div onclick="navigateHierarchy('beds', '${service.id}', '${room.id}')" class="card-hover cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border-2 ${hasRoomIsolation ? 'border-amber-400 dark:border-amber-500' : (myBedsInRoom.length > 0 ? 'border-indigo-400 dark:border-indigo-500' : 'border-slate-200 dark:border-slate-800')} shadow-sm flex flex-col justify-between gap-3">
        
        <div class="space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                ${escapeHtml(getRoomBedRangeText(room))}
              </span>
              <h3 class="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                🚪 ${escapeHtml(room.name)}
              </h3>
            </div>
            <div class="flex items-center gap-1" onclick="event.stopPropagation()">
              <button onclick="openEditRoomModal('${service.id}', '${room.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800" title="Configurar Sala">⚙️</button>
              <button onclick="deleteRoom('${service.id}', '${room.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 bg-slate-100 dark:bg-slate-800" title="Eliminar Sala">🗑️</button>
            </div>
          </div>

          ${roomIsoBanner}

          <!-- Resumen de Mis Pacientes en esta Sala -->
          ${myBedsInRoom.length > 0 ? `
            <div class="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 space-y-1">
              <div class="text-xs font-extrabold text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
                <span>⭐ Tienes ${myBedsInRoom.length} paciente${myBedsInRoom.length === 1 ? '' : 's'} en esta sala</span>
                <span>${myBedsInRoom.filter(b => b.seenToday).length}/${myBedsInRoom.length} vistos</span>
              </div>
              <div class="space-y-0.5 text-[11px] text-indigo-900 dark:text-indigo-200">
                ${myBedsInRoom.map(b => `
                  <div class="flex items-center justify-between truncate">
                    <span>• <strong>${escapeHtml(b.code)}:</strong> ${escapeHtml(b.patient?.name || "Paciente")}</span>
                    <span>${b.seenToday ? '✓' : '👁️'}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : `
            <div class="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
              Sin pacientes marcados como "Mis Camas" en esta sala.
            </div>
          `}

          <!-- Mini vista de estado de cada cama de la sala -->
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${room.beds.map(b => {
              const isOcc = b.status === "occupied";
              const hasIso = isOcc && b.patient?.isolationType && b.patient.isolationType !== "none";
              let pillCls = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
              if (isOcc) {
                pillCls = b.isMyBed
                  ? "bg-indigo-600 text-white"
                  : (hasIso ? "bg-amber-500 text-white" : "bg-slate-800 text-white dark:bg-slate-700");
              } else if (b.status === "cleaning") {
                pillCls = "bg-sky-100 text-sky-800";
              }
              return `<span class="px-2 py-0.5 rounded text-[11px] font-bold ${pillCls}" title="${escapeHtml(b.patient?.name || 'Libre')}">${escapeHtml(b.code)} ${hasIso ? '⚠️' : ''}</span>`;
            }).join("")}
          </div>
        </div>

        <div class="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span class="font-semibold text-slate-600 dark:text-slate-400">
            Ocupación: <strong>${occupiedBeds.length}/${room.beds.length}</strong>
            ${isolatedBedsInRoom.length > 0 ? ` • <strong class="text-amber-600">⚠️ ${isolatedBedsInRoom.length} aislada(s)</strong>` : ""}
          </span>
          <span class="font-extrabold text-teal-600 dark:text-teal-400">Abrir Camas →</span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// --- NIVEL 3: CAMAS DE UNA SALA SELECCIONADA ---
function renderLevel3SingleRoomBeds(container, service, room) {
  const filteredBeds = room.beds.filter(b => doesBedMatchFilterAndSearch(b, room, service));
  const roomBanner = getRoomIsolationBanner(room.roomIsolation, room.roomIsolationNote);
  const occupiedCount = room.beds.filter(b => b.status === "occupied").length;

  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border ${room.roomIsolation && room.roomIsolation !== 'none' ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-800'} shadow-sm overflow-hidden">
      <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="text-base font-extrabold text-slate-900 dark:text-white">
            ${escapeHtml(service.icon)} ${escapeHtml(service.name)} — 🚪 ${escapeHtml(room.name)}
          </h2>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
            ${escapeHtml(getRoomBedRangeText(room))}
          </span>
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-700">
            ${occupiedCount}/${room.beds.length} ocupadas
          </span>
          ${roomBanner}
        </div>
      </div>

      <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        ${filteredBeds.length > 0
          ? filteredBeds.map(bed => renderBedCardHTML(service, room, bed)).join("")
          : `<div class="col-span-full py-8 text-center text-xs text-slate-500">Ninguna cama en esta sala coincide con el filtro activo.</div>`
        }
      </div>
    </div>
  `;
}

// Vista expandida opcional de todas las salas del servicio
function renderAllRoomsWithBedsForService(container, service) {
  let html = "";
  service.rooms.forEach(room => {
    const filteredBeds = room.beds.filter(b => doesBedMatchFilterAndSearch(b, room, service));
    if (filteredBeds.length === 0 && (appState.floorFilter !== "all" || appState.searchQuery)) return;
    const roomBanner = getRoomIsolationBanner(room.roomIsolation, room.roomIsolationNote);

    html += `
      <div class="bg-white dark:bg-slate-900 rounded-2xl border ${room.roomIsolation && room.roomIsolation !== 'none' ? 'border-amber-400' : 'border-slate-200 dark:border-slate-800'} shadow-sm overflow-hidden">
        <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <h3 onclick="navigateHierarchy('beds', '${service.id}', '${room.id}')" class="text-sm sm:text-base font-extrabold cursor-pointer hover:text-teal-600">
              🚪 ${escapeHtml(room.name)} (${escapeHtml(getRoomBedRangeText(room))})
            </h3>
            ${roomBanner}
          </div>
          <button onclick="quickAddBedToRoom('${service.id}', '${room.id}')" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">+ Cama</button>
        </div>
        <div class="p-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          ${filteredBeds.map(bed => renderBedCardHTML(service, room, bed)).join("")}
        </div>
      </div>
    `;
  });
  container.innerHTML = html || `<div class="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl">Sin resultados para el filtro actual.</div>`;
}

// =========================================================================
// 6. TARJETA DE CAMA INDIVIDUAL (CON ECTÓPICOS, ALERGIAS, LET, DISPOSITIVOS Y MOVER)
// =========================================================================
function renderBedCardHTML(service, room, bed) {
  const p = bed.patient || {};
  const isoMeta = getIsolationMeta(p.isolationType || "none");
  const activeTasks = (p.tasks || []).filter(t => !t.completed);
  const isOccupied = bed.status === "occupied";

  if (!isOccupied) {
    const statusStyles = {
      free: { label: "Cama Libre", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300", border: "border-dashed border-emerald-300 dark:border-emerald-800/70 bg-emerald-50/20 dark:bg-emerald-950/10" },
      reserved: { label: "En Reserva", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300", border: "border-dashed border-amber-300 dark:border-amber-800/70 bg-amber-50/20" },
      cleaning: { label: "Aseo Terminal", badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300", border: "border-dashed border-sky-300 dark:border-sky-800/70 bg-sky-50/20" }
    };
    const st = statusStyles[bed.status] || statusStyles.free;
    return `
      <div onclick="openBedModal('${service.id}', '${room.id}', '${bed.id}')" class="card-hover cursor-pointer rounded-2xl p-3.5 border ${st.border} flex flex-col justify-between min-h-[170px]">
        <div class="flex items-center justify-between gap-2">
          <span class="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">${escapeHtml(bed.code)}</span>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${st.badge}">${st.label}</span>
        </div>
        <div class="my-auto py-4 text-center">
          <p class="text-xs text-slate-500 dark:text-slate-400">Toca para ingresar paciente</p>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
          <span>${escapeHtml(service.name)} • ${escapeHtml(room.name)}</span>
          <span class="font-bold text-teal-600">+ Ingresar →</span>
        </div>
      </div>
    `;
  }

  const ownerSrvId = bed.patientServiceId || service.id;
  const ownerSrvObj = getServiceById(ownerSrvId) || service;
  const isEctopic = ownerSrvId !== service.id;

  const serviceBadge = isEctopic
    ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border border-purple-300">🔄 Ectópico de ${escapeHtml(ownerSrvObj.name)}</span>`
    : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 dark:bg-teal-950/90 dark:text-teal-300 border border-teal-200 dark:border-teal-800">${escapeHtml(ownerSrvObj.name)}</span>`;

  // SOLUCIÓN: Extractor inteligente de la primera línea de diagnóstico (v3.0 y v2.0)
  let firstDiagLine = "Sin diagnóstico registrado";
  if (Array.isArray(p.diagnoses) && p.diagnoses.length > 0) {
    firstDiagLine = p.diagnoses[0].main;
  } else if (typeof p.diagnoses === "string" && p.diagnoses.trim() !== "") {
    firstDiagLine = p.diagnoses.split("\n")[0];
  }

  const hasAllergy = p.allergies && !/no conocida|ram\s*\(-\)|ninguna|sin alergia/i.test(p.allergies);
  const hasLet = p.letStatus && !/full|sin restricci/i.test(p.letStatus);
  
  let o2Text = "Ambiental";
  if (p.vitals && p.vitals.o2Type && p.vitals.o2Type !== "Ambiental") {
    o2Text = `${p.vitals.o2Type} ${p.vitals.o2Liters}`;
  } else if (p.oxygenSupport && p.oxygenSupport !== "Ambiental") {
    o2Text = p.oxygenSupport;
  }

  return `
    <div onclick="openBedModal('${service.id}', '${room.id}', '${bed.id}')" class="card-hover cursor-pointer rounded-2xl p-3.5 bg-white dark:bg-slate-900 border ${bed.isMyBed ? 'border-indigo-400 dark:border-indigo-600' : 'border-slate-200 dark:border-slate-800'} ${isoMeta.borderClass} shadow-xs flex flex-col justify-between gap-2.5">
      
      <div class="flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="px-2.5 py-1 rounded-lg text-xs font-extrabold ${bed.isMyBed ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white dark:bg-slate-700'}">${escapeHtml(bed.code)}</span>
          ${serviceBadge}
        </div>
        <div class="flex items-center gap-1" onclick="event.stopPropagation()">
          <button onclick="openMovePatientModal('${service.id}', '${room.id}', '${bed.id}')" class="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold">⇄</button>
          <button onclick="quickToggleMyBed('${service.id}', '${room.id}', '${bed.id}')" class="p-1.5 rounded-lg border text-xs font-bold ${bed.isMyBed ? 'bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-400'}">★</button>
          <button onclick="quickToggleSeenToday('${service.id}', '${room.id}', '${bed.id}')" class="px-2 py-1 rounded-lg border text-[11px] font-bold ${bed.seenToday ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}">${bed.seenToday ? '✓ Visto' : 'Ver'}</button>
        </div>
      </div>

      ${(hasAllergy || hasLet || o2Text !== "Ambiental") ? `
        <div class="flex flex-wrap gap-1">
          ${hasAllergy ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white">🚨 RAM: ${escapeHtml(p.allergies)}</span>` : ""}
          ${hasLet ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-700 text-white">⚖️ ${escapeHtml(p.letStatus)}</span>` : ""}
          ${o2Text !== "Ambiental" ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">🫁 ${escapeHtml(o2Text)}</span>` : ""}
        </div>
      ` : ""}

      ${(p.isolationType && p.isolationType !== "none") || (p.pathogens && p.pathogens.length > 0) ? `
        <div class="p-2 rounded-xl border ${isoMeta.badgeClass} text-xs space-y-1">
          ${p.isolationType && p.isolationType !== "none" ? `<div class="font-extrabold">⚠️ ${isoMeta.label}</div>` : ""}
          ${p.pathogens && p.pathogens.length > 0 ? `<div class="flex flex-wrap gap-1">${p.pathogens.map(ag => `<span class="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-semibold text-[10px]">🦠 ${escapeHtml(ag)}</span>`).join("")}</div>` : ""}
        </div>
      ` : ""}

      <div>
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white leading-tight line-clamp-1">${escapeHtml(p.name || "Paciente sin nombre")}</h3>
          <span class="text-xs font-bold text-slate-500 shrink-0">${p.age ? `${escapeHtml(p.age)}a` : ""}</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 mt-0.5">
          ${p.rut ? `<span class="font-mono">${escapeHtml(p.rut)}</span>` : ""}
          <span class="font-semibold text-teal-700 dark:text-teal-400">• 🗓️ Día ${Number(p.hospDays || 1)} Hosp</span>
        </div>
        <p class="text-xs text-slate-700 dark:text-slate-300 mt-1.5 line-clamp-2 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
          ${escapeHtml(firstDiagLine)}
        </p>
      </div>

      ${((p.antibiotics && p.antibiotics.length > 0) || (p.devices && p.devices.length > 0)) ? `
        <div class="flex flex-wrap gap-1">
          ${(p.antibiotics || []).map(atb => {
            const done = Number(atb.currentDay) >= Number(atb.targetDays);
            return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${done ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200'}">💊 ${escapeHtml(atb.name)} D${atb.currentDay}/${atb.targetDays}</span>`;
          }).join("")}
          ${(p.devices || []).map(dev => `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">🔌 ${escapeHtml(dev.name)} D${dev.days}</span>`).join("")}
        </div>
      ` : ""}

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
        ${activeTasks.length > 0 ? `
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            <span class="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[10px] shrink-0">📌 ${activeTasks.length}</span>
            <span class="truncate text-[11px] text-slate-600 dark:text-slate-300 font-medium">${escapeHtml(activeTasks[0].text)}</span>
          </div>
        ` : `<span class="text-[11px] text-slate-400">Sin pendientes</span>`}
        <button onclick="event.stopPropagation(); openShareModal('${service.id}', '${room.id}', '${bed.id}')" class="p-1 rounded-lg text-slate-400 hover:text-emerald-600 shrink-0">📲</button>
      </div>
    </div>
  `;
}

function quickToggleSeenToday(serviceId, roomId, bedId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found || !found.bed) return;
  found.bed.seenToday = !found.bed.seenToday;
  saveAppState();
  renderAll();
}

function quickToggleMyBed(serviceId, roomId, bedId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found || !found.bed) return;
  found.bed.isMyBed = !found.bed.isMyBed;
  saveAppState();
  renderAll();
  showToast(found.bed.isMyBed ? `⭐ ${found.bed.code} agregada a Mis Camas` : `${found.bed.code} quitada de Mis Camas`);
}

// =========================================================================
// 7. VISTAS SECUNDARIAS: MIS CAMAS, CENTRAL DE PENDIENTES Y RESUMEN
// =========================================================================
function renderMyBedsView() {
  const container = document.getElementById("myBedsContainer");
  const myBedsList = [];
  appState.services.forEach(service => {
    service.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.isMyBed) {
          myBedsList.push({ service, room, bed });
        }
      });
    });
  });

  const total = myBedsList.length;
  const seenCount = myBedsList.filter(x => x.bed.seenToday).length;
  const pct = total > 0 ? Math.round((seenCount / total) * 100) : 0;

  document.getElementById("myBedsProgressFraction").textContent = `${seenCount} / ${total} vistos (${pct}%)`;
  document.getElementById("myBedsProgressBar").style.width = `${pct}%`;

  if (total === 0) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800">
        <p class="text-base font-bold">No tienes camas marcadas con ★</p>
        <p class="text-xs text-slate-500 mt-1 mb-4">Marca tus pacientes en cualquier Servicio o Sala para verlos reunidos aquí.</p>
      </div>
    `;
    return;
  }

  const unseen = myBedsList.filter(x => !x.bed.seenToday);
  const seen = myBedsList.filter(x => x.bed.seenToday);

  container.innerHTML = `
    <div class="space-y-3">
      <h3 class="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-400">👁️ Pendientes de Evaluar Hoy (${unseen.length})</h3>
      ${unseen.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${unseen.map(x => renderBedCardHTML(x.service, x.room, x.bed)).join("")}
        </div>
      ` : `<div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold text-center text-sm">🎉 ¡Todos tus pacientes fueron evaluados hoy!</div>`}
    </div>
    ${seen.length > 0 ? `
      <div class="space-y-3 pt-3">
        <h3 class="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400">✅ Ya Evaluados Hoy (${seen.length})</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-90">
          ${seen.map(x => renderBedCardHTML(x.service, x.room, x.bed)).join("")}
        </div>
      </div>
    ` : ""}
  `;
}

function markAllMyBedsSeen(seenVal) {
  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.isMyBed && bed.status === "occupied") bed.seenToday = seenVal;
      });
    });
  });
  saveAppState();
  renderAll();
}

function toggleQuickTaskDaysInput() {
  const sel = document.getElementById("quickTaskTimingType").value;
  document.getElementById("quickTaskDaysNumber").classList.toggle("hidden", sel !== "in_days");
}

function setTasksScope(scope) {
  appState.tasksScope = scope;
  saveAppState();
  renderCentralTasksView();
}

function renderCentralTasksView() {
  const selectEl = document.getElementById("quickTaskBedSelect");
  const prevVal = selectEl.value;
  let opts = "";
  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        const pName = bed.status === "occupied" && bed.patient?.name ? ` — ${bed.patient.name}` : " (Libre)";
        opts += `<option value="${srv.id}|${room.id}|${bed.id}">[${escapeHtml(srv.name)}] ${escapeHtml(bed.code)} (${escapeHtml(room.name)})${escapeHtml(pName)}</option>`;
      });
    });
  });
  selectEl.innerHTML = opts;
  if (prevVal && selectEl.querySelector(`option[value="${prevVal}"]`)) selectEl.value = prevVal;

  const allTasks = [];
  appState.services.forEach(service => {
    service.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (appState.tasksScope === "mine" && !bed.isMyBed) return;
        (bed.patient?.tasks || []).forEach(task => {
          allTasks.push({ service, room, bed, task });
        });
      });
    });
  });

  const urgentToday = allTasks.filter(x => !x.task.completed && (x.task.timing === "today" || x.task.timing === "later" || Number(x.task.daysRemaining) <= 0));
  const scheduledFuture = allTasks.filter(x => !x.task.completed && (x.task.timing === "tomorrow" || (x.task.timing === "in_days" && Number(x.task.daysRemaining) > 0)));
  const completedList = allTasks.filter(x => x.task.completed);

  const renderItem = ({ service, room, bed, task }) => `
    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2">
      <div class="flex items-start gap-2.5 min-w-0">
        <input type="checkbox" ${task.completed ? "checked" : ""} onchange="toggleTaskComplete('${service.id}', '${room.id}', '${bed.id}', '${task.id}')" class="mt-1 w-4 h-4 rounded text-teal-600 cursor-pointer" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-1.5">
            <button onclick="openBedModal('${service.id}', '${room.id}', '${bed.id}')" class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-600 text-white">
              ${escapeHtml(service.name)} • ${escapeHtml(bed.code)}
            </button>
            <span class="text-xs font-bold truncate">${escapeHtml(bed.patient?.name || "Sin nombre")}</span>
            ${formatTaskTimingBadge(task)}
          </div>
          <p class="text-xs sm:text-sm mt-1 ${task.completed ? 'line-through text-slate-400' : 'font-medium'}">${escapeHtml(task.text)}</p>
        </div>
      </div>
      <button onclick="deleteTaskFromBed('${service.id}', '${room.id}', '${bed.id}', '${task.id}')" class="text-slate-400 hover:text-rose-600 text-xs">✕</button>
    </div>
  `;

  document.getElementById("centralTasksContainer").innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-rose-200 dark:border-rose-900/60 space-y-3">
      <h3 class="text-sm font-extrabold text-rose-700 dark:text-rose-400">🔥 Para Hoy / Con Alerta Horaria (${urgentToday.length})</h3>
      <div class="space-y-2">${urgentToday.length ? urgentToday.map(renderItem).join("") : `<p class="text-xs text-slate-400 py-4 text-center">Sin pendientes urgentes.</p>`}</div>
    </div>
    <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
      <h3 class="text-sm font-extrabold text-indigo-700 dark:text-indigo-400">🗓️ Programados En X Días (${scheduledFuture.length})</h3>
      <div class="space-y-2">${scheduledFuture.length ? scheduledFuture.map(renderItem).join("") : `<p class="text-xs text-slate-400 py-4 text-center">Sin pendientes futuros.</p>`}</div>
    </div>
    <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
      <h3 class="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">✅ Completados (${completedList.length})</h3>
      <div class="space-y-2">${completedList.length ? completedList.map(renderItem).join("") : `<p class="text-xs text-slate-400 py-4 text-center">Sin completados.</p>`}</div>
    </div>
  `;
}

function handleQuickTaskSubmit(e) {
  e.preventDefault();
  const val = document.getElementById("quickTaskBedSelect").value;
  if (!val) return;
  const [serviceId, roomId, bedId] = val.split("|");
  const found = findEntity(serviceId, roomId, bedId);
  if (!found || !found.bed) return;

  const category = document.getElementById("quickTaskCategory").value;
  const text = document.getElementById("quickTaskText").value.trim();
  const timing = document.getElementById("quickTaskTimingType").value;
  const daysNum = Number(document.getElementById("quickTaskDaysNumber").value || 1);
  const dueTime = document.getElementById("quickTaskDueTime").value || "";

  if (!text) return;
  if (!found.bed.patient) found.bed.patient = createEmptyPatient();
  if (!Array.isArray(found.bed.patient.tasks)) found.bed.patient.tasks = [];

  found.bed.patient.tasks.push({
    id: "task-" + Date.now(),
    category,
    text,
    timing,
    daysRemaining: timing === "tomorrow" ? 1 : (timing === "in_days" ? daysNum : 0),
    dueTime,
    completed: false,
    notified: false
  });

  document.getElementById("quickTaskText").value = "";
  document.getElementById("quickTaskDueTime").value = "";
  saveAppState();
  renderAll();
  showToast(`📌 Pendiente agregado a ${found.bed.code}`);
}

function toggleTaskComplete(serviceId, roomId, bedId, taskId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found?.bed?.patient?.tasks) return;
  const t = found.bed.patient.tasks.find(x => x.id === taskId);
  if (t) t.completed = !t.completed;
  saveAppState();
  renderAll();
}

function deleteTaskFromBed(serviceId, roomId, bedId, taskId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found?.bed?.patient?.tasks) return;
  found.bed.patient.tasks = found.bed.patient.tasks.filter(x => x.id !== taskId);
  saveAppState();
  renderAll();
}

function clearCompletedTasks() {
  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.patient?.tasks) {
          bed.patient.tasks = bed.patient.tasks.filter(t => !t.completed);
        }
      });
    });
  });
  saveAppState();
  renderAll();
  showToast("🗑️ Pendientes completados eliminados");
}

// =========================================================================
// 8. RESUMEN Y PASE DE GUARDIA
// =========================================================================
function getFilteredSummaryBeds() {
  const filter = document.getElementById("summaryFilterSelect")?.value || "mine";
  const list = [];
  appState.services.forEach(service => {
    service.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.status !== "occupied") return;
        const ownerSrv = bed.patientServiceId || service.id;
        if (filter === "mine" && !bed.isMyBed) return;
        if (filter === "my_service" && ownerSrv !== appState.myServiceId) return;
        if (filter === "isolated" && (!bed.patient?.isolationType || bed.patient.isolationType === "none")) return;
        list.push({ service, room, bed });
      });
    });
  });
  return list;
}

function renderSummaryView() {
  const container = document.getElementById("summaryTableContainer");
  const list = getFilteredSummaryBeds();
  if (!list.length) {
    container.innerHTML = `<div class="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-xs text-slate-500">No hay pacientes para este filtro.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <th class="p-3 font-extrabold">Servicio / Sala / Cama</th>
            <th class="p-3 font-extrabold">Paciente / Alergias / LET</th>
            <th class="p-3 font-extrabold">Días / Aislamiento</th>
            <th class="p-3 font-extrabold">Diagnósticos, Plan y Labs</th>
            <th class="p-3 font-extrabold">ATB, Dispositivos y Fármacos</th>
            <th class="p-3 font-extrabold">Pendientes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
          ${list.map(({ service, room, bed }) => {
            const p = bed.patient || {};
            const iso = getIsolationMeta(p.isolationType);
            const pending = (p.tasks || []).filter(t => !t.completed);
            
            let diagHTML = Array.isArray(p.diagnoses) ? p.diagnoses.map(d => '- ' + d.main).join('<br>') : escapeHtml(p.diagnoses || "-");
            let planHTML = p.evolution?.subjective ? escapeHtml(p.evolution.subjective + ' ' + p.evolution.currentStatus) : escapeHtml(p.clinicalPlan || "");
            let labsHTML = (p.labs && p.labs.length) ? escapeHtml(p.labs.map(l => l.exams.map(e => e.name + ' ' + e.value).join(' | ')).join(' / ')) : escapeHtml(p.labsSummary || "");
            let o2Text = (p.vitals && p.vitals.o2Type && p.vitals.o2Type !== "Ambiental") ? `${p.vitals.o2Type} ${p.vitals.o2Liters}` : (p.oxygenSupport || "Ambiental");

            return `
              <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 align-top">
                <td class="p-3 whitespace-nowrap">
                  <div onclick="openBedModal('${service.id}', '${room.id}', '${bed.id}')" class="font-extrabold text-sm text-teal-700 dark:text-teal-400 cursor-pointer hover:underline">${escapeHtml(bed.code)}</div>
                  <div class="font-bold text-slate-700 dark:text-slate-300">${escapeHtml(service.name)}</div>
                  <div class="text-[11px] text-slate-500">${escapeHtml(room.name)}</div>
                </td>
                <td class="p-3">
                  <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(p.name || "Sin nombre")} ${p.age ? `(${escapeHtml(p.age)}a)` : ""}</div>
                  <div class="font-mono text-[11px] text-slate-500">RUT: ${escapeHtml(p.rut || "-")} | Ficha: ${escapeHtml(p.recordNumber || "-")}</div>
                  ${p.allergies ? `<div class="text-[11px] font-bold text-rose-600">🚨 RAM: ${escapeHtml(p.allergies)}</div>` : ""}
                  ${p.letStatus ? `<div class="text-[11px] font-semibold text-purple-600">⚖️ ${escapeHtml(p.letStatus)}</div>` : ""}
                </td>
                <td class="p-3">
                  <div class="font-bold text-teal-700">Día ${Number(p.hospDays || 1)} Hosp</div>
                  ${o2Text !== "Ambiental" ? `<div class="text-[11px] text-sky-700">🫁 ${escapeHtml(o2Text)}</div>` : ""}
                  ${p.isolationType && p.isolationType !== "none" ? `<span class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${iso.badgeClass}">${iso.label}</span>` : ""}
                  ${(p.pathogens || []).map(ag => `<div class="text-[11px] font-semibold text-amber-700">🦠 ${escapeHtml(ag)}</div>`).join("")}
                </td>
                <td class="p-3 max-w-xs space-y-1">
                  <div class="font-semibold whitespace-pre-line">${diagHTML}</div>
                  ${planHTML ? `<div class="text-slate-600 dark:text-slate-400 whitespace-pre-line"><strong>Plan:</strong> ${planHTML}</div>` : ""}
                  ${labsHTML ? `<div class="font-mono text-[11px] text-indigo-700 dark:text-indigo-300 whitespace-pre-line"><strong>Labs:</strong> ${labsHTML}</div>` : ""}
                </td>
                <td class="p-3 max-w-xs space-y-1">
                  ${(p.antibiotics || []).map(a => `<div class="font-bold text-cyan-700">💊 ${escapeHtml(a.name)} (${escapeHtml(a.dose)}) D${a.currentDay}/${a.targetDays}</div>`).join("")}
                  ${(p.devices || []).map(d => `<span class="inline-block mr-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">🔌 ${escapeHtml(d.name)} D${d.days}</span>`).join("")}
                  ${p.hospitalMedications ? `<div class="text-[11px] text-slate-500 whitespace-pre-line">${escapeHtml(p.hospitalMedications)}</div>` : ""}
                </td>
                <td class="p-3">
                  ${pending.length ? pending.map(t => `<div class="mb-1">• ${escapeHtml(t.text)} ${formatTaskTimingBadge(t)}</div>`).join("") : `<span class="text-slate-400">Sin pendientes</span>`}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function copySummaryToWhatsApp() {
  const list = getFilteredSummaryBeds();
  if (!list.length) {
    showToast("No hay pacientes en la vista actual", "warning");
    return;
  }
  const lines = [`🏥 *ENTREGA DE VISITA — ${appState.hospitalName}*`, ""];
  list.forEach(({ service, room, bed }) => {
    const p = bed.patient || {};
    let o2Text = (p.vitals && p.vitals.o2Type && p.vitals.o2Type !== "Ambiental") ? `${p.vitals.o2Type} ${p.vitals.o2Liters}` : (p.oxygenSupport || "Amb");
    
    lines.push(`🛏️ *[${service.name} - ${room.name}] ${bed.code}* — *${p.name || "Sin nombre"}* (${p.age ? p.age + "a" : ""}, RUT: ${p.rut || "-"})`);
    lines.push(`• Día ${p.hospDays || 1} Hosp | O2: ${o2Text} ${p.allergies ? `| 🚨 RAM: ${p.allergies}` : ""}`);
    
    let dgText = Array.isArray(p.diagnoses) ? p.diagnoses.map(d=>d.main).join(" / ") : (p.diagnoses ? p.diagnoses.replace(/\n/g, " / ") : "");
    if (dgText) lines.push(`• Dg: ${dgText}`);
    
    let labsText = (p.labs && p.labs.length) ? p.labs.map(l => l.exams.map(e => e.name + ' ' + e.value).join(', ')).join(' | ') : (p.labsSummary ? p.labsSummary.replace(/\n/g, " | ") : "");
    if (labsText) lines.push(`• Labs: ${labsText}`);
    
    if (p.antibiotics?.length) lines.push(`• ATB: ${p.antibiotics.map(a => `${a.name} D${a.currentDay}/${a.targetDays}`).join(", ")}`);
    
    let planStr = p.evolution?.subjective ? (p.evolution.subjective + " " + p.evolution.currentStatus) : p.clinicalPlan;
    if (planStr) lines.push(`• Plan: ${planStr.replace(/\n/g, " ")}`);
    
    const pend = (p.tasks || []).filter(t => !t.completed);
    if (pend.length) lines.push(`• 📌 Pendientes: ${pend.map(t => t.text).join(" | ")}`);
    lines.push("");
  });
  copyTextToClipboard(lines.join("\n"));
  showToast("📲 Resumen copiado para pegar en WhatsApp");
}
// =========================================================================
// 8.5 LÓGICA DE PESTAÑAS, DOM DINÁMICO Y AUTOCOMPLETADO (NUEVO v3.0)
// =========================================================================

// 1. Navegación de Pestañas del Modal
function switchBedModalTab(tabId) {
  // Ocultar todas las pestañas
  document.querySelectorAll('.bed-modal-tab').forEach(tab => tab.classList.add('hidden'));
  
  // Reiniciar diseño de todos los botones de la barra superior
  const btns = ['btn-tab-ingreso', 'btn-tab-historia', 'btn-tab-clinica', 'btn-tab-gestion'];
  btns.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if(btn) btn.className = "px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap transition";
  });

  // Mostrar la pestaña seleccionada y pintar su botón de activo
  document.getElementById(tabId).classList.remove('hidden');
  const activeBtn = document.getElementById('btn-' + tabId);
  if(activeBtn) activeBtn.className = "px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 border-teal-600 text-teal-700 dark:text-teal-400 whitespace-nowrap transition";
}

// 2. Función base para borrar cualquier fila dinámica
function removeRowElement(btn) {
  btn.parentElement.remove();
}

// 3. Ocultar/Mostrar litros de O2
function toggleModalO2Liters(selectElement) {
  const input = document.getElementById('v-o2-lit');
  if (selectElement.value === 'Ambiental') {
    input.classList.add('hidden');
    input.value = "";
  } else {
    input.classList.remove('hidden');
  }
}

// 4. Generadores Dinámicos de Filas (DOM Injection)

// 4.1 Antecedentes Generales (Médicos, Quirúrgicos, Hábitos, Fármacos)
function addHistoryItem(containerId, datalistId, placeholder, value = "") {
  const container = document.getElementById(containerId);
  container.insertAdjacentHTML('beforeend', `
    <div class="flex items-center gap-1.5 c-history-item relative">
      <span class="text-slate-400 text-lg leading-none font-bold mt-1">•</span>
      <input type="text" list="${datalistId}" value="${escapeHtml(value)}" placeholder="${placeholder}" class="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 dark:bg-slate-900 history-val" />
      <button type="button" onclick="removeRowElement(this)" class="text-rose-500 hover:text-rose-700 font-bold px-1">✕</button>
    </div>
  `);
}

// 4.2 Cirugías Actuales (Con selector de DPO)
function addCurrentSurgery(name = "", dpo = "0") {
  let options = '<option value="0">DPO 0 (Día Cx)</option>';
  for(let i = 1; i <= 30; i++) options += `<option value="${i}">DPO ${i}</option>`;
  options += '<option value=">30">DPO >30</option>';
  
  document.getElementById('modalCurrentSurgeriesList').insertAdjacentHTML('beforeend', `
    <div class="flex flex-col sm:flex-row gap-1.5 bg-rose-50/50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-100 dark:border-rose-900/50 c-surgery-item relative pr-6">
      <button type="button" onclick="removeRowElement(this)" class="absolute right-1 top-2 text-rose-500 hover:text-rose-700 font-bold px-1">✕</button>
      <input type="text" list="lista-cirugias" value="${escapeHtml(name)}" placeholder="Cirugía (Ej: Apendicectomía)" class="w-full sm:w-2/3 px-2 py-1.5 rounded-lg text-xs font-semibold border dark:border-slate-700 dark:bg-slate-900 surg-name" />
      <select class="w-full sm:w-1/3 px-2 py-1.5 rounded-lg text-xs font-bold border dark:border-slate-700 dark:bg-slate-900 surg-dpo">
        ${options}
      </select>
    </div>
  `);
  // Autoseleccionar el DPO si viene con valor
  const selects = document.querySelectorAll('.c-surgery-item .surg-dpo');
  selects[selects.length - 1].value = dpo;
}

// 4.3 Diagnósticos y Observaciones
function addDiagnosis(main = "") {
  const uniqueId = 'dx-' + Date.now();
  document.getElementById('modalDiagnosesList').insertAdjacentHTML('beforeend', `
    <div class="bg-indigo-50/30 dark:bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 c-diag-item relative">
      <button type="button" onclick="removeRowElement(this)" class="absolute right-1 top-2 text-rose-500 hover:text-rose-700 font-bold px-2">✕</button>
      <div class="flex gap-1.5 mb-1.5 pr-6">
        <span class="text-indigo-600 font-bold mt-1.5">•</span>
        <input type="text" list="lista-diagnosticos" value="${escapeHtml(main)}" placeholder="Diagnóstico principal" class="w-full px-2 py-1.5 rounded-lg text-sm font-bold border border-indigo-200 dark:border-indigo-700 dark:bg-slate-900 diag-main" />
      </div>
      <div id="${uniqueId}-obs" class="space-y-1 pl-4"></div>
      <button type="button" onclick="addDiagnosisObservation('${uniqueId}')" class="text-[10px] text-indigo-600 font-semibold ml-4 mt-1 hover:underline">+ Añadir observación o complicación</button>
    </div>
  `);
}

function addDiagnosisObservation(containerId, obsValue = "") {
  document.getElementById(containerId + '-obs').insertAdjacentHTML('beforeend', `
    <div class="flex items-center gap-1.5 c-diag-obs">
      <span class="text-slate-400 text-[10px]">↳</span>
      <input type="text" value="${escapeHtml(obsValue)}" placeholder="Observación..." class="w-full px-2 py-1 rounded text-xs border dark:border-slate-700 dark:bg-slate-800 obs-val" />
      <button type="button" onclick="removeRowElement(this)" class="text-rose-500 hover:text-rose-700 font-bold px-1">✕</button>
    </div>
  `);
}

// 4.4 Laboratorios con Autocompletado de Unidades
function addLabBlock(dateVal = "") {
  const uniqueId = 'lab-' + Date.now();
  const defaultDate = dateVal || new Date().toISOString().slice(0, 10);
  document.getElementById('modalLabsContainer').insertAdjacentHTML('beforeend', `
    <div class="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 c-lab-block relative">
      <button type="button" onclick="removeRowElement(this)" class="absolute right-2 top-2 text-rose-500 hover:text-rose-700 font-bold px-1.5">✕</button>
      <div class="flex items-center gap-2 mb-2 pr-6">
        <span class="text-xs font-bold text-emerald-800 dark:text-emerald-400">Fecha del Examen:</span>
        <input type="date" value="${defaultDate}" class="px-2 py-1 rounded-lg text-xs border border-emerald-300 dark:border-emerald-700 dark:bg-slate-900 lab-date" />
      </div>
      <div id="${uniqueId}-rows" class="space-y-1.5"></div>
      <button type="button" onclick="addLabRow('${uniqueId}')" class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold mt-2 border border-emerald-200 hover:bg-emerald-100">+ Añadir Resultado</button>
    </div>
  `);
  if(!dateVal) addLabRow(uniqueId); // Agrega una fila por defecto si es bloque nuevo
}

function addLabRow(containerId, name="", val="", unit="") {
  document.getElementById(containerId + '-rows').insertAdjacentHTML('beforeend', `
    <div class="flex items-center gap-1 c-lab-row">
      <input type="text" list="lista-examenes" oninput="autoCompletarUnidad(this)" value="${escapeHtml(name)}" placeholder="Examen (Ej: PCR)" class="w-2/5 px-2 py-1.5 rounded-lg text-xs font-semibold border dark:border-slate-700 dark:bg-slate-900 lab-name" />
      <input type="text" value="${escapeHtml(val)}" placeholder="Valor" class="w-1/4 px-2 py-1.5 rounded-lg text-xs font-bold border dark:border-slate-700 dark:bg-slate-900 lab-val" />
      <input type="text" value="${escapeHtml(unit)}" placeholder="Unidad" class="w-1/4 px-2 py-1.5 rounded-lg text-xs text-slate-500 border dark:border-slate-700 dark:bg-slate-900 lab-unit" />
      <button type="button" onclick="removeRowElement(this)" class="w-1/10 text-rose-500 hover:text-rose-700 font-bold px-1 text-center">✕</button>
    </div>
  `);
}

// Esta es la función mágica que usabas en el Sidebar
function autoCompletarUnidad(inputElement) {
  const unitInput = inputElement.parentElement.querySelector('.lab-unit');
  const examName = inputElement.value;
  if (typeof CATALOGO_EXAMENES !== 'undefined' && CATALOGO_EXAMENES[examName]) {
    unitInput.value = CATALOGO_EXAMENES[examName];
  }
}

// 4.5 Imágenes
function addImageRecord(name="", date="", desc="") {
  document.getElementById('modalImagesContainer').insertAdjacentHTML('beforeend', `
    <div class="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 c-img-record relative pr-6">
      <button type="button" onclick="removeRowElement(this)" class="absolute right-1 top-2 text-rose-500 hover:text-rose-700 font-bold px-1.5">✕</button>
      <div class="flex flex-col sm:flex-row gap-1.5 mb-1.5">
        <input type="text" list="lista-imagenes" value="${escapeHtml(name)}" placeholder="Examen (Ej: TAC Abdomen)" class="w-full sm:w-2/3 px-2 py-1.5 rounded-lg text-xs font-semibold border dark:border-slate-700 dark:bg-slate-900 img-name" />
        <input type="date" value="${date}" class="w-full sm:w-1/3 px-2 py-1.5 rounded-lg text-xs border dark:border-slate-700 dark:bg-slate-900 img-date" />
      </div>
      <textarea rows="1" placeholder="Hallazgos y descripción..." class="w-full px-2 py-1.5 rounded-lg text-xs border dark:border-slate-700 dark:bg-slate-900 img-desc">${escapeHtml(desc)}</textarea>
    </div>
  `);
}

// 4.6 Planes por Sistema
function addSystemPlan(sys="", planText="") {
  document.getElementById('modalSystemsPlanContainer').insertAdjacentHTML('beforeend', `
    <div class="flex flex-col gap-1 c-sys-plan relative bg-indigo-50/30 dark:bg-indigo-950/20 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
      <button type="button" onclick="removeRowElement(this)" class="absolute right-1 top-1 text-rose-500 hover:text-rose-700 font-bold px-1.5">✕</button>
      <select class="w-3/4 px-2 py-1 rounded text-[11px] font-bold border-none bg-transparent text-indigo-700 dark:text-indigo-400 sys-name">
        <option value="QUIRÚRGICO">🔪 QUIRÚRGICO</option><option value="ANALGESIA">💊 ANALGESIA</option><option value="SÉPTICO">🦠 SÉPTICO</option><option value="NUTRICIONAL / FLUIDOS">💧 NUTRICIONAL / FLUIDOS</option><option value="METABÓLICO">⚖️ METABÓLICO</option><option value="KINÉSICO/FONOAUDIO">🏃 KINÉSICO/FONOAUDIO</option><option value="CARDIOVASCULAR">❤️ CARDIOVASCULAR</option><option value="RESPIRATORIO">🫁 RESPIRATORIO</option><option value="OTROS">📌 OTROS</option>
      </select>
      <textarea rows="1" placeholder="Plan para este sistema..." class="w-full px-2 py-1.5 rounded-lg text-xs border dark:border-slate-700 dark:bg-slate-900 sys-plan">${escapeHtml(planText)}</textarea>
    </div>
  `);
  if (sys) {
    const selects = document.querySelectorAll('.c-sys-plan .sys-name');
    selects[selects.length - 1].value = sys;
  }
}
// =========================================================================
// 9. MODAL DE FICHA CLÍNICA COMPLETA (CON GUARDADO SEGURO AUTOMÁTICO)
// =========================================================================
function openBedModal(serviceId, roomId, bedId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found || !found.bed) return;
  currentEditingRef = { serviceId, roomId, bedId };
  const { service, room, bed } = found;
  
  // Usar el nuevo JSON estructurado si no existe
  const p = bed.patient || createEmptyPatient();
  // Asegurar retrocompatibilidad si la cama venía de la v2.0
  if (!p.vitals) Object.assign(p, createEmptyPatient(), bed.patient);

  // --- TOP HEADER ---
  document.getElementById("modalBedCodeBadge").textContent = bed.code;
  document.getElementById("modalRoomTitle").textContent = `${service.icon} ${service.name} — 🚪 ${room.name}`;
  
  // --- PESTAÑA 1: INGRESO Y ALERTAS ---
  document.getElementById("fieldBedCode").value = bed.code;
  document.getElementById("fieldBedStatus").value = bed.status || "occupied";
  
  const srvSel = document.getElementById("fieldPatientServiceId");
  const ownerSrvId = bed.patientServiceId || service.id;
  srvSel.innerHTML = appState.services.map(s => `<option value="${s.id}" ${s.id === ownerSrvId ? "selected" : ""}>${escapeHtml(s.icon)} ${escapeHtml(s.name)} ${s.id !== service.id ? `(Ectópico)` : ``}</option>`).join("");

  document.getElementById("fieldIsMyBed").checked = !!bed.isMyBed;
  document.getElementById("fieldSeenToday").checked = !!bed.seenToday;

  document.getElementById("fieldPatientAllergies").value = p.allergies || "";
  document.getElementById("fieldPatientLet").value = p.letStatus || "Full / Sin restricción";
  document.getElementById("fieldIsolationType").value = p.isolationType || "none";

  modalTempPathogens = Array.isArray(p.pathogens) ? [...p.pathogens] : [];
  document.getElementById("pathogenSearchInput").value = "";
  renderModalSelectedPathogens();

  document.getElementById("fieldPatientName").value = p.name || "";
  document.getElementById("fieldPatientRut").value = p.rut || "";
  document.getElementById("fieldPatientDob").value = p.dob || "";
  document.getElementById("fieldPatientAge").value = p.age !== undefined ? p.age : "";
  document.getElementById("fieldPatientRecordNumber").value = p.recordNumber || "";
  document.getElementById("fieldPatientPhone").value = p.phone || "";
  document.getElementById("fieldPatientAddress").value = p.address || "";
  document.getElementById("fieldAdmissionDate").value = p.admissionDate || new Date().toISOString().slice(0, 10);
  document.getElementById("fieldHospDays").value = p.hospDays !== undefined ? p.hospDays : 1;

  // --- PESTAÑA 2: HISTORIA Y EXAMEN FÍSICO ---
  const clearList = (id) => { document.getElementById(id).innerHTML = ''; };
  clearList('modalMedHistoryList'); clearList('modalSurgHistoryList'); clearList('modalHabitsList'); clearList('modalHomeMedsList');
  
  (p.medicalHistory || []).forEach(item => addHistoryItem('modalMedHistoryList', 'lista-enfermedades', 'Patología', item));
  (p.surgicalHistory || []).forEach(item => addHistoryItem('modalSurgHistoryList', 'lista-cirugias', 'Cirugía', item));
  (p.habits || []).forEach(item => addHistoryItem('modalHabitsList', 'lista-habitos', 'Hábito', item));
  (p.homeMedications || []).forEach(item => addHistoryItem('modalHomeMedsList', 'lista-farmacos', 'Fármaco base', item));

  // Signos Vitales
  const vit = p.vitals || {};
  document.getElementById("v-pa").value = vit.pa || "";
  document.getElementById("v-fc").value = vit.fc || "";
  document.getElementById("v-t").value = vit.temp || "";
  document.getElementById("v-fr").value = vit.fr || "";
  document.getElementById("v-sat").value = vit.sat || "";
  document.getElementById("v-hgt").value = vit.hgt || "";
  document.getElementById("v-eva").value = vit.eva || "";
  document.getElementById("v-diu").value = vit.diuresis || "(+)";
  document.getElementById("v-dep").value = vit.bowel || "(+)";
  
  const o2Select = document.getElementById("v-o2-tipo");
  o2Select.value = vit.o2Type || "Ambiental";
  toggleModalO2Liters(o2Select);
  document.getElementById("v-o2-lit").value = vit.o2Liters || "";

  // Examen Físico
  const ef = p.physicalExam || {};
  document.getElementById("ef-gen").value = ef.general || "";
  document.getElementById("ef-car").value = ef.cardiac || "";
  document.getElementById("ef-pul").value = ef.pulmonary || "";
  document.getElementById("ef-abd").value = ef.abdomen || "";
  document.getElementById("ef-ho").value = ef.surgicalWound || "";
  document.getElementById("ef-eeii").value = ef.lowerLimbs || "";
  document.getElementById("ef-neu").value = ef.neuro || "";

  // --- PESTAÑA 3: CLÍNICA Y EXÁMENES ---
  clearList('modalCurrentSurgeriesList');
  (p.currentSurgeries || []).forEach(cx => addCurrentSurgery(cx.name, cx.postOpDay));

  clearList('modalDiagnosesList');
  (p.diagnoses || []).forEach((dx) => {
    addDiagnosis(dx.main);
    const diagItems = document.querySelectorAll('.c-diag-item');
    const lastDiag = diagItems[diagItems.length - 1];
    const obsContainerId = lastDiag.querySelector('div[id$="-obs"]').id.replace('-obs', '');
    (dx.observations || []).forEach(obs => addDiagnosisObservation(obsContainerId, obs));
  });

  const evo = p.evolution || {};
  document.getElementById("evo-sub").value = evo.subjective || "";
  document.getElementById("evo-act").value = evo.currentStatus || "";

  clearList('modalLabsContainer');
  (p.labs || []).forEach(lab => {
    addLabBlock(lab.date);
    const labBlocks = document.querySelectorAll('.c-lab-block');
    const lastBlock = labBlocks[labBlocks.length - 1];
    const rowsContainer = lastBlock.querySelector('div[id$="-rows"]');
    rowsContainer.innerHTML = ''; // Limpiar la fila vacía por defecto
    const blockId = rowsContainer.id.replace('-rows', '');
    (lab.exams || []).forEach(ex => addLabRow(blockId, ex.name, ex.value, ex.unit));
  });

  clearList('modalImagesContainer');
  (p.images || []).forEach(img => addImageRecord(img.name, img.date, img.description));

  // --- PESTAÑA 4: GESTIÓN Y TAREAS ---
  clearList('modalSystemsPlanContainer');
  (p.systemsPlan || []).forEach(sys => addSystemPlan(sys.system, sys.plan));
  
  document.getElementById("fieldMedications").value = p.hospitalMedications || "";

  modalTempAtbs = Array.isArray(p.antibiotics) ? JSON.parse(JSON.stringify(p.antibiotics)) : [];
  modalTempDevices = Array.isArray(p.devices) ? JSON.parse(JSON.stringify(p.devices)) : [];
  modalTempTasks = Array.isArray(p.tasks) ? JSON.parse(JSON.stringify(p.tasks)) : [];

  renderModalAtbList();
  renderModalDevicesList();
  renderModalTasksList();

  // Resetear a la pestaña 1
  modalTempMilestones = Array.isArray(p.clinicalMilestones) ? [...p.clinicalMilestones] : [];
  document.getElementById("newMilestoneDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("newMilestoneText").value = "";
  renderModalMilestones();
  switchBedModalTab('tab-ingreso');

  const backdrop = document.getElementById("bedModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeBedModal() {
  const backdrop = document.getElementById("bedModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
  document.getElementById("pathogenDropdown").classList.add("hidden");
  currentEditingRef = null;
}

function formatRutInput(input) {
  let clean = input.value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length <= 1) {
    input.value = clean;
    return;
  }
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dv = clean.slice(-1);
  input.value = `${body}-${dv}`;
}

function calculateAgeFromDob() {
  const dobVal = document.getElementById("fieldPatientDob").value;
  if (!dobVal) return;
  const dob = new Date(dobVal);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  if (age >= 0 && age <= 130) document.getElementById("fieldPatientAge").value = age;
}

function calculateHospDaysFromDate() {
  const admVal = document.getElementById("fieldAdmissionDate").value;
  if (!admVal) return;
  const diff = Math.max(1, Math.ceil((new Date() - new Date(admVal)) / (1000 * 60 * 60 * 24)));
  document.getElementById("fieldHospDays").value = diff;
}

function adjustHospDays(delta) {
  const inp = document.getElementById("fieldHospDays");
  inp.value = Math.max(0, Number(inp.value || 0) + delta);
}

// Autocompletado de 200 Patógenos
function handlePathogenAutocomplete(query) {
  const dropdown = document.getElementById("pathogenDropdown");
  const q = (query || "").trim().toLowerCase();
  const matches = HOSPITAL_PATHOGENS_DB.filter(item =>
    !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
  ).slice(0, 35);

  if (!matches.length) {
    dropdown.classList.add("hidden");
    return;
  }

  dropdown.innerHTML = matches.map(item => {
    const isoMeta = getIsolationMeta(item.suggestedIsolation);
    return `
      <button type="button" onclick="selectPathogenFromAutocomplete('${escapeHtml(item.name)}', '${item.suggestedIsolation}')" class="w-full px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs">
        <span class="font-semibold truncate">🦠 ${escapeHtml(item.name)}</span>
        ${item.suggestedIsolation !== "none" ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${isoMeta.badgeClass} shrink-0">Sugiere: ${isoMeta.short}</span>` : ""}
      </button>
    `;
  }).join("");
  dropdown.classList.remove("hidden");
}

function selectPathogenFromAutocomplete(name, suggestedIsolation) {
  if (!modalTempPathogens.includes(name)) modalTempPathogens.push(name);
  const isoSelect = document.getElementById("fieldIsolationType");
  if (isoSelect.value === "none" && suggestedIsolation && suggestedIsolation !== "none") {
    isoSelect.value = suggestedIsolation;
    showToast(`⚠️ Aislamiento sugerido activado: ${getIsolationMeta(suggestedIsolation).label}`, "info");
  }
  document.getElementById("pathogenSearchInput").value = "";
  document.getElementById("pathogenDropdown").classList.add("hidden");
  renderModalSelectedPathogens();
}

function addCustomPathogenFromInput() {
  const inp = document.getElementById("pathogenSearchInput");
  const val = inp.value.trim();
  if (val && !modalTempPathogens.includes(val)) modalTempPathogens.push(val);
  inp.value = "";
  document.getElementById("pathogenDropdown").classList.add("hidden");
  renderModalSelectedPathogens();
}

function removePathogenFromModal(idx) {
  modalTempPathogens.splice(idx, 1);
  renderModalSelectedPathogens();
}

function renderModalSelectedPathogens() {
  const container = document.getElementById("selectedPathogensContainer");
  if (!modalTempPathogens.length) {
    container.innerHTML = `<span class="text-[11px] text-slate-400">Ningún microorganismo registrado.</span>`;
    return;
  }
  container.innerHTML = modalTempPathogens.map((ag, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-200/80 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200">
      <span>🦠 ${escapeHtml(ag)}</span>
      <button type="button" onclick="removePathogenFromModal(${idx})" class="hover:text-rose-600 font-extrabold">✕</button>
    </span>
  `).join("");
}

// Antibióticos en Modal
function addAntibioticToModal() {
  const name = document.getElementById("newAtbName").value.trim();
  const dose = document.getElementById("newAtbDose").value.trim();
  const currentDay = Number(document.getElementById("newAtbCurrentDay").value || 1);
  const targetDays = Number(document.getElementById("newAtbTargetDays").value || 7);
  if (!name) return;

  modalTempAtbs.push({ id: "atb-" + Date.now(), name, dose: dose || "EV", currentDay, targetDays });
  document.getElementById("newAtbName").value = "";
  document.getElementById("newAtbDose").value = "";
  document.getElementById("newAtbCurrentDay").value = 1;
  document.getElementById("newAtbTargetDays").value = 7;
  renderModalAtbList();
}

function adjustModalAtbDay(idx, delta) {
  if (!modalTempAtbs[idx]) return;
  modalTempAtbs[idx].currentDay = Math.max(0, Number(modalTempAtbs[idx].currentDay || 0) + delta);
  renderModalAtbList();
}

function removeModalAtb(idx) {
  modalTempAtbs.splice(idx, 1);
  renderModalAtbList();
}

function renderModalAtbList() {
  const container = document.getElementById("modalAtbList");
  if (!modalTempAtbs.length) {
    container.innerHTML = `<p class="text-xs text-slate-400">Sin antibióticos activos.</p>`;
    return;
  }
  container.innerHTML = modalTempAtbs.map((atb, idx) => `
    <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs">
      <div>
        <span class="font-bold text-cyan-900 dark:text-cyan-200">💊 ${escapeHtml(atb.name)}</span>
        <span class="text-slate-500 ml-1">(${escapeHtml(atb.dose)})</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="adjustModalAtbDay(${idx}, -1)" class="w-5 h-5 rounded bg-white dark:bg-slate-800 border font-bold">-</button>
        <span class="font-mono font-bold px-1">Día ${atb.currentDay}/${atb.targetDays}</span>
        <button type="button" onclick="adjustModalAtbDay(${idx}, 1)" class="w-5 h-5 rounded bg-white dark:bg-slate-800 border font-bold">+</button>
        <button type="button" onclick="removeModalAtb(${idx})" class="text-slate-400 hover:text-rose-600 ml-1">✕</button>
      </div>
    </div>
  `).join("");
}

// Dispositivos Invasivos en Modal
function addDeviceToModal() {
  const name = document.getElementById("newDeviceNameSelect").value;
  const days = Number(document.getElementById("newDeviceDays").value || 1);
  modalTempDevices.push({ id: "dev-" + Date.now(), name, days });
  document.getElementById("newDeviceDays").value = 1;
  renderModalDevicesList();
}

function removeModalDevice(idx) {
  modalTempDevices.splice(idx, 1);
  renderModalDevicesList();
}

function renderModalDevicesList() {
  const container = document.getElementById("modalDevicesList");
  if (!modalTempDevices.length) {
    container.innerHTML = `<span class="text-xs text-slate-400">Sin dispositivos registrados.</span>`;
    return;
  }
  container.innerHTML = modalTempDevices.map((d, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-200">
      <span>🔌 ${escapeHtml(d.name)} (Día ${d.days})</span>
      <button type="button" onclick="removeModalDevice(${idx})" class="hover:text-rose-600">✕</button>
    </span>
  `).join("");
}

// Pendientes en Modal
function toggleModalTaskDaysInput() {
  const val = document.getElementById("modalTaskTiming").value;
  document.getElementById("modalTaskDaysNumber").classList.toggle("hidden", val !== "in_days");
}

// =========================================================================
// 10. GESTIÓN DE PENDIENTES (TAREAS Y ALERTAS) EN MODAL v3.0
// =========================================================================

function toggleTaskDaysInput() {
  const t = document.getElementById("modalTaskTiming");
  const d = document.getElementById("modalTaskDays");
  // Ya no ocultamos la hora, dejamos que el usuario siempre pueda poner una hora exacta.
  if (t && d) {
    if (t.value === "in_days") d.classList.remove("hidden");
    else d.classList.add("hidden");
  }
}

function addTaskInsideModal() {
  const textEl = document.getElementById("modalTaskText");
  const catEl = document.getElementById("modalTaskCategory");
  const timeEl = document.getElementById("modalTaskTiming");
  const daysEl = document.getElementById("modalTaskDays");
  const exactTimeEl = document.getElementById("modalTaskExactTime");

  const text = textEl.value.trim();
  if (!text) return;

  const task = {
    id: "tsk_" + Date.now(),
    text: text,
    category: catEl ? catEl.value : "📌 General",
    timing: timeEl ? timeEl.value : "today",
    completed: false,
    daysRemaining: (timeEl && timeEl.value === "in_days" && daysEl) ? Number(daysEl.value || 2) : 0,
    exactTime: (exactTimeEl && exactTimeEl.value) ? exactTimeEl.value : "" // Captura blindada de la hora
  };

  modalTempTasks.push(task);
  
  // Limpiar campos
  textEl.value = "";
  if(daysEl) daysEl.value = "";
  if(exactTimeEl) exactTimeEl.value = "";
  renderModalTasksList();
}

function renderModalTasksList() {
  const container = document.getElementById("modalTasksContainer");
  if (!container) return;
  container.innerHTML = "";

  if (modalTempTasks.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic p-2 text-center">No hay pendientes registrados.</p>`;
    return;
  }

  modalTempTasks.forEach((t, i) => {
    const bg = t.completed ? "bg-slate-50 dark:bg-slate-800/50 opacity-60" : "bg-white dark:bg-slate-800";
    const textDeco = t.completed ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200 font-medium";

    let timeBadge = "";
    if (!t.completed) {
        if (t.timing === "today") timeBadge = `<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">Hoy</span>`;
        else if (t.timing === "tomorrow") timeBadge = `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">Mañana</span>`;
        else if (t.timing === "in_days") timeBadge = `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">En ${t.daysRemaining || 1}d</span>`;
        
        // Renderizar la hora si existe
        if (t.exactTime) timeBadge += ` <span class="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] font-extrabold flex items-center gap-0.5">🕒 ${t.exactTime}</span>`;
    }

    container.insertAdjacentHTML('beforeend', `
      <div class="flex items-center justify-between p-2 mb-1.5 border border-slate-200 dark:border-slate-700 rounded-lg ${bg}">
        <div class="flex items-center gap-2 overflow-hidden flex-1 pr-2">
          <input type="checkbox" ${t.completed ? "checked" : ""} onchange="toggleModalTask(${i})" class="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer shrink-0">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">${escapeHtml(t.category)}</span>
          <span class="text-xs truncate ${textDeco}">${escapeHtml(t.text)}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${timeBadge}
          <button type="button" onclick="deleteModalTask(${i})" class="text-rose-400 hover:text-rose-600 font-bold px-1.5 py-0.5">✕</button>
        </div>
      </div>
    `);
  });
}

function formatTaskTimingBadge(t) {
  if (t.completed) return "";
  let b = "";
  if (t.timing === "today") b = "[Hoy]";
  else if (t.timing === "tomorrow") b = "[Mañana]";
  else if (t.timing === "in_days") b = `[En ${t.daysRemaining}d]`;
  
  if (t.exactTime) b += ` 🕒 ${t.exactTime}`;
  return b;
}

function toggleModalTask(index) {
  if(modalTempTasks[index]) {
    modalTempTasks[index].completed = !modalTempTasks[index].completed;
    renderModalTasksList();
  }
}

function deleteModalTask(index) {
  modalTempTasks.splice(index, 1);
  renderModalTasksList();
}
function saveBedModal() {
  if (!currentEditingRef) return;
  const found = findEntity(currentEditingRef.serviceId, currentEditingRef.roomId, currentEditingRef.bedId);
  if (!found || !found.bed) return;
  const { bed } = found;

  // Guardado automático de inputs residuales
  if (document.getElementById("newAtbName").value.trim()) addAntibioticToModal();
  if (document.getElementById("modalTaskText").value.trim()) addTaskInsideModal();
  if (document.getElementById("pathogenSearchInput").value.trim()) addCustomPathogenFromInput();

  const patientName = document.getElementById("fieldPatientName").value.trim();
  let statusVal = document.getElementById("fieldBedStatus").value;
  if (statusVal === "free" && patientName) statusVal = "occupied";

  bed.code = document.getElementById("fieldBedCode").value.trim() || bed.code;
  bed.status = statusVal;
  bed.patientServiceId = document.getElementById("fieldPatientServiceId").value;
  bed.isMyBed = document.getElementById("fieldIsMyBed").checked;
  bed.seenToday = document.getElementById("fieldSeenToday").checked;

  const extractVals = (selector) => Array.from(document.querySelectorAll(selector)).map(i => i.value.trim()).filter(Boolean);

  // Reconstrucción del JSON estructurado
  bed.patient = {
    name: patientName,
    rut: document.getElementById("fieldPatientRut").value.trim(),
    dob: document.getElementById("fieldPatientDob").value,
    age: document.getElementById("fieldPatientAge").value,
    recordNumber: document.getElementById("fieldPatientRecordNumber").value.trim(),
    phone: document.getElementById("fieldPatientPhone").value.trim(),
    address: document.getElementById("fieldPatientAddress").value.trim(),
    admissionDate: document.getElementById("fieldAdmissionDate").value,
    hospDays: Number(document.getElementById("fieldHospDays").value || 1),

    allergies: document.getElementById("fieldPatientAllergies").value.trim(),
    letStatus: document.getElementById("fieldPatientLet").value,
    isolationType: document.getElementById("fieldIsolationType").value,
    
    // El soporte de O2 se deriva del CSV para mantener compatibilidad gráfica externa
    oxygenSupport: document.getElementById("v-o2-tipo").value === "Ambiental" ? "Ambiental" : `${document.getElementById("v-o2-tipo").value} ${document.getElementById("v-o2-lit").value}`,

    medicalHistory: extractVals('#modalMedHistoryList .history-val'),
    surgicalHistory: extractVals('#modalSurgHistoryList .history-val'),
    habits: extractVals('#modalHabitsList .history-val'),
    homeMedications: extractVals('#modalHomeMedsList .history-val'),

    currentSurgeries: Array.from(document.querySelectorAll('.c-surgery-item')).map(item => ({
      name: item.querySelector('.surg-name').value.trim(),
      postOpDay: item.querySelector('.surg-dpo').value
    })).filter(cx => cx.name),

    diagnoses: Array.from(document.querySelectorAll('.c-diag-item')).map(item => ({
      main: item.querySelector('.diag-main').value.trim(),
      observations: Array.from(item.querySelectorAll('.obs-val')).map(i => i.value.trim()).filter(Boolean)
    })).filter(dx => dx.main),

    evolution: {
      subjective: document.getElementById("evo-sub").value.trim(),
      currentStatus: document.getElementById("evo-act").value.trim()
    },

    vitals: {
      pa: document.getElementById("v-pa").value.trim(),
      fc: document.getElementById("v-fc").value.trim(),
      temp: document.getElementById("v-t").value.trim(),
      fr: document.getElementById("v-fr").value.trim(),
      sat: document.getElementById("v-sat").value.trim(),
      o2Type: document.getElementById("v-o2-tipo").value,
      o2Liters: document.getElementById("v-o2-lit").value.trim(),
      hgt: document.getElementById("v-hgt").value.trim(),
      eva: document.getElementById("v-eva").value.trim(),
      diuresis: document.getElementById("v-diu").value.trim(),
      bowel: document.getElementById("v-dep").value.trim()
    },

    physicalExam: {
      general: document.getElementById("ef-gen").value.trim(),
      cardiac: document.getElementById("ef-car").value.trim(),
      pulmonary: document.getElementById("ef-pul").value.trim(),
      abdomen: document.getElementById("ef-abd").value.trim(),
      surgicalWound: document.getElementById("ef-ho").value.trim(),
      lowerLimbs: document.getElementById("ef-eeii").value.trim(),
      neuro: document.getElementById("ef-neu").value.trim(),
      others: []
    },

    labs: Array.from(document.querySelectorAll('.c-lab-block')).map(block => ({
      date: block.querySelector('.lab-date').value,
      exams: Array.from(block.querySelectorAll('.c-lab-row')).map(row => ({
        name: row.querySelector('.lab-name').value.trim(),
        value: row.querySelector('.lab-val').value.trim(),
        unit: row.querySelector('.lab-unit').value.trim()
      })).filter(ex => ex.name && ex.value)
    })).filter(lab => lab.exams.length > 0),

    images: Array.from(document.querySelectorAll('.c-img-record')).map(img => ({
      name: img.querySelector('.img-name').value.trim(),
      date: img.querySelector('.img-date').value,
      description: img.querySelector('.img-desc').value.trim()
    })).filter(img => img.name),

    systemsPlan: Array.from(document.querySelectorAll('.c-sys-plan')).map(sys => ({
      system: sys.querySelector('.sys-name').value,
      plan: sys.querySelector('.sys-plan').value.trim()
    })).filter(sys => sys.plan),

    hospitalMedications: document.getElementById("fieldMedications").value.trim(),
    clinicalMilestones: [...modalTempMilestones],

    // Vectores dinámicos conservados
    pathogens: [...modalTempPathogens],
    antibiotics: [...modalTempAtbs],
    devices: [...modalTempDevices],
    tasks: [...modalTempTasks]
  };

  saveAppState();
  closeBedModal();
  renderAll();
  showToast(`💾 Ficha de ${bed.code} guardada (Estructura v3.0)`);
}
function vacateCurrentBed() {
  if (!currentEditingRef) return;
  const found = findEntity(currentEditingRef.serviceId, currentEditingRef.roomId, currentEditingRef.bedId);
  if (!found?.bed) return;
  if (!confirm(`¿Confirmas dar de alta / liberar la ${found.bed.code} (${found.bed.patient?.name || "Paciente"})?`)) return;

  found.bed.status = "free";
  found.bed.seenToday = false;
  found.bed.isMyBed = false;
  found.bed.patient = createEmptyPatient();
  saveAppState();
  closeBedModal();
  renderAll();
  showToast(`🟢 ${found.bed.code} quedó libre`);
}

function deleteBedFromModal() {
  if (!currentEditingRef) return;
  const { serviceId, roomId, bedId } = currentEditingRef;
  const found = findEntity(serviceId, roomId, bedId);
  if (!found?.room) return;
  if (!confirm(`¿Eliminar la ${found.bed.code} de ${found.room.name}? Las demás camas del servicio se reenumerarán correlativamente.`)) return;

  found.room.beds = found.room.beds.filter(b => b.id !== bedId);
  recalculateServiceBedNumbers(serviceId);
  saveAppState();
  closeBedModal();
  renderAll();
  showToast("🗑️ Cama eliminada y numeración actualizada");
}

// =========================================================================
// 10. TRASLADO / CAMBIO DE CAMA E INTERCAMBIO DE PACIENTES (MOVE / SWAP)
// =========================================================================
function openMovePatientModalFromCurrentBed() {
  if (!currentEditingRef) return;
  const ref = { ...currentEditingRef };
  saveBedModal();
  openMovePatientModal(ref.serviceId, ref.roomId, ref.bedId);
}

function openMovePatientModal(serviceId, roomId, bedId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found?.bed) return;
  currentMoveOriginRef = { serviceId, roomId, bedId };

  document.getElementById("moveModalOriginInfo").textContent =
    `${found.service.name} • ${found.room.name} • ${found.bed.code} — ${found.bed.patient?.name || "Paciente"}`;

  const srvSelect = document.getElementById("moveTargetServiceSelect");
  srvSelect.innerHTML = appState.services.map(s =>
    `<option value="${s.id}" ${s.id === serviceId ? "selected" : ""}>${escapeHtml(s.icon)} ${escapeHtml(s.name)}</option>`
  ).join("");

  populateMoveTargetRooms();

  const backdrop = document.getElementById("movePatientModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeMovePatientModal() {
  const backdrop = document.getElementById("movePatientModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
  currentMoveOriginRef = null;
}

function populateMoveTargetRooms() {
  const srvId = document.getElementById("moveTargetServiceSelect").value;
  const srv = getServiceById(srvId);
  const roomSelect = document.getElementById("moveTargetRoomSelect");
  if (!srv) return;

  roomSelect.innerHTML = srv.rooms.map(r =>
    `<option value="${r.id}">🚪 ${escapeHtml(r.name)} (${escapeHtml(getRoomBedRangeText(r))})</option>`
  ).join("");
  populateMoveTargetBeds();
}

function populateMoveTargetBeds() {
  const srvId = document.getElementById("moveTargetServiceSelect").value;
  const roomId = document.getElementById("moveTargetRoomSelect").value;
  const found = findEntity(srvId, roomId);
  const bedSelect = document.getElementById("moveTargetBedSelect");
  if (!found?.room) return;

  bedSelect.innerHTML = found.room.beds.map(b => {
    const isSameOrigin = currentMoveOriginRef && currentMoveOriginRef.bedId === b.id;
    const statusText = b.status === "occupied"
      ? `🔴 Ocupada por ${b.patient?.name || "Paciente"} (Se intercambiarán)`
      : `🟢 Libre / Disponible`;
    return `<option value="${b.id}" ${isSameOrigin ? "disabled" : ""}>${escapeHtml(b.code)} — ${escapeHtml(statusText)}</option>`;
  }).join("");
}

function confirmMoveOrSwapPatient() {
  if (!currentMoveOriginRef) return;
  const origin = findEntity(currentMoveOriginRef.serviceId, currentMoveOriginRef.roomId, currentMoveOriginRef.bedId);
  const targetSrvId = document.getElementById("moveTargetServiceSelect").value;
  const targetRoomId = document.getElementById("moveTargetRoomSelect").value;
  const targetBedId = document.getElementById("moveTargetBedSelect").value;
  const afterStatus = document.getElementById("moveOriginAfterStatus").value || "free";

  const target = findEntity(targetSrvId, targetRoomId, targetBedId);
  if (!origin?.bed || !target?.bed) return;
  if (origin.bed.id === target.bed.id) {
    showToast("Selecciona una cama distinta a la de origen", "warning");
    return;
  }

  const isSwap = target.bed.status === "occupied";
  if (isSwap) {
    if (!confirm(`La ${target.bed.code} está ocupada por ${target.bed.patient?.name}. ¿Deseas INTERCAMBIAR las camas de ambos pacientes?`)) return;
    const tempSnap = {
      patientServiceId: target.bed.patientServiceId,
      isMyBed: target.bed.isMyBed,
      seenToday: target.bed.seenToday,
      patient: JSON.parse(JSON.stringify(target.bed.patient))
    };

    target.bed.patientServiceId = origin.bed.patientServiceId;
    target.bed.isMyBed = origin.bed.isMyBed;
    target.bed.seenToday = origin.bed.seenToday;
    target.bed.patient = JSON.parse(JSON.stringify(origin.bed.patient));

    origin.bed.patientServiceId = tempSnap.patientServiceId;
    origin.bed.isMyBed = tempSnap.isMyBed;
    origin.bed.seenToday = tempSnap.seenToday;
    origin.bed.patient = tempSnap.patient;

    showToast(`⇄ Pacientes intercambiados entre ${origin.bed.code} y ${target.bed.code}`);
  } else {
    target.bed.status = "occupied";
    target.bed.patientServiceId = origin.bed.patientServiceId || origin.service.id;
    target.bed.isMyBed = origin.bed.isMyBed;
    target.bed.seenToday = origin.bed.seenToday;
    target.bed.patient = JSON.parse(JSON.stringify(origin.bed.patient));

    origin.bed.status = afterStatus;
    origin.bed.isMyBed = false;
    origin.bed.seenToday = false;
    origin.bed.patient = createEmptyPatient();

    showToast(`⇄ Paciente trasladado a ${target.service.name} • ${target.room.name} • ${target.bed.code}`);
  }

  saveAppState();
  closeMovePatientModal();
  renderAll();
}

// =========================================================================
// 11. GESTOR DE SERVICIOS Y SALAS CON NUMERACIÓN CORRELATIVA (1 A N)
// =========================================================================
function openHospitalConfigModal() {
  document.getElementById("configHospitalNameInput").value = appState.hospitalName || "";
  const mySel = document.getElementById("configMyServiceSelect");
  mySel.innerHTML = appState.services.map(s =>
    `<option value="${s.id}" ${s.id === appState.myServiceId ? "selected" : ""}>${escapeHtml(s.icon)} ${escapeHtml(s.name)}</option>`
  ).join("");

  resetServiceForm();
  renderConfigServicesList();
  renderHistorySelect(); // <-- NUEVO: Llena las fechas guardadas

  const backdrop = document.getElementById("hospitalConfigModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}
function closeHospitalConfigModal() {
  const backdrop = document.getElementById("hospitalConfigModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function saveHospitalGeneralConfig() {
  appState.hospitalName = document.getElementById("configHospitalNameInput").value.trim() || "Mi Hospital";
  appState.myServiceId = document.getElementById("configMyServiceSelect").value;
  saveAppState();
  renderAll();
  showToast("🏥 Nombre del hospital y servicio principal actualizados");
}

function renderConfigServicesList() {
  const container = document.getElementById("configServicesListContainer");
  container.innerHTML = appState.services.map(s => {
    const totalBeds = s.rooms.reduce((acc, r) => acc + r.beds.length, 0);
    const pattern = s.rooms.map(r => r.beds.length).join(", ");
    return `
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span class="font-extrabold text-sm">${escapeHtml(s.icon)} ${escapeHtml(s.name)}</span>
          <span class="text-slate-500 ml-2">${s.rooms.length} salas (${totalBeds} camas) • Distribución: <code class="font-mono">[${pattern}]</code></span>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" onclick="loadServiceIntoEditForm('${s.id}')" class="px-2.5 py-1 rounded-lg font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">Editar Estructura</button>
          <button type="button" onclick="deleteService('${s.id}')" class="px-2.5 py-1 rounded-lg font-bold bg-rose-100 text-rose-700">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");
}

function loadServiceIntoEditForm(serviceId) {
  const srv = getServiceById(serviceId);
  if (!srv) return;
  document.getElementById("editingServiceIdInput").value = srv.id;
  document.getElementById("serviceFormTitle").textContent = `✏️ Editando Servicio: ${srv.name}`;
  document.getElementById("serviceNameInput").value = srv.name;
  document.getElementById("serviceIconInput").value = srv.icon || "🏥";
  document.getElementById("serviceStartBedInput").value = srv.startBedNumber || 1;
  document.getElementById("serviceContinuousCheck").checked = srv.continuousNumbering !== false;
  document.getElementById("serviceRoomsPatternInput").value = srv.rooms.map(r => r.beds.length).join(", ");
}

function resetServiceForm() {
  document.getElementById("editingServiceIdInput").value = "";
  document.getElementById("serviceFormTitle").textContent = "➕ Crear Nuevo Servicio con Salas Correlativas";
  document.getElementById("serviceNameInput").value = "";
  document.getElementById("serviceIconInput").value = "🏥";
  document.getElementById("serviceStartBedInput").value = 1;
  document.getElementById("serviceContinuousCheck").checked = true;
  document.getElementById("serviceRoomsPatternInput").value = "";
}

function handleSaveOrCreateService(e) {
  e.preventDefault();
  const editingId = document.getElementById("editingServiceIdInput").value;
  const name = document.getElementById("serviceNameInput").value.trim();
  const icon = document.getElementById("serviceIconInput").value.trim() || "🏥";
  const startBed = Number(document.getElementById("serviceStartBedInput").value || 1);
  const continuous = document.getElementById("serviceContinuousCheck").checked;
  const patternStr = document.getElementById("serviceRoomsPatternInput").value.trim();

  if (!name) return;

  const parsedCounts = patternStr
    ? patternStr.split(",").map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n) && n > 0 && n <= 60)
    : [];

  if (editingId) {
    const srv = getServiceById(editingId);
    if (!srv) return;
    srv.name = name;
    srv.icon = icon;
    srv.startBedNumber = startBed;
    srv.continuousNumbering = continuous;

    if (parsedCounts.length > 0) {
      // Ajustar salas y camas preservando los pacientes ya existentes en ese servicio
      while (srv.rooms.length < parsedCounts.length) {
        const rIdx = srv.rooms.length + 1;
        srv.rooms.push({
          id: `${srv.id}-room-${Date.now()}-${rIdx}`,
          name: `Sala ${rIdx}`,
          roomIsolation: "none",
          roomIsolationNote: "",
          beds: []
        });
      }
      if (srv.rooms.length > parsedCounts.length) {
        srv.rooms = srv.rooms.slice(0, parsedCounts.length);
      }
      parsedCounts.forEach((targetCount, idx) => {
        const room = srv.rooms[idx];
        while (room.beds.length < targetCount) {
          room.beds.push({
            id: `bed-${Date.now()}-${idx}-${room.beds.length + 1}`,
            number: 1,
            code: "Cama",
            status: "free",
            patientServiceId: srv.id,
            isMyBed: false,
            seenToday: false,
            patient: createEmptyPatient()
          });
        }
        if (room.beds.length > targetCount) {
          room.beds = room.beds.slice(0, targetCount);
        }
      });
    }
    recalculateServiceBedNumbers(srv.id);
    showToast(`✅ Servicio ${name} actualizado y camas reenumeradas`);
  } else {
    const counts = parsedCounts.length > 0 ? parsedCounts : [6, 6, 4];
    const newSrv = buildServiceWithCorrelativeRooms("srv-" + Date.now(), name, icon, "teal", startBed, counts);
    newSrv.continuousNumbering = continuous;
    appState.services.push(newSrv);
    showToast(`🏥 Servicio ${name} creado con ${counts.length} salas correlativas`);
  }

  saveAppState();
  resetServiceForm();
  renderConfigServicesList();
  renderAll();
}

function deleteService(serviceId) {
  if (appState.services.length <= 1) {
    showToast("Debe existir al menos 1 servicio en el hospital", "warning");
    return;
  }
  const srv = getServiceById(serviceId);
  if (!srv) return;
  if (!confirm(`¿Seguro que deseas eliminar el servicio "${srv.name}" y todas sus salas?`)) return;

  appState.services = appState.services.filter(s => s.id !== serviceId);
  if (appState.myServiceId === serviceId) appState.myServiceId = appState.services[0].id;
  if (appState.navState.selectedServiceId === serviceId) {
    appState.navState.selectedServiceId = appState.services[0].id;
    appState.navState.level = "services";
  }
  saveAppState();
  renderConfigServicesList();
  renderAll();
}

// Modal de Sala Individual
function openAddRoomModal(serviceId) {
  const srv = getServiceById(serviceId);
  if (!srv) return;
  document.getElementById("editingRoomServiceId").value = srv.id;
  document.getElementById("editingRoomId").value = "";
  document.getElementById("roomModalTitle").textContent = `Nueva Sala en ${srv.name}`;
  document.getElementById("roomNameInput").value = `Sala ${srv.rooms.length + 1}`;
  document.getElementById("roomBedCountInput").value = 6;
  document.getElementById("roomIsolationInput").value = "none";
  document.getElementById("roomIsolationNoteInput").value = "";

  const backdrop = document.getElementById("roomModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function openEditRoomModal(serviceId, roomId) {
  const found = findEntity(serviceId, roomId);
  if (!found?.room) return;
  document.getElementById("editingRoomServiceId").value = serviceId;
  document.getElementById("editingRoomId").value = roomId;
  document.getElementById("roomModalTitle").textContent = `Configurar ${found.room.name} (${found.service.name})`;
  document.getElementById("roomNameInput").value = found.room.name;
  document.getElementById("roomBedCountInput").value = found.room.beds.length;
  document.getElementById("roomIsolationInput").value = found.room.roomIsolation || "none";
  document.getElementById("roomIsolationNoteInput").value = found.room.roomIsolationNote || "";

  const backdrop = document.getElementById("roomModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeRoomModal() {
  const backdrop = document.getElementById("roomModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function saveRoomModal(e) {
  e.preventDefault();
  const serviceId = document.getElementById("editingRoomServiceId").value;
  const roomId = document.getElementById("editingRoomId").value;
  const name = document.getElementById("roomNameInput").value.trim();
  const count = Math.max(1, Math.min(40, Number(document.getElementById("roomBedCountInput").value || 6)));
  const iso = document.getElementById("roomIsolationInput").value;
  const isoNote = document.getElementById("roomIsolationNoteInput").value.trim();

  const srv = getServiceById(serviceId);
  if (!srv) return;

  if (roomId) {
    const room = srv.rooms.find(r => r.id === roomId);
    if (!room) return;
    room.name = name;
    room.roomIsolation = iso;
    room.roomIsolationNote = isoNote;
    while (room.beds.length < count) {
      room.beds.push({
        id: `bed-${Date.now()}-${room.beds.length + 1}`,
        number: 1,
        code: "Cama",
        status: "free",
        patientServiceId: srv.id,
        isMyBed: false,
        seenToday: false,
        patient: createEmptyPatient()
      });
    }
    if (room.beds.length > count) room.beds = room.beds.slice(0, count);
  } else {
    const beds = [];
    for (let i = 0; i < count; i++) {
      beds.push({
        id: `bed-${Date.now()}-${i}`,
        number: 1,
        code: "Cama",
        status: "free",
        patientServiceId: srv.id,
        isMyBed: false,
        seenToday: false,
        patient: createEmptyPatient()
      });
    }
    srv.rooms.push({
      id: `${srv.id}-room-${Date.now()}`,
      name,
      roomIsolation: iso,
      roomIsolationNote: isoNote,
      beds
    });
  }

  recalculateServiceBedNumbers(srv.id);
  saveAppState();
  closeRoomModal();
  renderAll();
  showToast(`🚪 ${name} guardada y numeración correlativa actualizada`);
}

function quickAddBedToRoom(serviceId, roomId) {
  const found = findEntity(serviceId, roomId);
  if (!found?.room) return;
  found.room.beds.push({
    id: "bed-" + Date.now(),
    number: 1,
    code: "Cama",
    status: "free",
    patientServiceId: serviceId,
    isMyBed: false,
    seenToday: false,
    patient: createEmptyPatient()
  });
  recalculateServiceBedNumbers(serviceId);
  saveAppState();
  renderAll();
  showToast(`+ Cama agregada en ${found.room.name} (Numeración correlativa ajustada)`);
}

function deleteRoom(serviceId, roomId) {
  const found = findEntity(serviceId, roomId);
  if (!found?.room) return;
  if (!confirm(`¿Eliminar "${found.room.name}" de ${found.service.name}? Las salas siguientes reajustarán su numeración.`)) return;

  found.service.rooms = found.service.rooms.filter(r => r.id !== roomId);
  recalculateServiceBedNumbers(serviceId);
  saveAppState();
  renderAll();
  showToast("🗑️ Sala eliminada");
}

// =========================================================================
// 12. SISTEMA DE NOTIFICACIONES Y ALERTAS (v3.0 - Nombres Corregidos)
// =========================================================================
function evaluateNotificationsAndBell() {
  updateNotificationBadge();
  // Aquí inyectaremos la lógica del sonido de las alarmas (Punto 4) más adelante
}
function updateNotificationBadge() {
  let count = 0;
  appState.services.forEach(s => s.rooms.forEach(r => r.beds.forEach(b => {
    if (b.status === "occupied" && b.patient && b.patient.tasks) {
      count += b.patient.tasks.filter(t => !t.completed).length;
    }
  })));
  
  // Usando tu ID exacto: notifBellBadge
  const badge = document.getElementById("notifBellBadge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }
}
// Función para pedir permiso de notificaciones al navegador/celular
function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Tu navegador o dispositivo no soporta notificaciones web.");
    return;
  }
  
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      alert("¡Notificaciones activadas con éxito! Ahora recibirás alertas de tus pendientes.");
      const btn = document.getElementById("enableBrowserNotifBtn");
      if (btn) btn.classList.add("hidden");
    } else {
      alert("Permiso denegado. Puedes cambiarlo en la configuración de tu navegador.");
    }
  });
}
// Usando tu función exacta: toggleNotificationDrawer
function toggleNotificationDrawer() {
  // Asumo que el contenedor se llama notificationDrawer. Si tiene otro id, cámbialo aquí:
  const drop = document.getElementById("notificationDrawer"); 
  if (!drop) return;
  
  if (drop.classList.contains("hidden")) {
    renderNotificationsList();
    drop.classList.remove("hidden");
  } else {
    drop.classList.add("hidden");
  }
}

function renderNotificationsList() {
  const container = document.getElementById("notificationListContainer"); 
  if (!container) return;
  container.innerHTML = "";

  // Ocultar botón si ya hay permiso
  const enableBtn = document.getElementById("enableBrowserNotifBtn");
  if (enableBtn) {
    if ("Notification" in window && Notification.permission === "granted") {
      enableBtn.classList.add("hidden");
    } else {
      enableBtn.classList.remove("hidden");
    }
  }

  let html = "";
  appState.services.forEach(s => s.rooms.forEach(r => r.beds.forEach(b => {
    if (b.status === "occupied" && b.patient && b.patient.tasks) {
      const pendings = b.patient.tasks.filter(t => !t.completed);
      
      pendings.forEach(t => {
        let timeBadge = "";
        if (t.timing === "today") timeBadge = `<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">Hoy</span>`;
        else if (t.timing === "tomorrow") timeBadge = `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">Mañana</span>`;
        else if (t.timing === "in_days") timeBadge = `<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">En ${t.daysRemaining || 1}d</span>`;

        if (t.exactTime) timeBadge += ` <span class="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold flex items-center gap-1">🕒 ${t.exactTime}</span>`;

        html += `
          <div class="p-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition" onclick="toggleNotificationDrawer(); openBedModal('${s.id}', '${r.id}', '${b.id}')">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded shadow-sm bg-teal-600 text-white text-[10px]">${b.code}</span>
                ${escapeHtml(b.patient.name || "Paciente sin nombre")}
              </span>
              <div class="flex items-center text-[10px] gap-1">${timeBadge}</div>
            </div>
            <div class="text-[11px] text-slate-600 dark:text-slate-300">
              <span class="font-extrabold text-indigo-600 dark:text-indigo-400">[${escapeHtml(t.category)}]</span> ${escapeHtml(t.text)}
            </div>
          </div>
        `;
      });
    }
  })));

  if (!html) {
    html = `<div class="p-6 text-center text-xs font-semibold text-slate-500 italic flex flex-col items-center gap-2"><span class="text-2xl">☕</span>No hay pendientes registrados en todo el servicio.</div>`;
  }
  
  container.innerHTML = html;
}
// =========================================================================
// 13. NUEVO DÍA, EXPORTACIÓN/IMPORTACIÓN (.MD, WHATSAPP Y .JSON)
// =========================================================================
function openNewDayModal() {
  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById("newDayAlreadyRunWarning").classList.toggle("hidden", appState.lastNewDayDate !== todayStr);
  const backdrop = document.getElementById("newDayModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeNewDayModal() {
  const backdrop = document.getElementById("newDayModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function confirmStartNewDay() {
  const resetSeen = document.getElementById("newDayResetSeen").checked;
  const incHosp = document.getElementById("newDayIncrementHosp").checked;
  const incAtb = document.getElementById("newDayIncrementAtb").checked;
  const decTasks = document.getElementById("newDayDecrementTasks").checked;

  const todayStr = new Date().toISOString().slice(0, 10);

  // --- CAPTURA DE HISTORIAL (10 DÍAS MAX) ---
  if (!Array.isArray(appState.history)) appState.history = [];
  
  appState.history.push({
    dateId: Date.now(),
    dateLabel: new Date().toLocaleString("es-CL", { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' }),
    services: JSON.parse(JSON.stringify(appState.services))
  });

  if (appState.history.length > 10) {
    appState.history.shift(); 
  }
  // ------------------------------------------

  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (resetSeen) bed.seenToday = false;
        if (bed.status === "occupied" && bed.patient) {
          const p = bed.patient;
          if (incHosp) {
            p.hospDays = Number(p.hospDays || 0) + 1;
            if (Array.isArray(p.currentSurgeries)) {
              p.currentSurgeries.forEach(cx => {
                if (!isNaN(cx.postOpDay) && cx.postOpDay !== ">30") cx.postOpDay = String(Number(cx.postOpDay) + 1);
              });
            }
          }
          if (incAtb) {
            (p.antibiotics || []).forEach(a => { a.currentDay = Number(a.currentDay || 0) + 1; });
            (p.devices || []).forEach(d => { d.days = Number(d.days || 0) + 1; });
          }
          if (decTasks) {
            (p.tasks || []).forEach(t => {
              if (!t.completed && (t.timing === "in_days" || t.timing === "tomorrow")) {
                t.daysRemaining = Math.max(0, Number(t.daysRemaining || 1) - 1);
                if (t.daysRemaining === 0) t.timing = "today";
              }
            });
          }
        }
      });
    });
  });

  appState.lastNewDayDate = todayStr;
  saveAppState();
  closeNewDayModal();
  renderAll();
  showToast("☀️ ¡Nuevo Día aplicado y turno respaldado!");
}
// Compartir Cama (.md / WhatsApp)
function generateBedMarkdownDocument(service, room, bed) {
  const p = bed.patient || createEmptyPatient();
  const isoMeta = getIsolationMeta(p.isolationType || "none");
  const activeTasks = (p.tasks || []).filter(t => !t.completed);
  let o2Text = (p.vitals && p.vitals.o2Type && p.vitals.o2Type !== "Ambiental") ? `${p.vitals.o2Type} ${p.vitals.o2Liters}` : (p.oxygenSupport || "Ambiental");

  const payload = {
    medipisoVersion: "3.0", exportedAt: new Date().toISOString(),
    originService: service.name, originRoom: room.name, originBed: bed.code,
    patientServiceId: bed.patientServiceId || service.id, patient: p
  };

  return [
    `# 🏥 Pase Clínico — ${p.name || "Paciente"} (${service.name} • ${bed.code})`,
    ``,
    `## 👤 Identificación y Alertas`,
    `- **Nombre:** ${p.name || "-"} (${p.age ? p.age + " años" : "-"})`,
    `- **RUT:** ${p.rut || "-"} | **Ficha:** ${p.recordNumber || "-"}`,
    `- **Alergias (RAM):** ${p.allergies || "No conocidas"} | **LET:** ${p.letStatus || "Full"}`,
    `- **Días Hosp:** Día ${p.hospDays || 1} | **Soporte O₂:** ${o2Text}`,
    `- **Aislamiento:** ${isoMeta.label} ${(p.pathogens?.length) ? `(${p.pathogens.join(", ")})` : ""}`,
    ``,
    `## 🩺 Diagnósticos`,
    ...(Array.isArray(p.diagnoses) ? p.diagnoses.map(d=>`- ${d.main}`) : [`${p.diagnoses || "-"}`]),
    ``,
    `## 📋 Plan Clínico y Laboratorios`,
    `${p.evolution?.subjective ? (p.evolution.subjective + " " + p.evolution.currentStatus) : (p.clinicalPlan || "-")}`,
    ...((p.labs && p.labs.length) ? [`\n**Laboratorios:**\n${p.labs.map(l => `FECHA ${l.date}:\n` + l.exams.map(e => `- ${e.name}: ${e.value} ${e.unit}`).join('\n')).join('\n')}`] : []),
    ``,
    `## 💊 Antibióticos, Dispositivos y Fármacos`,
    ...(p.antibiotics?.length ? p.antibiotics.map(a => `- **ATB:** ${a.name} (${a.dose}) — D${a.currentDay}/${a.targetDays}`) : [`- Sin ATB`]),
    ...(p.devices?.length ? [`- **Dispositivos:** ${p.devices.map(d => `${d.name} (D${d.days})`).join(", ")}`] : []),
    ...(p.hospitalMedications ? [`\n**Indicaciones:**\n${p.hospitalMedications}`] : []),
    ``,
    `## 📌 Pendientes`,
    ...(activeTasks.length ? activeTasks.map(t => `- [${t.category}] ${t.text}`) : [`- Sin pendientes`]),
    ``,
    `---`,
    `<!-- MEDIPISO_JSON_START`,
    JSON.stringify(payload),
    `MEDIPISO_JSON_END -->`
  ].join("\n");
}

function openShareModal(serviceId, roomId, bedId) {
  const found = findEntity(serviceId, roomId, bedId);
  if (!found?.bed) return;
  currentShareRef = { serviceId, roomId, bedId };
  document.getElementById("shareMarkdownPreview").value = generateBedMarkdownDocument(found.service, found.room, found.bed);
  const backdrop = document.getElementById("shareModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function openSharePatientModalFromCurrentBed() {
  if (!currentEditingRef) return;
  const ref = { ...currentEditingRef };
  saveBedModal();
  openShareModal(ref.serviceId, ref.roomId, ref.bedId);
}

function closeShareModal() {
  const backdrop = document.getElementById("shareModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function sendPatientViaWhatsAppDirect() {
  const md = document.getElementById("shareMarkdownPreview").value;
  window.open(`https://wa.me/?text=${encodeURIComponent(md)}`, "_blank");
}

function downloadPatientMarkdownFile() {
  if (!currentShareRef) return;
  const found = findEntity(currentShareRef.serviceId, currentShareRef.roomId, currentShareRef.bedId);
  if (!found?.bed) return;
  const md = document.getElementById("shareMarkdownPreview").value;
  const safeName = (found.bed.patient?.name || found.bed.code).replace(/[^a-zA-Z0-9_-]/g, "_");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `MediPiso_${safeName}.md`;
  link.click();
}

function copyShareMarkdownToClipboard() {
  copyTextToClipboard(document.getElementById("shareMarkdownPreview").value);
  showToast("📋 Ficha .md copiada al portapapeles");
}

// Importar Paciente (.md / WhatsApp)
function openImportPatientModal() {
  document.getElementById("importMarkdownInput").value = "";
  document.getElementById("importDetectedPreviewBox").classList.add("hidden");
  parsedImportPatientData = null;

  const select = document.getElementById("importTargetBedSelect");
  let html = "";
  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        const st = bed.status === "free" ? "🟢 LIBRE" : `🔴 Ocupada (${bed.patient?.name || "Paciente"})`;
        html += `<option value="${srv.id}|${room.id}|${bed.id}">[${escapeHtml(srv.name)}] ${escapeHtml(bed.code)} — ${escapeHtml(room.name)} (${escapeHtml(st)})</option>`;
      });
    });
  });
  select.innerHTML = html;

  const backdrop = document.getElementById("importModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeImportModal() {
  const backdrop = document.getElementById("importModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function handleImportFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("importMarkdownInput").value = e.target.result || "";
    parseIncomingMarkdownPreview();
  };
  reader.readAsText(file);
}

function parseIncomingMarkdownPreview() {
  const raw = document.getElementById("importMarkdownInput").value.trim();
  const box = document.getElementById("importDetectedPreviewBox");
  const summary = document.getElementById("importDetectedSummary");
  if (!raw) {
    box.classList.add("hidden");
    parsedImportPatientData = null;
    return;
  }

  let parsed = null;

  // 1. Intentar parsear como JSON PURO (Nuevo formato de Docs v3.0)
  if (raw.startsWith("{")) {
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.warn("No es un JSON válido, intentando Markdown...");
    }
  }

  // 2. Si no es JSON puro, buscar el bloque antiguo MEDIPISO_JSON_START (Retrocompatibilidad)
  if (!parsed) {
    const jsonMatch = raw.match(/MEDIPISO_JSON_START\s*([\s\S]*?)\s*MEDIPISO_JSON_END/);
    if (jsonMatch && jsonMatch[1]) {
      try { parsed = JSON.parse(jsonMatch[1].trim()); } catch (e) {}
    }
  }

  // 3. Si todo falla, intentar leer el nombre a la fuerza
  if (!parsed || !parsed.patient) {
    const p = createEmptyPatient();
    const mName = raw.match(/\*\*Nombre:\*\*\s*([^\(\n]+)/i) || raw.match(/NOMBRE:\s*([^\n]+)/i);
    p.name = mName ? mName[1].trim() : "Paciente Importado";
    parsed = { patient: p };
  }

  parsedImportPatientData = parsed;
  box.classList.remove("hidden");
  summary.innerHTML = `<strong>${escapeHtml(parsed.patient.name)}</strong> — RUT: ${escapeHtml(parsed.patient.rut || "-")}`;
}

function confirmPatientImport() {
  if (!parsedImportPatientData) parseIncomingMarkdownPreview();
  if (!parsedImportPatientData || !parsedImportPatientData.patient) {
    showToast("Pega primero un JSON o archivo .md válido", "warning");
    return;
  }
  
  // 1. Obtiene la cama exacta que seleccionaste en el menú desplegable
  const bedSelectValue = document.getElementById("importTargetBedSelect").value;
  if (!bedSelectValue) return;
  
  const [serviceId, roomId, bedId] = bedSelectValue.split("|");
  const found = findEntity(serviceId, roomId, bedId);
  if (!found || !found.bed) return;

  // 2. Si la cama estaba ocupada, avisa que se va a sobrescribir
  if (found.bed.status === "occupied") {
    if (!confirm(`La ${found.bed.code} ya está ocupada por ${found.bed.patient?.name || "otro paciente"}. ¿Deseas sobrescribirlo con los datos importados?`)) {
      return;
    }
  }

  // 3. Asigna los datos a la cama seleccionada fusionando con la estructura v3.0 vacía
  found.bed.status = "occupied";
  found.bed.isMyBed = document.getElementById("importMarkAsMyBed").checked;
  found.bed.seenToday = false;
  
  // Clonación profunda de la estructura base + los datos importados
  const emptyPatient = createEmptyPatient();
  found.bed.patient = Object.assign({}, emptyPatient, parsedImportPatientData.patient);

  saveAppState();
  closeImportModal();
  renderAll();
  
  showToast(`📥 Paciente importado con éxito en ${found.service.name} • ${found.bed.code}`);
}

// Respaldo Completo JSON (Exportar y Restaurar)
function exportFullHospitalBackup() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Respaldo_MediPiso_v2_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

function importFullHospitalBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.services)) {
        appState = parsed;
        saveAppState();
        closeHospitalConfigModal();
        renderAll();
        showToast("✅ Respaldo completo restaurado con éxito");
      } else {
        showToast("El archivo .json no tiene un formato válido de MediPiso", "danger");
      }
    } catch (err) {
      showToast("Error al leer el archivo .json", "danger");
    }
  };
  reader.readAsText(file);
}

function resetToDemoHospital() {
  if (!confirm("¿Seguro que deseas borrar los cambios actuales y restaurar el Hospital de Ejemplo?")) return;
  appState = generateDefaultHospitalState();
  saveAppState();
  closeHospitalConfigModal();
  renderAll();
  showToast("🔄 Hospital de demostración restaurado");
}
// =========================================================================
// 14. TEMA OSCURO, REGISTRO PWA Y ARRANQUE
// =========================================================================
function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("medipiso_theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btn = document.getElementById("pwaInstallBtn");
  if (btn) btn.classList.remove("hidden");
});

function installPWA() {
  if (!deferredPwaPrompt) return;
  deferredPwaPrompt.prompt();
  deferredPwaPrompt.userChoice.then(() => {
    deferredPwaPrompt = null;
    document.getElementById("pwaInstallBtn").classList.add("hidden");
  });
}

window.onload = function () {
  if (localStorage.getItem("medipiso_theme") === "dark") {
    document.documentElement.classList.add("dark");
  }

  const atbDatalist = document.getElementById("commonAtbList");
  if (atbDatalist && typeof CATALOGO_FARMACOS !== "undefined") {
    atbDatalist.innerHTML = CATALOGO_FARMACOS.map(a => `<option value="${escapeHtml(a)}"></option>`).join("");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(err => console.warn("SW no registrado:", err));
  }

  loadAppState();
  renderAll();

  setInterval(evaluateNotificationsAndBell, 30000);
};

// =========================================================================
// 15. CONEXIÓN A GOOGLE DOCS (API REST - DINÁMICO)
// =========================================================================
async function sendPatientToDocsFromModal() {
  if (!currentEditingRef) return;
  
  const ref = { ...currentEditingRef };
  saveBedModal(); 
  
  const found = findEntity(ref.serviceId, ref.roomId, ref.bedId);
  if (!found || !found.bed || !found.bed.patient) return;
  const p = found.bed.patient;

  let targetDocId = localStorage.getItem("medipiso_doc_id");
  if (!targetDocId) {
    let docLink = prompt("Primera configuración:\nPega aquí el enlace de tu documento de Google Docs:");
    if (!docLink) return;
    let match = docLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
    targetDocId = match ? match[1] : docLink.trim();
    localStorage.setItem("medipiso_doc_id", targetDocId);
  }

  let savedFirma = localStorage.getItem("medipiso_firma") || "INT. ";
  const firma = prompt("Firma responsable\nDebe iniciar con DR., DRA. o INT. para que el Sidebar pueda leerla.\n\n*Para cambiar documento, escribe: CAMBIAR DOC", savedFirma);
  if (firma === null) return; 
  if (firma === "CAMBIAR DOC") {
    localStorage.removeItem("medipiso_doc_id");
    showToast("Enlace borrado. Vuelve a presionar 'Enviar a Docs'.", "info");
    return;
  }
  localStorage.setItem("medipiso_firma", firma.toUpperCase());

  let evoText = "";
  
  evoText += `NOMBRE: ${p.name || "-"}\n`;
  evoText += `EDAD: ${p.age || "-"}\n`;
  evoText += `RUT: ${p.rut || "-"}\n`;
  evoText += `CAMA: ${found.bed.code}\n`;
  evoText += `AISLAMIENTO: ${p.isolationType !== 'none' ? p.isolationType.toUpperCase() : 'ESTÁNDAR'}\n`;
  
  const hasDevice = (name) => p.devices.some(d => d.name.includes(name)) ? "SÍ" : "NO";
  evoText += `CUP: ${hasDevice('Foley')}\n`;
  evoText += `CVC: ${hasDevice('CVC')}\n`;
  evoText += `SNG: ${hasDevice('SNG')}\n`;
  
  evoText += `ALERGIAS: ${p.allergies || "-"}\n`;
  evoText += `HÁBITOS: ${p.habits.length ? p.habits.join(" / ") : "-"}\n`;
  evoText += `MÉDICOS: ${p.medicalHistory.length ? p.medicalHistory.join(" / ") : "-"}\n`;
  evoText += `QUIRÚRGICOS: ${p.surgicalHistory.length ? p.surgicalHistory.join(" / ") : "-"}\n`;
  evoText += `FÁRMACOS: ${p.homeMedications.length ? p.homeMedications.join(" / ") : "-"}\n\n`;

  evoText += `DIAGNÓSTICOS:\n`;
  (p.currentSurgeries || []).forEach(cx => {
    evoText += `- CIRUGÍA: ${cx.name} (DPO ${cx.postOpDay})\n`;
  });
  (p.diagnoses || []).forEach(dx => {
    evoText += `- ${dx.main}\n`;
    dx.observations.forEach(obs => evoText += `* ${obs}\n`);
  });
  if (!p.currentSurgeries?.length && !p.diagnoses?.length) evoText += `- Sin diagnósticos\n`;
  evoText += `\n`;

  evoText += `RESUMEN:\n`;
  evoText += `EVOLUCIÓN SUBJETIVA: ${p.evolution?.subjective || "-"}\n`;
  evoText += `SITUACIÓN ACTUAL: ${p.evolution?.currentStatus || "-"}\n\n`;

  evoText += `CSV Y DRENAJES:\n`;
  const vit = p.vitals || {};
  let oxig = vit.o2Type === "Ambiental" ? "AMBIENTAL" : `${vit.o2Type} ${vit.o2Liters}`;
  evoText += `PA ${vit.pa || "-"}, FC ${vit.fc || "-"}, T° ${vit.temp || "-"}, FR ${vit.fr || "-"}, SAT ${vit.sat || "-"}% ${oxig}, HGT ${vit.hgt || "-"}, DOLOR (EVA) ${vit.eva || "-"}/10. DIURESIS: ${vit.diuresis || "(+)"} DEPOSICIONES: ${vit.bowel || "(+)"}\n`;
  (p.devices || []).forEach(dev => {
    if (dev.name.includes("Drenaje")) evoText += `- DRENAJE Quirúrgico (${dev.name}): Día ${dev.days}\n`;
  });
  evoText += `\n`;

  evoText += `EX FÍSICO:\n`;
  const ef = p.physicalExam || {};
  evoText += `- GENERAL: ${ef.general || "-"}\n`;
  evoText += `- CARDÍACO: ${ef.cardiac || "-"}\n`;
  evoText += `- PULMONAR: ${ef.pulmonary || "-"}\n`;
  evoText += `- ABDOMEN: ${ef.abdomen || "-"}\n`;
  evoText += `- HERIDA OPERATORIA (HO): ${ef.surgicalWound || "-"}\n`;
  evoText += `- EEII: ${ef.lowerLimbs || "-"}\n`;
  evoText += `- NEUROLÓGICO: ${ef.neuro || "-"}\n\n`;

  if (p.labs && p.labs.length) {
    evoText += `LABORATORIO:\n`;
    p.labs.forEach(lab => {
      let dateParts = lab.date.split("-");
      let fDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : lab.date;
      evoText += `FECHA (${fDate}):\n`;
      lab.exams.forEach(ex => evoText += `- ${ex.name}: ${ex.value} ${ex.unit || "Sin un."}\n`);
    });
    evoText += `\n`;
  }

  if (p.images && p.images.length) {
    evoText += `IMÁGENES:\n`;
    p.images.forEach(img => {
      evoText += `- EXAMEN: ${img.name} | FECHA: ${img.date || "-"} | DESC: ${img.description || "-"}\n`;
    });
    evoText += `\n`;
  }

  evoText += `PROBLEMAS Y PLANES:\n`;
  (p.systemsPlan || []).forEach(sys => {
    evoText += `- ${sys.system}: ${sys.plan}\n`;
  });
  
  if (p.hospitalMedications || p.antibiotics?.length || p.tasks?.length) {
    evoText += `- INDICACIONES Y FÁRMACOS:\n`;
    if (p.hospitalMedications) evoText += `${p.hospitalMedications}\n`;
    if (p.antibiotics?.length) evoText += `ATB: ${p.antibiotics.map(a => `${a.name} ${a.dose} (Día ${a.currentDay}/${a.targetDays})`).join(", ")}\n`;
    let pend = (p.tasks || []).filter(t => !t.completed);
    if (pend.length) evoText += `PENDIENTES: ${pend.map(t => `[${t.category}] ${t.text}`).join(" | ")}\n`;
  }
  
  evoText += `\n${firma.toUpperCase()}\n`;

  const payload = {
    docId: targetDocId,
    camaCode: found.bed.code,
    servicio: found.service.name,
    textoCompleto: evoText
  };

  showToast("☁️ Conectando con Google Docs...", "info");

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success") showToast(`✅ Evolución guardada en el documento`, "success");
    else showToast("❌ Error Google: " + result.message, "danger");
  } catch (error) {
    showToast("❌ Error de red: No se pudo contactar a Google Drive", "danger");
  }
}
// =========================================================================
// 16. HITOS CLÍNICOS Y GESTIÓN DE EMERGENCIAS (V3.0)
// =========================================================================
function addMilestoneToModal() {
  const date = document.getElementById("newMilestoneDate").value;
  const text = document.getElementById("newMilestoneText").value.trim();
  if (!text) return;
  modalTempMilestones.push({ date: date || new Date().toISOString().slice(0, 10), text });
  document.getElementById("newMilestoneText").value = "";
  renderModalMilestones();
}

function removeMilestone(idx) {
  modalTempMilestones.splice(idx, 1);
  renderModalMilestones();
}

function renderModalMilestones() {
  const container = document.getElementById("modalMilestonesList");
  if (!modalTempMilestones.length) {
    container.innerHTML = `<p class="text-[11px] text-slate-500">Sin hitos registrados.</p>`;
    return;
  }
  container.innerHTML = modalTempMilestones.map((m, idx) => `
    <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/50">
      <div class="text-xs"><strong class="text-amber-700 dark:text-amber-400">${m.date}</strong> — ${escapeHtml(m.text)}</div>
      <button type="button" onclick="removeMilestone(${idx})" class="text-rose-500 hover:text-rose-700 font-bold px-1.5">✕</button>
    </div>
  `).join("");
}

// --- SISTEMAS DE EMERGENCIA Y LIMPIEZA ---
function softResetBeds() {
  if (!confirm("⚠️ ¿Vaciar TODAS las camas?\nSe vaciarán los pacientes, pero se conservarán las configuraciones de salas y los PENDIENTES programados de cada cama.")) return;
  
  appState.services.forEach(srv => {
    srv.rooms.forEach(room => {
      room.beds.forEach(bed => {
        if (bed.status === "occupied" && bed.patient) {
          const savedTasks = Array.isArray(bed.patient.tasks) ? [...bed.patient.tasks] : [];
          bed.patient = createEmptyPatient();
          bed.patient.tasks = savedTasks;
          bed.status = "free";
          bed.isMyBed = false;
          bed.seenToday = false;
        }
      });
    });
  });
  
  saveAppState();
  renderAll();
  closeHospitalConfigModal();
  showToast("🧹 Camas limpiadas exitosamente. Pendientes conservados.");
}

function hardResetApp() {
  if (!confirm("🚨 PELIGRO: Eliminarás absolutamente TODO el hospital. Esta acción es IRREVERSIBLE.\n\n¿Estás seguro?")) return;
  localStorage.removeItem(STORAGE_KEY_V2);
  location.reload();
}

// --- FUNCIONES DE HISTORIAL ACTUALIZADAS ---
function openHistoryModal() {
  renderHistorySelect();
  const backdrop = document.getElementById("historyModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeHistoryModal() {
  const backdrop = document.getElementById("historyModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function renderHistorySelect() {
  const sel = document.getElementById("mainHistoryRestoreSelect");
  if (!sel) return;
  if (!appState.history || appState.history.length === 0) {
    sel.innerHTML = `<option value="">No hay respaldos disponibles</option>`;
    return;
  }
  sel.innerHTML = [...appState.history].reverse().map(h => 
    `<option value="${h.dateId}">Restaurar turno del: ${h.dateLabel}</option>`
  ).join("");
}

function restoreFromHistory() {
  const idStr = document.getElementById("mainHistoryRestoreSelect").value;
  if (!idStr) return;
  const snapshot = appState.history.find(h => h.dateId === Number(idStr));
  if (!snapshot) return;

  if (!confirm(`¿Sobrescribir el estado actual con el turno del ${snapshot.dateLabel}?\n\nLos cambios de hoy se perderán.`)) return;

  appState.services = JSON.parse(JSON.stringify(snapshot.services));
  saveAppState();
  renderAll();
  closeHistoryModal();
  showToast(`⏱️ Hospital restaurado al ${snapshot.dateLabel}`);
}
// =========================================================================
// WIZARD: ASIGNACIÓN MASIVA DE MIS CAMAS
// =========================================================================

let tempAssignBeds = new Set();
let currentAssignStep = 'services'; 

function openAssignBedsModal() {
  tempAssignBeds.clear();
  
  // 1. Pre-cargar las camas que YA están marcadas
  appState.services.forEach(s => s.rooms.forEach(r => r.beds.forEach(b => {
    if (b.isMyBed) tempAssignBeds.add(`${s.id}|${r.id}|${b.id}`);
  })));
  
  currentAssignStep = 'services'; 
  renderAssignBedsModal();
  
  const backdrop = document.getElementById("assignBedsModalBackdrop");
  backdrop.classList.remove("hidden");
  backdrop.classList.add("flex");
}

function closeAssignBedsModal() {
  const backdrop = document.getElementById("assignBedsModalBackdrop");
  backdrop.classList.add("hidden");
  backdrop.classList.remove("flex");
}

function renderAssignBedsModal() {
  const body = document.getElementById("assignBedsModalBody");
  let html = "";

  // VISTA 1: LISTADO DE SERVICIOS
  if (currentAssignStep === 'services') {
    html += `<div class="p-4 space-y-2">`;
    html += `<p class="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">1. Selecciona un Servicio</p>`;
    
    appState.services.forEach(srv => {
      let selectedCount = 0;
      let totalCount = 0;
      srv.rooms.forEach(r => r.beds.forEach(b => {
        totalCount++;
        if (tempAssignBeds.has(`${srv.id}|${r.id}|${b.id}`)) selectedCount++;
      }));

      html += `
        <button onclick="currentAssignStep = '${srv.id}'; renderAssignBedsModal();" class="w-full p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between hover:border-indigo-400 dark:hover:border-indigo-500 transition text-left shadow-sm">
          <div>
            <div class="font-extrabold text-sm text-slate-900 dark:text-white">${escapeHtml(srv.icon)} ${escapeHtml(srv.name)}</div>
            <div class="text-xs text-slate-500 mt-0.5">${totalCount} camas totales en el servicio</div>
          </div>
          <div class="text-[11px] font-bold ${selectedCount > 0 ? 'text-indigo-700 bg-indigo-100 dark:bg-indigo-900/80 dark:text-indigo-300 px-2 py-1 rounded-lg' : 'text-slate-400'}">
            ${selectedCount > 0 ? `${selectedCount} marcadas` : 'Ver camas'} ➔
          </div>
        </button>
      `;
    });
    html += `</div>`;
  } 
  // VISTA 2: LISTADO DE CAMAS POR SERVICIO SELECCIONADO
  else {
    const srv = getServiceById(currentAssignStep);
    
    html += `
      <div class="sticky top-0 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur p-3 border-b border-slate-200 dark:border-slate-700 z-10 flex items-center gap-3">
        <button onclick="currentAssignStep = 'services'; renderAssignBedsModal();" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200 dark:border-slate-600 transition">← Volver</button>
        <div class="font-extrabold text-sm text-slate-800 dark:text-white">${escapeHtml(srv.icon)} ${escapeHtml(srv.name)}</div>
      </div>
      <div class="p-4 space-y-5">
    `;
    
    let hasBeds = false;

    srv.rooms.forEach(room => {
      if (room.beds.length === 0) return; 
      hasBeds = true;

      html += `<div class="space-y-2">
        <div class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <span>🚪 ${escapeHtml(room.name)}</span>
          <div class="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
        </div>
        <div class="space-y-2">
      `;

      room.beds.forEach(bed => {
        const bedKey = `${srv.id}|${room.id}|${bed.id}`;
        const isChecked = tempAssignBeds.has(bedKey);
        const isOccupied = bed.status === "occupied";
        
        let patName = "🟢 Cama Libre";
        let diagStr = "Vacía (Márcala para ingresar paciente después)";
        
        if (isOccupied) {
          patName = bed.patient?.name || "Paciente sin nombre";
          diagStr = "Sin diagnóstico";
          if (Array.isArray(bed.patient?.diagnoses) && bed.patient.diagnoses.length > 0) {
            diagStr = bed.patient.diagnoses[0].main;
          } else if (typeof bed.patient?.diagnoses === "string" && bed.patient.diagnoses) {
            diagStr = bed.patient.diagnoses.split("\n")[0];
          }
        }

        html += `
          <label class="flex items-center gap-3 p-3 rounded-xl border ${isChecked ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-600 ring-1 ring-indigo-400 dark:ring-indigo-600' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleTempAssignBed('${bedKey}')" class="w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 bg-white">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span class="px-2 py-0.5 rounded shadow-sm ${isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'} text-[10px]">${escapeHtml(bed.code)}</span>
                <span class="truncate">${escapeHtml(patName)}</span>
              </div>
              <div class="text-[11px] ${isOccupied ? 'text-slate-500' : 'text-emerald-600 font-bold'} truncate mt-0.5">${escapeHtml(diagStr)}</div>
            </div>
          </label>
        `;
      });

      html += `</div></div>`;
    });

    if (!hasBeds) {
       html += `<div class="text-center text-slate-500 text-xs py-8">No hay camas creadas en este servicio.</div>`;
    }

    html += `</div>`;
  }

  body.innerHTML = html;
}

function toggleTempAssignBed(bedKey) {
  if (tempAssignBeds.has(bedKey)) {
    tempAssignBeds.delete(bedKey);
  } else {
    tempAssignBeds.add(bedKey);
  }
  renderAssignBedsModal(); 
}

function confirmAssignBeds() {
  let assignedCount = 0;
  
  appState.services.forEach(s => s.rooms.forEach(r => r.beds.forEach(b => {
    const bedKey = `${s.id}|${r.id}|${b.id}`;
    b.isMyBed = tempAssignBeds.has(bedKey);
    if (b.isMyBed) assignedCount++;
  })));

  saveAppState();
  closeAssignBedsModal();
  renderAll();
  showToast(`✅ Visita configurada: Tienes ${assignedCount} paciente(s) a tu cargo hoy.`);
}
// =========================================================================
// WIZARD: EXPORTACIÓN MASIVA A GOOGLE DOCS (FASE 1)
// =========================================================================

let tempBulkExportBeds = new Set();

function openBulkExportModal() {
  tempBulkExportBeds.clear();
  
  // Preseleccionar automáticamente solo "Mis Camas" que estén ocupadas
  appState.services.forEach(s => s.rooms.forEach(r => r.beds.forEach(b => {
    if (b.status === "occupied" && b.isMyBed) tempBulkExportBeds.add(`${s.id}|${r.id}|${b.id}`);
  })));
  
  renderBulkExportModal();
  document.getElementById("bulkExportModalBackdrop").classList.remove("hidden");
  document.getElementById("bulkExportModalBackdrop").classList.add("flex");
}

function closeBulkExportModal() {
  document.getElementById("bulkExportModalBackdrop").classList.add("hidden");
  document.getElementById("bulkExportModalBackdrop").classList.remove("flex");
}

function toggleTempBulkExportBed(bedKey) {
  if (tempBulkExportBeds.has(bedKey)) tempBulkExportBeds.delete(bedKey);
  else tempBulkExportBeds.add(bedKey);
  renderBulkExportModal();
}

function renderBulkExportModal() {
  const body = document.getElementById("bulkExportModalBody");
  const btnConfirm = document.getElementById("btnConfirmBulk");
  
  let myBedsHtml = "";
  let otherBedsHtml = "";
  
  appState.services.forEach(srv => srv.rooms.forEach(room => room.beds.forEach(bed => {
    if (bed.status !== "occupied") return;
    
    const bedKey = `${srv.id}|${room.id}|${bed.id}`;
    const isChecked = tempBulkExportBeds.has(bedKey);
    const pName = bed.patient?.name || "Paciente sin nombre";
    
    const cardHtml = `
      <label class="flex items-center gap-3 p-2.5 rounded-xl border ${isChecked ? 'bg-sky-50 border-sky-400 dark:bg-sky-900/30 dark:border-sky-600 ring-1 ring-sky-400' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'} cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition mb-2">
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleTempBulkExportBed('${bedKey}')" class="w-5 h-5 rounded text-sky-600 border-slate-300 focus:ring-sky-500 bg-white">
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span class="px-2 py-0.5 rounded shadow-sm bg-slate-200 dark:bg-slate-700 text-[10px]">${escapeHtml(bed.code)}</span>
            <span class="truncate">${escapeHtml(pName)}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-0.5">Servicio: ${escapeHtml(srv.name)}</div>
        </div>
      </label>
    `;
    
    if (bed.isMyBed) myBedsHtml += cardHtml;
    else otherBedsHtml += cardHtml;
  })));

  let finalHtml = "";
  if (myBedsHtml) finalHtml += `<h4 class="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 mb-2 uppercase">⭐ Mis Camas</h4>${myBedsHtml}`;
  if (otherBedsHtml) finalHtml += `<h4 class="text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2 mt-4 uppercase">🔄 Otras Camas Ocupadas</h4>${otherBedsHtml}`;
  
  if (!finalHtml) finalHtml = `<div class="text-center text-slate-500 text-xs py-8">No hay camas ocupadas en el hospital.</div>`;
  
  body.innerHTML = finalHtml;
  btnConfirm.innerHTML = `🚀 Enviar (${tempBulkExportBeds.size}) a Docs`;
  btnConfirm.disabled = tempBulkExportBeds.size === 0;
}

async function confirmBulkExport() {
  if (tempBulkExportBeds.size === 0) return;
  
  let targetDocId = localStorage.getItem("medipiso_doc_id");
  if (!targetDocId) {
    let docLink = prompt("Primera configuración:\nPega aquí el enlace de tu documento de Google Docs:");
    if (!docLink) return;
    let match = docLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
    targetDocId = match ? match[1] : docLink.trim();
    localStorage.setItem("medipiso_doc_id", targetDocId);
  }

  // 1. ARMAMOS LA "CAJA" (EL PAYLOAD)
  const exportList = [];
  tempBulkExportBeds.forEach(bedKey => {
    const [serviceId, roomId, bedId] = bedKey.split("|");
    const found = findEntity(serviceId, roomId, bedId);
    if (found && found.bed && found.bed.patient) {
      exportList.push({
        camaCode: found.bed.code,
        servicio: found.service.name,
        patientData: found.bed.patient // Mandamos el JSON completo del paciente
      });
    }
  });

  const payload = {
    docId: targetDocId,
    action: "BATCH_EXPORT",
    patients: exportList
  };

  const btnConfirm = document.getElementById("btnConfirmBulk");
  btnConfirm.innerHTML = `⏳ Enviando...`;
  btnConfirm.disabled = true;

  // 2. LLAMAMOS AL "CARTERO" (EL FETCH)
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    
    if (result.status === "success") {
      showToast(`✅ Lote de ${tempBulkExportBeds.size} pacientes enviado a la Sala de Espera de Docs`, "success");
      closeBulkExportModal();
    } else {
      showToast("❌ Error Google: " + result.message, "danger");
      btnConfirm.innerHTML = `🚀 Reintentar`;
      btnConfirm.disabled = false;
    }
  } catch (error) {
    showToast("❌ Error de red: No se pudo contactar a Google Drive", "danger");
    btnConfirm.innerHTML = `🚀 Reintentar`;
    btnConfirm.disabled = false;
  }
}
