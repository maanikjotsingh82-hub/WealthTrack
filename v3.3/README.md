# WealthTrack

## Run
```cmd
npm install
npm run dev
```
Then open http://localhost:5173.

## New analytics and money-return behavior
- Investment tab: investment value-by-type graph plus existing investment P/L and per-stock history graphs.
- Dashboard: net worth trend chart backed by daily snapshots stored in `netWorthHistory`.
- Cash Flow: six-month income/expense/cash-flow graph.
- Removing a goal automatically returns its funded amount to Savings.
- Emergency Reserve has a **Move Reserve to Savings** control that returns the current reserve amount to Savings and resets the reserve to zero.

## Notes
This is a local browser MVP. Live stock quotes require internet access to the configured market-data provider.


### Latest update
- Savings now includes linked transaction flow (income increases, expense decreases).
- Savings page includes a transaction-linked graph and manual savings management.
- Investments includes persistent stock graph shortcut buttons for tracked stocks.
- Net-worth snapshot effect is evaluated after totals are initialized.

\n## WealthBot AI (OpenRouter Free)\n1. Create an API key at https://openrouter.ai/keys.\n2. Put it in the project-root `.env` file (beside `package.json`):\n   `OPENROUTER_API_KEY=your_key`\n   `OPENROUTER_MODEL=openrouter/free`\n3. Restart with `npm run dev`.\nThe browser calls the local `/api/wealthbot/chat` endpoint; the API key stays server-side. OpenRouter free models have availability and rate limits.\n