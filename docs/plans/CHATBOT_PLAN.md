# Chatbot Feature Implementation Plan

## Overview

Gumawa ng chatbot para sa Team Leader na pwedeng mag-request ng summary report. Ang chatbot ay magbibigay ng link papunta sa AI Insights page (`/team/ai-insights`).

---

## Current State Analysis

### Existing Features
- **AI Summary Generation** - Meron nang endpoint: `POST /analytics/team/:teamId/ai-summary`
- **AI Insights History Page** - Existing na sa `/team/ai-insights`
- **AISummaryCard Component** - Reusable component para ipakita ang AI summaries
- **OpenAI Integration** - Backend na may OpenAI SDK setup

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router, TanStack React Query, Tailwind CSS |
| State | Zustand |
| Backend | Hono Framework |
| Database | PostgreSQL + Prisma ORM |
| AI | OpenAI SDK |

---

## Proposed Solution

### Option A: Simple Floating Chatbot (Recommended)

Isang floating chat widget na:
1. Naka-position sa lower-right corner ng screen
2. Team Leaders lang ang makakakita (role-based)
3. Pwedeng mag-type ng request tulad ng "generate summary" o "show report"
4. Chatbot will respond with:
   - Generated AI summary preview
   - Clickable link to `/team/ai-insights`

**Pros:**
- Simple at mabilis i-implement
- Hindi kailangan ng WebSocket (polling or on-demand lang)
- Gamitin ang existing AI endpoints

**Cons:**
- Limited lang sa pre-defined commands

### Option B: Full Conversational AI Chatbot

Isang advanced chatbot na:
1. May natural language understanding
2. Pwedeng mag-ask ng follow-up questions
3. May conversation history
4. Real-time responses via WebSocket

**Pros:**
- More interactive at natural
- Pwedeng i-extend para sa ibang features

**Cons:**
- Mas complex i-implement
- Kailangan ng additional database models
- Higher API costs (more OpenAI calls)

---

## Recommended Implementation: Option A (Simple Floating Chatbot)

### Phase 1: Backend Endpoints

#### 1.1 New Chatbot Module
Location: `backend/src/modules/chatbot/`

```
backend/src/modules/chatbot/
├── index.ts          # Routes
├── handlers.ts       # Request handlers
└── commands.ts       # Command definitions
```

#### 1.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chatbot/message` | Process user message and return response |
| GET | `/chatbot/suggestions` | Get suggested commands |

#### 1.3 Supported Commands
```javascript
const COMMANDS = {
  "generate summary": "Generate new AI summary for your team",
  "show report": "Show link to latest AI insights",
  "team status": "Quick overview of team status",
  "help": "Show available commands"
}
```

### Phase 2: Frontend Components

#### 2.1 New Components
Location: `frontend/src/components/chatbot/`

```
frontend/src/components/chatbot/
├── ChatbotWidget.tsx       # Main floating widget
├── ChatbotButton.tsx       # Toggle button
├── ChatbotWindow.tsx       # Chat window container
├── ChatMessage.tsx         # Individual message bubble
├── ChatInput.tsx           # Message input field
└── SuggestionChips.tsx     # Quick action chips
```

#### 2.2 Component Hierarchy
```
<ChatbotWidget>
  <ChatbotButton />           # Floating button to open/close
  <ChatbotWindow>             # The chat window (shown when open)
    <ChatHeader />            # Title + close button
    <ChatMessages>            # Message list
      <ChatMessage />         # Individual messages
    </ChatMessages>
    <SuggestionChips />       # Quick actions
    <ChatInput />             # Input field
  </ChatbotWindow>
</ChatbotWidget>
```

### Phase 3: Services & State

#### 3.1 Chatbot Service
Location: `frontend/src/services/chatbot.service.ts`

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  links?: { label: string; url: string }[];
}

interface ChatbotService {
  sendMessage(message: string): Promise<ChatResponse>;
  getSuggestions(): Promise<string[]>;
}
```

#### 3.2 Local State (Component State)
- `messages: ChatMessage[]`
- `isOpen: boolean`
- `isLoading: boolean`

### Phase 4: Integration Points

#### 4.1 Add to AppLayout
```tsx
// In AppLayout.tsx
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';

