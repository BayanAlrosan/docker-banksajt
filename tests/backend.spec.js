import { expect, test } from '@playwright/test';

const API_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

test.describe('Backend – JWT-säkerhet', () => {
  test('användaren kan logga in med JWT, se saldo och sätta in pengar', async ({
    request,
  }) => {
    const username = `student-${Date.now()}`;
    const password = 'hemligt123';

    const createUserResponse = await request.post(`${API_URL}/users`, {
      data: { username, password },
    });

    expect(createUserResponse.ok()).toBe(true);

    const loginResponse = await request.post(`${API_URL}/sessions`, {
      data: { username, password },
    });

    expect(loginResponse.ok()).toBe(true);

    const loginBody = await loginResponse.json();
    const { token } = loginBody;

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const initialAccountResponse = await request.post(
      `${API_URL}/me/accounts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(initialAccountResponse.ok()).toBe(true);

    const initialAccountBody = await initialAccountResponse.json();
    expect(initialAccountBody).toEqual(
      expect.objectContaining({ amount: 0 }),
    );

    const transactionResponse = await request.post(
      `${API_URL}/me/accounts/transactions`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { amount: 250 },
      },
    );

    expect(transactionResponse.ok()).toBe(true);

    const transactionBody = await transactionResponse.json();
    expect(transactionBody).toEqual(
      expect.objectContaining({ amount: 250 }),
    );

    const updatedAccountResponse = await request.post(
      `${API_URL}/me/accounts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(updatedAccountResponse.ok()).toBe(true);

    const updatedAccountBody = await updatedAccountResponse.json();
    expect(updatedAccountBody).toEqual(
      expect.objectContaining({ amount: 250 }),
    );
  });

  test('saknad eller ändrad JWT nekas', async ({ request }) => {
    const username = `jwt-${Date.now()}`;
    const password = 'hemligt123';

    await request.post(`${API_URL}/users`, {
      data: { username, password },
    });

    const loginResponse = await request.post(`${API_URL}/sessions`, {
      data: { username, password },
    });

    expect(loginResponse.ok()).toBe(true);

    const { token } = await loginResponse.json();

    const missingTokenResponse = await request.post(
      `${API_URL}/me/accounts`,
    );

    expect(missingTokenResponse.status()).toBe(401);

    const changedToken =
      token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

    const changedTokenResponse = await request.post(
      `${API_URL}/me/accounts`,
      {
        headers: {
          Authorization: `Bearer ${changedToken}`,
        },
      },
    );

    expect(changedTokenResponse.status()).toBe(401);
  });
});
