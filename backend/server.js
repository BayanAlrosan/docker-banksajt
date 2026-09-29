import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mysql from "mysql2/promise";
import { validateAmount } from "./src/validateAmount.js";
import { validateWithdrawal } from "./src/validateWithdrawal.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  decimalNumbers: true,
});

function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}

// Skapa användare
app.post("/users", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [result] = await db.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, password]
    );

    const userId = result.insertId;

    await db.execute(
      "INSERT INTO accounts (userId, amount) VALUES (?, ?)",
      [userId, 0]
    );

    res.status(201).json({
      id: userId,
      username,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Kunde inte skapa användare",
    });
  }
});

// Logga in
app.post("/sessions", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await db.execute(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    const user = users[0];

    if (!user) {
      return res.status(401).json({
        message: "Fel användarnamn eller lösenord",
      });
    }

    const token = generateOTP();

    await db.execute(
      "INSERT INTO sessions (userId, token) VALUES (?, ?)",
      [user.id, token]
    );

    res.status(200).json({
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Något gick fel",
    });
  }
});

// Visa saldo
app.post("/me/accounts", async (req, res) => {
  try {
    const { token } = req.body;

    const [sessions] = await db.execute(
      "SELECT * FROM sessions WHERE token = ?",
      [token]
    );

    const session = sessions[0];

    if (!session) {
      return res.status(401).json({
        message: "Ogiltig token",
      });
    }

    const [accounts] = await db.execute(
      "SELECT * FROM accounts WHERE userId = ?",
      [session.userId]
    );

    const account = accounts[0];

    res.status(200).json({
      amount: account.amount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Något gick fel",
    });
  }
});

// Sätt in pengar
app.post("/me/accounts/transactions", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { token, amount } = req.body;

    if (!validateAmount(amount)) {
      return res.status(400).json({
        message: "Beloppet måste vara större än 0",
      });
    }

    await connection.beginTransaction();

    const [sessions] = await connection.execute(
      "SELECT * FROM sessions WHERE token = ?",
      [token]
    );

    const session = sessions[0];

    if (!session) {
      await connection.rollback();
      return res.status(401).json({
        message: "Ogiltig token",
      });
    }

    const [accounts] = await connection.execute(
      "SELECT * FROM accounts WHERE userId = ? FOR UPDATE",
      [session.userId]
    );

    const account = accounts[0];
    const newAmount = Number(account.amount) + Number(amount);

    await connection.execute(
      "UPDATE accounts SET amount = ? WHERE id = ?",
      [newAmount, account.id]
    );

    await connection.execute(
      "INSERT INTO transactions (accountId, type, amount) VALUES (?, ?, ?)",
      [account.id, "deposit", Number(amount)]
    );

    await connection.commit();

    res.status(200).json({
      amount: newAmount,
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);

    res.status(500).json({
      message: "Något gick fel",
    });
  } finally {
    connection.release();
  }
});



// Ta ut pengar
app.post("/me/accounts/withdrawals", async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { token, amount } = req.body;

    await connection.beginTransaction();

    const [sessions] = await connection.execute(
      "SELECT * FROM sessions WHERE token = ?",
      [token]
    );

    const session = sessions[0];

    if (!session) {
      await connection.rollback();
      return res.status(401).json({ message: "Ogiltig token" });
    }

    const [accounts] = await connection.execute(
      "SELECT * FROM accounts WHERE userId = ? FOR UPDATE",
      [session.userId]
    );

    const account = accounts[0];

    if (!account) {
      await connection.rollback();
      return res.status(404).json({ message: "Konto saknas" });
    }

    if (!validateWithdrawal(amount, account.amount)) {
      await connection.rollback();
      return res.status(400).json({
        message: "Ogiltigt uttag eller otillräckligt saldo",
      });
    }

    const newAmount = Number(account.amount) - Number(amount);

    await connection.execute(
      "UPDATE accounts SET amount = ? WHERE id = ?",
      [newAmount, account.id]
    );

    await connection.execute(
      "INSERT INTO transactions (accountId, type, amount) VALUES (?, ?, ?)",
      [account.id, "withdrawal", Number(amount)]
    );

    await connection.commit();

    res.status(200).json({ amount: newAmount });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Något gick fel" });
  } finally {
    connection.release();
  }
});

// Hämta transaktionshistorik
app.get("/me/accounts/transactions", async (req, res) => {
  try {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Saknad token",
      });
    }

    const [sessions] = await db.execute(
      "SELECT * FROM sessions WHERE token = ?",
      [token]
    );

    const session = sessions[0];

    if (!session) {
      return res.status(401).json({
        message: "Ogiltig token",
      });
    }

    const [transactions] = await db.execute(
      `SELECT t.id, t.type, t.amount, t.createdAt
       FROM transactions t
       JOIN accounts a ON t.accountId = a.id
       WHERE a.userId = ?
       ORDER BY t.createdAt DESC, t.id DESC`,
      [session.userId]
    );

    res.status(200).json({
      transactions,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Kunde inte hämta transaktioner",
    });
  }
});

app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});