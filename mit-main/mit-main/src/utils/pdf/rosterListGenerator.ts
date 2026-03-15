import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RosterEntry } from '../../types/roster';

export interface RosterListOptions {
  month: number;
  year: number;
  entries: RosterEntry[];
  numberOfCopies?: number;
}

export class RosterListGenerator {
  
  /**
   * Generate roster list matching the PDF template format - all on one page
   */
  async generateRosterList(options: RosterListOptions): Promise<void> {
    const { month, year, numberOfCopies = 1 } = options;
    
    // Generate the specified number of copies
    for (let copy = 1; copy <= numberOfCopies; copy++) {
      await this.generateSingleRosterList(options, copy, numberOfCopies);
    }
  }
  
  /**
   * Generate a single roster list copy
   */
  private async generateSingleRosterList(options: RosterListOptions, copyNumber: number, totalCopies: number): Promise<void> {
    const { month, year } = options;
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate content
    await this.generateRosterListContent(doc, options, copyNumber, totalCopies);
    
    // Generate filename and save
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let filename = `Roster_List_${monthNames[month]}_${year}`;
    if (totalCopies > 1) {
      filename += `_Copy${copyNumber}`;
    }
    filename += '.pdf';
    
    doc.save(filename);
    
    console.log(`✅ Roster list generated (${copyNumber}/${totalCopies}):`, filename);
  }
  
