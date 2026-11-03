import PrestadoresClientPage, {
  type PrestadoresPageProps,
} from "./PrestadoresClientPage";
import { toProviderListingCard } from "@/lib/providerListing";

export default function PrestadoresPage({
  initialProviders,
  ...props
}: PrestadoresPageProps = {}) {
  return (
    <PrestadoresClientPage
      initialProviders={initialProviders?.map(toProviderListingCard)}
      {...props}
    />
  );
}
