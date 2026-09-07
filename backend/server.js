import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const users = [];
const accounts = [];
const sessions = [];

function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}
app.post("/users", (req, res) => {
  const { username, password } = req.body;

  const newUser = {
    id: users.length + 101,
    username,
    password,
  };

  users.push(newUser);

  const newAccount = {
    id: accounts.length + 1,
    userId: newUser.id,
    amount: 0,
  };

  accounts.push(newAccount);

  res.status(201).json({
    id: newUser.id,
    username: newUser.username,
  });
}); 
app.post("/sessions", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (user) =>
      user.username === username &&
      user.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Fel användarnamn eller lösenord",
    });
  }

  const token = generateOTP();

  sessions.push({
    userId: user.id,
    token,
  });

  res.status(200).json({
    token,
  });
});
app.post("/me/accounts", (req, res) => {
  const { token } = req.body;

  const session = sessions.find(
    (session) => session.token === token
  );

  if (!session) {
    return res.status(401).json({
      message: "Ogiltig token",
    });
  }

  const account = accounts.find(
    (account) => account.userId === session.userId
  );

  res.status(200).json({
    amount: account.amount,
  });
});
app.post("/me/accounts/transactions", (req, res) => {
  const { token, amount } = req.body;

  const session = sessions.find(
    (session) => session.token === token
  );

  if (!session) {
    return res.status(401).json({
      message: "Ogiltig token",
    });
  }

  const account = accounts.find(
    (account) => account.userId === session.userId
  );

  account.amount += Number(amount);

  res.status(200).json({
    amount: account.amount,
  });
});
app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});