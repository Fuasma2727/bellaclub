"use client";

import { useState } from "react";
import { loginUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    } catch (error: any) {
      setMessage("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="relative w-full max-w-md bg-neutral-950 rounded-2xl shadow-xl p-8">

        {/* LOGO */}
        <div className="absolute top-4 left-4">
          <Image
            src="/logofinal.svg"
            alt="Logo"
            width={36}
            height={36}
            priority
          />
        </div>

        {/* TÍTULO */}
        <h1 className="text-2xl font-semibold text-center mb-2">
          Iniciar sesión
        </h1>
        <p className="text-sm text-neutral-400 text-center mb-8">
          Accede a tu cuenta
        </p>

        {/* FORM */}
        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block text-sm mb-1 text-neutral-300">
              Email
            </label>
            <input
              type="email"
              className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-blue-500"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-neutral-300">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* ERROR */}
          {message && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm p-3 rounded-lg">
              {message}
            </div>
          )}

          {/* BOTÓN */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 transition rounded-lg font-semibold disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* FOOTER */}
        <div className="mt-6 text-center text-sm text-neutral-400">
          ¿No tienes cuenta?{" "}
          <span
            onClick={() => router.push("/register")}
            className="text-blue-400 hover:underline cursor-pointer"
          >
            Regístrate
          </span>
        </div>
      </div>
    </div>
  );
}
