import Link from "next/link";
import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Reembolsos y disputas",
  description:
    "Politica operativa de BelaClub para recargas, compras de contenido, abonos, comisiones, retiros y disputas.",
  alternates: {
    canonical: "/reembolsos",
  },
};

const sections = [
  {
    title: "Recargas de saldo",
    items: [
      "Las recargas aprobadas por el proveedor de pago se acreditan al saldo de la cuenta correspondiente.",
      "Si una recarga fue cobrada y no aparece reflejada, el usuario debe reportarla con el comprobante o referencia de pago.",
      "Las recargas pueden ser revisadas cuando exista error tecnico, pago duplicado o alerta de seguridad.",
    ],
  },
  {
    title: "Contenido privado",
    items: [
      "Una vez desbloqueado contenido privado, normalmente no aplica reembolso por cambio de opinion.",
      "Puede revisarse una disputa si el contenido no carga, no corresponde a la descripcion o fue retirado por moderacion antes de poder verlo.",
      "BelaClub puede resolver con reposicion, devolucion de saldo o rechazo de la disputa segun la evidencia disponible.",
    ],
  },
  {
    title: "Abonos a escorts",
    items: [
      "Los abonos generan notificaciones y codigos de confirmacion para cliente y escort.",
      "El usuario debe verificar nombre, monto, codigo y condiciones antes de confirmar cualquier acuerdo externo.",
      "Las disputas por abonos se revisan caso por caso con mensajes, codigo de abono, fecha y evidencia disponible.",
    ],
  },
  {
    title: "Retiros y comisiones",
    items: [
      "Los retiros solicitados por escorts pueden incluir una comision de BelaClub antes de liberar el valor final.",
      "Un retiro pendiente puede ser aprobado, rechazado o devuelto al saldo si la cuenta bancaria no es valida o existe alerta de seguridad.",
      "BelaClub puede pedir informacion adicional para validar titular, banco, cuenta o identidad del solicitante.",
    ],
  },
  {
    title: "Cuando no aplica devolucion",
    items: [
      "No aplica devolucion por incumplir reglas, intentar fraude, compartir contenido privado o usar datos falsos.",
      "No aplica devolucion por acuerdos hechos fuera de BelaClub sin evidencia verificable dentro de la plataforma.",
      "BelaClub puede bloquear saldos o funciones mientras revisa actividad sospechosa.",
    ],
  },
];

export default function ReembolsosPage() {
  return (
    <LegalPageShell>
        <Link href="/prestadores" className="text-sm font-semibold text-blue-300">
          Volver a BelaClub
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Pagos y disputas
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Reembolsos y disputas</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400">
          Esta politica explica como se revisan problemas con recargas,
          contenido privado, abonos, retiros y comisiones dentro de BelaClub.
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
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
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
