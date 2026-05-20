type ReportModalProps = {
  providerName: string;
  reason: string;
  balance: number | null;
  eligibilityLoading: boolean;
  message: string;
  reporting: boolean;
  canSubmit: boolean;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function ReportModal({
  providerName,
  reason,
  balance,
  eligibilityLoading,
  message,
  reporting,
  canSubmit,
  onReasonChange,
  onSubmit,
  onClose,
}: ReportModalProps) {
  const hasEnoughBalance = Number(balance || 0) >= 500000;
  const isSuccess = message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .includes("enviado");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-3 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#101012] p-5 text-white shadow-2xl shadow-black/50 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-300">Reporte</p>
            <h3 className="mt-1 text-xl font-semibold">
              Revisar perfil de {providerName}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg text-neutral-300 hover:bg-white/[0.07] hover:text-white"
          >
            x
          </button>
        </div>

        <div className="mt-5 rounded-md border border-white/[0.08] bg-black/20 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Requisito para reportar
          </p>
          {eligibilityLoading ? (
            <p className="mt-2 text-sm text-neutral-300">
              Verificando tu saldo...
            </p>
          ) : hasEnoughBalance ? (
            <p className="mt-2 text-sm text-emerald-200">
              Cumples el requisito. Saldo actual: $
              {Number(balance || 0).toLocaleString("es-CO")}.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-rose-200">
              Para reportar un perfil debes estar registrado y tener al menos
              $500.000 de saldo en BelaClub. Tu saldo actual es $
              {Number(balance || 0).toLocaleString("es-CO")}.
            </p>
          )}
        </div>

        <label
          htmlFor="reportReason"
          className="mt-5 block text-sm font-medium text-neutral-300"
        >
          Motivo del reporte
        </label>
        <textarea
          id="reportReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          disabled={!hasEnoughBalance || eligibilityLoading || reporting}
          maxLength={500}
          rows={4}
          placeholder="Describe brevemente qué debemos revisar..."
          className="mt-2 w-full resize-none rounded-md border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-1 text-right text-xs text-neutral-500">
          {reason.length}/500
        </p>

        {message && (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              isSuccess
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/30 bg-rose-500/10 text-rose-100"
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit || reporting}
          onClick={onSubmit}
          className="mt-5 w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {reporting ? "Enviando reporte..." : "Enviar reporte"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.07] hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
