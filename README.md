# Invoices download

## Velocity fleet

Create a .env.local file in apps/velocity-fleet containing your email and your password (see .env.example)

Run 
```bash
brew install rdfind
yarn
yarn nx serve velocity-fleet
rdfind -deleteduplicates true ./invoices
```

Enjoy
