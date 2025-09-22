## Setup

```bash
npm install
cp .env.example .env
```

Get tokens from browser DevTools (F12) > Console tab, paste and run:

```javascript
console.log('ACCESS_TOKEN:', localStorage.getItem('access_token'));
console.log('REFRESH_TOKEN:', localStorage.getItem('refresh_token'));
```

Copy from console output to `.env` file.

## Usage

```bash
npm start
```

**Modes:**
- **Auto**: Process all available lessons
- **Manual**: Select specific lessons  
- **Create config**: Generate `config.json` for batch processing

**Environment:**
- `USE_CONFIG_FILE=true/false`: Use config file or interactive mode

Tests/exams are automatically skipped.