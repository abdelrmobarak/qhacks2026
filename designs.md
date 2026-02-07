# SaturdAI Frontend Design System (designs.md)

## Visual direction
A calm, airy interface that *feels* like a vacation through light, space, glass, and motion — without using vacation-themed copy or labels.

### Mood
- Soft gradients
- Glassy panels
- Big whitespace
- Rounded everything
- Gentle motion and “breathing” transitions
- Focus on comfort: low visual noise, high clarity

---

## Color palette (Tailwind-friendly)
Use these as CSS variables + Tailwind utilities (or a Tailwind theme extension).

- **Sand (background wash):** `#F7F1E3`
- **Ocean (primary):** `#2BB3C0`
- **Coral (accent / urgent):** `#FF6B6B`
- **Palm (success / confirmed):** `#2F8F6B`
- **Midnight (text on light):** `#0B1B2B`
- **Fog glass:** white with opacity + blur (ex: `bg-white/55`, `backdrop-blur-xl`)

**Gradient guidance**
- Background: very subtle vertical gradient overlay (white → transparent → white) so the UI feels “sunlit”
- Highlight surfaces: ocean tint at very low opacity (`bg-[rgba(43,179,192,0.08)]`)

---

## Typography
- **Headings:** `font-semibold tracking-tight`
- **Body:** `text-slate-700` / `text-slate-600`
- **Numbers / metadata:** `tabular-nums text-slate-500`
- Prefer short lines and generous line-height for a relaxed read.

---

## Shape + depth
- **Cards:** `rounded-3xl shadow-[0_12px_40px_rgba(10,30,60,0.08)]`
- **Glass:** `backdrop-blur-xl bg-white/55 border border-white/60`
- **Buttons:** `rounded-2xl` (primary), `rounded-xl` (secondary)
- Avoid harsh dividers; use spacing + subtle borders.

---

## Micro-interactions
- **Hover:** slight lift + soft glow
  - `hover:-translate-y-0.5` + a mild shadow increase
- **Voice listening:** subtle pulsing ring + waveform animation
- **Thinking:** shimmer/progress line across the voice pill
- **Done:** check ripple or minimal “confetti lite” (tiny particles, low contrast)
- Transitions: `ease-out`, `duration-200` by default, slower for large panels (`duration-300/400`)

---

# Layout (Electron desktop)

## Shell structure
- **Top bar (persistent)**
- **Left rail (icon-first)**
- **Main content**
- **Right drawer (context panel)**

### Top bar (always)
- Left: SaturdAI logo + connection/sync state (quiet indicator)
- Center: **Voice Command Bar** (primary CTA)
- Right: account avatar + Gmail/Calendar sync indicators + settings

### Left rail (icon-first)
- Inbox
- Newsletters
- Subscriptions
- To-Do
- Calendar
- Calls/Meetings (bonus)
- Agent Mode (bonus)

### Main content
Card-based dashboard + focused detail pages.

### Right drawer (context panel)
Appears when selecting an email / todo / subscription:
- TLDR / extracted fields
- suggested actions
- reply drafts
- “send / schedule / snooze / create event” controls

---

# Voice-first emphasis (core of the UI)

## Voice Command Bar (always visible)
The voice bar is the “home base” from any screen.

**Default state**
- Mic button (primary)
- Optional text input in the same pill (secondary)
- Hotkey hint: `⌘K` to focus, `Space` push-to-talk (configurable)

**States**
1. **Idle:** neutral prompt + mic CTA  
2. **Listening:** pulsing ring + live waveform + live transcript line (single line that expands)
3. **Thinking:** shimmer/progress + “reasoning” indicator (no verbose text)
4. **Ready:** shows transcript + result cards + primary action button(s)

**Controls**
- Push-to-talk and toggle-to-talk modes
- Mute mic + privacy indicator
- “Stop” / “Cancel”
- “Replay summary” (TTS) when output is a summary

## Voice Session Panel (expandable)
Clicking the voice bar expands a panel (modal-like or docked) that becomes the “chat room”.

