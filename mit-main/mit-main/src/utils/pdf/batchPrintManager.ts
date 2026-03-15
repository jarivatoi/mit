// Batch PDF printing manager for generating and printing multiple PDFs
import { jsPDF } from 'jspdf';
import { monthlyReportGenerator } from './monthlyReportGenerator';
import { individualBillGenerator } from './individualBillGenerator';
import { annexureGenerator } from './annexureGenerator';
import { rosterListGenerator } from './rosterListGenerator';
import { RosterEntry } from '../../types/roster';
import { getStaffInfo } from '../rosterAuth';

export interface BatchPrintOptions {
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
  reportTypes: ('individual' | 'annexure' | 'roster')[];
  selectedStaff?: string[]; // For individual reports only
  combineIntoSinglePDF?: boolean;
  printWindow?: Window;
}

export interface BatchPrintProgress {
  current: number;
  total: number;
  currentTask: string;
  completed: boolean;
  error?: string;
}

export class BatchPrintManager {
  private printWindow: Window | null = null;
  private currentPrintIndex = 0;
  private pdfDocuments: { doc: jsPDF; filename: string }[] = [];
  
  /**
   * Generate a single combined PDF with all reports
   */
  async generateCombinedPDF(
    options: BatchPrintOptions,
    onProgress?: (progress: BatchPrintProgress) => void
  ): Promise<void> {
    const { month, year, entries, basicSalary, hourlyRate, shiftCombinations, reportTypes, selectedStaff } = options;
    
    this.pdfDocuments = [];
    this.currentPrintIndex = 0;
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Filter entries for the month
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    if (monthEntries.length === 0) {
      throw new Error(`No roster entries found for ${monthNames[month]} ${year}`);
    }
    
    // Calculate total tasks
    let totalTasks = 0;
    if (reportTypes.includes('individual')) {
      const staffList = selectedStaff || this.getUniqueStaffMembers(monthEntries);
      totalTasks += staffList.length;
    }
    if (reportTypes.includes('annexure')) totalTasks += 1;
    if (reportTypes.includes('roster')) totalTasks += 1;
    
    let currentTask = 0;
    
    // Create a single PDF document for all reports
    const combinedDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Start with the first page (don't delete it)
    let isFirstPage = true;
    
    try {
      // Generate individual bills
      if (reportTypes.includes('individual')) {
        const staffList = selectedStaff || this.getUniqueStaffMembers(monthEntries);
        
        for (const staffName of staffList) {
          currentTask++;
          onProgress?.({
            current: currentTask,
            total: totalTasks,
            currentTask: `Generating bill for ${staffName}`,
            completed: false
          });
          
          // Add new page for this bill (except for the first one)
          if (!isFirstPage) {
            combinedDoc.addPage();
          }
          isFirstPage = false;
          
          // Generate content directly into the combined document
          await individualBillGenerator.generateBillContent(combinedDoc, {
            staffName,
            month,
            year,
            entries: monthEntries,
            basicSalary,
            hourlyRate,
            shiftCombinations
          });
          
          // Small delay to prevent browser overwhelm
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Generate annexure
      if (reportTypes.includes('annexure')) {
        currentTask++;
        onProgress?.({
          current: currentTask,
          total: totalTasks,
          currentTask: 'Generating annexure summary',
          completed: false
        });
        
        // Add new page for annexure (except for the first one)
        if (!isFirstPage) {
          combinedDoc.addPage();
        }
        isFirstPage = false;
        
        await annexureGenerator.generateAnnexureContent(combinedDoc, {
          month,
          year,
          entries: monthEntries,
          hourlyRate,
          shiftCombinations
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Generate roster list
      if (reportTypes.includes('roster')) {
        currentTask++;
        onProgress?.({
          current: currentTask,
          total: totalTasks,
          currentTask: 'Generating roster list',
          completed: false
        });
        
        // Add new page for roster list (except for the first one)
        if (!isFirstPage) {
          combinedDoc.addPage();
        }
        isFirstPage = false;
        
        await rosterListGenerator.generateRosterListContent(combinedDoc, {
          month,
          year,
          entries: monthEntries
        });
      }
      
      onProgress?.({
        current: totalTasks,
        total: totalTasks,
        currentTask: 'Finalizing combined PDF...',
        completed: false
      });
      
      // Generate filename for combined PDF
      const filename = `Combined_Reports_${monthNames[month]}_${year}.pdf`;
      
      // Generate the PDF blob and URL
      const pdfBlob = combinedDoc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open PDF in same browser tab using blob URL
      window.open(pdfUrl, '_blank');
      
      onProgress?.({
        current: totalTasks,
        total: totalTasks,
        currentTask: `Combined PDF opened in browser: ${filename}`,
        completed: true
      });
      
      console.log('✅ Combined PDF generated successfully:', filename);
      
    } catch (error) {
      console.error('❌ Combined PDF generation failed:', error);
      onProgress?.({
        current: currentTask,
        total: totalTasks,
        currentTask: 'Combined PDF generation failed',
        completed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Generate all PDFs and prepare for batch printing (opens print window)
   */
  async generateAndPrintBatch(
    options: BatchPrintOptions,
    onProgress?: (progress: BatchPrintProgress) => void
  ): Promise<void> {
    const { month, year, entries, basicSalary, hourlyRate, shiftCombinations, reportTypes, selectedStaff } = options;
    
    console.log('🖨️ Starting batch PDF generation for printing...');
    
    this.pdfDocuments = [];
    this.currentPrintIndex = 0;
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Filter entries for the month
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    if (monthEntries.length === 0) {
      throw new Error(`No roster entries found for ${monthNames[month]} ${year}`);
    }
    
    // Calculate total tasks
    let totalTasks = 0;
    if (reportTypes.includes('individual')) {
      const staffList = selectedStaff || this.getUniqueStaffMembers(monthEntries);
      totalTasks += staffList.length;
    }
    if (reportTypes.includes('annexure')) totalTasks += 1;
    if (reportTypes.includes('roster')) totalTasks += 1;
    
    let currentTask = 0;
    
    try {
      // Generate individual bills
      if (reportTypes.includes('individual')) {
        const staffList = selectedStaff || this.getUniqueStaffMembers(monthEntries);
        
        for (const staffName of staffList) {
          currentTask++;
          onProgress?.({
            current: currentTask,
            total: totalTasks,
            currentTask: `Generating bill for ${staffName}`,
            completed: false
          });
          
          const doc = await this.generateIndividualBillPDF({
            staffName,
            month,
            year,
            entries: monthEntries,
            basicSalary,
            hourlyRate,
            shiftCombinations
          });
          
          this.pdfDocuments.push({
            doc,
            filename: `${staffName}_${monthNames[month]}_${year}_Bill.pdf`
          });
          
          // Small delay to prevent browser overwhelm
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Generate annexure
      if (reportTypes.includes('annexure')) {
        currentTask++;
        onProgress?.({
          current: currentTask,
          total: totalTasks,
          currentTask: 'Generating annexure summary',
          completed: false
        });
        
        const doc = await this.generateAnnexurePDF({
          month,
          year,
          entries: monthEntries,
          hourlyRate,
          shiftCombinations
        });
        
        this.pdfDocuments.push({
          doc,
          filename: `Annexure_${monthNames[month]}_${year}.pdf`
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Generate roster list
      if (reportTypes.includes('roster')) {
        currentTask++;
        onProgress?.({
          current: currentTask,
          total: totalTasks,
          currentTask: 'Generating roster list',
          completed: false
        });
        
        const doc = await this.generateRosterListPDF({
          month,
          year,
          entries: monthEntries
        });
        
        this.pdfDocuments.push({
          doc,
          filename: `Roster_List_${monthNames[month]}_${year}.pdf`
        });
      }
      
      onProgress?.({
        current: totalTasks,
        total: totalTasks,
        currentTask: 'Opening print window...',
        completed: false
      });
      
      // Create a new print window to display all PDFs in one tab
      const windowToUse = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      onProgress?.({
        current: totalTasks,
        total: totalTasks,
        currentTask: 'Print window opened',
        completed: true
      });
      
    } catch (error) {
      console.error('❌ Batch generation failed:', error);
      onProgress?.({
        current: currentTask,
        total: totalTasks,
        currentTask: 'Print preparation failed',
        completed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Display all PDFs in a single tab with menu bars above each PDF
   */
  private async displayAllPDFsInSingleTab(printWindow: Window): Promise<void> {
    if (!printWindow) {
      throw new Error('Print window not provided');
    }
    
    console.log(`🖨️ Displaying ${this.pdfDocuments.length} PDFs in single tab with menu bars`);
    
    // Wait for window to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Documents - ${this.pdfDocuments.length} Files</title>
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              font-family: Arial, sans-serif; 
              background: #f5f5f5;
            }
            .document-section { 
              margin-bottom: 20px; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .document-header { 
              background: #4f46e5; 
              color: white; 
              padding: 12px 20px; 
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-weight: 600;
            }
            .document-actions {
              display: flex;
              gap: 10px;
            }
            .action-btn {
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            }
            .action-btn:hover {
              background: rgba(255,255,255,0.3);
            }
            .pdf-content { 
              width: 100%; 
              height: 600px; 
              border: none; 
              background: white;
            }
            .main-header {
              background: #1f2937;
              color: white;
              padding: 20px;
              text-align: center;
              margin-bottom: 20px;
            }
            .main-actions {
              text-align: center;
              margin: 20px 0;
            }
            .main-btn {
              background: #10b981;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              margin: 0 10px;
            }
            .main-btn:hover {
              background: #059669;
            }
            .close-btn {
              background: #6b7280;
            }
            .close-btn:hover {
              background: #4b5563;
            }
          </style>
        </head>
        <body>
          <div class="main-header">
            <h1>Print Preview - ${this.pdfDocuments.length} Documents</h1>
            <p>Each document has its own menu bar. Use the main Print All button or individual Print buttons.</p>
          </div>
          
          <div class="main-actions">
            <button onclick="window.close()" class="main-btn close-btn">
              Close Window
            </button>
          </div>
    `);
    
    // Add each PDF with its own menu bar
    for (let i = 0; i < this.pdfDocuments.length; i++) {
      const pdfDoc = this.pdfDocuments[i];
      const pdfDataUrl = pdfDoc.doc.output('datauristring');
      
      printWindow.document.write(`
        <div class="document-section">
          <div class="document-header">
            <span>${pdfDoc.filename}</span>
            <div class="document-actions">
              <button class="action-btn" onclick="
                const iframe = document.getElementById('pdf-${i}');
                const newWindow = window.open('', '_blank');
                newWindow.document.write('<html><head><title>${pdfDoc.filename}</title></head><body style=\\'margin:0;padding:0\\'><object data=\\'${pdfDataUrl}\\' type=\\'application/pdf\\' width=\\'100%\\' height=\\'100vh\\'></object><script>setTimeout(() => window.print(), 1000);</script></body></html>');
                newWindow.document.close();
              ">Print This</button>
              <button class="action-btn" onclick="
                const link = document.createElement('a');
                link.href = '${pdfDataUrl}';
                link.download = '${pdfDoc.filename}';
                (function() {
                  if(typeof document !== 'undefined') {
                    const link = document.createElement('a');
                    link.href = '${pdfDataUrl}';
                    link.download = '${pdfDoc.filename}';
                    link.click();
                  }
                })()
                  if(typeof window !== 'undefined') {
                    const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                    if(newWindow) {
                      newWindow.document.write('<html><head><title>${pdfDoc.filename}</title></head><body style=\\'margin:0;padding:0\\'><object data=\\'${pdfDataUrl}\\' type=\\'application/pdf\\' width=\\'100%\\' height=\\'100vh\\'></object><script>setTimeout(function() { if(typeof window !== \\'undefined\\') { window.print(); } }, 1000);</script></body></html>');
                      newWindow.document.close();
                      newWindow.focus();
                    } else {
                      alert('Please allow popups to print individual documents');
                    }
                  }
                })()
      `);
    }
    
    printWindow.document.write(`
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Auto-focus the print window
    printWindow.focus();
  }
  
  /**
   * Start batch printing process
   */
  async startBatchPrinting(): Promise<void> {
    if (this.pdfDocuments.length === 0) {
      throw new Error('No PDFs to print');
    }
    
    console.log(`🖨️ Starting batch printing of ${this.pdfDocuments.length} PDFs`);
    
    // Try different printing approaches based on browser capabilities
    if (this.canUseBatchPrint()) {
      await this.printAllAtOnce();
    } else {
      await this.printSequentially();
    }
  }
  
  /**
   * Check if browser supports batch printing
   */
  private canUseBatchPrint(): boolean {
    // Most modern browsers support this, but some mobile browsers don't
    return typeof window.print === 'function' && !this.isMobileBrowser();
  }
  
  /**
   * Check if running on mobile browser
   */
  private isMobileBrowser(): boolean {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * Print all PDFs at once (modern browsers)
   */
  private async printAllAtOnce(): Promise<void> {
    console.log('🖨️ Using batch print method');
    
    // Create a combined print window with all PDFs
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      throw new Error('Could not open print window. Please allow popups.');
    }
    
    // Wait for window to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Batch Print - ${this.pdfDocuments.length} Documents</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .pdf-container { margin: 0; padding: 0; page-break-after: always; width: 100%; height: 100vh; }
            .pdf-container:last-child { page-break-after: auto; }
            .pdf-content { width: 100%; height: 100%; border: none; background: white; padding: 0; margin: 0; }
            .header-info { display: block; }
            .print-buttons { display: block; text-align: center; margin: 20px 0; }
            @media print {
              .header-info { display: none !important; }
              .print-buttons { display: none !important; }
              .pdf-container { page-break-after: always; }
              .pdf-content { height: 100vh; width: 100%; margin: 0; padding: 0; }
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h1>Batch Print Preview - ${this.pdfDocuments.length} Documents</h1>
            <p>Click Print to print all documents. PDFs are embedded as HTML content for better printing compatibility.</p>
          </div>
          <div class="print-buttons">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer;">
              Print All Documents
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; margin-left: 10px;">
              Close
            </button>
          </div>
    `);
    
    // Add each PDF as HTML content instead of iframe
    for (let i = 0; i < this.pdfDocuments.length; i++) {
      const pdfDoc = this.pdfDocuments[i];
      
      // Convert PDF to HTML content for better print compatibility
      const htmlContent = await this.convertPdfToHtml(pdfDoc.doc);
      
      printWindow.document.write(`
        <div class="pdf-container">
          <div class="pdf-content">
            ${htmlContent}
          </div>
        </div>
      `);
    }
    
    printWindow.document.write(`
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Auto-focus the print window
    printWindow.focus();
    
    // Auto-trigger print after content loads
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.print();
      }
    }, 1000);
  }
  
  /**
   * Convert PDF document to HTML content for better print compatibility
   */
  private async convertPdfToHtml(doc: jsPDF): Promise<string> {
    try {
      // Get the PDF as data URL
      const pdfDataUrl = doc.output('datauristring');
      
      // Create an embedded PDF object that browsers can print
      return `
        <object data="${pdfDataUrl}" type="application/pdf" width="100%" height="600px">
          <embed src="${pdfDataUrl}" type="application/pdf" width="100%" height="600px" />
          <p>Your browser does not support PDF viewing. 
             <a href="${pdfDataUrl}" download="document.pdf">Download the PDF</a> instead.
          </p>
        </object>
      `;
    } catch (error) {
      console.error('Failed to convert PDF to HTML:', error);
      return '<p>Error loading PDF content. Please try downloading instead.</p>';
    }
  }
  
  /**
   * Print PDFs sequentially (fallback method)
   */
  private async printSequentially(): Promise<void> {
    console.log('🖨️ Using sequential print method');
    
    // Create a single print window for all PDFs
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      throw new Error('Could not open print window. Please allow popups.');
    }
    
    // Initialize the window with header
    printWindow.document.write(`
      <html>
        <head>
          <title>Sequential Print - ${this.pdfDocuments.length} Documents</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .pdf-container { margin: 0; padding: 0; page-break-after: always; width: 100%; height: 100vh; }
            .pdf-container:last-child { page-break-after: auto; }
            .pdf-content { width: 100%; height: 100%; border: none; background: white; padding: 0; margin: 0; }
            .header-info { display: block; }
            .print-buttons { display: block; text-align: center; margin: 20px 0; }
            @media print {
              .header-info { display: none !important; }
              .print-buttons { display: none !important; }
              .pdf-container { page-break-after: always; }
              .pdf-content { height: 100vh; width: 100%; margin: 0; padding: 0; }
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h1>Print Preview - ${this.pdfDocuments.length} Documents</h1>
            <p>Click Print to print all documents sequentially.</p>
          </div>
          <div class="print-buttons">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer;">
              Print All Documents
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; margin-left: 10px;">
              Close
            </button>
          </div>
    `);
    
    // Add each PDF as HTML content in the same window
    for (let i = 0; i < this.pdfDocuments.length; i++) {
      const pdfDoc = this.pdfDocuments[i];
      
      // Convert PDF to HTML content for better print compatibility
      const htmlContent = await this.convertPdfToHtml(pdfDoc.doc);
      
      printWindow.document.write(`
        <div class="pdf-container">
          <div class="pdf-content">
            ${htmlContent}
          </div>
        </div>
      `);
    }
    
    printWindow.document.write(`
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Auto-focus the print window
    printWindow.focus();
    
    // Auto-trigger print after content loads
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.print();
      }
    }, 1000);
  }
  
  /**
   * Generate individual bill PDF for batch printing
   */
  private async generateIndividualBillPDF(options: {
    staffName: string;
    month: number;
    year: number;
    entries: RosterEntry[];
    basicSalary: number;
    hourlyRate: number;
    shiftCombinations: Array<{id: string, combination: string, hours: number}>;
  }): Promise<jsPDF> {
    const { individualBillGenerator } = await import('./individualBillGenerator');
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate the bill content using the existing generator logic
    await individualBillGenerator.generateBillContent(doc, options);
    
    return doc;
  }
  
  /**
   * Generate annexure PDF for batch printing
   */
  private async generateAnnexurePDF(options: {
    month: number;
    year: number;
    entries: RosterEntry[];
    hourlyRate: number;
    shiftCombinations: Array<{id: string, combination: string, hours: number}>;
  }): Promise<jsPDF> {
    const { annexureGenerator } = await import('./annexureGenerator');
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate the annexure content using the existing generator logic
    await annexureGenerator.generateAnnexureContent(doc, options);
    
    return doc;
  }
  
  /**
   * Generate roster list PDF for batch printing
   */
  private async generateRosterListPDF(options: {
    month: number;
    year: number;
    entries: RosterEntry[];
  }): Promise<jsPDF> {
    const { rosterListGenerator } = await import('./rosterListGenerator');
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate the roster list content using the existing generator logic
    await rosterListGenerator.generateRosterListContent(doc, options);
    
    return doc;
  }
  
  /**
   * Get unique staff members from entries (base names only)
   */
  private getUniqueStaffMembers(entries: RosterEntry[]): string[] {
    const staffSet = new Set<string>();
    
    entries.forEach(entry => {
      // Use base name (remove (R) suffix) since they are the same person
      const baseName = entry.assigned_name.replace(/\(R\)$/, '').trim();
      staffSet.add(baseName);
    });
    
    // Convert to array
    const staffArray = Array.from(staffSet);
    
    // Filter out staff members who don't exist in the current auth system
    // This prevents deleted staff from appearing in reports
    const validStaffArray = staffArray.filter(staffName => {
      const staffInfo = getStaffInfo(staffName);
      return !!staffInfo;
    });
    
    return validStaffArray.sort();
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.printWindow && !this.printWindow.closed) {
      this.printWindow.close();
    }
    
    // Clean up blob URLs
    this.pdfDocuments.forEach(pdfDoc => {
      // URLs will be cleaned up automatically by browser
    });
    
    this.pdfDocuments = [];
    this.currentPrintIndex = 0;
  }
}

// Create singleton instance
export const batchPrintManager = new BatchPrintManager();