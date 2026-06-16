\# Let’s Play Games: Product Considerations and Ease-of-Use Blueprint



\## 1. Product purpose



Let’s Play Games should help a group answer three questions quickly:



1\. When can we play?

2\. What can we all play?

3\. Should we buy something together?



The most important design principle is that the app should be useful before anyone creates an account. The no-login session planner should be the easiest entry point, with Steam login, library matching, Discord, sale alerts, and recommendations layered on afterwards.



\---



\## 2. Recommended product structure



The app should be organised around gaming sessions, not around libraries.



\### Main sections



\*\*Plan\*\*

Create a gaming session, invite friends, collect availability, suggest the best time.



\*\*Pick\*\*

Find games the group owns, games most people own, games that match the player count, and games nobody has played much.



\*\*Buy\*\*

Suggest games the whole group could buy based on budget, genre, player count, discount, and popularity.



\*\*Remind\*\*

Send calendar invites, Discord pings, and email reminders.



\*\*Discover\*\*

Find trending co-op games, local co-op games, online co-op games, large group games, and upcoming “friend-slop” games.



\---



\## 3. Feature breakdown



\## 3.1 No-login gaming session planner



This should be the core viral feature.



The host creates a session by choosing:



\* Session name

\* Online or in-person

\* Required duration

\* Number of players needed

\* Date range

\* Timezone

\* Optional Discord server/channel

\* Reminder preferences



The app creates a shareable link.



Guests should not need to sign up. They enter a name and mark availability.



Availability options should be simple:



\* Available

\* Maybe

\* Unavailable



The app should then suggest the best times automatically.



Example:



> Best time: Friday 7-9pm

> 6 of 7 people available

> 1 maybe



At completion, the host can:



\* Lock the session time

\* Export to Google Calendar, Outlook, or Apple Calendar

\* Download an ICS file

\* Post to Discord

\* Send reminders



This feature is likely the best MVP because it is useful immediately and highly shareable.



\---



\## 3.2 Steam login and library import



Users can connect Steam to import:



\* Owned games

\* Playtime

\* Recently played indicators where available

\* Steam App IDs



Steam supports OpenID login, and the Steam Web API includes `GetOwnedGames` for retrieving owned games and playtime where the user’s profile allows it.

Important consideration:



Some Steam profiles or game details may be private. The app should handle this gracefully.



Use friendly messaging:



> We could not import your full library. You can still add games manually.



\---



\## 3.3 Non-Steam game support



Use a dedicated game database rather than trying to manually maintain everything.



IGDB is a strong candidate because it provides game metadata, popularity signals, genres, platforms, game modes, and trend indicators through PopScore.



Users should be able to add non-Steam games quickly:



\* Search by title

\* Pick from popular games

\* Pick from trending games

\* Pick from “games your friends added”

\* Pick from common multiplayer games



Examples:



\* Minecraft

\* League of Legends

\* Valorant

\* Fortnite

\* Roblox

\* World of Warcraft

\* Final Fantasy XIV

\* Game Pass games

\* Epic Games Store games



The app should treat Steam and non-Steam games as the same internal `Game` object.



\---



\## 3.4 Friend and group matching



Users should be able to select friends and generate a shared game shortlist.



The app should show:



\* Everyone owns this

\* Most people own this

\* Only one person missing

\* Supports selected player count

\* Online co-op

\* Local co-op

\* Played heavily by the group

\* Barely played by the group

\* On sale for missing players



Useful result categories:



\### Perfect matches



Everyone owns the game and it supports the session size.



\### Hidden backlog



Everyone owns it, but nobody has played much.



\### Old favourites



Everyone owns it, and the group has high total playtime.



\### Almost ready



Most people own it, and missing players can buy it.



\### Sale opportunity



A missing-player game is currently discounted.



\---



\## 3.5 Match score and alignment score



The scoring system should be transparent and adjustable.



Each game can receive a score out of 100.



Suggested scoring factors:



\* Ownership fit

\* Player-count fit

\* Genre fit

\* Availability fit

\* Playtime fit

\* Time since last played

\* User interest

\* Sale price

\* Popularity

\* Newness or freshness

\* Local or online co-op fit



Example:



```txt

Game: Deep Rock Galactic

Group match: 91

Alignment: High

Reason: 5/5 own it, supports 5 players, everyone likes co-op shooters, low recent playtime

```



A key design point: \*\*average score is not enough\*\*.



You should also show alignment.



Example:



```txt

Average score: 82

Alignment: Low

Reason: One player strongly dislikes this genre

```



