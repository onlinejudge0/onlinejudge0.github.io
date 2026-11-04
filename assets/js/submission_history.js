import { apiFetch, readResponse } from "./api.js?v=20261029a";

function appendText(parent, tagName, text, className = "") {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) {
        element.className = className;
    }
    parent.append(element);
    return element;
}

function getSourceDialog() {
    let dialog = document.getElementById("submission-source-dialog");
    if (dialog) {
        return dialog;
    }

    dialog = document.createElement("dialog");
    dialog.id = "submission-source-dialog";
    dialog.className = "solution-dialog";
    dialog.setAttribute("aria-labelledby", "submission-source-heading");
    const content = document.createElement("div");
    content.className = "stacked-form";
    const heading = document.createElement("div");
    heading.className = "workspace-heading";
    const title = document.createElement("h2");
    title.id = "submission-source-heading";
    title.textContent = "Mã nguồn bài nộp";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "secondary";
    close.textContent = "Đóng";
    close.addEventListener("click", () => dialog.close());
    heading.append(title, close);
    const message = document.createElement("p");
    message.className = "message";
    message.setAttribute("role", "status");
    const pre = document.createElement("pre");
    pre.className = "submission-source";
    const code = document.createElement("code");
    pre.append(code);
    content.append(heading, message, pre);
    dialog.append(content);
    document.body.append(dialog);
    return dialog;
}

async function showSubmissionSource(submissionId, problemName, sourcePath) {
    const dialog = getSourceDialog();
    const heading = dialog.querySelector("#submission-source-heading");
    const message = dialog.querySelector('[role="status"]');
    const code = dialog.querySelector("code");
    heading.textContent = `Mã nguồn · ${problemName}`;
    message.textContent = "Đang tải mã nguồn...";
    message.classList.remove("error");
    code.textContent = "";
    dialog.showModal();

    try {
        const response = await apiFetch(sourcePath);
        const data = await readResponse(response);
        if (!response.ok) {
            throw new Error(data.detail || `Không thể tải mã nguồn (${response.status})`);
        }
        code.textContent = data.source_code;
        message.textContent = "";
    } catch (error) {
        console.error(error);
        message.textContent = error instanceof Error ? error.message : "Không thể tải mã nguồn.";
        message.classList.add("error");
    }
}

export function renderSubmissionHistory(
    list,
    submissions,
    {
        append = false,
        emptyText = "Chưa có bài nộp nào.",
        sourceUrlForSubmission = null,
    } = {},
) {
    if (!append) {
        list.replaceChildren();
    }
    for (const submission of submissions) {
        const row = document.createElement("article");
        row.className = "entity-row submission-history-row";
        const details = document.createElement("span");
        const title = submission.account_name
            ? `${submission.problem_name} · ${submission.account_name}`
            : submission.problem_name;
        appendText(details, "strong", title);
        const metadata = [
            submission.access_modifier === "private"
                ? "Private"
                : submission.access_modifier === "public"
                    ? "Public"
                    : submission.access_modifier === "hidden"
                        ? "Hidden"
                        : "",
            submission.contest_name || "",
            `${submission.passed_testcases ?? "—"}/${submission.total_testcases ?? "—"} test`,
            `tổng ${submission.runtime_ms == null ? "—" : `${submission.runtime_ms} ms`}`,
            `bộ nhớ đỉnh ${submission.memory_kb == null ? "—" : `${submission.memory_kb} KB`}`,
            new Date(submission.submitted_at).toLocaleString(),
        ].filter(Boolean);
        appendText(details, "small", metadata.join(" · "));
        const summary = document.createElement("span");
        summary.className = "submission-summary";
        appendText(
            summary,
            "span",
            submission.status,
            `status-pill${submission.status === "Accepted" ? "" : " failed"}`,
        );
        appendText(summary, "strong", `${submission.score ?? 0} điểm`);
        if (submission.is_mine || sourceUrlForSubmission) {
            const sourceButton = document.createElement("button");
            sourceButton.type = "button";
            sourceButton.className = "secondary";
            sourceButton.textContent = submission.is_mine && !sourceUrlForSubmission
                ? "Xem mã của tôi"
                : "Xem mã nguồn";
            sourceButton.addEventListener("click", () => {
                const sourcePath = sourceUrlForSubmission
                    ? sourceUrlForSubmission(submission)
                    : `/student/submissions/${submission.submission_id}/source`;
                showSubmissionSource(
                    submission.submission_id,
                    submission.problem_name,
                    sourcePath,
                );
            });
            summary.append(sourceButton);
        }
        row.append(details, summary);
        list.append(row);
    }
    if (!list.childElementCount) {
        appendText(list, "p", emptyText, "field-hint");
    }
}
