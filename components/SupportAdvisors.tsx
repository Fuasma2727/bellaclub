import Link from "next/link";
import { displaySupportPhone, type SupportAdvisor } from "@/lib/supportAdvisors";

type Props = {
  advisors: SupportAdvisor[];
  collapsible?: boolean;
};

export default function SupportAdvisors({ advisors, collapsible = true }: Props) {
  const content = (
    <div className="rounded-lg border border-white/10 bg-[#101012] p-5 text-left">
      <h2 className="text-base font-semibold text-white">Asesores de BelaClub</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        Nuestros asesores te orientan en el uso de la página. Elige uno para
        escribirle por WhatsApp o llamarlo.
      </p>
      {advisors.length > 0 ? (
        <ul className={`mt-4 grid gap-3 sm:grid-cols-2${advisors.length > 6 ? " max-h-[60vh] overflow-y-auto overscroll-contain pr-2" : ""}`}>
          {advisors.map((advisor) => (
            <li key={advisor.id} className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-4">
              <p className="break-words text-sm font-semibold text-white">{advisor.name}</p>
              <a
                href={`tel:${advisor.phone}`}
                className="mt-2 inline-block rounded text-sm text-neutral-200 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
                aria-label={`Llamar a ${advisor.name}: ${displaySupportPhone(advisor.phone)}`}
              >
                {displaySupportPhone(advisor.phone)}
              </a>
              <a
                href={`https://wa.me/${advisor.phone.slice(1)}?text=${encodeURIComponent("Hola, necesito orientación para usar BelaClub.")}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Escribir a ${advisor.name} por WhatsApp`}
                className="mt-3 block w-fit rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20 focus-visible:outline-2 focus-visible:outline-emerald-300"
              >
                WhatsApp
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">
          Por ahora puedes contactarnos a través de los canales de ayuda.
        </p>
      )}
      {collapsible && (
        <Link href="/soporte" className="mt-4 inline-block text-sm font-semibold text-blue-300 underline underline-offset-4 hover:text-blue-200">
          Ver todos los canales de ayuda
        </Link>
      )}
    </div>
  );

  if (!collapsible) return content;

  // Native disclosure keeps every contact in the server-rendered HTML, even closed.
  return (
    <details id="soporte" className="group w-full scroll-mt-6">
      <summary className="ml-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded py-2 text-sm text-neutral-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400 [&::-webkit-details-marker]:hidden">
        Soporte
        <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-2">{content}</div>
    </details>
  );
}
