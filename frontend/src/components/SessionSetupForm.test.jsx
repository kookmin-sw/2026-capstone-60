import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionSetupForm from "./SessionSetupForm";

vi.mock("../api/resumeApi", () => ({
  getMyResumes: vi.fn().mockResolvedValue([{ id: 1, title: "테스트 이력서" }]),
}));

afterEach(() => {
  cleanup();
});

function clickNext(container) {
  const nav = container.querySelector(".step-nav-right");
  fireEvent.click(within(nav).getByRole("button", { name: "다음 →" }));
}

async function waitForResumes() {
  await waitFor(() => {
    expect(screen.queryByText("이력서 목록을 불러오는 중...")).toBeNull();
  });
}

describe("SessionSetupForm", () => {
  it("shows group size options when GROUP mode is selected", async () => {
    const { container } = render(<SessionSetupForm onSubmit={vi.fn()} isSubmitting={false} />);

    fireEvent.click(screen.getByRole("button", { name: "그룹 면접 (GROUP)" }));
    expect(screen.getByText("3명")).toBeTruthy();

    clickNext(container);
    await waitForResumes();
    clickNext(container);
    clickNext(container);

    expect(screen.getByRole("heading", { name: "마이크 테스트" })).toBeTruthy();
  });

  it("submits GROUP payload with maxParticipants and resumeIds", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<SessionSetupForm onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.click(screen.getByRole("button", { name: "그룹 면접 (GROUP)" }));
    fireEvent.click(screen.getByText("3명"));
    clickNext(container);

    await waitForResumes();
    clickNext(container);
    clickNext(container);

    fireEvent.click(within(container).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "GROUP",
        maxParticipants: 3,
        resumeIds: 1,
        jobField: "BACKEND",
      })
    );
  });

  it("submits SOLO without maxParticipants", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<SessionSetupForm onSubmit={onSubmit} isSubmitting={false} />);

    clickNext(container);
    await waitForResumes();
    clickNext(container);
    clickNext(container);

    fireEvent.click(within(container).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "면접 시작" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "SOLO",
        resumeIds: 1,
      })
    );
    expect(onSubmit.mock.calls[0][0].maxParticipants).toBeUndefined();
  });
});
