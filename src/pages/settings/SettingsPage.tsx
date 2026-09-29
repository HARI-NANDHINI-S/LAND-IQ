import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/auth/useAuth';
import { settingsService } from '@/services/settingsService';
import type { SettingRow } from '@/services/settingsService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings as SettingsIcon, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getSettings();
      setSettings(data);
      const values: Record<string, string> = {};
      data.forEach(s => {
        values[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
      });
      setEditValues(values);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    if (!user) return;
    
    try {
      setSaving(key);
      let valToSave: any = editValues[key];
      
      // Try parsing as JSON for numbers/booleans/objects if it looks like one
      if (valToSave === 'true') valToSave = true;
      else if (valToSave === 'false') valToSave = false;
      else if (!isNaN(Number(valToSave))) valToSave = Number(valToSave);
      else {
        try {
          if (valToSave.startsWith('{') || valToSave.startsWith('[')) {
             valToSave = JSON.parse(valToSave);
          }
        } catch(e) {}
      }

      await settingsService.updateSetting(key, valToSave, user.id, 'UNKNOWN');
      alert(`Successfully updated ${key}`);
      await loadSettings();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(null);
    }
  };

  if (!hasPermission('settings:manage')) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <SettingsIcon className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-medium">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to manage settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-2">Manage global application configuration</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid gap-6">
          {settings.map((setting) => (
            <Card key={setting.key} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <h3 className="font-medium text-lg">{setting.key}</h3>
                  {setting.description && (
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  )}
                  <div className="mt-4 flex max-w-xl gap-2">
                    <Input
                      value={editValues[setting.key] ?? ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => handleSave(setting.key)} 
                      disabled={saving === setting.key}
                      variant="secondary"
                    >
                      {saving === setting.key ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {setting.is_public && (
                    <span className="mr-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Public
                    </span>
                  )}
                  Updated: {new Date(setting.updated_at).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
