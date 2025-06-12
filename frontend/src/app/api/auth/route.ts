import { NextRequest, NextResponse } from "next/server";

// Set your passcode here (in production, use environment variables)
const VALID_PASSCODE = process.env.PDF_AI_PASSCODE || "PDFAi2024!";

export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();

    if (!passcode) {
      return NextResponse.json(
        { success: false, message: "Passcode is required" },
        { status: 400 }
      );
    }

    if (passcode === VALID_PASSCODE) {
      return NextResponse.json(
        { success: true, message: "Authentication successful" },
        { status: 200 }
      );
    } else {
      // Add a small delay to prevent brute force attacks
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return NextResponse.json(
        { success: false, message: "Invalid passcode" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { success: false, message: "Authentication failed" },
      { status: 500 }
    );
  }
}
