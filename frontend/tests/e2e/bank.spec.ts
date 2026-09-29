import { test, expect } from "@playwright/test";

function uniqueUsername() {
  return `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function registerAndLogin(page, username: string, password = "test123") {
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

  await expect(page.getByText(/200 kr/)).toBeVisible();

  await page.goto("/account");

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

  await expect(page.getByText("Uttag", { exact: true })).toBeVisible();
  await expect(page.getByText(/200 kr/)).toBeVisible();

  await page.goto("/account");

  await expect(
    page.getByRole("heading", { name: "Saldo: 300 kr" })
  ).toBeVisible();

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
