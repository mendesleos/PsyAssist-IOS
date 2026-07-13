// PsyAssist - Client-Side State and Interaction Logic

// ============================================================
// 1. REGISTRO DO SERVICE WORKER (PWA / Cache Offline)
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => console.log('[PsyAssist] Service Worker registrado:', reg.scope))
            .catch((err) => console.warn('[PsyAssist] Service Worker falhou:', err));
    });
}

// ============================================================
// 2. DETECÇÃO DE MODO STANDALONE (iPhone com PWA instalado)
//    O iOS Safari não suporta @media display-mode standalone
//    então detectamos via navigator e adicionamos a classe .standalone
// ============================================================
(function detectStandalone() {
    const isStandalone =
        window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
        document.body.classList.add('standalone');
        console.log('[PsyAssist] Rodando como PWA instalado (modo standalone).');
    }
})();

// Global state container
let state = {
    drName: "Dr. Bruno",
    theme: "dark",
    patients: [],
    appointments: [],
    selectedDate: new Date(), // Current selected date on calendar
    currentMonthYear: new Date() // Month/Year currently viewed on calendar
};

// Seed Data
const DEFAULT_PATIENTS = [
    { id: "p1", name: "Fernando Pessoa", age: 32, city: "Lisboa", notes: "Apresenta estresse pós-trabalho e bloqueio criativo. Foco em arteterapia.", paid: true },
    { id: "p2", name: "Amanda Melo", age: 28, city: "Recife", notes: "Tratamento para ansiedade social. Progredindo com técnicas de exposição cognitiva.", paid: false },
    { id: "p3", name: "Carlos Drummond", age: 45, city: "Itabira", notes: "Lidando com luto familiar. Emocionalmente reservado, mas aberto ao diálogo.", paid: true },
    { id: "p4", name: "Fabio Assunção", age: 50, city: "Rio de Janeiro", notes: "Tratando dependência emocional. Monitoramento de hábitos de autocuidado.", paid: false },
    { id: "p5", name: "Luciano Huck", age: 52, city: "Angra dos Reis", notes: "Dificuldade em gerenciar rotina estressante. Foco em técnicas de mindfulness.", paid: true }
];

// Seed Historical Session Notes
const DEFAULT_RECORDS = {
    "p1": [
        { date: "2026-07-10", notes: ["Paciente expressou melhora na ansiedade ao escrever.", "Indicada leitura e meditação matinal."] },
        { date: "2026-07-05", notes: ["Primeira sessão. Relata sentimentos de inadequação e melancolia constante."] }
    ],
    "p2": [
        { date: "2026-07-12", notes: ["Conseguiu realizar o exercício de conversar com um estranho.", "Discutimos a sensação de julgamento alheio."] }
    ],
    "p3": [
        { date: "2026-07-08", notes: ["Sessão focada na aceitação da perda.", "Paciente chorou ao recordar memórias de infância."] }
    ],
    "p4": [
        { date: "2026-07-09", notes: ["Apresenta recaída no comportamento obsessivo com o parceiro.", "Reforçamos os limites pessoais."] }
    ],
    "p5": [
        { date: "2026-07-11", notes: ["Relatou sono desregulado devido a reuniões tardias.", "Desenhamos um plano de higiene do sono."] }
    ]
};

// Initial setup on document load
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    initApp();
    setupEventListeners();
});

// Load state from local storage or set defaults
function loadState() {
    const savedState = localStorage.getItem("psyassist_state");
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            state = {
                ...state,
                ...parsed,
                selectedDate: new Date(parsed.selectedDate || new Date()),
                currentMonthYear: new Date(parsed.currentMonthYear || new Date())
            };
        } catch (e) {
            console.error("Erro ao ler localStorage, reiniciando banco.", e);
            resetToDefaultState();
        }
    } else {
        resetToDefaultState();
    }
}

function saveState() {
    const stateToSave = {
        drName: state.drName,
        theme: state.theme,
        patients: state.patients,
        appointments: state.appointments,
        selectedDate: state.selectedDate.toISOString(),
        currentMonthYear: state.currentMonthYear.toISOString()
    };
    localStorage.setItem("psyassist_state", JSON.stringify(stateToSave));
}

