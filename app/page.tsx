import { redirect } from "next/navigation";

export default function Home() {
  // Redirige inmediatamente a la página principal de la app
  redirect("/prestadores");

  return null; // Nunca se muestra, pero Next requiere retornar algo
}
