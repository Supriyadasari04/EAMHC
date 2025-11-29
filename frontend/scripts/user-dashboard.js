/* ============================================
   EAMHC User Dashboard Script
   Connected to server.js APIs
   ============================================ */

// Global variables
let currentTab = 'sessions';

// === On Page Load ===
window.onload = async function () {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "user") {
    window.location.href = "signin.html";
    return;
  }

  document.getElementById("customer-name").innerText = currentUser.username;

  // Check if password reset is required
  if (currentUser.password === "HealthCoach@123" || currentUser.needsPasswordReset) {
    showPasswordResetModal();
  }

  // Initialize modals
  initializeModals();
  
  // Load initial data
  await loadDashboardData();
  await updateNotifCount();
};

// === Initialize Modal Event Listeners ===
function initializeModals() {
  // Session Modal
  const sessionModal = document.getElementById("session-modal");
  const openSessionBtn = document.querySelector('[onclick="openSessionModal()"]');
  const cancelSessionBtn = document.getElementById("cancel-session");
  const saveSessionBtn = document.getElementById("save-session");

  openSessionBtn.addEventListener("click", openSessionModal);
  cancelSessionBtn.addEventListener("click", () => sessionModal.style.display = "none");
  saveSessionBtn.addEventListener("click", createSession);

  // Mood Modal
  const moodModal = document.getElementById("mood-modal");
  const cancelMoodBtn = document.getElementById("cancel-mood");
  const saveMoodBtn = document.getElementById("save-mood");

  cancelMoodBtn.addEventListener("click", () => moodModal.style.display = "none");
  saveMoodBtn.addEventListener("click", createMoodEntry);

  // Goal Modal
  const goalModal = document.getElementById("goal-modal");
  const cancelGoalBtn = document.getElementById("cancel-goal");
  const saveGoalBtn = document.getElementById("save-goal");

  cancelGoalBtn.addEventListener("click", () => goalModal.style.display = "none");
  saveGoalBtn.addEventListener("click", createGoal);
}

// === Modal Open Functions ===
function openSessionModal() {
  document.getElementById("session-modal").style.display = "flex";
  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById("session-date").value = tomorrow.toISOString().slice(0, 16);
}

function openMoodModal() {
  document.getElementById("mood-modal").style.display = "flex";
  // Clear previous entries
  document.getElementById("mood-score").value = "";
  document.getElementById("mood-notes").value = "";
}

function openGoalModal() {
  document.getElementById("goal-modal").style.display = "flex";
  // Set default target date to 30 days from now
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  document.getElementById("goal-target-date").value = futureDate.toISOString().slice(0, 10);
}

// === Tab Switching ===
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  // Activate selected button
  event.target.classList.add('active');
  
  currentTab = tabName;
  
  // Refresh tab data if needed
  if (tabName === 'sessions') {
    renderSessions();
  } else if (tabName === 'mood') {
    renderMoodEntries();
  } else if (tabName === 'goals') {
    renderGoals();
  }
}

// === Load All Dashboard Data ===
async function loadDashboardData() {
  await updateStats();
  await renderSessions();
  await renderMoodEntries();
  await renderGoals();
}

// === Create Session ===
async function createSession() {
  const title = document.getElementById("session-title").value.trim();
  const description = document.getElementById("session-description").value.trim();
  const emotionScore = document.getElementById("emotion-score").value;
  const emotionType = document.getElementById("emotion-type").value;
  const sessionType = document.getElementById("session-type").value;
  const sessionDate = document.getElementById("session-date").value;
  const duration = document.getElementById("session-duration").value;

  if (!title || !description || !emotionScore || !emotionType || !sessionType || !sessionDate) {
    alert("Please fill all required fields.");
    return;
  }

  if (emotionScore < 1 || emotionScore > 10) {
    alert("Emotion score must be between 1 and 10.");
    return;
  }

  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    const response = await fetch('http://localhost:3001/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        description,
        emotion_score: parseInt(emotionScore),
        emotion_type: emotionType,
        session_type: sessionType,
        createdBy: currentUser.email,
        session_date: sessionDate,
        duration: parseInt(duration) || 60
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    alert("Session created successfully!");
    document.getElementById("session-modal").style.display = "none";
    clearSessionInputs();
    
    await loadDashboardData();
    await updateNotifCount();
  } catch (error) {
    console.error("Error creating session:", error);
    alert("Error: " + error.message);
  }
}

// === Create Mood Entry ===
async function createMoodEntry() {
  const moodScore = document.getElementById("mood-score").value;
  const moodType = document.getElementById("mood-type").value;
  const notes = document.getElementById("mood-notes").value.trim();

  if (!moodScore || !moodType) {
    alert("Please fill all required fields.");
    return;
  }

  if (moodScore < 1 || moodScore > 10) {
    alert("Mood score must be between 1 and 10.");
    return;
  }

  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    const response = await fetch('http://localhost:3001/api/mood-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: currentUser.id,
        mood_score: parseInt(moodScore),
        mood_type: moodType,
        notes: notes
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    alert("Mood logged successfully!");
    document.getElementById("mood-modal").style.display = "none";
    
    await renderMoodEntries();
    await updateStats();
  } catch (error) {
    console.error("Error creating mood entry:", error);
    alert("Error: " + error.message);
  }
}

