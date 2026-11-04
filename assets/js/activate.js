import { apiFetch, readResponse } from "./api.js?v=20261029a";

const form = document.getElementById("activate-form");
const statusMessage = document.getElementById("status-message");
const sendCodeButton = document.getElementById("send-code-button");
const emailInput = document.getElementById("email");
const codeInput = document.getElementById("verification-code");
const activationEmail = new URLSearchParams(window.location.search).get("email");
if (activationEmail) {
    emailInput.value = activationEmail;
}

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
        const response = await apiFetch("/auth/send-code", {
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

        if (response.status === 409) {
            setStatus("Email này đã được kích hoạt. Bạn có thể đăng nhập ngay.", true);
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

    if (!accountEmail || !verificationCode) {
        setStatus("Vui lòng nhập email và mã xác thực.", true);
        return;
    }

    setStatus("Đang xác thực tài khoản...");

    try {
        const response = await apiFetch("/auth/verify-code", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                account_email: accountEmail,
                verification_code: verificationCode
            })
        });

        const data = await readResponse(response);
        if (response.ok) {
            setStatus("Kích hoạt tài khoản thành công. Đang chuyển đến đăng nhập...");
            window.setTimeout(() => {
                window.location.replace(
                    `login.html?activated=1&email=${encodeURIComponent(accountEmail)}`,
                );
            }, 1200);
            return;
        }

        setStatus(data.detail || `Xác thực thất bại (${response.status})`, true);
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
