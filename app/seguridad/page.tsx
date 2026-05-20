import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seguridad",
  description:
    "Reglas de seguridad de BelaClub para perfiles verificados, reportes, conducta responsable y proteccion de usuarios.",
  alternates: {
    canonical: "/seguridad",
  },
};

export default function SeguridadPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/prestadores" className="text-sm text-blue-300">
          Volver a BelaClub
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Reglas de seguridad</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-neutral-300">
          <p>
            Todos los usuarios deben actuar con respeto, consentimiento y
            legalidad. No se permite presionar, amenazar, acosar, publicar datos
            privados de terceros ni compartir contenido sin autorizacion.
          </p>
          <p>
            Los prestadores deben usar fotos reales y pueden pasar por
            verificaciones adicionales. Una insignia indica que el administrador
            reviso una solicitud, pero no reemplaza el criterio personal de cada
            usuario al tomar contacto.
          </p>
          <p>
            Los clientes deben usar los canales de contacto de forma
            responsable. BelaClub puede bloquear cuentas, ocultar perfiles y
            revisar operaciones ante reportes o actividad sospechosa.
          </p>
          <p>
            Si detectas un perfil falso, abuso, estafa o contenido indebido,
            reportalo al administrador para revisarlo antes de continuar.
          </p>
        </div>
      </section>
    </main>
  );
}
