import { useState } from 'react';
import { Camera, Signature, Trash2 } from 'lucide-react';
import type { DeliveryProof } from '../../../services/api';
import { formatTime } from '../lib/dateFormat';
import { Modal } from './Modal';
import { ProofImage } from './ProofImage';

const PROOF_LABELS: Record<DeliveryProof['kind'], string> = {
  photo: 'Zdjęcie dostawy',
  signature: 'Podpis odbiorcy',
};

export function ProofThumbnail({
  proof,
  stopName,
  onOpen,
}: {
  proof: DeliveryProof;
  stopName: string;
  onOpen: (proof: DeliveryProof) => void;
}) {
  const isPhoto = proof.kind === 'photo';
  return (
    <button
      type="button"
      onClick={() => onOpen(proof)}
      aria-label={`Powiększ: ${PROOF_LABELS[proof.kind].toLowerCase()}`}
      className="shrink-0 rounded-lg overflow-hidden border border-bakery-btnBorder bg-white"
    >
      <ProofImage
        proofId={proof.proof_id}
        alt={`${PROOF_LABELS[proof.kind]}: ${stopName}`}
        className={isPhoto ? 'w-14 h-14 object-cover' : 'w-24 h-14 object-contain'}
      />
    </button>
  );
}

export function ProofPreviewDialog({
  proof,
  stopName,
  canDelete,
  onDelete,
  onClose,
}: {
  proof: DeliveryProof;
  stopName: string;
  canDelete: boolean;
  onDelete: (proof: DeliveryProof) => Promise<boolean>;
  onClose: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const Icon = proof.kind === 'photo' ? Camera : Signature;

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    const ok = await onDelete(proof);
    if (!ok) setDeleting(false);
  };

  return (
    <Modal
      title={PROOF_LABELS[proof.kind]}
      subtitle={[stopName, proof.signer_name, formatTime(proof.created_at)].filter(Boolean).join(' · ')}
      icon={<Icon className="w-5 h-5 text-bakery-accent" />}
      closeDisabled={deleting}
      onClose={onClose}
    >
      <ProofImage
        proofId={proof.proof_id}
        alt={`${PROOF_LABELS[proof.kind]}: ${stopName}`}
        className="w-full min-h-40 max-h-[60vh] object-contain rounded-lg bg-white border border-bakery-btnBorder"
      />
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="self-start inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-3 py-1.5 text-xs font-bold bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? 'Usuwanie...' : confirmingDelete ? 'Kliknij ponownie, aby usunąć' : 'Usuń'}
        </button>
      )}
    </Modal>
  );
}