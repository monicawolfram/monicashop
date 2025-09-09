// Toggle password visibility
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  toggleBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    toggleBtn.textContent = type === "password" ? "👁️" : "🙈";
  });

  // Simple front-end validation
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    if (!passwordInput.value || passwordInput.value.length < 4) {
      e.preventDefault();
      alert("Password must be at least 4 characters long.");
    }
  });
});
