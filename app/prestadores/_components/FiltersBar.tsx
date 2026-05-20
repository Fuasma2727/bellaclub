import { colombia } from "@/lib/colombia";

type FiltersBarProps = {
  departmentFilter: string;
  cityFilter: string;
  cities: string[];
  resultCount: number;
  onDepartmentChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onReset: () => void;
};

export default function FiltersBar({
  departmentFilter,
  cityFilter,
  cities,
  resultCount,
  onDepartmentChange,
  onCityChange,
  onReset,
}: FiltersBarProps) {
  return (
    <section className="sticky top-14 z-30 border-b border-white/[0.08] bg-[#050505]/95 backdrop-blur sm:top-16">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:px-6 lg:px-8">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:items-center">
          <select
            className="h-10 min-w-0 rounded-md border border-white/[0.08] bg-[#101012] px-3 text-sm font-medium text-neutral-100 outline-none transition hover:border-white/15 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-500/20 sm:w-56"
            value={departmentFilter}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            <option value="">Departamento</option>
            {colombia.departments.map((department) => (
              <option key={department.name} value={department.name}>
                {department.name}
              </option>
            ))}
          </select>

          <select
            className="h-10 min-w-0 rounded-md border border-white/[0.08] bg-[#101012] px-3 text-sm font-medium text-neutral-100 outline-none transition hover:border-white/15 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-45 sm:w-52"
            value={cityFilter}
            onChange={(e) => onCityChange(e.target.value)}
            disabled={!departmentFilter}
          >
            <option value="">Ciudad</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          {(departmentFilter || cityFilter) && (
            <button
              type="button"
              onClick={onReset}
              className="col-span-2 h-10 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white sm:col-span-1 sm:w-auto"
            >
              Limpiar
            </button>
          )}
        </div>

        <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 sm:px-3 sm:text-xs">
          {resultCount} resultado{resultCount === 1 ? "" : "s"}
        </span>
      </div>
    </section>
  );
}
