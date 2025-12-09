import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="relative isolate overflow-hidden bg-brand-black">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-35"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80')"
          }}
        />
        <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 text-center pt-16 pb-24">
          <div className="mb-12 flex flex-wrap items-center justify-center gap-10">
            <div className="flex items-center justify-center rounded-2xl bg-white px-6 py-4">
              <Image
                src="/images/logo-company.png"
                alt="לוגו חברה"
                width={320}
                height={120}
                className="h-24 w-auto object-contain"
                priority
              />
            </div>
            <div className="flex items-center justify-center rounded-2xl bg-white px-6 py-4">
              <Image
                src="/images/logo-guess.png"
                alt="Guess Logo"
                width={280}
                height={110}
                className="h-24 w-auto object-contain"
                priority
              />
            </div>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            קטלוג רשמי – GUESS ישראל
          </h1>
          <p className="mb-10 max-w-2xl text-lg text-white/80">
            גישה מקצועית לכל דגמי התיקים והנעליים, עם עדכון מלאי פשוט ונוח.
          </p>

          <Link href="/products" className="btn-primary">
            למעבר לקטלוג
          </Link>
        </div>
      </section>
    </main>
  );
}

