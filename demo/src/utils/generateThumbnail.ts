import { IBlockData, JsonToMjml } from 'easy-email-core';

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
