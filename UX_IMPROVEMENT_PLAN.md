# UX Improvement Plan

Companion to [UX_AUDIT.md](./UX_AUDIT.md). This document converts the audit and product grilling session into an agreed product direction and phased implementation plan.

## Product Direction

### Acquisition and conversion

- **Plan is the acquisition workflow.** It remains completely usable without an account.
- **Pick is the conversion workflow.** It requires a free account because its value depends on persistent libraries, preferences, friends, and cross-device identity.
- Homepage messaging must say **“Plan without an account”**, not imply that every feature is anonymous.
- Pick entry points must disclose **“Free account required”** while explaining the benefit before authentication.
- Signed-in users automatically retain Plan workspaces in their Game nights history.

### Product model

Use a parent **Game Night** containing separate Plan and Pick workspaces.

```text
Game Night
├── Plan workspace (optional)
└── Pick workspace (optional)
```

- Creating a Game Night offers `Plan`, `Pick`, or `Both`.
- The homepage selection preselects the appropriate option; users are not sent through a second decision screen.
- `Both` opens a compact Game Night overview with two setup tasks:
  - Set up availability
  - Build game shortlist
- A missing workspace can be added later.
- Plan and Pick retain distinct states and interfaces instead of pretending to be tabs on the same session record.
- One Game Night share link opens a participant-facing overview with the status of both workspaces.
- The overview sends each participant to the next useful action rather than whichever tab was shared most recently.

### Archive and navigation

The archive is named **Game nights** and is divided into:

- Active
- Upcoming
- Past

Each item shows whether Plan, Pick, or both are configured and the completion state of each workspace.

Desktop navigation:

```text
Logo | Plan | Pick | Discover | Game nights | Account
```

Authenticated mobile navigation:

```text
Game nights | Plan | Pick | Discover | Account
```

Anonymous mobile navigation:

```text
Home | Plan | Pick | Discover | Sign in
```

The Account menu contains:

- Library
- Friends
- Groups
- Settings
- Updates
- Sign out

Theme controls move into the Account menu on desktop and Account/Settings on mobile. The existing floating theme panel is removed.

## Pick Experience

### Adaptive guided flow

Pick uses an adaptive three-stage structure:

1. **Build the group**
   - Confirm selected participants.
   - Show who has joined.
   - Show library and ownership-data readiness.
   - Provide import, invite, and manual review actions.

2. **Set tonight’s constraints**
   - Player count
   - Time available tonight
   - Online/local preference
   - Total commitment
   - One score preset

3. **Choose**
   - One ranked result list
   - Category filters rather than duplicate category sections
   - Persistent shortlist drawer
   - Optional comparison and detailed score explanations

The guided flow remains primary until at least **two selected participants have ownership data**. A `Skip to results` action remains available.

After the readiness threshold is met, returning users land on the matching dashboard with the setup stages available for editing.

### Early matching

Recommendations can appear before the readiness threshold, but they are presented as **Your early matches**.

Every early score shows its sample directly:

```text
Based on 1 of 4 player profiles
```

- Do not call an early result a Perfect Match.
- Do not imply group-wide alignment where only one profile has data.
- Results update as participants join or add ownership data.

### Ranked results

Replace repeated category sections with one ranked list.

Category controls filter that list:

- Perfect matches
- Hidden backlog
- Old favourites
- Almost ready
- Sale opportunities

A game appears once in the current view. Category membership is shown through compact chips.

Default card content:

- Game title and cover
- Match score
- Alignment
- Ownership summary
- Supported player count
- Current price where available
- Two strongest reasons
- Add to shortlist

Full weighting, source, review, and confidence data moves into **How this score was calculated**.

### Adding games

After Add is pressed:

- Remove the game from the current suggestion list immediately.
- Add it to a persistent shortlist drawer.
- Show a local success toast with Undo.
- Keep the pointer position stable for rapid additions.

Ownership and interest updates use optimistic local state with inline failure recovery.

## Plan Experience

### Creation

Plan remains a fast anonymous workflow.

- The desktop step list becomes working anchor navigation with active and completed states.
- Mobile replaces the large step summary with a compact progress header.
- The first input should appear in the initial mobile viewport.
- Add a Custom dates option alongside Tonight, This week, and This month.
- Preserve the user’s timezone and common timing defaults when signed in.

### Conditional controls

