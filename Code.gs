
const SPREADSHEET_ID = '12qqkiQnDLomOmt5xfY--1bqkdtdGCD7Vrn0txsbnCUc';
const USERS_SHEET = 'users';
const SESSIONS_SHEET = 'sessions';
const LOGS_SHEET = 'logs';
const TEACHER_SIGNUP_SECRET = '950518';
const APP_TIMEZONE = 'Asia/Seoul';

const ACTIVITY_ITEMS = [
  { key: 'drink_water', label: '물마시기', points: 100 },
  { key: 'water_plant', label: '화분에 물주기', points: 100 },
  { key: 'no_leftovers', label: '잔반 안 남기기', points: 100 },
  { key: 'recycle_sort', label: '분리수거 하기', points: 100 },
  { key: 'teacher_adjustment', label: '선생님 조정', points: 0 }
];

function doGet() {
  return jsonResponse({
    ok: true,
    message: 'Student Score API is running.'
  });
}

function doPost(e) {
  try {
    initializeSheets_();

    const params = e.parameter || {};
    const action = String(params.action || '').trim();

    switch (action) {
      case 'registerTeacher':
        return jsonResponse(registerTeacher_(params));
      case 'lookupTeacher':
        return jsonResponse(lookupTeacher_(params));
      case 'registerStudent':
        return jsonResponse(registerStudent_(params));
      case 'login':
        return jsonResponse(login_(params));
      case 'verifySession':
        return jsonResponse(verifySession_(params));
      case 'logout':
        return jsonResponse(logout_(params));
      case 'getStudentDashboard':
        return jsonResponse(getStudentDashboard_(params));
      case 'submitDailyActivities':
        return jsonResponse(submitDailyActivities_(params));
      case 'getTeacherStudents':
        return jsonResponse(getTeacherStudents_(params));
      case 'updateStudentAccount':
        return jsonResponse(updateStudentAccount_(params));
      case 'deleteStudent':
        return jsonResponse(deleteStudent_(params));
      case 'getTeacherScores':
        return jsonResponse(getTeacherScores_(params));
      case 'updateStudentScore':
        return jsonResponse(updateStudentScore_(params));
      case 'deleteLogEntry':
      case 'deleteStudentLog':
      case 'removeLogEntry':
        return jsonResponse(deleteLogEntry_(params));
      case 'getTeacherProfile':
        return jsonResponse(getTeacherProfile_(params));
      case 'updateTeacherProfile':
        return jsonResponse(updateTeacherProfile_(params));
      default:
        return jsonResponse({
          ok: false,
          message: '지원하지 않는 action 입니다.'
        });
    }
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || '서버 오류가 발생했습니다.'
    });
  }
}

function registerTeacher_(params) {
  const adminSecret = String(params.adminSecret || '').trim();
  const schoolName = String(params.schoolName || '').trim();
  const username = String(params.username || '').trim();
  const password = String(params.password || '').trim();

  if (!adminSecret || !schoolName || !username || !password) {
    throw new Error('모든 항목을 입력해주세요.');
  }

  if (adminSecret !== TEACHER_SIGNUP_SECRET) {
    throw new Error('어드민 전용 비밀번호가 올바르지 않습니다.');
  }

  const users = getUsers_();

  if (users.some((user) => user.username === username)) {
    throw new Error('이미 사용 중인 아이디입니다.');
  }

  getUsersSheet_().appendRow([
    Utilities.getUuid(),
    'teacher',
    schoolName,
    '',
    username,
    '',
    '',
    '',
    '선생님',
    username,
    hashPassword_(password),
    0,
    new Date().toISOString(),
    new Date().toISOString()
  ]);

  return {
    ok: true,
    message: '선생님 회원가입이 완료되었습니다.'
  };
}

function lookupTeacher_(params) {
  const teacherUsername = String(params.teacherUsername || '').trim();

  if (!teacherUsername) {
    throw new Error('선생님 아이디를 입력해주세요.');
  }

  const teacher = getUsers_().find((user) => user.role === 'teacher' && user.username === teacherUsername);

  if (!teacher) {
    throw new Error('해당 선생님 아이디를 찾지 못했습니다.');
  }

  return {
    ok: true,
    teacher: {
      username: teacher.username,
      schoolName: teacher.schoolName
    }
  };
}

