export interface Revision {
  id: number;         // Sequential integer (1, 2, 3, ...)
  timestamp: number;  // Unix seconds (for display)
  label: string;      // "Auto-saved" | "Manual save" | "Restored from revision"
  content: string;    // JSON.stringify(IBlockData)
  subject: string;    // Email title at time of save
  note: string;       // User-added contextual note
}

const MAX_REVISIONS = 50;
const getKey = (articleId: number) => `revisions_${articleId}`;

function readAll(articleId: number): Revision[] {
  try {
    const raw = localStorage.getItem(getKey(articleId));
    const revisions: Revision[] = raw ? JSON.parse(raw) : [];
    // Migrate old Date.now() IDs to sequential integers
    const needsMigration = revisions.some(r => r.id > 1000000);
    if (needsMigration) {
      revisions.sort((a, b) => a.id - b.id); // oldest first by original ID
      revisions.forEach((r, i) => { r.id = i + 1; });
      revisions.forEach(r => { r.note = r.note ?? ''; });
      writeAll(articleId, revisions);
      return revisions;
    }
    return revisions.map(r => ({ ...r, note: r.note ?? '' }));
  } catch {
    return [];
  }
}

function writeAll(articleId: number, revisions: Revision[]): void {
  try {
    localStorage.setItem(getKey(articleId), JSON.stringify(revisions));
  } catch {
    // localStorage quota exceeded — silently drop oldest revisions and retry
    if (revisions.length > 5) {
      writeAll(articleId, revisions.slice(0, Math.floor(revisions.length / 2)));
    }
  }
}

export const revisionStore = {
  getAll(articleId: number): Revision[] {
    return readAll(articleId).sort((a, b) => b.id - a.id);
  },

  add(articleId: number, rev: Omit<Revision, 'id' | 'note'> & { note?: string }): Revision {
    const all = readAll(articleId);
    // Derive next ID from highest existing ID
    const maxId = all.reduce((max, r) => Math.max(max, r.id), 0);
    const newRev: Revision = { ...rev, note: rev.note || '', id: maxId + 1 };
    all.push(newRev);
    all.sort((a, b) => b.id - a.id);
    writeAll(articleId, all.slice(0, MAX_REVISIONS));
    return newRev;
  },

  updateNote(articleId: number, revisionId: number, note: string): void {
    const all = readAll(articleId);
    const rev = all.find(r => r.id === revisionId);
    if (rev) {
      rev.note = note;
      writeAll(articleId, all);
    }
  },

  clear(articleId: number): void {
    localStorage.removeItem(getKey(articleId));
  },
};
