"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();

  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    async function getBalance() {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        "http://127.0.0.1:3001/me/accounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setBalance(data.amount);
      }
    }

    getBalance();
  }, [router]);

  async function handleDeposit(event) {
    event.preventDefault();

    const token = localStorage.getItem("token");

    const response = await fetch(
      "http://127.0.0.1:3001/me/accounts/transactions",
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
    }
  }

  return (
    <main>
      <h1>Mitt konto</h1>

      <h2>Saldo: {balance === null ? "Laddar..." : `${balance} kr`}</h2>

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
    </main>
  );
}