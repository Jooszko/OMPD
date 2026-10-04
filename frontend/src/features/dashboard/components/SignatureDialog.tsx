import { type FormEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Signature } from 'lucide-react';
import { Modal } from './Modal';

const CANVAS_HEIGHT = 200;
const MAX_SIGNER_NAME_LENGTH = 100;

export function SignatureDialog({
  subtitle,
  onSubmit,
  onClose,
}: {
  subtitle: string;
  onSubmit: (image: Blob, signerName: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * ratio;
    canvas.height = CANVAS_HEIGHT * ratio;
    context.scale(ratio, ratio);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, CANVAS_HEIGHT);
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1f1f1f';
  }, []);

  useEffect(() => {
    prepareCanvas();
  }, [prepareCanvas]);

  const pointFrom = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const context = e.currentTarget.getContext('2d');
    if (!context || submitting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFrom(e);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y);
    context.stroke();
    setHasDrawn(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = e.currentTarget.getContext('2d');
    if (!context) return;
    const { x, y } = pointFrom(e);
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const handleClear = () => {
    prepareCanvas();
    setHasDrawn(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn || submitting) return;
    setSubmitting(true);
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    const ok = image ? await onSubmit(image, signerName.trim()) : false;
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      title="Podpis odbiorcy"
      subtitle={subtitle}
      icon={<Signature className="w-5 h-5 text-bakery-accent" />}
      closeDisabled={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="m-0 text-xs text-gray-500 font-medium">Poproś odbiorcę o podpis palcem w ramce poniżej.</p>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Pole podpisu"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          className="w-full rounded-lg border-2 border-dashed border-bakery-btnBorder bg-white touch-none cursor-crosshair"
          style={{ height: CANVAS_HEIGHT }}
        />
        <div>
          <label htmlFor="signer-name" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
            Imię i nazwisko odbiorcy (opcjonalnie)
          </label>
          <input
            id="signer-name"
            type="text"
            autoComplete="off"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            maxLength={MAX_SIGNER_NAME_LENGTH}
            className="w-full border border-bakery-btnBorder bg-bakery-rowBg rounded-lg text-sm p-2 outline-none focus:border-bakery-accent"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasDrawn || submitting}
            className="sm:mr-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eraser className="w-3.5 h-3.5" /> Wyczyść
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={!hasDrawn || submitting}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Zapisywanie...' : 'Zapisz podpis'}
          </button>
        </div>
      </form>
    </Modal>
  );
}