import { apiFetch, readResponse } from "./api.js?v=20261029a";
import { renderSubmissionHistory } from "./submission_history.js?v=20261102a";

const logoutButton = document.getElementById("logout-button");
const logoutError = document.getElementById("logout-error");
const accountName = document.getElementById("account-name");
const accountNameInput = document.getElementById("account-name-input");
const editNameButton = document.getElementById("edit-name-button");
const saveNameButton = document.getElementById("save-name-button");
const cancelNameButton = document.getElementById("cancel-name-button");
const profileMessage = document.getElementById("profile-message");
const serverHistoryList = document.getElementById("server-submission-history");
const serverHistoryMessage = document.getElementById("server-submission-message");
const serverHistoryMore = document.getElementById("server-submission-more");
const historyPageSize = 50;
let historyOffset = 0;
let currentAccount;

async function loadServerHistory({ append = false } = {}) {
    serverHistoryMore.disabled = true;
    serverHistoryMessage.textContent = "";
    try {
        const offset = append ? historyOffset : 0;
        const response = await apiFetch(
            `/student/submissions?limit=${historyPageSize}&offset=${offset}`,
        );
        const data = await readResponse(response);
        if (!response.ok) {
            throw new Error(data.detail || `Không thể tải lịch sử nộp bài (${response.status})`);
        }
        renderSubmissionHistory(serverHistoryList, data, { append });
        historyOffset = offset + data.length;
        serverHistoryMore.hidden = data.length < historyPageSize;
    } catch (error) {
        console.error(error);
        serverHistoryMessage.textContent =
            error instanceof Error ? error.message : "Không thể tải lịch sử nộp bài.";
    } finally {
        serverHistoryMore.disabled = false;
    }
}

function setNameEditMode(enabled) {
    accountName.hidden = enabled;
    accountNameInput.hidden = !enabled;
    editNameButton.hidden = enabled;
    saveNameButton.hidden = !enabled;
    cancelNameButton.hidden = !enabled;
    profileMessage.textContent = "";
}

async function loadAccount() {
    try {
        const response = await apiFetch("/auth/me");
        if (!response.ok) {
            if (response.status === 403) {
                window.location.replace("activate.html");
            } else {
                window.location.replace("login.html");
            }
            return;
        }

        currentAccount = await response.json();
        accountName.textContent = currentAccount.account_name;
        accountNameInput.value = currentAccount.account_name;
        document.getElementById("account-id").textContent =
            currentAccount.account_id;
        document.getElementById("account-email").textContent =
            currentAccount.account_email;
        document.getElementById("account-code").textContent =
            currentAccount.account_code;
        document.getElementById("account-role").textContent =
            ({
                USER: "Người dùng",
                ADMIN: "Quản trị viên",
                SUPER_ADMIN: "Quản trị cấp cao",
            }[currentAccount.role] ?? currentAccount.role);

        const createdAt = new Date(currentAccount.created_at);
        const createdAtElement = document.getElementById("account-created-at");
        createdAtElement.dateTime = currentAccount.created_at;
        createdAtElement.textContent = Number.isNaN(createdAt.getTime())
            ? currentAccount.created_at
            : createdAt.toLocaleString();

        document.getElementById("manage-accounts-link").hidden =
            currentAccount.role !== "SUPER_ADMIN";
        document.getElementById("judge-admin-link").hidden =
            currentAccount.role !== "ADMIN" && currentAccount.role !== "SUPER_ADMIN";
        document.getElementById("admin-problem-tools").hidden =
            currentAccount.role !== "ADMIN" && currentAccount.role !== "SUPER_ADMIN";
        await loadServerHistory();
    } catch (error) {
        console.error(error);
        window.location.replace("login.html");
    }
}

serverHistoryMore.addEventListener("click", () => loadServerHistory({ append: true }));

editNameButton.addEventListener("click", () => {
    accountNameInput.value = currentAccount.account_name;
    setNameEditMode(true);
    accountNameInput.focus();
});

cancelNameButton.addEventListener("click", () => {
    accountNameInput.value = currentAccount.account_name;
    setNameEditMode(false);
});

saveNameButton.addEventListener("click", async () => {
    const name = accountNameInput.value.trim();
    if (name.length < 3) {
        profileMessage.textContent = "Tên phải có ít nhất 3 ký tự";
        return;
    }

    saveNameButton.disabled = true;
    profileMessage.textContent = "";

    try {
        const response = await apiFetch("/auth/me", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ account_name: name })
        });
        const data = await readResponse(response);

        if (response.status === 401) {
            window.location.replace("login.html");
            return;
        }
        if (!response.ok) {
            profileMessage.textContent =
                data.detail || `Không thể cập nhật tên (${response.status})`;
            return;
        }

        currentAccount = data;
        accountName.textContent = currentAccount.account_name;
        accountNameInput.value = currentAccount.account_name;
        setNameEditMode(false);
        profileMessage.textContent = "Đã cập nhật tên tài khoản";
    } catch (error) {
        console.error(error);
        profileMessage.textContent =
            error instanceof Error ? error.message : "Không thể kết nối đến server";
    } finally {
        saveNameButton.disabled = false;
    }
});

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutError.textContent = "";
        logoutButton.disabled = true;

        try {
            const response = await apiFetch("/auth/logout", { method: "POST" });
            if (!response.ok) {
                logoutError.textContent = `Không thể đăng xuất (${response.status})`;
                logoutButton.disabled = false;
                return;
            }

            window.location.replace("login.html");
        } catch (error) {
            console.error(error);
            logoutError.textContent =
                error instanceof Error ? error.message : "Không thể kết nối đến server";
            logoutButton.disabled = false;
        }
    });
}

loadAccount();
