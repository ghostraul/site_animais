/* ══════════════════════════════════════════════════════
   SOS Animal Help — main.js
   Integração PIX via Veno Payments (Netlify Functions)
   ══════════════════════════════════════════════════════ */

/* ── STATE ── */
let selectedAmount  = 0;
let currentPixId    = null;
let pollingInterval = null;

/* ── IMPACT DESCRIPTIONS ── */
const impacts = {
  10:  'Ração por 2 dias para 1 animal',
  25:  '~1 semana de ração para 1 animal',
  50:  'Ração para 2 animais por 1 semana',
  100: '1 mês completo de alimentação',
  200: 'Ração + vacina essencial',
  300: 'Semana de abrigo completo',
  500: 'Consulta veterinária completa',
  700: 'Castração e recuperação',
  900: 'Tratamento completo de saúde',
};

/* ── FORMAT BRL ── */
function formatBRL(val) {
  return 'R$ ' + val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ── CONVERTE VALOR EM CENTAVOS ── */
function toCentavos(reais) {
  return Math.round(Number(reais) * 100);
}

/* ══════════════════════════════════════════════════════
   SELEÇÃO DE VALOR + ORDER BUMP
   ══════════════════════════════════════════════════════ */
function selectAmount(val) {
  selectedAmount = val;
  document.querySelectorAll('.value-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('onclick') === `selectAmount(${val})`);
  });
  showOrderBump(val);
}

function confirmDonate() {
  if (!selectedAmount) {
    alert('Por favor, selecione um valor de doação 🐾');
    return;
  }
  showOrderBump(selectedAmount);
}

/* ══════════════════════════════════════════════════════
   ORDER BUMP
   ══════════════════════════════════════════════════════ */
function showOrderBump(val) {
  selectedAmount = val;
  document.getElementById('bump-amount-display').textContent = formatBRL(val);
  document.getElementById('bump-confirmed-text').textContent =
    'Sua doação de ' + formatBRL(val) + ' vai ' +
    (impacts[val] || 'ajudar animais em necessidade') + '!';
  document.getElementById('orderBump').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function addBump(extra) {
  const total = selectedAmount + extra;
  closeBump();
  abrirPixModal(total, `doação de ${formatBRL(selectedAmount)} + R$${extra} para medicamentos`);
}

function skipBump() {
  closeBump();
  abrirPixModal(selectedAmount, impacts[selectedAmount] || 'ajudar animais em necessidade');
}

function closeBump() {
  document.getElementById('orderBump').classList.remove('active');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════════
   PIX MODAL — gera PIX real via Netlify Function
   ══════════════════════════════════════════════════════ */
async function abrirPixModal(valorEmReais, label) {
  mostrarModalLoading(valorEmReais, label);

  try {
    const centavos = toCentavos(valorEmReais);

    const response = await fetch('/.netlify/functions/criar-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:      centavos,
        description: `Doação SOS Animal Help — ${label}`,
      }),
    });

    const pix = await response.json();

    if (!response.ok) {
      throw new Error(pix.error || `Erro ${response.status}`);
    }

    // Debug no console do browser — ajuda a diagnosticar problemas da API
    console.log('[PIX] Resposta da API:', pix);
    console.log('[PIX] Campos retornados pela Veno:', pix._debug_fields);
    console.log('[PIX] qr_code_image (primeiros 100 chars):', String(pix.qr_code_image || '').substring(0, 100));

    currentPixId = pix.id;
    preencherModalPix(pix, valorEmReais, label);

    if (pix.id) iniciarPolling(pix.id);

  } catch (err) {
    console.error('[abrirPixModal] Erro:', err);
    mostrarErroModal(err.message);
  }
}

