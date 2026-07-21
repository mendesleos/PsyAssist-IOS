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

// Função utilitária de busca (apenas match no início do nome ou sobrenome)
function matchSearchQuery(name, query) {
    if (!name) return false;
    if (!query) return true; // Se a busca for vazia, mostra todos
    const n = name.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return n.startsWith(q) || n.includes(' ' + q);
}

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

    // Restore saved avatar if any
    const savedAvatar = localStorage.getItem("psyassist_avatar");
    if (savedAvatar) {
        document.getElementById("profile-avatar-img").src = savedAvatar;
        document.getElementById("settings-avatar-img").src = savedAvatar;
    }

    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById("current-date").textContent = new Date().toLocaleDateString('pt-BR', options);

    const hour = new Date().getHours();
    let greeting = "";
    if (hour >= 5 && hour < 12) {
        greeting = "Bom dia ☀️";
    } else if (hour >= 12 && hour < 18) {
        greeting = "Boa tarde 🌅";
    } else {
        greeting = "Boa noite 🌙";
    }
    
    const greetingEl = document.getElementById("greeting-text");
    if (greetingEl) {
        greetingEl.textContent = greeting;
    }

    // Update patient dropdown options in Scheduling tab (mantido por compatibilidade)
    if (document.getElementById("select-patient-id")) updatePatientDropdown();
    
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

    // Settings Button removed from header - avatar now triggers the tab directly


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



    // Patient Search bar (Pacientes tab)
    document.getElementById("search-patients").addEventListener("input", renderPatientsList);

    // Agenda Search bar (Calendario tab)
    document.getElementById("search-agenda-input").addEventListener("input", renderSelectedDayAppointments);


}

// AVATAR / PROFILE PHOTO FUNCTIONS
function triggerAvatarChange() {
    // Abre o seletor de fotos nativo do dispositivo
    document.getElementById("avatar-file-input").click();
}

function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Verifica se é uma imagem válida
    if (!file.type.startsWith("image/")) {
        alert("Por favor, selecione uma imagem válida.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;

        // Atualiza todas as imagens de avatar no app
        const headerAvatar = document.getElementById("profile-avatar-img");
        const settingsAvatar = document.getElementById("settings-avatar-img");
        if (headerAvatar) headerAvatar.src = dataUrl;
        if (settingsAvatar) settingsAvatar.src = dataUrl;

        // Salva no localStorage para persistir entre sessões
        localStorage.setItem("psyassist_avatar", dataUrl);
    };
    reader.readAsDataURL(file);

    // Limpa o input para permitir selecionar a mesma foto novamente
    event.target.value = "";
}

// SETTINGS FUNCTIONS

function handleLogout() {
    if (confirm("Deseja realmente sair? Seus dados salvos neste dispositivo serão apagados.")) {
        localStorage.clear();
        location.reload();
    }
}

function handleDeleteAccount() {
    const first = confirm("⚠️ ATENÇÃO: Esta ação é irreversível!\n\nTodos os seus dados (pacientes, consultas, configurações) serão permanentemente excluídos.\n\nDeseja continuar?");
    if (!first) return;

    const second = confirm("Última confirmação: tem certeza que deseja excluir sua conta e todos os dados?\n\nEsta ação não pode ser desfeita.");
    if (!second) return;

    localStorage.clear();
    location.reload();
}

function handleNotificationsToggle(checkbox) {
    if (checkbox.checked) {
        // Solicita permissão nativa de notificações
        if ("Notification" in window) {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification("PsyAssist", {
                        body: "Notificações ativadas com sucesso! 🎉",
                        icon: "/icons/icon-192.png"
                    });
                    localStorage.setItem("psyassist_notifications", "true");
                } else {
                    // Usuário negou — reverte o toggle
                    checkbox.checked = false;
                    alert("Permissão negada. Você pode ativar notificações nas configurações do seu dispositivo.");
                }
            });
        } else {
            checkbox.checked = false;
            alert("Notificações não são suportadas neste dispositivo.");
        }
    } else {
        localStorage.setItem("psyassist_notifications", "false");
    }
}

function handleDndToggle(checkbox) {
    const isDnd = checkbox.checked;
    localStorage.setItem("psyassist_dnd", isDnd ? "true" : "false");
    // Visual feedback
    if (isDnd) {
        const msg = document.createElement("div");
        msg.textContent = "🔕 Modo Não Perturbe ativado";
        msg.style.cssText = `
            position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.75); color: white; padding: 10px 18px;
            border-radius: 20px; font-size: 0.85rem; z-index: 9999;
            animation: fadeIn 0.3s ease;
        `;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2500);
    }
}

// TERMS MODAL FUNCTIONS
function openTermsModal() {
    document.getElementById("terms-modal").classList.add("active");
}

function closeTermsModal() {
    document.getElementById("terms-modal").classList.remove("active");
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

    const headerAvatar = document.getElementById("avatar-trigger");
    if (headerAvatar) {
        if (tabId === "configuracoes") {
            headerAvatar.style.display = "none";
        } else {
            headerAvatar.style.display = "flex";
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

// GUIDED CHAT UI CONTROLS
function startGuidedChat(action) {
    document.getElementById("guided-chat-overlay").style.display = "flex";
    chatHistory = [];
    updateChatBackButton();
    
    // Inicializa a máquina de estados do chat para a ação solicitada
    if (action === 'agendar') {
        initChatFlowAgendar();
    } else if (action === 'atualizar_consulta') {
        initChatFlowAtualizarConsulta();
    } else if (action === 'cancelar_consulta') {
        initChatFlowCancelarConsulta();
    } else if (action === 'adicionar_paciente') {
        initChatFlowAdicionarPaciente();
    } else if (action === 'remover_paciente') {
        initChatFlowRemoverPaciente();
    } else if (action === 'pagamento') {
        initChatFlowPagamento();
    } else {
        // Mocked para outras ações
        const chatBox = document.getElementById("chat-messages");
        chatBox.innerHTML = `
            <div class="chat-bubble chat-bot">
                Ainda estou aprendendo a realizar esta ação ("${action}"). Em breve poderei ajudá-lo com isso!
            </div>
        `;
    }
}

function closeGuidedChat() {
    document.getElementById("guided-chat-overlay").style.display = "none";
}

// ============================================================
// GUIDED CHAT ENGINE - STATE MACHINE
// ============================================================

// Estado interno do chat
let chatState = {};
let chatHistory = [];

function updateChatBackButton() {
    const btn = document.getElementById("chat-undo-container");
    if (btn) {
        if (chatHistory.length > 0) {
            btn.style.display = "block";
        } else {
            btn.style.display = "none";
        }
    }
}

function chatGoBack() {
    if (chatHistory.length === 0) return;
    const lastAction = chatHistory.pop();
    
    // Remove todos os nós criados após o input anterior
    let node = lastAction.inputRow.nextSibling;
    while (node) {
        const next = node.nextSibling;
        node.remove();
        node = next;
    }
    
    // Restaura o estado da fotografia
    chatState = JSON.parse(JSON.stringify(lastAction.stateSnapshot));
    
    // Re-exibe e reabilita os inputs
    lastAction.inputRow.style.display = lastAction.displayStyle || "flex";
    lastAction.inputRow.style.opacity = "1";
    lastAction.inputRow.querySelectorAll("button").forEach(b => b.disabled = false);
    
    updateChatBackButton();
}

// --- Helpers de UI do Chat ---

function chatAddBotMessage(text, delay = 0) {
    return new Promise(resolve => {
        setTimeout(() => {
            const box = document.getElementById("chat-messages");
            const bubble = document.createElement("div");
            bubble.className = "chat-bubble chat-bot";
            // Converte Markdown simples (**) para HTML (<strong>)
            const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            bubble.innerHTML = formattedText;
            box.appendChild(bubble);
            box.scrollTop = box.scrollHeight;
            resolve(bubble);
        }, delay);
    });
}

function chatAddUserMessage(text) {
    const box = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-user";
    bubble.textContent = text;
    box.appendChild(bubble);
    box.scrollTop = box.scrollHeight;
}

function chatAddOptions(options) {
    const box = document.getElementById("chat-messages");
    const group = document.createElement("div");
    group.className = "chat-options-group";
    
    const stateSnapshot = JSON.parse(JSON.stringify(chatState));
    
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "chat-option-btn";
        btn.textContent = opt.label;
        btn.onclick = () => {
            // Desabilita todos os botões do grupo para evitar clique duplo
            group.querySelectorAll("button").forEach(b => b.disabled = true);
            group.style.opacity = "0.5";
            
            chatHistory.push({
                inputRow: group,
                stateSnapshot: stateSnapshot,
                displayStyle: "flex"
            });
            updateChatBackButton();
            
            opt.action();
        };
        group.appendChild(btn);
    });
    box.appendChild(group);
    box.scrollTop = box.scrollHeight;
}

function chatAddSearchInput(placeholder, onSelect) {
    const box = document.getElementById("chat-messages");
    const wrapper = document.createElement("div");
    wrapper.className = "chat-search-wrapper";

    const stateSnapshot = JSON.parse(JSON.stringify(chatState));

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.className = "chat-search-input";

    const results = document.createElement("div");
    results.className = "chat-search-results";

    input.addEventListener("input", () => {
        const q = input.value.toLowerCase().trim();
        results.innerHTML = "";
        if (!q) return;
        const matches = state.patients
            .filter(p => matchSearchQuery(p.name, q))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 5);
        matches.forEach(p => {
            const item = document.createElement("div");
            item.className = "chat-search-result-item";
            item.textContent = p.name;
            item.onclick = () => {
                wrapper.style.display = "none";
                chatHistory.push({
                    inputRow: wrapper,
                    stateSnapshot: stateSnapshot,
                    displayStyle: "block"
                });
                updateChatBackButton();
                onSelect(p);
            };
            results.appendChild(item);
        });
    });

    wrapper.appendChild(input);
    wrapper.appendChild(results);
    box.appendChild(wrapper);
    box.scrollTop = box.scrollHeight;
    setTimeout(() => input.focus(), 300);
}

