"use client";

import { useState } from "react";
import { loginUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const trustSignals = [
  "Perfiles con verificación",
  "Pagos protegidos",
  "Contenido privado seguro",
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await loginUser(email, password);
      router.push("/prestadores");
    } catch {
      setMessage("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="hidden lg:block">
            <Link
              href="/prestadores"
              className="mb-14 inline-flex items-center gap-3"
            >
              <Image
                src="/logofinal.svg"
                alt="BelaClub"
                width={44}
                height={44}
                priority
              />
              <span className="text-2xl font-semibold">BelaClub</span>
            </Link>

            <p className="mb-4 text-sm font-medium text-blue-300">
              Servicios, perfiles y contenido privado
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight xl:text-5xl">
              Entra a una red segura para descubrir prestadores verificados.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-neutral-300">
              Explora perfiles, revisa contenido disponible y gestiona tus
              servicios desde una experiencia privada, clara y profesional.
            </p>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {trustSignals.map((signal) => (
                <div
                  key={signal}
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="mb-3 h-1.5 w-8 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium text-neutral-200">
                    {signal}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <Link
              href="/prestadores"
              className="mb-8 flex items-center justify-center gap-3 lg:hidden"
            >
              <Image
                src="/logofinal.svg"
                alt="BelaClub"
                width={40}
                height={40}
                priority
              />
              <span className="text-xl font-semibold">BelaClub</span>
            </Link>

            <div className="rounded-lg border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-blue-950/20 sm:p-8">
              <div className="mb-6 sm:mb-8">
                <p className="mb-2 text-sm font-medium text-blue-300">
                  Bienvenido de nuevo
                </p>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                  Iniciar sesión
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Accede con tu cuenta para continuar explorando BelaClub.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-neutral-300"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-neutral-300"
                  >
                    Contraseña
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {message && (
                  <div className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Ingresando..." : "Ingresar"}
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-3 text-center text-sm text-neutral-400">
                <p>
                  ¿No tienes cuenta?{" "}
                  <Link
                    href="/register"
                    className="font-medium text-blue-300 hover:text-blue-200 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    Crea tu perfil
                  </Link>
                </p>

                <Link
                  href="/prestadores"
                  className="text-neutral-500 hover:text-neutral-300 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  Explorar prestadores sin iniciar sesión
                </Link>
              </div>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-neutral-500">
              Tu acceso está protegido. Nunca compartiremos tu información de
              inicio de sesión.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
