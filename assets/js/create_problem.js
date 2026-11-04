import { apiFetch, readResponse, requireAccountAccess } from "./api.js?v=20261029a";
import { typesetMath } from "./latex.js?v=20261101b";

const form = document.getElementById("problem-form");
const testcaseList = document.getElementById("testcase-list");
const accessPicker = form.elements.access_modifier;
const message = document.getElementById("problem-message");
const pageMessage = document.getElementById("page-message");
const preview = document.getElementById("problem-preview");
const previewRendererMessage = document.getElementById("math-renderer-message");
const query = new URLSearchParams(window.location.search);
const problemId = query.get("problem_id");
const isEditing = Boolean(problemId);
let previewTimer;
const autocomplete = document.getElementById("latex-autocomplete");
const descriptionFields = [
    form.elements.description,
    form.elements.input_description,
    form.elements.output_description,
    form.elements.data_constraints,
];
const latexCommands = [
    { command: "\\frac", description: "Phân số", insert: "\\frac{numerator}{denominator}", selection: "numerator" },
    { command: "\\sqrt", description: "Căn bậc hai", insert: "\\sqrt{value}", selection: "value" },
    { command: "\\sum", description: "Tổng", insert: "\\sum_{i=1}^{n}", selection: "i=1" },
    { command: "\\prod", description: "Tích", insert: "\\prod_{i=1}^{n}", selection: "i=1" },
    { command: "\\int", description: "Tích phân", insert: "\\int_{a}^{b}", selection: "a" },
    { command: "\\lim", description: "Giới hạn", insert: "\\lim_{x\\to a}", selection: "x\\to a" },
    { command: "\\alpha", description: "Alpha" },
    { command: "\\beta", description: "Beta" },
    { command: "\\theta", description: "Theta" },
    { command: "\\pi", description: "Pi" },
    { command: "\\infty", description: "Vô cực" },
    { command: "\\leq", description: "Nhỏ hơn hoặc bằng" },
    { command: "\\geq", description: "Lớn hơn hoặc bằng" },
    { command: "\\neq", description: "Khác" },
    { command: "\\in", description: "Thuộc" },
    { command: "\\times", description: "Nhân" },
    { command: "\\cdot", description: "Nhân (chấm)" },
];
let autocompleteState = null;
let selectedSuggestionIndex = 0;

function setMessage(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle("error", isError);
    element.classList.toggle("success", !isError && Boolean(text));
}

function updatePreviewContent() {
    const values = new FormData(form);
    document.getElementById("preview-title").textContent =
        String(values.get("problem_name") || "").trim() || "Tiêu đề bài tập";
    for (const [field, previewId, sectionId] of [
        ["description", "preview-description", "preview-description-section"],
        ["input_description", "preview-input", "preview-input-section"],
        ["output_description", "preview-output", "preview-output-section"],
        ["data_constraints", "preview-constraints", "preview-constraints-section"],
    ]) {
        const content = String(values.get(field) || "");
        document.getElementById(previewId).textContent = content;
        document.getElementById(sectionId).hidden = !content.trim();
    }
    const timeLimit = values.get("time_limit");
    const memoryLimit = values.get("memory_limit");
    const limits = [];
    if (timeLimit) {
        limits.push(`Thời gian: ${timeLimit} giây`);
    }
    if (memoryLimit) {
        limits.push(`Bộ nhớ: ${memoryLimit} MB`);
    }
    document.getElementById("preview-limits").textContent = limits.join(" · ");
    document.getElementById("preview-limits-section").hidden = !limits.length;
}

async function renderPreview() {
    updatePreviewContent();
    previewRendererMessage.textContent = "Đang hiển thị công thức…";
    try {
        await typesetMath(preview);
        previewRendererMessage.classList.remove("error");
        previewRendererMessage.textContent = "Dùng $ ... $ hoặc \\( ... \\) trong dòng; $$ ... $$ hoặc \\[ ... \\] cho công thức riêng dòng.";
    } catch (error) {
        console.error(error);
        previewRendererMessage.textContent =
            `${error.message || "Không thể hiển thị công thức."} Nội dung LaTeX vẫn được giữ nguyên.`;
        previewRendererMessage.classList.add("error");
    }
}

function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
        renderPreview();
    }, 120);
}

function hideLatexAutocomplete() {
    autocomplete.hidden = true;
    autocompleteState = null;
}