- Weekend fields are hidden until `Use different times on weekends` is enabled.
- Reminder settings use a master toggle:
  - Off: no reminder controls shown.
  - On: standard reminder checkboxes plus `Add custom reminder`.
- `No reminders` must never be selectable alongside active reminders.

### Game Night overview

When both workspaces exist, the overview shows:

- Availability response progress
- Current best time or locked time
- Pick profile readiness
- Current shortlist/final choice
- Participant completion by workspace
- Share and invite actions

Plan-only and Pick-only Game Nights show only relevant status. A Pick-first workspace must never display “No good time yet” as its primary hero.

## Discovery Experience

Discovery starts by asking for group size before showing the catalogue.

The group-size prompt should be fast:

- Presets: 2, 4, 6, 8, 10+
- Exact player-count control
- Continue without choosing

After selection:

- Hide every zero-result category.
- Lead with actual games, not text-only category descriptions.
- Show a visual trending/editorial rail.
- Show covers, supported players, mode, price, and a one-sentence reason.
- Give category cards representative game imagery.
- Preserve the selected player count while navigating lists and game pages.

Infrastructure language such as IGDB, ITAD, credentials, cache status, and API errors must never appear in consumer empty states. These diagnostics belong in admin tooling.

## Visual System

Move toward a quieter Linear/Vercel-style work interface with restrained gaming accents.

### Surfaces

Use three elevation levels:

1. **Canvas:** flat page background with no container.
2. **Work surface:** opaque background and subtle border, normally no shadow.
3. **Interactive overlay/card:** elevation reserved for clickable cards, menus, dialogs, and drawers.

Remove radial highlights from individual surfaces. Use at most one restrained ambient background treatment per page.

### Typography

- Black weight: page and major section headings only.
- Semibold: card titles and primary commands.
- Medium: form labels and navigation.
- Regular: descriptions, reasons, metadata, and long-form copy.
- Limit uppercase tracked eyebrows to one per page or major workspace.
- Use spacing and scale before font weight to establish hierarchy.

### Colour

- Coral: primary creation/commitment action.
- Teal: navigation, selection, and neutral interaction.
- Green: positive ownership/availability.
- Red: negative ownership, vetoes, and destructive actions.
- Gold: uncertainty, provisional status, and maybe.
- Neutral canvas and surfaces carry most of the interface.

All states must satisfy WCAG AA contrast; primary reading text should target AAA where practical.

## Feedback and Interaction Standards

Use optimistic updates for:

- Ownership
- Interest
- Shortlist actions
- Preference answers

Keep confirmed server operations for:

- Account deletion
- Session deletion
- Bulk imports
- Account merges
- Locking a final time

Every mutation must provide feedback at the point of action:

- Pending
- Success
- Failure
- Retry or Undo where appropriate

Preserve scroll position, selected filters, open disclosure state, and shortlist state after mutations.

Create shared primitives for:

- Toast
- Dialog
- Menu
- Drawer/sheet
- Inline save status
- Loading/progress

Replace improvised `<details>` menus and text glyph icons with these primitives and Lucide icons.

## Sharing and Identity

### Sharing

- Use the native Web Share API as the primary mobile action.
- Use a modal or bottom sheet as the fallback.
- Lead with Copy link and show an immediate copied state.
- Move QR into a dedicated view within the share sheet.
- Hide unsupported destinations rather than presenting links that silently fail.
- Share the parent Game Night link, not separate Plan and Pick links.

### Participant identity

Every shared workspace shows a persistent identity strip:

```text
Responding as Alex · Saved
```

It includes:

- Avatar/name
- Current save state
- Switch participant
- Sign-in/link-account option where relevant

When identity is ambiguous, confirm it before the first write.

## Authentication and Accounts

Create one coherent Pick onboarding flow:

1. Explain why Pick needs a profile.
2. Sign in.
3. Choose a username.
4. Return to the intended Game Night or Pick creation screen.

Google is the recommended cross-device identity.

Steam is presented as:

- An alternative account provider where supported
- Primarily the library connection used after account creation

The UI must clearly separate:

- Account identity
- Public username
- Profile name
- Steam library connection

The intended destination remains visible throughout onboarding.

## Library Experience

Rebuild the persistent library for hundreds of games:

- Paginated or virtualised compact list
- Autosave for individual fields
- Multi-select
- Bulk ownership, interest, wishlist, and favourite actions
- Sticky search and filters
- Compact and detailed views

