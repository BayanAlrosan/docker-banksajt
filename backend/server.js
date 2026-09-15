import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

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
  try {
    const { token, amount } = req.body;

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
    const newAmount = Number(account.amount) + Number(amount);

    await db.execute(
      "UPDATE accounts SET amount = ? WHERE userId = ?",
      [newAmount, session.userId]
    );

    res.status(200).json({
      amount: newAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Något gick fel",
    });
  }
});

app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});