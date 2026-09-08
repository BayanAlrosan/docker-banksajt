import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const db = new Database("bank.db");


db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    amount INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    token TEXT
  );
`);
function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}
app.post("/users", (req, res) => {
  const { username, password } = req.body;

  const result = db
    .prepare("INSERT INTO users (username, password) VALUES (?, ?)")
    .run(username, password);

  const userId = result.lastInsertRowid;

  db.prepare(
    "INSERT INTO accounts (userId, amount) VALUES (?, ?)"
  ).run(userId, 0);

  res.status(201).json({
    id: userId,
    username: username,
  });
});
app.post("/sessions", (req, res) => {
  const { username, password } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);

  if (!user) {
    return res.status(401).json({
      message: "Fel användarnamn eller lösenord",
    });
  }

  const token = generateOTP();

  db.prepare(
    "INSERT INTO sessions (userId, token) VALUES (?, ?)"
  ).run(user.id, token);

  res.status(200).json({
    token,
  });
}); 
app.post("/me/accounts", (req, res) => {
  const { token } = req.body;

  const session = db
    .prepare("SELECT * FROM sessions WHERE token = ?")
    .get(token);

  if (!session) {
    return res.status(401).json({
      message: "Ogiltig token",
    });
  }

  const account = db
    .prepare("SELECT * FROM accounts WHERE userId = ?")
    .get(session.userId);

  res.status(200).json({
    amount: account.amount,
  });
});
app.post("/me/accounts/transactions", (req, res) => {
  const { token, amount } = req.body;

  const session = db
    .prepare("SELECT * FROM sessions WHERE token = ?")
    .get(token);

  if (!session) {
    return res.status(401).json({
      message: "Ogiltig token",
    });
  }

  const account = db
    .prepare("SELECT * FROM accounts WHERE userId = ?")
    .get(session.userId);

  const newAmount = account.amount + Number(amount);

  db.prepare(
    "UPDATE accounts SET amount = ? WHERE userId = ?"
  ).run(newAmount, session.userId);

  res.status(200).json({
    amount: newAmount,
  });
});
app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});