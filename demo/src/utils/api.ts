import { IArticle } from '@demo/services/article';

export interface Revision {
  id: number;
  article_id: number;
  timestamp: number;
  label: string;
  content: string;
  subject: string;
  note: string;
}

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ── Templates ──

  async getAll(): Promise<IArticle[]> {
    return request<IArticle[]>('/templates');
  },

  async getById(id: number): Promise<IArticle | null> {
    try {
      return await request<IArticle>(`/templates/${id}`);
    } catch {
      return null;
    }
  },

  async save(article: IArticle): Promise<IArticle> {
    // Try update first, create if not found
    const existing = await this.getById(article.article_id);
    if (existing) {
      return request<IArticle>(`/templates/${article.article_id}`, {
        method: 'PUT',
        body: JSON.stringify(article),
      });
    }
    return request<IArticle>('/templates', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  },

  async remove(id: number): Promise<void> {
    await request(`/templates/${id}`, { method: 'DELETE' });
  },

  generateId(): number {
    return Date.now();
  },

  // ── Revisions ──

  async getRevisions(articleId: number): Promise<Revision[]> {
    return request<Revision[]>(`/templates/${articleId}/revisions`);
  },

  async addRevision(articleId: number, rev: Omit<Revision, 'id' | 'article_id'>): Promise<Revision> {
    return request<Revision>(`/templates/${articleId}/revisions`, {
      method: 'POST',
      body: JSON.stringify(rev),
    });
  },

  async updateRevisionNote(revisionId: number, note: string): Promise<void> {
    await request(`/revisions/${revisionId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    });
  },

  async clearRevisions(articleId: number): Promise<void> {
    await request(`/templates/${articleId}/revisions`, { method: 'DELETE' });
  },
};
