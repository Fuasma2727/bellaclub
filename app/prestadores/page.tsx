import PrestadoresClientPage, {
  type PrestadoresPageProps,
} from "./PrestadoresClientPage";

export default function PrestadoresPage({
  initialProviders,
  ...props
}: PrestadoresPageProps = {}) {
  return (
    <PrestadoresClientPage initialProviders={initialProviders} {...props} />
  );
}
