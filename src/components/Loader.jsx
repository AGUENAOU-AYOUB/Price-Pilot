export function Loader() {
  return (
    <div className="flex items-center gap-2 text-sm text-slategray">
      <span className="h-2 w-2 animate-ping rounded-full bg-rosegold" />
      <span className="h-2 w-2 animate-ping rounded-full bg-rosegold delay-150" />
      <span className="h-2 w-2 animate-ping rounded-full bg-rosegold delay-300" />
      <span>Processing…</span>
    </div>
  );
}
