"use client";

// Polyfill for Promise.withResolvers if not available
if (typeof Promise.withResolvers === "undefined") {
  Promise.withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker for compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PageContent {
  page: number;
  text: string;
}

interface ExtractResponse {
  success: boolean;
  filename: string;
  total_pages: number;
  total_words: number;
  content: PageContent[];
  library?: string;
}

interface ExtractedData {
  orderId: string;
  remarks: string;
  customerCode: string;
  customerName: string;
  deliveryDate: string;
  name: string;
  deliveryAddress1: string;
  deliveryAddress2: string;
  postalCode: string;
  productCode: string;
  productName: string;
  quantity: string;
  uom: string;
  unitPrice: string;
}

interface ClaudeExtractResponse {
  success: boolean;
  data: ExtractedData | ExtractedData[];
  rawResponse: string;
  error?: string;
  details?: string;
}

interface ProcessedPDF {
  id: string;
  file: File;
  result: ExtractResponse | null;
  extractedData: ExtractedData[] | null;
  processing: boolean;
  error: string | null;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [processedPDFs, setProcessedPDFs] = useState<ProcessedPDF[]>([]);
  const [selectedPDFId, setSelectedPDFId] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [numPages, setNumPages] = useState<number | null>(null);

  const selectedPDF = processedPDFs.find((pdf) => pdf.id === selectedPDFId);

  // Helper function to safely render any value as a string
  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value || "-";
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value.toString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value) || "-";
  };

  // Editable field component
  const EditableField = ({
    value,
    onSave,
    placeholder = "Enter value...",
    multiline = false,
  }: {
    value: string;
    onSave: (newValue: string) => void;
    placeholder?: string;
    multiline?: boolean;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const handleSave = () => {
      onSave(editValue);
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditValue(value);
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          {multiline ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          )}
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <div
        className="group flex items-center justify-between cursor-pointer hover:bg-blue-50 rounded px-1 py-1"
        onClick={() => setIsEditing(true)}
      >
        <span className={`${value === "-" ? "text-gray-400 italic" : ""}`}>
          {value === "-" ? "Click to add..." : value}
        </span>
        <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 ml-2">
          ✏️ Edit
        </span>
      </div>
    );
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const pdfFiles = selectedFiles.filter(
      (file) => file.type === "application/pdf"
    );

    if (pdfFiles.length !== selectedFiles.length) {
      alert("Please select only PDF files");
      return;
    }

    setFiles(pdfFiles);

    // Initialize processed PDFs array
    const newProcessedPDFs = pdfFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      result: null,
      extractedData: null,
      processing: false,
      error: null,
    }));

    setProcessedPDFs(newProcessedPDFs);
    setSelectedPDFId(null);
  };

  const processIndividualPDF = async (pdfId: string) => {
    const pdfIndex = processedPDFs.findIndex((pdf) => pdf.id === pdfId);
    if (pdfIndex === -1) return;

    // Update processing state
    setProcessedPDFs((prev) =>
      prev.map((pdf) =>
        pdf.id === pdfId ? { ...pdf, processing: true, error: null } : pdf
      )
    );

    try {
      const pdf = processedPDFs[pdfIndex];

      // Step 1: Extract text from PDF using pdf2json
      const formData = new FormData();
      formData.append("file", pdf.file);

      const textResponse = await fetch("/api/extract-text-pdf2json", {
        method: "POST",
        body: formData,
      });

      const textData = await textResponse.json();

      if (!textResponse.ok || !textData.success) {
        throw new Error(textData.error || "Failed to extract text from PDF");
      }

      // Step 2: Process with Claude AI
      const fullText = textData.content
        .map((page: PageContent) => page.text)
        .join("\n\n");

      const claudeResponse = await fetch("/api/extract-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: fullText }),
      });

      const claudeData: ClaudeExtractResponse = await claudeResponse.json();

      if (!claudeResponse.ok || !claudeData.success) {
        throw new Error(
          claudeData.details || "Failed to extract structured data with AI"
        );
      }

      // Ensure data is always an array
      const dataArray = Array.isArray(claudeData.data)
        ? claudeData.data
        : [claudeData.data];

      // Update the processed PDF with results
      setProcessedPDFs((prev) =>
        prev.map((pdf) =>
          pdf.id === pdfId
            ? {
                ...pdf,
                result: textData,
                extractedData: dataArray,
                processing: false,
              }
            : pdf
        )
      );

      // Auto-select the processed PDF if none is selected
      if (!selectedPDFId) {
        setSelectedPDFId(pdfId);
        setSelectedPage(1);
      }
    } catch (error) {
      setProcessedPDFs((prev) =>
        prev.map((pdf) =>
          pdf.id === pdfId
            ? {
                ...pdf,
                processing: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to process PDF",
              }
            : pdf
        )
      );
    }
  };

  const processAllPDFs = async () => {
    // Process all PDFs sequentially to avoid overwhelming the server
    for (const pdf of processedPDFs) {
      if (!pdf.result && !pdf.processing) {
        await processIndividualPDF(pdf.id);
      }
    }
  };

  const exportToExcel = () => {
    const allExtractedData = processedPDFs
      .filter((pdf) => pdf.extractedData)
      .flatMap((pdf) => pdf.extractedData!);

    if (allExtractedData.length === 0) {
      alert("No data to export");
      return;
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Prepare data with proper column headers and replace blanks with "-"
    const excelData = allExtractedData.map((row) => ({
      "Order ID": renderValue(row.orderId),
      Remarks: renderValue(row.remarks),
      "Customer Code": renderValue(row.customerCode),
      "Customer Name": renderValue(row.customerName),
      "Delivery Date": renderValue(row.deliveryDate),
      Name: renderValue(row.name),
      "Delivery Address #1": renderValue(row.deliveryAddress1),
      "Delivery Address #2": renderValue(row.deliveryAddress2),
      "Postal Code": renderValue(row.postalCode),
      "Product Code": renderValue(row.productCode),
      "Product Name": renderValue(row.productName),
      Quantity: renderValue(row.quantity),
      UOM: renderValue(row.uom),
      "Unit Price": renderValue(row.unitPrice),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 12 }, // Order ID
      { wch: 15 }, // Remarks
      { wch: 15 }, // Customer Code
      { wch: 25 }, // Customer Name
      { wch: 12 }, // Delivery Date
      { wch: 25 }, // Name
      { wch: 30 }, // Delivery Address #1
      { wch: 30 }, // Delivery Address #2
      { wch: 12 }, // Postal Code
      { wch: 15 }, // Product Code
      { wch: 40 }, // Product Name
      { wch: 10 }, // Quantity
      { wch: 8 }, // UOM
      { wch: 12 }, // Unit Price
    ];

    worksheet["!cols"] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "All PDF Data");

    // Generate filename with current date
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `All_PDF_Data_Export_${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    []
  );

  const zoomIn = () => setPdfScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setPdfScale((prev) => Math.max(prev - 0.2, 0.5));

  // Get extracted data for the selected PDF only
  const selectedPDFData = selectedPDF?.extractedData || [];

  // Get all extracted data for export functionality
  const allExtractedData = processedPDFs
    .filter((pdf) => pdf.extractedData)
    .flatMap((pdf) => pdf.extractedData!);

  // Function to update a specific field in a record
  const updateRecord = (
    recordIndex: number,
    field: keyof ExtractedData,
    value: string
  ) => {
    if (!selectedPDF) return;

    setProcessedPDFs((prev) =>
      prev.map((pdf) =>
        pdf.id === selectedPDF.id
          ? {
              ...pdf,
              extractedData:
                pdf.extractedData?.map((record, index) =>
                  index === recordIndex ? { ...record, [field]: value } : record
                ) || null,
            }
          : pdf
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Multi-PDF AI Data Extractor
              </h1>
              <p className="text-gray-600">
                Upload multiple PDFs and extract structured data with AI
              </p>
            </div>
            <button
              onClick={() => {
                document.cookie =
                  "pdf-ai-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                window.location.href = "/login";
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
            >
              <span>🔒</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose PDF Files (Multiple Selection)
              </label>
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFilesChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {files.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {files.length} PDF file
                  {files.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {files.length > 0 && (
              <div className="flex gap-4">
                <button
                  onClick={processAllPDFs}
                  disabled={processedPDFs.every(
                    (pdf) => pdf.processing || pdf.result
                  )}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-md hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {processedPDFs.some((pdf) => pdf.processing) ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing PDFs...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Process All PDFs</span>
                    </>
                  )}
                </button>

                {allExtractedData.length > 0 && (
                  <button
                    onClick={exportToExcel}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md flex items-center space-x-2 transition-colors"
                  >
                    <span>📊</span>
                    <span>Export All to Excel</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PDF List */}
        {processedPDFs.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              PDF Files
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedPDFs.map((pdf) => (
                <div
                  key={pdf.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPDFId === pdf.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedPDFId(pdf.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 truncate">
                      {pdf.file.name}
                    </h4>
                    {pdf.processing && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {pdf.processing ? (
                      "Processing..."
                    ) : pdf.error ? (
                      <span className="text-red-600">{pdf.error}</span>
                    ) : pdf.result ? (
                      <span className="text-green-600">
                        ✓ Processed ({pdf.extractedData?.length || 0} records)
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          processIndividualPDF(pdf.id);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Click to process
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Split Screen View */}
        {selectedPDF && selectedPDF.result && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex h-screen max-h-[800px]">
              {/* Left Side - PDF Viewer */}
              <div className="w-1/2 border-r border-gray-200 flex flex-col">
                {/* PDF Controls */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      📄 {selectedPDF.file.name}
                    </h3>
                    <div className="flex items-center space-x-4">
                      {/* Zoom Controls */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={zoomOut}
                          className="p-1 text-gray-600 hover:text-gray-900"
                        >
                          🔍➖
                        </button>
                        <span className="text-sm text-gray-600">
                          {Math.round(pdfScale * 100)}%
                        </span>
                        <button
                          onClick={zoomIn}
                          className="p-1 text-gray-600 hover:text-gray-900"
                        >
                          🔍➕
                        </button>
                      </div>

                      {/* Page Navigation */}
                      {numPages && numPages > 1 && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              setSelectedPage(Math.max(1, selectedPage - 1))
                            }
                            disabled={selectedPage <= 1}
                            className="px-2 py-1 text-sm bg-blue-600 text-white rounded disabled:bg-gray-400"
                          >
                            ←
                          </button>
                          <span className="text-sm text-gray-600">
                            {selectedPage} / {numPages}
                          </span>
                          <button
                            onClick={() =>
                              setSelectedPage(
                                Math.min(numPages, selectedPage + 1)
                              )
                            }
                            disabled={selectedPage >= numPages}
                            className="px-2 py-1 text-sm bg-blue-600 text-white rounded disabled:bg-gray-400"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 overflow-auto bg-gray-100 p-4">
                  <div className="flex justify-center">
                    <Document
                      file={selectedPDF.file}
                      onLoadSuccess={onDocumentLoadSuccess}
                      className="shadow-lg"
                    >
                      <Page
                        pageNumber={selectedPage}
                        scale={pdfScale}
                        className="border border-gray-300"
                      />
                    </Document>
                  </div>
                </div>
              </div>

              {/* Right Side - Data Table */}
              <div className="w-1/2 flex flex-col">
                <div className="bg-purple-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      🤖 {selectedPDF.file.name} - Extracted Data (
                      {selectedPDFData.length} records)
                    </h3>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  {selectedPDFData.length > 0 ? (
                    <div className="space-y-4 p-4">
                      {selectedPDFData.map((record, recordIndex) => (
                        <div
                          key={recordIndex}
                          className="bg-white border border-gray-200 rounded-lg shadow-sm"
                        >
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                            <div className="flex items-center justify-between">
                              <h4 className="text-lg font-semibold text-gray-900">
                                📦 Record {recordIndex + 1}
                                {record.orderId && record.orderId !== "-" && (
                                  <span className="ml-2 text-sm font-normal text-purple-600">
                                    (Order: {renderValue(record.orderId)})
                                  </span>
                                )}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                  ✏️ Click any field to edit
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Order ID
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.orderId)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "orderId",
                                        value
                                      )
                                    }
                                    placeholder="Enter order ID..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Remarks
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.remarks)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "remarks",
                                        value
                                      )
                                    }
                                    placeholder="Enter remarks..."
                                    multiline={true}
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Customer Code
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.customerCode)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "customerCode",
                                        value
                                      )
                                    }
                                    placeholder="Enter customer code..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Customer Name
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.customerName)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "customerName",
                                        value
                                      )
                                    }
                                    placeholder="Enter customer name..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Delivery Date
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.deliveryDate)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "deliveryDate",
                                        value
                                      )
                                    }
                                    placeholder="Enter delivery date (DD/MM/YY)..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Contact Name
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.name)}
                                    onSave={(value) =>
                                      updateRecord(recordIndex, "name", value)
                                    }
                                    placeholder="Enter contact name..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Delivery Address #1
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.deliveryAddress1)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "deliveryAddress1",
                                        value
                                      )
                                    }
                                    placeholder="Enter delivery address..."
                                    multiline={true}
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Delivery Address #2
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.deliveryAddress2)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "deliveryAddress2",
                                        value
                                      )
                                    }
                                    placeholder="Enter additional address..."
                                    multiline={true}
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Postal Code
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.postalCode)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "postalCode",
                                        value
                                      )
                                    }
                                    placeholder="Enter postal code..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Product Code
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.productCode)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "productCode",
                                        value
                                      )
                                    }
                                    placeholder="Enter product code..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Product Name
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.productName)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "productName",
                                        value
                                      )
                                    }
                                    placeholder="Enter product name..."
                                    multiline={true}
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Quantity
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.quantity)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "quantity",
                                        value
                                      )
                                    }
                                    placeholder="Enter quantity..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Unit of Measure (UOM)
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.uom)}
                                    onSave={(value) =>
                                      updateRecord(recordIndex, "uom", value)
                                    }
                                    placeholder="Enter UOM (CTN, PKT, PCS, etc.)..."
                                  />
                                </div>
                              </div>
                              <div className="flex py-2 rounded">
                                <div className="w-1/3 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-2 rounded-l">
                                  Unit Price
                                </div>
                                <div className="w-2/3 text-sm text-gray-900 px-3 py-2 bg-white rounded-r border-l">
                                  <EditableField
                                    value={renderValue(record.unitPrice)}
                                    onSave={(value) =>
                                      updateRecord(
                                        recordIndex,
                                        "unitPrice",
                                        value
                                      )
                                    }
                                    placeholder="Enter unit price..."
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <div className="text-6xl mb-4">📄</div>
                        <p className="text-lg font-medium">
                          No data extracted yet
                        </p>
                        <p className="text-sm">
                          The selected PDF has not been processed with AI
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
