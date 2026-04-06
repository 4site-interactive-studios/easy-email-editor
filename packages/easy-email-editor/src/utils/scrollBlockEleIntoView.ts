import { getBlockNodeByIdx } from './getBlockNodeByIdx';

export function scrollBlockEleIntoView({ idx }: { idx: string }) {
  setTimeout(() => {
    const editBlock = getBlockNodeByIdx(idx);
    editBlock?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
  }, 50);
}
