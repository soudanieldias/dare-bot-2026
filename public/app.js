const statusContainer = document.getElementById('status-container');
const wsStatus = document.getElementById('ws-status');
const updatedAt = document.getElementById('updated-at');
const serverPort = document.getElementById('server-port');

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
  const queueText =
    guild.queue.length > 0
      ? `<ol>${guild.queue
          .slice(0, 10)
          .map((item) => `<li>${item.name} (${item.type})</li>`)
          .join('')}</ol>`
      : '<p>Fila vazia</p>';
  const more = guild.queue.length > 10 ? `<p>... e mais ${guild.queue.length - 10} itens</p>` : '';

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
        ${more}
      </div>
    </section>`;
}

function updateStatus(message) {
  const payload = typeof message === 'string' ? JSON.parse(message) : message;
  if (!payload || payload.type !== 'status') return;

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

connect();
