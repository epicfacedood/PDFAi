import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

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

interface Product {
  productCode?: string;
  productName?: string;
  quantity?: string;
  uom?: string;
  unitPrice?: string;
}

interface Order {
  orderId?: string;
  remarks?: string;
  customerCode?: string;
  customerName?: string;
  deliveryDate?: string;
  name?: string;
  deliveryAddress1?: string;
  deliveryAddress2?: string;
  postalCode?: string;
  productCode?: string;
  productName?: string;
  quantity?: string;
  uom?: string;
  unitPrice?: string;
  products?: Product[];
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    console.log(`\n🤖 AI EXTRACTION - Starting Claude processing:`);
    console.log(`📄 Input text length: ${text ? text.length : 0} characters`);

    if (!text) {
      console.log(`❌ No text provided to AI extraction`);
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    if (text.length > 0) {
      console.log(
        `📝 First 300 chars of input text: "${text.substring(0, 300)}${
          text.length > 300 ? "..." : ""
        }"`
      );
    } else {
      console.log(`⚠️  WARNING: Input text is empty!`);
    }

    const prompt = `Please extract data from the following PDF text and return it in JSON format. The data should include these fields:
- orderId (Order ID)
- remarks (Remarks)
- customerCode (Customer Code)
- customerName (Customer Name - the company receiving the delivery)
- deliveryDate (Delivery Date - format as DD/MM/YY, e.g., "13/02/25")
- name (Customer Company Name - same as customerName, the company receiving the delivery, NOT Eastern Harvest)
- deliveryAddress1 (Delivery Address #1)
- deliveryAddress2 (Delivery Address #2)  
- postalCode (Postal Code)
- productCode (Product Code)
- productName (Product Name)
- quantity (Quantity - extract only the numeric value)
- uom (Unit of Measure - MUST be one of: CTN, PKT, PCS, KG, GM, LTR, ML, BTL, BOX, TRAY, BAG, ROLL, SET, CASE)
- unitPrice (Unit Price - extract only the numeric value)

IMPORTANT INSTRUCTIONS:
1. For deliveryDate: Convert any date format to DD/MM/YY (e.g., "13-Feb-2025" becomes "13/02/25", "February 13, 2025" becomes "13/02/25")
2. For name field: Extract the CUSTOMER'S company name (the one receiving the delivery), NEVER use "Eastern Harvest" or similar supplier names
3. For UOM (Unit of Measure): Look for terms like "ORDER CTN", "PKT", "PCS", etc. and map them to the standardized values: CTN, PKT, PCS, KG, GM, LTR, ML, BTL, BOX, TRAY, BAG, ROLL, SET, CASE
4. For Quantity: Extract only the numeric value (e.g., if you see "20 CTN", extract "20" for quantity and "CTN" for uom)
5. For Unit Price: Extract only the numeric value including decimals
6. If multiple products exist for one order, create separate entries for each product with the same order details
7. If a field is not found, use an empty string
8. Be smart about variations: "CARTON" = "CTN", "PACKET" = "PKT", "PIECES" = "PCS", "KILOGRAM" = "KG", "GRAM" = "GM", "LITER" = "LTR", "MILLILITER" = "ML", "BOTTLE" = "BTL"

PDF Text:
${text}

Please return ONLY valid JSON without any markdown formatting or explanations. Structure it as an array of objects with products nested if needed, or flatten it into separate rows for each product.`;

    console.log(`🚀 Sending request to Claude Sonnet 4...`);

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    console.log(`✅ Received response from Claude`);
    console.log(
      `📊 Usage: Input tokens: ${message.usage.input_tokens}, Output tokens: ${message.usage.output_tokens}`
    );

    const content = message.content[0];
    if (content.type !== "text") {
      console.log(`❌ Unexpected response type from Claude: ${content.type}`);
      throw new Error("Unexpected response type from Claude");
    }

    console.log(
      `📄 Claude raw response length: ${content.text.length} characters`
    );
    console.log(`🤖 Claude raw response:\n${content.text}\n`);
    console.log(
      `======================== END CLAUDE RESPONSE ========================`
    );

    let rawData: Order | Order[];
    try {
      console.log(`🔄 Attempting to parse Claude response as JSON...`);
      rawData = JSON.parse(content.text);
      console.log(`✅ Successfully parsed JSON directly`);
    } catch (parseError) {
      console.log(`⚠️  Direct JSON parsing failed: ${parseError}`);
      console.log(`🔍 Attempting to extract JSON from response...`);

      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(
          `🎯 Found JSON pattern in response: ${jsonMatch[0].substring(
            0,
            200
          )}...`
        );
        try {
          rawData = JSON.parse(jsonMatch[0]);
          console.log(`✅ Successfully parsed extracted JSON`);
        } catch (extractError) {
          console.log(`❌ Failed to parse extracted JSON: ${extractError}`);
          throw new Error("Could not parse JSON response from Claude");
        }
      } else {
        console.log(`❌ No JSON pattern found in Claude response`);
        throw new Error("Could not parse JSON response from Claude");
      }
    }

    console.log(`📋 Parsed data structure:`, JSON.stringify(rawData, null, 2));

    // Handle different response structures from Claude
    let processedData: Order | Order[];