**Panel layout**
- Top: waveform + input mode toggles (Voice/Text)
- Middle: conversation timeline (transcripts + AI responses)
- Bottom: action strip (Approve / Edit / Run / Undo)

**Conversation items**
- User transcript bubbles (with confidence indicator)
- AI responses in compact blocks with:
  - TLDR (if long)
  - expandable details
  - citations to source emails/events where relevant

## Result cards (voice outputs)
Voice should resolve into actionable UI, not walls of text.

- **ReplyDraftCard**
  - Subject + draft body preview
  - Tone chips (Short / Friendly / Professional)
  - Buttons: Edit, Send, Schedule, Save template
- **SummaryCard**
  - Key bullets
  - “Open source” link (email/thread/meeting)
  - TTS playback button
- **ActionCard**
  - Create event
  - Add todo
  - Set renewal reminder
  - Snooze email
- **PlanCard (Agent Mode)**
  - step checklist + “Run” + “Dry run” toggle

## Voice affordances everywhere
- Inline mic icons near places you’d type (reply, add task, search)
- “Reply by voice” on email detail drawer
- “Add task by voice” on To-Do page header
- Calendar: “Schedule this” voice shortcut that proposes time blocks

---

# Data layer: JSON-first (sample data mirrors API responses)

## Principle
All UI should be built against **typed JSON sample payloads** that match expected API results.  
During development, screens render from local JSON fixtures; swapping to real API calls should require minimal changes.

## Development flow
1. Create `src/data/sample/` JSON files that mirror backend responses.
2. Build UI components against these JSON objects (with TypeScript types).
3. Use a `dataSource` switch (`"sample" | "api"`) to toggle between fixtures and live calls.
4. Keep sample data updated whenever API schemas change.

## Suggested sample JSON files
- `emails.json` (Gmail list + metadata + snippets)
- `email_detail.json` (full thread + body + extracted intents)
- `newsletters.json` (newsletter summaries + extracted links)
- `subscriptions.json` (detected subscriptions/charges/renewals)
- `todos.json` (auto-generated weekly tasks + source references)
- `calendar.json` (events for week view + free/busy)
- `voice_session.json` (transcripts + AI result cards)

## Mapping: API → UI models
- Normalize raw API payloads into stable UI-facing shapes:
  - `EmailItem`, `EmailThread`, `DraftReply`
  - `NewsletterSummary`
  - `SubscriptionItem`
  - `TodoItem`
  - `CalendarEvent`
  - `VoiceTurn`, `VoiceResultCard`
- Keep raw payloads accessible for debugging, but render from normalized models.

## Example: email list sample shape (UI-facing)
```json
{
  "emails": [
    {
      "id": "msg_001",
      "fromName": "Registrar",
      "fromEmail": "registrar@school.ca",
      "subject": "Action required: document upload",
      "snippet": "Please upload the following documents by Friday...",
      "receivedAt": "2026-02-07T13:15:00-05:00",
      "labels": ["INBOX"],
      "intent": "action_required",
      "replySuggested": true,
      "confidence": 0.86
    }
  ]
}

Voice Session Sample
{
  "sessionId": "voice_101",
  "state": "ready",
  "turns": [
    {
      "role": "user",
      "mode": "voice",
      "transcript": "Summarize my newsletters and draft replies to anything urgent.",
      "timestamp": "2026-02-07T14:02:10-05:00"
    },
    {
      "role": "assistant",
      "mode": "tts",
      "tldr": "2 newsletters summarized, 1 urgent email needs a reply.",
      "cards": [
        {
          "type": "SummaryCard",
          "title": "Newsletter TLDR",
          "bullets": ["Item one...", "Item two..."],
          "sourceIds": ["nl_22"]
        },
        {
          "type": "ReplyDraftCard",
          "title": "Draft reply ready",
          "emailId": "msg_001",
          "subject": "Re: Action required: document upload",
          "bodyPreview": "Hi there, thanks for the reminder—I've attached...",
          "toneOptions": ["Short", "Friendly", "Professional"]
        }
      ],
      "timestamp": "2026-02-07T14:02:18-05:00"
    }
  ]
}
