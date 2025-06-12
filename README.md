# PDF Text Extractor

A modern web application that allows users to upload PDF files and extract text content using PyMuPDF. Built with Next.js and deployed as a single application on Vercel with Python serverless functions.

## 🚀 **Deploy on Vercel (One-Click)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/PDFAi)

## ✨ Features

- **📄 PDF Upload**: Secure file upload with validation (up to 16MB)
- **🔍 Text Extraction**: Powered by PyMuPDF for accurate text extraction
- **📖 Page Navigation**: Browse extracted text page by page
- **📊 Statistics**: View total pages and word count
- **🎨 Modern UI**: Beautiful, responsive design with TailwindCSS
- **⚡ Serverless**: Runs entirely on Vercel with Python serverless functions

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: Python serverless functions (Vercel)
- **PDF Processing**: PyMuPDF
- **Deployment**: Vercel (single deployment)

## 🏁 Quick Start

### Option 1: Deploy to Vercel (Recommended)

1. Click the "Deploy" button above
2. Connect your GitHub account
3. Deploy - that's it! ✨

### Option 2: Local Development

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd PDFAi/frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run development server:**

   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Local: http://localhost:3000

## 📁 Project Structure

```
PDFAi/
├── frontend/                    # Next.js application (deploy this folder to Vercel)
│   ├── api/
│   │   └── extract-text.py     # Python serverless function
│   ├── src/
│   │   └── app/
│   │       └── page.tsx        # Main React component
│   ├── requirements.txt        # Python dependencies for Vercel
│   ├── vercel.json            # Vercel configuration
│   └── package.json           # Node.js dependencies
├── backend/                    # Legacy Flask backend (not needed for Vercel)
└── README.md
```

## 🔧 API Endpoints

### `POST /api/extract-text`

Extract text from uploaded PDF file.

**Request:**

- Content-Type: `multipart/form-data`
- Body: PDF file with key `file`

**Response:**

```json
{
  "success": true,
  "filename": "document.pdf",
  "total_pages": 5,
  "total_words": 1250,
  "content": [
    {
      "page": 1,
      "text": "Extracted text content from page 1..."
    }
  ]
}
```

## 📖 Usage

1. **Upload a PDF**: Click the file input to select a PDF file
2. **Extract Text**: Click "Extract Text" to process the PDF
3. **Preview Results**: View the extracted text with statistics
4. **Navigate Pages**: Use the dropdown or buttons to switch between pages

## ⚙️ Configuration

### Vercel Settings

- **Function Region**: Auto (optimized globally)
- **Max Duration**: 30 seconds (configurable in `vercel.json`)
- **Memory**: 1024MB (Vercel default)
- **File Size Limit**: 4.5MB (Vercel limit)

### Environment Variables

No environment variables required! Everything works out of the box.

## 🚦 Deployment

### Deploy to Vercel

1. **Via GitHub (Recommended):**

   - Push your code to GitHub
   - Connect repository to Vercel
   - Deploy automatically on commits

2. **Via Vercel CLI:**

   ```bash
   cd frontend
   npx vercel
   ```

3. **Via Web Interface:**
   - Upload the `frontend/` folder to Vercel
   - Deploy with default settings

## 🔍 Troubleshooting

### Common Issues

**File too large error:**

- Vercel has a 4.5MB limit for serverless functions
- Consider splitting large PDFs or using a different hosting solution for larger files

**Function timeout:**

- Large PDFs may timeout (30s limit)
- Adjust `maxDuration` in `vercel.json` if needed (up to 60s on paid plans)

**Python dependency issues:**

- Ensure `requirements.txt` is in the frontend folder
- PyMuPDF is pre-compiled and should work on Vercel

### Local Development Issues

**API not working locally:**

- Make sure you're running `npm run dev` from the `frontend/` directory
- Python serverless functions need Vercel CLI for local testing:
  ```bash
  npx vercel dev
  ```

## 🔒 Security

- File type validation (PDFs only)
- File size limits
- Temporary file cleanup
- No data persistence (files are processed and discarded)

## 📜 License

MIT License - feel free to use this project for any purpose!

---

## 🎯 Why This Architecture?

**Single Deployment**: Everything runs on Vercel - no need for separate backend hosting
**Serverless**: Scales automatically, pay only for usage
**Fast**: Global CDN for frontend, serverless functions for processing
**Simple**: One repository, one deployment, zero configuration
