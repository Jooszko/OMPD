const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

export async function compressImage(
  file: Blob,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageProcessingError('Nie udało się odczytać zdjęcia. Spróbuj zrobić je ponownie.');
  }
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new ImageProcessingError('Przeglądarka nie obsługuje przetwarzania obrazów.');
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new ImageProcessingError('Nie udało się przetworzyć zdjęcia.'))),
        'image/jpeg',
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}