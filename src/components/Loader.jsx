export function Loader({ label = 'Processing…' }) {
  return (
    <div className="inline-flex items-center gap-3 text-base font-medium text-primary-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
