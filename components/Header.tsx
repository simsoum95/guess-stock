import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-brand-black/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo-company.png"
            alt="לוגו חברה"
            width={120}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <div className="flex items-center justify-end">
          <Image
            src="/images/logo-guess.png"
            alt="Guess Logo"
            width={120}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>
      </div>
    </header>
  );
}

