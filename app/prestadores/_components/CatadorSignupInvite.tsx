import Image from "next/image";
import Link from "next/link";

export default function CatadorSignupInvite() {
  return (
    <Link
      href="/register"
      aria-labelledby="catador-invite-action"
      aria-describedby="catador-invite-description"
      className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-[#74444f] bg-[#25151b] bg-[radial-gradient(ellipse_at_100%_0%,#542633,transparent_75%)] p-3.5 transition hover:border-[#c27184] hover:bg-[#311a23] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-300 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-4"
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
        <Image
          src="/logofinal.svg"
          alt=""
          width={44}
          height={44}
          className="size-10 shrink-0 rounded-[10px] object-cover ring-1 ring-white/15 sm:size-11"
        />
        <div>
          <h2 className="text-lg leading-tight font-bold tracking-tight text-rose-50 sm:text-xl">
            Conviértete en Catador
          </h2>
          <p id="catador-invite-description" className="mt-1 text-sm leading-5 text-[#f1ccd4]">
            Desbloquea contenido privado dentro de BelaClub.
          </p>
        </div>
      </div>
      <span
        id="catador-invite-action"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#ffe0e7] px-3.5 text-sm font-semibold whitespace-nowrap text-[#3b1823] transition group-hover:bg-white sm:self-center"
      >
        Crear cuenta <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
