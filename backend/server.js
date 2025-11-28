// server.js - Emotion Aware AI Health Coach Backend + Frontend
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ SERVE ALL FRONTEND FILES from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize SQLite Database
const db = new sqlite3.Database('./eamhc.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to EAMHC SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Users table
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

  // Sessions table (replaces tickets)
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    emotion_score INTEGER NOT NULL CHECK(emotion_score >= 1 AND emotion_score <= 10),
    emotion_type TEXT NOT NULL CHECK(emotion_type IN ('anxiety', 'depression', 'stress', 'happy', 'calm', 'angry', 'sad', 'excited')),
    session_type TEXT NOT NULL CHECK(session_type IN ('therapy', 'coaching', 'emergency', 'check-in')),
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    assignedTo TEXT,
    session_date TEXT NOT NULL,
    duration INTEGER DEFAULT 60,
    session_notes TEXT DEFAULT '',
    FOREIGN KEY (createdBy) REFERENCES users(email),
    FOREIGN KEY (assignedTo) REFERENCES users(username)
  )`);

  // Goals table
  db.run(`CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('mental_health', 'fitness', 'nutrition', 'sleep', 'relationships', 'career')),
    target_date TEXT NOT NULL,
    current_status TEXT DEFAULT 'not-started' CHECK(current_status IN ('not-started', 'in-progress', 'completed', 'abandoned')),
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Mood entries table
  db.run(`CREATE TABLE IF NOT EXISTS mood_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mood_score INTEGER NOT NULL CHECK(mood_score >= 1 AND mood_score <= 10),
    mood_type TEXT NOT NULL CHECK(mood_type IN ('anxiety', 'depression', 'stress', 'happy', 'calm', 'angry', 'sad', 'excited', 'neutral')),
    notes TEXT,
    created_at TEXT NOT NULL,
    factors TEXT DEFAULT '[]',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Notifications table
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    role TEXT,
    email TEXT,
    timestamp TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE
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



// ===== FRONTEND ROUTES =====
// Serve HTML pages with BOTH routes (with and without .html extension)
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

app.get('/user-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/user-dashboard.html'));
});

app.get('/user-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/user-dashboard.html'));
});

app.get('/therapist-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/therapist-dashboard.html'));
});

app.get('/therapist-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/therapist-dashboard.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/admin-dashboard.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/admin-dashboard.html'));
});

// ===== API ENDPOINTS =====
// User Registration Endpoint
// User Registration Endpoint - ADD DEBUGGING
app.post('/api/signup', async (req, res) => {
  console.log("📥 SIGNUP REQUEST RECEIVED:", req.body);
  
  try {
    const { email, username, password, role } = req.body;

    // Validation
    if (!email || !username || !password || !role) {
      console.log("❌ Missing fields");
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'therapist', 'user'].includes(role)) {
      console.log("❌ Invalid role:", role);
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
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

      // Insert user into database
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

// User Login Endpoint
app.post('/api/signin', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username and password
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

        // Check if using default password
        const needsPasswordReset = (password === "HealthCoach@123");

        // Update needsPasswordReset if different from current value
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

        // Return user data
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

// Get user by ID
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

// Update user password
app.put('/api/user/:id/password', (req, res) => {
  const userId = req.params.id;
  const { newPassword, isPasswordReset = false } = req.body;

  if (isPasswordReset) {
    db.run(
      'UPDATE users SET password = ?, needsPasswordReset = ? WHERE id = ?',
      [newPassword, false, userId],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update password' });
        }

        res.json({ message: 'Password updated successfully' });
      }
    );
  } else {
    const { currentPassword } = req.body;
    
    // Verify current password first
    db.get(
      'SELECT * FROM users WHERE id = ? AND password = ?',
      [userId, currentPassword],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update to new password
        db.run(
          'UPDATE users SET password = ?, needsPasswordReset = ? WHERE id = ?',
          [newPassword, false, userId],
          function(updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: 'Failed to update password' });
            }

            res.json({ message: 'Password updated successfully' });
          }
        );
      }
    );
  }
});

// ===== ADMIN ENDPOINTS =====

// Get all sessions with filtering
app.get('/api/sessions', (req, res) => {
  const { searchField, searchValue } = req.query;
  
  let query = `
    SELECT s.*, u1.username as createdByName, u2.username as assignedToName 
    FROM sessions s 
    LEFT JOIN users u1 ON s.createdBy = u1.email 
    LEFT JOIN users u2 ON s.assignedTo = u2.username
  `;
  let params = [];

  if (searchField && searchValue) {
    query += ` WHERE s.${searchField} LIKE ?`;
    params.push(`%${searchValue}%`);
  }

  query += ' ORDER BY s.session_date DESC';

  db.all(query, params, (err, sessions) => {
    if (err) {
      console.error('Error fetching sessions:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(sessions);
  });
});

// Get session statistics
app.get('/api/sessions/stats', (req, res) => {
  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN emotion_type IN ('anxiety', 'depression', 'stress') THEN 1 ELSE 0 END) as negativeEmotions,
      SUM(CASE WHEN emotion_type IN ('happy', 'calm', 'excited') THEN 1 ELSE 0 END) as positiveEmotions
    FROM sessions
  `, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result[0]);
  });
});

