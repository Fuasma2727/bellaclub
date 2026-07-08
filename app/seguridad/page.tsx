import Link from "next/link";
import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Seguridad y reglas de contenido",
  description:
    "Reglas de seguridad de BelaClub para verificaciones, conducta, contenido permitido, reportes, pagos y proteccion de usuarios.",
  alternates: {
    canonical: "/seguridad",
  },
};

const sections = [
  {
    title: "Conducta obligatoria",
    items: [
      "Todos los usuarios deben actuar con respeto, consentimiento, legalidad y buena fe.",
      "No se permite acosar, amenazar, extorsionar, presionar, discriminar o publicar datos privados de terceros.",
      "No se permite usar BelaClub para actividades ilegales, contenido no consentido, suplantacion o fraude.",
    ],
  },
  {
    title: "Reglas de contenido",
    items: [
      "Las fotos y videos deben pertenecer a la persona que administra el perfil o contar con autorizacion valida.",
      "No se permite contenido de menores de edad, contenido robado, material no consentido o contenido que promueva violencia o explotacion.",
      "El administrador puede eliminar fotos, videos o descripciones si considera que incumplen reglas o generan riesgo.",
    ],
  },
  {
    title: "Verificaciones",
    items: [
      "Las verificaciones pueden solicitar foto, video, revision presencial o validacion por servicio segun el nivel.",
      "Para foto o video, el usuario puede ser solicitado a sostener una hoja con BelaClub y la fecha del dia para comprobar actualidad.",
      "Una insignia ayuda a generar confianza, pero no reemplaza la responsabilidad de cada usuario al comunicarse o contratar.",
    ],
  },
  {
    title: "Pagos y saldo",
    items: [
      "Usa solo los canales habilitados por BelaClub para recargas, compras, abonos y retiros.",
      "Revisa siempre saldos, comisiones, codigos de abono y notificaciones antes de confirmar cualquier acuerdo.",
      "BelaClub puede revisar o bloquear operaciones sospechosas para prevenir fraude o abuso.",
    ],
  },
  {
    title: "Reportes y moderacion",
    items: [
      "Reporta perfiles falsos, estafas, contenido indebido, abuso o cualquier situacion sospechosa.",
      "Los reportes pueden ser revisados por administracion y pueden generar bloqueos, eliminacion de contenido o suspension de funciones.",
      "Si hay riesgo inmediato para una persona, se recomienda contactar a las autoridades competentes.",
    ],
  },
  {
    title: "Proteccion de medios",
    items: [
      "BelaClub puede aplicar marcas de agua, bloqueo de clic derecho, restricciones de descarga y capas de proteccion visual.",
      "Estas medidas reducen abuso, pero ningun sitio web puede impedir al 100% capturas externas o grabaciones hechas con otro dispositivo.",
      "Compartir contenido privado desbloqueado sin autorizacion puede generar bloqueo y acciones adicionales.",
    ],
  },
];

export default function SeguridadPage() {
  return (
    <LegalPageShell>
        <Link href="/escorts" className="text-sm font-semibold text-blue-300">
          Volver a BelaClub
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Confianza y moderacion
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Seguridad y reglas de contenido
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400">
          Estas reglas buscan proteger a clientes, escorts y administradores.
          Si un perfil o contenido incumple estas condiciones, puede ser
          ocultado, bloqueado o eliminado.
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
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
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
