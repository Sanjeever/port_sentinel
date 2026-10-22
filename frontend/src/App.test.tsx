import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroUIProvider } from "@heroui/react";
import App from "./App";
import i18n from "./i18n";
import type { View } from "./types";
import { row, preferences } from "./test-fixtures";
import type { Bridge } from "./api";
let state: View;
let bridge: Bridge;
let receive: (v: View) => void;
beforeEach(() => {
  state = {
    closeBlocked: false,
    entries: [
      row("a", 8080, 20, "Node"),
      row("b", 5353, 21, "Resolver", "UDP", "BOUND"),
      row("c", 9000, 20, "Node"),
    ],
    visibility: "ordinary",
    lastSuccess: "2026-10-22T01:00:00Z",
    stale: false,
    task: "",
    error: null,
    settingsError: null,
    preferences: { ...preferences },
    results: [],
    build: { version: "2.0.0", commit: "abcdef", development: true },
    update: {
      phase: "",
      error: "",
      errorCode: "",
      version: "",
      notes: "",
      url: "",
      checked_at: null,
      downloaded: 0,
      total: 0,
    },
    sequence: 1,
  };
  bridge = {
    ExitWithoutSaving: vi.fn(async () => {}),
    GetState: vi.fn(async () => state),
    Refresh: vi.fn(async () => true),
    CancelTask: vi.fn(async () => {}),
    Terminate: vi.fn(async () => true),
    SavePreferences: vi.fn(async (p) => {
      state = { ...state, preferences: p, sequence: state.sequence + 1 };
      receive(state);
    }),
    SaveWindow: vi.fn(async () => {}),
    Copy: vi.fn(async () => {}),
    CheckUpdate: vi.fn(async () => {}),
    InstallUpdate: vi.fn(async () => {}),
    CancelUpdate: vi.fn(async () => {}),
    OpenURL: vi.fn(async () => {}),
  };
  window.go = { main: { App: bridge } };
  window.runtime = {
    EventsOnMultiple: (_name, cb) => {
      receive = cb;
      return () => {};
    },
  };
});
afterEach(() => {
  cleanup();
  delete window.go;
  delete window.runtime;
});
async function start() {
  render(
    <HeroUIProvider>
      <App />
    </HeroUIProvider>,
  );
  await screen.findByPlaceholderText("Search port, PID or process");
}
describe("desktop workspace", () => {
  it("offers manual download in the update confirmation after an install failure", async () => {
    state = {
      ...state,
      build: { ...state.build, development: false },
      update: {
        ...state.update,
        version: "2.1.0",
        notes: "## English\n\n## 简体中文",
        error: "permission denied",
        errorCode: "install_directory_unwritable",
      },
    };
    await start();
    fireEvent.click(
      screen.getByRole("button", { name: "Settings, update available" }),
    );
    fireEvent.click(await screen.findByRole("tab", { name: "About" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Update available · 2.1.0" }),
    );
    const dialog = screen
      .getAllByRole("dialog")
      .find((el) => within(el).queryByText("Install 2.1.0?"))!;
    expect(
      within(dialog).getByText(
        "Installation directory is not writable. Move the app to a writable location or download manually.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Open releases" }),
    );
    await waitFor(() =>
      expect(bridge.OpenURL).toHaveBeenCalledWith(
        "https://github.com/Sanjeever/port_sentinel/releases",
      ),
    );
  });
  it("selects the filtered rows and confirms the deduplicated process before execution", async () => {
    await start();
    fireEvent.change(
      screen.getByPlaceholderText("Search port, PID or process"),
      { target: { value: "Node" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select filtered rows" }),
    );
    expect(
      screen.getByText("1 processes · 2 selected rows"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "End processes" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("PID 20")).toBeInTheDocument();
    expect(within(dialog).getByText("8080, 9000")).toBeInTheDocument();
    expect(bridge.Terminate).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "End processes" }),
    );
    await waitFor(() =>
      expect(bridge.Terminate).toHaveBeenCalledWith(
        [state.entries[0].process],
        false,
      ),
    );
  });
  it("switches language and theme immediately through persisted preferences", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Language"), {
      target: { value: "zh-CN" },
    });
    await screen.findByText("常规");
    expect(document.documentElement.lang).toBe("zh-CN");
    fireEvent.change(screen.getByLabelText("主题"), {
      target: { value: "dark" },
    });
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(bridge.SavePreferences).toHaveBeenCalled();
  });
  it("keeps old data visible with a localized failure and rejects stale events", async () => {
    await start();
    await act(async () =>
      receive({
        ...state,
        error: { code: "permission_denied", detail: "OS detail" },
        stale: true,
        sequence: 3,
      }),
    );
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText("8080")).toBeInTheDocument();
    await act(async () => receive({ ...state, entries: [], sequence: 2 }));
    expect(screen.getByText("8080")).toBeInTheDocument();
  });
  it("requires a separate confirmation for force termination", async () => {
    await start();
    await act(async () =>
      receive({
        ...state,
        results: [
          {
            target: state.entries[0].process,
            status: "still_running",
            detail: "",
          },
        ],
        sequence: 2,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Force end" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        "Unsaved work may be lost. This request cannot be undone.",
      ),
    ).toBeInTheDocument();
    expect(bridge.Terminate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Force end" }));
    await waitFor(() =>
      expect(bridge.Terminate).toHaveBeenCalledWith(
        [state.entries[0].process],
        true,
      ),
    );
  });
});
