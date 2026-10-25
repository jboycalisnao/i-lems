# Agent Directives & UI Rules

## UI Design & Aesthetic Constraints

### 1. Strictly Prohibit AI Slop Pill Badges & Flashing Light Indicators (GLOBAL RULE)
- **NO FLASHING LIGHTS OR PINGING PILLS**: Never add flashing light indicators, blinking dots, pinging dots, or pulsating light pills (`animate-ping`, `animate-pulse`, `rounded-full bg-emerald-500`, floating green dots on icons, cards, or hero elements). Treat all flashing lights, blinking dots, and radar-style pings as strictly prohibited AI slop.
- **NO DECORATIVE STATUS PILLS**: Never add floating rounded pills, rounded-full status badges (e.g., `rounded-full`, chip tags like "RFID & Barcode Ready", "Auto Wedge", "Active Status", etc.) into headers, banners, cards, or modal titles unless the user explicitly instructs you to do so.
- **NO PULSING STATUS DOTS**: Do not insert blinking or pulsing colored indicator dots (`animate-pulse`, `animate-ping`, `w-2 h-2 rounded-full bg-emerald-500`) to represent hardware or system readiness.
- **TREAT AS AI SLOP**: Superfluous status badges, pill chips, floating micro-badges, flashing lights, and decorative hardware status tags are AI slop. Interfaces must remain clean, purposeful, and professional.
- **CLEAN INSTITUTIONAL TYPOGRAPHY**: Use standard, readable text with clean labels and subtle borders rather than wrapping status information in rounded colored pills or flashing dots.

### 2. No Background Gradients
- Do not use gradients (`bg-gradient-to-...`). Use clean solid background colors and crisp borders.

### 3. Clean and Uncluttered Visual Hierarchy
- Avoid cluttering headers, cards, and modal dialogs with arbitrary chips, pills, or secondary indicator widgets.
- Every visual element must serve an explicit, functional purpose.
