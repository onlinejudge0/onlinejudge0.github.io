import { apiFetch, readResponse, requireAccountAccess } from "./api.js?v=20261029a";
import { typesetMath } from "./latex.js?v=20261101b";

const query = new URLSearchParams(window.location.search);
const problemId = query.get("problem_id");
const source = query.get("source");
const classId = query.get("class_id");
const statement = document.getElementById("problem-statement");
const form = document.getElementById("solution-form");
const pageMessage = document.getElementById("page-message");
let languagesPromise;

function showMessage(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle("error", isError);
    element.classList.toggle("success", !isError && Boolean(text));
}

async function requestJson(path, options) {
    const response = await apiFetch(path, options);
    const data = await readResponse(response);
    if (!response.ok) {
        const error = new Error(data.detail || `Yêu cầu thất bại (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return data;
}

function renderStatement(problem) {
    document.getElementById("statement-title").textContent = problem.problem_name;
    for (const [field, sectionId, contentId] of [
        ["description", "statement-description-section", "statement-description"],
        ["input_description", "statement-input-section", "statement-input"],
        ["output_description", "statement-output-section", "statement-output"],
        ["data_constraints", "statement-constraints-section", "statement-constraints"],
    ]) {
        const content = String(problem[field] ?? "");
        document.getElementById(contentId).textContent = content;
        document.getElementById(sectionId).hidden = !content.trim();
    }

    const limits = [];
    if (problem.time_limit) limits.push(`Thời gian: ${problem.time_limit} giây`);
    if (problem.memory_limit) limits.push(`Bộ nhớ: ${problem.memory_limit} MB`);
    document.getElementById("statement-limits").textContent = limits.join(" · ");
    document.getElementById("statement-limits-section").hidden = !limits.length;
    statement.hidden = false;
}

async function loadLanguages() {
    languagesPromise ??= requestJson("/student/languages");
    const languages = await languagesPromise;
    const selector = document.getElementById("solution-language");
    selector.replaceChildren();
    for (const language of languages) {
        const option = document.createElement("option");
        option.value = String(language.language_id);
        option.textContent = language.name;
        selector.append(option);
    }
    if (!languages.length) {
        throw new Error("Chưa có ngôn ngữ chấm bài. Hãy đồng bộ danh sách Judge0 languages trước.");
    }
}

async function loadClassProblem(account) {
    if (!classId || !/^[1-9]\d*$/.test(classId)) {
        throw new Error("Đường dẫn lớp học không hợp lệ.");
    }

    let classData;
    let canSubmit = account.role === "USER";
    if (account.role === "USER") {
        classData = await requestJson(`/student/classes/${encodeURIComponent(classId)}`);
    } else {
        try {
            classData = await requestJson(`/admin/judge/academic-classes/${encodeURIComponent(classId)}`);
            canSubmit = (Array.isArray(classData.students) ? classData.students : []).some(
                (member) => member.account_id === account.account_id,
            );
        } catch (error) {
            if (error.status !== 403 && error.status !== 404) {
                throw error;
            }
            classData = await requestJson(`/student/classes/${encodeURIComponent(classId)}`);
            canSubmit = true;
        }
    }

    const problem = (Array.isArray(classData.problems) ? classData.problems : []).find(
        (item) => String(item.problem_id) === problemId,
    );
    if (!problem) {
        throw new Error("Không tìm thấy bài tập trong lớp này.");
    }
    return { problem, canSubmit };
}

async function initialize() {
    if (!problemId || !/^[1-9]\d*$/.test(problemId)) {
        showMessage(pageMessage, "Đường dẫn bài tập không hợp lệ.", true);
        return;
    }
    if (source !== "public" && source !== "owner" && source !== "class") {
        showMessage(pageMessage, "Thiếu thông tin phạm vi truy cập bài tập.", true);
        return;
    }

    try {
        const account = await requireAccountAccess({
            allowedRoles: ["USER", "ADMIN", "SUPER_ADMIN"],
            redirectTo: "login.html",
        });
        if (!account) {
            return;
        }
        if (source === "owner" && account.role !== "ADMIN" && account.role !== "SUPER_ADMIN") {
            throw new Error("Bạn không có quyền xem bài tập này.");
        }
        let problem;
        let canSubmit = true;
        if (source === "class") {
            ({ problem, canSubmit } = await loadClassProblem(account));
            const backLink = document.getElementById("back-to-class");
            const from = query.get("from");
            backLink.href = `classroom.html?class_id=${encodeURIComponent(classId)}` +
                (from ? `&from=${encodeURIComponent(from)}` : "");
            backLink.hidden = false;
        } else {
            const problemPath = source === "public"
                ? `/student/problems/${encodeURIComponent(problemId)}`
                : `/admin/judge/problems/${encodeURIComponent(problemId)}`;
            problem = await requestJson(problemPath);
        }
        renderStatement(problem);
        await typesetMath(statement);
        document.getElementById("solution-heading").textContent = problem.problem_name;

        const historyLink = document.getElementById("problem-history-link");
        historyLink.href = `submissions.html?problem_id=${encodeURIComponent(problemId)}`;
        historyLink.hidden = false;
        if (!canSubmit) {
            document.getElementById("solution-heading").textContent = "Chỉ xem đề bài";
            document.getElementById("solution-language").parentElement.hidden = true;
            form.elements.source_code.parentElement.hidden = true;
            form.querySelector('[type="submit"]').hidden = true;
            const accessNote = document.getElementById("submit-access-note");
            accessNote.textContent =
                "Bạn đang xem lớp với quyền quản lý. Chỉ thành viên lớp mới có thể nộp lời giải.";
            accessNote.hidden = false;
            return;
        }

        const isPrivateLike = source !== "class" &&
            (problem.access_modifier === "private" || problem.access_modifier === "hidden");
        const submitButton = form.querySelector('[type="submit"]');
        if (isPrivateLike) {
            document.getElementById("solution-language").hidden = true;
            document.getElementById("solution-language").parentElement.hidden = true;
            form.elements.source_code.disabled = true;
            form.elements.source_code.placeholder = "Bài private/hidden cần được nộp từ trang lớp hoặc contest.";
            submitButton.hidden = true;
            showMessage(
                document.getElementById("submission-result"),
                "Bài tập private hoặc hidden chỉ có thể nộp trong lớp/contest được giao.",
            );
            return;
        }

        await loadLanguages();
        document.getElementById("solution-language").disabled = false;
        form.elements.source_code.disabled = false;
        submitButton.disabled = false;
    } catch (error) {
        console.error(error);
        showMessage(
            pageMessage,
            error instanceof Error ? error.message : "Không thể tải bài tập.",
            true,
        );
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('[type="submit"]');
    const result = document.getElementById("submission-result");
    const values = new FormData(form);
    submitButton.disabled = true;
    showMessage(result, "Đang gửi lời giải tới hệ thống chấm bài...");
    try {
        const submission = await requestJson(
            source === "class"
                ? `/student/classes/${encodeURIComponent(classId)}/problems/${encodeURIComponent(problemId)}/submissions`
                : `/student/problems/${encodeURIComponent(problemId)}/submissions`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language_id: Number(values.get("language_id")),
                    source_code: values.get("source_code"),
                }),
            },
        );
        showMessage(
            result,
            `${submission.status} · ${submission.score} điểm · ` +
                `${submission.passed_testcases}/${submission.total_testcases} test case · ` +
                `tổng ${submission.runtime_ms == null ? "—" : `${submission.runtime_ms} ms`} · ` +
                `bộ nhớ đỉnh ${submission.memory_kb == null ? "—" : `${submission.memory_kb} KB`}`,
            submission.status !== "Accepted",
        );
    } catch (error) {
        showMessage(
            result,
            error instanceof Error ? error.message : "Không thể chấm lời giải.",
            true,
        );
    } finally {
        submitButton.disabled = false;
    }
});

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
            showMessage(pageMessage, error instanceof Error ? error.message : "Không thể đăng xuất.", true);
        }
    });
}

initialize();
