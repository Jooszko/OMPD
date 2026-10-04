import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchDeliveryProofImage } from '../../../services/api';

interface LoadedImage {
  proofId: number;
  url: string | null;
  failed: boolean;
}

export function ProofImage({ proofId, alt, className = '' }: { proofId: number; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    fetchDeliveryProofImage(proofId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ proofId, url: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ proofId, url: null, failed: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proofId]);

  const current = loaded?.proofId === proofId ? loaded : null;

  if (current?.failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-bakery-rowBg text-gray-400 text-[10px] font-semibold ${className}`}
      >
        <ImageOff className="w-4 h-4" />
        Brak podglądu
      </div>
    );
  }

  if (!current?.url) {
    return <div className={`bg-bakery-rowBg animate-pulse ${className}`} role="img" aria-label={`Wczytywanie: ${alt}`} />;
  }

  return <img src={current.url} alt={alt} className={className} />;
}