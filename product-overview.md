# SaturdAI — Product Overview

**Your AI-powered personal email assistant that gives you your Saturday back.**

SaturdAI is a desktop application that connects to your Gmail and Google Calendar to automate the tedious parts of email management. It reads, summarizes, and triages your inbox so you can focus on what matters — not on catching up.

---

## The Problem

People spend hours every week sifting through emails, tracking bills, remembering follow-ups, and managing their calendar. Most of this work is repetitive and low-value. SaturdAI handles it automatically.

---

## Core Features

### Smart Inbox
SaturdAI pulls your recent emails and automatically categorizes them into actionable groups: **Needs Reply**, **Informational**, **Newsletter**, **Automated**, and **Promotional**. Users can filter by category and instantly see what requires their attention.

### AI-Generated Replies
Select any email and SaturdAI drafts a context-aware reply matching the tone of the original message. Users can review, edit, and send the reply directly from the app — no need to switch to Gmail.

### Daily Email Digest (TLDR)
The dashboard surfaces an AI-generated summary of your most important recent emails. Each highlight includes the sender, a one-line gist, and whether action is needed. Skim your inbox in 30 seconds.

### Subscription & Bill Tracker
SaturdAI scans the last 90 days of email for invoices, receipts, and renewal notices. It extracts the service name, amount, billing frequency, renewal date, and status — then calculates your estimated monthly spend.

### Auto-Generated To-Do List
Action items are extracted directly from your emails: deadlines, requests, follow-ups, forms to fill, and RSVPs. Each task links back to the source email. Tasks can be checked off, edited, or regenerated on demand.

### Google Calendar Integration
SaturdAI ingests your Google Calendar schedule — pulling in events, attendees, locations, and durations — so it has full context on your commitments. You can also create new events directly from the app with support for event name, date/time, location, and description, or let the AI agent create them from natural language commands.

### Deep Research Agent
A conversational AI assistant where users can ask personalized questions about their own data — emails, calendar, subscriptions, and tasks. Type or speak natural language queries like "summarize my emails," "what subscriptions am I paying for," or "add a meeting to my calendar tomorrow at 3pm" and SaturdAI researches your accounts and executes the action end-to-end. Supports both text input and push-to-talk voice commands with live transcription.

---

## How It Works

1. **Sign in with Google** — one-click OAuth connects your Gmail and Calendar.
2. **SaturdAI reads your inbox** — emails are fetched and analyzed by AI in real time.
3. **You interact naturally** — browse the dashboard, use the sidebar pages, or talk to the agent.
4. **Actions happen instantly** — replies are sent, events are created, and tasks are tracked without leaving the app.

---

## User Experience

- **Desktop-first** — built as a native desktop app (Electron) for always-on access.
- **Voice-first design** — the AI agent supports push-to-talk voice commands with speech-to-text transcription.
- **Calm, minimal interface** — soft gradients, glassy panels, and generous whitespace designed to reduce cognitive load.
- **Sidebar navigation** — Home, Inbox, Subscriptions, To-Do, Calendar, and Agent are always one click away.

---

## Target Users

- Professionals drowning in email who want to reclaim their time.
- Students managing university correspondence, deadlines, and subscriptions.
- Anyone who wants a single dashboard for email, tasks, bills, and calendar.

---

## Key Differentiators

- **Fully automated triage** — no manual rules or filters to set up.
- **Email-to-action pipeline** — emails become tasks, replies, and calendar events automatically.
- **Voice-native interaction** — talk to your inbox instead of clicking through it.
- **Privacy-conscious** — data stays between the user's app and Google; no third-party email storage.

---

## Current Status

All core features are implemented and functional:

| Feature | Status |
|---|---|
| Google OAuth sign-in | Live |
| Email fetch & AI categorization | Live |
| TLDR email digest | Live |
| AI reply generation & sending | Live |
| Subscription & bill detection | Live |
| Auto-generated to-do list | Live |
| Calendar event creation | Live |
| Text-based AI agent | Live |
| Voice command (speech-to-text) | Live |

---

## Future Opportunities

- **Call summarizer** — transcribe and summarize phone calls.
- **Meeting summarizer** — summarize Microsoft Teams meetings and conversations.
- **Full agent mode** — multi-step autonomous workflows with plan previews and dry-run toggles.
- **Calendar week view** — visual calendar with free/busy blocks and AI-suggested scheduling.
- **Newsletter digest page** — dedicated view for newsletter summaries with extracted links.