function registerStudent_(params) {
  const teacherUsername = String(params.teacherUsername || '').trim();
  const grade = String(params.grade || '').trim();
  const classNo = String(params.classNo || '').trim();
  const studentNo = String(params.studentNo || '').trim();
  const name = String(params.name || '').trim();
  const username = String(params.username || '').trim();
  const password = String(params.password || '').trim();

  if (!teacherUsername || !grade || !classNo || !studentNo || !name || !username || !password) {
    throw new Error('모든 항목을 입력해주세요.');
  }

  const users = getUsers_();
  const teacher = users.find((user) => user.role === 'teacher' && user.username === teacherUsername);

  if (!teacher) {
    throw new Error('선생님 정보를 찾지 못했습니다. 선생님 확인을 다시 해주세요.');
  }

  if (users.some((user) => user.username === username)) {
    throw new Error('이미 사용 중인 아이디입니다.');
  }

  getUsersSheet_().appendRow([
    Utilities.getUuid(),
    'student',
    teacher.schoolName,
    teacher.id,
    teacher.username,
    grade,
    classNo,
    studentNo,
    name,
    username,
    hashPassword_(password),
    0,
    new Date().toISOString(),
    new Date().toISOString()
  ]);

  return {
    ok: true,
    message: '학생 회원가입이 완료되었습니다.'
  };
}

function login_(params) {
  const username = String(params.username || '').trim();
  const password = String(params.password || '').trim();

  if (!username || !password) {
    throw new Error('아이디와 비밀번호를 입력해주세요.');
  }

  const passwordHash = hashPassword_(password);
  const user = getUsers_().find((item) => item.username === username && item.passwordHash === passwordHash);

  if (!user) {
    throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  clearExpiredSessions_();

  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  getSessionsSheet_().appendRow([
    token,
    user.id,
    user.role,
    expiresAt,
    new Date().toISOString()
  ]);

  return {
    ok: true,
    token: token,
    user: sanitizeUser_(user)
  };
}

function verifySession_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());
  return {
    ok: true,
    user: sanitizeUser_(sessionInfo.user)
  };
}

function logout_(params) {
  const token = String(params.token || '').trim();
  if (!token) {
    return { ok: true, message: '로그아웃 되었습니다.' };
  }

  const sheet = getSessionsSheet_();
  const values = sheet.getDataRange().getValues();

  for (let row = values.length; row >= 2; row--) {
    if (String(values[row - 1][0]) === token) {
      sheet.deleteRow(row);
    }
  }

  return {
    ok: true,
    message: '로그아웃 되었습니다.'
  };
}

function getStudentDashboard_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());

  if (sessionInfo.user.role !== 'student') {
    throw new Error('학생 계정만 접근할 수 있습니다.');
  }

  const logs = getLogsByStudentId_(sessionInfo.user.id);
  const itemTotals = computeItemTotals_(logs);
  const todayKey = getTodayKey_();
  const todaySubmission = getTodayStudentSubmissionSummary_(logs, todayKey);

  return {
    ok: true,
    user: sanitizeUser_(sessionInfo.user),
    activityItems: getActivityItems_(),
    itemTotals: itemTotals,
    todaySubmission: todaySubmission,
    logs: formatLogsForResponse_(logs).slice(0, 30)
  };
}

function submitDailyActivities_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());

  if (sessionInfo.user.role !== 'student') {
    throw new Error('학생 계정만 접근할 수 있습니다.');
  }

  const selectedKeys = String(params.selectedKeys || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!selectedKeys.length) {
    throw new Error('하나 이상 선택해주세요.');
  }

  const activityMap = getActivityMap_();
  const invalidKeys = selectedKeys.filter((key) => !activityMap[key] || key === 'teacher_adjustment');
  if (invalidKeys.length) {
    throw new Error('유효하지 않은 활동 항목이 포함되어 있습니다.');
  }

  const todayKey = getTodayKey_();
  const existingDailyLogs = getLogs_().filter((log) =>
    log.studentId === sessionInfo.user.id &&
    log.type === 'daily_activity' &&
    log.dateKey === todayKey
  );

  const submittedKeys = existingDailyLogs.map((log) => log.activityKeys);
  const duplicateKeys = selectedKeys.filter((key) => submittedKeys.indexOf(key) !== -1);
  const newKeys = selectedKeys.filter((key) => submittedKeys.indexOf(key) === -1);

  if (!newKeys.length) {
    const labels = duplicateKeys.map((key) => activityMap[key].label).join(', ');
    throw new Error(`오늘 이미 반영한 항목입니다: ${labels}`);
  }

  let totalScore = 0;

  newKeys.forEach((key) => {
    const points = Number(activityMap[key].points || 0);
    totalScore += points;

    appendLog_({
      type: 'daily_activity',
      dateKey: todayKey,
      studentId: sessionInfo.user.id,
      teacherId: sessionInfo.user.parentTeacherId,
      actorUsername: sessionInfo.user.username,
      activityKeys: key,
      deltaScore: points,
      detailsJson: JSON.stringify(buildSingleDetail_(key, points)),
      note: activityMap[key].label
    });
  });

  updateUserScoreByDelta_(sessionInfo.user.id, totalScore);

  const appliedLabels = newKeys.map((key) => activityMap[key].label).join(', ');
  const duplicateLabels = duplicateKeys.map((key) => activityMap[key].label).join(', ');

  return {
    ok: true,
    message: duplicateKeys.length
      ? `이미 반영한 항목은 제외했습니다: ${duplicateLabels} / 새로 반영된 항목: ${appliedLabels} / 총 +${totalScore}점`
      : `반영된 항목: ${appliedLabels} / 총 +${totalScore}점`
  };
}