High-value queues:

- Recently played
- Unrated favourites
- Wishlist
- Unknown ownership
- Needs review

Do not render one large form and Save button for every imported game.

## Responsive Quality Bar

Required verification widths:

- 390×844 mobile portrait
- 768×1024 tablet portrait
- 900×1440 portrait monitor
- 1024×768 landscape
- 1440×900 desktop
- 1920×1080 desktop

Automated checks must assert:

- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
- No fixed control overlaps focused inputs, dialogs, sticky actions, or navigation.
- Text remains inside its container.
- Primary actions remain visible and reachable.
- Drawers and dialogs fit the viewport and scroll internally.

## Terminology

Use consistently:

- **Game Night:** parent space containing Plan and/or Pick.
- **Plan:** scheduling workspace.
- **Pick:** game-selection workspace.
- **Choose game:** confirm the final game.
- **Game nights:** archive of active, upcoming, and past Game Nights.

Avoid:

- Plan time
- Pick games
- Start Pick
- Pick link
- Session, where Game Night is the user-facing concept

## Delivery Plan

### Phase 1: Product skeleton

Addresses audit findings 1, 4, 5, 18, 20, and 23.

- Add the Game Night parent model.
- Separate Plan and Pick workspace records or formalise their distinct state beneath Game Night.
- Add one Game Night share route and overview.
- Add Game nights archive with Active, Upcoming, and Past views.
- Build the persistent desktop and mobile navigation shell.
- Replace floating theme controls.
- Standardise terminology.
- Update authentication messaging and return-path onboarding.

**Exit criteria:** A first-time user can create Plan, Pick, or Both; share one link; and always understand which workspace they are in.

### Phase 2: Pick decision flow

Addresses audit findings 2, 6, 15, and 16.

- Build the adaptive three-stage Pick experience.
- Add readiness thresholds and Your early matches.
- Replace duplicate category sections with one filterable ranking.
- Add shortlist drawer, Undo, and optimistic ownership/interest actions.
- Collapse score detail by default.

**Exit criteria:** A first-time user can reach a credible shortlist without reading tools, API state, or full score breakdowns.

### Phase 3: Responsive and visual system

Addresses audit findings 3, 7, 8, 21, 22, 24, and 25.

- Replace the surface system and typography hierarchy.
- Implement shared menu, dialog, drawer, toast, and status primitives.
- Rebuild responsive layouts at required viewports.
- Add screenshot and horizontal-overflow tests.
- Refine the home page around the Plan acquisition promise and Pick conversion value.

**Exit criteria:** All primary routes pass responsive checks in light and dark modes with no clipping or fixed-element overlap.

### Phase 4: Plan refinement

Addresses audit findings 12, 13, 14, and 26.

- Make desktop steps interactive.
- Replace the mobile step summary.
- Add custom date ranges.
- Correct weekend and reminder conditional controls.
- Improve local pending and completion feedback.

**Exit criteria:** Anonymous users can create and share a valid Plan comfortably from a 390 px viewport.

### Phase 5: Discovery and library

Addresses audit findings 9, 10, 11, and 17.

- Add group-size-first Discovery entry.
- Hide zero-result categories.
- Lead with visual game content and editorial reasons.
- Remove infrastructure terminology.
- Rebuild Library for bulk review and autosave.

**Exit criteria:** Discovery feels useful before sign-in, and a 500-game library can be reviewed without hundreds of individual forms.

### Phase 6: Sharing and product education

Addresses audit findings 19 and 27.

- Add native share and modal/sheet fallback.
- Improve QR and channel support.
- Add contextual New markers and deep links from release notes.

**Exit criteria:** Sharing works predictably on mobile and desktop, and major new capabilities are discoverable in context.

## Decisions Still Needed

The grilling session settled the product architecture but left these implementation choices open:

1. Whether early-match alignment remains visible or is suppressed until two profiles have ownership data.
2. Whether a Game Night with Both workspaces requires completing one setup task before sharing.
3. Whether group-size selection in Discovery is a modal, full-width first step, or compact inline gate.
4. Whether the Game nights archive includes deleted/archived items and restoration.
5. Whether Library bulk editing ships with pagination first or full virtualisation.
6. Whether the responsive application shell appears on shared anonymous Game Night pages or uses a reduced guest shell.

These should be resolved before Phase 1 implementation begins.

