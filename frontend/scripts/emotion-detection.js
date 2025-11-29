// Emotion Detection JavaScript - Complete and Working
class EmotionDetector {
    constructor() {
        this.emotionsEmojiDict = {
            "anger": "😠",
            "disgust": "🤮", 
            "fear": "😨",
            "happy": "🤗",
            "joy": "😂",
            "neutral": "😐",
            "sad": "😔",
            "sadness": "😔",
            "shame": "😳",
            "surprise": "😮"
        };
        
        this.currentUser = this.getCurrentUser();
        
        // Check authentication immediately
        if (!this.checkAuthentication()) {
            return;
        }
        
        this.init();
    }

    getCurrentUser() {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            return JSON.parse(userData);
        }
        return null;
    }

    checkAuthentication() {
        if (!this.currentUser) {
            alert('Please sign in to use emotion detection');
            window.location.href = '/signin.html';
            return false;
        }
        return true;
    }

    init() {
        this.bindEvents();
        this.setupNavigation();
        
        // Show welcome message
        console.log(`✅ Welcome, ${this.currentUser.username}!`);
    }

    bindEvents() {
        // Emotion form submission
        const emotionForm = document.getElementById('emotionForm');
        if (emotionForm) {
            emotionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.analyzeEmotion();
            });
        }

        // Search functionality
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.searchPredictions();
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchPredictions();
                }
            });
        }
    }

    setupNavigation() {
        // Navigation menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.target.getAttribute('data-page');
                this.showPage(page);
                
                // Update active states
                document.querySelectorAll('.nav-item').forEach(nav => {
                    nav.classList.remove('active');
                });
                e.target.classList.add('active');

                // Load monitor data when monitor page is opened
                if (page === 'monitor') {
                    this.loadMonitorData();
                }
            });
        });
    }

    showPage(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        // Show selected page
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
        }
    }

    async analyzeEmotion() {
        const rawText = document.getElementById('rawText').value.trim();
        
        if (!rawText) {
            alert('Please enter some text to analyze.');
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            // Use the ML model via API call
            const predictionData = await this.predictEmotion(rawText);

            // Display results
            this.displayResults(rawText, predictionData);
            
            // Save to database
            await this.savePrediction(rawText, predictionData.prediction, predictionData.maxProbability);

        } catch (error) {
            console.error('Error analyzing emotion:', error);
            alert('Error analyzing text. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

async predictEmotion(text) {
    try {
        console.log("🔮 Sending request to ML model API...");
        const response = await fetch('/api/predict-emotion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get prediction from server');
        }

        const data = await response.json();
        console.log("✅ Received REAL ML model prediction:", data);
        return data;

    } catch (error) {
        console.error('❌ ML Model prediction failed:', error);
        throw new Error('ML model prediction failed: ' + error.message);
    }
}

    simulatePrediction(text) {
        // Smart simulation based on text content
        const emotions = Object.keys(this.emotionsEmojiDict);
        let prediction = "neutral";
        let maxProbability = 0.7;
        
        const textLower = text.toLowerCase();
        
        // Analyze text content to determine emotion
        if (textLower.includes('irritating') || textLower.includes('messed up') || textLower.includes('angry') || textLower.includes('mad')) {
            prediction = "anger";
            maxProbability = 0.85;
        } else if (textLower.includes('sad') || textLower.includes('upset') || textLower.includes('unhappy') || textLower.includes('depressed')) {
            prediction = "sadness";
            maxProbability = 0.82;
        } else if (textLower.includes('happy') || textLower.includes('joy') || textLower.includes('excited') || textLower.includes('great')) {
            prediction = "joy";
            maxProbability = 0.89;
        } else if (textLower.includes('scared') || textLower.includes('fear') || textLower.includes('afraid') || textLower.includes('worried')) {
            prediction = "fear";
            maxProbability = 0.78;
        } else if (textLower.includes('disgust') || textLower.includes('gross') || textLower.includes('nasty')) {
            prediction = "disgust";
            maxProbability = 0.75;
        } else if (textLower.includes('surprised') || textLower.includes('wow') || textLower.includes('amazing')) {
            prediction = "surprise";
            maxProbability = 0.80;
        }
        
        // Create probability distribution
        const probability = {};
        emotions.forEach(emotion => {
            probability[emotion] = emotion === prediction ? maxProbability : (1 - maxProbability) / (emotions.length - 1);
        });

        return {
            prediction: prediction,
            probability: probability,
            maxProbability: maxProbability
        };
    }

    displayResults(rawText, predictionData) {
        // Show results section
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        // Display original text
        const originalText = document.getElementById('originalText');
        if (originalText) {
            originalText.textContent = rawText;
        }

        // Display prediction with emoji
        const predictionText = document.getElementById('predictionText');
        const predictionEmoji = document.getElementById('predictionEmoji');
        if (predictionText && predictionEmoji) {
            predictionText.textContent = predictionData.prediction;
            predictionText.className = `prediction-text emotion-${predictionData.prediction}`;
            predictionEmoji.textContent = this.emotionsEmojiDict[predictionData.prediction] || '😐';
        }

        // Display confidence
        const confidenceScore = document.getElementById('confidenceScore');
        if (confidenceScore) {
            confidenceScore.textContent = `Confidence: ${(predictionData.maxProbability * 100).toFixed(1)}%`;
        }

        // Display probability chart
        this.renderProbabilityChart(predictionData.probability);
    }

    renderProbabilityChart(probability) {
        const emotions = Object.keys(this.emotionsEmojiDict);
        const probabilities = emotions.map(emotion => probability[emotion] || 0);

        const data = [{
            x: emotions,
            y: probabilities,
            type: 'bar',
            marker: {
                color: '#0068c9'
            }
        }];

        const layout = {
            title: '',
            xaxis: { 
                title: 'Emotions',
                tickangle: -45
            },
            yaxis: { 
                title: 'Probability',
                range: [0, 1]
            },
            margin: { t: 10, r: 30, l: 50, b: 100 },
            height: 300,
            showlegend: false
        };

        const config = {
            responsive: true,
            displayModeBar: true
        };

        const chartElement = document.getElementById('probabilityChart');
        if (chartElement) {
            Plotly.newPlot('probabilityChart', data, layout, config);
        }
    }

    async savePrediction(rawText, prediction, probability) {
    try {
        console.log("💾 Saving prediction for user_id:", this.currentUser.id);
        
        const response = await fetch('/api/emotion-prediction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rawtext: rawText,
                prediction: prediction,
                probability: probability,
                user_id: this.currentUser.id
            })
        });

        if (!response.ok) {
            console.warn('Failed to save prediction to database');
        } else {
            const result = await response.json();
            console.log('✅ Prediction saved to database with ID:', result.id);
        }

    } catch (error) {
        console.error('Error saving prediction:', error);
    }
}

    // Monitor Page Functions
    loadMonitorData() {
        // Update the page header to show it's user-specific data
        const pageHeader = document.querySelector('#monitor-page .page-header h1');
        if (pageHeader) {
            pageHeader.textContent = `Monitor App - ${this.currentUser.username}'s Data`;
        }

        // Then load the data
        this.loadMonitorDataContent();
    }

    async loadMonitorDataContent() {
    try {
        console.log("🔄 Loading monitor data for user:", this.currentUser);
        
        const [predictions, stats] = await Promise.all([
            this.fetchAllPredictions(),
            this.fetchEmotionStats()
        ]);

        console.log("📊 Predictions data:", predictions);
        console.log("📈 Stats data:", stats);

        this.updateMonitorStats(stats);
        this.renderEmotionDistributionChart(stats);
        this.renderConfidenceDistributionChart(predictions);
        this.updatePredictionsTable(predictions);

    } catch (error) {
        console.error('Error loading monitor data:', error);
    }
}

