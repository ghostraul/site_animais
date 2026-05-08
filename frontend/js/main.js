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
  25:   '~1 semana de ração para 1 animal',
  50:   'Ração para 2 animais por 1 semana',
  75:   'Ração + vermífugo para 1 animal',
  100:  '1 mês completo de alimentação',
  150:  'Ração + vacina essencial',
  250:  'Semana de abrigo completo',
  500:  'Consulta veterinária completa',
  750:  'Castração e recuperação',
  1000: 'Tratamento de saúde completo',
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

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Erro desconhecido');
    }

    const pix = await response.json();
    currentPixId = pix.id;

    preencherModalPix(pix, valorEmReais, label);

    if (pix.id) {
      iniciarPolling(pix.id);
    }

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
  document.getElementById('pix-qr').innerHTML       =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:0.82rem">⏳ Gerando QR Code...</div>';

  const btnCopy = document.querySelector('.btn-copy');
  if (btnCopy) { btnCopy.disabled = true; btnCopy.textContent = '...'; }

  document.getElementById('pixModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/* ── Preenche o modal com dados reais do PIX ── */
function preencherModalPix(pix, valorEmReais, label) {
  document.getElementById('pix-amount').textContent = formatBRL(valorEmReais);
  document.getElementById('pix-desc').textContent   =
    `Você está doando ${label}. Obrigado por salvar vidas! 🐾`;

  document.getElementById('pix-key').textContent = pix.pix_copy_paste || '';

  if (pix.qr_code_image) {
    // A API pode retornar base64 puro ou uma URL completa
    const src = pix.qr_code_image.startsWith('http')
      ? pix.qr_code_image
      : `data:image/png;base64,${pix.qr_code_image}`;

    document.getElementById('pix-qr').innerHTML =
      `<img src="${src}"
            style="width:200px;height:200px;border-radius:8px;"
            alt="QR Code PIX"/>`;
  } else {
    document.getElementById('pix-qr').innerHTML =
      '<span style="font-size:0.78rem;color:#aaa">QR Code indisponível<br/>Use o Copia e Cola</span>';
  }

  const btnCopy = document.querySelector('.btn-copy');
  if (btnCopy) { btnCopy.disabled = false; btnCopy.textContent = 'Copiar'; }

  if (pix.expires_at) {
    const expira = new Date(pix.expires_at);
    const hora   = expira.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const desc   = document.getElementById('pix-desc');
    desc.textContent += ` (expira às ${hora})`;
  }
}

/* ── Exibe erro no modal ── */
function mostrarErroModal(msg) {
  document.getElementById('pix-desc').textContent =
    '❌ Erro ao gerar PIX. Tente novamente ou entre em contato.';
  document.getElementById('pix-qr').innerHTML =
    `<span style="font-size:0.78rem;color:#c44e0d">${msg}</span>`;

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
    btn.textContent     = '✓ Copiado!';
    btn.style.background = '#1A7A6E';
    setTimeout(() => {
      btn.textContent     = orig;
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
   POLLING — verifica se o PIX foi pago automaticamente
   Consulta /.netlify/functions/status-pix a cada 5s
   ══════════════════════════════════════════════════════ */
function iniciarPolling(pixId) {
  pararPolling();

  let tentativas = 0;
  const MAX_TENTATIVAS = 120; // 120 × 5s = 10 minutos

  pollingInterval = setInterval(async () => {
    tentativas++;

    try {
      const response = await fetch(`/.netlify/functions/status-pix?id=${pixId}`);
      if (!response.ok) return;

      const data = await response.json();

      if (data.status === 'paid') {
        pararPolling();
        exibirPagamentoConfirmado(data);
      }

      if (data.status === 'expired' || data.status === 'cancelled') {
        pararPolling();
        document.getElementById('pix-desc').textContent =
          '⏰ Este PIX expirou. Feche e gere um novo.';
      }

    } catch (_) {
      // silencia erros de rede durante polling
    }

    if (tentativas >= MAX_TENTATIVAS) pararPolling();

  }, 5000);
}

function pararPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/* ── Tela de sucesso quando PIX é confirmado ── */
function exibirPagamentoConfirmado(data) {
  const modal = document.getElementById('pixModal');

  modal.querySelector('.pix-box').innerHTML = `
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
   ══════════════════════════════════════════════════════ */
const donors = [
  { name: 'Ana C.',      city: 'São Paulo',      amount: 'R$ 50',  avatar: 'https://i.pravatar.cc/80?img=1'  },
  { name: 'Rafael M.',   city: 'Belo Horizonte', amount: 'R$ 100', avatar: 'https://i.pravatar.cc/80?img=3'  },
  { name: 'Juliana S.',  city: 'Curitiba',       amount: 'R$ 25',  avatar: 'https://i.pravatar.cc/80?img=5'  },
  { name: 'Marcos L.',   city: 'Porto Alegre',   amount: 'R$ 150', avatar: 'https://i.pravatar.cc/80?img=7'  },
  { name: 'Fernanda T.', city: 'Brasília',       amount: 'R$ 75',  avatar: 'https://i.pravatar.cc/80?img=9'  },
  { name: 'Carlos R.',   city: 'Fortaleza',      amount: 'R$ 200', avatar: 'https://i.pravatar.cc/80?img=11' },
  { name: 'Patrícia N.', city: 'Salvador',       amount: 'R$ 50',  avatar: 'https://i.pravatar.cc/80?img=13' },
  { name: 'Thiago B.',   city: 'Recife',         amount: 'R$ 500', avatar: 'https://i.pravatar.cc/80?img=15' },
  { name: 'Letícia G.',  city: 'Manaus',         amount: 'R$ 30',  avatar: 'https://i.pravatar.cc/80?img=17' },
  { name: 'Diego F.',    city: 'Florianópolis',  amount: 'R$ 100', avatar: 'https://i.pravatar.cc/80?img=19' },
];
const timeLabels = ['agora mesmo', 'há 1 min', 'há 2 min', 'há 3 min', 'há 5 min'];

function showToast(donor) {
  const container = document.getElementById('toast-container');
  const time = timeLabels[Math.floor(Math.random() * timeLabels.length)];

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <img class="toast-avatar" src="${donor.avatar}" alt="${donor.name}"
         onerror="this.style.background='#E8651A'"/>
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

  setTimeout(() => showToast(shuffled[i++ % shuffled.length]), 2500);

  setInterval(() => {
    const delay = 6000 + Math.random() * 8000;
    setTimeout(() => showToast(shuffled[i++ % shuffled.length]), delay);
  }, 9000);
}