// Get all users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, username, role, createdAt, needsPasswordReset, profile_data FROM users ORDER BY role', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

// Create new user
app.post('/api/users', (req, res) => {
  const { username, email, role } = req.body;

  if (!username || !email || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if user already exists
    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const newUser = {
      id: 'user_' + Date.now(),
      email,
      username,
      password: 'HealthCoach@123',
      role,
      createdAt: new Date().toISOString(),
      needsPasswordReset: true,
      profile_data: '{}'
    };

    db.run(
      'INSERT INTO users (id, email, username, password, role, createdAt, needsPasswordReset, profile_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [newUser.id, newUser.email, newUser.username, newUser.password, newUser.role, newUser.createdAt, newUser.needsPasswordReset, newUser.profile_data],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }
        res.json({ message: 'User created successfully', user: newUser });
      }
    );
  });
});

// Get all therapists
app.get('/api/therapists', (req, res) => {
  db.all('SELECT id, email, username, role, createdAt, profile_data FROM users WHERE role = "therapist" ORDER BY username', (err, therapists) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(therapists);
  });
});

// Assign therapist to session
app.put('/api/sessions/:id/assign', (req, res) => {
  const sessionId = req.params.id;
  const { therapistUsername, adminEmail } = req.body;

  db.run(
    'UPDATE sessions SET assignedTo = ?, status = ? WHERE id = ?',
    [therapistUsername, therapistUsername ? 'scheduled' : 'scheduled', sessionId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to assign therapist' });
      }

      // Get session details for notification
      db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
        if (session) {
          const timestamp = new Date().toLocaleString();
          
          // Notification for user
          if (session.createdBy) {
            db.run(
              'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
              [`Your session #${sessionId} has been assigned to therapist ${therapistUsername}.`, 'user', session.createdBy, timestamp, false]
            );
          }

          // Notification for therapist
          if (therapistUsername) {
            db.get('SELECT email FROM users WHERE username = ?', [therapistUsername], (err, therapist) => {
              if (therapist) {
                db.run(
                  'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
                  [`You have been assigned to session #${sessionId} (${session.title}).`, 'therapist', therapist.email, timestamp, false]
                );
              }
            });
          }

          // Notification for admin
          db.run(
            'INSERT INTO notifications (message, role, timestamp, read) VALUES (?, ?, ?, ?)',
            [`Session #${sessionId} assigned to therapist ${therapistUsername}.`, 'admin', timestamp, false]
          );
        }

        res.json({ message: 'Therapist assigned successfully' });
      });
    }
  );
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// ===== THERAPIST ENDPOINTS =====

// Get therapist's assigned sessions
app.get('/api/therapist/sessions', (req, res) => {
  const { therapistUsername, status, search } = req.query;
  
  let query = `
    SELECT s.*, u.username as createdByName
    FROM sessions s 
    LEFT JOIN users u ON s.createdBy = u.email 
    WHERE s.assignedTo = ?
  `;
  let params = [therapistUsername];

  if (status && status !== 'all') {
    query += ' AND s.status = ?';
    params.push(status);
  }

  if (search) {
    query += ` AND (
      s.title LIKE ? OR 
      s.emotion_type LIKE ? OR 
      s.id LIKE ? OR
      s.description LIKE ?
    )`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  query += ' ORDER BY s.session_date DESC';

  db.all(query, params, (err, sessions) => {
    if (err) {
      console.error('Error fetching therapist sessions:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(sessions);
  });
});

// Get therapist statistics
app.get('/api/therapist/stats', (req, res) => {
  const { therapistUsername } = req.query;

  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      AVG(emotion_score) as avgEmotionScore
    FROM sessions 
    WHERE assignedTo = ?
  `, [therapistUsername], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result[0]);
  });
});

// Update session status
app.put('/api/sessions/:id/status', (req, res) => {
  const sessionId = req.params.id;
  const { status, therapistUsername } = req.body;

  db.run(
    'UPDATE sessions SET status = ? WHERE id = ? AND assignedTo = ?',
    [status, sessionId, therapistUsername],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update session status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Session not found or not assigned to you' });
      }

      // Get session details for notification
      db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session) => {
        if (session) {
          const timestamp = new Date().toLocaleString();
          
          // Notification for user
          if (session.createdBy) {
            db.run(
              'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
              [`Status of your session #${sessionId} has been changed to "${status}".`, 'user', session.createdBy, timestamp, false]
            );
          }

          // Notification for admin
          db.run(
            'INSERT INTO notifications (message, role, timestamp, read) VALUES (?, ?, ?, ?)',
            [`Session #${sessionId} status changed to "${status}" by ${therapistUsername}.`, 'admin', timestamp, false]
          );
        }

        res.json({ message: 'Session status updated successfully' });
      });
    }
  );
});