function getTeacherStudents_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  const students = getUsers_()
    .filter((user) => user.role === 'student' && user.parentTeacherId === sessionInfo.user.id)
    .sort(sortStudents_);

  return {
    ok: true,
    students: students.map(sanitizeUser_)
  };
}

function updateStudentAccount_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());
  const studentId = String(params.studentId || '').trim();

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  if (!studentId) {
    throw new Error('수정할 학생 정보가 없습니다.');
  }

  const grade = String(params.grade || '').trim();
  const classNo = String(params.classNo || '').trim();
  const studentNo = String(params.studentNo || '').trim();
  const name = String(params.name || '').trim();
  const username = String(params.username || '').trim();
  const password = String(params.password || '').trim();

  if (!grade || !classNo || !studentNo || !name || !username) {
    throw new Error('필수 항목을 모두 입력해주세요.');
  }

  const users = getUsers_();
  const target = users.find((user) => user.id === studentId && user.role === 'student');

  if (!target || target.parentTeacherId !== sessionInfo.user.id) {
    throw new Error('수정 권한이 없는 학생 계정입니다.');
  }

  const duplicated = users.find((user) => user.username === username && user.id !== studentId);
  if (duplicated) {
    throw new Error('이미 사용 중인 아이디입니다.');
  }

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();

  for (let row = 2; row <= values.length; row++) {
    if (String(values[row - 1][0]) === studentId) {
      sheet.getRange(row, 6).setValue(grade);
      sheet.getRange(row, 7).setValue(classNo);
      sheet.getRange(row, 8).setValue(studentNo);
      sheet.getRange(row, 9).setValue(name);
      sheet.getRange(row, 10).setValue(username);
      if (password) {
        sheet.getRange(row, 11).setValue(hashPassword_(password));
      }
      sheet.getRange(row, 14).setValue(new Date().toISOString());
      break;
    }
  }

  return {
    ok: true,
    message: '학생 계정이 수정되었습니다.'
  };
}

function deleteStudent_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());
  const studentId = String(params.studentId || '').trim();

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  if (!studentId) {
    throw new Error('삭제할 학생 정보가 없습니다.');
  }

  const usersSheet = getUsersSheet_();
  const values = usersSheet.getDataRange().getValues();
  let deleted = false;

  for (let row = values.length; row >= 2; row--) {
    const currentId = String(values[row - 1][0] || '');
    const role = String(values[row - 1][1] || '');
    const parentTeacherId = String(values[row - 1][3] || '');

    if (currentId === studentId && role === 'student' && parentTeacherId === sessionInfo.user.id) {
      usersSheet.deleteRow(row);
      deleted = true;
      break;
    }
  }

  if (!deleted) {
    throw new Error('삭제 권한이 없는 학생 계정이거나 이미 삭제되었습니다.');
  }

  deleteSessionsByUserId_(studentId);
  deleteLogsByStudentId_(studentId);

  return {
    ok: true,
    message: '학생 계정이 삭제되었습니다.'
  };
}

function getTeacherScores_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  const allLogs = getLogs_();

  const students = getUsers_()
    .filter((user) => user.role === 'student' && user.parentTeacherId === sessionInfo.user.id)
    .map((student) => {
      const studentLogs = allLogs.filter((log) => log.studentId === student.id);
      const itemTotals = computeItemTotals_(studentLogs);
      return Object.assign({}, sanitizeUser_(student), {
        itemTotals: itemTotals,
        logs: formatLogsForResponse_(studentLogs).slice(0, 50)
      });
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || sortStudents_(a, b));

  return {
    ok: true,
    students: students,
    activityItems: getActivityItems_()
  };
}

