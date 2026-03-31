export interface UserPresence {
  userId: string;
  name: string;
  animal: string;
  color: string;
  emoji: string;
}

const ANIMALS: { name: string; emoji: string }[] = [
  { name: 'Fox', emoji: '🦊' },
  { name: 'Owl', emoji: '🦉' },
  { name: 'Bear', emoji: '🐻' },
  { name: 'Rabbit', emoji: '🐰' },
  { name: 'Deer', emoji: '🦌' },
  { name: 'Wolf', emoji: '🐺' },
  { name: 'Hawk', emoji: '🦅' },
  { name: 'Dolphin', emoji: '🐬' },
  { name: 'Panda', emoji: '🐼' },
  { name: 'Koala', emoji: '🐨' },
  { name: 'Tiger', emoji: '🐯' },
  { name: 'Penguin', emoji: '🐧' },
  { name: 'Cat', emoji: '🐱' },
  { name: 'Dog', emoji: '🐶' },
  { name: 'Horse', emoji: '🐴' },
  { name: 'Butterfly', emoji: '🦋' },
];

const COLORS: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Rose', hex: '#E11D48' },
];

export { ANIMALS, COLORS };

const STORAGE_KEY = 'collab_user_identity';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getUserIdentity(): UserPresence {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.userId && parsed.animal && parsed.color) {
        // Backfill emoji if missing
        const animalEntry = ANIMALS.find(a => a.name === parsed.animal);
        return {
          ...parsed,
          emoji: parsed.emoji || animalEntry?.emoji || '🐾',
        };
      }
    }
  } catch {}

  // Generate new identity
  const animal = randomPick(ANIMALS);
  const color = randomPick(COLORS);
  const identity: UserPresence = {
    userId: generateId(),
    name: `${color.name} ${animal.name}`,
    animal: animal.name,
    color: color.hex,
    emoji: animal.emoji,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function updateUserIdentity(animal: string, colorHex: string): UserPresence {
  const current = getUserIdentity();
  const animalEntry = ANIMALS.find(a => a.name === animal) || ANIMALS[0];
  const colorEntry = COLORS.find(c => c.hex === colorHex) || COLORS[0];
  const updated: UserPresence = {
    ...current,
    animal: animalEntry.name,
    color: colorEntry.hex,
    emoji: animalEntry.emoji,
    name: `${colorEntry.name} ${animalEntry.name}`,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