async fetchAllPredictions() {
    try {
        console.log("🔍 Fetching predictions for user_id:", this.currentUser.id);
        const url = `/api/emotion/user-predictions?user_id=${this.currentUser.id}`;
        console.log("📡 API URL:", url);
        
        const response = await fetch(url);
        console.log("📥 Response status:", response.status);
        
        if (!response.ok) {
            throw new Error('Failed to fetch predictions');
        }
        
        const predictions = await response.json();
        console.log("✅ Fetched predictions:", predictions);
        return predictions;
        
    } catch (error) {
        console.error('❌ Error fetching predictions:', error);
        return [];
    }
}

async fetchEmotionStats() {
    try {
        console.log("🔍 Fetching stats for user_id:", this.currentUser.id);
        const url = `/api/emotion/user-stats?user_id=${this.currentUser.id}`;
        console.log("📡 API URL:", url);
        
        const response = await fetch(url);
        console.log("📥 Response status:", response.status);
        
        if (!response.ok) {
            throw new Error('Failed to fetch emotion stats');
        }
        
        const stats = await response.json();
        console.log("✅ Fetched stats:", stats);
        return stats;
        
    } catch (error) {
        console.error('❌ Error fetching emotion stats:', error);
        return [];
    }
}
    updateMonitorStats(stats) {
        // Total predictions for this user
        const totalPredictions = stats.reduce((sum, stat) => sum + stat.count, 0);
        const totalElement = document.getElementById('totalPredictions');
        if (totalElement) {
            totalElement.textContent = totalPredictions;
        }

        // Most common emotion for this user
        const commonEmotionElement = document.getElementById('mostCommonEmotion');
        if (commonEmotionElement) {
            if (stats.length > 0) {
                const mostCommon = stats.reduce((prev, current) => 
                    (prev.count > current.count) ? prev : current
                );
                commonEmotionElement.textContent = mostCommon.prediction;
            } else {
                commonEmotionElement.textContent = '-';
            }
        }

        // Average confidence for this user
        const avgConfidenceElement = document.getElementById('avgConfidence');
        if (avgConfidenceElement) {
            if (stats.length > 0) {
                const avgConfidence = stats.reduce((sum, stat) => sum + stat.avg_probability, 0) / stats.length;
                avgConfidenceElement.textContent = `${(avgConfidence * 100).toFixed(1)}%`;
            } else {
                avgConfidenceElement.textContent = '0%';
            }
        }
    }

    renderEmotionDistributionChart(stats) {
        if (stats.length === 0) return;

        const emotions = stats.map(stat => stat.prediction);
        const counts = stats.map(stat => stat.count);

        const data = [{
            values: counts,
            labels: emotions,
            type: 'pie',
            textinfo: 'label+percent',
            hoverinfo: 'label+value+percent'
        }];

        const layout = {
            title: '',
            height: 300,
            showlegend: false,
            margin: { t: 10, r: 10, l: 10, b: 10 }
        };

        const chartElement = document.getElementById('emotionDistributionChart');
        if (chartElement) {
            Plotly.newPlot('emotionDistributionChart', data, layout, { responsive: true });
        }
    }

    renderConfidenceDistributionChart(predictions) {
        if (predictions.length === 0) return;

        const confidenceLevels = predictions.map(p => p.probability);
        
        const data = [{
            x: confidenceLevels,
            type: 'histogram',
            nbinsx: 10,
            marker: {
                color: '#0068c9'
            }
        }];

        const layout = {
            title: '',
            xaxis: { title: 'Confidence Level' },
            yaxis: { title: 'Count' },
            height: 300,
            margin: { t: 10, r: 10, l: 50, b: 50 }
        };

        const chartElement = document.getElementById('confidenceDistributionChart');
        if (chartElement) {
            Plotly.newPlot('confidenceDistributionChart', data, layout, { responsive: true });
        }
    }

    updatePredictionsTable(predictions) {
        const tbody = document.getElementById('predictionsTableBody');
        if (!tbody) return;
        
        if (predictions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #666;">
                        No emotion predictions yet. Start by analyzing some text on the Home page!
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = predictions.map((prediction, index) => `
            <tr>
                <td title="${prediction.rawtext}">
                    ${prediction.rawtext.length > 100 ? 
                      prediction.rawtext.substring(0, 100) + '...' : 
                      prediction.rawtext}
                </td>
                <td>
                    <span class="emotion-${prediction.prediction}">
                        ${prediction.prediction} ${this.emotionsEmojiDict[prediction.prediction] || ''}
                    </span>
                </td>
                <td>${(prediction.probability * 100).toFixed(4)}%</td>
                <td>${new Date(prediction.timeOfvisit).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    searchPredictions() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#predictionsTableBody tr');
        
        rows.forEach(row => {
            const text = row.cells[0].textContent.toLowerCase();
            const prediction = row.cells[1].textContent.toLowerCase();
            
            if (text.includes(searchTerm) || prediction.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    setLoadingState(loading) {
        const submitBtn = document.querySelector('.submit-btn');
        if (!submitBtn) return;
        
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Analyzing...';
            submitBtn.classList.add('loading');
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
            submitBtn.classList.remove('loading');
        }
    }
}

// Initialize the emotion detector when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EmotionDetector();
});