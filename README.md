
  # Budget vs Spend

  This is a code bundle for Budget vs Spend. The original project is available at https://www.figma.com/design/97EZAmIfI40cz3RVLSH1tw/Budget-vs-Spend.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## External review build

The review build preserves this Make-export UI and binds it to the registered
P2P-Simulation backend (`snlklhpebjlrebkqsxyi`). The retired Make project is
not used by Vite.

Vercel must supply `VITE_SUPABASE_ANON_KEY` through its existing provider-managed
configuration. The project ID is fixed in source; the old `VITE_SUPABASE_URL`
setting cannot redirect this review build to the retired backend. Only the project's browser-safe anon
JWT is supported by the current JWT-verified Edge Function. The client rejects
missing configuration, another project, and privileged keys. No key values
belong in source, logs, or deployment evidence.

Build with `npm run build`; output is `dist`. Validate the browser connection,
filters, pivots, drilling, and refresh before promoting the custom review host.
The existing BVS deployment remains the rollback baseline.
