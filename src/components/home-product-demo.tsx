import { CalendarCheck2, Check, Clock3, Gamepad2, LibraryBig, UsersRound } from "lucide-react";

const people = [
  { initials: "AM", name: "Amir", tone: "coral" },
  { initials: "JO", name: "Jo", tone: "purple" },
  { initials: "SK", name: "Suki", tone: "teal" },
  { initials: "RB", name: "Rob", tone: "gold" },
] as const;

const times = [
  { day: "Thu", time: "20:00", states: [1, 1, 0, 1], count: "3 free", winner: false },
  { day: "Fri", time: "19:00", states: [1, 1, 1, 1], count: "Everyone", winner: true },
  { day: "Sat", time: "21:00", states: [1, 0, 1, 0], count: "2 free", winner: false },
] as const;

const matches = [
  { rank: "1", title: "Deep Rock Galactic", detail: "4 of 4 own it on PC · Fits 4", note: "42 minutes played across the group", tone: "teal", winner: true },
  { rank: "2", title: "Lethal Company", detail: "3 of 4 own it on PC · Fits 4", note: "One person needs a copy", tone: "purple", winner: false },
  { rank: "3", title: "Overcooked! 2", detail: "4 of 4 own it on PC · Fits 4", note: "68 hours played across the group", tone: "coral", winner: false },
] as const;

export function HomeProductDemo() {
  return (
    <section className="product-demo" aria-label="Example showing four friends choosing Friday at 7pm and matching their game libraries">
      <div className="product-demo-glow" />
      <header className="product-demo-header">
        <div><p className="product-demo-kicker">Example game night</p><h2>Friday crew</h2></div>
        <div className="demo-people" aria-label="Four people in the group">
          {people.map((person, index) => (
            <span key={person.name} className={`demo-avatar demo-avatar-${person.tone}`} style={{ "--avatar-delay": `${index * 160}ms` } as React.CSSProperties} title={person.name}>
              {person.initials}<i><Check className="h-2.5 w-2.5" /></i>
            </span>
          ))}
        </div>
      </header>

      <div className="product-demo-flow" aria-hidden="true">
        <span className="is-done"><Check className="h-3 w-3" /> Availability</span><i />
        <span className="is-live"><LibraryBig className="h-3 w-3" /> Libraries</span><i />
        <span><Gamepad2 className="h-3 w-3" /> Pick</span>
      </div>

      <div className="product-demo-grid">
        <section className="demo-panel demo-availability" aria-labelledby="demo-time-title">
          <div className="demo-panel-heading">
            <span className="demo-panel-icon"><CalendarCheck2 className="h-4 w-4" /></span>
            <div><p>Availability</p><h3 id="demo-time-title">When can everyone make it?</h3></div>
          </div>
          <div className="demo-time-list">
            {times.map((slot, slotIndex) => (
              <div key={`${slot.day}-${slot.time}`} className={`demo-time ${slot.winner ? "is-winner" : ""}`}>
                <div className="demo-time-label"><strong>{slot.day}</strong><span>{slot.time}</span></div>
                <div className="demo-time-votes">
                  {slot.states.map((available, personIndex) => (
                    <span key={`${slotIndex}-${personIndex}`} className={available ? "is-free" : ""} style={{ "--vote-delay": `${800 + slotIndex * 180 + personIndex * 90}ms` } as React.CSSProperties}>
                      {available ? <Check className="h-3 w-3" /> : null}
                    </span>
                  ))}
                </div>
                <span className="demo-time-count">{slot.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="demo-panel demo-matches" aria-labelledby="demo-match-title">
          <div className="demo-panel-heading">
            <span className="demo-panel-icon is-purple"><UsersRound className="h-4 w-4" /></span>
            <div><p>Library match</p><h3 id="demo-match-title">What works for these four?</h3></div>
          </div>
          <div className="demo-match-list">
            {matches.map((match, index) => (
              <div key={match.title} className={`demo-match demo-match-${match.tone} ${match.winner ? "is-winner" : ""}`} style={{ "--match-delay": `${1900 + index * 180}ms` } as React.CSSProperties}>
                <span className="demo-match-rank">{match.rank}</span>
                <span className="demo-game-art" aria-hidden="true"><Gamepad2 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><strong>{match.title}</strong><small>{match.detail}</small><em>{match.note}</em></span>
                {match.winner ? <span className="demo-best">Best fit</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="demo-result">
        <span className="demo-result-icon"><Check className="h-5 w-5" /></span>
        <span><small>Plan ready to share</small><strong>Friday at 19:00 · Deep Rock Galactic</strong></span>
        <span className="demo-result-time"><Clock3 className="h-3.5 w-3.5" /> 4 players</span>
      </footer>
    </section>
  );
}
