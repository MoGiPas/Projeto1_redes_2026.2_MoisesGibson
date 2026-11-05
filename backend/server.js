const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('Erro ao abrir o SQLite:', err.message);
  else console.log('[LOG] Conectado ao banco de dados SQLite.');
});

db.run(`CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clienteId TEXT,
  payload TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.get('/historico', (req, res) => {
  db.all(`SELECT * FROM mensagens ORDER BY id DESC LIMIT 50`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ erro: err.message });
      return;
    }
    res.json(rows);
  });
});

wss.on('connection', (ws) => {
  console.log('[LOG] Novo cliente conectado via WebSocket.');

  ws.on('message', (message) => {
    try {
      const dados = JSON.parse(message);
      const { clienteId, payload } = dados;
      
      const textoMensagem = typeof payload === 'object' && payload.texto ? payload.texto : String(payload);
      
      // Validação: ignora mensagens vazias ou > 100 caracteres
      if (!textoMensagem || textoMensagem.trim() === '' || textoMensagem.length > 100) {
        return; 
      }

      const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;

      db.run(`INSERT INTO mensagens (clienteId, payload) VALUES (?, ?)`, [clienteId, payloadStr], function(err) {
        if (err) {
          console.error('Erro ao inserir mensagem:', err.message);
          return;
        }

        const novaMensagem = {
          id: this.lastID,
          clienteId,
          payload: payloadStr,
          timestamp: new Date().toISOString()
        };

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(novaMensagem));
          }
        });
      });
    } catch (e) {
      console.error('[ERRO] Mensagem inválida recebida:', message);
    }
  });

  ws.on('close', () => {
    console.log('[LOG] Cliente desconectado.');
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`[LOG] Servidor rodando na porta ${PORT}`);
});