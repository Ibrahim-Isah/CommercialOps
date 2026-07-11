"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/** Calendar-popover date picker, same UX as the certificates dialog. */
export function DateField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </Label>
      <div className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "d MMM yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              onSelect={(d) => {
                if (d) onChange(format(d, "yyyy-MM-dd"));
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {optional && value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
