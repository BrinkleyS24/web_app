import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { useSaveResume } from "./useSaveResume";

const { saveResume } = vi.hoisted(() => ({ saveResume: vi.fn() }));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual("@/lib/emails");
  return { ...actual, saveResume };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  saveResume.mockReset();
  saveResume.mockResolvedValue({ success: true });
});

describe("useSaveResume", () => {
  test("trims the input and calls saveResume", async () => {
    const { result } = renderHook(() => useSaveResume(), { wrapper });
    result.current.mutate("  a resume long enough to be valid  ");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(saveResume).toHaveBeenCalledWith("a resume long enough to be valid");
  });
});
