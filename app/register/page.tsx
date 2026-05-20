"use client";

import { useState } from "react";
import { registerUser, UserRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";

type UploadResponse = {
  url?: string;
  error?: string;
};

const providerSteps = [
  "Sube una foto sosteniendo un papel que diga BelaClub.",
  "Revisaremos que la solicitud sea real y segura.",
  "Tu perfil aparecerá cuando sea aprobado.",
];

const uploadVerificationPhoto = async (file: File, token: string) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload-profile-photo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = (await res.json()) as UploadResponse;

  if (!res.ok || !data.url) {
    throw new Error(data.error || "No pudimos subir la foto de verificación");
  }

  return data.url;
};

export default function RegisterPage() {
  const router = useRouter();
  const db = getFirestore(app);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("cliente");
  const [verificationPhoto, setVerificationPhoto] = useState<File | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (role === "prestador" && !verificationPhoto) {
      setMessage("Para crear un perfil de prestador debes subir la foto de verificación.");
      return;
    }

    if (!acceptedLegal) {
      setMessage("Debes confirmar que eres mayor de edad y aceptar las reglas de BelaClub.");
      return;
    }

    setLoading(true);

    try {
      const user = await registerUser(email, password, role);

      if (role === "prestador" && verificationPhoto) {
        const token = await user.getIdToken();
        const verificationPhotoUrl = await uploadVerificationPhoto(
          verificationPhoto,
          token
        );

        await setDoc(
          doc(db, "users", user.uid),
          { verificationPhotoUrl },
          { merge: true }
        );
      }

      router.push("/prestadores");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No pudimos crear la cuenta";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
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
              Crea tu acceso a la red
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight xl:text-5xl">
              Únete como cliente o solicita tu perfil como prestador.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-neutral-300">
              Los clientes pueden explorar perfiles al instante. Los
              prestadores pasan por revisión antes de aparecer públicamente.
            </p>

            <div className="mt-10 max-w-xl rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-semibold text-white">
                Verificación de prestadores
              </p>
              <div className="mt-4 space-y-3">
                {providerSteps.map((step) => (
                  <div key={step} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <p className="text-sm leading-6 text-neutral-300">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
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
                  Nuevo perfil
                </p>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                  Crear cuenta
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Elige cómo quieres empezar dentro de BelaClub.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-neutral-300">
                    Tipo de cuenta
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("cliente")}
                      className={`rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        role === "cliente"
                          ? "border-blue-500 bg-blue-500/15 text-white"
                          : "border-zinc-700 bg-zinc-900 text-neutral-400 hover:border-zinc-500"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        Cliente
                      </span>
                      <span className="mt-1 block text-xs">
                        Explorar servicios
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole("prestador")}
                      className={`rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        role === "prestador"
                          ? "border-blue-500 bg-blue-500/15 text-white"
                          : "border-zinc-700 bg-zinc-900 text-neutral-400 hover:border-zinc-500"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        Prestador
                      </span>
                      <span className="mt-1 block text-xs">
                        Solicitar perfil
                      </span>
                    </button>
                  </div>
                </div>

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
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {role === "prestador" && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                    <label
                      htmlFor="verificationPhoto"
                      className="block text-sm font-semibold text-white"
                    >
                      Foto de verificación
                    </label>
                    <p className="mt-1 text-xs leading-5 text-neutral-300">
                      Debes sostener un papel visible que diga BelaClub. Tu
                      perfil quedará pendiente hasta la aprobación.
                    </p>
                    <input
                      id="verificationPhoto"
                      name="verificationPhoto"
                      type="file"
                      accept="image/*"
                      className="mt-3 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-500"
                      onChange={(e) =>
                        setVerificationPhoto(e.target.files?.[0] ?? null)
                      }
                      required={role === "prestador"}
                    />
                    {verificationPhoto && (
                      <p className="mt-2 truncate text-xs text-blue-200">
                        {verificationPhoto.name}
                      </p>
                    )}
                  </div>
                )}

                {message && (
                  <div className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">
                    {message}
                  </div>
                )}

                <label className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-neutral-300">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(event) => setAcceptedLegal(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-blue-500"
                  />
                  <span>
                    Confirmo que soy mayor de edad y acepto los{" "}
                    <Link
                      href="/terminos"
                      className="font-medium text-blue-300 hover:text-blue-200"
                    >
                      terminos
                    </Link>
                    , la{" "}
                    <Link
                      href="/privacidad"
                      className="font-medium text-blue-300 hover:text-blue-200"
                    >
                      privacidad
                    </Link>{" "}
                    y las{" "}
                    <Link
                      href="/seguridad"
                      className="font-medium text-blue-300 hover:text-blue-200"
                    >
                      reglas de seguridad
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-neutral-400">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="font-medium text-blue-300 hover:text-blue-200 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  Inicia sesión
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
