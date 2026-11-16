"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { MAX_SUPPORT_ADVISORS, type SupportAdvisor } from "@/lib/supportAdvisors";

type AdvisorsResponse = {
  advisors?: SupportAdvisor[];
  revision?: number;
  error?: string;
};

const readResponse = async (response: Response): Promise<AdvisorsResponse> => {
  const data = await response.json().catch(() => null) as AdvisorsResponse | null;
  if (!response.ok || !data || !Array.isArray(data.advisors) || typeof data.revision !== "number") {
    throw new Error(data?.error || "No pudimos cargar los asesores. Intenta de nuevo.");
  }
  return data;
};

export default function AdminAdvisorsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [advisors, setAdvisors] = useState<SupportAdvisor[]>([]);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoaded(false);
    setError("");
    setSuccess("");
    try {
      const token = await user.getIdToken();
      const data = await readResponse(await fetch("/api/admin/support-advisors", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }));
      setAdvisors(data.advisors!);
      setRevision(data.revision!);
      setDirty(false);
      setLoaded(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No pudimos cargar los asesores.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const change = (next: SupportAdvisor[]) => {
    setAdvisors(next);
    setDirty(true);
    setSuccess("");
    setError("");
  };

  const update = (id: string, fields: Partial<SupportAdvisor>) => {
    change(advisors.map((advisor) => advisor.id === id ? { ...advisor, ...fields } : advisor));
  };

  const move = (index: number, direction: number) => {
    const next = [...advisors];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    change(next);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !loaded || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = await user.getIdToken();
      const data = await readResponse(await fetch("/api/admin/support-advisors", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ advisors, revision }),
      }));
      setAdvisors(data.advisors!);
      setRevision(data.revision!);
      setDirty(false);
      setSuccess("Asesores guardados. Los contactos visibles ya están publicados en el sitio.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No pudimos guardar los asesores.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/verificaciones" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
          ← Volver al panel de control
        </Link>
        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm font-medium text-blue-300">Ayuda y contacto</p>
          <h1 className="mt-2 text-3xl font-semibold">Asesores de BelaClub</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            Administra los contactos que aparecen al abrir Soporte en el pie de página.
            Solo los asesores marcados como visibles se publican.
          </p>
          <Link href="/#soporte" prefetch={false} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-blue-300 underline underline-offset-4">
            Ver soporte en la página principal
          </Link>
        </header>

        {authLoading || loading ? (
          <p role="status" className="mt-8 text-neutral-400">Cargando asesores…</p>
        ) : !user ? (
          <div className="mt-8 rounded-lg border border-white/10 p-6">
            <p>Inicia sesión con la cuenta administradora para gestionar los asesores.</p>
            <Link href="/login" className="mt-4 inline-block text-blue-300 underline">Iniciar sesión</Link>
          </div>
        ) : (
          <>
            {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            {success && <p role="status" className="mt-6 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</p>}
            {!loaded ? (
              <button type="button" onClick={() => void load()} className="mt-6 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500">
                Reintentar carga
              </button>
            ) : (
              <form onSubmit={(event) => void save(event)} className="mt-6">
                <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
                  <legend className="sr-only">Lista de asesores</legend>
                  <p className="text-sm leading-6 text-neutral-400">
                    Escribe el celular colombiano de 10 dígitos o un número con indicativo
                    internacional (por ejemplo, +57). Los números visibles serán públicos y
                    podrán aparecer en buscadores.
                  </p>
                  {advisors.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-neutral-400">
                      Aún no hay asesores. Agrega el primero para publicar su contacto.
                    </p>
                  )}
                  {advisors.map((advisor, index) => (
                    <div key={advisor.id} className="rounded-lg border border-white/10 bg-neutral-950 p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`name-${advisor.id}`} className="text-sm font-semibold">Nombre del asesor</label>
                          <input id={`name-${advisor.id}`} value={advisor.name} required maxLength={80} autoComplete="off" onChange={(event) => update(advisor.id, { name: event.target.value })} className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-3 text-sm outline-none focus:border-blue-400" />
                        </div>
                        <div>
                          <label htmlFor={`phone-${advisor.id}`} className="text-sm font-semibold">Número de WhatsApp</label>
                          <input id={`phone-${advisor.id}`} type="tel" value={advisor.phone} required maxLength={32} autoComplete="off" onChange={(event) => update(advisor.id, { phone: event.target.value })} className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-3 text-sm outline-none focus:border-blue-400" />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
                          <input type="checkbox" checked={advisor.active} onChange={(event) => update(advisor.id, { active: event.target.checked })} className="h-4 w-4 accent-blue-500" />
                          Visible en la página
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" disabled={index === 0} aria-label={`Subir a ${advisor.name || `asesor ${index + 1}`}`} onClick={() => move(index, -1)} className="rounded border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-default disabled:opacity-30">↑</button>
                          <button type="button" disabled={index === advisors.length - 1} aria-label={`Bajar a ${advisor.name || `asesor ${index + 1}`}`} onClick={() => move(index, 1)} className="rounded border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-default disabled:opacity-30">↓</button>
                          <button type="button" aria-label={`Eliminar a ${advisor.name || `asesor ${index + 1}`}`} onClick={() => change(advisors.filter((row) => row.id !== advisor.id))} className="rounded px-3 py-2 text-sm text-red-300 hover:bg-red-500/10">Eliminar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" disabled={advisors.length >= MAX_SUPPORT_ADVISORS} onClick={() => change([...advisors, { id: crypto.randomUUID(), name: "", phone: "", active: true }])} className="rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-40">
                    + Agregar asesor
                  </button>
                  <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-5">
                    <button type="submit" disabled={!dirty} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-40">
                      {saving ? "Guardando…" : "Guardar asesores"}
                    </button>
                    <button type="button" onClick={() => void load()} className="rounded px-2 py-3 text-sm text-neutral-400 hover:text-white">
                      {dirty ? "Descartar cambios y recargar" : "Recargar lista"}
                    </button>
                    {dirty && <p role="status" className="text-sm text-amber-200">Tienes cambios sin guardar.</p>}
                  </div>
                </fieldset>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
