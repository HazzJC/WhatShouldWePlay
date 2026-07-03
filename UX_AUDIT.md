# UI/UX Audit

Audited 3 July 2026 across the home page, anonymous Plan creation, shared Plan and Pick workspaces, authentication/onboarding, account, persistent library, friends, groups, discovery, challenges, sharing, and administrative metadata flow. Public pages were reviewed at desktop, portrait, and mobile widths.

Each finding uses two lenses:

- **Designer teardown:** what is visually or structurally wrong.
- **First-time user:** where I became confused, lost confidence, or wanted to leave.

## Critical

### 1. Pick-first sessions still look like failed scheduling sessions

**Designer teardown:** A Pick-first workspace opens with a large scheduling hero showing duration, minimum players, availability progress, and “No good time yet.” This consumes the most visually valuable area while describing a task the user did not start. The active Pick tab cannot overcome the hero’s stronger hierarchy.

**First-time user:** I chose “Pick a game,” but the first status I see says no good time exists and asks for availability. I assume I entered the wrong flow or that Pick depends on completing Plan.

**Fix:** Give sessions an explicit origin or intent (`PLAN_FIRST` or `PICK_FIRST`). In Pick-first mode, render a compact game-focused header with library coverage, participant count, and shortlist status. Keep Plan available as a tab, but do not show scheduling health until I open it.

### 2. Pick presents the database before it presents the decision

**Designer teardown:** Steam import, connection coverage, four workspace anchors, matching controls, seven summary counters, five recommendation categories, score breakdowns, review data, shortlist management, discovery feeds, preferences, deals, friends, and group-buy tools all compete in one continuous document. Progressive disclosure exists locally but not at page level.

**First-time user:** I do not know whether to import, select players, change the player count, review existing games, add games, or read the scores. After importing hundreds of games, the page becomes longer and denser instead of making the choice easier.

**Fix:** Replace the long document with a three-stage Pick flow:

1. **Build the group:** participants and library readiness.
2. **Set tonight’s constraints:** player count, time, mode, and one score preset.
3. **Choose:** one ranked list with optional category tabs and a shortlist drawer.

Move Add Games and Tools into secondary routes or drawers. Show factor breakdown only after opening a game.

### 3. Responsive behavior fails on narrow and portrait displays

**Designer teardown:** The mobile planner visibly clips at the right edge, long copy is cut, and the fixed theme control covers page content. Portrait layouts retain dense desktop assumptions for controls and card grids. Floating UI is positioned relative to the viewport without reserving safe space.

**First-time user:** On my phone or vertical monitor I cannot trust that I am seeing the full form. Controls appear hidden underneath the theme switch, and clipped copy makes the page feel broken.

**Fix:** Treat 390 px, 768 px portrait, 900 px portrait, and 1366 px portrait as first-class layouts. Remove the permanent floating theme panel and place theme controls in a global account/menu popover. Add automated overflow assertions (`scrollWidth <= clientWidth`) and screenshot tests for every primary route.

### 4. The product has no persistent navigation model

**Designer teardown:** Every route invents its own header. Home exposes Updates, Account, Pick, and Plan; Discover exposes only Start Pick; Friends links to Account and Groups; Groups has only the logo; Library links to Account and Start Pick. Mobile hides Account entirely on the home page.

**First-time user:** I can reach features but cannot build a mental map of the product. I repeatedly use browser Back because I cannot tell where Friends, Groups, Library, Discover, and Sessions live relative to one another.

**Fix:** Introduce one responsive application shell:

- Logo/Home
- Plan
- Pick
- Discover
- Sessions
- Account menu containing Library, Friends, Groups, Settings, Updates, and Sign out

Use a compact bottom navigation on mobile for Home, Plan, Pick, Discover, and Account.

### 5. The home promise contradicts the Pick gate

**Designer teardown:** “No login needed” is the top eyebrow for the whole product, while Pick requires a formal account and username. The two primary cards appear equivalent, but one has a multi-step authentication prerequisite that is not disclosed.

**First-time user:** I choose Pick after being told no login is needed, then hit account creation. This feels like a bait-and-switch even if Plan genuinely works anonymously.

**Fix:** Scope the promise precisely: “Plan without an account.” Label Pick with “Free account required” and explain the payoff: persistent libraries, friends, and cross-device matching. If conversion is the goal, sell the value before presenting OAuth.

### 6. Core mutations lack reliable, local completion feedback

