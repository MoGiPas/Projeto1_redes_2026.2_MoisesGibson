const net = require('net');
const dgram = require('dgram');

const PORT_TCP = 4000;
const PORT_UDP = 5000;

// --- 1. MICROTESTE TCP ---
const tcpServer = net.createServer((socket) => {
  socket.on('data', (data) => {
    // TCP garante entrega e ecoa de volta ordenadamente
    socket.write(data);
  });
});

tcpServer.listen(PORT_TCP, () => {
  console.log(`[TCP] Servidor de teste a correr na porta ${PORT_TCP}`);
  
  const client = net.createConnection({ port: PORT_TCP }, () => {
    const inicio = performance.now();
    client.write('Teste_Pacote_TCP_1');
    
    client.on('data', (data) => {
      const fim = performance.now();
      console.log(`[TCP] Resposta recebida: "${data.toString()}" | Latência: ${(fim - inicio).toFixed(2)} ms (Com garantia de entrega e ordenação)`);
      client.end();
      tcpServer.close();
    });
  });
});

// --- 2. MICROTESTE UDP ---
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  // UDP apenas reencaminha (sem controlo de estado de conexão)
  udpServer.send(msg, rinfo.port, rinfo.address, (err) => {
    if (err) console.error(err);
  });
});

udpServer.bind(PORT_UDP, () => {
  console.log(`[UDP] Servidor de teste a correr na porta ${PORT_UDP}`);
  
  const udpClient = dgram.createSocket('udp4');
  const mensagem = Buffer.from('Teste_Pacote_UDP_1');
  const inicioUdp = performance.now();

  udpClient.send(mensagem, PORT_UDP, 'localhost', (err) => {
    if (err) console.error(err);
  });

  udpClient.on('message', (msg) => {
    const fimUdp = performance.now();
    console.log(`[UDP] Resposta recebida: "${msg.toString()}" | Latência: ${(fimUdp - inicioUdp).toFixed(2)} ms (Sem garantia/best-effort)`);
    udpClient.close();
    udpServer.close();
  });
});