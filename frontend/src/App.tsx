import React, { useState, useEffect, useRef } from 'react';

interface PayloadData {
  texto: string;
  pingId?: string;
  tipoTeste?: string;
}

interface MensagemItem {
  id?: number;
  clienteId: string;
  payload: string | PayloadData;
  timestamp?: string;
}

interface ResultadosRTT {
  amostras: number[];
  media: number;
  mediana: number;
  desvioPadrao: number;
}

interface ResultadoThroughput {
  tamanhoPayload: number; // em bytes/caracteres
  totalMensagens: number;
  tempoTotalSegundos: number;
  throughputBytesPorSec: number;
}

function App() {
  const [clienteId] = useState<string>(`Cliente_${Math.floor(Math.random() * 1000)}`);
  const [mensagemInput, setMensagemInput] = useState<string>('');
  const [erroValidacao, setErroValidacao] = useState<string>('');
  const [historico, setHistorico] = useState<MensagemItem[]>([]);
  const [wsStatus, setWsStatus] = useState<string>('Desconectado');
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Estados para o Experimento A (RTT)
  const [executandoRtt, setExecutandoRtt] = useState<boolean>(false);
  const [progressoRtt, setProgressoRtt] = useState<number>(0);
  const [resultadosRtt, setResultadosRtt] = useState<ResultadosRTT | null>(null);

  // Estados para o Experimento B (Throughput)
  const [executandoTp, setExecutandoTp] = useState<boolean>(false);
  const [statusTp, setStatusTp] = useState<string>('');
  const [resultadosTp, setResultadosTp] = useState<ResultadoThroughput[]>([]);

  // Referências para controlo assíncrono dos testes
  const pingsPendentes = useRef(new Map());
  const amostrasRttRef = useRef<number[]>([]);
  const resolveTesteRef = useRef<(() => void) | null>(null);
  const tpPendentesRef = useRef<number>(0);
  const resolveTpRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001/historico')
      .then(res => res.json())
      .then((data: MensagemItem[]) => setHistorico(data))
      .catch(err => console.error("Erro HTTP:", err));

    const socket = new WebSocket('ws://localhost:3001');
    setWs(socket);

    socket.onopen = () => setWsStatus('Conectado');
    socket.onclose = () => setWsStatus('Desconectado');
    
    socket.onmessage = (event: MessageEvent) => {
      const novaMsg: MensagemItem = JSON.parse(event.data);
      
      try {
        const parsed = typeof novaMsg.payload === 'string' ? JSON.parse(novaMsg.payload) : novaMsg.payload;
        
        // Tratamento RTT
        if (parsed && parsed.pingId && pingsPendentes.current.has(parsed.pingId)) {
          const tempoEnvio = pingsPendentes.current.get(parsed.pingId);
          const rtt = performance.now() - tempoEnvio;
          pingsPendentes.current.delete(parsed.pingId);

          amostrasRttRef.current.push(rtt);

          if (resolveTesteRef.current && amostrasRttRef.current.length === 30) {
            resolveTesteRef.current();
          }
        }

        // Tratamento Throughput
        if (parsed && parsed.tipoTeste === 'THROUGHPUT_ECHO') {
          if (tpPendentesRef.current > 0) {
            tpPendentesRef.current -= 1;
            if (tpPendentesRef.current === 0 && resolveTpRef.current) {
              resolveTpRef.current();
            }
          }
        }
      } catch (e) {
        // Ignora erros de parse
      }

      setHistorico(prev => [novaMsg, ...prev]);
    };

    return () => socket.close();
  }, []);

  const enviarMensagem = (e: React.FormEvent) => {
    e.preventDefault();
    setErroValidacao('');

    const textoLimpo = mensagemInput.trim();
    if (!textoLimpo) {
      setErroValidacao('⚠️ Erro: Não é permitido enviar mensagens vazias.');
      return;
    }
    if (mensagemInput.length > 100) {
      setErroValidacao('⚠️ Erro: A mensagem excede o limite de 100 caracteres.');
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const mensagemEstruturada = {
      clienteId: clienteId,
      payload: { texto: mensagemInput }
    };

    ws.send(JSON.stringify(mensagemEstruturada));
    setMensagemInput('');
  };

  // Experimento A: RTT (30 amostras)
  const executarExperimentoRtt = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || executandoRtt) return;

    setExecutandoRtt(true);
    setProgressoRtt(0);
    setResultadosRtt(null);
    amostrasRttRef.current = [];
    pingsPendentes.current.clear();

    for (let i = 1; i <= 30; i++) {
      const pingId = `ping_${Date.now()}_${i}`;
      const tempoInicio = performance.now();
      pingsPendentes.current.set(pingId, tempoInicio);

      const payloadTeste = {
        texto: `RTT_${i}`,
        pingId: pingId
      };

      ws.send(JSON.stringify({
        clienteId: `${clienteId}_Tester`,
        payload: payloadTeste
      }));

      setProgressoRtt(i);
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    await new Promise<void>(resolve => {
      resolveTesteRef.current = resolve;
      setTimeout(resolve, 3000);
    });

    const amostras = amostrasRttRef.current;
    if (amostras.length > 0) {
      const soma = amostras.reduce((a, b) => a + b, 0);
      const media = soma / amostras.length;

      const ordenadas = [...amostras].sort((a, b) => a - b);
      const mediana = ordenadas.length % 2 === 0
        ? (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2
        : ordenadas[Math.floor(ordenadas.length / 2)];

      const variancia = amostras.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / amostras.length;
      const desvioPadrao = Math.sqrt(variancia);

      setResultadosRtt({
        amostras,
        media: Number(media.toFixed(2)),
        mediana: Number(mediana.toFixed(2)),
        desvioPadrao: Number(desvioPadrao.toFixed(2))
      });
    }

    setExecutandoRtt(false);
  };

  // Experimento B: Throughput (Lotes de tamanhos diferentes)
  const executarExperimentoThroughput = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || executandoTp) return;

    setExecutandoTp(true);
    setResultadosTp([]);
    const tamanhos = [20, 50, 100]; // Tamanhos em caracteres/bytes
    const numMensagens = 30; // 30 mensagens por tamanho
    const novosResultados: ResultadoThroughput[] = [];

    for (const tamanho of tamanhos) {
      setStatusTp(`A testar pacotes de ${tamanho} bytes...`);
      tpPendentesRef.current = numMensagens;
      
      const textoBase = 'A'.repeat(tamanho);
      const tempoInicio = performance.now();

      for (let i = 0; i < numMensagens; i++) {
        const payloadTp = {
          texto: textoBase,
          tipoTeste: 'THROUGHPUT_ECHO'
        };

        ws.send(JSON.stringify({
          clienteId: `${clienteId}_TP`,
          payload: payloadTp
        }));

        await new Promise(resolve => setTimeout(resolve, 10)); // Envio cadenciado
      }

      // Aguardar confirmação de todas as mensagens do lote ou timeout de 4s
      await new Promise<void>(resolve => {
        resolveTpRef.current = resolve;
        const checkInterval = setInterval(() => {
          if (tpPendentesRef.current <= 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 10);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 4000);
      });

      const tempoFim = performance.now();
      const tempoTotalSegundos = (tempoFim - tempoInicio) / 1000;
      const totalBytes = tamanho * numMensagens;
      const throughputBytesPorSec = tempoTotalSegundos > 0 ? totalBytes / tempoTotalSegundos : 0;

      novosResultados.push({
        tamanhoPayload: tamanho,
        totalMensagens: numMensagens,
        tempoTotalSegundos: Number(tempoTotalSegundos.toFixed(3)),
        throughputBytesPorSec: Number(throughputBytesPorSec.toFixed(2))
      });
    }

    setResultadosTp(novosResultados);
    setStatusTp('');
    setExecutandoTp(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
        
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-sky-400">Painel de Monitoramento & Redes</h1>
            <p className="text-sm text-slate-400">Identidade: <span className="font-mono text-slate-200">{clienteId}</span></p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${wsStatus === 'Conectado' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-sm font-medium">{wsStatus}</span>
          </div>
        </div>

        {/* LABORATÓRIO EXPERIMENTAL */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mb-6 space-y-4">
          <h2 className="text-md font-semibold text-sky-300">Laboratório Experimental (Relatório)</h2>
          
          {/* EXPERIMENTO A: RTT */}
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-200">Experimento A (RTT - 30 Amostras)</span>
              <button
                onClick={executarExperimentoRtt}
                disabled={executandoRtt || wsStatus !== 'Conectado'}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {executandoRtt ? `A medir (${progressoRtt}/30)...` : 'Executar RTT'}
              </button>
            </div>

            {resultadosRtt && (
              <div className="p-2.5 bg-slate-800 border border-emerald-500/40 rounded-lg text-xs space-y-1">
                <p className="font-bold text-emerald-400">📊 Resultados RTT:</p>
                <p>• Média: <span className="font-mono text-sky-300">{resultadosRtt.media} ms</span> | Mediana: <span className="font-mono text-sky-300">{resultadosRtt.mediana} ms</span> | Desvio Padrão: <span className="font-mono text-sky-300">{resultadosRtt.desvioPadrao} ms</span></p>
              </div>
            )}
          </div>

          {/* EXPERIMENTO B: THROUGHPUT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-200">Experimento B (Throughput por Tamanho)[cite: 2]</span>
              <button
                onClick={executarExperimentoThroughput}
                disabled={executandoTp || wsStatus !== 'Conectado'}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {executandoTp ? statusTp : 'Executar Throughput'}
              </button>
            </div>

            {resultadosTp.length > 0 && (
              <div className="p-2.5 bg-slate-800 border border-sky-500/40 rounded-lg text-xs space-y-2">
                <p className="font-bold text-sky-400">📈 Resultados Throughput:</p>
                <div className="space-y-1">
                  {resultadosTp.map((res, idx) => (
                    <div key={idx} className="flex justify-between border-b border-slate-700/50 pb-1">
                      <span>Payload: <b>{res.tamanhoPayload} bytes</b> ({res.totalMensagens} msgs)</span>
                      <span className="font-mono text-sky-300 font-semibold">{res.throughputBytesPorSec} bytes/s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FORMULÁRIO DE MENSAGENS */}
        <form onSubmit={enviarMensagem} className="flex flex-col gap-2 mb-6">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={mensagemInput} 
              onChange={e => {
                setMensagemInput(e.target.value);
                if (erroValidacao) setErroValidacao('');
              }} 
              placeholder="Digite sua mensagem (máx. 100 caracteres)..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-sky-500 text-slate-100 placeholder-slate-500 text-sm"
            />
            <button 
              type="submit" 
              className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Enviar
            </button>
          </div>

          {erroValidacao && (
            <div className="bg-rose-950/60 border border-rose-500 text-rose-200 text-xs px-3 py-2 rounded-lg font-medium">
              {erroValidacao}
            </div>
          )}

          <div className="flex justify-between text-xs px-1">
            <span className={mensagemInput.length > 100 ? "text-rose-400 font-semibold" : "text-slate-400"}>
              Caracteres: {mensagemInput.length}/100
            </span>
          </div>
        </form>

        <h2 className="text-lg font-semibold mb-3 text-slate-300">Histórico de Mensagens</h2>
        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
          {historico.length === 0 ? (
            <p className="text-slate-500 text-center py-6">Nenhuma mensagem registrada ainda.</p>
          ) : (
            historico.map((item, index) => {
              let conteudoTexto = "";
              try {
                const parsedPayload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
                conteudoTexto = parsedPayload?.texto || JSON.stringify(item.payload);
              } catch {
                conteudoTexto = String(item.payload);
              }

              return (
                <div key={index} className="bg-slate-900/60 border border-slate-700/60 p-3 rounded-lg">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span className="font-semibold text-sky-400">{item.clienteId || 'Servidor'}</span>
                    <span>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Agora'}</span>
                  </div>
                  <p className="text-slate-200 text-sm break-words">{conteudoTexto}</p>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

export default App;