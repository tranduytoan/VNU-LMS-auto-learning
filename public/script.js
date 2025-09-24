class QuestionSearchApp {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.noResults = document.getElementById('noResults');
        this.searchInfo = document.getElementById('searchInfo');
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.showWelcomeMessage();
    }
    
    bindEvents() {
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.clearBtn.addEventListener('click', () => this.clearSearch());
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        this.searchInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '') {
                this.clearResults();
                this.showWelcomeMessage();
            }
        });
    }
    
    showWelcomeMessage() {
        this.resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #666;">
                <h3 style="margin-bottom: 20px;">🔍 Chào mừng đến với công cụ tìm kiếm câu hỏi PLDC</h3>
                <p>Nhập từ khóa để tìm kiếm trong ${this.formatNumber(0)} câu hỏi có sẵn</p>
                <div style="margin-top: 30px;">
                    <h4 style="color: #333; margin-bottom: 15px;">Mẹo tìm kiếm hiệu quả:</h4>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Nhập một phần của câu hỏi</li>
                        <li>Tìm theo đáp án đúng</li>
                        <li>Sử dụng từ khóa chính</li>
                        <li>Không cần dấu và viết hoa</li>
                    </ul>
                </div>
            </div>
        `;
        
        // Fetch total questions count
        this.getQuestionCount();
    }
    
    async getQuestionCount() {
        try {
            const response = await fetch('/api/questions?limit=1');
            const data = await response.json();
            
            if (data.total) {
                const welcomeText = this.resultsContainer.querySelector('p');
                if (welcomeText) {
                    welcomeText.textContent = `Nhập từ khóa để tìm kiếm trong ${this.formatNumber(data.total)} câu hỏi có sẵn`;
                }
            }
        } catch (error) {
            console.error('Error fetching question count:', error);
        }
    }
    
    async performSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            alert('Vui lòng nhập từ khóa tìm kiếm!');
            return;
        }
        
        this.showLoading();
        
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            this.hideLoading();
            this.displayResults(data);
            
        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            this.showError('Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại!');
        }
    }
    
    clearSearch() {
        this.searchInput.value = '';
        this.clearResults();
        this.showWelcomeMessage();
        this.searchInput.focus();
    }
    
    showLoading() {
        this.loadingIndicator.style.display = 'block';
        this.resultsContainer.style.display = 'none';
        this.noResults.style.display = 'none';
        this.searchInfo.style.display = 'none';
    }
    
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
        this.resultsContainer.style.display = 'block';
    }
    
    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.noResults.style.display = 'none';
        this.searchInfo.style.display = 'none';
    }
    
    displayResults(data) {
        const { results, total, searchTerm } = data;
        
        // Show search info
        this.searchInfo.innerHTML = `
            <strong>Tìm thấy ${this.formatNumber(total)} kết quả</strong> cho từ khóa: 
            <em>"${this.escapeHtml(searchTerm)}"</em>
        `;
        this.searchInfo.style.display = 'block';
        
        if (total === 0) {
            this.noResults.style.display = 'block';
            this.resultsContainer.style.display = 'none';
            return;
        }
        
        this.noResults.style.display = 'none';
        
        const html = results.map((question, index) => 
            this.createQuestionCard(question, index + 1, searchTerm)
        ).join('');
        
        this.resultsContainer.innerHTML = html;
    }
    
    createQuestionCard(question, index, searchTerm) {
        const questionTypeNames = {
            0: 'Trắc nghiệm',
            1: 'Đúng/Sai', 
            2: 'Lựa chọn',
            3: 'Phân tích',
            4: 'Ứng dụng',
            5: 'Tổng hợp'
        };
        
        const typeName = questionTypeNames[question.type] || `Loại ${question.type}`;
        
        return `
            <div class="question-card">
                <div class="question-type">${typeName}</div>
                
                <div class="question-text">
                    <strong>Câu ${index}:</strong> ${this.highlightText(question.question, searchTerm)}
                </div>
                
                <div class="answer-section">
                    <div class="correct-answer">
                        <strong>Đáp án đúng:</strong><br>
                        ${this.highlightText(question.correct_answer, searchTerm)}
                    </div>
                    
                    ${question.incorrect_answers && question.incorrect_answers.length > 0 ? `
                        <div class="incorrect-answers">
                            <strong style="color: #721c24; margin-bottom: 10px; display: block;">Các đáp án sai:</strong>
                            ${question.incorrect_answers.map(answer => `
                                <div class="incorrect-answer">
                                    ${this.highlightText(answer, searchTerm)}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    highlightText(text, searchTerm) {
        if (!searchTerm) return this.escapeHtml(text);
        
        const escapedText = this.escapeHtml(text);
        const escapedSearchTerm = this.escapeHtml(searchTerm);
        
        const regex = new RegExp(`(${this.escapeRegex(escapedSearchTerm)})`, 'gi');
        return escapedText.replace(regex, '<span class="highlight">$1</span>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    formatNumber(num) {
        return new Intl.NumberFormat('vi-VN').format(num);
    }
    
    showError(message) {
        this.resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #dc3545;">
                <h3>❌ Có lỗi xảy ra</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuestionSearchApp();
});