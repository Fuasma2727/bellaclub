import Link from "next/link";
import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terminos de uso",
  description:
    "Reglas de uso de BelaClub para cuentas, perfiles, verificaciones, pagos, contenido privado, reportes y moderacion.",
  alternates: {
    canonical: "/terminos",
  },
};

const sections = [
  {
    title: "1. Naturaleza de la plataforma",
    items: [
      "BelaClub es una plataforma digital para conectar clientes con escorts independientes mayores de edad.",
      "BelaClub no es empleador, representante ni agencia de las escorts registradas. Cada usuario actua bajo su propia responsabilidad.",
      "La plataforma puede facilitar contacto, publicacion de perfiles, contenido, verificaciones, pagos internos y herramientas de seguridad.",
    ],
  },
  {
    title: "2. Mayoría de edad y uso permitido",
    items: [
      "Solo pueden usar BelaClub personas mayores de edad segun la ley aplicable.",
      "Esta prohibido crear cuentas falsas, suplantar identidades, publicar informacion engañosa o usar datos de terceros sin autorizacion.",
      "No se permite ningun uso relacionado con menores de edad, explotacion, coercion, trata, amenazas, fraude o contenido no consentido.",
    ],
  },
  {
    title: "3. Perfiles, verificaciones y visibilidad",
    items: [
      "Los perfiles de escorts pueden quedar ocultos hasta que sean revisados o aprobados por el administrador.",
      "Las insignias de verificacion indican que se reviso una evidencia o proceso, pero no garantizan disponibilidad, conducta futura ni resultados de un servicio.",
      "BelaClub puede ocultar, pausar, bloquear, rechazar o eliminar perfiles y contenido si detecta riesgo, incumplimiento o actividad sospechosa.",
    ],
  },
  {
    title: "4. Pagos, saldo y comisiones",
    items: [
      "Los usuarios pueden recargar saldo y usarlo para contenido, abonos, promociones, mensualidades u otros servicios habilitados.",
      "BelaClub puede retener comisiones por transacciones, contenido, abonos y retiros segun lo informado dentro de la plataforma.",
      "Los pagos externos pueden ser procesados por proveedores como Wompi u otros aliados, sujetos tambien a sus propias condiciones.",
    ],
  },
  {
    title: "5. Contenido publico y privado",
    items: [
      "Cada escort es responsable del contenido que sube y debe contar con derechos y consentimiento para publicarlo.",
      "El contenido privado solo debe desbloquearse mediante una compra valida dentro de la plataforma.",
      "Queda prohibido descargar, redistribuir, grabar, revender o publicar contenido de otros usuarios sin autorizacion.",
    ],
  },
  {
    title: "6. Moderacion y reportes",
    items: [
      "BelaClub puede revisar reportes, transacciones, perfiles, evidencias de verificacion y contenido para prevenir abuso.",
      "El administrador puede tomar medidas preventivas mientras revisa una situacion: ocultar contenido, bloquear perfiles o congelar funciones.",
      "Los usuarios deben reportar perfiles falsos, estafas, contenido indebido o cualquier situacion que ponga en riesgo a la comunidad.",
    ],
  },
  {
    title: "7. Cambios en el servicio",
    items: [
      "BelaClub puede modificar funciones, precios, comisiones, reglas de verificacion o condiciones operativas cuando sea necesario.",
      "Los cambios importantes se comunicaran por los canales disponibles dentro de la plataforma o paginas informativas.",
      "Estos terminos son una base operativa y deben ser revisados por asesoria legal antes de escalar el servicio publicamente.",
    ],
  },
];

export default function TerminosPage() {
  return (
    <LegalPageShell>
        <Link href="/escorts" className="text-sm font-semibold text-blue-300">
          Volver a BelaClub
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Marco de uso
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Terminos de uso</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400">
          Estas reglas explican como debe usarse BelaClub, que responsabilidades
          tienen los usuarios y que medidas puede tomar la plataforma para
          proteger el servicio.
        </p>

        <div className="mt-8 grid gap-4">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-lg border border-white/[0.08] bg-[#101012] p-5"
            >
              <h2 className="text-lg font-semibold text-white">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
    </LegalPageShell>
  );
}