function resetToDefaultState() {
    state.drName = "Dr. Bruno";
    state.theme = "dark";
    state.patients = JSON.parse(JSON.stringify(DEFAULT_PATIENTS));
    
    // Seed appointments dynamically relative to today
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayStr = formatDateISO(today);
    const tomorrowStr = formatDateISO(tomorrow);
    const yesterdayStr = formatDateISO(yesterday);

    state.appointments = [
        { id: "a1", patientId: "p1", date: todayStr, time: "09:00", patientName: "Fernando Pessoa" },
        { id: "a2", patientId: "p2", date: todayStr, time: "14:00", patientName: "Amanda Melo" },
        { id: "a3", patientId: "p3", date: tomorrowStr, time: "10:30", patientName: "Carlos Drummond" },
        { id: "a4", patientId: "p4", date: tomorrowStr, time: "16:00", patientName: "Fabio Assunção" },
        { id: "a5", patientId: "p5", date: yesterdayStr, time: "15:00", patientName: "Luciano Huck" }
    ];

    // Seed notes
    localStorage.setItem("psyassist_records", JSON.stringify(DEFAULT_RECORDS));
    saveState();
}

function resetDatabase() {
    if (confirm("Deseja realmente apagar todas as alterações e restaurar os dados de demonstração?")) {
        resetToDefaultState();
        loadState();
        initApp();
        alert("Dados restaurados com sucesso!");
    }
}

// Initial renders
function initApp() {
    // Theme setup
    document.body.className = state.theme === "dark" ? "dark-theme" : "light-theme";
    document.getElementById("theme-toggle").checked = state.theme === "dark";

    // Set greeting/header text
    document.getElementById("dr-name-display").textContent = state.drName;
    document.getElementById("config-dr-name").value = state.drName;

    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById("current-date").textContent = new Date().toLocaleDateString('pt-BR', options);

    // Update patient dropdown options in Scheduling tab
    updatePatientDropdown();
    
    // Render views
    renderTodayAppointments();
    renderCalendar();
    renderPatientsList();
    
    // Render current active tab
    switchTab("inicio");
}

function setupEventListeners() {
    // Theme toggle
    document.getElementById("theme-toggle").addEventListener("change", (e) => {
        state.theme = e.target.checked ? "dark" : "light";
        document.body.className = state.theme === "dark" ? "dark-theme" : "light-theme";
        saveState();
    });

    // Settings Button in Header
    document.getElementById("settings-btn").addEventListener("click", () => {
        switchTab("config");
    });

    // Name input change
    document.getElementById("config-dr-name").addEventListener("input", (e) => {
        state.drName = e.target.value || "Dr. Bruno";
        document.getElementById("dr-name-display").textContent = state.drName;
        saveState();
    });

    // Calendar navigations
    document.getElementById("prev-month").addEventListener("click", () => {
        state.currentMonthYear.setMonth(state.currentMonthYear.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById("next-month").addEventListener("click", () => {
        state.currentMonthYear.setMonth(state.currentMonthYear.getMonth() + 1);
        renderCalendar();
    });

    // Appointment form submit
    document.getElementById("appointment-form").addEventListener("submit", handleAddAppointment);

    // Patient Search bar (Pacientes tab)
    document.getElementById("search-patients").addEventListener("input", renderPatientsList);

    // Agenda Search bar (Calendario tab)
    document.getElementById("search-agenda-input").addEventListener("input", renderSelectedDayAppointments);

    // AI Command text input enter key
    document.getElementById("ai-text-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const command = e.target.value.trim();
            if (command) {
                processAICommand(command);
                e.target.value = "";
            }
        }
    });

    // Voice button trigger
    setupVoiceRecognition();
}

// Navigation / Tab Switch Router
function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
    // Remove active style from nav buttons
    document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => btn.classList.remove("active"));

    // Activate selected section
    const activeSection = document.getElementById(`tab-${tabId}`);
    if (activeSection) activeSection.classList.add("active");

    // Highlight button
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) activeBtn.classList.add("active");

    // Lógica do Cabeçalho Dinâmico
    const headerLeft = document.getElementById("dynamic-header-left");
    if (headerLeft) {
        if (tabId === "inicio") {
            headerLeft.classList.remove("hidden");
        } else {
            headerLeft.classList.add("hidden");
        }
    }

    // Perform specific updates per tab
    if (tabId === "calendario") {
        renderCalendar();
    } else if (tabId === "inicio") {
        renderTodayAppointments();
    } else if (tabId === "pacientes") {
        renderPatientsList();
    }
}

