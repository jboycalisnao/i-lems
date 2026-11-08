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

### 4. Prohibit Black / Dark Accents & Dark Modal Headers
- **NO BLACK OR DARK ACCENT BARS**: Never use black or heavy dark backgrounds for modal headers, dialog titles, cards, or banners (e.g., `bg-gray-900`, `bg-gray-800`, `bg-black`, dark accent strips).
- **CLEAN LIGHT INSTITUTIONAL THEME**: All modal headers, dialog titles, and card headers must use clean, light, professional surfaces (`bg-white` or subtle `bg-gray-50`/`bg-slate-50`) with crisp subtle borders (`border-b border-gray-200`) and standard high-contrast dark text (`text-gray-900`, `text-gray-700`).
- **NO DARK INVERTED HEADER BLOCKS**: Avoid stark black or heavy dark header bands atop light modal bodies. Maintain cohesive, clean, light institutional styling throughout the interface.

### 5. Modal Layout & Vertical Positioning (Strictly Prohibit Awkward Top Gaps)
- **NO ARBITRARY TOP MARGINS (`my-8`, `my-12`, `mt-8`, `mt-12`, `mt-16`)**: Never add vertical margins (`my-8`, `mt-8`, `my-12`, etc.) to the inner modal container inside a centered flex overlay. Adding top margins pushes the modal downward, creating an awkward, unsightly dead-space gap at the top of the viewport while cramming the modal against the bottom.
- **TRUE VIEWPORT CENTERING**: Modals must be cleanly and symmetrically centered in the viewport.
  - Overlay wrapper: `fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm overflow-y-auto`
  - Inner modal card: `relative w-full max-w-... max-h-[90vh] md:max-h-[92vh] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden` (WITHOUT `my-8` or `mt-8`).
- **INTERNAL MODAL SCROLLING**: When modal content exceeds the viewport, place scrolling strictly on the modal body container (`flex-1 overflow-y-auto p-6`), keeping the header and footer pinned, rather than displacing the entire modal dialog box with top margins.
- **NO TOP-OFFSET PADDING**: Do not anchor modals to the top with arbitrary paddings (e.g., `items-start pt-16` or `pt-24`) unless explicitly instructed by the user. Modals must sit naturally and balanced in the center of the user's screen.
