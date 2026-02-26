"use client";

import { useState } from "react";
import { registerUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cliente");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: any) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await registerUser(email, password, role);
      router.push("/prestadores");
    } catch (error: any) {
      setMessage("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-xl p-8 relative">

        {/* LOGO */}
        <div className="absolute top-4 left-4">
          <Image
            src="/logofinal.svg"
            alt="Logo"
            width={36}
            height={36}
          />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-6">
          Crear cuenta
        </h1>

        <form onSubmit={handleRegister} className="space-y-4">

          {/* EMAIL */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* ROLE */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Tipo de cuenta
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="cliente">Cliente</option>
              <option value="prestador">Prestador de servicios</option>
            </select>
          </div>

          {/* BOTÓN */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        {/* MENSAJE */}
        {message && (
          <p className="text-sm text-center text-red-400 mt-4">
            {message}
          </p>
        )}

        {/* FOOTER */}
        <p className="text-xs text-zinc-500 text-center mt-6">
          ¿Ya tienes cuenta?{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-blue-400 hover:underline cursor-pointer"
          >
            Inicia sesión
          </span>
        </p>
      </div>
    </div>
  );
}
