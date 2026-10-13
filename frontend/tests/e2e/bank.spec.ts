import { test, expect } from "@playwright/test";

function uniqueUsername() {
  return `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function registerAndLogin(page, username: string, password = "test1234") {
  await page.goto("/register");

  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Skapa användare" }).click();

  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in" }).click();

  await expect(page).toHaveURL(/\/account/);
}

async function loginUser(
  page,
  username: string,
  password = "test1234"
) {
  await page.goto("/login");

  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in" }).click();

  await expect(page).toHaveURL(/\/account/);
}

test("oinloggad användare kan inte se konto eller transaktioner", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login/);
});

test("ny användare kan sätta in pengar och se transaktionen", async ({
  page,
}) => {
  const username = uniqueUsername();

  await registerAndLogin(page, username);

  await page.getByLabel("Belopp", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Sätt in pengar" }).click();

  await expect(page.getByRole("heading", { name: "Saldo: 500 kr" })).toBeVisible();

  await page.getByRole("link", { name: "Visa transaktioner" }).click();

  await expect(page.getByRole("heading", { name: "Transaktioner" })).toBeVisible();
  await expect(page.getByText("Insättning")).toBeVisible();
  await expect(page.getByText(/500 kr/)).toBeVisible();
});

test("historik finns kvar och ogiltigt belopp ändrar inget", async ({
  page,
}) => {
  const username = uniqueUsername();

  await registerAndLogin(page, username);

  await page.getByLabel("Belopp", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Sätt in pengar" }).click();

  await expect(page.getByRole("heading", { name: "Saldo: 200 kr" })).toBeVisible();

  await page.getByRole("link", { name: "Visa transaktioner" }).click();

  await expect(page.getByText(/200 kr/)).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/login/);

  await loginUser(page, username);

  await page.getByRole("link", { name: "Visa transaktioner" }).click();
  await expect(page.getByText(/200 kr/)).toBeVisible();

  await page.getByRole("link", { name: "Tillbaka till kontot" }).click();

  await page.getByLabel("Belopp", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Sätt in pengar" }).click();

  await expect(page.getByRole("heading", { name: "Saldo: 200 kr" })).toBeVisible();

  await page.getByRole("link", { name: "Visa transaktioner" }).click();

  await expect(page.getByText(/200 kr/)).toHaveCount(1);
});

test("uttag fungerar och övertrassering nekas", async ({ page }) => {
  const username = uniqueUsername();

  await registerAndLogin(page, username);

  await page.getByLabel("Belopp", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Sätt in pengar" }).click();

  await expect(
    page.getByRole("heading", { name: "Saldo: 500 kr" })
  ).toBeVisible();

  await page.getByLabel("Uttag", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Ta ut pengar" }).click();

  await expect(
    page.getByRole("heading", { name: "Saldo: 300 kr" })
  ).toBeVisible();

  await expect(page.getByRole("status")).toHaveText("Uttaget genomfördes");

  await page.getByRole("link", { name: "Visa transaktioner" }).click();

  await expect(page.getByText("Uttag", { exact: true })).toBeVisible();
  await expect(page.getByText(/200 kr/)).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(/\/login/);

  await loginUser(page, username);

  await expect(
    page.getByRole("heading", { name: "Saldo: 300 kr" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Visa transaktioner" }).click();
  await expect(page.getByText("Uttag", { exact: true })).toBeVisible();
  await expect(page.getByText(/200 kr/)).toBeVisible();

  await page.getByRole("link", { name: "Tillbaka till kontot" }).click();

  await page.getByLabel("Uttag", { exact: true }).fill("400");
  await page.getByRole("button", { name: "Ta ut pengar" }).click();

  await expect(
    page.getByRole("heading", { name: "Saldo: 300 kr" })
  ).toBeVisible();

  await expect(page.getByRole("status")).toHaveText(
    "Ogiltigt uttag eller otillräckligt saldo"
  );

  await page.getByRole("link", { name: "Visa transaktioner" }).click();

  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Uttag", { exact: true })).toHaveCount(1);
});

test("JWT skyddar kontoanrop", async ({ request }) => {
  const username = uniqueUsername();
  const password = "test1234";
  const backendUrl = "http://127.0.0.1:3003";

  const registerResponse = await request.post(`${backendUrl}/users`, {
    data: { username, password },
  });
  expect(registerResponse.ok()).toBe(true);

  const wrongPasswordResponse = await request.post(`${backendUrl}/sessions`, {
    data: { username, password: "felaktigt123" },
  });
  expect(wrongPasswordResponse.status()).toBe(401);

  const wrongPasswordData = await wrongPasswordResponse.json();
  expect(wrongPasswordData.token).toBeUndefined();

  const loginResponse = await request.post(`${backendUrl}/sessions`, {
    data: { username, password },
  });
  expect(loginResponse.ok()).toBe(true);

  const { token } = await loginResponse.json();
  expect(token.split(".")).toHaveLength(3);

  const validResponse = await request.post(`${backendUrl}/me/accounts`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(validResponse.ok()).toBe(true);

  const missingTokenResponse = await request.post(
    `${backendUrl}/me/accounts`
  );
  expect(missingTokenResponse.status()).toBe(401);

  const changedToken =
    token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

  const changedTokenResponse = await request.post(
    `${backendUrl}/me/accounts`,
    {
      headers: {
        Authorization: `Bearer ${changedToken}`,
      },
    }
  );

  expect(changedTokenResponse.status()).toBe(401);
});
