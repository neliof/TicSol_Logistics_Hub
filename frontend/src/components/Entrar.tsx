import React, { useState } from 'react';
import { Warehouse, LogIn, AlertTriangle } from 'lucide-react';
import { api, Utilizador } from '../api';

interface EntrarProps {
  aoEntrar: (utilizador: Utilizador) => void;
}

export const Entrar: React.FC<EntrarProps> = ({ aoEntrar }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aEntrar, setAEntrar] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEntrar(true);
    try {
      aoEntrar(await api.entrar(email, password));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha na autenticação.');
    } finally {
      setAEntrar(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 font-sans">
      <form
        onSubmit={submeter}
        className="w-full max-w-sm bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-5"
      >
        <div className="text-center space-y-1">
          <Warehouse className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">TicSol Logistics Hub</h1>
          <p className="text-xs text-slate-500">Entre com as suas credenciais.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            Endereço de email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
            Palavra-passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {erro && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span>{erro}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={aEntrar}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          {aEntrar ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};
