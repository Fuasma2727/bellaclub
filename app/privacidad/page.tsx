import Link from "next/link";
import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Conoce como BelaClub trata datos de cuenta, perfiles, verificaciones, contenido, pagos, saldos, retiros y reportes.",
  alternates: {
    canonical: "/privacidad",
  },
};

const sections = [
  {
    title: "Datos que podemos tratar",
    items: [
      "Datos de cuenta: correo, identificador de usuario, rol, fecha de registro y estado de la cuenta.",
      "Datos de perfil: nombre publico, ubicacion, zona, WhatsApp, descripcion, precio, foto principal y galeria.",
      "Datos de operacion: saldo, recargas, compras, abonos, comisiones, retiros, mensualidad, promociones y notificaciones.",
      "Datos de seguridad: reportes, bloqueos, evidencias de verificacion, revisiones administrativas y registros necesarios para proteger la plataforma.",
    ],
  },
  {
    title: "Informacion publica y privada",
    items: [
      "La informacion publica de perfiles aprobados puede mostrarse en la pagina de escorts y en tarjetas de busqueda.",
      "El contenido marcado como privado debe mostrarse solo cuando exista una compra valida dentro de BelaClub.",
      "Las evidencias de verificacion, como fotos o videos enviados para revision, no son publicas y deben ser revisadas solo por administracion.",
    ],
  },
  {
    title: "Proveedores tecnicos",
    items: [
      "Podemos usar Firebase para autenticacion, base de datos y funciones internas.",
      "Podemos usar Bunny u otro proveedor para almacenamiento y entrega de imagenes o videos.",
      "Podemos usar Wompi u otros proveedores de pago para recargas y validacion de transacciones.",
      "Cada proveedor puede tratar datos de acuerdo con sus propias politicas y requisitos tecnicos.",
    ],
  },
  {
    title: "Uso de la informacion",
    items: [
      "Operar cuentas, perfiles, contenido, pagos, saldo, retiros, mensualidad y promociones.",
      "Revisar verificaciones, atender reportes, prevenir fraude y proteger a usuarios.",
      "Mejorar la navegabilidad, ordenar perfiles y mostrar filtros por ciudad, departamento o zona.",
      "Cumplir obligaciones operativas, legales, contables o de seguridad cuando aplique.",
    ],
  },
  {
    title: "Conservacion y solicitudes",
    items: [
      "El usuario puede solicitar correccion, ocultamiento, bloqueo o revision de su informacion contactando soporte.",
      "Algunos registros de pagos, seguridad, moderacion o reportes pueden conservarse por necesidad operativa o legal.",
      "Si una cuenta es bloqueada o eliminada, BelaClub puede conservar datos minimos para prevenir abuso o resolver disputas.",
    ],
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPageShell>
        <Link href="/escorts" className="text-sm font-semibold text-blue-300">
          Volver a BelaClub
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Datos y privacidad
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Privacidad</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400">
          Esta pagina resume que informacion puede usar BelaClub para operar la
          plataforma, proteger pagos y moderar perfiles.
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
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
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
