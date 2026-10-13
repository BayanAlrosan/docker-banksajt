import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validateAmount } from "./src/validateAmount.js";
import { validateWithdrawal } from "./src/validateWithdrawal.js";

const app = express();
const port = process.env.PORT || 3001;

const secret = process.env.JWT_SECRET;

if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
  throw new Error("JWT_SECRET måste vara minst 32 byte");
}

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

function requireAuth(req, res, next) {
  const authorization = req.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Saknad eller ogiltig token",
    });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "banken",
      audience: "banken-api",
    });

    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      return res.status(401).json({
        message: "Ogiltig eller utgången token",
      });
    }

    const userId = Number(payload.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: "Ogiltig eller utgången token",
      });
    }

    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({
      message: "Ogiltig eller utgången token",
    });
  }
}

// Skapa användare
app.post("/users", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Användarnamn och lösenord krävs",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Lösenordet måste vara minst 8 tecken",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, passwordHash]
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
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    const user = users[0];

    if (!user) {
      return res.status(401).json({
        message: "Fel användarnamn eller lösenord",
      });
    }

    const passwordIsCorrect = await bcrypt.compare(password, user.password);

    if (!passwordIsCorrect) {
      return res.status(401).json({
        message: "Fel användarnamn eller lösenord",
      });
    }

    const token = jwt.sign(
      { sub: String(user.id) },
      secret,
      {
        algorithm: "HS256",
        issuer: "banken",
        audience: "banken-api",
        expiresIn: "15m",
      }
    );

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Något gick fel",
    });
  }
});

// Visa saldo
app.post("/me/accounts", requireAuth, async (req, res) => {
  try {
    const [accounts] = await db.execute(
      "SELECT * FROM accounts WHERE userId = ?",
      [req.userId]
    );

    const account = accounts[0];

    if (!account) {
      return res.status(404).json({
        message: "Konto saknas",
      });
    }

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
app.post("/me/accounts/transactions", requireAuth, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { amount } = req.body;

    if (!validateAmount(amount)) {
      return res.status(400).json({
        message: "Beloppet måste vara större än 0",
      });
    }

    await connection.beginTransaction();

    const [accounts] = await connection.execute(
      "SELECT * FROM accounts WHERE userId = ? FOR UPDATE",
      [req.userId]
    );

    const account = accounts[0];

    if (!account) {
      await connection.rollback();
      return res.status(404).json({
        message: "Konto saknas",
      });
    }

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
app.post("/me/accounts/withdrawals", requireAuth, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { amount } = req.body;

    await connection.beginTransaction();

    const [accounts] = await connection.execute(
      "SELECT * FROM accounts WHERE userId = ? FOR UPDATE",
      [req.userId]
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
app.get("/me/accounts/transactions", requireAuth, async (req, res) => {
  try {
    const [transactions] = await db.execute(
      `SELECT t.id, t.type, t.amount, t.createdAt
       FROM transactions t
       JOIN accounts a ON t.accountId = a.id
       WHERE a.userId = ?
       ORDER BY t.createdAt DESC, t.id DESC`,
      [req.userId]
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