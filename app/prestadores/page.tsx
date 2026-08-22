import PrestadoresClientPage, {
  type PrestadoresPageProps,
} from "./PrestadoresClientPage";
import { getPublicProviderCards } from "@/lib/publicProviders";

export const dynamic = "force-dynamic";

export default async function PrestadoresPage({
  initialProviders,
  ...props
}: PrestadoresPageProps = {}) {
  const providers = initialProviders || (await getPublicProviderCards());

  return (
    <PrestadoresClientPage initialProviders={providers} {...props} />
  );
}