**Designer teardown:** Many controls are independent server-action forms. Saving a library game, changing ownership, updating match filters, adding a game, and changing preferences can trigger navigation or re-render without retaining visual context. Pending indicators exist inconsistently and success confirmation often appears far from the control.

**First-time user:** I click Save or Update and cannot tell whether my exact change worked, especially in a long list. If the page jumps or pauses, I click again.

**Fix:** Use optimistic local state for ownership, interest, shortlist actions, and preferences. Show inline success/error status beside the changed control, preserve scroll and open sections, disable duplicate submission, and reserve full navigation for true route changes.

## High Impact

### 7. Nearly every container has the same visual importance

**Designer teardown:** The repeated `.surface` treatment combines borders, translucent gradients, radial highlights, blur, and shadows. It is used for page sections, cards, forms, utilities, empty states, and navigation. The result is “surface soup”: everything is elevated, so nothing is.

**First-time user:** I scan boxes rather than understanding priority. I cannot immediately distinguish the main task from supporting information.

**Fix:** Establish three levels only:

- Page canvas: no container.
- Work surface: one restrained border/background, no decorative radial effect.
- Interactive card/popover: elevation used sparingly.

Remove shadows from static sections and reserve the strongest accent for the current primary action.

### 8. Typography is loud, heavy, and insufficiently hierarchical

**Designer teardown:** `font-black` appears on navigation, labels, descriptions, buttons, metrics, card titles, badges, and headings. Uppercase eyebrows with wide tracking recur everywhere. In dark mode the chunky white text creates visual noise and reduces reading rhythm.

**First-time user:** Everything sounds like it is shouting. Dense pages become tiring quickly, particularly score cards and Discovery.

**Fix:** Use black weight only for page and section headings. Use semibold for card titles and buttons, medium for labels, and regular for body copy. Reduce eyebrow usage to one per page or major workflow, and use size/spacing before weight to establish hierarchy.

### 9. Discovery shows categories that contradict the active filter

**Designer teardown:** With “I need at least 5+,” the page still displays “Best 4-player games” with “0 matches.” The default observed state was 5+, not the broadest useful starting point. Empty category cards consume equal space to useful categories.

**First-time user:** I asked for five-player games and the product recommends a four-player category containing nothing. I start doubting the catalogue and filter logic.

**Fix:** Default to 1+ or infer from an active session. Hide zero-result categories, or move them into a collapsed “No matches” section. Rename fixed-size lists when filtered, or treat “Best 4-player games” as exact-size editorial content and exclude it when the requested minimum exceeds four.

### 10. Discovery does not feel like game discovery

**Designer teardown:** The index is a grid of text-only category panels. List pages lean heavily on metadata and controls rather than covers, trailers, screenshots, prices, social proof, or editorial recommendations. The page looks like documentation for a catalogue.

**First-time user:** I came to browse games but mostly see category names and counts. There is little that makes me curious enough to open one.

**Fix:** Lead with actual games. Add a sale/trending rail with covers, price, player support, and one-sentence editorial rationale. Give category cards representative cover mosaics. On list pages, support compact and visual views and make “Why this fits” the primary copy.

### 11. Empty states expose implementation details

**Designer teardown:** Trending and Popular can say “configure IGDB credentials.” Pricing surfaces can mention API configuration or cache state. These are operator concerns presented inside consumer UI.

**First-time user:** I do not know what IGDB or ITAD is, and the message makes the product look unfinished or incorrectly deployed.

**Fix:** Translate infrastructure failures into user outcomes: “Trending games are temporarily unavailable” with Retry, Browse curated games, or Search manually. Put credential diagnostics exclusively in the restricted admin panel.

### 12. The Plan form implies steps without behaving like a stepped flow

**Designer teardown:** A sticky sidebar lists Basics, Timing, Players, and Optional details, but the items are neither navigation nor progress. On mobile this becomes a large decorative block before the first input, delaying task completion.

**First-time user:** I try to click the steps. On mobile I must scroll past a summary of the form before I can fill the form.

**Fix:** On desktop, make the steps anchor links with active-section feedback and completion checks. On mobile, replace the sidebar with a compact “Step 1 of 4” header or remove it and keep the form continuous.

### 13. Reminder controls have contradictory selection semantics

**Designer teardown:** “No reminders” is a radio button while 24 hours, 2 hours, and 15 minutes are checkboxes in the same visual group. Nothing prevents selecting No reminders alongside one or more reminders. Custom minutes is always visible.

