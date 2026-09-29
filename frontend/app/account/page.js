"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

const FEATURE_SAVINGS =
  process.env.NEXT_PUBLIC_FEATURE_SAVINGS === "true";

export default function AccountPage() {
  const router = useRouter();

  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function getBalance() {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_URL}/me/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setBalance(data.amount);
      }
    }

    getBalance();
  }, [router]);

  async function handleDeposit(event) {
    event.preventDefault();
    setMessage("");

    const token = localStorage.getItem("token");

    const response = await fetch(
      `${API_URL}/me/accounts/transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          amount: Number(amount),
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      setBalance(data.amount);
      setAmount("");
    } else {
      setMessage(data.message || "Insättningen misslyckades");
    }
  }

  async function handleWithdrawal(event) {
    event.preventDefault();
    setMessage("");

    const token = localStorage.getItem("token");

    const response = await fetch(
      `${API_URL}/me/accounts/withdrawals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          amount: Number(withdrawalAmount),
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      setBalance(data.amount);
      setWithdrawalAmount("");
      setMessage("Uttaget genomfördes");
    } else {
      setMessage(data.message || "Uttaget misslyckades");
    }
  }

  return (
    <main>
      <h1>Mitt konto</h1>

      <h2>Saldo: {balance === null ? "Laddar..." : `${balance} kr`}</h2>

      <p>
        <Link href="/transactions">Visa transaktioner</Link>
      </p>

      {FEATURE_SAVINGS && (
        <section>
          <h2>Savings</h2>
          <p>Här kan du snart få en bättre överblick över ditt sparande.</p>
        </section>
      )}

      <form onSubmit={handleDeposit}>
        <label htmlFor="amount">Belopp</label>

        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />

        <button type="submit">Sätt in pengar</button>
      </form>

      <form onSubmit={handleWithdrawal}>
        <label htmlFor="withdrawalAmount">Uttagsbelopp</label>

        <input
          id="withdrawalAmount"
          type="number"
          value={withdrawalAmount}
          onChange={(event) => setWithdrawalAmount(event.target.value)}
          required
        />

        <button type="submit">Ta ut pengar</button>
      </form>

      {message && <p role="status">{message}</p>}
    </main>
  );
}
