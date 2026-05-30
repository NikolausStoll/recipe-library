export async function rotateImageFile90(file: File): Promise<File> {
  const image = await loadImage(URL.createObjectURL(file))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalHeight
    canvas.height = image.naturalWidth
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable')
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    const type = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
    const blob = await canvasToBlob(canvas, type, 0.92)
    return new File([blob], file.name, { type: blob.type || type, lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(image.src)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for rotation'))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode rotated image'))
        return
      }
      resolve(blob)
    }, type, quality)
  })
}