function updateStudentScore_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());
  const studentId = String(params.studentId || '').trim();
  const mode = String(params.mode || '').trim();

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  if (!studentId || !mode) {
    throw new Error('점수 수정 정보가 부족합니다.');
  }

  const users = getUsers_();
  const target = users.find((user) => user.id === studentId && user.role === 'student');

  if (!target || target.parentTeacherId !== sessionInfo.user.id) {
    throw new Error('점수 수정 권한이 없는 학생입니다.');
  }

  const currentScore = Number(target.score || 0);
  let delta = 0;
  let note = '';

  if (mode === 'set') {
    const nextScore = Number(params.score);
    if (Number.isNaN(nextScore)) {
      throw new Error('올바른 점수를 입력해주세요.');
    }
    delta = nextScore - currentScore;
    note = '선생님 절대값 저장';
  } else if (mode === 'delta') {
    delta = Number(params.delta);
    if (Number.isNaN(delta)) {
      throw new Error('추가 점수가 올바르지 않습니다.');
    }
    note = '선생님 누적 추가';
  } else {
    throw new Error('지원하지 않는 점수 수정 방식입니다.');
  }

  const nextTotal = currentScore + delta;
  if (nextTotal < 0) {
    throw new Error('점수는 0점 미만으로 내려갈 수 없습니다.');
  }

  if (delta === 0) {
    return {
      ok: true,
      message: '변경된 점수가 없습니다.',
      score: currentScore
    };
  }

  appendLog_({
    type: 'teacher_adjustment',
    dateKey: getTodayKey_(),
    studentId: target.id,
    teacherId: sessionInfo.user.id,
    actorUsername: sessionInfo.user.username,
    activityKeys: 'teacher_adjustment',
    deltaScore: delta,
    detailsJson: JSON.stringify(buildSingleDetail_('teacher_adjustment', delta)),
    note: note
  });

  updateUserScoreByDelta_(target.id, delta);

  return {
    ok: true,
    message: '점수가 반영되었습니다.',
    score: nextTotal
  };
}

function deleteLogEntry_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());
  const studentId = String(params.studentId || '').trim();
  const logId = String(params.logId || '').trim();

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  if (!studentId || !logId) {
    throw new Error('삭제할 로그 정보가 부족합니다.');
  }

  const targetStudent = getUsers_().find((user) => user.id === studentId && user.role === 'student');
  if (!targetStudent || targetStudent.parentTeacherId !== sessionInfo.user.id) {
    throw new Error('삭제 권한이 없는 학생 로그입니다.');
  }

  const sheet = getLogsSheet_();
  const values = sheet.getDataRange().getValues();

  let foundRow = 0;
  let deltaScore = 0;

  for (let row = 2; row <= values.length; row++) {
    if (String(values[row - 1][0]) === logId && String(values[row - 1][4]) === studentId) {
      foundRow = row;
      deltaScore = Number(values[row - 1][8] || 0);
      break;
    }
  }

  if (!foundRow) {
    throw new Error('삭제할 로그를 찾지 못했습니다.');
  }

  const currentScore = Number(targetStudent.score || 0);
  const nextScore = currentScore - deltaScore;
  if (nextScore < 0) {
    throw new Error('이 로그를 삭제하면 점수가 0점 미만이 됩니다.');
  }

  updateUserScoreByDelta_(studentId, -deltaScore);
  sheet.deleteRow(foundRow);

  return {
    ok: true,
    message: '로그를 삭제하고 점수를 되돌렸습니다.'
  };
}

function getTeacherProfile_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  return {
    ok: true,
    user: sanitizeUser_(sessionInfo.user)
  };
}

function updateTeacherProfile_(params) {
  const sessionInfo = requireSession_(String(params.token || '').trim());

  if (sessionInfo.user.role !== 'teacher') {
    throw new Error('선생님 계정만 접근할 수 있습니다.');
  }

  const schoolName = String(params.schoolName || '').trim();
  const password = String(params.password || '').trim();

  if (!schoolName) {
    throw new Error('학교명을 입력해주세요.');
  }

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();

  for (let row = 2; row <= values.length; row++) {
    if (String(values[row - 1][0]) === sessionInfo.user.id) {
      sheet.getRange(row, 3).setValue(schoolName);
      if (password) {
        sheet.getRange(row, 11).setValue(hashPassword_(password));
      }
      sheet.getRange(row, 14).setValue(new Date().toISOString());
      break;
    }
  }

  return {
    ok: true,
    message: '선생님 정보가 수정되었습니다.'
  };
}

