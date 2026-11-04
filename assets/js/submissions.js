import { apiFetch, readResponse } from "./api.js?v=20261029a";
import { renderSubmissionHistory } from "./submission_history.js?v=20261102a";

const pageSize = 50;
const query = new URLSearchParams(window.location.search);
const filterForm = document.getElementById("history-filter-form");
const historyList = document.getElementById("submission-history-list");
const moreButton = document.getElementById("submission-history-more");
const historyMessage = document.getElementById("submission-history-message");
const filters = {
    problem_name: query.get("problem_name")?.trim() || "",
    account_name: query.get("account_name")?.trim() || "",
};
const legacyFilters = {
    problem_id: query.get("problem_id")?.trim() || "",
    account_id: query.get("account_id")?.trim() || "",
};
let offset = 0;

function setMessage(text) {
    historyMessage.textContent = text;
    historyMessage.classList.toggle("error", Boolean(text));
}

function buildHistoryUrl(currentOffset) {
    const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(currentOffset),
    });
    for (const [name, value] of Object.entries({ ...legacyFilters, ...filters })) {
        if (value) params.set(name, value);
    }
    return `/student/submissions?${params}`;
}

async function loadHistory({ append = false } = {}) {
    const currentOffset = append ? offset : 0;
    moreButton.disabled = true;
    setMessage("");
    try {
        const response = await apiFetch(buildHistoryUrl(currentOffset));
        const data = await readResponse(response);
        if (!response.ok) {
            throw new Error(data.detail || `Không thể tải lịch sử (${response.status})`);
        }
        renderSubmissionHistory(historyList, data, { append });
        offset = currentOffset + data.length;
        moreButton.hidden = data.length < pageSize;
    } catch (error) {
        console.error(error);
        setMessage(error instanceof Error ? error.message : "Không thể tải lịch sử bài nộp.");
    } finally {
        moreButton.disabled = false;
    }
}

function initializeFilters() {
    for (const [name, value] of Object.entries(filters)) {
        const input = filterForm.elements.namedItem(name);
        input.value = value;
    }
    const hasNameFilters = Object.values(filters).some(Boolean);
    const hasLegacyFilters = Object.values(legacyFilters).some(Boolean);
    const hasFilters = hasNameFilters || hasLegacyFilters;
    document.getElementById("submission-history-heading").textContent =
        hasFilters ? "Kết quả tìm kiếm" : "Bài nộp gần đây";
    const descriptions = [];
    if (legacyFilters.problem_id) descriptions.push(`bài #${legacyFilters.problem_id}`);
    if (legacyFilters.account_id) descriptions.push(`tài khoản #${legacyFilters.account_id}`);
    document.getElementById("submission-history-hint").textContent = hasNameFilters
        ? "Kết quả khớp với tên bạn đã tìm."
        : hasLegacyFilters
            ? `Đang xem lịch sử từ liên kết cho ${descriptions.join(" · ")}.`
            : "Mới nhất trên toàn server.";
}

filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(legacyFilters)) {
        if (value) params.set(name, value);
    }
    for (const name of Object.keys(filters)) {
        const value = filterForm.elements.namedItem(name).value.trim();
        if (value) params.set(name, value);
    }
    window.location.href = `submissions.html${params.size ? `?${params}` : ""}`;
});

moreButton.addEventListener("click", () => loadHistory({ append: true }));

const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            const response = await apiFetch("/auth/logout", { method: "POST" });
            if (!response.ok) {
                throw new Error(`Không thể đăng xuất (${response.status}).`);
            }
            window.location.replace("login.html");
        } catch (error) {
            console.error(error);
            setMessage(error instanceof Error ? error.message : "Không thể đăng xuất.");
        }
    });
}

async function initialize() {
    try {
        const accountResponse = await apiFetch("/auth/me");
        if (!accountResponse.ok) {
            window.location.replace("login.html");
            return;
        }
        initializeFilters();
        await loadHistory();
    } catch (error) {
        console.error(error);
        setMessage(error instanceof Error ? error.message : "Không thể tải lịch sử.");
    }
}

initialize();
