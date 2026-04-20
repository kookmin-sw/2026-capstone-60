import { useEffect, useMemo, useState } from "react";

export function toClock(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function useCountdown(initialSeconds, isActive, onFinish) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive || secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isActive, secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && onFinish) {
      onFinish();
    }
  }, [secondsLeft, onFinish]);

  const formatted = useMemo(() => toClock(Math.max(0, secondsLeft)), [secondsLeft]);

  const reset = (nextSeconds = initialSeconds) => {
    setSecondsLeft(nextSeconds);
  };

  return { secondsLeft, formatted, reset };
}