function requireSession_(token) {
  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  clearExpiredSessions_();

  const session = getSessions_().find((item) => item.token === token);

  if (!session) {
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }

  const user = getUsers_().find((item) => item.id === session.userId);

  if (!user) {
    throw new Error('사용자 정보를 찾지 못했습니다.');
  }

  return { session: session, user: user };
}

function getUsers_() {
  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  return values.slice(1).map((row) => ({
    id: String(row[0] || ''),
    role: String(row[1] || ''),
    schoolName: String(row[2] || ''),
    parentTeacherId: String(row[3] || ''),
    teacherUsername: String(row[4] || ''),
    grade: String(row[5] || ''),
    classNo: String(row[6] || ''),
    studentNo: String(row[7] || ''),
    name: String(row[8] || ''),
    username: String(row[9] || ''),
    passwordHash: String(row[10] || ''),
    score: Number(row[11] || 0),
    createdAt: String(row[12] || ''),
    updatedAt: String(row[13] || '')
  }));
}

function getSessions_() {
  const sheet = getSessionsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  return values.slice(1).map((row) => ({
    token: String(row[0] || ''),
    userId: String(row[1] || ''),
    role: String(row[2] || ''),
    expiresAt: String(row[3] || ''),
    createdAt: String(row[4] || '')
  }));
}

function getLogs_() {
  const sheet = getLogsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  return values.slice(1).map((row) => ({
    id: String(row[0] || ''),
    type: String(row[1] || ''),
    dateKey: String(row[2] || ''),
    submittedAt: String(row[3] || ''),
    studentId: String(row[4] || ''),
    teacherId: String(row[5] || ''),
    actorUsername: String(row[6] || ''),
    activityKeys: String(row[7] || ''),
    deltaScore: Number(row[8] || 0),
    detailsJson: String(row[9] || '{}'),
    note: String(row[10] || '')
  }));
}

function getLogsByStudentId_(studentId) {
  return getLogs_()
    .filter((log) => log.studentId === studentId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

function computeItemTotals_(logs) {
  const totals = {};
  getActivityItems_().forEach((item) => {
    totals[item.key] = 0;
  });

  logs.forEach((log) => {
    const detail = parseJsonSafely_(log.detailsJson, {});
    Object.keys(detail).forEach((key) => {
      totals[key] = Number(totals[key] || 0) + Number(detail[key] || 0);
    });
  });

  return totals;
}

function getTodayStudentSubmissionSummary_(logs, todayKey) {
  const todayLogs = logs.filter((log) => log.type === 'daily_activity' && log.dateKey === todayKey);
  const activityMap = getActivityMap_();

  return {
    submittedKeys: todayLogs.map((log) => log.activityKeys),
    selectedItems: todayLogs.map((log) => ({
      key: log.activityKeys,
      label: activityMap[log.activityKeys] ? activityMap[log.activityKeys].label : log.activityKeys,
      points: Number(log.deltaScore || 0)
    })),
    totalScore: todayLogs.reduce((sum, log) => sum + Number(log.deltaScore || 0), 0),
    dateLabel: formatDateLabelFromKey_(todayKey)
  };
}

function formatLogsForResponse_(logs) {
  const activityMap = getActivityMap_();

  return logs
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .map((log) => {
      let typeLabel = '';
      let contentText = '';

      if (log.type === 'daily_activity') {
        typeLabel = '학생 제출';
        contentText = activityMap[log.activityKeys] ? activityMap[log.activityKeys].label : log.activityKeys;
      } else if (log.type === 'teacher_adjustment') {
        typeLabel = '선생님 조정';
        contentText = log.note || '수동 조정';
      } else {
        typeLabel = log.type;
        contentText = log.note || '-';
      }

      return {
        id: log.id,
        dateLabel: formatDateTimeLabel_(log.submittedAt),
        typeLabel: typeLabel,
        contentText: contentText,
        deltaScore: Number(log.deltaScore || 0)
      };
    });
}

function appendLog_(data) {
  getLogsSheet_().appendRow([
    Utilities.getUuid(),
    data.type || '',
    data.dateKey || '',
    new Date().toISOString(),
    data.studentId || '',
    data.teacherId || '',
    data.actorUsername || '',
    data.activityKeys || '',
    Number(data.deltaScore || 0),
    data.detailsJson || '{}',
    data.note || ''
  ]);
}

function updateUserScoreByDelta_(userId, delta) {
  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();

  for (let row = 2; row <= values.length; row++) {
    if (String(values[row - 1][0]) === userId) {
      const currentScore = Number(values[row - 1][11] || 0);
      const nextScore = currentScore + Number(delta || 0);
      if (nextScore < 0) {
        throw new Error('점수는 0점 미만으로 내려갈 수 없습니다.');
      }
      sheet.getRange(row, 12).setValue(nextScore);
      sheet.getRange(row, 14).setValue(new Date().toISOString());
      break;
    }
  }
}

function deleteLogsByStudentId_(studentId) {
  const sheet = getLogsSheet_();
  const values = sheet.getDataRange().getValues();

  for (let row = values.length; row >= 2; row--) {
    if (String(values[row - 1][4]) === studentId) {
      sheet.deleteRow(row);
    }
  }
}

function buildSingleDetail_(key, points) {
  const obj = {};
  obj[key] = Number(points || 0);
  return obj;
}

function getActivityItems_() {
  return ACTIVITY_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    points: Number(item.points || 0)
  }));
}

