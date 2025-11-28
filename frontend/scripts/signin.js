// scripts/signin.js - Emotion Aware AI Health Coach
async function handleSignIn(event) {
  if (event) event.preventDefault();

  const username = document.getElementById("signin-username").value.trim();
  const password = document.getElementById("signin-password").value.trim();

  if (!username || !password) {
    alert("Username and password are required!");
    return;
  }

  try {
    // IMPORTANT: Changed port from 3000 to 3001 for EAMHC backend
    const response = await fetch('/api/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store current user in localStorage for session management
    localStorage.setItem("currentUser", JSON.stringify(data.user));

    alert(data.message);

    // Redirect based on role - UPDATED for EAMHC roles
    if (data.user.role === "admin") {
  window.location.href = "/admin-dashboard";
} else if (data.user.role === "user") {
  window.location.href = "/user-dashboard";
} else if (data.user.role === "therapist") {
  window.location.href = "/therapist-dashboard";
} else {
      alert("No dashboard available for this role.");
    }
  } catch (error) {
    alert(error.message);
    console.error('Signin error:', error);
  }
}

// Add event listener for form submission
document.addEventListener('DOMContentLoaded', function() {
  const form = document.querySelector('.auth-container div');
  const signinButton = document.querySelector('.btn-primary');
  
  if (form) {
    form.addEventListener('submit', handleSignIn);
  }
  
  // Also keep the onclick handler for backward compatibility
  if (signinButton) {
    signinButton.onclick = handleSignIn;
  }
});

// Utility function to check if user is logged in (for other pages)
async function checkAuth() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  
  if (!currentUser) {
    window.location.href = "signin.html";
    return null;
  }

  // Verify user still exists in database - UPDATED port to 3001
  try {
    const response = await fetch(`http://localhost:3001/api/user/${currentUser.id}`);
    if (!response.ok) {
      localStorage.removeItem("currentUser");
      window.location.href = "signin.html";
      return null;
    }
    return currentUser;
  } catch (error) {
    console.error('Auth check failed:', error);
    return currentUser; // Fallback to localStorage user
  }
}

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkAuth };
}