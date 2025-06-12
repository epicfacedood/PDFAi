import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // Get the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (16MB limit)
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 16MB." },
        { status: 400 }
      );
    }

    // Save file temporarily (pdf2json requires a file path)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = path.join(
      os.tmpdir(),
      `pdf_${Date.now()}_${Math.random()}.pdf`
    );
    await fs.writeFile(tempFilePath, buffer);

    // Import pdf2json dynamically to handle ES modules properly
    const { default: PDFParser } = await import("pdf2json");

    // Create parser instance
    const pdfParser = new (PDFParser as any)(null, 1);

    return new Promise<NextResponse>((resolve) => {
      // Handle parsing errors
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        resolve(
          NextResponse.json(
            { error: `PDF parsing failed: ${errData.parserError || errData}` },
            { status: 500 }
          )
        );
      });

      // Handle successful parsing
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          // Extract text from parsed PDF data
          const pages = pdfData.Pages || [];
          console.log(`\n📄 PDF2JSON - Processing ${file.name}:`);
          console.log(`📊 Raw PDF data contains ${pages.length} pages`);

          const content = pages
            .map((page: any, pageIndex: number) => {
              const texts = page.Texts || [];
              let pageText = "";

              console.log(`\n📖 Page ${pageIndex + 1}:`);
              console.log(`   📝 Found ${texts.length} text elements`);

              // Sort texts by Y position (top to bottom) then X position (left to right)
              const sortedTexts = texts.sort((a: any, b: any) => {
                if (Math.abs(a.y - b.y) > 0.1) {
                  return a.y - b.y; // Sort by Y position first
                }
                return a.x - b.x; // Then by X position
              });

              // Extract text from each text element
              for (const textItem of sortedTexts) {
                if (textItem.R && textItem.R.length > 0) {
                  for (const run of textItem.R) {
                    if (run.T) {
                      // Decode URI-encoded text
                      const decodedText = decodeURIComponent(run.T);
                      pageText += decodedText;
                    }
                  }
                  pageText += " "; // Add space between text runs
                }
              }

              const trimmedText = pageText.trim();
              console.log(
                `   📄 Page ${pageIndex + 1} extracted text length: ${
                  trimmedText.length
                } characters`
              );

              if (trimmedText.length > 0) {
                console.log(
                  `   📝 First 200 chars: "${trimmedText.substring(0, 200)}${
                    trimmedText.length > 200 ? "..." : ""
                  }"`
                );
              } else {
                console.log(
                  `   ⚠️  Page ${pageIndex + 1} is EMPTY - no text extracted!`
                );
              }

              return {
                page: pageIndex + 1,
                text: trimmedText,
              };
            })
            .filter(
              (page: { page: number; text: string }) => page.text.length > 0
            );

          console.log(`\n📊 PDF2JSON Summary:`);
          console.log(
            `   ✅ Successfully extracted ${content.length} pages with content`
          );
          console.log(`   📝 Total pages processed: ${pages.length}`);
          console.log(
            `   ❌ Empty pages filtered out: ${pages.length - content.length}`
          );

          // Calculate statistics
          const totalPages = content.length;
          const totalWords = content.reduce(
            (count: number, page: { page: number; text: string }) => {
              return (
                count +
                page.text.split(/\s+/).filter((word: string) => word.length > 0)
                  .length
              );
            },
            0
          );

          const response = {
            success: true,
            filename: file.name,
            total_pages: totalPages,
            total_words: totalWords,
            content: content,
            library: "pdf2json",
          };

          resolve(NextResponse.json(response));
        } catch (parseError) {
          resolve(
            NextResponse.json(
              { error: `Error processing extracted data: ${parseError}` },
              { status: 500 }
            )
          );
        } finally {
          // Clean up temp file
          if (tempFilePath) {
            fs.unlink(tempFilePath).catch(() => {
              // Ignore cleanup errors
            });
          }
        }
      });

      // Start parsing the PDF file
      pdfParser.loadPDF(tempFilePath!);
    });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath) {
      fs.unlink(tempFilePath).catch(() => {
        // Ignore cleanup errors
      });
    }

    console.error("PDF2JSON parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse PDF. Please ensure the file is a valid PDF." },
      { status: 500 }
    );
  }
}
