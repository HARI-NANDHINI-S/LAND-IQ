import { useEffect, useMemo, useState } from 'react';
import { Check, Settings as SettingsIcon, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/auth/useAuth';
import { settingsService, type SettingRow } from '@/services/settingsService';

const formatSettingValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const parseSettingValue = (raw: string, currentValue: unknown): unknown => {
  const trimmed = raw.trim();

  if (typeof currentValue === 'boolean') {
    return trimmed === 'true';
  }

  if (typeof currentValue === 'number') {
    if (trimmed === '') return 0;
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      throw new Error('This setting requires a valid number.');
    }
    return numeric;
  }

  if (Array.isArray(currentValue) || (typeof currentValue === 'object' && currentValue !== null)) {
    if (trimmed === '') return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('This setting requires valid JSON.');
    }
  }

  return trimmed;
};

const getSettingValidationError = (setting: SettingRow, draft: string): string | null => {
  const currentValue = setting.value;
  try {
    parseSettingValue(draft, currentValue);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid value.';
  }
};

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const canManageSettings = hasPermission('settings:manage');

  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.getSettings();
      const nextDrafts: Record<string, string> = {};
      data.forEach((setting) => {
        nextDrafts[setting.key] = formatSettingValue(setting.value);
      });
      setSettings(data);
      setDrafts(nextDrafts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const dirtyKeys = useMemo(() => {
    return settings.filter((setting) => drafts[setting.key] !== formatSettingValue(setting.value));
  }, [drafts, settings]);

  const handleChange = (key: string, nextValue: string) => {
    setDrafts((previous) => ({ ...previous, [key]: nextValue }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleSave = async (setting: SettingRow) => {
    const draftValue = drafts[setting.key] ?? '';
    const validationError = getSettingValidationError(setting, draftValue);
    if (validationError) {
      setError(`${setting.key}: ${validationError}`);
      return;
    }

    try {
      setSavingKey(setting.key);
      setError(null);
      setSuccessMessage(null);
      const parsedValue = parseSettingValue(draftValue, setting.value);
      await settingsService.updateSetting(setting.key, parsedValue);
      setSuccessMessage(`${setting.key} was saved successfully.`);
      await loadSettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save setting.');
    } finally {
      setSavingKey(null);
    }
  };

  const renderEditor = (setting: SettingRow) => {
    const value = drafts[setting.key] ?? '';
    const validationError = getSettingValidationError(setting, value);
    const isBoolean = typeof setting.value === 'boolean';
    const isNumeric = typeof setting.value === 'number';
    const isStructured = Array.isArray(setting.value) || (typeof setting.value === 'object' && setting.value !== null);

    if (isBoolean) {
      return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/70 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Enabled</p>
            <p className="text-xs text-muted-foreground">Toggle this platform setting on or off.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={value === 'true'}
            onClick={() => handleChange(setting.key, value === 'true' ? 'false' : 'true')}
            className={`relative h-7 w-12 rounded-full border transition-colors ${value === 'true' ? 'border-primary bg-primary' : 'border-border bg-muted'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${value === 'true' ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      );
    }

    if (isStructured) {
      return (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(event) => handleChange(setting.key, event.target.value)}
            rows={6}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={Boolean(validationError)}
          />
          {validationError && <p className="text-xs text-destructive">{validationError}</p>}
        </div>
      );
    }

    if (isNumeric) {
      return (
        <div className="space-y-2">
          <Input
            type="number"
            value={value}
            onChange={(event) => handleChange(setting.key, event.target.value)}
            className="rounded-xl border-input bg-background text-foreground"
            aria-invalid={Boolean(validationError)}
          />
          {validationError && <p className="text-xs text-destructive">{validationError}</p>}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(event) => handleChange(setting.key, event.target.value)}
          className="rounded-xl border-input bg-background text-foreground"
          aria-invalid={Boolean(validationError)}
        />
        {validationError && <p className="text-xs text-destructive">{validationError}</p>}
      </div>
    );
  };

  if (!canManageSettings) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <div className="rounded-full bg-primary/10 p-4 text-primary">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Access denied</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            You do not have permission to manage platform settings. Public settings remain visible only to authorized users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="landiq-page space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="landiq-kicker">Governance</div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Platform settings</h1>
          <p className="text-sm text-muted-foreground">Review and update the production configuration used across LAND-IQ.</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
          <SettingsIcon className="h-4 w-4" />
          {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? '' : 's'}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item} className="h-48 animate-pulse border border-border bg-muted/40" />
          ))}
        </div>
      ) : settings.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-lg font-medium text-foreground">No settings are available.</p>
          <p className="mt-2 text-sm text-muted-foreground">The settings registry is empty for this environment.</p>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {settings.map((setting) => {
            const value = drafts[setting.key] ?? '';
            const validationError = getSettingValidationError(setting, value);
            const hasChanges = value !== formatSettingValue(setting.value);
            const isSaving = savingKey === setting.key;

            return (
              <Card key={setting.key} className="p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{setting.key}</h2>
                      {setting.is_public && (
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                          Public
                        </span>
                      )}
                    </div>
                    {setting.description && <p className="text-sm text-muted-foreground">{setting.description}</p>}
                  </div>
                  <div className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {typeof setting.value}
                  </div>
                </div>

                <div className="space-y-4">{renderEditor(setting)}</div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(setting.updated_at).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDrafts((previous) => ({ ...previous, [setting.key]: formatSettingValue(setting.value) }))}
                      disabled={!hasChanges || isSaving}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSave(setting)}
                      disabled={!hasChanges || Boolean(validationError) || isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
