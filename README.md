# StudyMentor - AI-Powered Learning Platform

StudyMentor is a comprehensive, premium AI-powered educational assistant designed to enhance the student learning experience. It combines interactive AI counseling, visual progress tracking, custom quizzes, and a public-accessible "Data Vault" for study resource sharing.

---

## 📂 Project Structure

All project implementation files reside within the `educational` directory:

```text
educational/ (Repository Root)
├── README.md               # Project documentation (outside educational)
└── educational/            # Core project directory
    ├── package.json        # Main orchestration scripts (concurrent dev/install)
    ├── TODO.md             # Development tracking
    ├── backend/            # Express.js + Supabase + LLM server
    │   ├── server.js
    │   └── package.json
    └── frontend/           # React + Vite + TypeScript + Tailwind CSS UI
        ├── src/
        │   ├── components/ # Auth, Chat, Dashboard, Data Vault, Quizzes, Robot, etc.
        │   ├── lib/        # API clients (Supabase, Groq, OpenRouter)
        │   └── main.tsx
        └── package.json
```

---

## ✨ Key Features

- 🤖 **Interactive Robot Companion**: An animated virtual mentor providing interactive guidance, animations, and micro-interactions.
- 💬 **AI Counselor Chat**: Real-time AI counseling using Groq and OpenRouter LLM API endpoints to assist students with their academic and personal doubts.
- 📁 **Data Vault**: A decoupled resource repository allowing any student to instantly browse, view, and download study files, with secure upload features for authenticated users.
- 📝 **Dynamic Quizzes**: Interactive quiz interface that evaluates students on custom subjects and records their results.
- 📊 **Progress Dashboard**: Detailed analytics visualizing subject readiness, quiz performance, and progression metrics.
- 🔒 **Secure Auth & Profiles**: Integrated user sign-in and personalized profiles synced with a Supabase database.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation & Run

You can run both the frontend and backend concurrently using the root orchestration scripts located inside the `educational` folder:

1. **Navigate to the core project directory**:
   ```bash
   cd educational
   ```

2. **Install all dependencies**:
   ```bash
   npm run install:all
   ```

3. **Start the development servers**:
   ```bash
   npm run dev
   ```
   - Frontend will run on `http://localhost:5173`
   - Backend API will run on `http://localhost:5000`
