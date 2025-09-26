# Repository Guidelines

## Project Structure & Module Organization
- `src/` houses the Express app: `controllers/` map routes, `services/` wrap domain logic (OCR, spaced repetition, gamification), `models/` handle Postgres access, and `utils/` share helpers.
- `tests/` mirrors domain folders with Jest suites; `tests/setup.ts` injects `.env.test` values and shared hooks.
- `scripts/` exposes scraping utilities executed through npm scripts, avoiding manual ts-node setup.
- `docs/` stores reference guides, notably AMC scraping instructions for content imports.
- Copy `.env.example` to `.env` (and `.env.test`) before running code or tests.

## Build, Test, and Development Commands
- `npm install` targets Node 18+ environments.
- `npm run dev` (Nodemon) starts the API, `npm run build` compiles to `dist/`, and `npm start` serves the build.
- `npm run typecheck`, `npm run lint`, and `npm run lint:fix` keep static analysis clean.
- `npm test`, `npm test:watch`, and `npm test -- --coverage` run the Jest suites.
- Scraper workflows: `npm run scrape-amc:demo` for smoke tests, `npm run scrape-amc -- --year 2024 --test A --count 10` for targeted imports.

## Coding Style & Naming Conventions
- Strict TypeScript is enforced; use the `@/*` alias defined in `tsconfig.json` for module paths.
- Follow two-space indentation, `camelCase` for variables/functions, `PascalCase` for classes/types, and uppercase snake case for environment constants.
- Keep controllers thin and push data access and side effects into `services/` or `models/` modules.
- Run ESLint before commits; unresolved lint failures should block review.

## Testing Guidelines
- Jest with `ts-jest` powers the suite; place specs under `tests/**` using the `.test.ts` suffix.
- Reuse fixtures via `tests/setup.ts`, which also silences console noise and pins `NODE_ENV=test`.
- Maintain focused unit coverage for new logic and clean up Postgres/Redis resources in helpers when writing integration tests.

## Commit & Pull Request Guidelines
- With no repository history in this snapshot, follow Conventional Commits (`feat:`, `fix:`, `chore:`) for clarity.
- Keep pull requests narrow, explain context and risk, list manual/automated tests, and call out API or schema changes.
- Link issues or docs and attach client-facing screenshots when behavior shifts.
- Verify `npm run lint`, `npm run typecheck`, and `npm test` before requesting review.

## Environment & Configuration Tips
- Populate `.env` with Postgres, Redis, Stripe, OpenAI, and OCR values; services must be reachable before `npm run dev`.
- `docker-compose.yml` supplies disposable backing services—align port settings with your `.env`.
