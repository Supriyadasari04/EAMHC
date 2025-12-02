const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();
const PORT = 3001;

app.use(cors({
    origin: "http://localhost:3001",
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const db = new sqlite3.Database('./eamhc.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to EAMHC SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'therapist', 'user')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    needsPasswordReset BOOLEAN DEFAULT FALSE,
    profile_data TEXT DEFAULT '{}'
  )`);

  console.log('EAMHC Database tables initialized');
}

app.get('/api/test-db', (req, res) => {
  db.all('SELECT * FROM users', (err, users) => {
    if (err) {
      console.log("❌ Database error:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log("✅ Current users in database:", users);
    res.json({ users: users });
  });
});


// ===== API ENDPOINTS =====
app.post('/api/signup', async (req, res) => {
  console.log("📥 SIGNUP REQUEST RECEIVED:", req.body);
  
  try {
    const { email, username, password, role } = req.body;
    if (!email || !username || !password || !role) {
      console.log("❌ Missing fields");
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['admin', 'therapist', 'user'].includes(role)) {
      console.log("❌ Invalid role:", role);
      return res.status(400).json({ error: 'Invalid role' });
    }
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        console.log("❌ Database error checking user:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (row) {
        console.log("❌ Email already exists:", email);
        return res.status(400).json({ error: 'Email already exists' });
      }

      const newUser = {
        id: 'user_' + Date.now(),
        email,
        username,
        password: password,
        role,
        createdAt: new Date().toISOString(),
        needsPasswordReset: false,
        profile_data: '{}'
      };

      console.log("📝 Creating new user:", newUser);
      db.run(
        `INSERT INTO users (id, email, username, password, role, createdAt, needsPasswordReset, profile_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newUser.id, newUser.email, newUser.username, newUser.password, newUser.role, newUser.createdAt, newUser.needsPasswordReset, newUser.profile_data],
        function(err) {
          if (err) {
            console.log("❌ Database insert error:", err);
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          console.log("✅ User created successfully in database");
          console.log("📤 Sending response to frontend");
          
          res.json({ 
            message: 'Account created successfully!',
            user: newUser
          });
        }
      );
    });
  } catch (error) {
    console.log("❌ Server error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/signin', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    db.get(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        const needsPasswordReset = (password === "HealthCoach@123");
        if (user.needsPasswordReset !== needsPasswordReset) {
          db.run(
            'UPDATE users SET needsPasswordReset = ? WHERE id = ?',
            [needsPasswordReset, user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('Error updating password reset flag:', updateErr);
              }
            }
          );
        }
        const userResponse = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          needsPasswordReset: needsPasswordReset,
          profile_data: user.profile_data
        };

        res.json({
          message: 'Login successful',
          user: userResponse
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;

  db.get(
    'SELECT id, email, username, role, createdAt, needsPasswordReset, profile_data FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    }
  );
});

// Save emotion prediction
app.post('/api/emotion-prediction', (req, res) => {
  const { rawtext, prediction, probability, user_id } = req.body;

  if (!rawtext || !prediction || probability === undefined || !user_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.run(
    'INSERT INTO emotionclftable (user_id, rawtext, prediction, probability, timeOfvisit) VALUES (?, ?, ?, ?, ?)',
    [user_id, rawtext, prediction, probability, new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Error saving emotion prediction:', err);
        return res.status(500).json({ error: 'Failed to save prediction' });
      }

      res.json({ 
        message: 'Emotion prediction saved successfully',
        id: this.lastID
      });
    }
  );
});

