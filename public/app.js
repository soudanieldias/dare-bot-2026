const statusContainer = document.getElementById('status-container');
const wsStatus = document.getElementById('ws-status');
const updatedAt = document.getElementById('updated-at');
const serverPort = document.getElementById('server-port');

const queuePageSize = 10;
const queuePages = new Map();
let currentPayload = null;

function getQueuePage(guildId, queueLength) {
  const current = queuePages.get(guildId) || 1;
  const total = Math.max(1, Math.ceil(queueLength / queuePageSize));
  const page = Math.min(Math.max(current, 1), total);
  queuePages.set(guildId, page);
  return { page, total };
}

function renderGuild(guild) {
  const connected = guild.isConnected ? '✅ Conectado' : '❌ Desconectado';
  const channelText = guild.channelName
    ? `${guild.channelName} (${guild.channelId})`
    : guild.channelId
      ? guild.channelId
      : 'Nenhum canal de voz';
  const currentText = guild.currentTrack
    ? `<strong>Tocando agora:</strong> ${guild.currentTrack.name} (${guild.currentTrack.type})`
    : '<em>Não há nada tocando</em>';

  const { page, total } = getQueuePage(guild.guildId, guild.queue.length);
  const startIndex = (page - 1) * queuePageSize;
  const pageItems = guild.queue.slice(startIndex, startIndex + queuePageSize);
  const queueText =
    guild.queue.length > 0
      ? `<ul>${pageItems
          .map((item, index) => `<li>${startIndex + index + 1}. ${item.name} (${item.type})</li>`)
          .join('')}</ul>`
      : '<p>Fila vazia</p>';
  const summary =
    guild.queue.length > 0
      ? `<p class="queue-summary">Mostrando ${startIndex + 1}-${Math.min(startIndex + queuePageSize, guild.queue.length)} de ${guild.queue.length}</p>`
      : '';

  return `
    <section>
      <h2>${guild.guildName}</h2>
      <p><strong>Status:</strong> ${connected}</p>
      <p><strong>Canal de voz:</strong> ${channelText}</p>
      <p><strong>Volume:</strong> ${guild.volume}%</p>
      <p>${currentText}</p>
      <div>
        <strong>Fila:</strong>
        ${queueText}
        ${summary}
        <div class="queue-controls">
          <button data-guild-id="${guild.guildId}" data-action="prev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
          <span>Página ${page} de ${total}</span>
          <button data-guild-id="${guild.guildId}" data-action="next" ${page >= total ? 'disabled' : ''}>Próxima</button>
        </div>
      </div>
    </section>`;
}

function updateStatus(message) {
  const payload = typeof message === 'string' ? JSON.parse(message) : message;
  if (!payload || payload.type !== 'status') return;

  currentPayload = payload;
  serverPort.textContent = payload.server?.port ?? window.location.port;

  const list = payload.status;
  if (!list.length) {
    statusContainer.innerHTML = '<p>Nenhuma guilda encontrada.</p>';
  } else {
    statusContainer.innerHTML = list.map(renderGuild).join('');
  }

  updatedAt.textContent = 'Atualizado em ' + new Date(payload.updatedAt).toLocaleString('pt-BR');
}

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  wsStatus.textContent = 'Conectando...';

  socket.addEventListener('open', () => {
    wsStatus.textContent = 'Conectado';
    wsStatus.style.background = '#50fa7b';
  });

  socket.addEventListener('message', (event) => {
    updateStatus(event.data);
  });

  socket.addEventListener('close', () => {
    wsStatus.textContent = 'Desconectado';
    wsStatus.style.background = '#ff6b6b';
    setTimeout(connect, 2000);
  });

  socket.addEventListener('error', () => {
    wsStatus.textContent = 'Erro';
    wsStatus.classList.add('error');
  });
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const guildId = target.dataset.guildId;
  const action = target.dataset.action;
  if (!guildId || !action) return;

  const payload = currentPayload;
  if (!payload) return;

  const guild = payload.status.find((item) => item.guildId === guildId);
  if (!guild) return;

  const { page, total } = getQueuePage(guildId, guild.queue.length);
  const nextPage = action === 'next' ? Math.min(total, page + 1) : Math.max(1, page - 1);
  queuePages.set(guildId, nextPage);
  updateStatus(JSON.stringify(payload));
});

connect();
