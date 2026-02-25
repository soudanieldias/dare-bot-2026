# DARE-BOT-2026

Advanced Discord automation bot built with **TypeScript**,
**Discord.js**, and **TypeORM**.

---

## 📁 Project Structure

    src/
    ├── @types       # Global type definitions and environment variables augmentation
    ├── application  # Core bot setup, event listeners, and client initialization
    ├── audios       # Static audio assets (mp3, wav)
    ├── commands     # Bot commands organized by category
    ├── database     # TypeORM configuration, Entities, and Migrations
    ├── interfaces   # Shared TypeScript interfaces and contracts
    ├── modules      # Domain-specific logic (e.g., Economy, Leveling)
    ├── shared       # Reusable logic and services shared across modules
    └── utils        # Helper functions, formatters, and custom loggers

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

---

### 2. Setup environment

Copy:

```bash
.env.example
```

To:

```bash
.env
```

Fill in:

- Discord Token
- PostgreSQL credentials

---

### 3. Run database migrations

```bash
npm run typeorm migration:run
```

---

### 4. Run in development

```bash
npm run dev
```

---

## 📜 Scripts

---

Script Description

---

npm run dev Starts the bot with tsx in watch mode

npm run build Compiles TypeScript to JavaScript and resolves
path aliases

npm run start Runs the compiled bot from dist/

npm run typeorm CLI for TypeORM migrations and schema sync

---

---

## 🧠 Tech Stack

- TypeScript
- Discord.js
- TypeORM
- PostgreSQL
- tsx

---

## 📄 License

MIT
