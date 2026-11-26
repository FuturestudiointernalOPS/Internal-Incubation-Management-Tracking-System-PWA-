export default function StatCard({ label, value }) {
  return (
    <div className="p-3 bg-secondary border border-[var(--border-primary)] rounded-xl px-5 flex flex-col justify-center shadow-sm min-w-[90px]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">
        {label}
      </span>
      <span className="text-xl font-black tracking-tight text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}
