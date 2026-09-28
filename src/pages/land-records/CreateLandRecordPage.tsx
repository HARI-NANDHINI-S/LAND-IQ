import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { landRecordService } from '@/services/land-records/landRecordService';
import { geoService } from '@/services/geographic/geoService';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';

const recordSchema = z.object({
  record_number: z.string().min(1, 'Record number is required'),
  survey_number: z.string().min(1, 'Survey number is required'),
  patta_number: z.string().optional(),
  state_id: z.string().min(1, 'State is required').uuid('Invalid state'),
  district_id: z.string().min(1, 'District is required').uuid('Invalid district'),
  taluk_id: z.string().min(1, 'Taluk is required').uuid('Invalid taluk'),
  village_id: z.string().min(1, 'Village is required').uuid('Invalid village'),
  land_area: z.number().min(0, 'Area must be positive').optional(),
  land_type: z.string().optional(),
});

type FormValues = z.infer<typeof recordSchema>;

export default function CreateLandRecordPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: record, isLoading: recordLoading } = useQuery({
    queryKey: ['land-record', id],
    queryFn: () => landRecordService.getLandRecord(id!),
    enabled: false && !!id,
  });

  const { register, handleSubmit, setValue, control, watch, formState: { errors, isSubmitting }, reset, getValues } = useForm<FormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      record_number: '',
      survey_number: '',
      patta_number: '',
      state_id: '',
      district_id: '',
      taluk_id: '',
      village_id: '',
      land_area: undefined,
      land_type: 'WET',
    }
  });

  useEffect(() => {
    if (false && record) {
      reset({
        record_number: record.record_number,
        survey_number: record.survey_number,
        patta_number: record.patta_number || '',
        state_id: record.state_id,
        district_id: record.district_id,
        taluk_id: record.taluk_id,
        village_id: record.village_id,
        land_area: record.land_area || undefined,
        land_type: record.land_type || 'WET',
      });
    }
  }, [record, reset]);

  const watchState = watch('state_id');
  const watchDistrict = watch('district_id');
  const watchTaluk = watch('taluk_id');

  const { data: states } = useQuery({ queryKey: ['states'], queryFn: () => geoService.getStates() });
  const { data: districts } = useQuery({ queryKey: ['districts', watchState], queryFn: () => geoService.getDistricts(watchState), enabled: !!watchState });
  const { data: taluks } = useQuery({ queryKey: ['taluks', watchDistrict], queryFn: () => geoService.getTaluks(watchDistrict), enabled: !!watchDistrict });
  const { data: villages } = useQuery({ queryKey: ['villages', watchTaluk], queryFn: () => geoService.getVillages(watchTaluk), enabled: !!watchTaluk });

  // DEBUG: Log actual data from geoService
  console.log('DEBUG states data:', JSON.stringify(states?.slice(0, 2)));
  console.log('DEBUG districts data:', JSON.stringify(districts?.slice(0, 2)));
  console.log('DEBUG taluks data:', JSON.stringify(taluks?.slice(0, 2)));
  console.log('DEBUG villages data:', JSON.stringify(villages?.slice(0, 2)));

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (false) {
        return landRecordService.updateLandRecord(id!, data as any);
      } else {
        return landRecordService.createLandRecord({ ...data, verification_status: 'PENDING', record_status: 'ACTIVE' } as any);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['land-records'] });
      if (false) {
        queryClient.invalidateQueries({ queryKey: ['land-record', id] });
        navigate('/land-records/' + id);
      } else {
        navigate('/land-records/' + data.id);
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save record.');
    }
  });

  const onSubmit = (data: FormValues) => {
    console.log("LOCATION FORM VALUES", {
      state_id: getValues("state_id"),
      district_id: getValues("district_id"),
      taluk_id: getValues("taluk_id"),
      village_id: getValues("village_id"),
    });
    setErrorMsg(null);
    mutation.mutate(data);
  };

  if (false && !hasPermission('land_record:update')) {
    return <div className="p-6 text-destructive font-medium">You do not have permission to edit records.</div>;
  }
  if (!false && !hasPermission('land_record:create')) {
    return <div className="p-6 text-destructive font-medium">You do not have permission to create records.</div>;
  }

  if (false && recordLoading) {
    return <div className="p-6 flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> Loading record...</div>;
  }

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Land Record</h1>
          <p className="text-sm text-muted-foreground">
            Enter details for a new digitized land record.
          </p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit, (errs) => { console.log("FORM ERRORS", errs); console.log("LOCATION VALUES AT ERROR", { state_id: getValues("state_id"), district_id: getValues("district_id"), taluk_id: getValues("taluk_id"), village_id: getValues("village_id") }); })} className="space-y-6">
            {errorMsg && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm font-medium">
                {errorMsg}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="record_number">Record Number *</Label>
                <Input id="record_number" {...register('record_number')} disabled={isSubmitting} />
                {errors.record_number && <p className="text-xs text-destructive">{errors.record_number.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey_number">Survey Number *</Label>
                <Input id="survey_number" {...register('survey_number')} disabled={isSubmitting} />
                {errors.survey_number && <p className="text-xs text-destructive">{errors.survey_number.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="patta_number">Patta Number</Label>
                <Input id="patta_number" {...register('patta_number')} disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="land_area">Area</Label>
                <Input id="land_area" type="number" step="0.01" {...register('land_area', { setValueAs: v => v === '' ? undefined : parseFloat(v) })} disabled={isSubmitting} />
                {errors.land_area && <p className="text-xs text-destructive">{errors.land_area.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="land_type">Land Type</Label>
                <Controller
                  name="land_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WET">Wet</SelectItem>
                    <SelectItem value="DRY">Dry</SelectItem>
                    <SelectItem value="PURAMBOKE">Puramboke</SelectItem>
                  </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-4">Location *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Controller
                    name="state_id"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        value={field.value ?? ""} 
                        onValueChange={(val) => { 
                          field.onChange(val); 
                          setValue('district_id', ''); 
                          setValue('taluk_id', ''); 
                          setValue('village_id', ''); 
                        }}
                        disabled={isSubmitting}
                      >
                    <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                    <SelectContent>
                      {states?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                    )}
                  />
                  {errors.state_id && <p className="text-xs text-destructive">{errors.state_id.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label>District</Label>
                  <Controller
                    name="district_id"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        value={field.value ?? ""} 
                        onValueChange={(val) => { 
                          field.onChange(val); 
                          setValue('taluk_id', ''); 
                          setValue('village_id', ''); 
                        }}
                        disabled={isSubmitting || !watchState}
                      >
                    <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
                    <SelectContent>
                      {districts?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                    )}
                  />
                  {errors.district_id && <p className="text-xs text-destructive">{errors.district_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Taluk</Label>
                  <Controller
                    name="taluk_id"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        value={field.value ?? ""} 
                        onValueChange={(val) => { 
                          field.onChange(val); 
                          setValue('village_id', ''); 
                        }}
                        disabled={isSubmitting || !watchDistrict}
                      >
                    <SelectTrigger><SelectValue placeholder="Select Taluk" /></SelectTrigger>
                    <SelectContent>
                      {taluks?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                    )}
                  />
                  {errors.taluk_id && <p className="text-xs text-destructive">{errors.taluk_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Village</Label>
                  <Controller
                    name="village_id"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        value={field.value ?? ""} 
                        onValueChange={field.onChange}
                        disabled={isSubmitting || !watchTaluk}
                      >
                    <SelectTrigger><SelectValue placeholder="Select Village" /></SelectTrigger>
                    <SelectContent>
                      {villages?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                    )}
                  />
                  {errors.village_id && <p className="text-xs text-destructive">{errors.village_id.message}</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Record</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}