**First-time user:** I cannot predict whether these are presets, multiple reminders, or one choice. “No reminders” appears compatible with “2 hours before.”

**Fix:** Use a clear master toggle. When enabled, show checkboxes for standard reminders and an “Add custom reminder” action. When disabled, hide all reminder timing controls.

### 14. Weekend timing controls appear enabled when they are not

**Designer teardown:** Weekend start and finish selects are always visible beneath “Use different times on weekends,” even when unchecked. Their muted/enabled relationship is not communicated.

**First-time user:** I do not know whether the weekend values will apply. I may edit them unnecessarily or assume weekends are always separate.

**Fix:** Hide the weekend fields until the checkbox is enabled, or disable and visually mute them with concise explanatory text.

### 15. Match categories duplicate games and create false volume

**Designer teardown:** A game can appear in Perfect Matches, Hidden Backlog, Old Favourites, and Sale Opportunity, each with a full score card and factor chart. Repetition makes the page longer without increasing decision quality.

**First-time user:** I keep seeing the same games and wonder whether the lists are meaningfully different. Comparing options requires remembering cards across sections.

**Fix:** Render one ranked list. Use category chips and filter tabs to change the view without duplicating cards. Keep a persistent compare tray for two to four finalists.

### 16. Score transparency is over-expanded and still hard to understand

**Designer teardown:** Factor bars, points, alignment, reasons, reviews, capability source, ownership, sale status, and category context are all shown at once. The score is technically transparent but cognitively expensive.

**First-time user:** I see why the algorithm produced a number only after reading a small report. I mainly want to know why this is better than the next game and whether anyone objects.

**Fix:** Default each result to score, alignment, ownership, player support, price, and the top two differentiating reasons. Put the full weighted breakdown in an expandable “How this score was calculated” panel. Explicitly show the delta against the next result.

### 17. The persistent library is not manageable at Steam-library scale

**Designer teardown:** The page fetches up to 100 games and renders a large multi-field form per game. Every game has a separate Save button. There is no pagination, virtualisation, multi-select, bulk status/rating action, unsaved-change indicator, or compact mode.

**First-time user:** After importing 500 games, maintaining this profile feels like work I will never finish. I cannot quickly rate favourites or clear a batch of irrelevant games.

**Fix:** Use a virtualised table/list with sticky filters, pagination or infinite loading, autosave, multi-select, and bulk actions. Add high-value queues: Recently played, Unrated favourites, Wishlist, Unknown ownership, and Needs review.

### 18. Shared-session identity and progress are too implicit

**Designer teardown:** Participant identity relies heavily on query parameters and existing linkage. The shared page does not consistently foreground “You are responding as X,” whether the response is saved, or how to switch if the wrong identity was selected.

**First-time user:** I am unsure whether I am adding my availability/library or changing someone else’s. This is especially risky when links are forwarded or reopened on another device.

**Fix:** Add a persistent identity strip near the session tabs: avatar/name, saved state, and Switch participant. Confirm identity before the first write when it is ambiguous.

### 19. Share is a fragile dropdown for a primary workflow

**Designer teardown:** The share panel is absolutely positioned inside the header, has no outside-click/Escape dismissal, and mixes copy, external apps, and a large QR code in one popover. Messenger uses a protocol link that may fail silently.

**First-time user:** Sharing is essential, but I can leave the popover open accidentally or choose an option that does nothing. On a narrow screen it competes with the floating theme control.

**Fix:** Use the native Web Share API as the primary mobile action and a modal/sheet fallback elsewhere. Lead with Copy link, show a clear copied confirmation, and move QR into its own view. Detect unsupported channels rather than presenting dead links.

### 20. Authentication is a chain of gates rather than one coherent onboarding

**Designer teardown:** Pick can route through Account, Google or Steam, username onboarding, then back to session creation. Steam is both a sign-in route and a library provider, while Google is described as the account provider. The account model may be sound, but the interface reveals its seams.

**First-time user:** I do not know whether to choose Google or Steam, whether both create accounts, or why I must set another name after signing in.

**Fix:** Present one onboarding screen:

- “Create your free Pick profile”
- Google as the recommended cross-device identity
- Steam as an alternative sign-in or a clearly separate “Connect library after sign-in”
- Username selection inline before redirecting back

