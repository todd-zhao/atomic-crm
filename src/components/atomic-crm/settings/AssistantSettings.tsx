import {
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  RotateCcw,
  Save,
  Settings2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNotify, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

import {
  assistantApi,
  describeAssistantError,
  type TestSettingsResult,
} from "../assistant/assistantApi";
import type { AssistantSettings as AssistantSettingsValue } from "../assistant/types";

const preventFormSubmit = (event: React.KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
  }
};

/**
 * BYOK configuration of the built-in assistant (Settings → AI Assistant).
 *
 * Rendered inside the configuration `<Form>` in the desktop settings page, so
 * none of the inputs is registered with react-hook-form and Enter is swallowed
 * to avoid submitting the CRM configuration form by accident. The API key is
 * write-only: once saved, only the server-provided hint is displayed.
 */
export const AssistantSettings = ({
  variant = "card",
}: {
  variant?: "card" | "plain";
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [settings, setSettings] = useState<AssistantSettingsValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestSettingsResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    assistantApi
      .getSettings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        setBaseUrl(value.baseUrl ?? "");
        setModel(value.model ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(describeAssistantError(error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const validate = (): string | null => {
    if (!/^https?:\/\/.+/i.test(baseUrl.trim())) {
      return translate("crm.assistant.settings.validation_base_url");
    }
    if (!model.trim()) {
      return translate("crm.assistant.settings.validation_model");
    }
    if (!settings?.configured && !apiKey.trim()) {
      return translate("crm.assistant.settings.validation_api_key");
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      const result = await assistantApi.saveSettings({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
      });
      setSettings((current) => ({
        configured: true,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKeyHint: result.apiKeyHint ?? current?.apiKeyHint,
      }));
      setApiKey("");
      setTestResult(null);
      notify(translate("crm.assistant.settings.saved"));
    } catch (error) {
      const { code } = describeAssistantError(error);
      notify(
        translate(
          code === "unreachable"
            ? "crm.assistant.errors.unreachable"
            : "crm.assistant.settings.save_error",
        ),
        { type: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setValidationError(null);
    setTesting(true);
    setTestResult(null);
    try {
      const result = await assistantApi.testSettings({
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      setTestResult(result);
    } catch (error) {
      const { code, message } = describeAssistantError(error);
      setTestResult({
        ok: false,
        error:
          code === "unreachable"
            ? translate("crm.assistant.errors.unreachable")
            : message,
      });
    } finally {
      setTesting(false);
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Settings2 className="size-4 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {translate("crm.assistant.settings.description")}
        </p>
        {settings &&
          (settings.configured ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" />
              {translate("crm.assistant.settings.configured")}
            </Badge>
          ) : (
            <Badge variant="outline">
              {translate("crm.assistant.settings.not_configured")}
            </Badge>
          ))}
      </div>

      {settings?.configured && settings.apiKeyHint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="size-3.5" />
          {translate("crm.assistant.settings.configured_hint", {
            hint: settings.apiKeyHint,
          })}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner size="small" />
          {translate("crm.assistant.loading")}
        </div>
      )}

      {loadError && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <p className="min-w-0 flex-1 break-words text-destructive">
            {translate("crm.assistant.settings.load_error")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <RotateCcw className="size-3.5" />
            {translate("crm.assistant.retry")}
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="assistant-base-url">
            {translate("crm.assistant.settings.base_url")}
          </Label>
          <Input
            id="assistant-base-url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            onKeyDown={preventFormSubmit}
            placeholder={translate(
              "crm.assistant.settings.base_url_placeholder",
            )}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assistant-model">
            {translate("crm.assistant.settings.model")}
          </Label>
          <Input
            id="assistant-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            onKeyDown={preventFormSubmit}
            placeholder={translate("crm.assistant.settings.model_placeholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="assistant-api-key">
          {translate("crm.assistant.settings.api_key")}
        </Label>
        <Input
          id="assistant-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          onKeyDown={preventFormSubmit}
          placeholder={
            settings?.configured
              ? translate("crm.assistant.settings.api_key_placeholder_keep")
              : translate("crm.assistant.settings.api_key_placeholder")
          }
          autoComplete="new-password"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          {translate("crm.assistant.settings.api_key_help")}
        </p>
      </div>

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}

      {testResult && (
        <p
          className={
            testResult.ok
              ? "flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
              : "flex items-center gap-1.5 text-xs text-destructive"
          }
        >
          {testResult.ok ? (
            <CheckCircle2 className="size-3.5 shrink-0" />
          ) : (
            <XCircle className="size-3.5 shrink-0" />
          )}
          <span className="break-words">
            {testResult.ok
              ? translate("crm.assistant.settings.test_ok", {
                  latency: testResult.latencyMs ?? 0,
                })
              : translate("crm.assistant.settings.test_failed", {
                  error:
                    testResult.error ??
                    translate("crm.assistant.settings.test_unknown_error"),
                })}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleTest()}
          disabled={testing || saving}
        >
          {testing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PlugZap className="size-4" />
          )}
          {testing
            ? translate("crm.assistant.settings.testing")
            : translate("crm.assistant.settings.test")}
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || testing}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving
            ? translate("crm.assistant.settings.saving")
            : translate("crm.assistant.settings.save")}
        </Button>
      </div>
    </div>
  );

  if (variant === "plain") {
    return content;
  }

  return (
    <Card id="ai-assistant">
      <CardContent className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.assistant.settings.title")}
        </h2>
        {content}
      </CardContent>
    </Card>
  );
};
