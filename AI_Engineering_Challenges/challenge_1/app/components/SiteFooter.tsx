export default function SiteFooter() {
  return (
    <footer className="flex flex-col items-center justify-between gap-2 border-t border-gray-100 px-6 py-5 text-[12px] text-gray-400 sm:flex-row sm:px-12">
      <a
        href="#"
        className="flex items-center gap-[9px] font-extrabold text-gray-900 no-underline"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-papaya text-[11px] font-extrabold text-white">
          P
        </span>
        Papaya
      </a>
      <div>
        © 2026 Papaya ·{" "}
        <a href="#" className="text-gray-400 no-underline hover:text-gray-600">
          Privacy
        </a>{" "}
        ·{" "}
        <a href="#" className="text-gray-400 no-underline hover:text-gray-600">
          Terms
        </a>
      </div>
    </footer>
  );
}