// === Create Goal ===
async function createGoal() {
  const title = document.getElementById("goal-title").value.trim();
  const description = document.getElementById("goal-description").value.trim();
  const category = document.getElementById("goal-category").value;
  const targetDate = document.getElementById("goal-target-date").value;

  if (!title || !description || !category || !targetDate) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    const response = await fetch('http://localhost:3001/api/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: currentUser.id,
        title,
        description,
        category,
        target_date: targetDate
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    alert("Goal created successfully!");
    document.getElementById("goal-modal").style.display = "none";
    clearGoalInputs();
    
    await renderGoals();
  } catch (error) {
    console.error("Error creating goal:", error);
    alert("Error: " + error.message);
  }
}

// === Render Sessions ===
async function renderSessions() {
  const container = document.getElementById("sessions-container");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3001/api/user/sessions?userEmail=${currentUser.email}`);
    const sessions = await response.json();

    if (!sessions.length) {
      container.innerHTML = `<p class="empty-text">No sessions yet. Create your first session!</p>`;
      return;
    }

    container.innerHTML = sessions
      .map(session => `
        <div class="session-card">
          <div class="session-header">
            <h4 class="session-title">${session.title}</h4>
            <span class="session-id">#${session.id}</span>
          </div>
          <div class="session-meta">
            <span>Emotion: ${session.emotion_type} (${session.emotion_score}/10)</span>
            <span>Type: ${session.session_type}</span>
            <span>Duration: ${session.duration}min</span>
          </div>
          <p class="session-description">${session.description}</p>
          <div class="session-footer">
            <div>
              <strong>Scheduled:</strong> ${new Date(session.session_date).toLocaleString()}
              ${session.assignedToName ? `<br><strong>Therapist:</strong> ${session.assignedToName}` : ''}
            </div>
            <span class="session-status status-${session.status}">${session.status}</span>
          </div>
          ${session.session_notes ? `
            <div class="session-notes">
              <strong>Therapist Notes:</strong> ${session.session_notes}
            </div>
          ` : ''}
        </div>
      `).join("");
  } catch (error) {
    console.error('Error fetching sessions:', error);
    container.innerHTML = `<p class="empty-text">Error loading sessions</p>`;
  }
}

// === Render Mood Entries ===
async function renderMoodEntries() {
  const container = document.getElementById("mood-container");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3001/api/user/mood-entries?user_id=${currentUser.id}&limit=20`);
    const moodEntries = await response.json();

    if (!moodEntries.length) {
      container.innerHTML = `<p class="empty-text">No mood entries yet. Log your first mood!</p>`;
      return;
    }

    container.innerHTML = moodEntries
      .map(entry => {
        const emotionClass = entry.mood_score <= 3 ? 'emotion-low' : 
                           entry.mood_score <= 7 ? 'emotion-medium' : 'emotion-high';
        
        return `
          <div class="mood-card">
            <div class="mood-icon">
              <i class="fas fa-smile"></i>
            </div>
            <div class="mood-content">
              <div class="mood-score ${emotionClass}">${entry.mood_score}/10</div>
              <div class="mood-type">${entry.mood_type}</div>
              ${entry.notes ? `<div class="mood-notes">${entry.notes}</div>` : ''}
            </div>
            <div class="mood-date">
              ${new Date(entry.created_at).toLocaleDateString()}
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.error('Error fetching mood entries:', error);
    container.innerHTML = `<p class="empty-text">Error loading mood history</p>`;
  }
}

// === Render Goals ===
async function renderGoals() {
  const container = document.getElementById("goals-container");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3001/api/user/goals?user_id=${currentUser.id}`);
    const goals = await response.json();

    if (!goals.length) {
      container.innerHTML = `<p class="empty-text">No goals yet. Set your first health goal!</p>`;
      return;
    }

    container.innerHTML = goals
      .map(goal => `
        <div class="goal-card">
          <div class="goal-header">
            <h4 class="goal-title">${goal.title}</h4>
            <span class="goal-category">${goal.category.replace('_', ' ')}</span>
          </div>
          <p class="goal-description">${goal.description}</p>
          <div class="goal-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${goal.progress}%"></div>
            </div>
            <div class="progress-text">
              <span>Progress: ${goal.progress}%</span>
              <span>Target: ${new Date(goal.target_date).toLocaleDateString()}</span>
            </div>
          </div>
          <div class="goal-footer">
            <span class="goal-status">Status: ${goal.current_status}</span>
            <div class="goal-actions">
              <button class="progress-btn" onclick="updateGoalProgress('${goal.id}', ${goal.progress + 25})">+25%</button>
              <button class="progress-btn" onclick="updateGoalProgress('${goal.id}', ${goal.progress + 10})">+10%</button>
              <button class="progress-btn primary" onclick="completeGoal('${goal.id}')">Complete</button>
            </div>
          </div>
        </div>
      `).join("");
  } catch (error) {
    console.error('Error fetching goals:', error);
    container.innerHTML = `<p class="empty-text">Error loading goals</p>`;
  }
}

