/** Export the same rendered design the buyer reviewed, including its crop. */
export async function stickerCanvas(element) {
  if (!element) throw new Error('The preview is not ready yet.');
  await document.fonts?.ready;
  await Promise.all([...element.querySelectorAll('img')].map((img) => img.decode().catch(() => { throw new Error('A preview image could not load. Reupload your photo before downloading.'); })));
  const { toCanvas } = await import('html-to-image');
  return toCanvas(element, { pixelRatio: Math.max(2, 1200 / element.clientWidth), preferredFontFormat: 'woff2', style: { position: 'relative', insetInline: 'auto', insetBlock: 'auto', inset: 'auto', left: '0', top: '0' } });
}

export async function downloadSticker(element, name, suffix = 'proof') {
  const canvas = await stickerCanvas(element);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The preview could not be exported.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${String(name || 'my-gecko').replace(/[^a-z0-9-]/gi, '-').slice(0, 40)}-${suffix}.png`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
