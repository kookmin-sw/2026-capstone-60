import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useCountdown, { toClock } from "./useCountdown";

// 절대 시각 기반 useCountdown 의 핵심 동작 검증.
//
// vitest fake timers 는 advanceTimersByTime 호출 시 Date.now() 도 함께 진행시킨다.
// setSystemTime 은 시작 시각을 한 번만 고정하고, 이후 시간 진행은 advanceTimersByTime 로만 한다.

const baseTime = new Date("2026-05-14T00:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(baseTime);
});

afterEach(() => {
  vi.useRealTimers();
});

function advance(ms) {
  vi.advanceTimersByTime(ms);
}

describe("toClock", () => {
  it("초를 mm:ss 로 포맷한다", () => {
    expect(toClock(0)).toBe("00:00");
    expect(toClock(5)).toBe("00:05");
    expect(toClock(65)).toBe("01:05");
    expect(toClock(3600)).toBe("60:00");
  });

  it("음수는 00:00 으로 안전 처리한다", () => {
    expect(toClock(-10)).toBe("00:00");
  });
});

describe("useCountdown — 절대 시각 기반 동작", () => {
  it("expiresAt 까지의 남은 초를 매 tick 마다 정확히 반환한다", () => {
    const expiresAt = baseTime + 10_000; // 10초 후
    const { result } = renderHook(() =>
      useCountdown({ expiresAt, isActive: true, onFinish: () => {} })
    );

    expect(result.current.secondsLeft).toBe(10);
    expect(result.current.formatted).toBe("00:10");

    act(() => advance(1000));
    expect(result.current.secondsLeft).toBe(9);

    act(() => advance(5000));
    expect(result.current.secondsLeft).toBe(4);

    act(() => advance(4000));
    expect(result.current.secondsLeft).toBe(0);
  });

  it("expiresAt 이 이미 과거면 즉시 0 + onFinish 1회 발화", () => {
    const onFinish = vi.fn();
    const expiresAt = baseTime - 5000; // 이미 5초 전

    const { result } = renderHook(() =>
      useCountdown({ expiresAt, isActive: true, onFinish })
    );

    // mount 후 마이크로태스크/이펙트가 처리되도록 한 번 진행.
    act(() => advance(0));

    expect(result.current.secondsLeft).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("0 진입 후 추가 tick 이 발생해도 onFinish 는 단 한 번만 호출된다", () => {
    const onFinish = vi.fn();
    const expiresAt = baseTime + 1000;

    renderHook(() => useCountdown({ expiresAt, isActive: true, onFinish }));

    act(() => advance(2000)); // 0 진입
    expect(onFinish).toHaveBeenCalledTimes(1);

    act(() => advance(5000)); // 0 상태에서 여러 tick 추가
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("onFinish identity 가 매 렌더 바뀌어도 0 상태에서 재발화하지 않는다", () => {
    // 회귀 테스트: 이전 구현은 onFinish 가 useCallback deps 변경으로 새 함수가 되면
    // secondsLeft===0 이펙트가 재실행되어 다회 발화 가능했다.
    const calls = [];
    const expiresAt = baseTime + 1000;

    let counter = 0;
    const { rerender } = renderHook(({ tag }) =>
      useCountdown({
        expiresAt,
        isActive: true,
        // 매 렌더마다 새 함수 identity (counter 캡처)
        onFinish: () => calls.push({ tag, counter: ++counter }),
      })
    , { initialProps: { tag: "a" } });

    act(() => advance(2000));
    expect(calls).toHaveLength(1);

    // 부모 리렌더로 onFinish identity 변경 시뮬레이션
    rerender({ tag: "b" });
    rerender({ tag: "c" });
    act(() => advance(3000));

    expect(calls).toHaveLength(1);
  });

  it("expiresAt 변경 시 카운트다운이 재시작되고 onFinish 게이트가 재무장된다", () => {
    const onFinish = vi.fn();
    let expiresAt = baseTime + 1000;

    const { result, rerender } = renderHook(
      ({ deadline }) => useCountdown({ expiresAt: deadline, isActive: true, onFinish }),
      { initialProps: { deadline: expiresAt } }
    );

    act(() => advance(2000));
    expect(onFinish).toHaveBeenCalledTimes(1);

    // 새 deadline 부여 → 게이트 재무장
    expiresAt = Date.now() + 5000;
    rerender({ deadline: expiresAt });

    expect(result.current.secondsLeft).toBe(5);

    act(() => advance(6000));
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it("isActive=false 면 시간이 흘러도 secondsLeft 가 변하지 않는다", () => {
    const expiresAt = baseTime + 10_000;
    const { result, rerender } = renderHook(
      ({ active }) => useCountdown({ expiresAt, isActive: active, onFinish: () => {} }),
      { initialProps: { active: false } }
    );

    expect(result.current.secondsLeft).toBe(10);

    act(() => advance(5000));
    // 비활성 상태에서는 tick 이 돌지 않으므로 초기값 유지.
    expect(result.current.secondsLeft).toBe(10);

    // 활성화 시 즉시 동기화 → 5초 남음.
    rerender({ active: true });
    expect(result.current.secondsLeft).toBe(5);
  });

  it("탭 백그라운드 시뮬레이션: 큰 시간 점프 후 정확한 잔여 시간 반환", () => {
    const expiresAt = baseTime + 30_000;
    const { result } = renderHook(() =>
      useCountdown({ expiresAt, isActive: true, onFinish: () => {} })
    );

    // 25초가 한 번에 흐른 것처럼 시뮬레이션
    act(() => advance(25_000));
    expect(result.current.secondsLeft).toBe(5);

    // 만료 이후로 점프
    act(() => advance(10_000));
    expect(result.current.secondsLeft).toBe(0);
  });

  it("expiresAt 이 null/undefined 면 휴면 상태로 onFinish 를 발화하지 않는다", () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCountdown({ expiresAt: null, isActive: true, onFinish })
    );

    expect(result.current.secondsLeft).toBe(0);
    // null 이면 "--:--" 로 표시 (질문 대기 중 상태를 00:00 으로 오해하지 않도록)
    expect(result.current.formatted).toBe("--:--");

    act(() => advance(10_000));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("ISO 문자열 expiresAt 을 허용한다", () => {
    const expiresAt = new Date(baseTime + 7_000).toISOString();
    const { result } = renderHook(() =>
      useCountdown({ expiresAt, isActive: true, onFinish: () => {} })
    );

    expect(result.current.secondsLeft).toBe(7);

    act(() => advance(3000));
    expect(result.current.secondsLeft).toBe(4);
  });
});