function chatAddTextInput(placeholder, type, onConfirm) {
    const box = document.getElementById("chat-messages");
    const row = document.createElement("div");
    row.className = "chat-input-row";
    
    const stateSnapshot = JSON.parse(JSON.stringify(chatState));

    const input = document.createElement("input");
    input.type = type || "text";
    input.placeholder = placeholder;
    input.autocomplete = "off";

    const btn = document.createElement("button");
    btn.className = "chat-send-btn";
    btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';

    const submit = () => {
        const val = input.value.trim();
        if (!val) return;
        row.style.display = "none";
        chatHistory.push({
            inputRow: row,
            stateSnapshot: stateSnapshot,
            displayStyle: "flex"
        });
        updateChatBackButton();
        onConfirm(val);
    };

    btn.onclick = submit;
    input.addEventListener("keypress", e => { if (e.key === "Enter") submit(); });

    row.appendChild(input);
    row.appendChild(btn);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    setTimeout(() => input.focus(), 300);
}

function chatAddDateInput(onConfirm) {
    const box = document.getElementById("chat-messages");
    const row = document.createElement("div");
    row.className = "chat-input-row";
    
    const stateSnapshot = JSON.parse(JSON.stringify(chatState));

    const input = document.createElement("input");
    input.type = "date";
    const today = formatDateISO(new Date());
    input.min = today;
    input.value = today;

    const btn = document.createElement("button");
    btn.className = "chat-send-btn";
    btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';

    const submit = () => {
        const val = input.value;
        if (!val) return;
        row.style.display = "none";
        chatHistory.push({
            inputRow: row,
            stateSnapshot: stateSnapshot,
            displayStyle: "flex"
        });
        updateChatBackButton();
        onConfirm(val);
    };

    btn.onclick = submit;
    row.appendChild(input);
    row.appendChild(btn);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
}

// --- Fluxo Principal ---

function initChatFlowAgendar() {
    const box = document.getElementById("chat-messages");
    box.innerHTML = "";
    chatState = {};

    chatAddUserMessage("Quero agendar uma consulta.");
    chatAddBotMessage("Com certeza! 😊 É para um paciente existente ou vou cadastrar um novo?", 400).then(() => {
        chatAddOptions([
            { label: "👤 Paciente Existente", action: () => chatStep_ExistingPatient() },
            { label: "➕ Novo Cadastro",       action: () => chatStep_NewPatient_Name() }
        ]);
    });
}

// --- Ramo: Paciente Existente ---

function chatStep_ExistingPatient() {
    chatAddUserMessage("Paciente Existente");
    chatAddBotMessage("Ok! Digite o nome do paciente para buscar:", 400).then(() => {
        chatAddSearchInput("Buscar paciente...", (patient) => {
            chatState.patientId = patient.id;
            chatState.patientName = patient.name;
            chatAddUserMessage(patient.name);
            chatStep_AskDate();
        });
    });
}

// --- Ramo: Novo Paciente ---

function chatStep_NewPatient_Name() {
    chatAddUserMessage("Novo Cadastro");
    chatAddBotMessage("Sem problema! Qual o **nome completo** do paciente?", 400).then(() => {
        chatAddTextInput("Nome completo...", "text", (val) => {
            chatState.newName = val;
            chatAddUserMessage(val);
            chatStep_NewPatient_Age();
        });
    });
}

function chatStep_NewPatient_Age() {
    chatAddBotMessage("Qual a **idade** dele?", 400).then(() => {
        chatAddTextInput("Idade...", "number", (val) => {
            chatState.newAge = parseInt(val) || 0;
            chatAddUserMessage(val);
            chatStep_NewPatient_City();
        });
    });
}

function chatStep_NewPatient_City() {
    chatAddBotMessage("E de qual **cidade**?", 400).then(() => {
        chatAddTextInput("Cidade...", "text", (val) => {
            chatState.newCity = val;
            chatAddUserMessage(val);
            chatStep_NewPatient_Confirm();
        });
    });
}

function chatStep_NewPatient_Confirm() {
    chatAddBotMessage(`Resumo do paciente:\n\n👤 Nome: <strong>${chatState.newName}</strong>\n🎂 Idade: <strong>${chatState.newAge}</strong>\n📍 Cidade: <strong>${chatState.newCity}</strong>\n\nConfirmar informações?`, 600).then(() => {
        chatAddOptions([
            { label: "✅ Confirmar Cadastro", action: () => {
                chatAddUserMessage("Confirmar Cadastro");
                
                // Salva o novo paciente imediatamente
                const newId = "p_" + Date.now();
                const newPatient = {
                    id: newId,
                    name: chatState.newName,
                    age: chatState.newAge,
                    city: chatState.newCity,
                    notes: "",
                    paid: false
                };
                state.patients.push(newPatient);
                saveState();
                renderPatientsList();
                
                chatState.patientId = newId;
                chatState.patientName = chatState.newName;
                
                chatAddBotMessage(`✅ **${chatState.newName}** foi cadastrado com sucesso!`, 500).then(() => {
                    chatStep_AskDate();
                });
            }},
            { label: "✏️ Editar informações", action: () => chatStep_EditNewPatient() }
        ]);
    });
}

function chatStep_EditNewPatient() {
    chatAddBotMessage("O que você deseja alterar?", 400).then(() => {
        chatAddOptions([
            { label: "👤 Nome", action: () => {
                chatAddUserMessage("Nome");
                chatAddBotMessage("Qual o **nome completo** dele?", 400).then(() => {
                    chatAddTextInput("Nome completo...", "text", (val) => {
                        chatState.newName = val;
                        chatAddUserMessage(val);
                        chatStep_NewPatient_Confirm();
                    });
                });
            }},
            { label: "🎂 Idade", action: () => {
                chatAddUserMessage("Idade");
                chatAddBotMessage("Qual a **idade** dele?", 400).then(() => {
                    chatAddTextInput("Idade...", "number", (val) => {
                        chatState.newAge = parseInt(val) || 0;
                        chatAddUserMessage(val);
                        chatStep_NewPatient_Confirm();
                    });
                });
            }},
            { label: "📍 Cidade", action: () => {
                chatAddUserMessage("Cidade");
                chatAddBotMessage("E de qual **cidade**?", 400).then(() => {
                    chatAddTextInput("Cidade...", "text", (val) => {
                        chatState.newCity = val;
                        chatAddUserMessage(val);
                        chatStep_NewPatient_Confirm();
                    });
                });
            }}
        ]);
    });
}

