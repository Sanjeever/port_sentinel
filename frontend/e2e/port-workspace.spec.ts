import { expect, test } from "@playwright/test";
import type { Bridge } from "../src/desktop/api";
import { initialView, row } from "../src/test/fixtures";

test.use({ locale: "en-US", viewport: { width: 720, height: 760 } });

test("keeps endpoint details usable with the keyboard in a narrow window", async ({
  page,
}) => {
  await page.addInitScript(
    (state) => {
      const bridge = {
        GetState: async () => state,
        SaveWindow: async () => {},
      } satisfies Pick<Bridge, "GetState" | "SaveWindow">;
      Object.assign(window, { go: { main: { App: bridge } } });
    },
    initialView([
      row("listener", 8080, 20, "Node"),
      row("resolver", 5353, 21, "Resolver", "UDP", "BOUND"),
    ]),
  );
  await page.goto("/");
  const resolver = page.getByRole("rowheader", { name: "5353", exact: true });
  await expect(resolver).toBeVisible();

  await page.keyboard.press("ControlOrMeta+f");
  const search = page.getByRole("textbox", {
    name: "Search port, PID or process",
  });
  await expect(search).toBeFocused();
  await search.fill("8080");
  await expect(resolver).toHaveCount(0);

  const address = "127.0.0.1:8080";
  const local = page.getByRole("cell").filter({ hasText: address });
  await expect(
    page.getByRole("columnheader", { name: "Local address" }),
  ).toBeInViewport();
  await expect(local.getByText(address, { exact: true })).toBeInViewport();
  await expect(
    local.getByText("State Listening", { exact: true }),
  ).toBeInViewport();

  const opener = page.getByRole("button", { name: "Node", exact: true });
  await opener.press("Enter");
  const details = page.getByRole("dialog", { name: address });
  await expect(details).toBeVisible();
  await expect
    .poll(() =>
      details.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(opener).toBeFocused();
});