Show a three-step progress indicator and preserve the intended destination visibly.

## Nice To Have

### 21. Home wastes above-the-fold space on large screens

**Designer teardown:** Vertically centering the hero creates a large dead band between navigation and content. The screenshot at 1440×1000 delays the value proposition despite ample room.

**First-time user:** The page feels sparse rather than focused, and I must visually travel a long distance from navigation to the decision.

**Fix:** Top-align the hero beneath the navigation with a controlled 48–72 px gap. Use the recovered space to reveal a small strip of real session/game results below the fold.

### 22. The home hero sells a generic game night, not the strongest product proof

**Designer teardown:** The generated tabletop image is warm but generic. The example only proves availability scheduling, leaving library comparison, matching, prices, and alignment invisible.

**First-time user:** I understand the poll, but Pick looks like a secondary feature despite being the richer differentiated product.

**Fix:** Use an interactive or composited product proof showing a real shortlist with ownership and alignment beside the best-time card. Keep imagery, but let the actual interface establish credibility.

### 23. Product terminology drifts across routes

**Designer teardown:** “Plan a game night,” “Plan a time,” “Plan time,” “Pick games,” “Pick a game,” “Start Pick,” and “Create Pick link” refer to the same two workstreams with inconsistent grammar.

**First-time user:** I pause to decide whether “Start Pick” starts voting, creates a session, or chooses a final game.

**Fix:** Standardise:

- **Plan**: create or open a scheduling workspace.
- **Pick**: create or open a game workspace.
- **Choose game**: confirm a final selection.

Use these labels everywhere.

### 24. Dark mode is over-decorated and light mode lacks a stable identity

**Designer teardown:** Multiple radial colour glows plus gradients exist on the body and again inside surfaces. Dark mode is dominated by navy panels, white heavy type, and teal/magenta accents. Light mode changes tokens but retains translucent treatments, so neither mode feels fully authored.

**First-time user:** Dark mode feels visually intense for long comparison sessions; the theme switch itself becomes one of the loudest elements on every page.

**Fix:** Use a flat neutral canvas, one restrained ambient gradient at most, opaque work surfaces, and fewer chromatic accents. Put theme selection in Account/Settings and offer one compact icon in the global shell.

### 25. Some icon and menu affordances feel improvised

**Designer teardown:** The Friends overflow menu uses text glyphs (`•••`) rather than the icon system. Some destructive actions live in native `<details>` menus with weak focus/dismissal behavior.

**First-time user:** Menus do not behave consistently with modals and popovers elsewhere.

**Fix:** Standardise on Lucide icons, one accessible Menu component, one Dialog component, and one Toast/status pattern across the app.

### 26. Date selection is too preset-driven

**Designer teardown:** Plan offers Tonight, This week, and This month but no direct custom date range in the main flow.

**First-time user:** If my group is choosing between two specific future weekends, I cannot express that without accepting a broad preset.

**Fix:** Keep presets for speed and add “Custom dates” using a compact range picker. Remember the last timezone and common time window for signed-in users.

### 27. Release notes are disconnected from in-product changes

**Designer teardown:** Updates is a separate page linked mainly from Home. New features do not have contextual “new” affordances or lightweight onboarding where they appear.

**First-time user:** I can read what changed, but the app does not help me discover or understand those changes while using them.

**Fix:** Add dismissible, contextual “New” markers for major workflow changes and link each release-note item directly to the relevant route or control.

## Recommended Order

1. Split Pick-first and Plan-first session headers.
2. Introduce the persistent responsive application shell and remove the floating theme panel.
3. Restructure Pick into Build group → Set constraints → Choose.
4. Fix mobile overflow and add automated responsive checks.
5. Make action feedback optimistic and local.
6. Simplify the visual system and typography.
7. Rebuild Discovery and Library around actual game browsing and bulk maintenance.

## Standard For Future UI Work

Before shipping a feature, verify:

- A new user can state the page’s primary action within five seconds.
- Exactly one element has primary-action emphasis per viewport.
- No internal provider, credential, cache, or database language reaches consumer UI.
- Every mutation has pending, success, failure, and retry states at the point of action.
- Every route is reachable from and can return to the persistent navigation shell.
- The page has no horizontal overflow at 390, 768, 900 portrait, 1024 landscape, and 1440 desktop widths.
- Empty states explain the next useful action, not merely the absence of data.
- Advanced controls remain hidden until the user asks for them.
