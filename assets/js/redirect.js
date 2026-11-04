import { apiFetch } from "./api.js?v=20261029a";

const statusText = document.getElementById("redirect-status");
const goLoginButton = document.getElementById("go-login");
const goRegisterButton = document.getElementById("go-register");

function goToLogin() {
    window.location.href = "modules/login.html";
}

function goToRegister() {
    window.location.href = "modules/register.html";
}

if (goLoginButton) {
    goLoginButton.addEventListener("click", goToLogin);
}

if (goRegisterButton) {
    goRegisterButton.addEventListener("click", goToRegister);
}

async function redirectBySession() {
    statusText.textContent = "Đang kiểm tra trạng thái đăng nhập...";

    try {
        const response = await apiFetch("/auth/me");
        if (response.ok) {
            statusText.textContent = "Đã xác thực. Đang chuyển đến bảng điều khiển...";
            window.location.replace("modules/index.html");
            return;
        }

        if (response.status === 403) {
            statusText.textContent = "Tài khoản chưa được kích hoạt. Chuyển đến trang kích hoạt...";
            window.location.replace("modules/activate.html");
            return;
        }

        statusText.textContent = "Bạn chưa đăng nhập. Chuyển đến trang đăng nhập...";
        window.location.replace("modules/login.html");
    } catch (error) {
        console.error("Could not check the current session:", error);
        statusText.textContent = "Không thể kết nối tới server. Vui lòng thử lại hoặc đăng nhập thủ công.";
        goLoginButton.hidden = false;
        goRegisterButton.hidden = false;
    }
}

redirectBySession();