// --- Etapa Comum: Data e Horário ---

function chatStep_AskDate() {
    chatAddBotMessage(`Ótimo! Para qual **data** você quer agendar a consulta de **${chatState.patientName}**?`, 600).then(() => {
        chatAddDateInput((dateStr) => {
            chatState.date = dateStr;
            chatAddUserMessage(formatDateBR(dateStr));
            chatStep_ShowAvailableSlots(dateStr);
        });
    });
}

function chatStep_ShowAvailableSlots(dateStr) {
    // Todos os horários possíveis das 08h às 19h (intervalos de 30 min)
    const allSlots = [];
    for (let h = 8; h <= 18; h++) {
        allSlots.push(`${String(h).padStart(2,"0")}:00`);
        allSlots.push(`${String(h).padStart(2,"0")}:30`);
    }

    // Quais já estão ocupados nesse dia?
    const taken = state.appointments
        .filter(a => a.date === dateStr)
        .map(a => a.time);

    const freeSlots = allSlots.filter(s => !taken.includes(s));

    if (freeSlots.length === 0) {
        chatAddBotMessage("😕 Este dia está completamente lotado! Que tal escolher outra data?", 600).then(() => {
            chatStep_AskDate();
        });
        return;
    }

    chatAddBotMessage("Aqui estão os **horários disponíveis**. Escolha um:", 600).then(() => {
        const box = document.getElementById("chat-messages");
        const grid = document.createElement("div");
        grid.className = "chat-slots-grid";

        freeSlots.forEach(slot => {
            const btn = document.createElement("button");
            btn.className = "chat-slot-btn";
            btn.textContent = slot;
            btn.onclick = () => {
                grid.querySelectorAll("button").forEach(b => b.disabled = true);
                grid.style.opacity = "0.5";
                chatState.time = slot;
                chatAddUserMessage(slot);
                chatStep_Confirm();
            };
            grid.appendChild(btn);
        });

        box.appendChild(grid);
        box.scrollTop = box.scrollHeight;
    });
}

function chatStep_Confirm() {
    chatAddBotMessage(
        `Tudo certo! Resumo do agendamento:\n\n👤 <strong>${chatState.patientName}</strong>\n📅 <strong>${formatDateBR(chatState.date)}</strong> às <strong>${chatState.time}</strong>\n\nConfirmar?`,
        600
    ).then(() => {
        chatAddOptions([
            {
                label: "✅ Confirmar Agendamento",
                action: () => chatStep_Save()
            },
            {
                label: "✏️ Editar informações",
                action: () => chatStep_EditAgendamento()
            }
        ]);
    });
}

function chatStep_EditAgendamento() {
    chatAddBotMessage("O que você deseja alterar?", 400).then(() => {
        chatAddOptions([
            { label: "👤 Nome do Paciente", action: () => {
                chatAddUserMessage("Nome do Paciente");
                chatAddBotMessage("É para um paciente existente ou vou cadastrar um novo?", 400).then(() => {
                    chatAddOptions([
                        { label: "👤 Paciente Existente", action: () => chatStep_ExistingPatient() },
                        { label: "➕ Novo Cadastro",       action: () => chatStep_NewPatient_Name() }
                    ]);
                });
            }},
            { label: "📅 Dia da Consulta", action: () => {
                chatAddUserMessage("Dia da Consulta");
                chatStep_AskDate();
            }},
            { label: "⏰ Horário", action: () => {
                chatAddUserMessage("Horário");
                chatStep_ShowAvailableSlots(chatState.date);
            }}
        ]);
    });
}

function chatStep_Save() {
    chatAddUserMessage("Confirmar Agendamento");

    const newAppt = {
        id: "a_" + Date.now(),
        patientId: chatState.patientId,
        patientName: chatState.patientName,
        date: chatState.date,
        time: chatState.time
    };

    state.appointments.push(newAppt);
    saveState();

    // Atualiza vistas em segundo plano
    renderTodayAppointments();
    renderCalendar();

    chatAddBotMessage(
        `🎉 <strong>Consulta agendada com sucesso!</strong><br><br>` +
        `${chatState.patientName} está na agenda para ${formatDateBR(chatState.date)} às ${chatState.time}.<br><br>` +
        `Posso ajudar com mais alguma coisa?`,
        700
    ).then(() => {
        chatAddOptions([
            { label: "📅 Agendar outra consulta", action: () => initChatFlowAgendar() },
            { label: "🏠 Voltar ao início",         action: () => closeGuidedChat() }
        ]);
    });

    chatState = {};
}

// --- Fluxo: Atualizar Consulta ---

