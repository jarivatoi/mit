export interface Shift {
  id: string;
  label: string;
  time: string;
  color: string;
  displayColor: string;
}

export interface DaySchedule {
  [key: string]: string[]; // date string -> array of shift IDs
}

export interface SpecialDates {
  [key: string]: boolean; // date string -> is special date
}

export interface ShiftCombination {
  id: string;
  combination: string;
  hours: number;
}

export interface Settings {
  basicSalary: number;
  hourlyRate: number;
  shiftCombinations: ShiftCombination[];
}

export interface MonthlySalaries {
  [key: string]: number; // monthKey (YYYY-MM) -> salary
}

export interface ExportData {
  schedule: DaySchedule;
  specialDates: SpecialDates;
  settings: Settings;
  scheduleTitle: string;
  exportDate: string;
  version: string;
  monthlySalaries?: MonthlySalaries;
}

export interface AuthCode {
  code: string;
  name: string;
  title?: string;
  salary?: number;
  employeeId?: string;
  firstName?: string;
  surname?: string;
}