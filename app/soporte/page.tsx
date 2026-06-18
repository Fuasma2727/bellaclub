import Link from "next/link";
import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Soporte",
  description:
    "Canales de ayuda de BelaClub para cuentas, pagos, retiros, verificaciones, contenido, reportes y seguridad.",
  alternates: {
    canonical: "/soporte",
  },
};

const supportTopics = [
  {
    title: "Pagos y saldo",
    description:
      "Recargas no reflejadas, compras, abonos, codigos de pago, comisiones o movimientos.",
  },
  {
    title: "Retiros",
    description:
      "Solicitudes pendientes, cuenta bancaria, Nequi, Bancolombia, estado del retiro o rechazo.",
  },
  {
    title: "Verificaciones",
    description:
      "Foto, video, revision presencial, nivel de insignia, rechazo o solicitud pendiente.",
  },
  {
    title: "Contenido",
    description:
      "Fotos o videos que no cargan, contenido privado, eliminacion de archivos o reglas de publicacion.",
  },
  {
    title: "Seguridad",
    description:
      "Perfil falso, reporte, bloqueo, suplantacion, acoso, estafa o actividad sospechosa.",
  },
  {
    title: "Cuenta",
    description:
      "Acceso, correo, perfil pausado, mensualidad, foto principal, visibilidad o cambio de datos.",
  },
];

export default function SoportePage() {
  return (
    <LegalPageShell>
        <Link href="/prestadores" className="text-sm font-semibold text-blue-300">
          Volver a BelaClub
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Ayuda y contacto
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Soporte BelaClub</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400">
          Si necesitas ayuda, envia la mayor cantidad de informacion posible:
          correo de la cuenta, fecha, monto, codigo de abono, captura del error
          y una descripcion breve del problema.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://www.instagram.com/belaclub_0/"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Contactar por Instagram
          </a>
          <Link
            href="/seguridad"
            className="rounded-md border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.06] hover:text-white"
          >
            Ver reglas de seguridad
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {supportTopics.map((topic) => (
            <article
              key={topic.title}
              className="rounded-lg border border-white/[0.08] bg-[#101012] p-5"
            >
              <h2 className="text-lg font-semibold text-white">
                {topic.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                {topic.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-5 text-sm leading-6 text-amber-50/80">
          Para casos urgentes de seguridad, riesgo personal, amenazas o delitos,
          contacta tambien a las autoridades competentes. BelaClub puede revisar
          reportes dentro de la plataforma, pero no reemplaza atencion de
          emergencia.
        </div>
    </LegalPageShell>
  );
}