This prevents the app recommending a game that most people like but one person really does not want to play.



\---



\## 3.6 User preference questionnaire



Keep this very short.



Ask users to weight what matters to them:



\* I want to play something familiar vs something new

\* I prefer co-op vs competitive

\* I care about price

\* I care about genre

\* I care about playing games I already own

\* I care about clearing my backlog

\* I care about short sessions vs long campaigns

\* I prefer chill games vs intense games



Do not make this mandatory. Let people skip it.



The best version is progressive:



\* First visit: ask nothing

\* First match: ask one or two quick questions

\* Later: allow deeper preferences



\---



\## 3.7 Steam sales and price alerts



Use a price tracking API rather than scraping stores.



IsThereAnyDeal provides programmatic access to deal and price data, including price-related endpoints.



Useful sale features:



\* Alert me when this game is under £10

\* Alert the group when this game is on sale

\* Alert missing players only

\* Alert when a game reaches historical low

\* Alert when a 5/7 owned game is discounted



Example:



> 5 of 7 players own Valheim.

> The remaining 2 can buy it for £7.99.

> This is close to its historical low.



\---



\## 3.8 “All buy a new game” mode



This is one of the strongest differentiators.



The host selects:



\* Budget per person

\* Genre

\* Player count

\* Local or online

\* Session length

\* Platform

\* Avoid already-owned games

\* Include sale-only games



The app suggests:



\* Best overall group buy

\* Cheapest good option

\* Best long-term game

\* Best one-night game

\* Best new or trending option



Example:



```txt

Budget: £15

Players: 6

Genre: co-op survival

Mode: online



Recommendation:

Game A

£11.99

6-player online co-op

Strong group fit

Currently discounted

```



\---



\## 3.9 Curated discovery



Curated lists should be browsable without needing an account.



Useful lists:



\* Best online co-op games

\* Best local co-op games

\* Best 4-player games

\* Best 6+ player games

\* Best party games

\* Best campaign co-op games

\* Best survival games for groups

\* Best cheap co-op games

\* Trending multiplayer games

\* Upcoming friend-slop games



This can bring in search traffic and help users before they connect Steam.



\---



\## 3.10 Discord integration



Discord could become a major part of the app.



Useful bot features:



\* Create session from Discord

\* Share availability link

\* Ping users to fill availability

\* Announce confirmed time

\* Ask users to confirm attendance

\* Send reminders

\* Suggest games

\* Post sale alerts



Example bot flow:



```txt

/letsplay create

Game night: Friday/Saturday options

Duration: 2 hours

Players: 4-6

```



Bot replies:



```txt

Fill in your availability here:

\[link]



Current best time:

Saturday 8pm

5 of 6 available

```



Reminder settings should be clear:



\* No reminders

\* 24 hours before

\* 2 hours before

\* 15 minutes before

\* Custom



\---



\## 4. Ease-of-use principles



\## 4.1 Make the first action tiny



Do not start with:



> Create an account.



Start with:



> Plan a game night.



The user should be able to create a session in under one minute.



\---



\## 4.2 Progressive account creation



Let people use the planner without login.



Only ask them to sign up when there is a clear benefit:



\* Save this group

\* Connect Steam

\* Get game recommendations

\* Receive sale alerts

\* Add to calendar

\* Use Discord reminders



\---



\## 4.3 Use plain language



Avoid technical labels.



Use:



\* “Everyone owns this”

\* “One person missing”

\* “Good for 6 players”

\* “Barely played”

\* “On sale now”

\* “Best time to play”



Avoid:



\* “Ownership matrix”

\* “Weighted recommendation model”

\* “Availability optimisation”

\* “Preference vector”



\---



\## 4.4 Explain recommendations



Every recommendation should answer “why?”



Example:



```txt

Why this game?

Everyone owns it.

It supports 5 players.

Nobody has played it recently.

Three people marked survival games as a favourite.

```



This will build trust in the scoring system.



\---



\## 4.5 Reduce typing



Use buttons, chips, and defaults.



Examples:



\* Tonight

\* This weekend

\* Next week

\* 1 hour

\* 2 hours

\* 4 players

\* Online

\* Local co-op

\* Under £10

\* Everyone owns it

\* On sale



\---



\## 4.6 Make sharing obvious



Every session should have:



\* Copy link

\* Share to Discord

\* Share to WhatsApp

\* Share to Messenger

\* Share by email

\* QR code for in-person groups



\---



\## 4.7 Make empty states useful



If no one has connected Steam:



> You can still plan a time. Connect Steam later to find games everyone owns.



