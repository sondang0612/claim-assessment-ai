export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-[18px] backdrop-blur-sm sm:px-12">
      <a
        href="#"
        className="flex items-center gap-[9px] text-[17px] font-extrabold text-gray-900 no-underline"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-papaya text-[12px] font-extrabold text-white">
          P
        </span>
        Papaya
      </a>
      <button
        type="button"
        className="rounded-[7px] bg-papaya px-5 py-[9px] text-[13px] font-bold text-white transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-papaya/50"
      >
        Get in touch
      </button>
    </nav>
  );
}
