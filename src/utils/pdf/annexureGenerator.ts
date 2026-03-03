import { jsPDF } from 'jspdf'; 
import autoTable from 'jspdf-autotable';
import { RosterEntry } from '../../types/roster';
import { formatMauritianRupees } from '../currency';
import { getStaffInfo, getStaffSalary } from '../rosterAuth';

export interface AnnexureOptions {
  month: number;
  year: number;
  entries: RosterEntry[];
  hourlyRate: number;
  shiftCombinations: Array<{
    id: string;
    combination: string;
    hours: number;
  }>;
  numberOfCopies?: number;
}

export class AnnexureGenerator {
  
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
   * Format salary without decimal places
   */
  private formatSalary(value: number): string {
    if (value === 0) return '';
    return `Rs ${value.toLocaleString('en-US')}`;
  }

  /**
   * Generate annexure matching the exact PDF format
   */
  async generateAnnexure(options: AnnexureOptions): Promise<void> {
    const { month, year, numberOfCopies = 1 } = options;
    
    // Generate the specified number of copies
    for (let copy = 1; copy <= numberOfCopies; copy++) {
      await this.generateSingleAnnexure(options, copy, numberOfCopies);
    }
  }
  
  /**
   * Generate a single annexure copy
   */
  private async generateSingleAnnexure(options: AnnexureOptions, copyNumber: number, totalCopies: number): Promise<void> {
    const { month, year } = options;
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate content
    await this.generateAnnexureContent(doc, options, copyNumber, totalCopies);
    
    // Generate filename and save
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let filename = `Annexure_${monthNames[month]}_${year}`;
    if (totalCopies > 1) {
      filename += `_Copy${copyNumber}`;
    }
    filename += '.pdf';
    
    doc.save(filename);
    
    console.log(`✅ Annexure generated (${copyNumber}/${totalCopies}):`, filename);
  }
  
  /**
   * Generate annexure content into provided PDF document (for batch printing)
   */
  async generateAnnexureContent(doc: jsPDF, options: AnnexureOptions, copyNumber?: number, totalCopies?: number): Promise<void> {
    const { month, year, entries, hourlyRate, shiftCombinations } = options;
    
    console.log('📄 Generating annexure for all staff');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Header - matching the original format
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('X-RAY DEPARTMENT - JAWAHARLAL NEHRU HOSPITAL', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    let headerText = `ANNEXURE - ${monthNames[month]} ${year}`;
    if (copyNumber && totalCopies && totalCopies > 1) {
      headerText += ` (Copy ${copyNumber}/${totalCopies})`;
    }
    doc.text(headerText, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
    
    // Calculate summary for all staff
    const staffSummaries = this.calculateStaffSummaries(entries, month, year, hourlyRate, shiftCombinations);
    
    // Prepare table data - matching the PDF format exactly
    const tableData = staffSummaries.map((summary, index) => [
      (index + 1).toString(), // Serial number
      summary.fullName, // Full name instead of staff name
      summary.employeeId, // ID number
      this.formatSalary(summary.salary), // Salary (no decimals)
      this.formatNumber(summary.totalHours), // Hours payable (without night allowance)
      this.formatNumber(summary.nightDutyHours), // Night allowance hours
      this.formatCurrency(summary.grandTotal)
    ]);
    
    // Create table matching the original format
    autoTable(doc, {
      startY: 35,
      head: [['S.No', 'NAME\n(Full Name)', 'ID\nNUMBER', 'SALARY', 'NO OF HRS\nPAYABLE\n(Hrs)', 'NIGHT\nALLOWANCE\n(Hrs)', 'AMOUNT']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold'
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2,
        minCellHeight: 8
      },
      margin: { left: 5, right: 5 },
      theme: 'grid',
      tableWidth: 'auto',
      tableLineWidth: 0.3,
      tableLineColor: [0, 0, 0],
      columnStyles: {},
      didParseCell: function(data) {
        // Auto-adjust font size based on content length
        if (data.section === 'body') {
          const cellText = data.cell.text.join(' ');
          if (cellText.length > 20) {
            
            //data.cell.styles.fontSize = 6;
            data.cell.styles.fontSize = 9;
          } else if (cellText.length > 10) {
            //data.cell.styles.fontSize = 7;
         data.cell.styles.fontSize = 9;
          } else {
            data.cell.styles.fontSize = 9;
          }
        }
      }
    });
    
    // Add grand totals at the bottom
    const grandTotalDays = staffSummaries.reduce((sum, s) => sum + s.totalDays, 0);
    const grandTotalHours = staffSummaries.reduce((sum, s) => sum + s.totalHours, 0);
    const grandTotalSalary = staffSummaries.reduce((sum, s) => sum + s.salary, 0);
    const grandNightDutyHours = staffSummaries.reduce((sum, s) => sum + s.nightDutyHours, 0);
    const grandSubtotal = staffSummaries.reduce((sum, s) => sum + s.totalAmount, 0);
    const grandNightAllowance = staffSummaries.reduce((sum, s) => sum + s.nightAllowance, 0);
    const grandTotal = staffSummaries.reduce((sum, s) => sum + s.grandTotal, 0);
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    /*
    // Grand totals row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('GRAND TOTALS:', 15, finalY);
    doc.text(`Total Salary: ${this.formatCurrency(grandTotalSalary)}`, 15, finalY + 8);
    doc.text(`Total Hours Payable: ${this.formatNumber(grandTotalHours)}`, 15, finalY + 16);
    doc.text(`Total Night Allowance Hours: ${this.formatNumber(grandNightDutyHours)}`, 15, finalY + 24);
    
    doc.setFontSize(12);
    doc.text(`GRAND TOTAL AMOUNT: ${this.formatCurrency(grandTotal)}`, 15, finalY + 36);
*/
 doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Certified correct as per annexture:-_________________________', 80, finalY + 100);
    doc.text('(Principal Medical Imaging Technologist):', 95, finalY + 115);
    
    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear();
    doc.text(`Generated on: ${day}/${currentMonth}/${currentYear}`, 15, doc.internal.pageSize.getHeight() - 15);
    doc.text('X-ray ANWH System', doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 15, { align: 'right' });
  }
  
  
  /**
   * Calculate summaries for all staff with night allowance
   */
  private calculateStaffSummaries(
    entries: RosterEntry[], 
    month: number, 
    year: number, 
    hourlyRate: number, 
    shiftCombinations: Array<{id: string, combination: string, hours: number}>
  ) {
    const staffSummaries: Array<{
      staffName: string;
      fullName: string;
      employeeId: string;
      salary: number;
      totalDays: number;
      totalHours: number;
      totalAmount: number;
      nightDutyCount: number;
      nightDutyHours: number;
      nightAllowance: number;
      grandTotal: number;
    }> = [];
    
    // Group entries by staff
    const staffGroups: Record<string, RosterEntry[]> = {};
    
    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate.getMonth() === month && entryDate.getFullYear() === year) {
        // Use base name (remove (R) suffix) to group same person together
        const baseName = entry.assigned_name.replace(/\(R\)$/, '').trim().toUpperCase();
        if (!staffGroups[baseName]) {
          staffGroups[baseName] = [];
        }
        staffGroups[baseName].push(entry);
      }
    });
    
