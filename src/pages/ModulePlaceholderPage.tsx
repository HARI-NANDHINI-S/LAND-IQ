import { Construction } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ModulePlaceholderPage({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{moduleName}</h1>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md text-center border-dashed">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Construction className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Module Under Construction</CardTitle>
            <CardDescription>
              The {moduleName} module is part of the LAND-IQ platform and will be implemented in the next development phase.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
