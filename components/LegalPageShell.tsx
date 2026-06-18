"use client";

import type { PropsWithChildren } from "react";
import { useRouter } from "next/navigation";

export default function LegalPageShell({ children }: PropsWithChildren) {
  const router = useRouter();

  return (
    <main
      className="min-h-screen cursor-pointer bg-[#050505] px-6 py-10 text-white"
      onClick={() => router.push("/prestadores")}
      aria-label="Cerrar y volver a BelaClub"
    >
      <section
        className="mx-auto max-w-4xl cursor-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </main>
  );
}