    // Calculate for each staff member who actually has entries
    Object.entries(staffGroups).forEach(([baseName, staffEntries]) => {
      let totalHours = 0;
      let nightDutyCount = 0;
      let nightDutyHours = 0;
      
      staffEntries.forEach(entry => {
        // Count night duties for allowance calculation
        if (entry.shift_type === 'Night Duty') {
          nightDutyCount++;
        }
        
        // Map and calculate hours
        const shiftMapping: Record<string, string> = {
          'Morning Shift (9-4)': '9-4',
          'Evening Shift (4-10)': '4-10',
          'Saturday Regular (12-10)': '12-10',
          'Night Duty': 'N',
          'Sunday/Public Holiday/Special': '9-4'
        };
        
        const shiftId = shiftMapping[entry.shift_type];
        if (shiftId) {
          const combination = shiftCombinations.find(combo => combo.id === shiftId);
          if (combination) {
            // Special case: Night Duty should use 11 hours (since allowances are paid separately)
            const hoursToUse = entry.shift_type === 'Night Duty' ? 11 : combination.hours;
            totalHours += hoursToUse;
          }
        }
      });
      
      // Calculate night allowance hours: (number of nights) × 6 × 0.25
      nightDutyHours = nightDutyCount * 6 * 0.25;
      
      // Use base name for staff identification (NARAYYA and NARAYYA(R) are the same person)
      const actualStaffName = baseName;
      
      // Get staff info for full name, ID, and salary using base name (without R)
      const baseStaffName = actualStaffName.replace(/\(R\)$/, '').trim();
      const staffInfo = getStaffInfo(baseStaffName);
      const staffSalary = getStaffSalary(baseStaffName);
      
      // Calculate individual hourly rate: (salary × 12) ÷ 52 ÷ 40
      const individualHourlyRate = staffSalary > 0 ? (staffSalary * 12) / 52 / 40 : hourlyRate;
      const fullName = staffInfo ? `${staffInfo.surname || baseStaffName} ${staffInfo.firstName || ''}`.trim() : baseStaffName;
      const employeeId = staffInfo?.employeeId || '';
      const salary = staffSalary || 0;
      
      // Debug logging to understand why TEELUCK might still be appearing
      console.log(`🔍 Staff Summary Debug for ${baseName}:`, {
        totalHours,
        nightDutyCount,
        staffEntriesLength: staffEntries.length,
        willBeIncluded: totalHours > 0 || nightDutyCount > 0,
        staffExistsInAuth: !!staffInfo
      });
      
      // Only include staff with actual roster entries (hours > 0 or night duties)
      // AND who actually exist in the current staff list
      // This prevents staff who have been deleted from appearing in reports
      if ((totalHours > 0 || nightDutyCount > 0) && staffInfo) {
        staffSummaries.push({
          staffName: baseStaffName,
          fullName: fullName,
          employeeId: employeeId,
          salary: salary,
          totalDays: staffEntries.length,
          totalHours,
          totalAmount: totalHours * individualHourlyRate,
          nightDutyCount,
          nightDutyHours,
          nightAllowance: nightDutyHours * individualHourlyRate,
          grandTotal: (totalHours * individualHourlyRate) + (nightDutyHours * individualHourlyRate)
        });
      } else if (staffEntries.length > 0) {
        // Log cases where staff has entries but 0 hours/night duties or doesn't exist in auth
        if (!staffInfo) {
          console.log(`⚠️ Staff ${baseName} has ${staffEntries.length} entries but doesn't exist in current staff list:`, staffEntries);
        } else {
          console.log(`⚠️ Staff ${baseName} has ${staffEntries.length} entries but 0 hours/night duties:`, staffEntries);
        }
      }
    });
    
    // Sort by staff name
    return staffSummaries.sort((a, b) => a.staffName.localeCompare(b.staffName));
  }
}

// Create singleton instance
export const annexureGenerator = new AnnexureGenerator();