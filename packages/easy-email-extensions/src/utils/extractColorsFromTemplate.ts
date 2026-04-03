import { IBlockData } from 'easy-email-core';

/**
 * Color attribute names to look for on blocks
 */
const COLOR_ATTRIBUTES = [
  'color',
  'background-color',
  'container-background-color',
  'border-color',
  'ico-color',
  'inner-background-color',
];

/**
 * Page-level data.value color keys
 */
const PAGE_DATA_COLOR_KEYS = [
  'text-color',
  'content-background-color',
];

/**
 * Regex to find hex colors (#rgb, #rrggbb) and rgb/rgba() values
 */
const HEX_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const RGB_REGEX = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g;

/**
 * Normalize a color string to lowercase for deduplication.
 * Expands 3-char hex to 6-char (e.g., #fff → #ffffff).
 */
function normalizeColor(c: string): string {
  const s = c.trim().toLowerCase();
  // Expand shorthand hex
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return s;
}

/**
 * Convert hex color to HSL for sorting.
 * Returns [hue (0-360), saturation (0-1), lightness (0-1)].
 */
function hexToHsl(hex: string): [number, number, number] {
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l]; // achromatic

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h * 360, s, l];
}

/**
 * Try to convert any color string to a 6-char hex string.
 * Returns null if unable to parse.
 */
function toHex(color: string): string | null {
  const s = color.trim().toLowerCase();

  // Already hex
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    const hex = (n: string) => parseInt(n).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  // Named colors — handle common ones
  const namedColors: Record<string, string> = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
    blue: '#0000ff', yellow: '#ffff00', transparent: '', inherit: '',
  };
  if (namedColors[s] !== undefined) return namedColors[s] || null;

  return null;
}

/**
 * Recursively extract all color values from a block tree.
 */
function collectColors(block: IBlockData, colors: Set<string>) {
  if (!block) return;

  // Check standard color attributes
  if (block.attributes) {
    for (const attr of COLOR_ATTRIBUTES) {
      const val = (block.attributes as any)[attr];
      if (val && typeof val === 'string') {
        const hex = toHex(val);
        if (hex) colors.add(normalizeColor(hex));
      }
    }

    // Extract colors from border shorthand (e.g., "1px solid #333333")
    const border = (block.attributes as any)['border'];
    if (border && typeof border === 'string') {
      const hexMatches = border.match(HEX_REGEX);
      if (hexMatches) hexMatches.forEach(m => {
        const hex = toHex(m);
        if (hex) colors.add(normalizeColor(hex));
      });
    }
  }

  // Check page-level data values
  if (block.data?.value) {
    for (const key of PAGE_DATA_COLOR_KEYS) {
      const val = (block.data.value as any)[key];
      if (val && typeof val === 'string') {
        const hex = toHex(val);
        if (hex) colors.add(normalizeColor(hex));
      }
    }

    // Scan HTML content for inline colors (rich text)
    const content = (block.data.value as any)?.content;
    if (content && typeof content === 'string') {
      const hexMatches = content.match(HEX_REGEX);
      if (hexMatches) hexMatches.forEach(m => {
        const hex = toHex(m);
        if (hex) colors.add(normalizeColor(hex));
      });
      const rgbMatches = content.match(RGB_REGEX);
      if (rgbMatches) rgbMatches.forEach(m => {
        const hex = toHex(m);
        if (hex) colors.add(normalizeColor(hex));
      });
    }
  }

  // Recurse children
  if (block.children) {
    for (const child of block.children) {
      collectColors(child, colors);
    }
  }
}

/**
 * Sort colors in a visually logical order:
 * Grays (low saturation) first sorted by lightness,
 * then chromatic colors sorted by hue.
 */
function sortColorsByHue(colors: string[]): string[] {
  return colors.sort((a, b) => {
    const [hA, sA, lA] = hexToHsl(a);
    const [hB, sB, lB] = hexToHsl(b);

    const isGrayA = sA < 0.1;
    const isGrayB = sB < 0.1;

    // Grays first, sorted dark to light
    if (isGrayA && isGrayB) return lA - lB;
    if (isGrayA) return -1;
    if (isGrayB) return 1;

    // Chromatic: sort by hue, then by lightness
    if (Math.abs(hA - hB) > 5) return hA - hB;
    return lA - lB;
  });
}

/**
 * Extract all unique colors from an email template block tree,
 * sorted in a visually logical order (grays first, then by hue).
 *
 * Returns empty array if no colors found.
 */
export function extractColorsFromTemplate(rootBlock: IBlockData): string[] {
  const colorSet = new Set<string>();
  collectColors(rootBlock, colorSet);

  // Remove near-transparent or empty values
  colorSet.delete('');

  return sortColorsByHue(Array.from(colorSet));
}
