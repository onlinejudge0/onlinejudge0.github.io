import { apiFetch, readResponse } from "./api.js?v=20261029a";

const form = document.getElementById("forgot-password-form");
const statusMessage = document.getElementById("status-message");
const sendCodeButton = document.getElementById("send-code-button");
const emailInput = document.getElementById("email");
const codeInput = document.getElementById("verification-code");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");

const setStatus = (message, isError = false) => {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
};

async function sendVerificationCode() {
    const accountEmail = emailInput.value.trim();
    if (!accountEmail) {
        setStatus("Vui lòng nhập email.", true);
        return;
    }

    sendCodeButton.disabled = true;
    setStatus("Đang gửi mã xác thực...");

    try {
        const response = await apiFetch("/auth/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ account_email: accountEmail })
        });

        const data = await readResponse(response);
        if (response.ok) {
            setStatus("Yêu cầu đã được đưa vào hàng đợi. Mã xác thực sẽ sớm được gửi.");
            codeInput.focus();
            return;
        }

        setStatus(data.detail || `Không thể gửi mã (${response.status})`, true);
    } catch (error) {
        console.error(error);
        setStatus("Không thể kết nối đến server.", true);
    } finally {
        sendCodeButton.disabled = false;
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const accountEmail = emailInput.value.trim();
    const verificationCode = codeInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!accountEmail || !verificationCode || !newPassword || !confirmPassword) {
        setStatus("Vui lòng điền đầy đủ thông tin.", true);
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus("Mật khẩu nhập lại không khớp.", true);
        return;
    }

    const passwordRequirements = /^(?=.*[A-Z])(?=.*[a-zA-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRequirements.test(newPassword)) {
        setStatus("Mật khẩu phải có ít nhất 8 ký tự, có chữ và số, 1 ký tự đặc biệt và 1 chữ cái in hoa.", true);
        return;
    }

    setStatus("Đang đặt lại mật khẩu...");

    try {
        const response = await apiFetch("/auth/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                account_email: accountEmail,
                verification_code: verificationCode,
                new_password: newPassword
            })
        });

        const data = await readResponse(response);
        if (response.ok) {
            setStatus("Mật khẩu đã được đặt lại thành công. Đang chuyển đến đăng nhập...");
            window.setTimeout(() => {
                window.location.replace("login.html");
            }, 1200);
            return;
        }

        setStatus(data.detail || `Không thể đặt lại mật khẩu (${response.status})`, true);
    } catch (error) {
        console.error(error);
        setStatus("Không thể kết nối đến server.", true);
    }
});

sendCodeButton.addEventListener("click", sendVerificationCode);
document.getElementById("login-button").addEventListener("click", () => {
    window.location.href = "login.html";
});
document.getElementById("register-button").addEventListener("click", () => {
    window.location.href = "register.html";
});
