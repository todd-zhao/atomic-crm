import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { raSupabaseFrenchMessages } from "ra-supabase-language-french";
import { chineseCoreMessages } from "./chineseCoreMessages";
import { chineseCrmMessages } from "./chineseCrmMessages";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
    oauth: {
      authorize: "Authorize Application",
      authorize_details: "This application wants to access your account.",
      access_scope:
        "It will be able to read and modify your data, with the same permissions as your account.",
      approved: "Authorization Approved",
      close_tab: "You can now close this tab.",
      no_request: "No authorization request found",
    },
  },
};

const raSupabaseFrenchMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset:
        "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    },
    oauth: {
      authorize: "Autoriser l'application",
      authorize_details: "Cette application souhaite accéder à votre compte.",
      access_scope:
        "Elle pourra lire et modifier vos données, avec les mêmes droits que votre compte.",
      approved: "Autorisation accordée",
      close_tab: "Vous pouvez fermer cet onglet.",
      no_request: "Aucune demande d'autorisation trouvée",
    },
  },
};

const englishCatalog = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishMessagesOverride,
  englishCrmMessages,
);

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  raSupabaseFrenchMessages,
  raSupabaseFrenchMessagesOverride,
  frenchCrmMessages,
);

// Chinese is built on top of the English catalog so any key that is not
// translated yet still falls back to English instead of showing a raw key.
const chineseCatalog = mergeTranslations(
  englishCatalog,
  chineseCoreMessages,
  chineseCrmMessages,
);

export type SupportedLocale = "en" | "fr" | "zh";

export const getInitialLocale = (): SupportedLocale => {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLocale = navigator.languages?.[0] ?? navigator.language;
  const normalized = browserLocale?.toLowerCase() ?? "";
  if (normalized.startsWith("zh")) {
    return "zh";
  }
  if (normalized.startsWith("fr")) {
    return "fr";
  }

  return "en";
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "fr") {
      return frenchCatalog;
    }
    if (locale === "zh") {
      return chineseCatalog;
    }
    return englishCatalog;
  },
  getInitialLocale(),
  [
    { locale: "zh", name: "中文" },
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);

export const testI18nProvider = polyglotI18nProvider(
  () => englishCatalog,
  "en",
  [{ locale: "en", name: "English" }],
  { allowMissing: true },
);
