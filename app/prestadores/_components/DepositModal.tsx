import { depositAmounts, formatMoney } from "./utils";

type DepositModalProps = {
  selectedAmount: number | null;
  depositMessage: string;
  depositLoading: boolean;
  onSelectAmount: (amount: number) => void;
  onDeposit: () => void;
  onClose: () => void;
};

export default function DepositModal({
  selectedAmount,
  depositMessage,
  depositLoading,
  onSelectAmount,
  onDeposit,
  onClose,
}: DepositModalProps) {
  const isSuccess = depositMessage
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .includes("exito");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-3 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-2xl shadow-black/50 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Abonar al servicio</h3>
        <p className="mt-2 text-sm text-neutral-400">
          Selecciona un monto para continuar.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
          {depositAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onSelectAmount(amount)}
              className={`rounded-md border px-3 py-3 text-sm font-semibold transition ${
                selectedAmount === amount
                  ? "border-blue-400 bg-blue-500/15 text-white"
                  : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]"
              }`}
            >
              {formatMoney(amount)}
            </button>
          ))}
        </div>

        {depositMessage && (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              isSuccess
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/30 bg-rose-500/10 text-rose-100"
            }`}
          >
            {depositMessage}
          </div>
        )}

        <button
          type="button"
          disabled={!selectedAmount || depositLoading}
          onClick={onDeposit}
          className="mt-5 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {depositLoading ? "Procesando..." : "Confirmar abono"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.07]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