function getActivityMap_() {
  const map = {};
  ACTIVITY_ITEMS.forEach((item) => {
    map[item.key] = item;
  });
  return map;
}

function getTodayKey_() {
  return Utilities.formatDate(new Date(), APP_TIMEZONE, 'yyyy-MM-dd');
}

function formatDateLabelFromKey_(dateKey) {
  return String(dateKey || '').replaceAll('-', '.');
}

function formatDateTimeLabel_(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return Utilities.formatDate(date, APP_TIMEZONE, 'yyyy.MM.dd HH:mm');
}

function parseJsonSafely_(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function sanitizeUser_(user) {
  return {
    id: user.id,
    role: user.role,
    schoolName: user.schoolName,
    parentTeacherId: user.parentTeacherId,
    teacherUsername: user.teacherUsername,
    grade: user.grade,
    classNo: user.classNo,
    studentNo: user.studentNo,
    name: user.name,
    username: user.username,
    score: Number(user.score || 0),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function sortStudents_(a, b) {
  return (
    Number(a.grade || 0) - Number(b.grade || 0) ||
    Number(a.classNo || 0) - Number(b.classNo || 0) ||
    Number(a.studentNo || 0) - Number(b.studentNo || 0) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
  );
}

function clearExpiredSessions_() {
  const sheet = getSessionsSheet_();
  const values = sheet.getDataRange().getValues();
  const now = new Date();

  for (let row = values.length; row >= 2; row--) {
    const expiresAt = new Date(values[row - 1][3]);
    if (expiresAt.getTime() < now.getTime()) {
      sheet.deleteRow(row);
    }
  }
}

function deleteSessionsByUserId_(userId) {
  const sheet = getSessionsSheet_();
  const values = sheet.getDataRange().getValues();

  for (let row = values.length; row >= 2; row--) {
    if (String(values[row - 1][1]) === userId) {
      sheet.deleteRow(row);
    }
  }
}

function initializeSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  let usersSheet = ss.getSheetByName(USERS_SHEET);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(USERS_SHEET);
    usersSheet.appendRow([
      'id',
      'role',
      'schoolName',
      'parentTeacherId',
      'teacherUsername',
      'grade',
      'classNo',
      'studentNo',
      'name',
      'username',
      'passwordHash',
      'score',
      'createdAt',
      'updatedAt'
    ]);
  }

  let sessionsSheet = ss.getSheetByName(SESSIONS_SHEET);
  if (!sessionsSheet) {
    sessionsSheet = ss.insertSheet(SESSIONS_SHEET);
    sessionsSheet.appendRow([
      'token',
      'userId',
      'role',
      'expiresAt',
      'createdAt'
    ]);
  }

  let logsSheet = ss.getSheetByName(LOGS_SHEET);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(LOGS_SHEET);
    logsSheet.appendRow([
      'id',
      'type',
      'dateKey',
      'submittedAt',
      'studentId',
      'teacherId',
      'actorUsername',
      'activityKeys',
      'deltaScore',
      'detailsJson',
      'note'
    ]);
  }
}

function getUsersSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET);
}

function getSessionsSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SESSIONS_SHEET);
}

function getLogsSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LOGS_SHEET);
}

function hashPassword_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(bytes);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupProject() {
  initializeSheets_();
}
