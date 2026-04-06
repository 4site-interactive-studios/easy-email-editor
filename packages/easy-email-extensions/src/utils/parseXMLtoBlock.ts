import mjml from 'mjml-browser';
import { IBlockData, BasicType, BlockManager } from 'easy-email-core';
import { IPage } from 'easy-email-core';
import { MjmlToJson, RAW_ILLEGAL_ATTRS } from './MjmlToJson';

const domParser = new DOMParser();

/**
 * Parse an MJML string into block data.
 *
 * For full <mjml> documents: uses mjml-browser's parser + MjmlToJson
 * with defaults merged (block.create). Used for internal round-trips.
 *
 * For partial MJML (single elements): uses DOMParser + transformElement.
 * Used by the Block MJML sidebar editor.
 */
export function parseXMLtoBlock(text: string): IPage {
  const dom = domParser.parseFromString(text, 'text/xml');
  const root = dom.firstChild as Element;

  if (!(dom.firstChild instanceof Element)) {
    throw new Error('Invalid content');
  }

  if (root.tagName === 'mjml') {
    const { json } = mjml(text, { validationLevel: 'soft' });
    return MjmlToJson(json);
  }

  return transformElement(root) as IPage;
}

/**
 * Parse MJML without merging editor defaults.
 * Uses mjml-browser's parser with skipDefaults=true so block.create()
 * is NOT called — preserving source attributes.
 *
 * Used by "Import MJML" and Code→Visual when user edited the MJML.
 */
export function parseXMLtoBlockFidelity(text: string): IPage {
  const { json } = mjml(text, { validationLevel: 'soft' });
  return MjmlToJson(json, true);
}

/**
 * Transform a single MJML element (partial, not full document) into block data.
 */
function transformElement(el: Element): IBlockData {
  const tagName = el.tagName.toLowerCase();
  const type = tagName.replace('mj-', '');

  const block = BlockManager.getBlockByType(type as any);
  if (!block) {
    throw new Error(`${type} block not found`);
  }

  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attributes[attr.name] = attr.value;
  }

  if (block.type === BasicType.RAW) {
    for (const key of Object.keys(attributes)) {
      if (RAW_ILLEGAL_ATTRS.has(key)) delete attributes[key];
    }
  }

  const blockData: IBlockData<any> = {
    type: block.type,
    attributes,
    data: { value: {} },
    children: [],
  };

  if (block.type === BasicType.TEXT || block.type === BasicType.BUTTON) {
    blockData.data.value.content = el.innerHTML;
  } else if (block.type === BasicType.RAW) {
    blockData.data.value.content = el.innerHTML;
  } else if (block.type === BasicType.ACCORDION_TITLE || block.type === BasicType.ACCORDION_TEXT) {
    blockData.data.value.content = el.innerHTML;
  } else {
    blockData.children = Array.from(el.children)
      .filter(child => child instanceof Element)
      .map(child => transformElement(child as Element));
  }

  return blockData;
}
