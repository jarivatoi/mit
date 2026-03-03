import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RosterEntry } from '../types/roster';

export interface PDFExportOptions {
  entries: RosterEntry[];
  month: number;
  year: number;
  title?: string;
}

export class PDFExporter {
  
  /**
   * Export roster entries to PDF table format
   */
  async exportToPDF(options: PDFExportOptions): Promise<void> {
    const { entries, month, year, title = 'Roster Schedule' } = options;
    
    console.log('📄 Starting PDF export with options:', options);
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'landscape', // Better for table layout
      unit: 'mm',
      format: 'a4'
    });
    
    // Set up document properties
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthYear = `${monthNames[month]} ${year}`;
    const documentTitle = `${title} - ${monthYear}`;
    
    // Add title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(documentTitle, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Add generation timestamp
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const timestamp = new Date().toLocaleString();
    doc.text(`Generated on: ${timestamp}`, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    // Filter entries for the specified month/year
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    console.log(`📄 Filtered ${monthEntries.length} entries for ${monthYear}`);
    
    if (monthEntries.length === 0) {
      // Show "No data" message
      doc.setFontSize(14);
      doc.text('No roster entries found for this month', doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });
    } else {
      // Prepare table data
      const tableData = this.prepareTableData(monthEntries);
      
      // Create table using autoTable
      autoTable(doc, {
        startY: 40,
        head: [['Date', 'Day', 'Shift Type', 'Assigned Staff', 'Last Edited By', 'Last Edited At', 'Remarks']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'center',
          fontStyle: 'bold'
        },
        headStyles: {
          fillColor: [79, 70, 229], // Indigo color
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Light gray
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Date
          1: { cellWidth: 20 }, // Day
          2: { cellWidth: 45 }, // Shift Type
          3: { cellWidth: 40 }, // Assigned Staff
          4: { cellWidth: 35 }, // Last Edited By
          5: { cellWidth: 40 }, // Last Edited At
          6: { cellWidth: 50 }  // Remarks
        },
        margin: { left: 10, right: 10 },
        tableWidth: 'auto',
        theme: 'striped'
      });
    }
    
    // Add footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // Generate filename
    const filename = `Roster_${monthYear.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Save the PDF
    doc.save(filename);
    
    console.log('✅ PDF export completed:', filename);
  }
  
  /**
   * Prepare table data from roster entries
   */
  private prepareTableData(entries: RosterEntry[]): string[][] {
    // Sort entries by date, then by shift type
    const sortedEntries = [...entries].sort((a, b) => {
      const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      // Secondary sort by shift type
      const shiftOrder = [
        'Morning Shift (9-4)',
        'Saturday Regular (12-10)',
        'Evening Shift (4-10)',
        'Night Duty',
        'Sunday/Public Holiday/Special'
      ];
      
      const aIndex = shiftOrder.indexOf(a.shift_type);
      const bIndex = shiftOrder.indexOf(b.shift_type);
      return aIndex - bIndex;
    });
    
    return sortedEntries.map(entry => [
      this.formatDate(entry.date),
      this.getDayName(entry.date),
      this.formatShiftType(entry.shift_type),
      entry.assigned_name,
      entry.last_edited_by || 'System',
      this.formatTimestamp(entry.last_edited_at),
      this.extractRemarks(entry)
    ]);
  }
  
  /**
   * Format date for PDF display
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  /**
   * Get day name for date
   */
  private getDayName(dateString: string): string {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[date.getDay()];
  }
  
  /**
   * Format shift type for better PDF display
   */
  private formatShiftType(shiftType: string): string {
    const shortNames: Record<string, string> = {
      'Morning Shift (9-4)': 'Morning (9-4)',
      'Evening Shift (4-10)': 'Evening (4-10)',
      'Saturday Regular (12-10)': 'Saturday (12-10)',
      'Night Duty': 'Night Duty',
      'Sunday/Public Holiday/Special': 'Special (9-4)'
    };
    return shortNames[shiftType] || shiftType;
  }

  /**
   * Format timestamp for PDF display
   */
  private formatTimestamp(timestamp: string): string {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle custom format: "20-01-2025 09:00:00"
      if (timestamp.includes('-') && timestamp.includes(' ')) {
        const [datePart, timePart] = timestamp.split(' ');
        const [day, month, year] = datePart.split('-');
        const [hour, minute, second] = (timePart || '00:00:00').split(':');
        
        const date = new Date(
          parseInt(year), 
          parseInt(month) - 1, 
          parseInt(day), 
          parseInt(hour || '0'), 
          parseInt(minute || '0'), 
          parseInt(second || '0')
        );
        
        // Validate the parsed date
        if (isNaN(date.getTime())) {
          return '';
        }
        
        // Format as: dd/mm/yyyy hh:mm
        const formattedDate = `${day}/${month}/${year}`;
        const formattedTime = `${hour}:${minute}`;
        return `${formattedDate} ${formattedTime}`;
      }
      
      // Handle ISO format or other standard formats
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Format as dd/mm/yyyy hh:mm
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hour}:${minute}`;
    } catch (error) {
      console.warn('Failed to parse timestamp:', timestamp, error);
      return '';
    }
  }
  
  /**
   * Extract remarks from entry (special date info)
   */
  private extractRemarks(entry: RosterEntry): string {
    // Look for special date information in change descriptions
    if (entry.change_description && entry.change_description.includes('Special Date:')) {
      const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
      if (match && match[1].trim()) {
        // For export/import PDF: Include FULL remarks text (including after *)
        return match[1].trim();
      }
    }
    return ''; // No special remarks
  }
}

// Create singleton instance
export const pdfExporter = new PDFExporter();