import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =======================================================
// COPIE A SUA FIREBASE CONFIG DO SCRIPT.JS E COLE AQUI:
// =======================================================


const firebaseConfig = {
  apiKey: "AIzaSyCikTxSJLoSBJeGrNRugs1MvWxCohakwnI",
  authDomain: "database-anotador.firebaseapp.com",
  databaseURL: "https://database-anotador-default-rtdb.firebaseio.com",
  projectId: "database-anotador",
  storageBucket: "database-anotador.firebasestorage.app",
  messagingSenderId: "1026172295848",
  appId: "1:1026172295848:web:b5193909feee24ac8d409d",
  measurementId: "G-L1Z0YKXT9N"
};
// =======================================================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const companyId = "universo_acai";
const ADMIN_EMAIL = "admin@universoacai.com"; // Deve ser igual ao Authentication

// --- 1. SEGURANÇA E LOGIN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email !== ADMIN_EMAIL) {
            alert("Acesso Negado: Este admin não pertence a esta empresa.");
            signOut(auth);
            return;
        }
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'block';
        initSystem();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    }
});

document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-senha').value)
        .catch(error => alert("Erro: " + error.message));
});

window.fazerLogout = () => signOut(auth);

// --- 2. NAVEGAÇÃO ---
window.trocarAba = (aba) => {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`view-${aba}`).style.display = 'block';
    
    const navMap = { 'pedidos': 0, 'financeiro': 1, 'estoque': 2 };
    document.querySelectorAll('.nav-btn')[navMap[aba]].classList.add('active');
};

// --- 3. SISTEMA ---
let pedidosCache = [];

function initSystem() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('filtro-data-pedidos').value = hoje;
    document.getElementById('filtro-data-financeiro').value = hoje;

    carregarPedidos();
    carregarEstoque(); // Nova função corrigida

    document.getElementById('filtro-data-pedidos').addEventListener('change', renderizarPedidos);
    document.getElementById('filtro-data-financeiro').addEventListener('change', calcularFinanceiro);
}

// --- 4. PEDIDOS ---
function carregarPedidos() {
    const pedidosRef = ref(db, `empresas/${companyId}/pedidos`);
    onValue(pedidosRef, (snapshot) => {
        pedidosCache = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => pedidosCache.push({ id: key, ...data[key] }));
        }
        // Ordena por timestamp se possível, ou usa reverso simples
        pedidosCache.reverse();
        renderizarPedidos();
        calcularFinanceiro();
    });
}

function renderizarPedidos() {
    const filtro = document.getElementById('filtro-data-pedidos').value; 
    const [ano, mes, dia] = filtro.split('-');
    const buscaData = `${dia}/${mes}/${ano}`;

    const container = document.getElementById('lista-pedidos');
    container.innerHTML = '';

    // Filtra pela data formatada (DD/MM/YYYY) que está salva no banco
    const filtrados = pedidosCache.filter(p => p.data_hora && p.data_hora.includes(buscaData));

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="color:#666; width:100%">Sem pedidos nesta data.</p>';
        return;
    }

    filtrados.forEach(p => {
        const classeStatus = p.status === 'entregue' ? 'st-entregue' : (p.status === 'cancelado' ? 'st-cancelado' : 'st-pendente');
        
        let htmlItens = '';
        if (p.itens) {
            p.itens.forEach(item => {
                htmlItens += `<div style="margin-bottom:5px; font-size:0.9rem; color:#ccc;">
                   ${item.quantidade || 1}x <b>${item.produto}</b> <br>
                   <small>${item.sabores ? Object.keys(item.sabores).join(', ') : ''}</small>
                </div>`;
            });
        }

        const card = document.createElement('div');
        card.className = 'card-pedido';
        card.innerHTML = `
            <div class="card-header">
                <span style="color:#fff">#${p.id.slice(-4)}</span>
                <span class="status ${classeStatus}">${p.status}</span>
            </div>
            <div style="margin-bottom:10px; color: var(--neon-blue);">
                <i class="fas fa-user"></i> ${p.cliente?.nome || 'Cliente'} <br>
                <i class="fab fa-whatsapp"></i> ${p.cliente?.whatsapp || ''}
            </div>
            <div style="background:#111; padding:10px; border-radius:5px; margin-bottom:10px;">${htmlItens}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:1.2rem;">R$ ${p.total_pedido || 0}</strong>
                <div>
                    <button onclick="mudarStatus('${p.id}', 'entregue')" style="color:#0f0; background:none; border:1px solid #0f0; cursor:pointer;">✔</button>
                    <button onclick="mudarStatus('${p.id}', 'cancelado')" style="color:#f00; background:none; border:1px solid #f00; cursor:pointer;">✖</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

window.mudarStatus = (id, st) => {
    update(ref(db, `empresas/${companyId}/pedidos/${id}`), { status: st });
};

// --- 5. FINANCEIRO ---
function calcularFinanceiro() {
    const dataInput = document.getElementById('filtro-data-financeiro').value;
    const [ano, mes, dia] = dataInput.split('-');
    const strDia = `${dia}/${mes}/${ano}`;
    const strMes = `${mes}/${ano}`;

    let fatDia = 0, fatMes = 0;

    pedidosCache.forEach(p => {
        if(p.status === 'cancelado') return;
        let val = parseFloat(p.total_pedido) || 0;
        
        if (p.data_hora && p.data_hora.includes(strDia)) fatDia += val;
        if (p.data_hora && p.data_hora.includes(`/${strMes}`)) fatMes += val;
    });

    const margem = 0.40;
    document.getElementById('fat-dia').innerText = `R$ ${fatDia.toFixed(2)}`;
    document.getElementById('lucro-dia').innerText = `R$ ${(fatDia * margem).toFixed(2)}`;
    document.getElementById('fat-mes').innerText = `R$ ${fatMes.toFixed(2)}`;
    document.getElementById('lucro-mes').innerText = `R$ ${(fatMes * margem).toFixed(2)}`;
}

// --- 6. ESTOQUE ---
function carregarEstoque() {
    // Aponta para a NOVA estrutura dentro da empresa
    const base = `empresas/${companyId}/cardapio`;
    renderToggleGroup(`${base}/sabores`, 'estoque-sabores');
    renderToggleGroup(`${base}/recheios`, 'estoque-recheios');
    renderToggleGroup(`${base}/adicionais`, 'estoque-adicionais');
}

function renderToggleGroup(path, divId) {
    onValue(ref(db, path), snapshot => {
        const div = document.getElementById(divId);
        div.innerHTML = '';
        const dados = snapshot.val();
        
        if(dados) {
            Object.keys(dados).forEach(key => {
                const item = dados[key];
                const isAtivo = item.disponivel !== false;

                const row = document.createElement('div');
                row.className = `item-row ${!isAtivo ? 'disabled' : ''}`;
                row.innerHTML = `
                    <span>${item.nome}</span>
                    <label class="switch">
                        <input type="checkbox" ${isAtivo ? 'checked' : ''} 
                            onchange="toggleItem('${path}/${key}', this.checked)">
                        <span class="slider"></span>
                    </label>
                `;
                div.appendChild(row);
            });
        }
    });
}

window.toggleItem = (fullPath, estado) => {
    // Atualiza o caminho exato passado
    update(ref(db, fullPath), { disponivel: estado });
};