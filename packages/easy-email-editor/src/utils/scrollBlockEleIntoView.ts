import { getBlockNodeByIdx } from './getBlockNodeByIdx';

export function scrollBlockEleIntoView({ idx }: { idx: string }) {
  setTimeout(() => {
    const editBlock = getBlockNodeByIdx(idx);
    if (!editBlock) return;

    const rect = editBlock.getBoundingClientRect();
    // Only scroll if the bottom of the element is below the viewport
    // (i.e., the element is partially or fully out of view at the bottom)
    if (rect.bottom > window.innerHeight || rect.top < 0) {
      editBlock.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    }
  }, 50);
}
