import React, { useEffect, useState } from 'react';
import { AppTab } from '../types/wms';
import { api } from '../api';
import {
  Truck,
  Boxes,
  Layers,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Scan,
  Building2,
  Database,
  Radio,
  LogOut,
  Menu,
  X
} from 'lucide-react';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  selectedTenant: string;
  setSelectedTenant: (tenant: string) => void;
  onOpenScanner: () => void;
  nomeUtilizador: string;
  aoSair: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedTenant,
  setSelectedTenant,
  onOpenScanner,
  nomeUtilizador,
  aoSair
}) => {
  const [artsoftHost, setArtsoftHost] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    api.obterArtsoftConfig()
      .then((c) => setArtsoftHost(c.host || null))
      .catch(() => setArtsoftHost(null));
  }, []);

  interface TabItem {
    id: AppTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }

  interface TabGroup {
    name: string;
    tabs: TabItem[];
  }

  const tabGroups: TabGroup[] = [
    {
      name: 'Receção',
      tabs: [
        { id: 'rececao', label: 'Receção', icon: <Building2 className="w-4 h-4" />, badge: '3 Guias' },
        { id: 'paletizacao', label: 'Paletização Receção', icon: <Boxes className="w-4 h-4" />, badge: 'SSCC GS1' }
      ]
    },
    {
      name: 'Expedição',
      tabs: [
        { id: 'expedicao', label: 'Expedição', icon: <Truck className="w-4 h-4" />, badge: 'Imefar' },
        { id: 'paletizacao_expedicao', label: 'Paletização Expedição', icon: <Layers className="w-4 h-4" />, badge: 'Auto' }
      ]
    },
    {
      name: 'Admin',
      tabs: [
        { id: 'stock_mapa', label: 'Stock & Mapa', icon: <Layers className="w-4 h-4" /> },
        { id: 'artsoft_sync', label: 'Sync ARTSOFT', icon: <RefreshCw className="w-4 h-4" />, badge: 'ERP' },
        { id: 'series_config', label: 'Configuração de Séries', icon: <Database className="w-4 h-4" /> },
        { id: 'artsoft_config', label: 'Ligação ARTSOFT', icon: <Sliders className="w-4 h-4" /> },
        { id: 'gestao_dados', label: 'Gestão de Dados', icon: <ShieldAlert className="w-4 h-4" /> },
        { id: 'regras', label: 'Motor de Regras', icon: <Sliders className="w-4 h-4" /> },
        { id: 'auditoria', label: 'Logs & Auditoria', icon: <ShieldAlert className="w-4 h-4" /> }
      ]
    }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      {/* Top Banner with System Indicators */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between py-3 gap-4 border-b border-slate-800">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm tracking-tight">
              TS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-tight">TicSol Logistics</h1>
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 font-mono text-[11px] font-bold rounded-full">
                  WMS Hub
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Consola de Controlo • Schema <code className="text-amber-400 font-semibold">logistics.*</code>
              </p>
            </div>
          </div>

          {/* Center Status Indicators */}
          <div className="hidden lg:flex items-center gap-2.5 text-xs">
            {/* Database Tag */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded text-slate-300 font-mono">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>DB: <strong className="text-slate-200">ticsol_wms</strong></span>
            </div>

            {/* PostgREST Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded text-slate-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>PostgREST: <strong className="text-emerald-400">Online</strong></span>
            </div>

            {/* ARTSOFT Endpoint Connection */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded text-slate-300 font-mono">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>ARTSOFT: <code className="text-amber-300">{artsoftHost || '—'}</code></span>
            </div>
          </div>

          {/* Right Controls: Tenant Switcher + PDA Quick Scan */}
          <div className="flex items-center gap-3">
            {/* Tenant Selection (RLS) */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 hidden sm:inline">Cliente:</span>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="bg-transparent text-amber-400 font-semibold font-mono focus:outline-none cursor-pointer text-xs"
              >
                <option value="TicSol_HuB (Sonae MC)">Sonae MC</option>
                <option value="Jerónimo Martins">Jerónimo Martins</option>
                <option value="Sovena Oilseeds">Sovena</option>
                <option value="Lactogal">Lactogal</option>
                <option value="TicSol Logistics">TicSol Geral</option>
              </select>
            </div>

            {/* Quick PDA Barcode Scanner button */}
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs shadow-sm transition-all active:scale-95"
              title="Abrir Simulador PDA / Leitor de Código de Barras"
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Scanner PDA</span>
            </button>

            {/* Sessão */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-300 hidden lg:inline">{nomeUtilizador}</span>
              <button
                onClick={aoSair}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-lg transition-all"
                title="Terminar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar with Groups */}
        <div className="flex items-center justify-between pt-2 pb-1">
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex flex-wrap items-center gap-6 flex-1">
            {tabGroups.map((group) => (
              <div key={group.name} className="flex items-center gap-1">
                {/* Group Label */}
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">
                  {group.name}
                </span>
                {/* Group Tabs */}
                <div className="flex items-center gap-1">
                  {group.tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-mono rounded font-semibold ${
                              isActive
                                ? 'bg-blue-500/30 text-blue-200'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 pt-2 pb-3">
            {tabGroups.map((group) => (
              <div key={group.name} className="mb-4">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 py-2">
                  {group.name}
                </h3>
                <div className="space-y-1">
                  {group.tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
