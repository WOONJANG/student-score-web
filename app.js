const CONFIG = {
  apiBaseUrl: "https://script.google.com/macros/s/AKfycbzXJHpD39Z_U4UIdZ2XNmGqZSDWP16EGnB5Vwq08Hvt2_0JIaLqUuu3Dy6K_1ZXMIx93Q/exec"
};

const STORAGE_KEY = "studentScoreWebSession";

let teacherScoreStudents = [];
let teacherActivityItems = [];
let teacherSelectedStudent = null;

document.addEventListener("DOMContentLoaded", initPage);

function initPage() {
  const page = document.body.dataset.page;

  bindCommonEvents();

  if (page === "auth") initAuthPage();
  if (page === "student") initStudentPage();
  if (page === "teacher-students") initTeacherStudentsPage();
  if (page === "teacher-scores") initTeacherScoresPage();
  if (page === "teacher-settings") initTeacherSettingsPage();
}

function bindCommonEvents() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

function initAuthPage() {
  const session = getSession();

  document.getElementById("tabLogin").addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tabStudentRegister").addEventListener("click", () => switchAuthTab("student"));
  document.getElementById("tabTeacherRegister").addEventListener("click", () => switchAuthTab("teacher"));

  document.getElementById("loginForm").addEventListener("submit", onLoginSubmit);
  document.getElementById("studentRegisterForm").addEventListener("submit", onStudentRegisterSubmit);
  document.getElementById("teacherRegisterForm").addEventListener("submit", onTeacherRegisterSubmit);
  document.getElementById("teacherLookupBtn").addEventListener("click", lookupTeacher);

  if (session?.token) {
    verifySessionAndRedirect(session.token);
  }
}

function initStudentPage() {
  requireRoleAndRun("student", async (session) => {
    document.getElementById("dailyActivityForm").addEventListener("submit", (event) => onStudentDailySubmit(event, session.token));
    await loadStudentDashboard(session.token);
  });
}

function initTeacherStudentsPage() {
  requireRoleAndRun("teacher", async (session) => {
    document.getElementById("refreshStudentsBtn").addEventListener("click", () => loadTeacherStudents(session.token));
    document.getElementById("studentEditForm").addEventListener("submit", (event) => onStudentEditSubmit(event, session.token));
    document.getElementById("cancelEditBtn").addEventListener("click", resetStudentEditForm);
    await loadTeacherStudents(session.token);
  });
}

function initTeacherScoresPage() {
  requireRoleAndRun("teacher", async (session) => {
    document.getElementById("refreshScoresBtn").addEventListener("click", () => loadTeacherScores(session.token));
    document.getElementById("saveAbsoluteScoreBtn").addEventListener("click", () => saveAbsoluteScore(session.token));
    document.getElementById("saveDeltaScoreBtn").addEventListener("click", () => saveDeltaScore(session.token));
    document.getElementById("cancelScoreEditBtn").addEventListener("click", resetScoreEditForm);
    await loadTeacherScores(session.token);
  });
}

function initTeacherSettingsPage() {
  requireRoleAndRun("teacher", async (session) => {
    document.getElementById("refreshTeacherProfileBtn").addEventListener("click", () => loadTeacherProfile(session.token));
    document.getElementById("teacherProfileForm").addEventListener("submit", (event) => onTeacherProfileSubmit(event, session.token));
    await loadTeacherProfile(session.token);
  });
}

function switchAuthTab(mode) {
  const map = {
    login: { btn: "tabLogin", form: "loginForm" },
    student: { btn: "tabStudentRegister", form: "studentRegisterForm" },
    teacher: { btn: "tabTeacherRegister", form: "teacherRegisterForm" }
  };

  clearMessage();

  Object.values(map).forEach(({ btn, form }) => {
    document.getElementById(btn).classList.remove("active");
    document.getElementById(form).classList.add("hidden");
  });

  document.getElementById(map[mode].btn).classList.add("active");
  document.getElementById(map[mode].form).classList.remove("hidden");
}

