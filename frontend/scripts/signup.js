let isSubmitting = false;

function resetButton() {
    isSubmitting = false;
    const submitButton = document.querySelector('.btn-primary');
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Create Account';
    }
}

function redirectToEmotionDetection() {
    console.log("🔄 Redirecting to emotion-detection.html");
    window.location.href = '/emotion-detection.html';
}

async function handleSignUp(event) {
    console.log("🔄 handleSignUp function started");
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        console.log("✅ Event prevented");
    }
    if (isSubmitting) {
        console.log("🚫 Already submitting, blocking...");
        return false;
    }

    isSubmitting = true;
    console.log("✅ isSubmitting set to true");

    const submitButton = document.querySelector('.btn-primary');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';
        console.log("✅ Button disabled and text changed");
    }

    const email = document.getElementById("signup-email").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const confirm = document.getElementById("signup-confirm-password").value.trim();

    console.log("📝 Form values:", { email, username, passwordLength: password.length });

    if (!email || !username || !password || !confirm) {
        alert("❌ All fields are required");
        resetButton();
        return false;
    }

    if (password !== confirm) {
        alert("❌ Passwords do not match");
        resetButton();
        return false;
    }

    try {
        console.log("🌐 Making API call to /api/signup...");
        
        const requestBody = {
            email,
            username,
            password,
            role: "user" 
        };
        
        console.log("📤 Request body:", requestBody);

        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log("📥 Response status:", response.status);
        console.log("📥 Response OK:", response.ok);
        
        const data = await response.json();
        console.log("📥 Response data:", data);

        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }

        console.log("✅ Signup successful!");
        console.log("💾 Storing user in localStorage:", data.user);
        
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        console.log("🔄 Redirecting to emotion detection page");
        redirectToEmotionDetection();
        
    } catch (error) {
        console.error('❌ Signup error:', error);
        alert("Error: " + error.message);
        resetButton();
    }
    
    return false;
}
document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ DOM loaded, setting up event listeners");
    
    const form = document.getElementById('signup-form');
    const button = document.querySelector('.btn-primary');
    
    console.log("📝 Form found:", form);
    console.log("🔄 Button found:", button);
    
    if (form) {
        form.addEventListener('submit', handleSignUp);
        console.log("✅ Form submit listener added");
    }
    
    if (button) {
        button.addEventListener('click', handleSignUp);
        console.log("✅ Button click listener added");
    }
});