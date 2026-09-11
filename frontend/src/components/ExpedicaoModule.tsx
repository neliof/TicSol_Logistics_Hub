import React, { useState } from 'react';
import { GuiaTransporte, PaletaExpedicao, ComprovanteEmbarque } from '../types/expedicao';
import { api } from '../api';
import {
  Package,
  Truck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Thermometer,
  Send,
  Barcode,
  Info
} from 'lucide-react';

interface ExpedicaoModuleProps {
  guias: GuiaTransporte[];
  paletas: PaletaExpedicao[];
  comprovantes: ComprovanteEmbarque[];
  onConfirmGuia: (guiaId: string) => void;
  onCreateEmbarque: (comprovante: ComprovanteEmbarque) => void;
  onSelectGuia?: (guiaId: string) => void;
}

export const ExpedicaoModule: React.FC<ExpedicaoModuleProps> = ({
  guias,
  paletas,
  comprovantes,
  onConfirmGuia,
  onCreateEmbarque,
  onSelectGuia
}) => {
  const [selectedGuiaId, setSelectedGuiaId] = useState<string>(guias[0]?.id || '');
  const [showEmbarqueForm, setShowEmbarqueForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDataInicio, setSyncDataInicio] = useState('');
  const [syncDataFim, setSyncDataFim] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  const selectedGuia = guias.find(g => g.id === selectedGuiaId) || guias[0];

  // Carrega as linhas da guia aberta (a lista traz só cabeçalhos).
  React.useEffect(() => {
    if (selectedGuia && onSelectGuia) onSelectGuia(selectedGuia.id);
  }, [selectedGuia?.id, onSelectGuia]);
  const guiaPaletas = selectedGuia ? paletas.filter(p => p.guia_id === selectedGuia.id) : [];

  const filteredGuias = statusFilter === 'TODOS' ? guias : guias.filter(g => g.status === statusFilter);

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      await api.sincronizarGuias(syncDataInicio || undefined, syncDataFim || undefined);
      alert('Guias sincronizadas com sucesso!');
      setShowSyncModal(false);
      setSyncDataInicio('');
      setSyncDataFim('');
      // Recarregar seria ideal, mas depende de passarmos callback do App
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao sincronizar';
      if (msg.includes('429') || msg.includes('Muitas requisições')) {
        alert('Limite de sincronização atingido.\nAguarde 5 minutos entre sincronizações.\n\n' + msg);
      } else {
        alert(msg);
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleConfirmarPaletizacao = () => {
    if (!selectedGuia || guiaPaletas.length === 0) {
      alert('Seleciona guia com paletas preparadas');
      return;
    }
    onConfirmGuia(selectedGuia.id);
  };

  const handleEmbarque = () => {
    if (!selectedGuia || guiaPaletas.length === 0) {
      alert('Nenhuma palete preparada para embarque');
      return;
    }

    const comprovante: ComprovanteEmbarque = {
      id: `EMB-${Date.now()}`,
      guia_id: selectedGuia.id,
      paletes_sscc: guiaPaletas.map(p => p.sscc),
      peso_real_kg: guiaPaletas.reduce((sum, p) => sum + p.peso_total_kg, 0),
      volume_real_m3: guiaPaletas.reduce((sum, p) => sum + p.volume_total_m3, 0),
      transportador_nome: 'DHL Logistics Portugal',
      matricula_veiculo: 'XX-11-AA',
      motorista_nome: 'João Silva',
      contacto_motorista: '+351 91 234 5678',
      temperatura_veiculo_c: selectedGuia.linhas[0]?.temperatura_armazenamento === 'FRESCO' ? 4 : 22,
      hora_saida: new Date().toLocaleTimeString('pt-PT'),
      data_saida: new Date().toISOString().slice(0, 10),
      operador_embarque: 'Op. Expedição #60',
      observacoes: `Guia ${selectedGuia.nome_documento || selectedGuia.numero_guia}`,
      status: 'EMBARQUE_CONFIRMADO'
    };

    onCreateEmbarque(comprovante);
    setShowEmbarqueForm(false);
  };

  return (
    <div className="flex flex-col gap-4 h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Expedição — Imefar → Clientes</h1>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            disabled={syncLoading}
            className="px-3 py-1.5 bg-white text-blue-600 font-semibold text-sm rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-all"
          >
            {syncLoading ? 'A sincronizar…' : 'Sincronizar Documentos'}
          </button>
        </div>
        <p className="text-blue-100">Paletização + Embarque para Sonae MC, Nívea, Tesa, Tena, etc</p>
      </div>

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Column 1: Guias List */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Guias de Transporte
            </h2>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-mono font-bold">
              {filteredGuias.length}
            </span>
          </div>

          {/* Status Filter */}
          <div className="px-4 py-2 border-b border-slate-100 bg-white">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos status</option>
              <option value="RECEBIDA">Recebida</option>
              <option value="PREPARANDO">Preparando</option>
              <option value="PALETIZADA">Paletizada</option>
              <option value="PRONTA_EMBARQUE">Pronta embarque</option>
              <option value="EXPEDIDA">Expedida</option>
            </select>
          </div>

          {/* Guias Scroll */}
          <div className="flex-1 overflow-y-auto">
            {filteredGuias.map((guia) => (
              <button
                key={guia.id}
                onClick={() => setSelectedGuiaId(guia.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-blue-50 transition-all ${
                  selectedGuiaId === guia.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-slate-900">{guia.nome_documento || guia.numero_guia}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      guia.status === 'RECEBIDA'
                        ? 'bg-amber-100 text-amber-700'
                        : guia.status === 'PRONTA_EMBARQUE'
                          ? 'bg-green-100 text-green-700'
                          : guia.status === 'EXPEDIDA'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {guia.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 truncate">{guia.cliente_nome}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {guia.linhas.reduce((sum, l) => sum + l.quantidade_solicitada, 0)} unidades
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Column 2: Guia Details */}
        {selectedGuia && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4 overflow-y-auto h-full">
            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-3">Detalhes da Guia</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Guia:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedGuia.nome_documento || selectedGuia.numero_guia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cliente:</span>
                  <span className="font-bold text-slate-900">{selectedGuia.cliente_nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Entrega:</span>
                  <span className="text-slate-900">{selectedGuia.data_entrega_prevista}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">NIF:</span>
                  <span className="font-mono text-slate-900">{selectedGuia.cliente_nif}</span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-600 block mb-1">Morada:</span>
                  <span className="text-xs text-slate-900 leading-tight">
                    {selectedGuia.morada_entrega}, {selectedGuia.codigo_postal_entrega} {selectedGuia.cidade_entrega}
                  </span>
                </div>
              </div>
            </div>

            {/* Linhas da Guia */}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-semibold text-xs text-slate-900 mb-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" />
                Produtos ({selectedGuia.linhas.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedGuia.linhas.map((linha) => (
                  <div
                    key={linha.id}
                    className="bg-slate-50 p-2 rounded text-xs border border-slate-200"
                  >
                    <div className="font-mono font-bold text-slate-900">{linha.artigo_codigo}</div>
                    <div className="text-slate-600 truncate">{linha.artigo_descricao}</div>
                    <div className="flex justify-between mt-1 text-slate-500">
                      <span>{linha.quantidade_solicitada} un</span>
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        {linha.temperatura_armazenamento}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            {selectedGuia.status !== 'PRONTA_EMBARQUE' && selectedGuia.status !== 'EXPEDIDA' && (
              <button
                onClick={handleConfirmarPaletizacao}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Paletização
              </button>
            )}
          </div>
        )}

        {/* Column 3: Paletas + Embarque */}
        {selectedGuia && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4 flex flex-col h-full overflow-y-auto">
            <div>
              <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <Barcode className="w-4 h-4" />
                Paletas ({guiaPaletas.length})
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {guiaPaletas.map((palete) => (
                  <div key={palete.id} className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                    <div className="font-mono font-bold text-slate-900">{palete.sscc}</div>
                    <div className="flex justify-between mt-1 text-slate-500 text-[11px]">
                      <span>{palete.peso_total_kg}kg</span>
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        {palete.temperatura_zona}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-600">
                      {palete.produtos.length} produto(s)
                    </div>
                    <div className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      palete.status === 'ETIQUETADA'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {palete.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Embarque Form */}
            {selectedGuia.status === 'PRONTA_EMBARQUE' && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" />
                  Confirmar Embarque
                </h4>
                <button
                  onClick={handleEmbarque}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Registar Saída
                </button>
              </div>
            )}

            {/* Status expedida */}
            {selectedGuia.status === 'EXPEDIDA' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-bold text-green-900">Guia Expedida</div>
                    <div className="text-green-700 text-[11px] mt-1">
                      {comprovantes.find(c => c.guia_id === selectedGuia.id)?.transportador_nome}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Embarques */}
      {comprovantes.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Últimas Saídas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comprovantes.slice(0, 4).map((comp) => {
              const guia = guias.find(g => g.id === comp.guia_id);
              return (
                <div key={comp.id} className="bg-slate-50 p-3 rounded border border-slate-200 text-xs">
                  <div className="flex justify-between mb-2">
                    <span className="font-mono font-bold text-slate-900">{guia?.numero_guia}</span>
                    <span className="text-green-600 font-bold">{comp.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-slate-600">{guia?.cliente_nome}</div>
                  <div className="mt-1 text-slate-500">{comp.transportador_nome}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {comp.data_saida} às {comp.hora_saida}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center rounded-lg z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sincronizar Documentos do ARTSOFT</h2>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={syncDataInicio}
                  onChange={(e) => setSyncDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={syncDataFim}
                  onChange={(e) => setSyncDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-500">Deixa vazio para sincronizar todas as guias</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                disabled={syncLoading}
                className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-300 disabled:opacity-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="flex-1 px-3 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {syncLoading ? 'A sincronizar…' : 'Sincronizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