async function lookupTeacher() {
  clearMessage();

  const teacherUsername = document.getElementById("studentTeacherUsername").value.trim();
  if (!teacherUsername) {
    showMessage("선생님 아이디를 먼저 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("lookupTeacher", { teacherUsername });
    document.getElementById("studentSchoolName").value = result.teacher.schoolName;
    showMessage("선생님 정보를 확인했습니다.", "success");
  } catch (error) {
    document.getElementById("studentSchoolName").value = "";
    showMessage(error.message, "error");
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  clearMessage();

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!username || !password) {
    showMessage("아이디와 비밀번호를 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("login", { username, password });
    saveSession(result.token, result.user.role);
    redirectByRole(result.user.role);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function onTeacherRegisterSubmit(event) {
  event.preventDefault();
  clearMessage();

  const payload = {
    adminSecret: document.getElementById("teacherAdminSecret").value.trim(),
    schoolName: document.getElementById("teacherSchoolName").value.trim(),
    username: document.getElementById("teacherUsername").value.trim(),
    password: document.getElementById("teacherPassword").value.trim()
  };

  if (Object.values(payload).some((value) => !value)) {
    showMessage("모든 항목을 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("registerTeacher", payload);
    showMessage(result.message || "선생님 회원가입이 완료되었습니다.", "success");
    event.target.reset();
    switchAuthTab("login");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function onStudentRegisterSubmit(event) {
  event.preventDefault();
  clearMessage();

  const payload = {
    teacherUsername: document.getElementById("studentTeacherUsername").value.trim(),
    grade: document.getElementById("studentGrade").value.trim(),
    classNo: document.getElementById("studentClassNo").value.trim(),
    studentNo: document.getElementById("studentNo").value.trim(),
    name: document.getElementById("studentName").value.trim(),
    username: document.getElementById("studentUsername").value.trim(),
    password: document.getElementById("studentPassword").value.trim()
  };

  if (Object.values(payload).some((value) => !value)) {
    showMessage("모든 항목을 입력해주세요.", "error");
    return;
  }

  if (!document.getElementById("studentSchoolName").value.trim()) {
    showMessage("선생님 확인 버튼을 눌러 학교 정보를 먼저 확인해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("registerStudent", payload);
    showMessage(result.message || "학생 회원가입이 완료되었습니다.", "success");
    event.target.reset();
    document.getElementById("studentSchoolName").value = "";
    switchAuthTab("login");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function verifySessionAndRedirect(token) {
  try {
    const result = await apiRequest("verifySession", { token });
    saveSession(token, result.user.role);
    redirectByRole(result.user.role);
  } catch (error) {
    clearSession();
  }
}

function requireRoleAndRun(requiredRole, callback) {
  const session = getSession();

  if (!session?.token) {
    location.href = "./index.html";
    return;
  }

  apiRequest("verifySession", { token: session.token })
    .then((result) => {
      if (result.user.role !== requiredRole) {
        redirectByRole(result.user.role);
        return;
      }
      callback(session);
    })
    .catch(() => {
      clearSession();
      location.href = "./index.html";
    });
}

async function loadStudentDashboard(token) {
  try {
    clearMessage();
    const result = await apiRequest("getStudentDashboard", { token });
    renderStudentDashboard(result.user);
    renderStudentDailyActivity(result.activityItems, result.todaySubmission);
    renderItemSummaryCards("studentItemSummaryCards", result.activityItems, result.itemTotals);
    renderLogsTable("studentLogsTableBody", result.logs);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function onStudentDailySubmit(event, token) {
  event.preventDefault();
  clearMessage();

  const selectedKeys = Array.from(document.querySelectorAll('input[name="dailyActivity"]:checked')).map((input) => input.value);

  if (!selectedKeys.length) {
    showMessage("하나 이상 선택해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("submitDailyActivities", {
      token,
      selectedKeys: selectedKeys.join(",")
    });
    showMessage(result.message || "오늘 활동 점수가 반영되었습니다.", "success");
    await loadStudentDashboard(token);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadTeacherStudents(token) {
  try {
    clearMessage();
    const result = await apiRequest("getTeacherStudents", { token });
    renderTeacherStudentsTable(result.students, token);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadTeacherScores(token) {
  try {
    clearMessage();
    const result = await apiRequest("getTeacherScores", { token });
    teacherScoreStudents = result.students || [];
    teacherActivityItems = result.activityItems || [];
    renderScoreSummary(result.students);
    renderTeacherScoresTable(result.students, result.activityItems, token);
    if (teacherSelectedStudent) {
      const refreshed = teacherScoreStudents.find((student) => student.id === teacherSelectedStudent.id);
      if (refreshed) {
        teacherSelectedStudent = refreshed;
        fillScoreEditForm(refreshed);
      }
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadTeacherProfile(token) {
  try {
    clearMessage();
    const result = await apiRequest("getTeacherProfile", { token });
    renderTeacherProfile(result.user);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function renderTeacherProfile(user) {
  const box = document.getElementById("teacherInfoCards");
  box.innerHTML = [
    { label: "아이디", value: user.username },
    { label: "학교명", value: user.schoolName || "-" },
    { label: "가입일", value: formatDate(user.createdAt) }
  ].map((item) => `
    <div class="info-card">
      <div class="label">${escapeHtml(item.label)}</div>
      <div class="value">${escapeHtml(String(item.value))}</div>
    </div>
  `).join("");

  document.getElementById("teacherProfileUsername").value = user.username || "";
  document.getElementById("teacherProfileSchoolName").value = user.schoolName || "";
  document.getElementById("teacherProfilePassword").value = "";
}

async function onTeacherProfileSubmit(event, token) {
  event.preventDefault();
  clearMessage();

  const payload = {
    token,
    schoolName: document.getElementById("teacherProfileSchoolName").value.trim(),
    password: document.getElementById("teacherProfilePassword").value.trim()
  };

  if (!payload.schoolName) {
    showMessage("학교명을 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("updateTeacherProfile", payload);
    showMessage(result.message || "선생님 정보가 수정되었습니다.", "success");
    await loadTeacherProfile(token);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function renderStudentDashboard(user) {
  const box = document.getElementById("studentInfoCards");
  const scoreValue = document.getElementById("studentScoreValue");

  const items = [
    { label: "학교명", value: user.schoolName || "-" },
    { label: "학년", value: `${user.grade}학년` },
    { label: "반", value: `${user.classNo}반` },
    { label: "번호", value: `${user.studentNo}번` },
    { label: "이름", value: user.name },
    { label: "아이디", value: user.username },
    { label: "담당 선생님", value: user.teacherUsername || "-" }
  ];

  box.innerHTML = items.map((item) => `
    <div class="info-card">
      <div class="label">${escapeHtml(item.label)}</div>
      <div class="value">${escapeHtml(String(item.value))}</div>
    </div>
  `).join("");

  scoreValue.textContent = Number(user.score || 0).toLocaleString();
}

function renderStudentDailyActivity(activityItems, todaySubmission) {
  const box = document.getElementById("dailyActivityOptions");
  const statusBox = document.getElementById("dailyStatusBox");
  const saveBtn = document.getElementById("saveDailyActivityBtn");

  box.innerHTML = activityItems
    .filter((item) => item.key !== "teacher_adjustment")
    .map((item) => `
      <div class="activity-card">
        <label>
          <input type="checkbox" name="dailyActivity" value="${escapeHtml(item.key)}" ${todaySubmission ? "disabled" : ""} />
          <div class="activity-meta">
            <div class="activity-title">${escapeHtml(item.label)}</div>
            <div class="activity-points">+${Number(item.points || 0).toLocaleString()}점</div>
          </div>
        </label>
      </div>
    `)
    .join("");

  if (todaySubmission) {
    const selectedText = (todaySubmission.selectedItems || []).map((item) => `${item.label}(+${item.points}점)`).join(", ");
    statusBox.className = "status-box success";
    statusBox.textContent = `오늘은 이미 제출했습니다. ${todaySubmission.dateLabel} / ${selectedText} / 총 +${Number(todaySubmission.totalScore || 0).toLocaleString()}점`;
    saveBtn.disabled = true;
  } else {
    statusBox.className = "status-box warning";
    statusBox.textContent = "오늘은 아직 제출하지 않았습니다. 활동을 선택하고 저장하세요.";
    saveBtn.disabled = false;
  }
}

function renderItemSummaryCards(targetId, activityItems, itemTotals) {
  const box = document.getElementById(targetId);
  if (!box) return;

  box.innerHTML = activityItems.map((item) => `
    <div class="info-card">
      <div class="label">${escapeHtml(item.label)}</div>
      <div class="value">${Number(itemTotals?.[item.key] || 0).toLocaleString()}점</div>
    </div>
  `).join("");
}

function renderLogsTable(targetId, logs) {
  const tbody = document.getElementById(targetId);
  if (!tbody) return;

  if (!logs || !logs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">기록이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map((log) => `
    <tr>
      <td>${escapeHtml(log.dateLabel || "-")}</td>
      <td>${escapeHtml(log.typeLabel || "-")}</td>
      <td>${escapeHtml(log.contentText || "-")}</td>
      <td>${formatSignedScore(log.deltaScore)}</td>
    </tr>
  `).join("");
}

function renderTeacherStudentsTable(students, token) {
  const tbody = document.getElementById("studentsTableBody");

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">등록된 학생이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map((student) => `
    <tr>
      <td>${escapeHtml(String(student.grade))}</td>
      <td>${escapeHtml(String(student.classNo))}</td>
      <td>${escapeHtml(String(student.studentNo))}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.username)}</td>
      <td>${escapeHtml(student.schoolName || "-")}</td>
      <td><button class="secondary-btn edit-student-btn" type="button" data-student='${escapeAttribute(JSON.stringify(student))}'>수정</button></td>
      <td><button class="danger-btn delete-student-btn" type="button" data-id="${escapeHtml(student.id)}" data-name="${escapeHtml(student.name)}">삭제</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".edit-student-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const student = JSON.parse(button.dataset.student);
      fillStudentEditForm(student);
    });
  });

  tbody.querySelectorAll(".delete-student-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const studentId = button.dataset.id;
      const studentName = button.dataset.name;
      const ok = confirm(`${studentName} 학생 계정을 삭제할까요?`);
      if (!ok) return;

      try {
        const result = await apiRequest("deleteStudent", { token, studentId });
        showMessage(result.message || "학생 계정이 삭제되었습니다.", "success");
        resetStudentEditForm();
        await loadTeacherStudents(token);
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  });
}

function fillStudentEditForm(student) {
  document.getElementById("studentEditForm").classList.remove("hidden");
  document.getElementById("editPlaceholder").classList.add("hidden");

  document.getElementById("editStudentId").value = student.id;
  document.getElementById("editGrade").value = student.grade;
  document.getElementById("editClassNo").value = student.classNo;
  document.getElementById("editStudentNo").value = student.studentNo;
  document.getElementById("editName").value = student.name;
  document.getElementById("editUsername").value = student.username;
  document.getElementById("editPassword").value = "";
}

function resetStudentEditForm() {
  const form = document.getElementById("studentEditForm");
  const placeholder = document.getElementById("editPlaceholder");
  form.reset();
  document.getElementById("editStudentId").value = "";
  form.classList.add("hidden");
  placeholder.classList.remove("hidden");
}

async function onStudentEditSubmit(event, token) {
  event.preventDefault();
  clearMessage();

  const payload = {
    token,
    studentId: document.getElementById("editStudentId").value.trim(),
    grade: document.getElementById("editGrade").value.trim(),
    classNo: document.getElementById("editClassNo").value.trim(),
    studentNo: document.getElementById("editStudentNo").value.trim(),
    name: document.getElementById("editName").value.trim(),
    username: document.getElementById("editUsername").value.trim(),
    password: document.getElementById("editPassword").value.trim()
  };

  if (!payload.studentId || !payload.grade || !payload.classNo || !payload.studentNo || !payload.name || !payload.username) {
    showMessage("수정할 학생 정보를 모두 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("updateStudentAccount", payload);
    showMessage(result.message || "학생 계정이 수정되었습니다.", "success");
    await loadTeacherStudents(token);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function renderScoreSummary(students) {
  const totalStudents = students.length;
  const totalScore = students.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const averageScore = totalStudents ? Math.round(totalScore / totalStudents) : 0;
  const topStudent = students[0] ? `${students[0].name} (${Number(students[0].score || 0).toLocaleString()}점)` : "-";

  const items = [
    { label: "학생 수", value: `${totalStudents}명` },
    { label: "총 점수", value: `${totalScore.toLocaleString()}점` },
    { label: "평균 점수", value: `${averageScore.toLocaleString()}점` },
    { label: "최고 점수", value: topStudent }
  ];

  document.getElementById("summaryCards").innerHTML = items.map((item) => `
    <div class="info-card">
      <div class="label">${escapeHtml(item.label)}</div>
      <div class="value">${escapeHtml(String(item.value))}</div>
    </div>
  `).join("");
}

function renderTeacherScoresTable(students, activityItems, token) {
  const tbody = document.getElementById("scoresTableBody");

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="15" class="empty-row">등록된 학생 점수가 없습니다.</td></tr>';
    return;
  }

  const getItemValue = (student, key) => Number(student.itemTotals?.[key] || 0).toLocaleString();

  tbody.innerHTML = students.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(String(student.grade))}</td>
      <td>${escapeHtml(String(student.classNo))}</td>
      <td>${escapeHtml(String(student.studentNo))}</td>
      <td><button class="small-name-btn open-score-editor-btn" type="button" data-student='${escapeAttribute(JSON.stringify(student))}'>${escapeHtml(student.name)}</button></td>
      <td>${escapeHtml(student.username)}</td>
      <td><span class="badge-score">${Number(student.score || 0).toLocaleString()}점</span></td>
      <td>${getItemValue(student, "drink_water")}점</td>
      <td>${getItemValue(student, "water_plant")}점</td>
      <td>${getItemValue(student, "no_leftovers")}점</td>
      <td>${getItemValue(student, "recycle_sort")}점</td>
      <td>${formatSignedPlain(student.itemTotals?.teacher_adjustment || 0)}점</td>
      <td><button class="small-add-btn quick-score-btn" type="button" data-id="${escapeHtml(student.id)}" data-delta="1">+1</button></td>
      <td><button class="small-add-btn quick-score-btn" type="button" data-id="${escapeHtml(student.id)}" data-delta="5">+5</button></td>
      <td><button class="small-add-btn quick-score-btn" type="button" data-id="${escapeHtml(student.id)}" data-delta="10">+10</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".quick-score-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const studentId = button.dataset.id;
      const delta = button.dataset.delta;
      try {
        await apiRequest("updateStudentScore", { token, studentId, mode: "delta", delta });
        await loadTeacherScores(token);
        showMessage(`점수를 +${delta} 반영했습니다.`, "success");
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  });

  tbody.querySelectorAll(".open-score-editor-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const student = JSON.parse(button.dataset.student);
      teacherSelectedStudent = student;
      fillScoreEditForm(student);
    });
  });
}

function fillScoreEditForm(student) {
  const form = document.getElementById("scoreEditForm");
  const placeholder = document.getElementById("scoreEditPlaceholder");

  teacherSelectedStudent = student;
  form.classList.remove("hidden");
  placeholder.classList.add("hidden");
  document.getElementById("scoreStudentId").value = student.id;
  document.getElementById("scoreStudentName").value = student.name;
  document.getElementById("scoreCurrentValue").value = Number(student.score || 0).toLocaleString();
  document.getElementById("scoreSetValue").value = student.score || 0;
  document.getElementById("scoreDeltaValue").value = "";

  renderItemSummaryCards("teacherSelectedItemSummaryCards", teacherActivityItems, student.itemTotals || {});
  renderLogsTable("teacherLogsTableBody", student.logs || []);
}

function resetScoreEditForm() {
  const form = document.getElementById("scoreEditForm");
  const placeholder = document.getElementById("scoreEditPlaceholder");
  form.reset();
  document.getElementById("scoreStudentId").value = "";
  form.classList.add("hidden");
  placeholder.classList.remove("hidden");
  teacherSelectedStudent = null;
  document.getElementById("teacherSelectedItemSummaryCards").innerHTML = "";
  renderLogsTable("teacherLogsTableBody", []);
}

async function saveAbsoluteScore(token) {
  clearMessage();

  const studentId = document.getElementById("scoreStudentId").value.trim();
  const score = document.getElementById("scoreSetValue").value.trim();

  if (!studentId || score === "") {
    showMessage("저장할 점수를 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("updateStudentScore", { token, studentId, mode: "set", score });
    showMessage(result.message || "점수가 저장되었습니다.", "success");
    await loadTeacherScores(token);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function saveDeltaScore(token) {
  clearMessage();

  const studentId = document.getElementById("scoreStudentId").value.trim();
  const delta = document.getElementById("scoreDeltaValue").value.trim();

  if (!studentId || delta === "") {
    showMessage("추가할 점수를 입력해주세요.", "error");
    return;
  }

  try {
    const result = await apiRequest("updateStudentScore", { token, studentId, mode: "delta", delta });
    showMessage(result.message || "점수가 반영되었습니다.", "success");
    await loadTeacherScores(token);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function logout() {
  const session = getSession();

  if (session?.token) {
    try {
      await apiRequest("logout", { token: session.token });
    } catch (error) {
    }
  }

  clearSession();
  location.href = "./index.html";
}

async function apiRequest(action, payload = {}) {
  if (!CONFIG.apiBaseUrl || CONFIG.apiBaseUrl === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
    throw new Error("app.js의 apiBaseUrl을 Apps Script 웹앱 URL로 바꿔주세요.");
  }

  const formData = new URLSearchParams({ action, ...payload });

  const response = await fetch(CONFIG.apiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: formData.toString()
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("서버 응답을 읽지 못했습니다. Apps Script 배포 URL과 권한 설정을 확인해주세요.");
  }

  if (!data.ok) {
    throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
  }

  return data;
}

function saveSession(token, role) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, role }));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function redirectByRole(role) {
  if (role === "teacher") {
    location.href = "./teacher-students.html";
    return;
  }
  location.href = "./student.html";
}

function showMessage(message, type = "") {
  const box = document.getElementById("messageBox");
  if (!box) return;
  box.textContent = message;
  box.className = `message-box ${type}`.trim();
}

function clearMessage() {
  const box = document.getElementById("messageBox");
  if (!box) return;
  box.textContent = "";
  box.className = "message-box";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatSignedScore(value) {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${num.toLocaleString()}점`;
}

function formatSignedPlain(value) {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${num.toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("'", "&#39;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
