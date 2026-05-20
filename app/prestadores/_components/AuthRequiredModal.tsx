type AuthRequiredModalProps = {
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
};

export default function AuthRequiredModal({
  onClose,
  onLogin,
  onRegister,
}: AuthRequiredModalProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-3 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#101012] p-5 text-white shadow-2xl shadow-black/50 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold">
          Debes iniciar sesión o registrarte
        </h3>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Para abonar a un servicio o desbloquear contenido necesitas una cuenta
          activa.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onLogin}
            className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold transition hover:bg-blue-500"
          >
            Iniciar sesión
          </button>

          <button
            type="button"
            onClick={onRegister}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold transition hover:bg-white/[0.07]"
          >
            Crear cuenta
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-neutral-500 transition hover:text-neutral-300"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
