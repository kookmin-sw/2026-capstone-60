import { useEffect, useMemo, useRef, useState } from "react";

export function toClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

/**
 * 카운트다운 훅.
 *
 * 설계 메모 (#10 응급 패치):
 * - `onFinish` 는 ref 로 감싸 deps 에서 제외한다. 호출자가 매 렌더 새 함수
 *   identity 를 넘겨도 zero-crossing 이펙트가 재실행되지 않도록 하기 위함.
 * - `firedRef` 로 같은 0 진입에서 단 한 번만 `onFinish` 를 호출한다.
 *   `secondsLeft` 가 다시 양수가 되거나 `reset()` 이 호출되면 재무장된다.
 * - 인터벌 이펙트는 `[isActive]` 만 deps 로 둔다. 함수형 setState 로 매 초
 *   감소시키므로 매 tick 마다 인터벌이 destroy/recreate 되지 않는다.
 *
 * 절대 시각(`expiresAt`) 기반 재작성은 #11 에서 다룬다.
 */
export default function useCountdown(initialSeconds, isActive, onFinish) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const firedRef = useRef(false);
  const onFinishRef = useRef(onFinish);

  // 최신 onFinish 를 ref 에 보관해 deps 에서 제외한다.
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // initialSeconds 가 바뀌면 카운트다운을 새로 시작하고 발화 게이트도 재무장.
  useEffect(() => {
    setSecondsLeft(initialSeconds);
    firedRef.current = false;
  }, [initialSeconds]);

  // 인터벌은 isActive 일 때만 한 번 생성. 매 초 함수형 감소.
  useEffect(() => {
    if (!isActive) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  // 0 으로 처음 진입할 때만 onFinish 발화. 양수 복귀 시 게이트 재무장.
  useEffect(() => {
    if (secondsLeft > 0) {
      firedRef.current = false;
      return;
    }
    if (secondsLeft === 0 && !firedRef.current) {
      firedRef.current = true;
      onFinishRef.current?.();
    }
  }, [secondsLeft]);

  const formatted = useMemo(() => toClock(secondsLeft), [secondsLeft]);

  const reset = (nextSeconds = initialSeconds) => {
    firedRef.current = false;
    setSecondsLeft(nextSeconds);
  };

  return { secondsLeft, formatted, reset };
}