  /**
   * Generate roster list content into provided PDF document (for batch printing)
   */
  async generateRosterListContent(doc: jsPDF, options: RosterListOptions, copyNumber?: number, totalCopies?: number): Promise<void> {
    const { month, year, entries } = options;
    
    console.log('📄 Generating roster list');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    let headerText = `X-Ray Roster for month of ${monthNames[month]} ${year}`;
    if (copyNumber && totalCopies && totalCopies > 1) {
      headerText += ` (Copy ${copyNumber}/${totalCopies})`;
    }
    doc.text(headerText, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Filter entries for the specified month/year
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    console.log(`📄 Filtered ${monthEntries.length} entries for ${monthNames[month]} ${year}`);
    
    if (monthEntries.length === 0) {
      // Show "No data" message
      doc.setFontSize(14);
      doc.text('No roster entries found for this month', doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    } else {
      // Create table data with colored text
      const tableData = this.createColoredTableData(monthEntries);
      
      // Create table with new column structure
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Shift', 'Staff Names', 'Remarks']],
        body: tableData,
        willDrawCell: (data) => {
          // Clear staff names column content to prevent default rendering
          if (data.column.index === 2 && data.section === 'body') {
            data.cell.text = [];
          }
        },
        didDrawCell: (data) => {
          // Only draw custom colored text for staff names column in body
          if (data.column.index === 2 && data.section === 'body' && data.row.index >= 0) {
            // Get the staff data for this specific row
            if (data.row.index < tableData.length) {
              const originalRow = tableData[data.row.index];
              const staffNamesData = this.getStaffNamesForRow(originalRow[0], originalRow[1], entries);
              
              if (staffNamesData && staffNamesData.length > 0) {
                // Start drawing from left edge of cell with proper margin
                let currentX = data.cell.x + 2;
                let currentLine = 0;
                const lineHeight = 3;
                let totalLines = 1;

                // Pre-calculate how many lines we'll need
                // CRITICAL: We must use the same coordinate system as during drawing
                const cellLeft = data.cell.x + 2;
                const cellRight = data.cell.x + data.cell.width - 6;
                let tempX = cellLeft; // Start from actual cell position, not 0!

                console.log(`[PRE-CALC] Cell left: ${cellLeft.toFixed(2)}, Cell right: ${cellRight.toFixed(2)}, Staff count: ${staffNamesData.length}`);

                // Set font to match drawing phase
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);

                staffNamesData.forEach((staff, index) => {
                  // Use getStringUnitWidth for consistency with drawing phase
                  const nameWidth = doc.getStringUnitWidth(staff.name) * doc.getFontSize() / doc.internal.scaleFactor;
                  const commaWidth = doc.getStringUnitWidth(',') * doc.getFontSize() / doc.internal.scaleFactor;
                  const spaceWidth = doc.getStringUnitWidth(' ') * doc.getFontSize() / doc.internal.scaleFactor;

                  if (index > 0) {
                    const totalWidth = tempX + commaWidth + spaceWidth + nameWidth;
                    const willFit = totalWidth <= cellRight;
                    console.log(`[PRE-CALC] Index ${index}, Name: "${staff.name}", tempX: ${tempX.toFixed(2)}, nameW: ${nameWidth.toFixed(2)}, commaW: ${commaWidth.toFixed(2)}, spaceW: ${spaceWidth.toFixed(2)}, total: ${totalWidth.toFixed(2)}, cellRight: ${cellRight.toFixed(2)}, willFit: ${willFit}`);

                    // Check if comma + space + name will fit
                    if (!willFit) {
                      // Won't fit, move to next line
                      totalLines++;
                      tempX = cellLeft + nameWidth; // Reset to left edge + name width
                      console.log(`[PRE-CALC] -> NEW LINE ${totalLines}, tempX reset to ${tempX.toFixed(2)}`);
                    } else {
                      // Will fit, add comma + space + name
                      tempX += commaWidth + spaceWidth + nameWidth;
                      console.log(`[PRE-CALC] -> SAME LINE, tempX now ${tempX.toFixed(2)}`);
                    }
                  } else {
                    // First name, start from left edge + name width
                    tempX = cellLeft + nameWidth;
                    console.log(`[PRE-CALC] Index 0, Name: "${staff.name}", tempX: ${tempX.toFixed(2)}`);
                  }
                });
                console.log(`[PRE-CALC] Total lines calculated: ${totalLines}`);
                
                // Calculate starting Y position for vertical centering
                const totalHeight = totalLines * lineHeight;
                let cellY = data.cell.y + (data.cell.height / 2) - (totalHeight / 2) + 2;
                
                // Set font to match table
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');

                console.log(`[DRAW] Starting Y: ${cellY.toFixed(2)}, Cell bounds: ${data.cell.x} to ${(data.cell.x + data.cell.width - 6).toFixed(2)}`);
                let drawLine = 1;

                staffNamesData.forEach((staff, index) => {
                  // Calculate width for this staff name
                  const nameWidth = doc.getTextWidth(staff.name);
                  const commaWidth = doc.getTextWidth(',');
                  const spaceWidth = doc.getTextWidth(' ');

                  // Check if we need comma and space before this name
                  if (index > 0) {
                    const rightEdge = data.cell.x + data.cell.width - 6;
                    const willFit = currentX + commaWidth + spaceWidth + nameWidth <= rightEdge;
                    console.log(`[DRAW] Line ${drawLine}, Index ${index}, Name: "${staff.name}", currentX: ${currentX.toFixed(2)}, nameW: ${nameWidth.toFixed(2)}, commaW: ${commaWidth.toFixed(2)}, spaceW: ${spaceWidth.toFixed(2)}, total: ${(currentX + commaWidth + spaceWidth + nameWidth).toFixed(2)}, rightEdge: ${rightEdge.toFixed(2)}, willFit: ${willFit}`);

                    // Check if comma + space + name will fit on current line
                    if (!willFit) {
                      // Won't fit, move to next line WITHOUT drawing comma
                      currentX = data.cell.x + 2;
                      cellY += lineHeight;
                      drawLine++;
                      console.log(`[DRAW] -> NEW LINE ${drawLine}, Y: ${cellY.toFixed(2)}, X reset to ${currentX.toFixed(2)}`);
                    } else {
                      // Will fit, draw comma and space in previous staff's color
                      const previousStaff = staffNamesData[index - 1];
                      const previousRgbColor = this.hexToRgb(previousStaff.color);
                      doc.setTextColor(previousRgbColor[0], previousRgbColor[1], previousRgbColor[2]);

                      doc.text(',', currentX, cellY);
                      currentX += commaWidth;

                      doc.text(' ', currentX, cellY);
                      currentX += spaceWidth;
                      console.log(`[DRAW] -> SAME LINE, drew comma+space, X now ${currentX.toFixed(2)}`);
                    }
                  } else {
                    console.log(`[DRAW] Line ${drawLine}, Index 0, Name: "${staff.name}", currentX: ${currentX.toFixed(2)}, nameW: ${nameWidth.toFixed(2)}`);
                  }

                  // Now draw the current staff name in their color
                  const rgbColor = this.hexToRgb(staff.color);
                  doc.setTextColor(rgbColor[0], rgbColor[1], rgbColor[2]);

                  // Draw the staff name
                  doc.text(staff.name, currentX, cellY);
                  console.log(`[DRAW] -> Drew "${staff.name}" at X: ${currentX.toFixed(2)}, Y: ${cellY.toFixed(2)}`);
                  currentX += nameWidth;
                });
                
                // Reset color for other cells
                doc.setTextColor(0, 0, 0);
              }
            }
          }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'left',
          valign: 'middle',
          lineWidth: 0.25,
          lineColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.25,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          lineWidth: 0.25,
          lineColor: [0, 0, 0],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 35, halign: 'left', valign: 'middle' },   // Date (fixed width)
          1: { cellWidth: 45, halign: 'left', valign: 'middle' },   // Shift (fixed width)
          2: { cellWidth: 80, halign: 'left', valign: 'middle' },   // Staff Names (80mm width)
          3: { halign: 'center', valign: 'middle' }   // Remarks (center aligned)
        },
        tableLineWidth: 0.25,
        tableLineColor: [0, 0, 0]
      });
    }
    
    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Total Entries: ${monthEntries.length}`, doc.internal.pageSize.getWidth() - 10, doc.internal.pageSize.getHeight() - 15, { align: 'right' });
  }
  
  /**
   * Prepare roster table data in new tabular format
   */
  private prepareRosterTableData(entries: RosterEntry[]): string[][] {
    // Group entries by date and shift type
    const groupedData: Record<string, Record<string, RosterEntry[]>> = {};
    
    entries.forEach(entry => {
      const dateKey = entry.date;
      const shiftType = entry.shift_type;
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {};
      }
      if (!groupedData[dateKey][shiftType]) {
        groupedData[dateKey][shiftType] = [];
      }
      groupedData[dateKey][shiftType].push(entry);
    });
    
    // Convert to table rows
    const tableData: string[][] = [];
    
    // Sort dates
    const sortedDates = Object.keys(groupedData).sort();
    
    sortedDates.forEach(date => {
      const shiftData = groupedData[date];
      
      // Define shift order for consistent display
      const shiftOrder = [
        'Morning Shift (9-4)',
        'Saturday Regular (12-10)', 
        'Evening Shift (4-10)',
        'Night Duty',
        'Sunday/Public Holiday/Special'
      ];
      
      // Process shifts in order
      shiftOrder.forEach(shiftType => {
        const shiftEntries = shiftData[shiftType];
        if (!shiftEntries || shiftEntries.length === 0) return;
        
        // Get staff names with color indicators
        const staffNamesWithColors = this.formatStaffNamesWithColors(shiftEntries);
        
        // Get remarks from special date info
        const remarks = this.extractRemarks(shiftEntries);
        
        // Format shift type for display
        const formattedShift = this.formatShiftTypeForList(shiftType);
        
        tableData.push([
          this.formatDateForList(date),  // DDD dd-mmm-yyyy
          formattedShift,                // Shift type
          staffNamesWithColors,          // Staff names with color indicators
          remarks                        // Remarks
        ]);
      });
    });
    
    return tableData;
  }
  
  /**
   * Format staff names with actual text colors based on their edit status
   */
  private formatStaffNamesWithColors(entries: RosterEntry[]): { text: string; color: number[] }[] {
    return entries.map(entry => {
      const staffName = entry.assigned_name;
      const textColor = this.getTextColor(entry);
      
      return {
        text: staffName,
        color: this.hexToRgb(textColor)
      };
    });
  }
  
  /**
   * Get actual text color for staff name based on edit status
   */
  private getTextColor(entry: RosterEntry): string {
    // HIGHEST PRIORITY: Admin-set text color
    if (entry.text_color) {
      return entry.text_color;
    }
    
    // Check if entry has been reverted to original
    const hasBeenReverted = () => {
      if (!entry.change_description) return false;
      
      // Check if we have original PDF assignment stored
      const originalPdfMatch = entry.change_description.match(/\(Original PDF: ([^)]+)\)/);
      if (originalPdfMatch) {
        let originalPdfAssignment = originalPdfMatch[1].trim();
        
        // Fix missing closing parenthesis if it exists
        if (originalPdfAssignment.includes('(R') && !originalPdfAssignment.includes('(R)')) {
          originalPdfAssignment = originalPdfAssignment.replace('(R', '(R)');
        }
        
        // Check if current assignment matches original PDF assignment (reverted to original)
        return entry.assigned_name === originalPdfAssignment;
      }
      
      return false;
    };
    
    // Check if entry has been edited (name changed)
    const hasBeenEdited = entry.change_description && 
                         entry.change_description.includes('Name changed from') &&
                         entry.last_edited_by;

    if (hasBeenReverted()) {
      return '#059669'; // Green for reverted entries (back to original PDF by ADMIN)
    } else if (hasBeenEdited) {
      return '#dc2626'; // Red for edited entries (by non-ADMIN users)
    } else {
      return '#000000'; // Black for original entries
    }
  }
  
  /**
   * Convert hex color to RGB array for jsPDF
   */
  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0]; // Default to black if parsing fails
  }
  
  /**
   * Get staff names data for a specific row during PDF generation
   */
  private getStaffNamesForRow(date: string, shiftType: string, entries: RosterEntry[]): { name: string; color: string }[] {
    // Find entries that match this date and shift
    const matchingEntries = entries.filter(entry => {
      const formattedDate = this.formatDateForList(entry.date);
      const formattedShift = this.formatShiftTypeForList(entry.shift_type);
      return formattedDate === date && formattedShift === shiftType;
    });
    
    return matchingEntries.map(entry => ({
      name: entry.assigned_name,
      color: this.getTextColor(entry)
    }));
  }
  
  /**
   * Create table data with combined staff names but individual colors
   */
  private createColoredTableData(entries: RosterEntry[]): any[] {
    // Group entries by date and shift type
    const groupedData: Record<string, Record<string, RosterEntry[]>> = {};
    
    entries.forEach(entry => {
      const dateKey = entry.date;
      const shiftType = entry.shift_type;
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {};
      }
      if (!groupedData[dateKey][shiftType]) {
        groupedData[dateKey][shiftType] = [];
      }
      groupedData[dateKey][shiftType].push(entry);
    });
    
    // Convert to table rows with colored text
    const tableData: any[] = [];
    
    // Sort dates
    const sortedDates = Object.keys(groupedData).sort();
    
    sortedDates.forEach(date => {
      const shiftData = groupedData[date];
      
      // Define shift order for consistent display
      const shiftOrder = [
        'Morning Shift (9-4)',
        'Saturday Regular (12-10)', 
        'Evening Shift (4-10)',
        'Night Duty',
        'Sunday/Public Holiday/Special'
      ];
      
      // Process shifts in order
      shiftOrder.forEach(shiftType => {
        const shiftEntries = shiftData[shiftType];
        if (!shiftEntries || shiftEntries.length === 0) return;
        
        // Get remarks from special date info
        const remarks = this.extractRemarks(shiftEntries);
        
        // Format shift type for display
        const formattedShift = this.formatShiftTypeForList(shiftType);
        
        // Combine all staff names with individual colors
        const staffNamesWithColors = shiftEntries.map(entry => ({
          name: entry.assigned_name,
          color: this.getTextColor(entry)
        }));
        
        // Create single row with combined staff names
        const row = [
          this.formatDateForList(date),
          formattedShift,
          staffNamesWithColors.map(s => s.name).join(', '), // Convert to string for display
          remarks
        ];
        
        tableData.push(row);
      });
    });
    
    return tableData;
  }
  
  /**
   * Extract remarks from entries (special date info)
   */
  private extractRemarks(entries: RosterEntry[]): string {
    // Look for special date information in change descriptions
    for (const entry of entries) {
      if (entry.change_description && entry.change_description.includes('Special Date:')) {
        const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
        if (match && match[1].trim()) {
          // Only show text before asterisk (*) if asterisk exists
          const fullRemarks = match[1].trim();
          return fullRemarks.includes('*') ? fullRemarks.split('*')[0].trim() : fullRemarks;
        }
      }
    }
    return ''; // No special remarks
  }
  
  /**
   * Format date as DDD dd-mmm-yyyy (e.g., "Mon 01-Jul-2025")
   */
  private formatDateForList(dateString: string): string {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName} ${day}-${monthName}-${year}`;
  }
  
  /**
   * Format shift type for list display
   */
  private formatShiftTypeForList(shiftType: string): string {
    const shortNames: Record<string, string> = {
      'Morning Shift (9-4)': 'Morning Shift (9-4)',
      'Evening Shift (4-10)': 'Evening Shift (4-10)', 
      'Saturday Regular (12-10)': 'Saturday Regular (12-10)',
      'Night Duty': 'Night Duty',
      'Sunday/Public Holiday/Special': 'Sunday/Public Holiday/Special'
    };
    return shortNames[shiftType] || shiftType;
  }
}

// Create singleton instance
export const rosterListGenerator = new RosterListGenerator();