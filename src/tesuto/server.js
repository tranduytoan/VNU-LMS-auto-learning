import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load questions data
let questions = [];
try {
    const data = fs.readFileSync('questions.json', 'utf8');
    questions = JSON.parse(data);
    console.log(`Đã tải ${questions.length} câu hỏi`);
} catch (error) {
    console.error('Lỗi đọc file questions.json:', error);
}

// API endpoint to search questions
app.get('/api/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json({ results: [], total: 0 });
    }
    
    const searchTerm = q.toLowerCase();
    const results = questions.filter(question => 
        question.question.toLowerCase().includes(searchTerm) ||
        question.correct_answer.toLowerCase().includes(searchTerm) ||
        question.incorrect_answers.some(answer => 
            answer.toLowerCase().includes(searchTerm)
        )
    );
    
    res.json({ 
        results: results,
        total: results.length,
        searchTerm: q
    });
});

// API endpoint to get all questions (with pagination)
app.get('/api/questions', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedQuestions = questions.slice(startIndex, endIndex);
    
    res.json({
        questions: paginatedQuestions,
        total: questions.length,
        page: page,
        limit: limit,
        totalPages: Math.ceil(questions.length / limit)
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    console.log('Nhấn Ctrl+C để dừng server');
});