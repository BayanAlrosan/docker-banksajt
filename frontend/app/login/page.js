"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const response = await fetch(`${API_URL}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Fel vid inloggning");
      return;
    }

    localStorage.setItem("token", data.token);

    router.push("/account");
  }

  return (
    <main>
      <h1>Logga in</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Användarnamn</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Lösenord</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button type="submit">Logga in</button>

        {message && <p>{message}</p>}
      </form>
    </main>
  );
}