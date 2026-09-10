// Adapter para conectar componentes WMS ao servidor Node.js da API

const API_BASE = 'http://localhost:3000';

export interface WMSOrder {
  id: string;
  numero: string;
  data: string;
  cliente: string;
  linhas: any[];
}

export interface WMSPallet {
  id: string;
  sscc: string;
  artigo_codigo: string;
  artigo_descricao: string;
  caixas: number;
  created_at: string;
}

export class WMSApiAdapter {
  static async getOrders(): Promise<WMSOrder[]> {
    try {
      const res = await fetch(`${API_BASE}/rest/v1/guia_recepcao`);
      if (res.ok) return res.json();
      return [];
    } catch (e) {
      console.error('Erro ao buscar guias:', e);
      return [];
    }
  }

  static async getPallets(): Promise<WMSPallet[]> {
    try {
      const res = await fetch(`${API_BASE}/rest/v1/palete_sscc`);
      if (res.ok) return res.json();
      return [];
    } catch (e) {
      console.error('Erro ao buscar paletes:', e);
      return [];
    }
  }

  static async createPallet(data: any): Promise<WMSPallet | null> {
    try {
      const res = await fetch(`${API_BASE}/rest/v1/palete_sscc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) return res.json();
      return null;
    } catch (e) {
      console.error('Erro ao criar palete:', e);
      return null;
    }
  }

  static async updateOrder(id: string, data: any): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/rest/v1/guia_recepcao?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok;
    } catch (e) {
      console.error('Erro ao atualizar guia:', e);
      return false;
    }
  }

  static async getStockData(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/rest/v1/posicao_stock`);
      if (res.ok) return res.json();
      return [];
    } catch (e) {
      console.error('Erro ao buscar stock:', e);
      return [];
    }
  }
}
