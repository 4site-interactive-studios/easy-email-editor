import { IBlockData, JsonToMjml } from 'easy-email-core';

/**
 * Renders a single block (e.g., a Container/Wrapper) to MJML → HTML,
 * then captures as a JPEG thumbnail. Used by the component library.
 */
export async function generateBlockThumbnail(
  blockData: IBlockData,
  pageContext: IBlockData,
): Promise<string> {
  const mjmlLib = (await import('mjml-browser')).default;
  const html2canvas = (await import('html2canvas')).default;

  // Wrap the block in a minimal page structure so MJML can compile it
  const blockMjml = JsonToMjml({
    idx: null as any,
    data: blockData,
    context: pageContext,
    mode: 'production',
  });

  // Build a minimal page wrapper with the page's head attributes
  const pageMjml = JsonToMjml({
    data: pageContext,
    context: pageContext,
    mode: 'production',
  });
  const headMatch = pageMjml.match(/<mj-head>[\s\S]*?<\/mj-head>/i);
  const head = headMatch ? headMatch[0] : '';

  const fullMjml = `<mjml>${head}<mj-body>${blockMjml}</mj-body></mjml>`;
  const { html } = mjmlLib(fullMjml, { validationLevel: 'skip' });

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '600px';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      useCORS: true,
      scale: 0.5,
      width: 600,
      windowWidth: 600,
    });
    return canvas.toDataURL('image/jpeg', 0.6);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

/**
 * Renders an email block tree to MJML → HTML, then captures the result
 * as a JPEG data-URL thumbnail using html2canvas.
 *
 * Returns a compact data URL suitable for localStorage persistence.
 */
export async function generateThumbnail(content: IBlockData): Promise<string> {
  const mjml = (await import('mjml-browser')).default;
  const html2canvas = (await import('html2canvas')).default;

  const mjmlStr = JsonToMjml({
    data: content,
    mode: 'production',
    context: content,
  });
  const { html } = mjml(mjmlStr, { validationLevel: 'skip' });

  // Render off-screen at standard email width
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '600px';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      useCORS: true,
      scale: 0.5, // 300px wide output — small enough for localStorage
      width: 600,
      windowWidth: 600,
    });
    return canvas.toDataURL('image/jpeg', 0.6);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}