// FORMAT HELPER FUNCTIONS
function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDateISO(str) {
    const parts = str.split("-");
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateBR(dateStr) {
    const parts = dateStr.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// QUICK ACTIONS
function togglePaymentStatus(patientId, event) {
    if (event) event.stopPropagation(); // Previne propagação de clique

    const patientIndex = state.patients.findIndex(p => p.id === patientId);
    if (patientIndex !== -1) {
        // Toggle the paid status
        state.patients[patientIndex].paid = !state.patients[patientIndex].paid;
        saveState();
        
        // Update all views that might be showing this patient's badge
        renderTodayAppointments();
        renderSelectedDayAppointments();
        renderPatientsList();
    }
}

// TAB 3: INÍCIO VIEW RENDERS
function renderTodayAppointments() {
    const container = document.getElementById("today-appointments");
    container.innerHTML = "";
    
    const todayStr = formatDateISO(new Date());
    const todayAppts = state.appointments.filter(appt => appt.date === todayStr);

    // Sort by time
    todayAppts.sort((a, b) => a.time.localeCompare(b.time));

    document.getElementById("today-count").textContent = todayAppts.length;

    if (todayAppts.length === 0) {
        container.innerHTML = `<div class="empty-state">Nenhuma consulta agendada para hoje.</div>`;
        return;
    }

    todayAppts.forEach(appt => {
        const patient = state.patients.find(p => p.id === appt.patientId);
        const paymentClass = (patient && patient.paid) ? "paid" : "unpaid";
        const paymentLabel = (patient && patient.paid) ? "Pago" : "Pendente";
        
        const item = document.createElement("div");
        item.className = "appointment-item";
        // item.onclick = () => openPatientModalById(appt.patientId); // Removido para simplificar interação
        item.innerHTML = `
            <div class="appt-left">
                <div class="appt-time-badge">${appt.time}</div>
                <div class="appt-info">
                    <h4>${appt.patientName}</h4>
                    <span>${patient ? patient.city : "Sem cidade"}</span>
                </div>
            </div>
            <div class="appt-right">
                <span class="paid-badge ${paymentClass}" onclick="togglePaymentStatus('${appt.patientId}', event)" title="Alternar Pagamento">${paymentLabel}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// TAB 1: CALENDÁRIO RENDERS
function renderCalendar() {
    const container = document.getElementById("days-container");
    container.innerHTML = "";

    const titleEl = document.getElementById("calendar-title");
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    const year = state.currentMonthYear.getFullYear();
    const month = state.currentMonthYear.getMonth();

    titleEl.textContent = `${months[month]} ${year}`;

    // Get first day of month
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Get total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Render empty space for offset weekdays
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "cal-day empty";
        container.appendChild(emptyCell);
    }

    const today = new Date();
    const todayStr = formatDateISO(today);

    // Render calendar days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement("div");
        dayCell.className = "cal-day";
        dayCell.textContent = day;

        const currentDayDate = new Date(year, month, day);
        const currentDayStr = formatDateISO(currentDayDate);

        // Check if selected
        if (formatDateISO(state.selectedDate) === currentDayStr) {
            dayCell.classList.add("active");
        }

        // Check if today
        if (todayStr === currentDayStr) {
            dayCell.classList.add("today");
        }

        // Check if has appointments
        const hasAppointments = state.appointments.some(appt => appt.date === currentDayStr);
        if (hasAppointments) {
            dayCell.classList.add("has-event");
        }

        dayCell.onclick = () => {
            state.selectedDate = currentDayDate;
            renderCalendar();
            renderSelectedDayAppointments();
        };

        container.appendChild(dayCell);
    }

    renderSelectedDayAppointments();
}

function renderSelectedDayAppointments() {
    const container = document.getElementById("selected-day-appointments");
    container.innerHTML = "";

    const dateLabel = document.getElementById("selected-date-label");
    const formattedDate = formatDateBR(formatDateISO(state.selectedDate));
    dateLabel.textContent = `Consultas em ${formattedDate}`;

    const dateStr = formatDateISO(state.selectedDate);
    let dayAppts = state.appointments.filter(appt => appt.date === dateStr);
    
    // Sort by time
    dayAppts.sort((a, b) => a.time.localeCompare(b.time));

    // Filter by search query if any
    const searchInput = document.getElementById("search-agenda-input");
    if (searchInput && searchInput.value.trim() !== "") {
        const query = searchInput.value.toLowerCase().trim();
        dayAppts = dayAppts.filter(appt => appt.patientName.toLowerCase().includes(query));
    }

    if (dayAppts.length === 0) {
        container.innerHTML = `<div class="empty-state">Nenhuma consulta encontrada.</div>`;
        return;
    }

    dayAppts.forEach(appt => {
        const patient = state.patients.find(p => p.id === appt.patientId);
        const paymentClass = (patient && patient.paid) ? "paid" : "unpaid";
        const paymentLabel = (patient && patient.paid) ? "Pago" : "Pendente";

        const item = document.createElement("div");
        item.className = "appointment-item";
        // item.onclick = () => openPatientModalById(appt.patientId); // Removido
        item.innerHTML = `
            <div class="appt-left">
                <div class="appt-time-badge">${appt.time}</div>
                <div class="appt-info">
                    <h4>${appt.patientName}</h4>
                    <span>${patient ? patient.city : "Sem cidade"}</span>
                </div>
            </div>
            <div class="appt-right">
                <span class="paid-badge ${paymentClass}" onclick="togglePaymentStatus('${appt.patientId}', event)" title="Alternar Pagamento">${paymentLabel}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// TAB 2: AGENDAMENTO LOGIC
function setPatientMode(mode) {
    const btnExisting = document.getElementById("btn-select-existing");
    const btnNew = document.getElementById("btn-create-new");
    const groupExisting = document.getElementById("group-existing-patient");
    const groupNew = document.getElementById("group-new-patient");

    if (mode === "existing") {
        btnExisting.classList.add("active");
        btnNew.classList.remove("active");
        groupExisting.style.display = "block";
        groupNew.style.display = "none";
        
        document.getElementById("select-patient-id").required = true;
        document.getElementById("new-patient-name").required = false;
    } else {
        btnExisting.classList.remove("active");
        btnNew.classList.add("active");
        groupExisting.style.display = "none";
        groupNew.style.display = "block";

        document.getElementById("select-patient-id").required = false;
        document.getElementById("new-patient-name").required = true;
    }
}

function updatePatientDropdown() {
    const select = document.getElementById("select-patient-id");
    select.innerHTML = '<option value="" disabled selected>Escolha um paciente...</option>';
    
    // Sort patients alphabetically
    const sorted = [...state.patients].sort((a, b) => a.name.localeCompare(b.name));
    
    sorted.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

function handleAddAppointment(e) {
    e.preventDefault();

    const isNew = document.getElementById("btn-create-new").classList.contains("active");
    const date = document.getElementById("appt-date").value;
    const time = document.getElementById("appt-time").value;

    // PREVENÇÃO DE CONFLITO DE HORÁRIOS (Double Booking)
    const conflito = state.appointments.find(a => a.date === date && a.time === time);
    if (conflito) {
        alert(`Conflito de horário!\n\nJá existe uma consulta marcada com ${conflito.patientName} às ${time} neste dia.\nPor favor, escolha outro horário.`);
        return;
    }

    let patientId = "";
    let patientName = "";

    if (isNew) {
        const name = document.getElementById("new-patient-name").value.trim();
        const age = parseInt(document.getElementById("new-patient-age").value) || 0;
        const city = document.getElementById("new-patient-city").value.trim() || "Desconhecida";
        const notes = document.getElementById("new-patient-notes").value.trim() || "";

        if (!name) return;

        // Register new patient
        patientId = "p_" + Date.now();
        patientName = name;

        const newPatient = {
            id: patientId,
            name: name,
            age: age,
            city: city,
            notes: notes,
            paid: false
        };

        state.patients.push(newPatient);
        
        // Clean fields
        document.getElementById("new-patient-name").value = "";
        document.getElementById("new-patient-age").value = "";
        document.getElementById("new-patient-city").value = "";
        document.getElementById("new-patient-notes").value = "";
    } else {
        patientId = document.getElementById("select-patient-id").value;
        if (!patientId) {
            alert("Selecione um paciente!");
            return;
        }
        const patient = state.patients.find(p => p.id === patientId);
        patientName = patient.name;
    }

    // Add appointment
    const appt = {
        id: "a_" + Date.now(),
        patientId: patientId,
        date: date,
        time: time,
        patientName: patientName
    };

    state.appointments.push(appt);
    saveState();
    
    // Reset form
    document.getElementById("appointment-form").reset();
    setPatientMode("existing");
    updatePatientDropdown();
    
    // Navigate to Calendar
    state.selectedDate = parseDateISO(date);
    state.currentMonthYear = new Date(state.selectedDate);
    switchTab("calendario");
}

// TAB 4: PACIENTES RENDERS
function renderPatientsList() {
    const container = document.getElementById("patients-list");
    container.innerHTML = "";

    const query = document.getElementById("search-patients").value.toLowerCase().trim();

    const filtered = state.patients.filter(p => p.name.toLowerCase().includes(query));
    // Sort alphabetically
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">Nenhum paciente encontrado.</div>`;
        return;
    }

    filtered.forEach(p => {
        const paymentClass = p.paid ? "paid" : "unpaid";
        const paymentLabel = p.paid ? "Pago" : "Não Pago";

        const card = document.createElement("div");
        card.className = "patient-card";
        card.onclick = () => openPatientModalById(p.id);
        card.innerHTML = `
            <div class="p-left">
                <h3>${p.name}</h3>
                <span>${p.age} anos &bull; ${p.city}</span>
            </div>
            <div class="p-right">
                <span class="paid-badge ${paymentClass}">${paymentLabel}</span>
                <i class="fa-solid fa-chevron-right" style="color: var(--text-secondary); font-size: 0.8rem;"></i>
            </div>
        `;
        container.appendChild(card);
    });
}

// MODAL: PACIENTE DETALHES & HISTÓRICO
let activeModalPatientId = "";

function openPatientModalById(patientId) {
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;

    activeModalPatientId = patientId;

    document.getElementById("modal-patient-name").textContent = patient.name;
    document.getElementById("modal-patient-age").textContent = patient.age || "-";
    document.getElementById("modal-patient-city").textContent = patient.city || "Desconhecida";
    document.getElementById("modal-patient-notes").textContent = patient.notes || "Nenhuma observação informada.";
    
    // Set payment badge status
    const paymentBtn = document.getElementById("modal-payment-toggle");
    paymentBtn.textContent = patient.paid ? "Pago" : "Pendente";
    paymentBtn.className = `payment-toggle-badge ${patient.paid ? "paid" : "unpaid"}`;

    // Render historical records
    renderPatientTimeline(patientId);

    // Open Modal
    document.getElementById("patient-modal").classList.add("active");
}

function closePatientModal() {
    document.getElementById("patient-modal").classList.remove("active");
    activeModalPatientId = "";
    // Re-render other pages in case statuses changed
    renderTodayAppointments();
    renderPatientsList();
    renderCalendar();
}

function togglePatientPayment() {
    if (!activeModalPatientId) return;

    const patient = state.patients.find(p => p.id === activeModalPatientId);
    if (patient) {
        patient.paid = !patient.paid;
        saveState();

        // Update modal button state
        const paymentBtn = document.getElementById("modal-payment-toggle");
        paymentBtn.textContent = patient.paid ? "Pago" : "Pendente";
        paymentBtn.className = `payment-toggle-badge ${patient.paid ? "paid" : "unpaid"}`;
    }
}

function renderPatientTimeline(patientId) {
    const container = document.getElementById("patient-records-timeline");
    container.innerHTML = "";

    // Load records
    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    const patientRecords = records[patientId] || [];

    // Sort records by date descending
    patientRecords.sort((a, b) => b.date.localeCompare(a.date));

    if (patientRecords.length === 0) {
        container.innerHTML = `<div class="empty-state" style="margin-top: 10px;">Nenhuma anotação registrada ainda. Use o digitalizador ou adicione uma data.</div>`;
    }

    patientRecords.forEach((group, groupIdx) => {
        const dateGroup = document.createElement("div");
        dateGroup.className = "timeline-date-group";
        
        const formattedDate = formatDateBR(group.date);

        // Timeline header with a "+" button
        dateGroup.innerHTML = `
            <div class="timeline-date-header">
                <span class="timeline-date-title">${formattedDate}</span>
                <button class="add-note-inline-btn" title="Adicionar anotação neste dia" onclick="openInlineNoteEditor('${group.date}')">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
            <div class="timeline-note-cards" id="note-cards-${group.date}">
                <!-- Notes will go here -->
            </div>
            <!-- Inline Note Editor (Hidden initially) -->
            <div class="inline-note-editor" id="editor-${group.date}">
                <input type="text" placeholder="Escreva a anotação..." id="input-${group.date}">
                <button class="inline-note-save" onclick="saveInlineNote('${group.date}')">Salvar</button>
            </div>
        `;
        container.appendChild(dateGroup);

        // Add note cards under this date group
        const cardsContainer = document.getElementById(`note-cards-${group.date}`);
        group.notes.forEach(noteText => {
            const card = document.createElement("div");
            card.className = "note-card";
            card.innerHTML = `${noteText}`;
            cardsContainer.appendChild(card);
        });
    });

    // Add "Nova Data" button at bottom of timeline
    const addDateTrigger = document.createElement("div");
    addDateTrigger.className = "new-date-timeline-trigger";
    addDateTrigger.innerHTML = `
        <button class="new-date-btn" onclick="addNewTimelineDate()">
            <i class="fa-regular fa-calendar-plus"></i> Adicionar Nova Data
        </button>
    `;
    container.appendChild(addDateTrigger);
}

// INLINE NOTE ACTIONS
function openInlineNoteEditor(date) {
    const editor = document.getElementById(`editor-${date}`);
    editor.classList.toggle("active");
    if (editor.classList.contains("active")) {
        document.getElementById(`input-${date}`).focus();
    }
}

function saveInlineNote(date) {
    if (!activeModalPatientId) return;

    const input = document.getElementById(`input-${date}`);
    const text = input.value.trim();

    if (!text) return;

    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    if (!records[activeModalPatientId]) records[activeModalPatientId] = [];

    const group = records[activeModalPatientId].find(g => g.date === date);
    if (group) {
        group.notes.push(text);
        localStorage.setItem("psyassist_records", JSON.stringify(records));
        input.value = "";
        document.getElementById(`editor-${date}`).classList.remove("active");
        renderPatientTimeline(activeModalPatientId);
    }
}

function addNewTimelineDate() {
    if (!activeModalPatientId) return;

    const dateStr = prompt("Digite a data (formato AAAA-MM-DD):", formatDateISO(new Date()));
    if (!dateStr) return;

    // Simple validation (Format YYYY-MM-DD)
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
        alert("Formato inválido! Use AAAA-MM-DD (ex: 2026-07-13)");
        return;
    }

    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    if (!records[activeModalPatientId]) records[activeModalPatientId] = [];

    // Check if group exists
    const exists = records[activeModalPatientId].some(g => g.date === dateStr);
    if (exists) {
        alert("Já existe uma seção para essa data.");
        return;
    }

    records[activeModalPatientId].push({
        date: dateStr,
        notes: []
    });

    localStorage.setItem("psyassist_records", JSON.stringify(records));
    renderPatientTimeline(activeModalPatientId);
    openInlineNoteEditor(dateStr);
}

// CEREJA DO BOLO 1: NOTEBOOK OCR SCANNER
function triggerNotebookScan() {
    // Open file chooser trigger
    document.getElementById("notebook-photo-input").click();
}

function simulateOCR(event) {
    if (!activeModalPatientId || !event.target.files.length) return;

    const scanner = document.getElementById("ocr-scanner");
    scanner.style.display = "block"; // Show scanner animation

    // Clean file input to let them upload same file again later
    const fileInput = event.target.value;

    setTimeout(() => {
        // Hide scanner
        scanner.style.display = "none";
        document.getElementById("notebook-photo-input").value = "";

        // Simulated OCR text options matching patient case study profiles
        const ocrSamples = [
            "Digitalizado do caderno: Paciente relata sentimentos recorrentes de angústia social. Discutiu episódios de isolamento autoimposto. Orientado a manter diário de humor.",
            "Digitalizado do caderno: Progresso na organização de prioridades. Mencionou conflito com o chefe, mas soube lidar de forma assertiva utilizando a técnica de CNV (comunicação não-violenta).",
            "Digitalizado do caderno: Apresenta ansiedade somatizada em dores no estômago. Trabalhamos respiração diafragmática profunda em sessão. Recomendada continuação.",
            "Digitalizado do caderno: Paciente demonstrou forte reatividade emocional a críticas. Exploração de crenças nucleares de rejeição na infância. Próximo passo: reestruturação cognitiva."
        ];

        // Pick random clinical sample note
        const randomNote = ocrSamples[Math.floor(Math.random() * ocrSamples.length)];
        const todayStr = formatDateISO(new Date());

        const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
        if (!records[activeModalPatientId]) records[activeModalPatientId] = [];

        let group = records[activeModalPatientId].find(g => g.date === todayStr);
        if (!group) {
            group = { date: todayStr, notes: [] };
            records[activeModalPatientId].push(group);
        }

        group.notes.push(randomNote);
        localStorage.setItem("psyassist_records", JSON.stringify(records));

        // Re-render timeline
        renderPatientTimeline(activeModalPatientId);
    }, 2800); // 2.8 seconds scan animation
}

// CEREJA DO BOLO 2: AI VOICE/TEXT COMMAND PARSER (NLP SIMULATOR)
function triggerPreset(presetType) {
    const input = document.getElementById("ai-text-input");
    
    if (presetType === 'agendar') {
        input.value = "Agendar consulta com Amanda Melo amanhã às 14:00";
    } else if (presetType === 'pagamento') {
        input.value = "Registrar Luciano Huck como pago";
    } else if (presetType === 'cancelar') {
        input.value = "Cancelar agendamento de Fernando Pessoa";
    }
    input.focus();
}

function closeFeedback() {
    document.getElementById("ai-feedback-box").style.display = "none";
}

// Actual Speech Recognition Integration with native browser SpeechRecognition API
function setupVoiceRecognition() {
    const voiceBtn = document.getElementById("voice-btn");
    const waveAnimation = document.getElementById("voice-wave");
    const textInput = document.getElementById("ai-text-input");

    // Check compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        // Fallback for browsers that don't support voice recognition: Simulate after a click
        voiceBtn.addEventListener("click", () => {
            voiceBtn.classList.add("listening");
            waveAnimation.style.display = "flex";

            const simulatedSpeeches = [
                "anote consulta com Fernando Pessoa amanhã às 15:30",
                "marcar Amanda Melo como pago",
                "cancelar consulta de Luciano Huck",
                "agendar consulta com Carlos Drummond hoje às 11:00 e marcar Amanda Melo como pago"
            ];

            const randomSpeech = simulatedSpeeches[Math.floor(Math.random() * simulatedSpeeches.length)];

            setTimeout(() => {
                voiceBtn.classList.remove("listening");
                waveAnimation.style.display = "none";
                textInput.value = randomSpeech;
                processAICommand(randomSpeech);
            }, 3000);
        });
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isListening = false;

    voiceBtn.addEventListener("click", () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add("listening");
        waveAnimation.style.display = "flex";
        textInput.placeholder = "Fale agora...";
    };

    recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove("listening");
        waveAnimation.style.display = "none";
        textInput.placeholder = "Digite seu comando...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textInput.value = transcript;
        processAICommand(transcript);
    };

    recognition.onerror = (e) => {
        console.error("Speech Recognition Error", e);
        // Fallback simulate on error
        setTimeout(() => {
            const fallbackSpeech = "agendar consulta com Carlos Drummond amanhã às 14:00";
            textInput.value = fallbackSpeech;
            processAICommand(fallbackSpeech);
        }, 1000);
    };
}

// PROCESS TEXT COMMANDS
function processAICommand(text) {
    const textClean = text.toLowerCase().trim();
    
    // Log container
    const feedbackBox = document.getElementById("ai-feedback-box");
    const feedbackText = document.getElementById("ai-feedback-text");
    
    let actionsExecuted = [];
    
    // Helper to find patient by partial name match
    function findPatientByName(nameQuery) {
        if (!nameQuery) return null;
        const query = nameQuery.toLowerCase().trim();
        return state.patients.find(p => p.name.toLowerCase().includes(query));
    }

    // Split compound commands by connectors "e" or commas ","
    const subCommands = textClean.split(/,| e /);

    subCommands.forEach(cmd => {
        cmd = cmd.trim();
        
        // 1. SCHEDULING (AGENDAR)
        // Matches: "agendar consulta com X", "anote consulta com X", "marcar consulta com X"
        if (cmd.includes("agenda") || cmd.includes("anote") || cmd.includes("marcar") || cmd.includes("consulta")) {
            let patientName = "";
            let dateTimeStr = "";
            let timeStr = "14:00"; // default
            let dateObj = new Date(); // default today

            // Extract patient name
            // Remove common verbs/prepositions: "agendar consulta com", "marcar consulta com", "consulta de", "consulta com", "anote"
            let cleaned = cmd
                .replace(/agendar|agenda|anote|marcar|marcar consulta com|agendar consulta com|consulta com|consulta de|consulta/g, "")
                .trim();
            
            // Try to match standard patient names from our state
            let foundPatient = null;
            for (let p of state.patients) {
                if (cleaned.toLowerCase().includes(p.name.toLowerCase())) {
                    foundPatient = p;
                    cleaned = cleaned.toLowerCase().replace(p.name.toLowerCase(), "").trim();
                    break;
                }
            }

            // If not fully matched, check first name matching
            if (!foundPatient) {
                for (let p of state.patients) {
                    const firstName = p.name.split(" ")[0].toLowerCase();
                    if (cleaned.toLowerCase().includes(firstName)) {
                        foundPatient = p;
                        cleaned = cleaned.toLowerCase().replace(firstName, "").trim();
                        break;
                    }
                }
            }

            // Extract Date (hoje, amanhã, dia tal)
            if (cleaned.includes("amanhã") || cleaned.includes("amanha")) {
                dateObj.setDate(dateObj.getDate() + 1);
            } else if (cleaned.includes("hoje")) {
                // keeps today
            } else {
                // Try to find a date like "dia 15", "dia 20"
                const dayMatch = cleaned.match(/dia (\d+)/);
                if (dayMatch) {
                    const targetDay = parseInt(dayMatch[1]);
                    dateObj.setDate(targetDay);
                }
            }

            // Extract Time (15h30, 15:30, as 15, às 10)
            const timeMatch = cleaned.match(/(?:as|às|is)?\s*(\d{1,2})(?:h|:)(\d{2})?|(\d{1,2})\s*h/);
            if (timeMatch) {
                const hour = timeMatch[1] || timeMatch[3];
                const minutes = timeMatch[2] || "00";
                timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }

            if (foundPatient) {
                // Execute Appointment Creation
                const dateStr = formatDateISO(dateObj);
                const apptId = "a_" + Date.now();
                state.appointments.push({
                    id: apptId,
                    patientId: foundPatient.id,
                    date: dateStr,
                    time: timeStr,
                    patientName: foundPatient.name
                });
                actionsExecuted.push(`🗓️ Agendada consulta com <strong>${foundPatient.name}</strong> para o dia ${formatDateBR(dateStr)} às ${timeStr}.`);
            } else {
                // Fallback create new patient with this name
                const nameWords = cleaned.replace(/amanhã|amanha|hoje|às|as|h|\d{1,2}|:|\s+/g, " ").trim();
                const cleanName = nameWords.replace(/\b(dia)\b/gi, "").trim();
                
                if (cleanName && cleanName.length > 2) {
                    const newId = "p_" + Date.now();
                    const newPatient = {
                        id: newId,
                        name: cleanName,
                        age: 30,
                        city: "Desconhecida",
                        notes: "Cadastrado via comando de voz.",
                        paid: false
                    };
                    state.patients.push(newPatient);
                    
                    const dateStr = formatDateISO(dateObj);
                    state.appointments.push({
                        id: "a_" + Date.now(),
                        patientId: newId,
                        date: dateStr,
                        time: timeStr,
                        patientName: cleanName
                    });
                    actionsExecuted.push(`🆕 Cadastrado novo paciente <strong>${cleanName}</strong> e agendada consulta em ${formatDateBR(dateStr)} às ${timeStr}.`);
                } else {
                    actionsExecuted.push(`⚠️ Comando de agendamento detectado, mas não entendi qual é o paciente.`);
                }
            }
        }
        
        // 2. PAYMENT STATUS (MARCAR PAGO)
        // Matches: "marcar X como pago", "registrar X pago", "marcar pago de X", "X pago"
        else if (cmd.includes("pago") || cmd.includes("pagou") || cmd.includes("pagamento")) {
            let cleaned = cmd.replace(/marcar|marcar como pago|registrar|como pago|pagamento|pagou|pago/g, "").trim();
            const foundPatient = findPatientByName(cleaned);

            if (foundPatient) {
                foundPatient.paid = true;
                actionsExecuted.push(`💳 Status de pagamento de <strong>${foundPatient.name}</strong> atualizado para: <strong>Pago</strong>.`);
            } else {
                actionsExecuted.push(`⚠️ Não encontrei o paciente "${cleaned}" para marcar como pago.`);
            }
        }

        // 3. CANCELLATION (CANCELAR AGENDAMENTO)
        // Matches: "cancelar consulta de X", "desmarcar X", "cancelar agendamento do X"
        else if (cmd.includes("cancelar") || cmd.includes("desmarcar") || cmd.includes("excluir")) {
            let cleaned = cmd.replace(/cancelar consulta de|cancelar agendamento do|cancelar agendamento de|cancelar|desmarcar|excluir/g, "").trim();
            const foundPatient = findPatientByName(cleaned);

            if (foundPatient) {
                // Filter out upcoming appointments for this patient
                const initialLength = state.appointments.length;
                state.appointments = state.appointments.filter(appt => appt.patientId !== foundPatient.id);
                
                if (state.appointments.length < initialLength) {
                    actionsExecuted.push(`❌ Consultas de <strong>${foundPatient.name}</strong> foram removidas da agenda.`);
                } else {
                    actionsExecuted.push(`ℹ️ Nenhuma consulta futura encontrada para <strong>${foundPatient.name}</strong>.`);
                }
            } else {
                actionsExecuted.push(`⚠️ Não encontrei o paciente "${cleaned}" para cancelar consulta.`);
            }
        }
    });

    saveState();
    
    // Update and show feedback console log
    if (actionsExecuted.length > 0) {
        feedbackText.innerHTML = actionsExecuted.join("<br>");
        feedbackBox.style.display = "block";
        
        // Refresh views to match changes immediately
        renderTodayAppointments();
        renderCalendar();
        renderPatientsList();
        updatePatientDropdown();
    }
}
