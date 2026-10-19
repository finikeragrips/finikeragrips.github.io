// Client-side image preparation: decode, downscale to ≤2000px and re-encode as JPEG.
// Keeps uploads under the server limit and strips EXIF/GPS metadata from customer photos.
export async function compressImage(file, maxBytes) {
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) throw new Error(`"${file.name}" no es una imagen`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`No pudimos leer "${file.name}". Usa JPG o PNG.`));
      i.src = url;
    });
    let max = 2000, quality = 0.86, blob;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) return blob;
      max = Math.round(max * 0.8); quality = Math.max(0.6, quality - 0.06);
    }
    throw new Error(`"${file.name}" es demasiado grande`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
