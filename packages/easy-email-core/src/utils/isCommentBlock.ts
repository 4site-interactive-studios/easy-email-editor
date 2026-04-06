import { IBlockData } from '@core/typings';
import { BasicType } from '@core/constants';

/**
 * Check if a block is a comment-only <mj-raw> block.
 * These are HTML comments between MJML sections that get wrapped
 * in <mj-raw> internally for MJML compilation.
 */
export function isCommentBlock(block: IBlockData | null | undefined): boolean {
  if (!block || block.type !== BasicType.RAW) return false;
  const content = block.data?.value?.content?.trim() || '';
  return /^<!--[\s\S]*-->$/.test(content);
}

/**
 * Extract the text content from a comment-only block.
 * Returns the text between <!-- and -->, trimmed.
 */
export function getCommentText(block: IBlockData | null | undefined): string {
  if (!block) return '';
  const content = block.data?.value?.content?.trim() || '';
  const match = content.match(/^<!--\s*([\s\S]*?)\s*-->$/);
  return match?.[1]?.trim() || '';
}

/**
 * Given a parent block and a child index, return the comment text from
 * the immediately preceding sibling if it's a comment-only raw block.
 */
export function getPrecedingComment(parent: IBlockData | null | undefined, childIndex: number): string {
  if (!parent || childIndex <= 0) return '';
  const prevSibling = parent.children?.[childIndex - 1];
  if (isCommentBlock(prevSibling)) {
    return getCommentText(prevSibling);
  }
  return '';
}
