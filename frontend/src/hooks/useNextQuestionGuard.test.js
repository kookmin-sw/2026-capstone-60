import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useNextQuestionGuard from "./useNextQuestionGuard";

// 테스트는 now 주입자를 통해 시간을 직접 제어한다 (실제 Date.now() 미사용).
function makeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

describe("useNextQuestionGuard — in-flight 가드", () => {
  it("최초 호출은 통과한다", () => {
    const { result } = renderHook(() => useNextQuestionGuard({ now: () => 0 }));
    let acquired;
    act(() => {
      acquired = result.current.tryAcquire();
    });
    expect(acquired).toBe(true);
  });

  it("release 전에는 후속 호출을 즉시 거부한다", () => {
    const { result } = renderHook(() => useNextQuestionGuard({ now: () => 0 }));
    const acquisitions = [];
    act(() => {
      // 같은 동기 프레임 안에서 연속 발화 시뮬레이션
      acquisitions.push(result.current.tryAcquire());
      acquisitions.push(result.current.tryAcquire());
      acquisitions.push(result.current.tryAcquire());
    });
    expect(acquisitions).toEqual([true, false, false]);
  });

  it("release 후에는 다시 통과한다 (cooldown 0 일 때)", () => {
    const { result } = renderHook(() =>
      useNextQuestionGuard({ cooldownMs: 0, now: () => 0 })
    );
    let first;
    let second;
    act(() => {
      first = result.current.tryAcquire();
      result.current.release();
      second = result.current.tryAcquire();
    });
    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});

describe("useNextQuestionGuard — cooldown 가드", () => {
  it("cooldownMs 이내에 다시 호출하면 거부한다 (release 이후라도)", () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useNextQuestionGuard({ cooldownMs: 2000, now: clock.now })
    );

    let first;
    let secondTooSoon;
    act(() => {
      first = result.current.tryAcquire();
      result.current.release();
    });
    expect(first).toBe(true);

    // 1초만 흐름 → cooldown 안쪽
    clock.advance(1000);
    act(() => {
      secondTooSoon = result.current.tryAcquire();
    });
    expect(secondTooSoon).toBe(false);
  });

  it("cooldownMs 가 지나면 다시 통과한다", () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useNextQuestionGuard({ cooldownMs: 2000, now: clock.now })
    );

    act(() => {
      result.current.tryAcquire();
      result.current.release();
    });

    clock.advance(2000);
    let acquired;
    act(() => {
      acquired = result.current.tryAcquire();
    });
    expect(acquired).toBe(true);
  });

  it("기본 cooldownMs(2000) 이 적용된다", () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useNextQuestionGuard({ now: clock.now })  // cooldownMs 미지정
    );

    act(() => {
      result.current.tryAcquire();
      result.current.release();
    });

    clock.advance(1999);
    let tooSoon;
    act(() => {
      tooSoon = result.current.tryAcquire();
    });
    expect(tooSoon).toBe(false);

    clock.advance(1);
    let justInTime;
    act(() => {
      justInTime = result.current.tryAcquire();
    });
    expect(justInTime).toBe(true);
  });
});

describe("useNextQuestionGuard — 동기성", () => {
  it("같은 동기 프레임 내 두 번째 발화를 동기적으로 막는다 (#10 회귀 방지)", () => {
    // React state(useState)였다면 setState 가 비동기라 두 번째 호출이 stale 값을
    // 보고 통과했을 것이다. ref 기반이므로 즉시 반영되어야 한다.
    const clock = makeClock();
    const { result } = renderHook(() =>
      useNextQuestionGuard({ cooldownMs: 0, now: clock.now })
    );

    const callsAccepted = [];
    act(() => {
      // 버튼 연타 + 타이머 만료가 동시에 발화하는 시나리오
      if (result.current.tryAcquire()) callsAccepted.push("click");
      if (result.current.tryAcquire()) callsAccepted.push("timer");
      if (result.current.tryAcquire()) callsAccepted.push("retry");
    });

    expect(callsAccepted).toEqual(["click"]);
  });
});