// Only show for Team Leaders
{user?.role === 'TEAM_LEAD' && <ChatbotWidget />}
```

#### 4.2 Link Generation
Kapag nag-request ng summary:
1. Call existing endpoint: `POST /analytics/team/:teamId/ai-summary`
2. Get the generated summary ID
3. Return link: `/team/ai-insights?summaryId={id}`

---

## UI/UX Design

### Chatbot Button (Collapsed)
```
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│                         ┌─────┐ │
│                         │ 💬  │ │  <- Floating button
│                         └─────┘ │
└─────────────────────────────────┘
```

### Chatbot Window (Expanded)
```
┌─────────────────────────────────┐
│                     ┌──────────┐│
│                     │ AI Bot  X││
│                     ├──────────┤│
│                     │ Hi! How  ││
│                     │ can I    ││
│                     │ help?    ││
│                     │          ││
│                     │ [User]   ││
│                     │ Generate ││
│                     │ summary  ││
│                     │          ││
│                     │ [Bot]    ││
│                     │ Done! 📊 ││
│                     │ [View]   ││
│                     ├──────────┤│
│                     │[Quick]   ││
│                     │[Actions] ││
│                     ├──────────┤│
│                     │Type...   ││
│                     └──────────┘│
└─────────────────────────────────┘
```

### Color Scheme (Based on existing design)
- Primary: `#6366f1` (Indigo)
- Bot messages: `bg-gray-100`
- User messages: `bg-primary-500 text-white`
- Links: `text-primary-600 hover:underline`

---

## Sample Conversation Flow

```
[Bot] 👋 Kumusta! Ako ang iyong AI Assistant.
      Ano ang maitutulong ko sa iyo ngayon?

      [Generate Summary] [View Reports] [Team Status]

[User] Generate Summary

[Bot] 🔄 Generating AI summary for your team...

[Bot] ✅ Natapos na ang summary!

      📊 Team Status: HEALTHY
      ━━━━━━━━━━━━━━━━━━━━━
      Highlights:
      • 95% check-in rate this week
      • Improved team wellness scores

      Concerns:
      • 2 members showing fatigue signs

      [📄 View Full Report]  <- Links to /team/ai-insights?id=xxx

[User] Team Status

[Bot] 📈 Quick Team Overview:

      Members: 8
      Check-in Today: 6/8 (75%)
      Active Incidents: 2
      Wellness Score: 7.5/10

      [View Full Analytics]
```

---

## Implementation Steps (Task List)

### Backend Tasks
- [ ] Create `backend/src/modules/chatbot/` folder structure
- [ ] Implement `POST /chatbot/message` endpoint
- [ ] Implement `GET /chatbot/suggestions` endpoint
- [ ] Add command parsing logic
- [ ] Integrate with existing AI summary generation
- [ ] Register routes in `routes.ts`

### Frontend Tasks
- [ ] Create `frontend/src/components/chatbot/` folder structure
- [ ] Build `ChatbotButton.tsx` component
- [ ] Build `ChatbotWindow.tsx` component
- [ ] Build `ChatMessage.tsx` component
- [ ] Build `ChatInput.tsx` component
- [ ] Build `SuggestionChips.tsx` component
- [ ] Create `ChatbotWidget.tsx` (main container)
- [ ] Create `chatbot.service.ts`
- [ ] Add types in `frontend/src/types/chatbot.ts`
- [ ] Integrate into `AppLayout.tsx`
- [ ] Add role-based visibility (Team Lead only)

### Testing Tasks
- [ ] Test chatbot commands
- [ ] Test AI summary generation integration
- [ ] Test link navigation to `/team/ai-insights`
- [ ] Test responsive design
- [ ] Test role-based access

---

## Files to Create/Modify

### New Files
```
backend/src/modules/chatbot/
├── index.ts
├── handlers.ts
└── commands.ts

frontend/src/components/chatbot/
├── ChatbotWidget.tsx
├── ChatbotButton.tsx
├── ChatbotWindow.tsx
├── ChatMessage.tsx
├── ChatInput.tsx
└── SuggestionChips.tsx

frontend/src/services/chatbot.service.ts
frontend/src/types/chatbot.ts
```

### Modified Files
```
backend/src/routes.ts          # Register chatbot routes
frontend/src/layouts/AppLayout.tsx   # Add ChatbotWidget
```

---

## Future Enhancements (Nice to Have)

1. **Conversation History** - Save past conversations sa database
2. **Natural Language Processing** - Mas natural na conversation gamit ang OpenAI
3. **More Commands** - Incident creation, leave requests, etc.
4. **Real-time Updates** - WebSocket para sa instant responses
5. **Notifications** - Proactive alerts from the chatbot
6. **Voice Input** - Speech-to-text capability
7. **Multi-language** - Tagalog/English support

---

## Questions/Clarifications Needed

1. **Scope:** Dapat ba accessible ang chatbot sa lahat ng pages o sa team pages lang?
2. **Commands:** Ano pang ibang commands ang gusto mo i-support?
3. **Design:** May specific design preference ka ba para sa chatbot UI?
4. **History:** Kailangan ba i-save ang conversation history?
5. **OpenAI:** Gusto mo bang gumamit ng OpenAI para sa natural language o predefined commands lang?

---

## Approval Checklist

- [ ] Option A (Simple) or Option B (Full Conversational)?
- [ ] Approved UI/UX design?
- [ ] Confirmed file structure?
- [ ] Clarified scope and commands?
- [ ] Ready to start implementation?

---

*Created: 2026-01-03*
*Status: PENDING APPROVAL*
