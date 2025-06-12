# Multi-PDF AI Data Extractor

A powerful Next.js application that extracts structured data from PDF files using Claude AI, featuring multi-PDF processing, split-screen comparison, editable results, and secure access control.

## 🚀 Features

- **Multi-PDF Processing**: Upload and process multiple PDFs simultaneously
- **AI-Powered Extraction**: Uses Claude Sonnet 4 for intelligent data extraction
- **Split-Screen Interface**: PDF viewer on the left, extracted data on the right
- **Editable Results**: Click any field to edit extracted data inline
- **Excel Export**: Export all processed data to Excel with proper formatting
- **Security**: IP whitelisting + passcode authentication
- **Real-time Processing**: Live updates and progress tracking

## 🔧 Project Structure

```
PDFAi/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── extract-data/
│   │   │   └── extract-text-pdf2json/
│   │   ├── login/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── middleware.ts
├── public/
├── package.json
├── next.config.js
├── vercel.json
└── SECURITY_SETUP.md
```

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd PDFAi
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your credentials:

   ```
   CLAUDE_API_KEY=your_claude_api_key_here
   PDF_AI_PASSCODE=YourSecurePasscode123!
   ```

4. **Configure security (Important!)**

   - Edit `src/middleware.ts` to add your allowed IP addresses
   - Change the default passcode in `.env.local`
   - See `SECURITY_SETUP.md` for detailed instructions

5. **Run development server**
   ```bash
   npm run dev
   ```

## 🌐 Vercel Deployment

This project is optimized for Vercel deployment:

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/PDFAi)

### Manual Deployment

1. **Push to GitHub/GitLab**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**

   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Vercel will auto-detect Next.js configuration

3. **Set Environment Variables**
   In Vercel dashboard → Settings → Environment Variables:

   ```
   CLAUDE_API_KEY=your_claude_api_key_here
   PDF_AI_PASSCODE=YourSecurePasscode123!
   ```

4. **Deploy**
   - Vercel will automatically build and deploy
   - Your app will be available at `https://your-app-name.vercel.app`

### Vercel Configuration

The project includes:

- `vercel.json` for deployment settings
- `.vercelignore` for excluding unnecessary files
- Optimized API function timeouts (60s for AI processing)
- CORS headers for API endpoints

## 🔐 Security Setup

### Default Credentials

- **Passcode**: `PDFAi2024!`
- **Allowed IPs**: localhost + your configured IPs

⚠️ **IMPORTANT**: Change these before deployment!

### Configuration Steps

1. **IP Whitelisting**: Edit `ALLOWED_IPS` in `src/middleware.ts`
2. **Passcode**: Set `PDF_AI_PASSCODE` environment variable
3. **Security Flow**: IP check → Login → 24-hour session

See `SECURITY_SETUP.md` for detailed security configuration.

## 📊 Data Extraction

The system extracts 14 structured fields:

- Order ID, Remarks, Customer Code, Customer Name
- Delivery Date, Contact Name, Delivery Addresses
- Postal Code, Product Code, Product Name
- Quantity, UOM, Unit Price

### Extraction Features

- **Smart Field Mapping**: AI intelligently maps PDF content to fields
- **UOM Standardization**: Converts units to standard format (CTN, PKT, PCS, etc.)
- **Date Formatting**: Converts to DD/MM/YY format
- **Company Logic**: Extracts customer names, not supplier names

## 🎯 Usage

1. **Access the application** (IP + passcode authentication)
2. **Upload multiple PDFs** via the file selector
3. **Process PDFs** individually or all at once
4. **View results** in split-screen mode:
   - Left: PDF viewer with zoom/navigation
   - Right: Extracted data in editable cards
5. **Edit data** by clicking any field
6. **Export to Excel** with all corrections included

## 🔧 Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linting
```

### Key Dependencies

- **Next.js 15**: React framework
- **Claude AI SDK**: AI data extraction
- **react-pdf**: PDF viewing
- **xlsx**: Excel export
- **Tailwind CSS**: Styling

## 📝 API Endpoints

- `POST /api/auth` - Passcode authentication
- `POST /api/extract-text-pdf2json` - PDF text extraction
- `POST /api/extract-data` - AI data extraction

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions:

1. Check the `SECURITY_SETUP.md` for security configuration
2. Review the API logs in Vercel dashboard
3. Ensure Claude API key is valid and has sufficient credits
4. Verify IP whitelist includes your access IP

---

**Built with ❤️ using Next.js and Claude AI**
