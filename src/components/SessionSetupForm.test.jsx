import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionSetupForm from "./SessionSetupForm";

vi.mock("../api/resumeApi", () => ({
  getMyResumes: vi.fn().mockResolvedValue([]),
}));

afterEach(() => {
  cleanup();
});

function clickNext(container) {
  const nav = container.querySelector(".step-nav-right");
  fireEvent.click(within(nav).getByRole("button", { name: "다음 →" }));
}

async function waitForStep1Ready() {
  await waitFor(() => {
    expect(screen.queryByText("이력서 목록을 불러오는 중...")).toBeNull();
  });
}

describe("SessionSetupForm", () => {
  it("renders participant count options on step 2 without crashing", async () => {
    const { container } = render(<SessionSetupForm onSubmit={vi.fn()} isSubmitting={false} />);

    await waitForStep1Ready();
    clickNext(container);

    expect(await screen.findByText("면접 인원")).toBeTruthy();
    expect(screen.getByText("혼자")).toBeTruthy();
    expect(screen.getByText("2명")).toBeTruthy();
    expect(screen.getByText("3명")).toBeTruthy();
    expect(screen.getByText("4명")).toBeTruthy();
  });

  it("includes maxParticipants in submit payload", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<SessionSetupForm onSubmit={onSubmit} isSubmitting={false} />);

    await waitForStep1Ready();
    clickNext(container);
    fireEvent.click(screen.getByText("2명"));
    clickNext(container);
    fireEvent.click(within(container).getByRole("checkbox"));
    clickNext(container);
    fireEvent.click(screen.getByRole("button", { name: "면접 시작" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        maxParticipants: 2,
      })
    );
  });
});