function positionLatexAutocomplete(field) {
    const bounds = field.getBoundingClientRect();
    autocomplete.style.width = `${Math.min(bounds.width, window.innerWidth - 16)}px`;
    const menuHeight = autocomplete.offsetHeight;
    const top = bounds.bottom + menuHeight + 8 <= window.innerHeight
        ? bounds.bottom + 6
        : Math.max(8, bounds.top - menuHeight - 6);
    autocomplete.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - autocomplete.offsetWidth - 8))}px`;
    autocomplete.style.top = `${top}px`;
}

function renderLatexAutocomplete(items, field, start, end) {
    autocomplete.replaceChildren();
    items.forEach((item, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "latex-autocomplete-option";
        option.role = "option";
        option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));
        option.setAttribute("aria-label", `${item.command} — ${item.description}`);
        option.innerHTML = `<code></code><span></span>`;
        option.querySelector("code").textContent = item.command;
        option.querySelector("span").textContent = item.description;
        option.addEventListener("mouseenter", () => {
            selectedSuggestionIndex = index;
            updateAutocompleteSelection();
        });
        option.addEventListener("click", () => insertLatexCommand(item));
        autocomplete.appendChild(option);
    });
    autocompleteState = { field, start, end, items };
    autocomplete.hidden = false;
    positionLatexAutocomplete(field);
}

function updateAutocompleteSelection() {
    [...autocomplete.children].forEach((option, index) => {
        option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));
    });
}

function updateLatexAutocomplete(field) {
    const cursor = field.selectionStart;
    const prefix = field.value.slice(0, cursor);
    const start = prefix.lastIndexOf("\\");
    if (start < 0) {
        hideLatexAutocomplete();
        return;
    }

    const query = prefix.slice(start + 1);
    if (!/^[a-zA-Z]*$/.test(query)) {
        hideLatexAutocomplete();
        return;
    }

    const matches = latexCommands
        .filter(({ command }) => command.slice(1).startsWith(query.toLowerCase()))
        .slice(0, 7);
    if (!matches.length) {
        hideLatexAutocomplete();
        return;
    }

    selectedSuggestionIndex = 0;
    renderLatexAutocomplete(matches, field, start, cursor);
}

function insertLatexCommand(command) {
    if (!autocompleteState) {
        return;
    }
    const { field, start, end } = autocompleteState;
    field.setRangeText(command.insert ?? command.command, start, end, "end");
    field.focus();
    const inserted = command.insert ?? command.command;
    if (command.selection) {
        const selectionStart = start + inserted.indexOf(command.selection);
        field.setSelectionRange(selectionStart, selectionStart + command.selection.length);
    } else {
        const cursor = start + inserted.length;
        field.setSelectionRange(cursor, cursor);
    }
    hideLatexAutocomplete();
    field.dispatchEvent(new Event("input", { bubbles: true }));
}

async function requestJson(path, options) {
    const response = await apiFetch(path, options);
    const data = await readResponse(response);
    if (!response.ok) {
        throw new Error(data.detail || `Yêu cầu thất bại (${response.status})`);
    }
    return data;
}

function renumberTestcases(redistributePoints = !isEditing) {
    const rows = [...testcaseList.querySelectorAll(".testcase-row")];
    const basePoints = Math.floor(100 / rows.length);
    const remainder = 100 % rows.length;
    rows.forEach((row, index) => {
        row.querySelector("strong").textContent = `Test case ${index + 1}`;
        if (redistributePoints) {
            row.querySelector('[name="point"]').value =
                String(basePoints + (index < remainder ? 1 : 0));
        }
    });
    document.getElementById("add-testcase").disabled = rows.length >= 100;
}

function addTestcase(testcase = {}) {
    if (testcaseList.children.length >= 100) {
        document.getElementById("add-testcase").disabled = true;
        return;
    }
    const row = document.createElement("div");
    row.className = "testcase-row";
    row.innerHTML = `<div class="testcase-row-heading"><strong></strong>
        <button class="secondary" type="button" data-remove-testcase>Gỡ</button></div>
        <label>Input<textarea name="input_data" rows="3"></textarea></label>
        <label>Output mong đợi<textarea name="expected_output" rows="3"></textarea></label>
        <label>Điểm<input name="point" type="number" min="1" max="100" required></label>`;
    row.querySelector('[name="input_data"]').value = testcase.input_data ?? "";
    row.querySelector('[name="expected_output"]').value = testcase.expected_output ?? "";
    row.querySelector('[name="point"]').value =
        testcase.point ?? (isEditing && testcaseList.children.length ? 1 : 100);
    testcaseList.appendChild(row);
    renumberTestcases();
}

async function loadProblemForEdit() {
    const problem = await requestJson(`/admin/judge/problems/${encodeURIComponent(problemId)}`);
    const values = {
        problem_name: problem.problem_name,
        description: problem.description ?? "",
        input_description: problem.input_description ?? "",
        output_description: problem.output_description ?? "",
        data_constraints: problem.data_constraints ?? "",
        time_limit: problem.time_limit,
        memory_limit: problem.memory_limit,
        access_modifier: problem.access_modifier,
    };
    for (const [name, value] of Object.entries(values)) {
        form.elements[name].value = value;
    }
    testcaseList.replaceChildren();
    problem.testcases.forEach((testcase) => addTestcase(testcase));
    if (!problem.testcases.length) {
        addTestcase();
    }
    document.getElementById("form-heading").textContent = "Sửa bài tập";
    document.getElementById("form-subtitle").textContent =
        "Chỉ chủ sở hữu mới có thể sửa nội dung và test case của bài này.";
    document.getElementById("save-problem").textContent = "Lưu thay đổi";
    updatePreviewContent();
}

async function initialize() {
    try {
        const account = await requireAccountAccess({
            allowedRoles: ["ADMIN", "SUPER_ADMIN"],
            redirectTo: "problems.html",
        });
        if (!account) {
            return;
        }
        if (problemId) {
            await loadProblemForEdit();
        } else {
            addTestcase();
        }
        await renderPreview();
    } catch (error) {
        console.error(error);
        setMessage(pageMessage, error.message || "Không thể tải trang tạo bài tập.", true);
        form.hidden = true;
    }
}

document.getElementById("add-testcase").addEventListener("click", () => addTestcase());

for (const field of descriptionFields) {
    field.addEventListener("input", () => updateLatexAutocomplete(field));
    field.addEventListener("click", () => updateLatexAutocomplete(field));
    field.addEventListener("keyup", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
            updateLatexAutocomplete(field);
        }
    });
    field.addEventListener("keydown", (event) => {
        if (!autocompleteState || autocompleteState.field !== field) {
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            selectedSuggestionIndex =
                (selectedSuggestionIndex + direction + autocompleteState.items.length)
                % autocompleteState.items.length;
            updateAutocompleteSelection();
            autocomplete.children[selectedSuggestionIndex].scrollIntoView({ block: "nearest" });
        } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            insertLatexCommand(autocompleteState.items[selectedSuggestionIndex]);
        } else if (event.key === "Escape") {
            event.preventDefault();
            hideLatexAutocomplete();
        }
    });
    field.addEventListener("blur", () => setTimeout(() => {
        if (!autocomplete.matches(":hover")) {
            hideLatexAutocomplete();
        }
    }, 100));
}

autocomplete.addEventListener("mousedown", (event) => {
    event.preventDefault();
});

window.addEventListener("resize", () => {
    if (autocompleteState) {
        positionLatexAutocomplete(autocompleteState.field);
    }
});
document.addEventListener("scroll", () => {
    if (autocompleteState) {
        positionLatexAutocomplete(autocompleteState.field);
    }
}, true);

testcaseList.addEventListener("click", (event) => {
    if (!event.target.closest("[data-remove-testcase]")) {
        return;
    }
    event.target.closest(".testcase-row").remove();
    if (!testcaseList.children.length) {
        addTestcase();
    } else {
        renumberTestcases();
    }
});

accessPicker.addEventListener("change", () => {
    if (accessPicker.value === "hidden") {
        setMessage(message, "Bài hidden chỉ hiển thị cho người tạo trước khi contest bắt đầu; khi contest diễn ra sẽ chỉ hiện trong lớp/contest được gắn.");
    } else if (accessPicker.value === "private") {
        setMessage(message, "Bài private sẽ chỉ hiển thị trong lớp sau khi bạn thêm bài vào lớp.");
    } else {
        setMessage(message, "");
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("save-problem");
    const values = new FormData(form);
    const payload = {
        problem_name: values.get("problem_name"),
        description: values.get("description"),
        input_description: values.get("input_description"),
        output_description: values.get("output_description"),
        data_constraints: values.get("data_constraints"),
        time_limit: Number(values.get("time_limit")),
        memory_limit: Number(values.get("memory_limit")),
        access_modifier: values.get("access_modifier"),
        testcases: [...testcaseList.querySelectorAll(".testcase-row")].map((row) => ({
            input_data: row.querySelector('[name="input_data"]').value,
            expected_output: row.querySelector('[name="expected_output"]').value,
            point: Number(row.querySelector('[name="point"]').value),
        })),
    };
    button.disabled = true;
    setMessage(message, "");
    try {
        const path = problemId
            ? `/admin/judge/problems/${encodeURIComponent(problemId)}`
            : "/admin/judge/problems";
        const problem = await requestJson(path, {
            method: problemId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        setMessage(
            message,
            problemId
                ? `Đã cập nhật bài #${problem.problem_id}.`
                : `Đã tạo bài #${problem.problem_id} trong kho của bạn.`,
        );
        if (!problemId) {
            form.reset();
            testcaseList.replaceChildren();
            addTestcase();
            accessPicker.value = "private";
        }
    } catch (error) {
        console.error(error);
        setMessage(message, error.message || "Không thể lưu bài tập.", true);
    } finally {
        button.disabled = false;
    }
});

form.addEventListener("input", schedulePreview);
form.addEventListener("change", schedulePreview);

const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            const response = await apiFetch("/auth/logout", { method: "POST" });
            if (response.ok) {
                window.location.replace("login.html");
                return;
            }
            throw new Error(`Không thể đăng xuất (${response.status}).`);
        } catch (error) {
            setMessage(pageMessage, error.message || "Không thể kết nối đến server.", true);
        }
    });
}

initialize();
