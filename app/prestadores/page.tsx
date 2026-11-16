import PrestadoresClientPage, {
  type PrestadoresPageProps,
} from "./PrestadoresClientPage";
import { toProviderListingCard } from "@/lib/providerListing";
import SupportAdvisors from "@/components/SupportAdvisors";
import { getPublicSupportAdvisors } from "@/lib/supportAdvisors.server";

export default async function PrestadoresPage({
  initialProviders,
  ...props
}: PrestadoresPageProps = {}) {
  const advisors = await getPublicSupportAdvisors();
  return (
    <PrestadoresClientPage
      initialProviders={initialProviders?.map(toProviderListingCard)}
      {...props}
      supportContent={<SupportAdvisors advisors={advisors} />}
    />
  );
}
