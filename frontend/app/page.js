import Link from "next/link";

export default function Home() {
  return (
    <main>
      <nav>
        <Link href="/">Hem</Link>
        <Link href="/login">Logga in</Link>
        <Link href="/register">Skapa användare</Link>
      </nav>

      <section>
        <h1>Välkommen till Nova Bank</h1>

        <p>
          En enkel bank där du kan skapa konto, logga in och
          hantera dina pengar.
        </p>

        <Link href="/register">
          Skapa användare
        </Link>
      </section>
    </main>
  );
}