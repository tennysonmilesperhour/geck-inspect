/**
 * Browser-only helpers for the buyer packet: turn the gecko's first photo
 * and its passport link into image data jsPDF can embed. Both return null
 * on any failure so the packet still downloads without them.
 */

/** Load an image URL and re-encode it as a square JPEG (cropped to center). */
export function photoDataUrl(url, size = 600) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) return resolve(null);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
          0, 0, size, size,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        // A photo host without CORS headers taints the canvas; skip the photo.
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

/** Render a QR code for `value` off screen and return it as a PNG data URL. */
export async function qrDataUrl(value) {
  if (!value) return null;
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  document.body.appendChild(host);
  let root = null;
  try {
    const [{ createRoot }, { QRCodeCanvas }, React] = await Promise.all([
      import('react-dom/client'),
      import('qrcode.react'),
      import('react'),
    ]);
    root = createRoot(host);
    root.render(React.createElement(QRCodeCanvas, { value, size: 320, marginSize: 2, level: 'M' }));
    for (let i = 0; i < 20; i++) {
      const canvas = host.querySelector('canvas');
      if (canvas) return canvas.toDataURL('image/png');
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  } catch {
    return null;
  } finally {
    if (root) root.unmount();
    host.remove();
  }
}

/** Download a jsPDF document as a file (same pattern as the certificates). */
export function downloadPdf(doc, filename) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