// === Update Goal Progress ===
async function updateGoalProgress(goalId, newProgress) {
  if (newProgress > 100) newProgress = 100;
  
  try {
    const response = await fetch(`http://localhost:3001/api/goals/${goalId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        progress: newProgress,
        current_status: newProgress === 100 ? 'completed' : 'in-progress'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    await renderGoals();
  } catch (error) {
    console.error('Error updating goal progress:', error);
    alert("Error: " + error.message);
  }
}

// === Complete Goal ===
async function completeGoal(goalId) {
  try {
    const response = await fetch(`http://localhost:3001/api/goals/${goalId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        progress: 100,
        current_status: 'completed'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    await renderGoals();
  } catch (error) {
    console.error('Error completing goal:', error);
    alert("Error: " + error.message);
  }
}

// === Update Stats ===
async function updateStats() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3001/api/user/stats?userEmail=${currentUser.email}`);
    const stats = await response.json();

    document.getElementById("total-sessions").innerText = stats.totalSessions || 0;
    document.getElementById("scheduled-sessions").innerText = stats.scheduled || 0;
    document.getElementById("inprogress-sessions").innerText = stats.inProgress || 0;
    document.getElementById("completed-sessions").innerText = stats.completed || 0;
    document.getElementById("avg-emotion-score").innerText = stats.avgEmotionScore ? stats.avgEmotionScore.toFixed(1) : '0';
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

// === Helper Functions ===
function clearSessionInputs() {
  document.getElementById("session-title").value = "";
  document.getElementById("session-description").value = "";
  document.getElementById("emotion-score").value = "";
  document.getElementById("emotion-type").value = "";
  document.getElementById("session-type").value = "";
  document.getElementById("session-duration").value = "60";
}

function clearGoalInputs() {
  document.getElementById("goal-title").value = "";
  document.getElementById("goal-description").value = "";
  document.getElementById("goal-category").value = "";
}

// === Password Reset Modal (Same as TMS) ===
async function showPasswordResetModal() {
  const modal = document.getElementById("password-reset-modal");
  modal.style.display = "flex";

  document.getElementById("save-new-password").onclick = async function () {
    const newPass = document.getElementById("new-password").value.trim();
    const confirm = document.getElementById("confirm-password").value.trim();

    if (!newPass || !confirm) {
      alert("Please fill both fields.");
      return;
    }
    if (newPass !== confirm) {
      alert("Passwords do not match!");
      return;
    }
    if (newPass === "HealthCoach@123") {
      alert("Please choose a different password.");
      return;
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      const response = await fetch(`http://localhost:3001/api/user/${currentUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPass,
          isPasswordReset: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Update local storage
      const updatedUser = { ...currentUser, password: newPass, needsPasswordReset: false };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));

      alert("Password updated successfully!");
      modal.style.display = "none";
    } catch (error) {
      alert(error.message);
    }
  };
}

// === Notifications System (Same as TMS) ===
async function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
  if (panel.style.display === "block") await renderNotifications();
}

async function renderNotifications() {
  const notifList = document.getElementById("notif-list");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3001/api/notifications?email=${currentUser.email}&role=${currentUser.role}`);
    let notifications = await response.json();

    const sortValue = document.getElementById("notif-sort").value;
    
    if (sortValue === "latest") {
      notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortValue === "earliest") {
      notifications.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    notifList.innerHTML = notifications.length
      ? notifications
          .map(
            notification => `
            <div class="notif-item">
              <div>
                <small>${notification.timestamp}</small>
                <p>${notification.message}</p>
              </div>
              <button class="mark-read-btn" onclick="markAsRead('${notification.id}')" title="Mark as Read">&times;</button>
            </div>`
          )
          .join("")
      : "<p style='text-align:center;'>No new notifications.</p>";

    document.getElementById("notif-count").innerText = notifications.length;
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
}

async function markAsRead(notificationId) {
  try {
    await fetch(`http://localhost:3001/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
    await renderNotifications();
    await updateNotifCount();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const clearBtn = document.getElementById("clear-all-notifs");
  const sortSelect = document.getElementById("notif-sort");

  if (clearBtn) {
    clearBtn.onclick = async () => {
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      
      try {
        const response = await fetch('http://localhost:3001/api/notifications/read-all', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: currentUser.email,
            role: currentUser.role
          })
        });

        await renderNotifications();
        await updateNotifCount();
      } catch (error) {
        console.error('Error clearing notifications:', error);
      }
    };
  }

  if (sortSelect) sortSelect.addEventListener("change", renderNotifications);
});

async function updateNotifCount() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  try {
    const response = await fetch(`http://localhost:3001/api/notifications?email=${currentUser.email}&role=${currentUser.role}`);
    const notifications = await response.json();
    document.getElementById("notif-count").innerText = notifications.length;
  } catch (error) {
    console.error('Error updating notification count:', error);
  }
}