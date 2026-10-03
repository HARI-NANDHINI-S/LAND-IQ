import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { profileService, type ProfileDirectoryEntry } from '@/services/profileService';
import type { Database } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface ProfileDraft {
  full_name: string;
  phone: string;
  avatar_url: string;
  employee_code: string;
  designation: string;
  role_id: string;
  state_id: string;
  district_id: string;
  village_id: string;
  is_active: boolean;
}

const selectClassName = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const profileQueryKey = ['profiles', 'directory'] as const;

function toOptionalValue(value: string) {
  return value.trim() || null;
}

function profileLabel(profile: ProfileDirectoryEntry) {
  return profile.full_name || profile.email;
}

export default function UsersPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManageUsers = user?.role?.code === 'SUPER_ADMIN' && hasPermission('user:read');
  const [search, setSearch] = useState('');
  const [editingProfile, setEditingProfile] = useState<ProfileDirectoryEntry | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const directoryQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: profileService.listDirectory,
    enabled: canManageUsers,
  });
  const directory = directoryQuery.data;

  const visibleProfiles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return directory?.profiles ?? [];
    return (directory?.profiles ?? []).filter((profile) => [
      profile.full_name,
      profile.email,
      profile.role?.name,
      profile.state?.name,
      profile.district?.name,
      profile.village?.name,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch)));
  }, [directory?.profiles, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingProfile || !draft || !directory || !user?.role?.code) {
        throw new Error('The profile edit is no longer available. Refresh and try again.');
      }

      const hasValue = (value: string, values: { id: string }[]) => values.some((item) => item.id === value);
      if (draft.role_id && !hasValue(draft.role_id, directory.roles)) throw new Error('Choose a valid role.');
      if (editingProfile.role_id && !draft.role_id) throw new Error('The current RPC cannot clear a role assignment. Choose another role.');
      if (editingProfile.state_id && !draft.state_id) throw new Error('The current RPC cannot clear a state assignment. Choose another state.');
      if (editingProfile.district_id && !draft.district_id) throw new Error('The current RPC cannot clear a district assignment. Choose another district.');
      if (editingProfile.village_id && !draft.village_id) throw new Error('The current RPC cannot clear a village assignment. Choose another village.');
      if (draft.state_id && !hasValue(draft.state_id, directory.states)) throw new Error('Choose a valid state.');

      const selectedDistrict = directory.districts.find((district) => district.id === draft.district_id);
      if (draft.district_id && (!selectedDistrict || selectedDistrict.state_id !== draft.state_id)) {
        throw new Error('The selected district does not belong to the selected state.');
      }
      const selectedVillage = directory.villages.find((village) => village.id === draft.village_id);
      if (draft.village_id && (!selectedVillage || selectedVillage.district_id !== draft.district_id || selectedVillage.state_id !== draft.state_id)) {
        throw new Error('The selected village does not belong to the selected state and district.');
      }

      const safeUpdates: ProfileUpdate = {};
      if (draft.full_name.trim() !== editingProfile.full_name) safeUpdates.full_name = draft.full_name.trim();
      if (toOptionalValue(draft.phone) !== editingProfile.phone) safeUpdates.phone = toOptionalValue(draft.phone);
      if (toOptionalValue(draft.avatar_url) !== editingProfile.avatar_url) safeUpdates.avatar_url = toOptionalValue(draft.avatar_url);
      if (toOptionalValue(draft.employee_code) !== editingProfile.employee_code) safeUpdates.employee_code = toOptionalValue(draft.employee_code);
      if (toOptionalValue(draft.designation) !== editingProfile.designation) safeUpdates.designation = toOptionalValue(draft.designation);
      if (!draft.full_name.trim()) throw new Error('Name is required.');
      if (editingProfile.id !== user.id && Object.keys(safeUpdates).length > 0) {
        throw new Error('Safe profile fields can only be edited on your own profile under the current row-level security policy.');
      }

      const authorizationChanged = draft.role_id !== (editingProfile.role_id ?? '')
        || draft.state_id !== (editingProfile.state_id ?? '')
        || draft.district_id !== (editingProfile.district_id ?? '')
        || draft.village_id !== (editingProfile.village_id ?? '')
        || draft.is_active !== editingProfile.is_active;
      if (authorizationChanged && editingProfile.id === user.id) {
        throw new Error('Use another SUPER_ADMIN account to change your own authorization or active status.');
      }

      if (!authorizationChanged && Object.keys(safeUpdates).length === 0) return editingProfile;

      let authorizationSaved = false;
      let safeFieldsSaved = false;
      try {
        if (authorizationChanged) {
          await profileService.updateAuthorization({
            p_profile_id: editingProfile.id,
            p_role_id: draft.role_id !== (editingProfile.role_id ?? '') ? draft.role_id || null : null,
            p_state_id: draft.state_id !== (editingProfile.state_id ?? '') ? draft.state_id || null : null,
            p_district_id: draft.district_id !== (editingProfile.district_id ?? '') ? draft.district_id || null : null,
            p_village_id: draft.village_id !== (editingProfile.village_id ?? '') ? draft.village_id || null : null,
            p_is_active: draft.is_active !== editingProfile.is_active ? draft.is_active : null,
          });
          authorizationSaved = true;
        }
        if (Object.keys(safeUpdates).length > 0) {
          await profileService.updateSafeFields(editingProfile.id, safeUpdates);
          safeFieldsSaved = true;
        }
      } catch (error) {
        if (authorizationSaved || safeFieldsSaved) {
          await queryClient.invalidateQueries({ queryKey: profileQueryKey });
          const message = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Some changes were saved, but the remaining update failed: ${message}`);
        }
        throw error;
      }

      return editingProfile;
    },
    onSuccess: () => {
      setSuccessMessage('Profile changes saved.');
      setEditingProfile(null);
      setDraft(null);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['audit-logs'] }),
      ]);
    },
  });

  const startEditing = (profile: ProfileDirectoryEntry) => {
    setSuccessMessage('');
    setEditingProfile(profile);
    setDraft({
      full_name: profile.full_name,
      phone: profile.phone ?? '',
      avatar_url: profile.avatar_url ?? '',
      employee_code: profile.employee_code ?? '',
      designation: profile.designation ?? '',
      role_id: profile.role_id ?? '',
      state_id: profile.state_id ?? '',
      district_id: profile.district_id ?? '',
      village_id: profile.village_id ?? '',
      is_active: profile.is_active,
    });
    saveMutation.reset();
  };

  if (!canManageUsers) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">User administration is available only to authorized SUPER_ADMIN users.</p>
        </div>
      </div>
    );
  }

  const editField = (field: keyof ProfileDraft, value: string | boolean) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };
  const canEditSafeFields = editingProfile?.id === user?.id;

  const renderSelect = (
    field: 'role_id' | 'state_id' | 'district_id' | 'village_id',
    label: string,
    options: { id: string; name: string }[],
    emptyLabel: string,
    disabled = false,
  ) => (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className={selectClassName}
        value={draft?.[field] ?? ''}
        disabled={disabled || editingProfile?.id === user?.id}
        onChange={(event) => editField(field, event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <UserRoundCog className="h-4 w-4" />
            <span>Governance</span>
          </div>
          <h1 className="text-2xl font-semibold">User administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage profile details, access roles, and geographic scope.</p>
        </div>
        <Badge variant="outline">SUPER_ADMIN</Badge>
      </div>

      {successMessage && <div role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div>}
      {directoryQuery.isError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{directoryQuery.error.message}</div>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Profiles</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{directory?.profiles.length ?? 0} profiles visible under database row-level security</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search profiles" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search users" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {directoryQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading profiles...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Village</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profileLabel(profile)}</TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell>{profile.role?.name ?? 'Unassigned'}</TableCell>
                    <TableCell>{profile.state?.name ?? 'Unassigned'}</TableCell>
                    <TableCell>{profile.district?.name ?? 'Unassigned'}</TableCell>
                    <TableCell>{profile.village?.name ?? 'Unassigned'}</TableCell>
                    <TableCell><Badge variant={profile.is_active ? 'default' : 'secondary'}>{profile.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => startEditing(profile)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!directoryQuery.isLoading && visibleProfiles.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No profiles found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingProfile} onOpenChange={(open) => { if (!open) { setEditingProfile(null); setDraft(null); saveMutation.reset(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>{editingProfile?.email} · authorization changes are validated again by the database.</DialogDescription>
          </DialogHeader>
          {draft && directory && editingProfile && (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Full name</span>
                <Input value={draft.full_name} onChange={(event) => editField('full_name', event.target.value)} maxLength={160} required disabled={!canEditSafeFields} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Email</span>
                <Input value={editingProfile.email} readOnly disabled />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Phone</span>
                <Input value={draft.phone} onChange={(event) => editField('phone', event.target.value)} maxLength={40} disabled={!canEditSafeFields} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Avatar URL</span>
                <Input value={draft.avatar_url} onChange={(event) => editField('avatar_url', event.target.value)} maxLength={2048} disabled={!canEditSafeFields} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Employee code</span>
                <Input value={draft.employee_code} onChange={(event) => editField('employee_code', event.target.value)} maxLength={80} disabled={!canEditSafeFields} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Designation</span>
                <Input value={draft.designation} onChange={(event) => editField('designation', event.target.value)} maxLength={120} disabled={!canEditSafeFields} />
              </label>
              {renderSelect('role_id', 'Role', directory.roles, editingProfile.role_id ? 'Choose a role' : 'Unassigned')}
              {renderSelect('state_id', 'State', directory.states, 'No state assignment')}
              {renderSelect('district_id', 'District', directory.districts.filter((district) => !draft.state_id || district.state_id === draft.state_id), 'No district assignment', !draft.state_id)}
              {renderSelect('village_id', 'Village', directory.villages.filter((village) => !draft.district_id || village.district_id === draft.district_id), 'No village assignment', !draft.district_id)}
              <label className="flex items-center gap-3 self-end rounded-md border px-3 py-2.5 text-sm sm:col-span-2">
                <input type="checkbox" checked={draft.is_active} onChange={(event) => editField('is_active', event.target.checked)} className="h-4 w-4 accent-primary" disabled={editingProfile.id === user?.id} />
                <span className="font-medium">Active profile</span>
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">Blank geography values leave the current assignment unchanged. The database function currently has no clear-assignment operation.</p>
            </div>
          )}
          {saveMutation.isError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{saveMutation.error.message}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingProfile(null); setDraft(null); }}>Cancel</Button>
            <Button disabled={saveMutation.isPending || !draft} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}