// Get user's emotion predictions - CHANGED URL
app.get('/api/emotion/user-predictions', (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  db.all(
    'SELECT * FROM emotionclftable WHERE user_id = ? ORDER BY timeOfvisit DESC',
    [user_id],
    (err, predictions) => {
      if (err) {
        console.error('Error fetching user emotion predictions:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(predictions);
    }
  );
});

// Get user's emotion statistics - CHANGED URL  
app.get('/api/emotion/user-stats', (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  db.all(`
    SELECT 
      prediction,
      COUNT(*) as count,
      AVG(probability) as avg_probability
    FROM emotionclftable 
    WHERE user_id = ?
    GROUP BY prediction
    ORDER BY count DESC
  `, [user_id], (err, stats) => {
    if (err) {
      console.error('Error fetching user emotion stats:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(stats);
  });
});
// ML Model Prediction Endpoint - DEBUG VERSION
app.post('/api/predict-emotion', (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        console.log("🔮 Making ML model prediction for text:", text);

        const { exec } = require('child_process');
        
        // Use the exact same command that works manually
        const command = `cd "D:\\Projects\\Supriya Self Projects\\EAMHC\\backend" && python predict_emotion.py "${text.replace(/"/g, '\\"')}"`;
        
        console.log('Executing command:', command);
        
        exec(command, (error, stdout, stderr) => {
            console.log('=== FULL PYTHON OUTPUT ===');
            console.log('STDOUT:', stdout);
            console.log('STDERR:', stderr);
            console.log('ERROR:', error);
            console.log('=== END PYTHON OUTPUT ===');

            // Try to find JSON in the output
            let jsonData = null;
            
            // Method 1: Look for JSON pattern
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonData = JSON.parse(jsonMatch[0]);
                    console.log("✅ Found and parsed JSON:", jsonData);
                } catch (e) {
                    console.log("❌ Failed to parse JSON match:", e.message);
                }
            }
            
            // Method 2: If no JSON found, try parsing the last line
            if (!jsonData) {
                const lines = stdout.split('\n').filter(line => line.trim());
                const lastLine = lines[lines.length - 1];
                try {
                    jsonData = JSON.parse(lastLine);
                    console.log("✅ Parsed last line as JSON:", jsonData);
                } catch (e) {
                    console.log("❌ Last line is not JSON:", lastLine);
                }
            }

            if (jsonData && jsonData.prediction) {
                console.log("✅ ML Model prediction successful:", jsonData);
                
                // Convert to the format expected by frontend
                const maxProbability = Math.max(...Object.values(jsonData.probability));
                res.json({
                    prediction: jsonData.prediction,
                    probability: jsonData.probability,
                    maxProbability: maxProbability
                });
            } else {
                console.error('❌ No valid prediction data found');
                res.status(500).json({ 
                    error: 'ML model prediction failed - no valid output',
                    rawStdout: stdout,
                    rawStderr: stderr,
                    parsedData: jsonData
                });
            }
        });

    } catch (error) {
        console.error('❌ Prediction endpoint error:', error);
        res.status(500).json({ 
            error: 'Prediction failed',
            details: error.message
        });
    }
});


// ===== FRONTEND ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/landing.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/signup.html'));
});

app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/signup.html'));
});

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/signin.html'));
});

app.get('/signin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/signin.html'));
});

app.get('/emotion-detection', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/emotion-detection.html'));
});

app.get('/emotion-detection.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/emotion-detection.html'));
});


// Fallback simulation function (only used if Python model fails)
function simulatePrediction(text) {
    const emotions = ["anger", "disgust", "fear", "happy", "joy", "neutral", "sad", "sadness", "shame", "surprise"];
    
    // Smart simulation based on text content
    let prediction = "neutral";
    let maxProbability = 0.7;
    
    const textLower = text.toLowerCase();
    
    // Analyze text content to determine emotion
    if (textLower.includes('irritating') || textLower.includes('messed up') || textLower.includes('angry') || textLower.includes('mad') || textLower.includes('annoying')) {
        prediction = "anger";
        maxProbability = 0.85;
    } else if (textLower.includes('sad') || textLower.includes('upset') || textLower.includes('unhappy') || textLower.includes('depressed')) {
        prediction = "sadness";
        maxProbability = 0.82;
    } else if (textLower.includes('happy') || textLower.includes('joy') || textLower.includes('excited') || textLower.includes('great') || textLower.includes('good')) {
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

    console.log("🔄 Using simulation for:", text, "->", prediction);
    
    return {
        prediction: prediction,
        probability: probability,
        maxProbability: maxProbability
    };
}


app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/styles', express.static(path.join(__dirname, '../frontend/styles')));
app.use('/scripts', express.static(path.join(__dirname, '../frontend/scripts')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.listen(PORT, () => {
  console.log(`🚀 EAMHC Full Stack Application running on http://localhost:${PORT}`);
  console.log(`📁 Frontend served from: ${path.join(__dirname, '../frontend')}`);
  console.log(`🗄️  Database: eamhc.db`);
});