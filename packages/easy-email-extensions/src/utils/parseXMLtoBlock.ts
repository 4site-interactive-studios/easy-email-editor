import mjml from 'mjml-browser';
import { IBlockData, BasicType, BlockManager } from 'easy-email-core';
import { IPage } from 'easy-email-core';
import { MjmlToJson } from './MjmlToJson';

// Attributes illegal on <mj-raw>
const RAW_ILLEGAL_ATTRS = new Set([
  'padding', 'border', 'direction', 'text-align',
  'background-repeat', 'background-size', 'background-position',
  'vertical-align', 'align', 'background-color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
]);

const domParser = new DOMParser();

/**
 * Preprocess MJML string to make it XML-safe.
 * MJML is XHTML-like but often contains HTML entities and patterns
 * that aren't valid in strict XML mode.
 */
function preprocessMjml(text: string): string {
  let result = text;

  // Add XML entity declarations for common HTML entities
  // We wrap the content in an XML document with entity declarations
  // so that &rsquo;, &trade;, &nbsp;, etc. are recognized
  const hasXmlDecl = result.trimStart().startsWith('<?xml');

  if (!hasXmlDecl) {
    // Common HTML entities that aren't defined in XML
    const entityDecl = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mjml [
  <!ENTITY nbsp "&#160;">
  <!ENTITY rsquo "&#8217;">
  <!ENTITY lsquo "&#8216;">
  <!ENTITY rdquo "&#8221;">
  <!ENTITY ldquo "&#8220;">
  <!ENTITY mdash "&#8212;">
  <!ENTITY ndash "&#8211;">
  <!ENTITY trade "&#8482;">
  <!ENTITY TRADE "&#8482;">
  <!ENTITY reg "&#174;">
  <!ENTITY copy "&#169;">
  <!ENTITY amp "&#38;">
  <!ENTITY lt "&#60;">
  <!ENTITY gt "&#62;">
  <!ENTITY hellip "&#8230;">
  <!ENTITY bull "&#8226;">
  <!ENTITY middot "&#183;">
  <!ENTITY laquo "&#171;">
  <!ENTITY raquo "&#187;">
  <!ENTITY deg "&#176;">
  <!ENTITY times "&#215;">
  <!ENTITY divide "&#247;">
  <!ENTITY minus "&#8722;">
  <!ENTITY plusmn "&#177;">
  <!ENTITY frac12 "&#189;">
  <!ENTITY frac14 "&#188;">
  <!ENTITY frac34 "&#190;">
  <!ENTITY hearts "&#9829;">
  <!ENTITY star "&#9733;">
  <!ENTITY check "&#10003;">
  <!ENTITY rarr "&#8594;">
  <!ENTITY larr "&#8592;">
  <!ENTITY darr "&#8595;">
  <!ENTITY uarr "&#8593;">
]>\n`;
    result = entityDecl + result;
  }

  return result;
}

/**
 * Parse an MJML string into block data using the browser's DOMParser.
 *
 * This replaces the old approach that delegated to mjml-browser's parser,
 * which transformed the AST and lost information (comments became mj-raw,
 * mj-title/mj-preview were dropped, attributes were reordered, etc.).
 *
 * The DOM-based approach preserves:
 * - HTML comments (kept inline, not converted to mj-raw blocks)
 * - All head elements (mj-title, mj-preview, mj-breakpoint, etc.)
 * - Exact attribute names and values
 * - Element ordering
 */
export function parseXMLtoBlock(text: string): IPage {
  const dom = domParser.parseFromString(text, 'text/xml');
  const root = dom.firstChild as Element;

  if (!(dom.firstChild instanceof Element)) {
    throw new Error('Invalid content');
  }

  // For full <mjml> documents, use mjml-browser's parser which handles
  // entities, comments in mj-attributes, and all edge cases correctly.
  // This ensures Code→Visual round-trips preserve styling.
  if (root.tagName === 'mjml') {
    const { json } = mjml(text, { validationLevel: 'soft' });
    return MjmlToJson(json);
  }

  // For partial MJML (single element), use the DOM-based parser
  return transformElement(root) as IPage;
}

/**
 * Parse MJML with the DOM-based parser for maximum source fidelity.
 * Used by the "Import MJML" flow on the home page where preserving
 * the user's exact attributes matters more than merging editor defaults.
 */
export function parseXMLtoBlockFidelity(text: string): IPage {
  // First try XML parsing with entity preprocessing
  const preprocessed = preprocessMjml(text);
  let dom = domParser.parseFromString(preprocessed, 'text/xml');
  let root = dom.documentElement;

  // If XML parsing fails, try parsing as HTML
  if (!root || root.querySelector('parsererror')) {
    dom = domParser.parseFromString(text, 'text/html');
    root = dom.querySelector('mjml') as Element;
    if (!root) {
      throw new Error('Invalid MJML: could not parse document');
    }
  }

  if (root.tagName === 'mjml' || root.tagName.toLowerCase() === 'mjml') {
    return parseMjmlDocument(root);
  }

  return transformElement(root) as IPage;
}

/**
 * Parse a complete <mjml> document into Page block data.
 */
function parseMjmlDocument(root: Element): IPage {
  const head = root.querySelector(':scope > mj-head');
  const body = root.querySelector(':scope > mj-body');

  if (!body) {
    throw new Error('Invalid MJML: no <mj-body> found');
  }

  // ── Extract head elements ──

  // mj-title
  const titleEl = head?.querySelector(':scope > mj-title');
  const title = titleEl ? (titleEl.textContent || '') : '';

  // mj-preview
  const previewEl = head?.querySelector(':scope > mj-preview');
  const preview = previewEl ? (previewEl.textContent || '') : '';

  // mj-breakpoint
  const breakpointEl = head?.querySelector(':scope > mj-breakpoint');
  const breakpoint = breakpointEl?.getAttribute('width') || '';

  // mj-font
  const fonts = Array.from(head?.querySelectorAll(':scope > mj-font') || []).map(el => ({
    name: el.getAttribute('name') || '',
    href: el.getAttribute('href') || '',
  }));

  // mj-style (may have multiple)
  const headStyles = Array.from(head?.querySelectorAll(':scope > mj-style') || []).map(el => ({
    content: el.textContent || '',
    inline: el.getAttribute('inline') as 'inline' | undefined,
  }));

  // mj-attributes → serialize ALL children as headAttributes string
  const mjAttributesEl = head?.querySelector(':scope > mj-attributes');
  const headAttributes = mjAttributesEl
    ? serializeMjAttributes(mjAttributesEl)
    : '';

  // mj-raw inside head (meta tags, MSO conditionals, etc.)
  const headRawEls = Array.from(head?.querySelectorAll(':scope > mj-raw') || []);
  const rawContent = headRawEls.map(el => el.innerHTML.trim()).filter(Boolean).join('\n');

  // Build extraHeadContent (mj-title + mj-preview + raw content)
  let extraHeadContent = '';
  if (title || titleEl) extraHeadContent += `<mj-title>${title}</mj-title>\n`;
  if (preview || previewEl) extraHeadContent += `<mj-preview>${preview}</mj-preview>\n`;
  if (rawContent) extraHeadContent += rawContent;
  extraHeadContent = extraHeadContent.trim();

  // ── Extract root <mjml> attributes (e.g., lang="en") ──
  const mjmlAttrs = Array.from(root.attributes)
    .map(a => `${a.name}="${a.value}"`)
    .join(' ');

  // ── Extract body attributes ──
  const bodyAttributes: Record<string, string> = {};
  for (const attr of Array.from(body.attributes)) {
    bodyAttributes[attr.name] = attr.value;
  }

  // ── Parse body children into blocks ──
  const children = parseChildNodes(body);

  // ── Build Page data ──
  const pageData: IPage = {
    type: BasicType.PAGE,
    attributes: bodyAttributes,
    children,
    data: {
      value: {
        headAttributes,
        headStyles,
        fonts,
        breakpoint,
        responsive: true,
        extraHeadContent: extraHeadContent || undefined,
        mjmlAttributes: mjmlAttrs || undefined,
      },
    },
  };

  return pageData;
}

/**
 * Serialize all children of <mj-attributes> into a string,
 * preserving exact attribute names, values, and ordering.
 * Skips HTML comments and text nodes.
 */
function serializeMjAttributes(el: Element): string {
  const parts: string[] = [];

  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    const attrs = Array.from(child.attributes)
      .map(a => `${a.name}="${a.value}"`)
      .join(' ');
    parts.push(`<${tag} ${attrs} />`);
  }

  return parts.join('\n');
}

/**
 * Parse child nodes of a body/section/column element into block data.
 * Handles Element nodes and preserves HTML comments as inline content
 * within mj-raw blocks (grouped with adjacent comments rather than
 * creating separate blocks for each one).
 */
function parseChildNodes(parent: Element): IBlockData[] {
  const blocks: IBlockData[] = [];

  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const block = transformElement(el);
      if (block) blocks.push(block);
    } else if (node.nodeType === Node.COMMENT_NODE) {
      // HTML comments between body-level elements — wrap in mj-raw
      const comment = (node as Comment).textContent || '';
      if (comment.trim()) {
        blocks.push({
          type: BasicType.RAW,
          attributes: {},
          data: { value: { content: `<!--${comment}-->` } },
          children: [],
        });
      }
    }
    // Skip text nodes (whitespace between elements)
  }

  return blocks;
}

/**
 * Transform a single MJML element into block data.
 * Only stores the attributes that were actually set in the source —
 * no editor defaults are merged.
 */
function transformElement(el: Element): IBlockData {
  const tagName = el.tagName.toLowerCase();
  const type = tagName.replace('mj-', '');

  const block = BlockManager.getBlockByType(type as any);
  if (!block) {
    throw new Error(`${type} block not found`);
  }

  // Extract attributes — only what the source MJML provided
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attributes[attr.name] = attr.value;
  }

  // Strip illegal attributes from mj-raw
  if (block.type === BasicType.RAW) {
    for (const key of Object.keys(attributes)) {
      if (RAW_ILLEGAL_ATTRS.has(key)) {
        delete attributes[key];
      }
    }
  }

  const blockData: IBlockData<any> = {
    type: block.type,
    attributes,
    data: { value: {} },
    children: [],
  };

  // ── Handle content and children based on block type ──

  if (block.type === BasicType.TEXT || block.type === BasicType.BUTTON) {
    // Text and Button: innerHTML is the content
    blockData.data.value.content = el.innerHTML;
    // No children — content is inline HTML
  } else if (block.type === BasicType.RAW) {
    // Raw: innerHTML is the content (HTML, comments, conditionals)
    blockData.data.value.content = el.innerHTML;
  } else if (block.type === BasicType.CAROUSEL) {
    // Carousel: children are mj-carousel-image → data.value.images
    blockData.data.value.images = Array.from(el.querySelectorAll(':scope > mj-carousel-image')).map(img => {
      const imgAttrs: Record<string, string> = {};
      for (const attr of Array.from(img.attributes)) {
        imgAttrs[attr.name] = attr.value;
      }
      return imgAttrs;
    });
  } else if (block.type === BasicType.NAVBAR) {
    // Navbar: children are mj-navbar-link → data.value.links
    blockData.data.value.links = Array.from(el.querySelectorAll(':scope > mj-navbar-link')).map(link => {
      const linkData: Record<string, string> = {};
      for (const attr of Array.from(link.attributes)) {
        linkData[attr.name] = attr.value;
      }
      linkData.content = link.textContent || '';
      return linkData;
    });
  } else if (block.type === BasicType.SOCIAL) {
    // Social: children are mj-social-element → data.value.elements
    blockData.data.value.elements = Array.from(el.querySelectorAll(':scope > mj-social-element')).map(elem => {
      const elemData: Record<string, string> = {};
      for (const attr of Array.from(elem.attributes)) {
        elemData[attr.name] = attr.value;
      }
      elemData.content = elem.textContent || '';
      return elemData;
    });
  } else if (block.type === BasicType.ACCORDION) {
    // Accordion: has mj-accordion-element children
    blockData.children = parseChildNodes(el);
  } else if (block.type === BasicType.ACCORDION_ELEMENT) {
    // AccordionElement: has mj-accordion-title and mj-accordion-text children
    blockData.children = parseChildNodes(el);
  } else if (block.type === BasicType.ACCORDION_TITLE || block.type === BasicType.ACCORDION_TEXT) {
    // These contain inline HTML content
    blockData.data.value.content = el.innerHTML;
  } else {
    // All other blocks (Section, Column, Wrapper, Group, Hero, etc.):
    // recurse into children
    blockData.children = parseChildNodes(el);
  }

  return blockData;
}
