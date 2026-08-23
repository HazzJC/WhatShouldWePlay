"use client";

import { useEffect, useRef } from "react";

export function TimezoneInput({ name = "timezone", defaultTimezone = "Europe/London" }: { name?: string; defaultTimezone?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && inputRef.current) inputRef.current.value = detected;
  }, []);

  return <input ref={inputRef} type="hidden" name={name} defaultValue={defaultTimezone} />;
}
