import type { DayOfWeek, DaySchedule } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

const DAYS_ORDER: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface BusinessHoursEditorProps {
  value: Record<DayOfWeek, DaySchedule>;
  onChange: (value: Record<DayOfWeek, DaySchedule>) => void;
}

export function BusinessHoursEditor({ value, onChange }: BusinessHoursEditorProps) {
  function updateDay(day: DayOfWeek, patch: Partial<DaySchedule>) {
    onChange({ ...value, [day]: { ...value[day], ...patch } });
  }

  return (
    <div className="space-y-2">
      {DAYS_ORDER.map((day) => {
        const schedule = value[day];
        return (
          <div key={day} className="flex items-center gap-3">
            <Switch
              id={`business-hours-${day}`}
              checked={schedule.isWorking}
              onCheckedChange={(checked) =>
                updateDay(day, {
                  isWorking: checked,
                  startTime: checked ? (schedule.startTime ?? '09:00') : null,
                  endTime: checked ? (schedule.endTime ?? '18:00') : null,
                })
              }
            />
            <Label htmlFor={`business-hours-${day}`} className="w-20 shrink-0">
              {DAY_LABELS[day]}
            </Label>
            {schedule.isWorking ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={schedule.startTime ?? ''}
                  onChange={(e) => updateDay(day, { startTime: e.target.value })}
                  className="w-28"
                  aria-label={`${DAY_LABELS[day]} - Hora de início`}
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="time"
                  value={schedule.endTime ?? ''}
                  onChange={(e) => updateDay(day, { endTime: e.target.value })}
                  className="w-28"
                  aria-label={`${DAY_LABELS[day]} - Hora de término`}
                />
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
