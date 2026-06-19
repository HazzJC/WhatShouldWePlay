"use client";

import { useState } from "react";

export function PlayerCountFilter({ minimumPlayers, action }: { minimumPlayers: number; action: string }) {
  const [value, setValue] = useState(minimumPlayers);
  const label = `${value}+`;

  return (
    <form action={action} className="mt-4 rounded-lg border border-ink/10 bg-paper p-3">
      <label className="grid gap-3 sm:grid-cols-[8rem_1fr_4.5rem_auto] sm:items-center">
        <span className="text-sm font-black text-ink">I need at least:</span>
        <input
          name="minPlayers"
          type="range"
          min={1}
          max={50}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.currentTarget.value))}
          className="w-full accent-teal"
          aria-valuetext={label}
        />
        <output className="rounded-md bg-white px-3 py-2 text-center text-sm font-black text-ink">{label}</output>
        <button className="secondary-button" type="submit">Apply</button>
      </label>
    </form>
  );
}
