import { apiFetch, readResponse, requireAccountAccess } from "./api.js?v=20261029a";

const statusMessage = document.getElementById("status-message");
const accountsTable = document.getElementById("accounts-table");
const accountsList = document.getElementById("accounts-list");
const roles = ["USER", "ADMIN", "SUPER_ADMIN"];

async function loadAccounts() {
    try {
        const currentAccount = await requireAccountAccess({
            allowedRoles: ["SUPER_ADMIN"],
            redirectTo: "index.html",
        });
        if (!currentAccount) {
            return;
        }

        const response = await apiFetch("/admin/accounts");
        if (response.status === 401) {
            window.location.replace("login.html");
            return;
        }
        if (!response.ok) {
            throw new Error(`Could not load accounts (${response.status})`);
        }

        renderAccounts(await response.json(), currentAccount.account_id);
        accountsTable.hidden = false;
        statusMessage.textContent = "";
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Không thể tải danh sách tài khoản. Vui lòng thử lại.";
    }
}

function renderAccounts(accounts, currentAccountId) {
    accountsList.replaceChildren();

    for (const account of accounts) {
        const row = document.createElement("tr");
        for (const value of [
            account.account_code,
            account.account_name,
            account.account_email
        ]) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        const roleCell = document.createElement("td");
        const roleSelect = document.createElement("select");
        roleSelect.setAttribute(
            "aria-label",
            `Vai trò ${account.account_email}`
        );
        for (const role of roles) {
            const option = document.createElement("option");
            option.value = role;
            option.textContent = role;
            roleSelect.appendChild(option);
        }
        roleSelect.value = account.role;
        roleSelect.disabled = account.account_id === currentAccountId;
        roleCell.appendChild(roleSelect);
        row.appendChild(roleCell);

        const adminStatusCell = document.createElement("td");
        adminStatusCell.textContent = account.admin_active
            ? "Đang hoạt động"
            : "Không hoạt động";
        row.appendChild(adminStatusCell);

        const actionCell = document.createElement("td");
        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.textContent = "Lưu vai trò";
        saveButton.disabled = roleSelect.disabled;
        saveButton.addEventListener("click", () => {
            updateRole(account, roleSelect, saveButton);
        });
        actionCell.appendChild(saveButton);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Xóa";
        deleteButton.disabled = account.account_id === currentAccountId;
        deleteButton.classList.add("secondary");
        deleteButton.addEventListener("click", () => {
            deleteAccount(account, deleteButton);
        });
        actionCell.appendChild(deleteButton);

        row.appendChild(actionCell);
        accountsList.appendChild(row);
    }
}

async function updateRole(account, roleSelect, saveButton) {
    saveButton.disabled = true;
    statusMessage.textContent = "";

    try {
        const response = await apiFetch(
            `/admin/accounts/${account.account_id}/role`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ role: roleSelect.value })
            }
        );
        const data = await readResponse(response);

        if (response.status === 401) {
            window.location.replace("login.html");
            return;
        }
        if (!response.ok) {
            throw new Error(
                data.detail || `Could not update role (${response.status})`
            );
        }

        account.role = data.role;
        account.admin_active = data.admin_active;
        roleSelect.closest("tr").children[4].textContent =
            account.admin_active ? "Đang hoạt động" : "Không hoạt động";
        statusMessage.textContent =
            `Đã cập nhật vai trò cho ${account.account_email}`;
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            error.message || "Không thể cập nhật vai trò";
        roleSelect.value = account.role;
    } finally {
        saveButton.disabled = false;
    }
}

async function deleteAccount(account, deleteButton) {
    const confirmed = window.confirm(
        `Bạn có chắc chắn muốn xóa tài khoản ${account.account_email}?`
    );
    if (!confirmed) {
        return;
    }

    deleteButton.disabled = true;
    statusMessage.textContent = "";

    try {
        const response = await apiFetch(`/admin/accounts/${account.account_id}`, {
            method: "DELETE"
        });
        const data = await readResponse(response);

        if (response.status === 401) {
            window.location.replace("login.html");
            return;
        }
        if (!response.ok) {
            throw new Error(data.detail || `Could not delete account (${response.status})`);
        }

        deleteButton.closest("tr").remove();
        statusMessage.textContent = `Đã xóa tài khoản ${account.account_email}`;
    } catch (error) {
        console.error(error);
        statusMessage.textContent = error.message || "Không thể xóa tài khoản";
        deleteButton.disabled = false;
    }
}

const logoutButton = document.getElementById("logout-button");
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        statusMessage.textContent = "";
        try {
            const response = await apiFetch("/auth/logout", { method: "POST" });
            if (!response.ok) {
                throw new Error(`Không thể đăng xuất (${response.status}).`);
            }
            window.location.replace("login.html");
        } catch (error) {
            console.error(error);
            statusMessage.textContent =
                error instanceof Error ? error.message : "Không thể đăng xuất.";
            logoutButton.disabled = false;
        }
    });
}

loadAccounts();