If only some people have connected Steam:



> 3 of 6 libraries connected. Recommendations will improve as more people connect.



If no perfect matches exist:



> No game is owned by everyone, but these are close.



\---



\## 5. Suggested build phases



\## Phase 1: No-login planner



Build:



\* Create session

\* Share link

\* Availability grid

\* Best-time suggestion

\* Lock session

\* ICS calendar export



Goal:



Prove people will use it to organise gaming sessions.



\---



\## Phase 2: Accounts and saved groups



Build:



\* Optional login

\* Save groups

\* Reuse previous participants

\* Email reminders

\* Basic calendar integrations



Goal:



Turn one-off planners into repeat users.



\---



\## Phase 3: Steam and game libraries



Build:



\* Steam login

\* Library import

\* Manual game add

\* Game ownership matching

\* Player-count filter



Goal:



Answer “what can we all play?”



\---



\## Phase 4: Recommendation engine



Build:



\* Match score

\* Alignment score

\* User preference questionnaire

\* Genre/playtime/freshness weighting

\* Explanation cards



Goal:



Make recommendations feel smart and trustworthy.



\---



\## Phase 5: Sales and buying together



Build:



\* Price tracking

\* Sale alerts

\* Missing-owner recommendations

\* All-buy-a-new-game flow

\* Budget and genre filters



Goal:



Help groups fill game-library gaps at the right time.



\---



\## Phase 6: Discord and discovery



Build:



\* Discord bot

\* Discord reminders

\* Confirmation pings

\* Curated co-op lists

\* Trending/upcoming multiplayer games



Goal:



Make the product part of how gaming groups already communicate.



\---



\## 6. Technical architecture



Suggested stack:



```txt

Frontend:

Next.js, React, Tailwind



Backend:

Next.js API routes or NestJS



Database:

Postgres



Auth:

Email magic link plus Steam OpenID



Game metadata:

IGDB



Steam ownership:

Steam Web API



Price tracking:

IsThereAnyDeal



Calendar:

ICS first, Google/Outlook later



Discord:

Discord bot and slash commands



Jobs:

Background worker for imports, alerts, reminders



Email:

Postmark, Resend, or SendGrid

```



\---



\## 7. Core data model



```txt

User

\- id

\- display\_name

\- email

\- steam\_id

\- timezone

\- notification\_preferences



Game

\- id

\- title

\- steam\_app\_id

\- igdb\_id

\- platforms

\- genres

\- player\_count\_min

\- player\_count\_max

\- supports\_online\_coop

\- supports\_local\_coop

\- cover\_url



UserGame

\- user\_id

\- game\_id

\- source

\- owned

\- playtime\_minutes

\- last\_played\_at

\- manually\_added

\- interest\_level



Group

\- id

\- name

\- owner\_user\_id



GroupMember

\- group\_id

\- user\_id

\- display\_name

\- role



Session

\- id

\- host\_user\_id

\- group\_id

\- title

\- online\_or\_in\_person

\- required\_duration

\- required\_player\_count

\- locked\_start\_time

\- locked\_end\_time

\- timezone



AvailabilityResponse

\- session\_id

\- participant\_name

\- user\_id

\- starts\_at

\- ends\_at

\- status



GameRecommendation

\- session\_id

\- game\_id

\- match\_score

\- alignment\_score

\- explanation



PriceAlert

\- user\_id

\- game\_id

\- target\_price

\- alert\_type

\- active

```



\---



\## 8. Main risks



\### Steam privacy



Some libraries may not import fully. Manual add must be easy.



\### Game metadata messiness



Different stores may use different names and IDs. You need a strong internal game-matching layer.



\### Recommendation trust



Users need clear explanations, not just scores.



\### Too much onboarding



The app should not require everyone to sign up before it becomes useful.



\### Discord complexity



Start with basic Discord sharing before building a full bot.



\### Calendar complexity



Start with ICS export before deeper Google/Outlook integrations.



\---



\## 9. Best MVP



The best first version is:



```txt

Create a game night

Share a no-login availability link

Find the best time

Lock the time

Export calendar invite

```



Then add:



```txt

Connect Steam to see what everyone can play

```



This order gives you the lowest-friction product and the best chance of people sharing it.



\---



\## 10. Product positioning



Possible tagline:



> Find the time, pick the game, get everyone in.



Alternative:



> The easiest way to organise game night.



Best positioning:



Let’s Play Games is not just a Steam library comparer. It is a session planner for friend groups, with game recommendations, sale alerts, and Discord reminders built in.

