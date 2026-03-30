import { IArticle } from '@demo/services/article';

const STORAGE_KEY = 'saved_templates';

function readAll(): IArticle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(articles: IArticle[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

export const localStorageTemplates = {
  getAll(): IArticle[] {
    return readAll();
  },

  getById(id: number): IArticle | null {
    return readAll().find(a => a.article_id === id) ?? null;
  },

  save(article: IArticle): IArticle {
    const all = readAll();
    const idx = all.findIndex(a => a.article_id === article.article_id);
    if (idx >= 0) {
      all[idx] = article;
    } else {
      all.push(article);
    }
    writeAll(all);
    return article;
  },

  remove(id: number): void {
    writeAll(readAll().filter(a => a.article_id !== id));
  },

  generateId(): number {
    return Date.now();
  },
};