function initChatFlowAtualizarConsulta() {
    const box = document.getElementById("chat-messages");
    box.innerHTML = "";
    chatState = {};

    chatAddUserMessage("Atualizar Consulta");
    chatAddBotMessage("De qual paciente você deseja atualizar as informações da consulta?", 400).then(() => {
        chatAddSearchInput("Buscar paciente...", (patient) => {
            chatState.patientId = patient.id;
            chatState.patientName = patient.name;
            chatAddUserMessage(patient.name);
            
            // Verifica se tem consulta
            // Para simplificar, pegamos a primeira consulta que encontrar
            const appt = state.appointments.find(a => a.patientId === patient.id);
            if (!appt) {
                chatAddBotMessage(`O paciente **${patient.name}** não possui consultas agendadas no momento.`, 400).then(() => {
                    chatAddOptions([
                        { label: "👤 Escolher outro paciente", action: () => initChatFlowAtualizarConsulta() },
                        { label: "📅 Agendar nova consulta", action: () => initChatFlowAgendar() },
                        { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
                    ]);
                });
                return;
            }
            
            chatState.apptToUpdate = appt;
            chatAddBotMessage(`Consulta atual: **${formatDateBR(appt.date)} às ${appt.time}**. O que deseja fazer?`, 400).then(() => {
                chatAddOptions([
                    { label: "📅 Mudar dia", action: () => chatStep_Atualizar_MudarDia() },
                    { label: "⏰ Mudar horário", action: () => chatStep_Atualizar_MudarHorario() }
                ]);
            });
        });
    });
}

function chatStep_Atualizar_MudarDia() {
    chatAddUserMessage("Mudar dia");
    chatAddBotMessage("Para qual **nova data** você quer mudar?", 400).then(() => {
        chatAddDateInput((dateStr) => {
            chatState.newDate = dateStr;
            chatAddUserMessage(formatDateBR(dateStr));
            chatStep_Atualizar_ShowSlots(dateStr);
        });
    });
}

function chatStep_Atualizar_MudarHorario() {
    chatAddUserMessage("Mudar horário");
    chatState.newDate = chatState.apptToUpdate.date;
    chatStep_Atualizar_ShowSlots(chatState.newDate);
}

function chatStep_Atualizar_ShowSlots(dateStr) {
    const allSlots = [];
    for (let h = 8; h <= 18; h++) {
        allSlots.push(`${String(h).padStart(2,"0")}:00`);
        allSlots.push(`${String(h).padStart(2,"0")}:30`);
    }

    // Quais já estão ocupados nesse dia? (ignorando a consulta atual do paciente)
    const taken = state.appointments
        .filter(a => a.date === dateStr && a.id !== chatState.apptToUpdate.id)
        .map(a => a.time);

    const freeSlots = allSlots.filter(s => !taken.includes(s));

    if (freeSlots.length === 0) {
        chatAddBotMessage("😕 Este dia está completamente lotado! Que tal escolher outra data?", 600).then(() => {
            chatStep_Atualizar_MudarDia();
        });
        return;
    }

    chatAddBotMessage("Aqui estão os **horários disponíveis**. Escolha um novo horário:", 600).then(() => {
        const box = document.getElementById("chat-messages");
        const grid = document.createElement("div");
        grid.className = "chat-slots-grid";

        freeSlots.forEach(slot => {
            const btn = document.createElement("button");
            btn.className = "chat-slot-btn";
            btn.textContent = slot;
            btn.onclick = () => {
                grid.querySelectorAll("button").forEach(b => b.disabled = true);
                grid.style.opacity = "0.5";
                chatState.newTime = slot;
                chatAddUserMessage(slot);
                chatStep_Atualizar_Confirm();
            };
            grid.appendChild(btn);
        });

        box.appendChild(grid);
        box.scrollTop = box.scrollHeight;
    });
}

function chatStep_Atualizar_Confirm() {
    chatAddBotMessage(
        `Resumo da atualização:\n\n👤 <strong>${chatState.patientName}</strong>\n📅 <strong>${formatDateBR(chatState.newDate)}</strong> às <strong>${chatState.newTime}</strong>\n\nConfirmar nova data/horário?`,
        600
    ).then(() => {
        chatAddOptions([
            { label: "✅ Confirmar Atualização", action: () => chatStep_Atualizar_Save() },
            { label: "✏️ Editar informações", action: () => chatStep_EditAtualizacao() }
        ]);
    });
}

function chatStep_EditAtualizacao() {
    chatAddBotMessage("O que você deseja alterar?", 400).then(() => {
        chatAddOptions([
            { label: "📅 Dia da Consulta", action: () => {
                chatStep_Atualizar_MudarDia();
            }},
            { label: "⏰ Horário", action: () => {
                chatStep_Atualizar_MudarHorario();
            }}
        ]);
    });
}

function chatStep_Atualizar_Save() {
    chatAddUserMessage("Confirmar Atualização");

    const index = state.appointments.findIndex(a => a.id === chatState.apptToUpdate.id);
    if (index !== -1) {
        state.appointments[index].date = chatState.newDate;
        state.appointments[index].time = chatState.newTime;
        saveState();
        renderTodayAppointments();
        renderCalendar();
    }

    chatAddBotMessage(
        `🎉 <strong>Consulta atualizada com sucesso!</strong><br><br>` +
        `O novo horário de ${chatState.patientName} é ${formatDateBR(chatState.newDate)} às ${chatState.newTime}.`,
        700
    ).then(() => {
        chatAddOptions([
            { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
        ]);
    });

    chatState = {};
}

// ============================================================
// FLUXO: CANCELAR CONSULTA
// ============================================================

function initChatFlowCancelarConsulta() {
    const box = document.getElementById("chat-messages");
    box.innerHTML = "";
    chatState = {};

    chatAddUserMessage("Cancelar Consulta");
    chatAddBotMessage("De qual paciente você deseja cancelar a consulta?", 400).then(() => {
        chatAddSearchInput("Buscar paciente...", chatStep_Cancelar_ProcessPatient);
    });
}

function chatStep_Cancelar_ProcessPatient(patient) {
    chatState.patientId = patient.id;
    chatState.patientName = patient.name;
    chatAddUserMessage(patient.name);

    const appts = state.appointments.filter(a => a.patientId === patient.id);

    if (appts.length === 0) {
        chatAddBotMessage(`O paciente <strong>${patient.name}</strong> não possui consultas agendadas no momento.`, 400).then(() => {
            chatAddOptions([
                { label: "👤 Escolher outro paciente", action: () => initChatFlowCancelarConsulta() },
                { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
            ]);
        });
        return;
    }

    if (appts.length === 1) {
        // Só uma consulta: vai direto para confirmação
        chatStep_Cancelar_Confirmar(appts[0]);
        return;
    }

    // Mais de uma consulta: pede para selecionar
    chatAddBotMessage(
        `<strong>${patient.name}</strong> possui <strong>${appts.length} consultas agendadas</strong>. Qual delas deseja cancelar?`,
        400
    ).then(() => {
        const sortedAppts = [...appts].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });

        chatAddOptions(
            sortedAppts.map(appt => ({
                label: `📅 ${formatDateBR(appt.date)} às ${appt.time}`,
                action: () => chatStep_Cancelar_Confirmar(appt)
            }))
        );
    });
}

function chatStep_Cancelar_Confirmar(appt) {
    chatState.apptToCancel = appt;
    chatAddUserMessage(`${formatDateBR(appt.date)} às ${appt.time}`);
    chatAddBotMessage(
        `Você selecionou a consulta de <strong>${chatState.patientName}</strong>:<br><br>` +
        `📅 <strong>${formatDateBR(appt.date)}</strong> às <strong>${appt.time}</strong><br><br>` +
        `⚠️ Tem certeza que deseja <strong>cancelar</strong> esta consulta? Esta ação não pode ser desfeita.`,
        500
    ).then(() => {
        chatAddOptions([
            { label: "🗑️ Sim, cancelar consulta", action: () => chatStep_Cancelar_Save() },
            { label: "✏️ Editar informações", action: () => chatStep_EditCancelar() }
        ]);
    });
}

function chatStep_EditCancelar() {
    chatAddBotMessage("O que você deseja alterar?", 400).then(() => {
        const options = [
            { label: "👤 Paciente", action: () => {
                chatAddUserMessage("Paciente");
                chatAddBotMessage("De qual paciente você deseja cancelar a consulta?", 400).then(() => {
                    chatAddSearchInput("Buscar paciente...", chatStep_Cancelar_ProcessPatient);
                });
            }}
        ];

        const appts = state.appointments.filter(a => a.patientId === chatState.patientId);
        if (appts.length > 1) {
            options.push({ label: "📅 Consulta Selecionada", action: () => {
                // Ao clicar aqui, o usuário já passou pelo ProcessPatient antes, vamos apenas re-renderizar as opções daquele paciente
                chatAddUserMessage("Consulta Selecionada");
                const pt = { id: chatState.patientId, name: chatState.patientName };
                // Redireciona para o processo p/ perguntar qual consulta
                chatStep_Cancelar_ProcessPatient(pt);
            }});
        }

        chatAddOptions(options);
    });
}

function chatStep_Cancelar_Save() {
    chatAddUserMessage("Sim, cancelar consulta");

    const index = state.appointments.findIndex(a => a.id === chatState.apptToCancel.id);
    if (index !== -1) {
        state.appointments.splice(index, 1);
        saveState();
        renderTodayAppointments();
        renderCalendar();
    }

    chatAddBotMessage(
        `✅ <strong>Consulta cancelada com sucesso!</strong><br><br>` +
        `O horário de ${formatDateBR(chatState.apptToCancel.date)} às ${chatState.apptToCancel.time} está novamente disponível na agenda.`,
        700
    ).then(() => {
        chatAddOptions([
            { label: "📅 Agendar nova consulta", action: () => initChatFlowAgendar() },
            { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
        ]);
    });

    chatState = {};
}

// ============================================================
// FLUXO: ADICIONAR PACIENTE
// ============================================================

function initChatFlowAdicionarPaciente() {
    const box = document.getElementById("chat-messages");
    box.innerHTML = "";
    chatState = {};

    chatAddUserMessage("Adicionar Paciente");
    chatAddBotMessage("Vamos cadastrar um novo paciente! Qual o <strong>nome completo</strong> dele?", 400).then(() => {
        chatAddTextInput("Nome completo...", "text", (val) => {
            chatState.newName = val;
            chatAddUserMessage(val);
            chatStep_AddPaciente_Age();
        });
    });
}

function chatStep_AddPaciente_Age() {
    chatAddBotMessage("Qual a <strong>idade</strong> dele?", 400).then(() => {
        chatAddTextInput("Idade...", "number", (val) => {
            chatState.newAge = parseInt(val) || 0;
            chatAddUserMessage(val);
            chatStep_AddPaciente_City();
        });
    });
}

function chatStep_AddPaciente_City() {
    chatAddBotMessage("E de qual <strong>cidade</strong>?", 400).then(() => {
        chatAddTextInput("Cidade...", "text", (val) => {
            chatState.newCity = val;
            chatAddUserMessage(val);
            chatStep_AddPaciente_Confirm();
        });
    });
}

function chatStep_AddPaciente_Confirm() {
    chatAddBotMessage(`Resumo do paciente:\n\n👤 Nome: <strong>${chatState.newName}</strong>\n🎂 Idade: <strong>${chatState.newAge}</strong>\n📍 Cidade: <strong>${chatState.newCity}</strong>\n\nConfirmar informações?`, 600).then(() => {
        chatAddOptions([
            { label: "✅ Confirmar Cadastro", action: () => {
                chatAddUserMessage("Confirmar Cadastro");

                // Salva o novo paciente
                const newId = "p_" + Date.now();
                const newPatient = {
                    id: newId,
                    name: chatState.newName,
                    age: chatState.newAge,
                    city: chatState.newCity,
                    notes: "",
                    paid: false
                };
                state.patients.push(newPatient);
                saveState();
                renderPatientsList();

                chatState.patientId = newId;
                chatState.patientName = chatState.newName;

                chatAddBotMessage(
                    `🎉 <strong>${chatState.newName}</strong> foi cadastrado com sucesso!<br><br>Deseja agendar uma consulta para ele agora?`,
                    600
                ).then(() => {
                    chatAddOptions([
                        {
                            label: "📅 Sim, agendar consulta",
                            action: () => {
                                chatAddUserMessage("Sim, agendar consulta");
                                chatStep_AskDate();
                            }
                        },
                        { label: "🏠 Não, voltar ao início", action: () => closeGuidedChat() }
                    ]);
                });
            }},
            { label: "✏️ Editar informações", action: () => chatStep_EditAddPaciente() }
        ]);
    });
}

function chatStep_EditAddPaciente() {
    chatAddBotMessage("O que você deseja alterar?", 400).then(() => {
        chatAddOptions([
            { label: "👤 Nome", action: () => {
                chatAddUserMessage("Nome");
                chatAddBotMessage("Qual o <strong>nome completo</strong> dele?", 400).then(() => {
                    chatAddTextInput("Nome completo...", "text", (val) => {
                        chatState.newName = val;
                        chatAddUserMessage(val);
                        chatStep_AddPaciente_Confirm();
                    });
                });
            }},
            { label: "🎂 Idade", action: () => {
                chatAddUserMessage("Idade");
                chatAddBotMessage("Qual a <strong>idade</strong> dele?", 400).then(() => {
                    chatAddTextInput("Idade...", "number", (val) => {
                        chatState.newAge = parseInt(val) || 0;
                        chatAddUserMessage(val);
                        chatStep_AddPaciente_Confirm();
                    });
                });
            }},
            { label: "📍 Cidade", action: () => {
                chatAddUserMessage("Cidade");
                chatAddBotMessage("E de qual <strong>cidade</strong>?", 400).then(() => {
                    chatAddTextInput("Cidade...", "text", (val) => {
                        chatState.newCity = val;
                        chatAddUserMessage(val);
                        chatStep_AddPaciente_Confirm();
                    });
                });
            }}
        ]);
    });
}

// ============================================================
// FLUXO: REMOVER PACIENTE
// ============================================================

function initChatFlowRemoverPaciente() {
    const box = document.getElementById("chat-messages");
    box.innerHTML = "";
    chatState = {};

    chatAddUserMessage("Remover Paciente");
    chatAddBotMessage("Qual paciente você deseja <strong>remover do sistema</strong>?", 400).then(() => {
        chatAddSearchInput("Buscar paciente...", chatStep_Remover_ProcessPatient);
    });
}

function chatStep_Remover_ProcessPatient(patient) {
    chatState.patientId = patient.id;
    chatState.patientName = patient.name;
    chatAddUserMessage(patient.name);

    const apptCount = state.appointments.filter(a => a.patientId === patient.id).length;
    const apptWarning = apptCount > 0
        ? `<br><br>⚠️ Atenção: este paciente possui <strong>${apptCount} consulta(s) agendada(s)</strong> que também serão removidas.`
        : "";

    chatAddBotMessage(
        `Você selecionou: <strong>${patient.name}</strong>.${apptWarning}<br><br>` +
        `Esta ação <strong>não pode ser desfeita</strong>. Deseja prosseguir?`,
        500
    ).then(() => {
        chatAddOptions([
            { label: "🗑️ Sim, remover paciente", action: () => chatStep_Remover_Save() },
            { label: "👤 Escolher outro paciente", action: () => {
                chatAddUserMessage("Escolher outro paciente");
                chatAddBotMessage("Qual paciente você deseja <strong>remover do sistema</strong>?", 400).then(() => {
                    chatAddSearchInput("Buscar paciente...", chatStep_Remover_ProcessPatient);
                });
            }}
        ]);
    });
}

// Removida chatStep_EditRemover() pois agora a opção Escolher outro paciente faz isso direto

function chatStep_Remover_Save() {
    chatAddUserMessage("Sim, remover paciente");

    const name = chatState.patientName;

    // Remove consultas do paciente
    state.appointments = state.appointments.filter(a => a.patientId !== chatState.patientId);

    // Remove paciente
    state.patients = state.patients.filter(p => p.id !== chatState.patientId);

    saveState();
    renderTodayAppointments();
    renderCalendar();
    renderPatientsList();

    chatAddBotMessage(
        `✅ <strong>${name}</strong> foi removido do sistema com sucesso.<br><br>` +
        `Todos os dados e consultas associadas foram apagados.`,
        700
    ).then(() => {
        chatAddOptions([
            { label: "🗑️ Remover outro paciente", action: () => initChatFlowRemoverPaciente() },
            { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
        ]);
    });

    chatState = {};
}

// ============================================================
// FLUXO: REGISTRAR PAGAMENTO
// ============================================================

function initChatFlowPagamento() {
    const box = document.getElementById("chat-messages");
    box.innerHTML = "";
    chatState = {};

    chatAddUserMessage("Registrar Pagamento");
    chatAddBotMessage("De qual paciente você deseja atualizar o status financeiro?", 400).then(() => {
        chatAddSearchInput("Buscar paciente...", (patient) => {
            chatState.patientId = patient.id;
            chatState.patientName = patient.name;
            chatAddUserMessage(patient.name);

            const appts = state.appointments.filter(a => a.patientId === patient.id);

            if (appts.length === 0) {
                chatAddBotMessage(`<strong>${patient.name}</strong> não possui consultas agendadas. Não há pagamento para registrar.`, 400).then(() => {
                    chatAddOptions([
                        { label: "👤 Escolher outro paciente", action: () => initChatFlowPagamento() },
                        { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
                    ]);
                });
                return;
            }

            if (appts.length === 1) {
                chatStep_Pagamento_ShowOptions(appts[0]);
                return;
            }

            // Mais de uma consulta: pede para selecionar
            chatAddBotMessage(
                `<strong>${patient.name}</strong> possui <strong>${appts.length} consultas</strong>. De qual deseja atualizar o pagamento?`,
                400
            ).then(() => {
                const sorted = [...appts].sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return a.time.localeCompare(b.time);
                });
                const statusIcon = appt => appt.paid ? "✅" : "⏳";
                chatAddOptions(
                    sorted.map(appt => ({
                        label: `${statusIcon(appt)} ${formatDateBR(appt.date)} às ${appt.time}`,
                        action: () => {
                            chatAddUserMessage(`${formatDateBR(appt.date)} às ${appt.time}`);
                            chatStep_Pagamento_ShowOptions(appt);
                        }
                    }))
                );
            });
        });
    });
}

function chatStep_Pagamento_ShowOptions(appt) {
    chatState.apptToUpdate = appt;
    const isPaid = !!appt.paid;
    const currentStatus = isPaid
        ? `<span style="color:#4ade80;font-weight:700;">PAGO ✅</span>`
        : `<span style="color:#f87171;font-weight:700;">PENDENTE ⏳</span>`;

    chatAddBotMessage(
        `Consulta de <strong>${formatDateBR(appt.date)} às ${appt.time}</strong><br>Status atual: ${currentStatus}<br><br>O que deseja fazer?`,
        500
    ).then(() => {
        chatAddOptions([
            {
                label: isPaid ? "✅ Manter como PAGO" : "✅ Marcar como PAGO",
                action: () => chatStep_Pagamento_Save(true)
            },
            {
                label: isPaid ? "⏳ Marcar como PENDENTE" : "⏳ Manter como PENDENTE",
                action: () => chatStep_Pagamento_Save(false)
            }
        ]);
    });
}

function chatStep_Pagamento_Save(paidStatus) {
    const isPaid = !!chatState.apptToUpdate.paid;
    const label = paidStatus
        ? (isPaid ? "Manter como PAGO" : "Marcar como PAGO")
        : (isPaid ? "Marcar como PENDENTE" : "Manter como PENDENTE");
    chatAddUserMessage(label);

    const index = state.appointments.findIndex(a => a.id === chatState.apptToUpdate.id);
    if (index !== -1) {
        state.appointments[index].paid = paidStatus;
        saveState();
        renderTodayAppointments();
        renderSelectedDayAppointments();
        renderPatientsList();
    }

    const emoji = paidStatus ? "✅" : "⏳";
    const statusText = paidStatus ? "PAGO" : "PENDENTE";

    chatAddBotMessage(
        `${emoji} <strong>Status atualizado!</strong><br><br>` +
        `Consulta de ${formatDateBR(chatState.apptToUpdate.date)} às ${chatState.apptToUpdate.time} agora está <strong>${statusText}</strong>.`,
        700
    ).then(() => {
        chatAddOptions([
            { label: "💲 Atualizar outro paciente", action: () => initChatFlowPagamento() },
            { label: "🏠 Voltar ao início", action: () => closeGuidedChat() }
        ]);
    });

    chatState = {};
}

// Expõe função global para o HTML
window.chatSelectPatientType = function(type) {
    if (type === "existing") chatStep_ExistingPatient();
    else chatStep_NewPatient_Name();
};

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
function togglePaymentStatus(apptId, event) {
    if (event) event.stopPropagation(); // Previne propagação de clique

    const apptIndex = state.appointments.findIndex(a => a.id === apptId);
    if (apptIndex !== -1) {
        // Toggle the paid status da consulta específica
        state.appointments[apptIndex].paid = !state.appointments[apptIndex].paid;
        saveState();
        
        // Update all views
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

    const periods = {
        "Manhã": [],
        "Tarde": [],
        "Noite": []
    };

    todayAppts.forEach(appt => {
        const timeParts = appt.time.split(":");
        const hour = parseInt(timeParts[0], 10);
        
        if (hour >= 5 && hour < 12) {
            periods["Manhã"].push(appt);
        } else if (hour >= 12 && hour < 18) {
            periods["Tarde"].push(appt);
        } else {
            periods["Noite"].push(appt);
        }
    });

    Object.keys(periods).forEach(periodName => {
        const periodAppts = periods[periodName];
        if (periodAppts.length > 0) {
            // Header do período
            const header = document.createElement("h3");
            header.className = "agenda-period-header";
            header.textContent = periodName;
            container.appendChild(header);

            periodAppts.forEach(appt => {
                const patient = state.patients.find(p => p.id === appt.patientId);
                const paymentClass = appt.paid ? "paid" : "unpaid";
                const paymentLabel = appt.paid ? "Pago" : "Pendente";
                
                const item = document.createElement("div");
                item.className = "appointment-item";
                item.onclick = () => openAppointmentModal(appt.id);
                item.innerHTML = `
                    <div class="appt-left">
                        <div class="appt-time-badge">${appt.time}</div>
                        <div class="appt-info">
                            <h4>${appt.patientName}</h4>
                            <span>${patient ? patient.city : "Sem cidade"}</span>
                        </div>
                    </div>
                    <div class="appt-right">
                        <span class="paid-badge ${paymentClass}" onclick="togglePaymentStatus('${appt.id}', event)" title="Alternar Pagamento">${paymentLabel}</span>
                    </div>
                `;
                container.appendChild(item);
            });
        }
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
        dayAppts = dayAppts.filter(appt => matchSearchQuery(appt.patientName, query));
    }

    if (dayAppts.length === 0) {
        container.innerHTML = `<div class="empty-state">Nenhuma consulta encontrada.</div>`;
        return;
    }

    const periods = {
        "Manhã": [],
        "Tarde": [],
        "Noite": []
    };

    dayAppts.forEach(appt => {
        const timeParts = appt.time.split(":");
        const hour = parseInt(timeParts[0], 10);
        
        if (hour >= 5 && hour < 12) {
            periods["Manhã"].push(appt);
        } else if (hour >= 12 && hour < 18) {
            periods["Tarde"].push(appt);
        } else {
            periods["Noite"].push(appt);
        }
    });

    Object.keys(periods).forEach(periodName => {
        const periodAppts = periods[periodName];
        if (periodAppts.length > 0) {
            // Header do período
            const header = document.createElement("h3");
            header.className = "agenda-period-header";
            header.textContent = periodName;
            container.appendChild(header);

            periodAppts.forEach(appt => {
                const patient = state.patients.find(p => p.id === appt.patientId);
                const paymentClass = appt.paid ? "paid" : "unpaid";
                const paymentLabel = appt.paid ? "Pago" : "Pendente";

                const item = document.createElement("div");
                item.className = "appointment-item";
                item.onclick = () => openAppointmentModal(appt.id);
                item.innerHTML = `
                    <div class="appt-left">
                        <div class="appt-time-badge">${appt.time}</div>
                        <div class="appt-info">
                            <h4>${appt.patientName}</h4>
                            <span>${patient ? patient.city : "Sem cidade"}</span>
                        </div>
                    </div>
                    <div class="appt-right">
                        <span class="paid-badge ${paymentClass}" onclick="togglePaymentStatus('${appt.id}', event)" title="Alternar Pagamento">${paymentLabel}</span>
                    </div>
                `;
                container.appendChild(item);
            });
        }
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
        let age = parseInt(document.getElementById("new-patient-age").value);
        age = isNaN(age) ? 0 : Math.max(0, age);
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
    
    // Atualiza o contador de pacientes totais (ignora filtro para mostrar o total absoluto)
    const countEl = document.getElementById("total-patients-count");
    if (countEl) countEl.textContent = state.patients.length;


    const query = document.getElementById("search-patients").value.toLowerCase().trim();

    const filtered = state.patients.filter(p => matchSearchQuery(p.name, query));
    // Sort alphabetically
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">Nenhum paciente encontrado.</div>`;
        return;
    }

    filtered.forEach(p => {
        // Conta quantas consultas pendentes o paciente possui
        const patientAppts = state.appointments.filter(a => a.patientId === p.id);
        const pendingCount = patientAppts.filter(a => !a.paid).length;
        
        let badgeHtml = "";
        if (pendingCount > 0) {
            const label = pendingCount === 1 ? "1 Pagamento Pendente" : `${pendingCount} Pagamentos Pendentes`;
            badgeHtml = `<span class="unpaid-text-only">${label}</span>`;
        }

        let rightActionHtml = `<i class="fa-solid fa-chevron-right" style="color: var(--text-secondary); font-size: 0.8rem;"></i>`;
        
        if (isPatientDeleteMode) {
            rightActionHtml = `<button class="delete-patient-card-btn" onclick="openPatientDeleteConfirm('${p.id}', '${p.name}', event)"><i class="fa-solid fa-xmark"></i></button>`;
        }

        const card = document.createElement("div");
        card.className = "patient-card";
        card.onclick = (e) => {
            if (!isPatientDeleteMode) {
                openPatientModalById(p.id);
            }
        };
        card.innerHTML = `
            <div class="p-left">
                <h3>${p.name}</h3>
                <span>${p.age} anos &bull; ${p.city}</span>
            </div>
            <div class="p-right">
                ${badgeHtml}
                ${rightActionHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

// ESTADO DE CONTROLE DOS PACIENTES
let isPatientDeleteMode = false;

function togglePatientDeleteMode() {
    isPatientDeleteMode = !isPatientDeleteMode;
    const btn = document.querySelector(".list-action-btn:nth-child(2)");
    if (isPatientDeleteMode) {
        btn.classList.add("active");
    } else {
        btn.classList.remove("active");
    }
    renderPatientsList();
}

function toggleNewPatientInline() {
    const form = document.getElementById("inline-new-patient-form");
    if (form.style.display === "none") {
        form.style.display = "flex";
        document.getElementById("inline-new-name").focus();
    } else {
        form.style.display = "none";
    }
}

function saveNewPatientInline() {
    const name = document.getElementById("inline-new-name").value.trim();
    let age = parseInt(document.getElementById("inline-new-age").value);
    age = isNaN(age) ? 0 : Math.max(0, age);
    const city = document.getElementById("inline-new-city").value.trim() || "Desconhecida";
    const notes = document.getElementById("inline-new-notes").value.trim() || "";

    if (!name) {
        alert("O nome do paciente é obrigatório!");
        return;
    }

    const newPatient = {
        id: "p_" + Date.now(),
        name: name,
        age: age,
        city: city,
        notes: notes,
        paid: false
    };

    state.patients.push(newPatient);
    saveState();
    
    // Clear fields
    document.getElementById("inline-new-name").value = "";
    document.getElementById("inline-new-age").value = "";
    document.getElementById("inline-new-city").value = "";
    document.getElementById("inline-new-notes").value = "";
    
    // Hide form
    document.getElementById("inline-new-patient-form").style.display = "none";
    
    // Update Dropdown and List
    updatePatientDropdown();
    renderPatientsList();
}

let patientToDelete = null;

function openPatientDeleteConfirm(id, name, event) {
    event.stopPropagation(); // Evita abrir o perfil
    patientToDelete = id;
    document.getElementById("delete-patient-name").textContent = name;
    document.getElementById("patient-confirm-modal").classList.add("active");
}

function closePatientConfirmDeleteModal() {
    patientToDelete = null;
    document.getElementById("patient-confirm-modal").classList.remove("active");
}

function confirmDeletePatient() {
    if (!patientToDelete) return;

    // Remove das consultas
    state.appointments = state.appointments.filter(a => a.patientId !== patientToDelete);
    
    // Remove registros (Timeline)
    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    if (records[patientToDelete]) {
        delete records[patientToDelete];
        localStorage.setItem("psyassist_records", JSON.stringify(records));
    }

    // Remove o paciente
    state.patients = state.patients.filter(p => p.id !== patientToDelete);
    
    saveState();
    closePatientConfirmDeleteModal();
    updatePatientDropdown();
    renderPatientsList();
}

// MODAL: PACIENTE DETALHES & HISTÓRICO
let activeModalPatientId = "";

// ==========================================
// CONTROLE DO MODAL DE CONSULTAS
// ==========================================
let activeAppointmentId = null;

function populateTimeSelects() {
    const hourSelect = document.getElementById("appt-modal-hour");
    const minuteSelect = document.getElementById("appt-modal-minute");
    
    if (hourSelect.options.length === 0) {
        for (let i = 0; i < 24; i++) {
            const val = i.toString().padStart(2, "0");
            hourSelect.add(new Option(val, val));
        }
        for (let i = 0; i < 60; i++) {
            const val = i.toString().padStart(2, "0");
            minuteSelect.add(new Option(val, val));
        }
    }
}

function openAppointmentModal(apptId) {
    const appt = state.appointments.find(a => a.id === apptId);
    if (!appt) return;
    
    activeAppointmentId = apptId;
    document.getElementById("appt-modal-patient-name").textContent = appt.patientName;
    document.getElementById("appt-modal-date").value = appt.date;
    populateTimeSelects();
    
    const timeParts = appt.time.split(":");
    document.getElementById("appt-modal-hour").value = timeParts[0] || "00";
    document.getElementById("appt-modal-minute").value = timeParts[1] || "00";
    
    document.getElementById("appointment-action-modal").classList.add("active");
}

function closeAppointmentModal() {
    activeAppointmentId = null;
    document.getElementById("appointment-action-modal").classList.remove("active");
}

function saveAppointmentEdits() {
    if (!activeAppointmentId) return;
    
    const appt = state.appointments.find(a => a.id === activeAppointmentId);
    if (!appt) return;
    
    const newDate = document.getElementById("appt-modal-date").value;
    const hour = document.getElementById("appt-modal-hour").value;
    const minute = document.getElementById("appt-modal-minute").value;
    
    const newTime = `${hour}:${minute}`;
    
    if (!newDate) {
        alert("Preencha uma data válida.");
        return;
    }
    
    appt.date = newDate;
    appt.time = newTime;
    
    saveState();
    closeAppointmentModal();
    
    // Refresh screens
    renderTodayAppointments();
    renderSelectedDayAppointments();
    renderCalendar();
}

function openAppointmentDeleteConfirm() {
    document.getElementById("appt-confirm-modal").classList.add("active");
}

function closeAppointmentDeleteConfirm() {
    document.getElementById("appt-confirm-modal").classList.remove("active");
}

function confirmDeleteAppointment() {
    if (!activeAppointmentId) return;
    
    state.appointments = state.appointments.filter(a => a.id !== activeAppointmentId);
    saveState();
    
    closeAppointmentDeleteConfirm();
    closeAppointmentModal();
    
    // Refresh screens
    renderTodayAppointments();
    renderSelectedDayAppointments();
    renderCalendar();
}
function openPatientModalById(patientId) {
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;

    activeModalPatientId = patientId;

    document.getElementById("modal-patient-name").textContent = patient.name;
    document.getElementById("modal-patient-name-display").textContent = patient.name;
    document.getElementById("modal-patient-age").textContent = patient.age || "-";
    document.getElementById("modal-patient-city").textContent = patient.city || "Desconhecida";
    document.getElementById("modal-patient-notes").textContent = patient.notes || "Nenhuma observação informada.";
    // Reset edit mode if open
    document.getElementById("patient-info-display").style.display = "block";
    document.getElementById("patient-info-edit").style.display = "none";
    const editBtn = document.getElementById("edit-patient-btn");
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Editar';
    editBtn.onclick = toggleEditPatientInfo;

    // Set payment pending list
    const modalAppts = state.appointments.filter(a => a.patientId === patientId);
    const pendingAppts = modalAppts.filter(a => !a.paid);
    const paymentListEl = document.getElementById("modal-payment-pending-list");
    
    if (pendingAppts.length > 0) {
        const datesStr = pendingAppts.map(a => formatDateBR(a.date)).join(", ");
        const label = pendingAppts.length === 1 ? "Pagamento Pendente:" : "Pagamentos Pendentes:";
        paymentListEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${label} ${datesStr}`;
        paymentListEl.style.display = "block";
    } else {
        paymentListEl.style.display = "none";
    }

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

function toggleEditPatientInfo() {
    const patient = state.patients.find(p => p.id === activeModalPatientId);
    if (!patient) return;

    document.getElementById("patient-info-display").style.display = "none";
    document.getElementById("patient-info-edit").style.display = "flex";
    
    document.getElementById("edit-patient-name").value = patient.name || "";
    document.getElementById("edit-patient-age").value = patient.age || "";
    document.getElementById("edit-patient-city").value = patient.city || "";
    document.getElementById("edit-patient-notes").value = patient.notes || "";

    const editBtn = document.getElementById("edit-patient-btn");
    editBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar';
    editBtn.onclick = savePatientInfo;
}

function savePatientInfo() {
    const patient = state.patients.find(p => p.id === activeModalPatientId);
    if (!patient) return;

    patient.name = document.getElementById("edit-patient-name").value.trim() || patient.name;
    let age = parseInt(document.getElementById("edit-patient-age").value);
    patient.age = isNaN(age) ? null : Math.max(0, age);
    patient.city = document.getElementById("edit-patient-city").value.trim();
    patient.notes = document.getElementById("edit-patient-notes").value.trim();

    // Update DEFAULT_PATIENTS as well (since we don't have a backend)
    const defaultPatient = DEFAULT_PATIENTS.find(p => p.id === patient.id);
    if (defaultPatient) {
        defaultPatient.name = patient.name;
        defaultPatient.age = patient.age;
        defaultPatient.city = patient.city;
        defaultPatient.notes = patient.notes;
    }
    saveState();

    // Refresh UI
    document.getElementById("modal-patient-name").textContent = patient.name;
    document.getElementById("modal-patient-name-display").textContent = patient.name;
    document.getElementById("modal-patient-age").textContent = patient.age || "-";
    document.getElementById("modal-patient-city").textContent = patient.city || "Desconhecida";
    document.getElementById("modal-patient-notes").textContent = patient.notes || "Nenhuma observação informada.";

    document.getElementById("patient-info-display").style.display = "block";
    document.getElementById("patient-info-edit").style.display = "none";
    
    const editBtn = document.getElementById("edit-patient-btn");
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Editar';
    editBtn.onclick = toggleEditPatientInfo;

    renderPatientsList(); // Refresh background list
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
                <div style="display: flex; gap: 8px;">
                    <button class="delete-note-inline-btn" title="Excluir esta data" onclick="deleteTimelineDate('${group.date}')">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <button class="add-note-inline-btn" title="Editar anotações neste dia" onclick="openInlineNoteEditor('${group.date}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
            </div>
            <div class="timeline-note-cards" id="note-cards-${group.date}">
                <!-- Notes will go here -->
            </div>
            <!-- Inline Note Editor (Hidden initially) -->
            <div class="inline-note-editor" id="editor-${group.date}">
                <div class="add-note-trigger-btn" id="trigger-${group.date}" onclick="showNoteInput('${group.date}')">
                    <i class="fa-solid fa-plus"></i> Adicionar anotação
                </div>
                <div class="note-input-row" id="input-row-${group.date}" style="display: none;">
                    <input type="text" placeholder="Escreva a anotação..." id="input-${group.date}">
                    <button class="inline-note-save" onclick="saveInlineNote('${group.date}')">Salvar</button>
                </div>
            </div>
        `;
        container.appendChild(dateGroup);

        // Add note cards under this date group
        const cardsContainer = document.getElementById(`note-cards-${group.date}`);
        group.notes.forEach((noteText, idx) => {
            const card = document.createElement("div");
            card.className = "note-card-container";
            card.innerHTML = `
                <div class="note-card note-card-display" id="display-${group.date}-${idx}">${noteText}</div>
                <div class="note-card-edit" id="edit-${group.date}-${idx}" style="display: none;">
                    <textarea class="edit-note-textarea" id="textarea-${group.date}-${idx}" rows="2">${noteText}</textarea>
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
                        <button class="delete-note-btn" onclick="deleteSingleNote('${group.date}', ${idx})"><i class="fa-solid fa-trash"></i></button>
                        <button class="inline-note-save" onclick="updateSingleNote('${group.date}', ${idx})">Atualizar</button>
                    </div>
                </div>
            `;
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
    const isNowActive = editor.classList.toggle("active");
    
    // Toggle notes in this group to edit mode
    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    const group = (records[activeModalPatientId] || []).find(g => g.date === date);
    if (group && group.notes) {
        group.notes.forEach((_, idx) => {
            const displayEl = document.getElementById(`display-${date}-${idx}`);
            const editEl = document.getElementById(`edit-${date}-${idx}`);
            if (displayEl && editEl) {
                if (isNowActive) {
                    displayEl.style.display = "none";
                    editEl.style.display = "block";
                } else {
                    displayEl.style.display = "block";
                    editEl.style.display = "none";
                }
            }
        });
    }

    if (!isNowActive) {
        // Reset states if closing
        const trigger = document.getElementById(`trigger-${date}`);
        const inputRow = document.getElementById(`input-row-${date}`);
        if(trigger) trigger.style.display = "flex";
        if(inputRow) inputRow.style.display = "none";
    }
}

function updateSingleNote(date, idx) {
    if (!activeModalPatientId) return;
    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    const group = (records[activeModalPatientId] || []).find(g => g.date === date);
    if (group) {
        const text = document.getElementById(`textarea-${date}-${idx}`).value.trim();
        if (text) {
            group.notes[idx] = text;
            localStorage.setItem("psyassist_records", JSON.stringify(records));
            renderPatientTimeline(activeModalPatientId);
            // Re-open editor mode automatically to keep flow smooth
            openInlineNoteEditor(date);
        } else {
            // Se deixar vazio, exclui
            deleteSingleNote(date, idx);
        }
    }
}

function deleteSingleNote(date, idx) {
    if (!activeModalPatientId) return;
    if (!confirm("Excluir esta anotação específica?")) return;
    
    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    const group = (records[activeModalPatientId] || []).find(g => g.date === date);
    if (group) {
        group.notes.splice(idx, 1);
        localStorage.setItem("psyassist_records", JSON.stringify(records));
        renderPatientTimeline(activeModalPatientId);
        openInlineNoteEditor(date);
    }
}

function showNoteInput(date) {
    document.getElementById(`trigger-${date}`).style.display = "none";
    const inputRow = document.getElementById(`input-row-${date}`);
    inputRow.style.display = "flex";
    document.getElementById(`input-${date}`).focus();
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
    const picker = document.getElementById("hidden-date-picker");
    if (picker) {
        // Usa showPicker() nativo
        try {
            picker.showPicker();
        } catch (e) {
            // Fallback se showPicker não for suportado
            picker.focus();
            picker.click();
        }
    }
}

function handleNewTimelineDate(event) {
    if (!activeModalPatientId) return;

    const dateStr = event.target.value;
    event.target.value = ""; // reset
    if (!dateStr) return;

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

let dateToDelete = null;

function deleteTimelineDate(dateStr) {
    if (!activeModalPatientId) return;

    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    if (!records[activeModalPatientId]) return;

    const group = records[activeModalPatientId].find(g => g.date === dateStr);
    
    // Se a data estiver vazia (sem anotações), exclua direto (silenciosamente)
    if (group && (!group.notes || group.notes.length === 0)) {
        records[activeModalPatientId] = records[activeModalPatientId].filter(g => g.date !== dateStr);
        localStorage.setItem("psyassist_records", JSON.stringify(records));
        renderPatientTimeline(activeModalPatientId);
        return;
    }

    // Se tiver anotações, abra o modal
    dateToDelete = dateStr;
    document.getElementById("confirm-modal").classList.add("active");
}

function closeConfirmDeleteModal() {
    document.getElementById("confirm-modal").classList.remove("active");
    dateToDelete = null;
}

function confirmDeleteDate() {
    if (!activeModalPatientId || !dateToDelete) return;

    const records = JSON.parse(localStorage.getItem("psyassist_records") || "{}");
    if (records[activeModalPatientId]) {
        records[activeModalPatientId] = records[activeModalPatientId].filter(g => g.date !== dateToDelete);
        localStorage.setItem("psyassist_records", JSON.stringify(records));
        renderPatientTimeline(activeModalPatientId);
    }
    
    closeConfirmDeleteModal();
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

        // Simulated OCR text options matching patient case study profiles (without "Digitalizado..." prefix)
        const ocrSamples = [
            "Paciente relata sentimentos recorrentes de angústia social. Discutiu episódios de isolamento autoimposto. Orientado a manter diário de humor.",
            "Progresso na organização de prioridades. Mencionou conflito com o chefe, mas soube lidar de forma assertiva utilizando a técnica de CNV (comunicação não-violenta).",
            "Apresenta ansiedade somatizada em dores no estômago. Trabalhamos respiração diafragmática profunda em sessão. Recomendada continuação.",
            "Paciente demonstrou forte reatividade emocional a críticas. Exploração de crenças nucleares de rejeição na infância. Próximo passo: reestruturação cognitiva."
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
            localStorage.setItem("psyassist_records", JSON.stringify(records));
            renderPatientTimeline(activeModalPatientId);
        }

        // Não salvar automaticamente! Apenas injetar no input de edição
        const inputEl = document.getElementById(`input-${todayStr}`);
        if (!inputEl) {
            // Se o editor ainda não estiver renderizado por algum motivo
            renderPatientTimeline(activeModalPatientId);
        }
        
        openInlineNoteEditor(todayStr);
        const newInputEl = document.getElementById(`input-${todayStr}`);
        if (newInputEl) {
            newInputEl.value = randomNote;
            newInputEl.focus();
        }
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
        return state.patients.find(p => matchSearchQuery(p.name, query));
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
                if (matchSearchQuery(cleaned, p.name)) {
                    foundPatient = p;
                    cleaned = cleaned.toLowerCase().replace(p.name.toLowerCase(), "").trim();
                    break;
                }
            }

            // If not fully matched, check first name matching
            if (!foundPatient) {
                for (let p of state.patients) {
                    const firstName = p.name.split(" ")[0].toLowerCase();
                    if (matchSearchQuery(cleaned, firstName)) {
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
                // Marca a consulta mais próxima do paciente como paga
                const apptToPay = state.appointments.find(a => a.patientId === foundPatient.id);
                if (apptToPay) {
                    apptToPay.paid = true;
                    actionsExecuted.push(`💳 Status de pagamento de <strong>${foundPatient.name}</strong> atualizado para: <strong>Pago</strong>.`);
                } else {
                    actionsExecuted.push(`⚠️ <strong>${foundPatient.name}</strong> não possui consultas agendadas para marcar como pago.`);
                }
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