/* ── Exibe o modal com tela de carregamento ── */
function mostrarModalLoading(valorEmReais, label) {
  document.getElementById('pix-amount').textContent = formatBRL(valorEmReais);
  document.getElementById('pix-desc').textContent   = `Gerando PIX para ${label}...`;
  document.getElementById('pix-key').textContent    = 'Aguardando...';

  const btnCopy = document.querySelector('.btn-copy');
  if (btnCopy) { btnCopy.disabled = true; btnCopy.textContent = '...'; }

  document.getElementById('pixModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/* ── Preenche o modal com dados reais do PIX ── */
function preencherModalPix(pix, valorEmReais, label) {
  document.getElementById('pix-amount').textContent = formatBRL(valorEmReais);
  document.getElementById('pix-desc').textContent =
    `Você está doando para ${label}. Obrigado por salvar vidas! 🐾`;

  document.getElementById('pix-key').textContent = pix.pix_copy_paste || '';

  const btnCopy = document.querySelector('.btn-copy');
  if (btnCopy) { btnCopy.disabled = false; btnCopy.textContent = 'Copiar'; }

  if (pix.expires_at) {
    const expira = new Date(pix.expires_at);
    const hora   = expira.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('pix-desc').textContent += ` (expira às ${hora})`;
  }
}

/* ── Exibe erro no modal ── */
function mostrarErroModal(msg) {
  document.getElementById('pix-desc').textContent =
    '❌ Erro ao gerar PIX. Tente novamente ou entre em contato.';

  const btnCopy = document.querySelector('.btn-copy');
  if (btnCopy) { btnCopy.disabled = true; btnCopy.textContent = '—'; }
}

/* ── Fecha modal PIX ── */
function closeModal() {
  document.getElementById('pixModal').classList.remove('active');
  document.body.style.overflow = '';
  pararPolling();
}

/* ══════════════════════════════════════════════════════
   COPIAR PIX COPIA E COLA
   ══════════════════════════════════════════════════════ */
function copyPix() {
  const key = document.getElementById('pix-key').textContent;
  if (!key || key === 'Aguardando...') return;

  navigator.clipboard.writeText(key).then(() => {
    const btn = document.querySelector('.btn-copy');
    const orig = btn.textContent;
    btn.textContent      = '✓ Copiado!';
    btn.style.background = '#1A7A6E';
    setTimeout(() => {
      btn.textContent      = orig;
      btn.style.background = '';
    }, 2200);
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = key;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert('Chave PIX copiada!');
  });
}

/* ══════════════════════════════════════════════════════
   POLLING — verifica pagamento a cada 5s
   ══════════════════════════════════════════════════════ */
function iniciarPolling(pixId) {
  pararPolling();
  let tentativas = 0;
  const MAX = 120;

  pollingInterval = setInterval(async () => {
    tentativas++;
    try {
      const r = await fetch(`/.netlify/functions/status-pix?id=${pixId}`);
      if (!r.ok) return;
      const data = await r.json();

      if (data.status === 'paid') {
        pararPolling();
        exibirPagamentoConfirmado(data);
      }
      if (data.status === 'expired' || data.status === 'cancelled') {
        pararPolling();
        document.getElementById('pix-desc').textContent =
          '⏰ Este PIX expirou. Feche e gere um novo.';
      }
    } catch (_) {}

    if (tentativas >= MAX) pararPolling();
  }, 5000);
}

function pararPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

/* ── Tela de sucesso quando PIX é confirmado ── */
function exibirPagamentoConfirmado(data) {
  document.getElementById('pixModal').querySelector('.pix-box').innerHTML = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:4rem;margin-bottom:16px">✅</div>
      <h3 style="font-family:'Playfair Display',serif;font-size:1.6rem;color:#1C1C1C;margin-bottom:12px">
        Pagamento Confirmado!
      </h3>
      <p style="color:#5A5A5A;font-size:1rem;margin-bottom:8px">
        Obrigado pela sua doação de <strong style="color:#E8651A">
          ${formatBRL((data.amount || 0) / 100)}
        </strong> 🐾
      </p>
      <p style="color:#5A5A5A;font-size:0.9rem;margin-bottom:28px">
        Sua generosidade vai alimentar vidas reais hoje.
      </p>
      <button onclick="closeModal()"
        style="background:#1A7A6E;color:#fff;border:none;border-radius:100px;
               padding:12px 36px;font-size:1rem;font-weight:600;cursor:pointer;
               font-family:'DM Sans',sans-serif">
        Fechar 🐾
      </button>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   FECHAR MODAIS AO CLICAR NO BACKDROP / ESC
   ══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pixModal').addEventListener('click', e => {
    if (e.target === document.getElementById('pixModal')) closeModal();
  });
  document.getElementById('orderBump').addEventListener('click', e => {
    if (e.target === document.getElementById('orderBump')) closeBump();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeBump(); }
  });

  startToasts();
});

/* ══════════════════════════════════════════════════════
   SOCIAL PROOF — TOASTS DE DOAÇÕES
   Sem foto — apenas nome, valor e tempo
   ══════════════════════════════════════════════════════ */
const donors = [
  { name: 'Ana C.',      city: 'São Paulo',      amount: 'R$ 50'  },
  { name: 'Juliana S.',  city: 'Curitiba',       amount: 'R$ 25'  },
  { name: 'Fernanda T.', city: 'Brasília',       amount: 'R$ 100' },
  { name: 'Patrícia N.', city: 'Salvador',       amount: 'R$ 50'  },
  { name: 'Letícia G.',  city: 'Manaus',         amount: 'R$ 200' },
  { name: 'Camila R.',   city: 'Recife',         amount: 'R$ 300' },
  { name: 'Rafael M.',   city: 'Belo Horizonte', amount: 'R$ 100' },
  { name: 'Marcos L.',   city: 'Porto Alegre',   amount: 'R$ 500' },
  { name: 'Carlos R.',   city: 'Fortaleza',      amount: 'R$ 25'  },
  { name: 'Thiago B.',   city: 'Florianópolis',  amount: 'R$ 700' },
  { name: 'Diego F.',    city: 'Goiânia',        amount: 'R$ 300' },
  { name: 'Bruno A.',    city: 'Belém',          amount: 'R$ 50'  },
];
const timeLabels = ['agora mesmo', 'há 1 min', 'há 2 min', 'há 3 min', 'há 5 min'];

function showToast(donor) {
  const container = document.getElementById('toast-container');
  const time = timeLabels[Math.floor(Math.random() * timeLabels.length)];

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <div>
      <strong>${donor.name} de ${donor.city}</strong>
      <span>doou ${donor.amount} — ${time} 🐾</span>
    </div>`;

  container.appendChild(t);

  setTimeout(() => {
    t.classList.add('toast-out');
    setTimeout(() => t.remove(), 350);
  }, 4500);
}

function startToasts() {
  let i = 0;
  const shuffled = [...donors].sort(() => Math.random() - 0.5);

  // Primeiro toast em 5 segundos
  setTimeout(() => showToast(shuffled[i++ % shuffled.length]), 5000);

  // Demais a cada 30–40 segundos
  setInterval(() => {
    setTimeout(() => showToast(shuffled[i++ % shuffled.length]), 30000 + Math.random() * 10000);
  }, 35000);
}
