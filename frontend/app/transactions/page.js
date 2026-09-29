"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTransactions() {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/me/accounts/transactions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Kunde inte hämta transaktioner");
          return;
        }

        setTransactions(data.transactions);
      } catch {
        setMessage("Kunde inte hämta transaktioner");
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [router]);

  return (
    <main>
      <h1>Transaktioner</h1>

      <Link href="/account">Tillbaka till kontot</Link>

      {loading && <p>Laddar transaktioner...</p>}

      {message && <p>{message}</p>}

      {!loading && !message && transactions.length === 0 && (
        <p>Du har inga transaktioner ännu.</p>
      )}

      {!loading && !message && transactions.length > 0 && (
        <ul>
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <strong>
                {transaction.type === "deposit" ? "Insättning" : "Uttag"}
              </strong>
              {" – "}
              {transaction.amount} kr
              {" – "}
              {new Date(transaction.createdAt).toLocaleString("sv-SE")}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
