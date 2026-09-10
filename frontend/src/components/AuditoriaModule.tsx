import React, { useState } from 'react';
import { AuditLog } from '../types/wms';
import { ShieldAlert, Search, Terminal, Code, Clock, UserCheck } from 'lucide-react';

interface AuditoriaModuleProps {
  logs: AuditLog[];
}

export const AuditoriaModule: React.FC<AuditoriaModuleProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(logs[0] || null);

  const filteredLogs = logs.filter(l => 
    l.operador.toLowerCase().includes(search.toLowerCase()) ||
    l.acao.toLowerCase().includes(search.toLowerCase()) ||
    l.postgrest_rpc.toLowerCase().includes(search.toLowerCase()) ||
    l.detalhes_json.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-blue-600" />
            Auditoria & Movimentos Particionados (Segurança PostgREST / RLS)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registo de audit-trail imutável das tabelas <code className="text-blue-600 font-mono font-bold">logistics.movimento</code> e <code className="text-blue-600 font-mono font-bold">logistics.auditoria</code>.
          </p>
        </div>
      </div>

      {/* Grid: Audit Logs Table + JSON Payload Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              Logs de Transação RPC
            </h3>
            
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar por RPC ou Operador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredLogs.map(log => {
              const isSelected = selectedLog?.id === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3.5 rounded-xl border cursor-pointer font-mono text-xs transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-blue-600">{log.acao}</span>
                    <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-900 font-sans font-bold text-xs">{log.operador}</p>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">RPC: {log.postgrest_rpc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* JSON Payload Inspector (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3">
            <Code className="w-4 h-4 text-blue-600" />
            Inspetor de Payload JSON / Metadados
          </h3>

          {selectedLog ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <p><span className="text-slate-500">ID Registo:</span> <strong className="text-slate-800">{selectedLog.id}</strong></p>
                <p><span className="text-slate-500">Tabela Afetada:</span> <strong className="text-blue-600">{selectedLog.tabela_afetada}</strong></p>
                <p><span className="text-slate-500">Tenant (RLS):</span> <strong className="text-slate-800">{selectedLog.empresa_tenant}</strong></p>
                <p><span className="text-slate-500">Terminal IP:</span> <strong className="text-slate-700">{selectedLog.ip_terminal}</strong></p>
              </div>

              <div>
                <span className="text-slate-700 block mb-1 font-bold">Conteúdo da Transação (PostgreSQL JSONB):</span>
                <pre className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-amber-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(selectedLog.detalhes_json), null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Selecione um log para inspecionar os detalhes JSON.</p>
          )}
        </div>
      </div>
    </div>
  );
};
