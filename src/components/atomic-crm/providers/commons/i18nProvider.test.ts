import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialLocale, i18nProvider } from "./i18nProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18nProvider", () => {
  it("registers zh, en and fr locales", () => {
    expect(i18nProvider.getLocales?.()).toEqual([
      { locale: "zh", name: "中文" },
      { locale: "en", name: "English" },
      { locale: "fr", name: "Français" },
    ]);
  });

  it("translates the language key in french", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("crm.language")).toBe("Langue");
  });

  it("translates the language key in chinese", async () => {
    await i18nProvider.changeLocale("zh");

    expect(i18nProvider.translate("crm.language")).toBe("语言");
    expect(i18nProvider.translate("resources.deals.empty.title")).toBe(
      "未找到商机",
    );
    expect(i18nProvider.translate("ra.action.save")).toBe("保存");
  });

  it("falls back to english for unknown locales", async () => {
    await i18nProvider.changeLocale("es");

    expect(i18nProvider.translate("crm.language")).toBe("Language");
  });

  it("uses customized password reset overrides for en, fr and zh", async () => {
    await i18nProvider.changeLocale("en");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Check your emails for a Reset Password message.",
    );

    await i18nProvider.changeLocale("fr");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    );

    await i18nProvider.changeLocale("zh");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "请查看你的邮箱中的重置密码邮件。",
    );
  });

  it("translates recently added fr crm keys", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("resources.deals.empty.title")).toBe(
      "Aucune affaire trouvée",
    );
  });

  it("uses browser chinese locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "zh-CN",
      languages: ["zh-CN", "en-US"],
    });

    expect(getInitialLocale()).toBe("zh");
  });

  it("uses browser french locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR", "en-US"],
    });

    expect(getInitialLocale()).toBe("fr");
  });

  it("falls back to english when browser locale is unsupported", () => {
    vi.stubGlobal("navigator", {
      language: "es-ES",
      languages: ["es-ES", "pt-BR"],
    });

    expect(getInitialLocale()).toBe("en");
  });
});
