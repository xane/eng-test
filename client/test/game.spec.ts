import { test, expect } from "@playwright/test";
async function login(page: import("@playwright/test").Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Имя выжившего").fill(name);
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Войти на станцию" }).click();
  await expect(
    page.getByRole("heading", { name: `На связи, ${name}.` }),
  ).toBeVisible();
}
test("login errors, automatic registration, ordinary user permissions, logout", async ({
  page,
}) => {
  await page.goto("/login");
  await page.screenshot({
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  await login(page, "browser-survivor");
  await expect(page.getByRole("button", { name: "Создать раунд" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.getByLabel("Имя выжившего").fill("browser-survivor");
  await page.getByLabel("Пароль", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Войти на станцию" }).click();
  await expect(page.getByRole("alert")).toHaveText("Неверное имя или пароль");
});
test("admin creates round, countdown enables tapping, 11 taps yield 20, winner appears", async ({
  page,
}) => {
  await login(page, "admin");
  await page.getByRole("button", { name: "Создать раунд" }).click();
  await expect(page).toHaveURL(/\/rounds\//);
  const goose = page.getByRole("button", { name: "Тапнуть по гусю" });
  await expect(goose).toBeDisabled();
  await expect(goose).toBeEnabled({ timeout: 10000 });
  for (let i = 0; i < 11; i++) await goose.click({ delay: 10 });
  await expect(page.getByTestId("my-score")).toHaveText("20");
  await expect(page.getByTestId("total-score")).toHaveText("20");
  await page.screenshot({
    path: "test-results/round-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: "Гусь может выдохнуть." }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "admin", exact: true }),
  ).toBeVisible();
  await expect(goose).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId("my-score")).toHaveText("20");
});
test("mobile layout fits viewport and session survives reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await login(page, "browser-mobile");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "На связи, browser-mobile." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/rounds-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
