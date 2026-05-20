import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Conoce como BelaClub trata datos de cuenta, perfiles, verificaciones, compras, abonos y reportes de seguridad.",
  alternates: {
    canonical: "/privacidad",
  },
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/prestadores" className="text-sm text-blue-300">
          Volver a BelaClub
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Privacidad</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-neutral-300">
          <p>
            BelaClub almacena datos necesarios para operar la cuenta: correo,
            rol, nombre, ubicacion, WhatsApp, fotos, videos, saldos,
            verificaciones, compras, abonos y notificaciones.
          </p>
          <p>
            La informacion publica de prestadores aprobados puede mostrarse a
            otros usuarios. El contenido marcado como privado solo debe
            mostrarse despues de una compra valida dentro de la plataforma.
          </p>
          <p>
            Usamos Firebase, Bunny y Wompi como proveedores tecnicos para
            autenticacion, base de datos, almacenamiento y pagos. Cada proveedor
            puede procesar datos segun sus propias politicas.
          </p>
          <p>
            Los usuarios pueden solicitar correccion, ocultamiento o bloqueo de
            su perfil contactando al administrador. BelaClub puede conservar
            registros de seguridad, pagos y moderacion cuando sea necesario.
          </p>
        </div>
      </section>
    </main>
  );
}
