## Live site

http://13.60.183.249

## GitHub Actions

GitHub Actions körs automatiskt när jag pushar till main. Den kontrollerar frontend och backend och deployar sedan sajten till EC2 med Docker Compose.

## Feature flag

Jag har lagt till en Savings-funktion som styrs med `NEXT_PUBLIC_FEATURE_SAVINGS`.

`false` = Savings visas inte
`true` = Savings visas
