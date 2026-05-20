import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminos de uso",
  description:
    "Consulta las reglas de uso de BelaClub, responsabilidades de usuarios, pagos, verificaciones y moderacion de perfiles.",
  alternates: {
    canonical: "/terminos",
  },
};

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/prestadores" className="text-sm text-blue-300">
          Volver a BelaClub
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Terminos de uso</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-neutral-300">
          <p>
            BelaClub es una plataforma para conectar clientes con prestadores
            independientes. Cada usuario es responsable de la informacion que
            publica, de sus comunicaciones y de cumplir la ley aplicable.
          </p>
          <p>
            Solo pueden registrarse personas mayores de edad. No se permite
            contenido ilegal, no consentido, fraudulento, violento, de menores
            de edad, suplantacion de identidad ni actividades que pongan en
            riesgo a otros usuarios.
          </p>
          <p>
            Los perfiles de prestadores pueden requerir revision manual antes
            de aparecer publicamente. BelaClub puede ocultar, bloquear o retirar
            perfiles, contenido o cuentas cuando detecte riesgo, abuso o uso
            indebido.
          </p>
          <p>
            Los pagos, recargas y saldos se procesan mediante proveedores
            externos y pueden estar sujetos a sus propias politicas. El usuario
            acepta que algunas transacciones puedan ser revisadas por seguridad.
          </p>
          <p>
            Estos terminos son una base operativa inicial y deben ser revisados
            por asesoria legal antes de escalar publicamente el servicio.
          </p>
        </div>
      </section>
    </main>
  );
}
