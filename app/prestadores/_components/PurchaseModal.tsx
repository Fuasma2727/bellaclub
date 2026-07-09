import { PendingPurchase } from "./types";
import { formatMoney } from "./utils";

type PurchaseModalProps = {
  pendingPurchase: PendingPurchase;
  purchaseError: string;
  purchaseLoading: boolean;
  onClose: () => void;
  onPurchase: () => void;
};

export default function PurchaseModal({
  pendingPurchase,
  purchaseError,
  purchaseLoading,
  onClose,
  onPurchase,
}: PurchaseModalProps) {
  const privateDescription = pendingPurchase.item.description?.trim();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-3 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-2xl shadow-black/50 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Desbloquear contenido</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Este contenido privado cuesta{" "}
          <span className="font-semibold text-white">
            {formatMoney(pendingPurchase.item.price)}
          </span>
          .
        </p>

        {privateDescription && (
          <div className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Descripcion
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-200">
              {privateDescription}
            </p>
          </div>
        )}

        {purchaseError && (
          <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {purchaseError}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={purchaseLoading}
            onClick={onPurchase}
            className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {purchaseLoading ? "Procesando..." : "Desbloquear"}
          </button>
        </div>
      </div>
    </div>
  );
}
