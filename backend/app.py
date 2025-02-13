from flask import Flask, request, jsonify, send_from_directory
import pdfplumber
import pandas as pd
import os
from io import BytesIO
import logging
import re

app = Flask(__name__, static_folder='../frontend', static_url_path='')
logging.basicConfig(level=logging.DEBUG)

def detect_format(text_content):
    """Detect the PDF format based on content"""
    combined_text = ' '.join(text_content)
    if "SNACKZ IT" in combined_text:
        return "snackz_it"
    elif "Cold Storage Singapore" in combined_text:
        return "cold_storage"
    elif "Fish & Co. Restaurants" in combined_text:
        return "fish_and_co"
    return "unknown"

def parse_snackz_it(tables, text_content):
    """Parse Snackz IT format"""
    headers = ['Item Number', 'Item Name', 'Qty.', 'Unit', 'Unit $', 'Total $', 'Tax $']
    
    item_table = None
    for table in tables:
        if table and len(table) > 1 and 'Item Number' in str(table[0]):
            item_table = table
            break
    
    if not item_table:
        return None

    df = pd.DataFrame(item_table[1:], columns=headers)
    return df

def parse_fish_and_co(tables, text_content):
    """Parse Fish & Co format"""
    headers = ['Item Code', 'Item Name', 'UOM', 'Qty', 'Unit Price']
    
    logging.debug(f"Number of tables found: {len(tables)}")
    
    item_table = None
    for i, table in enumerate(tables):
        logging.debug(f"Checking table {i}: {table[:2]}")
        if table and len(table) > 1 and any('Item Requirements' in str(row) for row in table):
            item_table = table
            logging.debug(f"Found item table: {table[:5]}")
            break
    
    if not item_table:
        logging.debug("No item table found")
        return None

    # Find the row that starts the actual data
    start_row = 0
    for i, row in enumerate(item_table):
        logging.debug(f"Checking row {i}: {row}")
        if any('Item Code' in str(cell) for cell in row):
            start_row = i
            logging.debug(f"Found start row at index {i}")
            break

    # Extract only the item data
    data_rows = []
    for row in item_table[start_row + 1:]:
        logging.debug(f"Processing row: {row}")
        # Skip empty rows or section headers
        if not any(row) or 'Delivery Address' in str(row):
            logging.debug("Skipping row - empty or contains Delivery Address")
            continue

        # Get the cells we need
        if len(row) >= 11:  # Table has 11 columns
            item_code = str(row[2] or '').strip()
            item_name = str(row[5] or '').strip()  # Item Name is in column 6
            uom = str(row[8] or '').strip()  # UOM is in column 9
            qty = str(row[9] or '').strip()  # Qty is in column 10
            unit_price = str(row[10] or '').strip()  # Unit Price is in column 11
            
            cleaned_row = [item_code, item_name, uom, qty, unit_price]
            logging.debug(f"Cleaned row: {cleaned_row}")
            
            if item_name:  # Only add rows with an Item Name
                data_rows.append(cleaned_row)
                logging.debug("Added row to data_rows")

    logging.debug(f"Total rows collected: {len(data_rows)}")
    
    # Create DataFrame with explicit columns
    df = pd.DataFrame(data_rows, columns=headers)
    logging.debug(f"Created DataFrame with shape: {df.shape}")
    logging.debug(f"DataFrame contents:\n{df}")
    
    # Convert numeric columns
    df['Qty'] = pd.to_numeric(df['Qty'], errors='coerce')
    df['Unit Price'] = pd.to_numeric(df['Unit Price'], errors='coerce')

    return df

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/convert', methods=['POST'])
def convert_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not file.filename.endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400

    try:
        with pdfplumber.open(file) as pdf:
            tables = []
            text_content = []
            
            for page in pdf.pages:
                text = page.extract_text()
                text_content.append(text)
                extracted_tables = page.extract_tables()
                if extracted_tables:
                    tables.extend(extracted_tables)

            # Detect format
            pdf_format = detect_format(text_content)
            logging.debug(f"Detected format: {pdf_format}")

            if pdf_format == "snackz_it":
                df = parse_snackz_it(tables, text_content)
                if df is None:
                    return jsonify({'error': 'Could not parse Snackz IT format'}), 400
            
            elif pdf_format == "fish_and_co":
                df = parse_fish_and_co(tables, text_content)
                if df is None:
                    return jsonify({'error': 'Could not parse Fish & Co format'}), 400

            elif pdf_format == "cold_storage":
                # Try table extraction first
                if tables and len(tables[0]) > 1:
                    logging.debug("Processing structured tables")
                    # Use exact headers from expected output
                    headers = ['S.No.', 'Item Ref No', 'Product Description', 
                             'Size', 'OP', 'Unit Cost', 'Order Carton', 'Total Amount']
                    
                    rows = []
                    for table in tables:
                        for row in table[1:]:  # Skip header row
                            # Skip empty rows
                            if not any(row):
                                continue
                            
                            row_dict = {}
                            for i, value in enumerate(row):
                                if i < len(headers):
                                    row_dict[headers[i]] = value
                            if row_dict:
                                rows.append(row_dict)
                    
                    df = pd.DataFrame(rows)
                
                else:
                    # Parse text content for Cold Storage format
                    rows = []
                    headers = ['S.No.', 'Item Ref No', 'Product Description', 
                             'Size', 'OP', 'Unit Cost', 'Order Carton', 'Total Amount']
                    
                    current_row = {}
                    for text in text_content:
                        lines = text.split('\n')
                        
                        for line in lines:
                            # Skip header lines
                            if any(x in line for x in ['Delivery Date', 'Page No.', 'Item Ref']):
                                continue
                            
                            # Look for lines starting with S.No. and Item Ref No
                            match = re.match(r'(\d+)\s+(\d+)\s+(.*?)(?:\s+(\d+(?:\.\d+)?)\s*(?:G|KG))?(?:\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?))?$', line)
                            if match:
                                if current_row:
                                    rows.append(current_row)
                                
                                current_row = {
                                    'S.No.': match.group(1),
                                    'Item Ref No': match.group(2),
                                    'Product Description': match.group(3).strip(),
                                    'Size': f"{match.group(4) or ''} {'G' if 'G' in line else 'KG' if 'KG' in line else ''}".strip(),
                                    'OP': match.group(5) or '',
                                    'Unit Cost': match.group(6) or '',
                                    'Order Carton': match.group(7) or '',
                                    'Total Amount': match.group(8) or ''
                                }

                    # Add the last row
                    if current_row:
                        rows.append(current_row)

                    df = pd.DataFrame(rows)
                    
                    # Ensure all headers are present and in correct order
                    for header in headers:
                        if header not in df.columns:
                            df[header] = ''
                    df = df[headers]

                    # Convert numeric columns
                    numeric_columns = ['OP', 'Unit Cost', 'Order Carton', 'Total Amount']
                    for col in numeric_columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')

                    # Format numbers to match expected output
                    df['Unit Cost'] = df['Unit Cost'].round(2)
                    df['Total Amount'] = df['Total Amount'].round(2)
            
            else:
                return jsonify({'error': 'Unsupported PDF format'}), 400

            # Convert to Excel
            output = BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, sheet_name='Items', index=False)

            output.seek(0)
            return output.getvalue(), 200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': f'attachment; filename=converted.xlsx'
            }

    except Exception as e:
        logging.error(f"Error during conversion: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 