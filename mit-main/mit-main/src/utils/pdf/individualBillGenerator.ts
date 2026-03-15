import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RosterEntry } from '../../types/roster';
import { formatMauritianRupees } from '../currency';
import { getStaffInfo, getStaffSalary } from '../rosterAuth';

export interface IndividualBillOptions {
  staffName: string;
  month: number;
  year: number;
  entries: RosterEntry[];
  basicSalary: number; 
  hourlyRate: number;
  shiftCombinations: Array<{
    id: string;
    combination: string;
    hours: number;
  }>;
  numberOfCopies?: number;
}

export class IndividualBillGenerator {
  
  /**
   * Format number without trailing zeros and hide if zero
   */
  private formatNumber(value: number): string {
    if (value === 0) return '';
    return value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');
  }
  
  /**
   * Format currency without trailing zeros and hide if zero
   */
  private formatCurrency(value: number): string {
    if (value === 0) return '';
    return `Rs ${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
  
  /**
   * Generate individual bill for a specific staff member matching the exact PDF format
   */
  async generateBill(options: IndividualBillOptions): Promise<void> {
    const { staffName, month, year, numberOfCopies = 1 } = options;
    
    // Generate the specified number of copies
    for (let copy = 1; copy <= numberOfCopies; copy++) {
      await this.generateSingleBill(options, copy, numberOfCopies);
    }
  }
  
  /**
   * Generate a single bill copy
   */
  private async generateSingleBill(options: IndividualBillOptions, copyNumber: number, totalCopies: number): Promise<void> {
    const { staffName, month, year } = options;
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate content
    await this.generateBillContent(doc, options, copyNumber, totalCopies);
    
    // Generate filename and save
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let filename = `${staffName}_${monthNames[month]}_${year}_Bill`;
    if (totalCopies > 1) {
      filename += `_Copy${copyNumber}`;
    }
    filename += '.pdf';
    
    doc.save(filename);
    
    console.log(`✅ Individual bill generated (${copyNumber}/${totalCopies}):`, filename);
  }
  
  /**
   * Generate bill content into provided PDF document (for batch printing)
   */
  async generateBillContent(doc: jsPDF, options: IndividualBillOptions, copyNumber?: number, totalCopies?: number): Promise<void> {
    // Explicitly declare staffName to ensure proper scope
    const staffName = options.staffName;
    const { month, year, entries, basicSalary, hourlyRate, shiftCombinations } = options;
    
    // Calculate individual hourly rate for this staff member
    const baseStaffName = staffName.replace(/\(R\)$/, '').trim();
    const staffInfo = getStaffInfo(baseStaffName);
    
    // Check if staff member exists in the current auth system
    // If not, don't generate bill for deleted staff
    if (!staffInfo) {
      console.warn(`⚠️ Staff member ${staffName} not found in current staff list. Skipping bill generation.`);
      throw new Error(`Staff member ${staffName} has been removed from the staff list and cannot be included in reports.`);
    }
    
    const staffSalary = getStaffSalary(baseStaffName);
    const individualHourlyRate = staffSalary > 0 ? (staffSalary * 12) / 52 / 40 : hourlyRate;
    
    console.log('📄 Starting individual bill generation for:', staffName);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Filter entries for the specific staff member and month
    const staffEntries = this.filterEntriesForStaff(entries, staffName, month, year);
    
    console.log(`📄 Filtered ${staffEntries.length} entries for ${staffName} in ${monthNames[month]} ${year}`);
    
    // Debug: Log all entries for this staff to see their change_description
    console.log(`🔍 DEBUG: All entries for ${staffName}:`);
    staffEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. Date: ${entry.date}, Shift: ${entry.shift_type}, Change: "${entry.change_description}"`);
    });
    
    // CRITICAL: Also check for special dates by looking at ALL entries for each date
    console.log(`🔍 DEBUG: Checking for special dates in the month...`);
    const allMonthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    const specialDatesInMonth = new Map<string, string>();
    allMonthEntries.forEach(entry => {
      if (entry.change_description && entry.change_description.includes('Special Date:')) {
        const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
        if (match && match[1].trim()) {
          specialDatesInMonth.set(entry.date, match[1].trim());
          console.log(`🌟 Found special date: ${entry.date} - "${match[1].trim()}"`);
        }
      }
    });
    
    console.log(`🌟 Total special dates found in month: ${specialDatesInMonth.size}`);
   
    // Get staff information using base name (without R)
    // const staffInfo = getStaffInfo(baseStaffName);  // Already retrieved above
    
    // Header - compact format
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('X-RAY DEPARTMENT - JAWAHARLAL NEHRU HOSPITAL', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    let headerText = `INDIVIDUAL WORK SUMMARY - ${monthNames[month]} ${year}`;
    if (copyNumber && totalCopies && totalCopies > 1) {
      headerText += ` (Copy ${copyNumber}/${totalCopies})`;
    }
    doc.text(headerText, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
    
    // Staff details section - two-column layout with proper alignment
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Left column - Name, Month/Year, Employee ID
    doc.text('Name:', 20, 35);
    doc.text('Month/Year:', 20, 42);
    doc.text('Employee ID:', 20, 49);
    
    // Left column values  
    doc.setFont('helvetica', 'normal');
    doc.text(`${staffInfo?.firstName || ''} ${staffInfo?.surname || baseStaffName}`, 50, 35);
    doc.text(`${monthNames[month]} ${year}`, 50, 42);
    doc.text(staffInfo?.employeeId || '', 50, 49);
    
    // Right column - Title, Salary, Hourly Rate
    doc.setFont('helvetica', 'bold');
    doc.text('Title:', 120, 35);
    doc.text('Salary:', 120, 42);
    doc.text('Hourly Rate:', 120, 49);
    
    // Right column values
    doc.setFont('helvetica', 'normal');
    doc.text(staffInfo?.title || 'MIT', 150, 35);
    doc.text(`Rs ${(staffSalary || 0).toLocaleString()}`, 150, 42);
    doc.text(`Rs ${individualHourlyRate.toFixed(2)}`, 150, 49);
    
    // Prepare table data for ALL days in the month
    const tableData = this.prepareAllDaysTableData(staffEntries, staffName, month, year, individualHourlyRate, shiftCombinations, specialDatesInMonth);
    
    // Create table with compact layout
    autoTable(doc, {
      startY: 55,
      head: [['Date', 'Morning\n(9-4)', 'Saturday\n(12-10)', 'Evening\n(4-10)', 'Night\nDuty', 'Hours', 'Remarks']],
      body: tableData.rows,
      styles: {
        fontSize: 8,
        cellPadding: 1,
        overflow: 'linebreak',
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold' 
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' }, // Date
        1: { cellWidth: 20, halign: 'center' }, // Morning (9-4) - same as date
        2: { cellWidth: 20, halign: 'center' }, // Saturday (12-10) - same as date
        3: { cellWidth: 20, halign: 'center' }, // Evening (4-10) - same as date
        4: { cellWidth: 20, halign: 'center' }, // Night Duty - same as date
        5: { cellWidth: 15, halign: 'center' }, // Hours
        6: { cellWidth: 35, halign: 'center' }  // Remarks (centered)
      },
      margin: { left: 20, right: 20 },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
      theme: 'grid',
      tableLineWidth: 0.2,
      tableLineColor: [0, 0, 0],
      // Ensure table doesn't extend beyond content
      tableWidth: 'wrap'
    });
    
    // Add summary section
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    this.addSummarySection(doc, tableData.totalDays, tableData.totalHours, tableData.nightDutyCount, individualHourlyRate, finalY);
    
    // Add signature sections
    this.addSignatureSections(doc, tableData.totalDays, tableData.totalHours, tableData.nightDutyCount, individualHourlyRate, finalY);
    
    // Footer - positioned at absolute bottom
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text('X-ray ANWH System', doc.internal.pageSize.getWidth() - 15, pageHeight - 15, { align: 'right' });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() - 15, pageHeight - 10, { align: 'right' });
  }
  
  /**
   * Add compact summary section
   */
  private addSummarySection(doc: jsPDF, totalDays: number, totalHours: number, nightDutyCount: number, hourlyRate: number, startY: number): void {
    // This hourlyRate parameter is actually the individual staff's hourly rate, not the global one
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY:', 15, startY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Calculate total amount from hours 
    const totalAmount = totalHours * hourlyRate;
    
    // Summary details
    //doc.text(`Total Working Days: ${totalDays}`, 15, startY + 8);
    
    
    doc.text(`Total Working Hours: ${this.formatNumber(totalHours)}`, 15, startY + 9);
    
    
    doc.text(`Subtotal (Hours): ${this.formatCurrency(totalAmount)}`, 15, startY + 15);
    
    // Night duty allowance - calculation: (number of nights) × 6 × 0.25 × hourly_rate
    const nightAllowanceBase = nightDutyCount * 6 * 0.25;
    const nightAllowance = nightAllowanceBase * hourlyRate;
    if (nightDutyCount > 0) {
      doc.text(`Total Night Allowance: (${nightDutyCount} × 6 × 0.25 × ${hourlyRate.toFixed(2)}) = ${this.formatCurrency(nightAllowance)}`, 15, startY + 21, { align: 'left' });
    }
    
    // Grand total
    const grandTotal = totalAmount + nightAllowance;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`TOTAL AMOUNT: ${this.formatCurrency(grandTotal)}`, 15, startY - 5 + (nightDutyCount > 0 ? 34 : 28));
  }
  
  /**
   * Add signature sections at bottom
   */
  private addSignatureSections(doc: jsPDF, totalDays: number, totalHours: number, nightDutyCount: number, hourlyRate: number, startY: number): void {
    const totalAmount = totalHours * hourlyRate;
    const nightAllowanceBase = nightDutyCount * 6 * 0.25;
    const nightAllowance = nightAllowanceBase * hourlyRate;
    const grandTotal = totalAmount + nightAllowance;
    
    // Calculate position after summary
    const summaryEndY = (doc as any).lastAutoTable.finalY + 5 + (nightDutyCount > 0 ? 34 : 28) + 10;
    
    // Left side - Date and signature
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Date: _________________________________________', 15, summaryEndY );
    doc.text('Signature:_______________________________________', 15, summaryEndY + 10);
    
    // Right side - Certification
    const rightX = 120;
    doc.setFontSize(10);
    doc.text('Certified correct as per attendance.', rightX, summaryEndY-25);
    doc.text('Name :- ______________________________________', rightX, summaryEndY -17);
    doc.text('Grade: Principal Medical Imaging Technologist.', rightX, summaryEndY - 11);
    doc.text('Signature:- ___________________________________', rightX, summaryEndY -3);
  }
   
  /**
   * Filter roster entries for specific staff member and month
   */
  private filterEntriesForStaff(
    entries: RosterEntry[], 
    staffName: string, 
    month: number, 
    year: number
  ): RosterEntry[] {
    return entries.filter(entry => {
      // Check if entry belongs to this staff member (match base names - both NARAYYA and NARAYYA(R) should match NARAYYA)
      const entryBaseName = entry.assigned_name.replace(/\(R\)$/, '').trim().toUpperCase();
      const staffBaseName = staffName.replace(/\(R\)$/, '').trim().toUpperCase();
      
      if (entryBaseName !== staffBaseName) {
        return false;
      }
      
      // Check if entry is in the specified month/year
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
  }
  
  /**
   * Prepare table data for ALL days in the month (uniform format)
   */
  private prepareAllDaysTableData(
    entries: RosterEntry[], 
    staffName: string,
    month: number,
    year: number,
    hourlyRate: number, 
    shiftCombinations: Array<{id: string, combination: string, hours: number}>,
    specialDatesInMonth: Map<string, string>
  ): {
    rows: string[][];
    totalDays: number;
    totalHours: number;
    nightDutyCount: number;
  } {
    // Group existing entries by date
    const entriesByDate = entries.reduce((groups, entry) => {
      const dateKey = entry.date;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
      return groups;
    }, {} as Record<string, RosterEntry[]>);
    
    // Get all days in the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows: string[][] = [];
    let totalHours = 0;
    let nightDutyCount = 0;
    let totalDays = 0;
    
    // Process ALL days in the month (1 to last day)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayEntries = entriesByDate[dateKey] || [];
      
      // Format as "Day Date" (e.g., "Mon 01/07")
      const dayDate = this.formatDayDate(dateKey);
      
      if (dayEntries.length > 0) {
        // This day has shifts - process them
        totalDays++;
    
        // Combine shifts for the same date
        const shifts: string[] = [];
        let dayHours = 0;
        let remarks = specialDatesInMonth.get(dateKey) || ''; // Get special date info for this date
        
        dayEntries.forEach(entry => {
          shifts.push(entry.shift_type);
          
          // Count night duties for allowance
          if (entry.shift_type === 'Night Duty') {
            nightDutyCount++;
          }
          
          // Calculate hours for this shift
          const shiftHours = this.getShiftHours(entry.shift_type, shiftCombinations);
          dayHours += shiftHours;
        });
        
        // Only show text before asterisk (*) if asterisk exists
        const finalRemarks = remarks.includes('*') ? remarks.split('*')[0].trim() : remarks;
        console.log(`📝 Remarks for ${staffName} on ${dateKey}: "${finalRemarks}" (original: "${remarks}")`);
        
        totalHours += dayHours;
        
        // Create checkmarks for each shift column
        const morningCheck = shifts.includes('Morning Shift (9-4)') ? 'X' : '';
        const saturdayCheck = shifts.includes('Saturday Regular (12-10)') ? 'X' : '';
        const eveningCheck = shifts.includes('Evening Shift (4-10)') ? 'X' : '';
        const nightCheck = shifts.includes('Night Duty') ? 'X' : '';
        
        rows.push([
          dayDate,
          morningCheck,
          saturdayCheck,
          eveningCheck,
          nightCheck,
          this.formatNumber(dayHours),
          finalRemarks // Special date info (only before *) or blank
        ]);
      } else {
        // This day has no shifts - show empty row
        rows.push([
          dayDate,
          '', // No morning shift
          '', // No saturday shift
          '', // No evening shift
          '', // No night duty
          '', // No hours (empty instead of 0.0)
          '' // Blank remarks
        ]);
      }
    }
    
    return {
      rows,
      totalDays,
      totalHours,
      nightDutyCount
    };
  }
  
  /**
   * Get hours for a shift type
   */
  private getShiftHours(shiftType: string, shiftCombinations: Array<{id: string, combination: string, hours: number}>): number {
    // Map roster shift types to combination IDs
    const shiftMapping: Record<string, string> = {
      'Morning Shift (9-4)': '9-4',
      'Evening Shift (4-10)': '4-10',
      'Saturday Regular (12-10)': '12-10',
      'Night Duty': 'N',
      'Sunday/Public Holiday/Special': '9-4'
    };
    
    const combinationId = shiftMapping[shiftType];
    if (!combinationId) {
      console.warn(`Unknown shift type: ${shiftType}`);
      return 0;
    }
    
    // Special case: Night Duty should show 11 hours (since allowances are paid separately)
    if (shiftType === 'Night Duty') {
      return 11;
    }
    
    const combination = shiftCombinations.find(combo => combo.id === combinationId);
    if (!combination) {
      console.warn(`No combination found for shift ID: ${combinationId}`);
      return 0;
    }
    
    return combination.hours;
  }
  
  /**
   * Format date as "ddd dd-mm-yy" (e.g., "Mon 01-07-25")
   */
  private formatDayDate(dateString: string): string {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${dayName} ${day}-${month}-${year}`;
  }
}

// Create singleton instance
export const individualBillGenerator = new IndividualBillGenerator();