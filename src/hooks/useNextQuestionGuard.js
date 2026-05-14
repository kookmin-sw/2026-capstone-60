import { useCallback, useRef } from "react";

/**
 * /next 호출에 대한 동기 가드 훅.
 *
 * 두 가지 차단 조건을 합친 단일 진입점을 제공한다.
 *  1) in-flight: 이전 요청이 아직 진행 중이면 즉시 거부.
 *  2) cooldown: 마지막 호출로부터 cooldownMs(기본 2000ms) 이내면 거부.
 *
 * `tryAcquire()` 가 true 를 반환하면 호출자가 요청을 보내야 하고,
 * 종료(성공/실패) 시점에 `release()` 를 반드시 호출해 in-flight 플래그를 푼다.
 *
 * React state 가 아니라 useRef 를 사용하는 이유는, 같은 렌더 프레임 안에서
 * 두 번째 발화가 stale state 를 보고 통과해버리는 것을 막기 위함이다 (#10).
 *
 * @param {Object} [options]
 * @param {number} [options.cooldownMs=2000]
 * @param {() => number} [options.now=() => Date.now()]
 *   테스트 주입을 위한 시각 제공자.
 */
export default function useNextQuestionGuard({ cooldownMs = 2000, now = () => Date.now() } = {}) {
  const inFlightRef = useRef(false);
  const lastAtRef = useRef(-Infinity);

  const tryAcquire = useCallback(() => {
    if (inFlightRef.current) return false;
    if (now() - lastAtRef.current < cooldownMs) return false;
    inFlightRef.current = true;
    lastAtRef.current = now();
    return true;
  }, [cooldownMs, now]);

  const release = useCallback(() => {
    inFlightRef.current = false;
  }, []);

  return { tryAcquire, release };
}
