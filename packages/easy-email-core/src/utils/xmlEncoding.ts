/**
 * Encode a string for safe use in an XML/MJML attribute value.
 * Escapes &, <, >, and " to their entity equivalents.
 */
export function encodeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Encode a string for safe use in XML/MJML text content.
 * Escapes & and < to their entity equivalents.
 */
export function encodeXmlContent(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}