// Add session notes
app.put('/api/sessions/:id/notes', (req, res) => {
  const sessionId = req.params.id;
  const { session_notes, therapistUsername } = req.body;

  db.run(
    'UPDATE sessions SET session_notes = ? WHERE id = ? AND assignedTo = ?',
    [session_notes, sessionId, therapistUsername],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update session notes' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Session not found or not assigned to you' });
      }

      res.json({ message: 'Session notes updated successfully' });
    }
  );
});

// Get therapist's assigned clients
app.get('/api/therapist/clients', (req, res) => {
  const { therapistUsername } = req.query;

  const query = `
    SELECT DISTINCT u.id, u.username, u.email, u.profile_data
    FROM users u
    JOIN sessions s ON u.email = s.createdBy
    WHERE s.assignedTo = ?
    ORDER BY u.username
  `;

  db.all(query, [therapistUsername], (err, clients) => {
    if (err) {
      console.error('Error fetching therapist clients:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(clients);
  });
});

// ===== USER ENDPOINTS =====

// Create new session
app.post('/api/sessions', (req, res) => {
  const { 
    title, 
    description, 
    emotion_score, 
    emotion_type, 
    session_type, 
    createdBy,
    session_date,
    duration
  } = req.body;

  // Validate required fields
  if (!title || !description || !emotion_score || !emotion_type || !session_type || !createdBy || !session_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const newSession = {
    id: "SESS-" + Date.now(),
    title,
    description,
    emotion_score: parseInt(emotion_score),
    emotion_type,
    session_type,
    status: "scheduled",
    createdBy,
    createdAt: new Date().toLocaleString(),
    assignedTo: null,
    session_date,
    duration: duration || 60,
    session_notes: ''
  };

  // Insert session into database
  db.run(
    `INSERT INTO sessions (id, title, description, emotion_score, emotion_type, session_type, status, createdBy, createdAt, assignedTo, session_date, duration, session_notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newSession.id, 
      newSession.title, 
      newSession.description, 
      newSession.emotion_score, 
      newSession.emotion_type, 
      newSession.session_type, 
      newSession.status, 
      newSession.createdBy, 
      newSession.createdAt, 
      newSession.assignedTo,
      newSession.session_date,
      newSession.duration,
      newSession.session_notes
    ],
    function(err) {
      if (err) {
        console.error('Error creating session:', err);
        return res.status(500).json({ error: 'Failed to create session' });
      }

      const timestamp = new Date().toLocaleString();
      
      // Notification for admin
      db.run(
        'INSERT INTO notifications (message, role, timestamp, read) VALUES (?, ?, ?, ?)',
        [`New session request from ${createdBy}: #${newSession.id}`, 'admin', timestamp, false]
      );

      // Notification for user
      db.run(
        'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
        [`Your session #${newSession.id} has been created successfully. A therapist will be assigned soon.`, 'user', createdBy, timestamp, false]
      );

      res.json({ 
        message: 'Session created successfully!',
        session: newSession
      });
    }
  );
});

// Get user's sessions
app.get('/api/user/sessions', (req, res) => {
  const { userEmail } = req.query;
  
  const query = `
    SELECT s.*, u.username as assignedToName
    FROM sessions s 
    LEFT JOIN users u ON s.assignedTo = u.username
    WHERE s.createdBy = ?
    ORDER BY s.session_date DESC
  `;

  db.all(query, [userEmail], (err, sessions) => {
    if (err) {
      console.error('Error fetching user sessions:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(sessions);
  });
});

// Get user statistics
app.get('/api/user/stats', (req, res) => {
  const { userEmail } = req.query;

  db.all(`
    SELECT 
      COUNT(*) as totalSessions,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      AVG(emotion_score) as avgEmotionScore
    FROM sessions 
    WHERE createdBy = ?
  `, [userEmail], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result[0]);
  });
});

// Add mood entry
app.post('/api/mood-entries', (req, res) => {
  const { 
    user_id, 
    mood_score, 
    mood_type, 
    notes,
    factors
  } = req.body;

  if (!user_id || !mood_score || !mood_type) {
    return res.status(400).json({ error: 'User ID, mood score, and mood type are required' });
  }

  const newMoodEntry = {
    id: "MOOD-" + Date.now(),
    user_id,
    mood_score: parseInt(mood_score),
    mood_type,
    notes: notes || '',
    created_at: new Date().toLocaleString(),
    factors: factors ? JSON.stringify(factors) : '[]'
  };

  db.run(
    `INSERT INTO mood_entries (id, user_id, mood_score, mood_type, notes, created_at, factors) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newMoodEntry.id, 
      newMoodEntry.user_id, 
      newMoodEntry.mood_score, 
      newMoodEntry.mood_type, 
      newMoodEntry.notes, 
      newMoodEntry.created_at,
      newMoodEntry.factors
    ],
    function(err) {
      if (err) {
        console.error('Error creating mood entry:', err);
        return res.status(500).json({ error: 'Failed to create mood entry' });
      }

      res.json({ 
        message: 'Mood entry created successfully!',
        moodEntry: newMoodEntry
      });
    }
  );
});

// Get user's mood history
app.get('/api/user/mood-entries', (req, res) => {
  const { user_id, limit = 30 } = req.query;
  
  const query = `
    SELECT * FROM mood_entries 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `;

  db.all(query, [user_id, parseInt(limit)], (err, moodEntries) => {
    if (err) {
      console.error('Error fetching mood entries:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(moodEntries);
  });
});

// Create health goal
app.post('/api/goals', (req, res) => {
  const { 
    user_id, 
    title, 
    description, 
    category, 
    target_date 
  } = req.body;

  if (!user_id || !title || !description || !category || !target_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const newGoal = {
    id: "GOAL-" + Date.now(),
    user_id,
    title,
    description,
    category,
    target_date,
    current_status: 'not-started',
    progress: 0,
    created_at: new Date().toLocaleString()
  };

  db.run(
    `INSERT INTO goals (id, user_id, title, description, category, target_date, current_status, progress, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newGoal.id, 
      newGoal.user_id, 
      newGoal.title, 
      newGoal.description, 
      newGoal.category, 
      newGoal.target_date,
      newGoal.current_status,
      newGoal.progress,
      newGoal.created_at
    ],
    function(err) {
      if (err) {
        console.error('Error creating goal:', err);
        return res.status(500).json({ error: 'Failed to create goal' });
      }

      res.json({ 
        message: 'Goal created successfully!',
        goal: newGoal
      });
    }
  );
});

// Get user's goals
app.get('/api/user/goals', (req, res) => {
  const { user_id } = req.query;
  
  const query = `
    SELECT * FROM goals 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `;

  db.all(query, [user_id], (err, goals) => {
    if (err) {
      console.error('Error fetching goals:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(goals);
  });
});

// Update goal progress
app.put('/api/goals/:id/progress', (req, res) => {
  const goalId = req.params.id;
  const { progress, current_status } = req.body;

  let updateFields = [];
  let params = [];

  if (progress !== undefined) {
    updateFields.push('progress = ?');
    params.push(progress);
  }

  if (current_status) {
    updateFields.push('current_status = ?');
    params.push(current_status);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(goalId);

  db.run(
    `UPDATE goals SET ${updateFields.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update goal progress' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      res.json({ message: 'Goal progress updated successfully' });
    }
  );
});

// ===== NOTIFICATION ENDPOINTS =====

// Get notifications for user
app.get('/api/notifications', (req, res) => {
  const { email, role } = req.query;

  let query = 'SELECT * FROM notifications WHERE read = 0 AND (email = ? OR role = ?) ORDER BY timestamp DESC';
  
  db.all(query, [email, role], (err, notifications) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(notifications);
  });
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const notificationId = req.params.id;

  db.run('UPDATE notifications SET read = 1 WHERE id = ?', [notificationId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
    res.json({ message: 'Notification marked as read' });
  });
});

// Mark all notifications as read for user
app.put('/api/notifications/read-all', (req, res) => {
  const { email, role } = req.body;

  db.run(
    'UPDATE notifications SET read = 1 WHERE (email = ? OR role = ?) AND read = 0',
    [email, role],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to mark notifications as read' });
      }
      res.json({ message: 'All notifications marked as read' });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EAMHC Full Stack Application running on http://localhost:${PORT}`);
  console.log(`📁 Frontend served from: ${path.join(__dirname, '../frontend')}`);
  console.log(`🗄️  Database: eamhc.db`);
});