    // Check if Claude wrapped the data in an "orders" property
    if (
      rawData &&
      typeof rawData === "object" &&
      "orders" in rawData &&
      Array.isArray((rawData as any).orders)
    ) {
      console.log(`🔧 Detected 'orders' wrapper, extracting array...`);
      processedData = (rawData as any).orders;
    } else {
      processedData = rawData;
    }

    console.log(
      `📦 Processed data structure:`,
      JSON.stringify(processedData, null, 2)
    );

    // Standard UOM mapping
    const standardizeUom = (uom: string): string => {
      if (!uom) return "";

      const uomMap: { [key: string]: string } = {
        CARTON: "CTN",
        CARTONS: "CTN",
        PACKET: "PKT",
        PACKETS: "PKT",
        PIECES: "PCS",
        PIECE: "PCS",
        KILOGRAM: "KG",
        KILOGRAMS: "KG",
        GRAM: "GM",
        GRAMS: "GM",
        LITER: "LTR",
        LITERS: "LTR",
        LITRE: "LTR",
        LITRES: "LTR",
        MILLILITER: "ML",
        MILLILITERS: "ML",
        MILLILITRE: "ML",
        MILLILITRES: "ML",
        BOTTLE: "BTL",
        BOTTLES: "BTL",
        BOXES: "BOX",
        TRAYS: "TRAY",
        BAGS: "BAG",
        ROLLS: "ROLL",
        SETS: "SET",
        CASES: "CASE",
      };

      const upperUom = uom.toUpperCase().trim();
      return uomMap[upperUom] || upperUom;
    };

    // Format date to DD/MM/YY
    const formatDate = (dateStr: string): string => {
      if (!dateStr) return "";

      try {
        // If already in DD/MM/YY format, return as is
        if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateStr.trim())) {
          return dateStr.trim();
        }

        // Handle formats like "13-Feb-2025", "February 13, 2025", etc.
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
          // If Date parsing fails, return original string
          return dateStr;
        }

        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear().toString().slice(-2);

        return `${day}/${month}/${year}`;
      } catch {
        return dateStr; // Return original if formatting fails
      }
    };

    // Flatten nested structure - if there are products arrays, create separate rows
    const flattenData = (orders: Order[]): ExtractedData[] => {
      const flattened: ExtractedData[] = [];

      orders.forEach((order) => {
        if (order.products && Array.isArray(order.products)) {
          // Create a row for each product
          order.products.forEach((product: Product) => {
            flattened.push({
              orderId: String(order.orderId || ""),
              remarks: String(order.remarks || ""),
              customerCode: String(order.customerCode || ""),
              customerName: String(order.customerName || ""),
              deliveryDate: formatDate(String(order.deliveryDate || "")),
              name: String(order.customerName || ""),
              deliveryAddress1: String(order.deliveryAddress1 || ""),
              deliveryAddress2: String(order.deliveryAddress2 || ""),
              postalCode: String(order.postalCode || ""),
              productCode: String(product.productCode || ""),
              productName: String(product.productName || ""),
              quantity: String(product.quantity || ""),
              uom: standardizeUom(String(product.uom || "")),
              unitPrice: String(product.unitPrice || ""),
            });
          });
        } else {
          // Single row format
          flattened.push({
            orderId: String(order.orderId || ""),
            remarks: String(order.remarks || ""),
            customerCode: String(order.customerCode || ""),
            customerName: String(order.customerName || ""),
            deliveryDate: formatDate(String(order.deliveryDate || "")),
            name: String(order.customerName || ""),
            deliveryAddress1: String(order.deliveryAddress1 || ""),
            deliveryAddress2: String(order.deliveryAddress2 || ""),
            postalCode: String(order.postalCode || ""),
            productCode: String(order.productCode || ""),
            productName: String(order.productName || ""),
            quantity: String(order.quantity || ""),
            uom: standardizeUom(String(order.uom || "")),
            unitPrice: String(order.unitPrice || ""),
          });
        }
      });

      return flattened;
    };

    // Ensure processedData is an array
    const ordersArray = Array.isArray(processedData)
      ? processedData
      : [processedData];
    console.log(
      `📦 Processing ${ordersArray.length} order(s) for flattening...`
    );

    const extractedData = flattenData(ordersArray);

    console.log(`🎯 Final extracted data (${extractedData.length} records):`);
    extractedData.forEach((record, index) => {
      console.log(`📄 Record ${index + 1}:`, {
        orderId: record.orderId,
        customerName: record.customerName,
        productCode: record.productCode,
        productName: record.productName,
        quantity: record.quantity,
        uom: record.uom,
        unitPrice: record.unitPrice,
      });
    });

    if (extractedData.length === 0) {
      console.log(
        `⚠️  WARNING: No data was extracted! This indicates a problem with the AI processing.`
      );
    }

    console.log(`✅ AI extraction completed successfully\n`);

    return NextResponse.json({
      success: true,
      data: extractedData,
      rawResponse: content.text,
    });
  } catch (error) {
    console.log(`\n❌ AI EXTRACTION ERROR:`);
    console.error("Error extracting data with Claude:", error);

    if (error instanceof Error) {
      console.log(`Error message: ${error.message}`);
      console.log(`Error stack: ${error.stack}`);
    }

    return NextResponse.json(
      {
        error: "Failed to extract data with Claude",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
