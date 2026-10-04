import db from "@/lib/db";

/**
 * Participant rituals model — data access for standup, retro, reflect, checkin
 */

// Standups
export async function getStandupsByUserAndWeek(userId, weekNum) {
  let sql = "SELECT * FROM v2_standups WHERE user_id = ?";
  const args = [userId];
  if (weekNum) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNum));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

export async function createStandup(userId, userName, weekNumber, year) {
  return db.execute({
    sql: "INSERT INTO v2_standups (user_id, user_name, week_number, year) VALUES (?, ?, ?, ?)",
    args: [userId, userName, weekNumber, year],
  });
}

// Retros
export async function getRetrosByUserAndWeek(userId, weekNum) {
  let sql = "SELECT * FROM v2_retros WHERE user_id = ?";
  const args = [userId];
  if (weekNum) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNum));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

export async function createRetro(userId, userName, weekNumber, year) {
  return db.execute({
    sql: "INSERT INTO v2_retros (user_id, user_name, week_number, year) VALUES (?, ?, ?, ?)",
    args: [userId, userName, weekNumber, year],
  });
}

// Reflections
export async function getReflectionsByUserAndWeek(userId, weekNum) {
  let sql = "SELECT * FROM v2_reflections WHERE user_id = ?";
  const args = [userId];
  if (weekNum) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNum));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

export async function createReflection(userId, userName, content, weekNumber, year) {
  return db.execute({
    sql: "INSERT INTO v2_reflections (user_id, user_name, content, week_number, year) VALUES (?, ?, ?, ?, ?)",
    args: [userId, userName, content, weekNumber, year],
  });
}

// Checkins
export async function getCheckinsByParticipantAndProgram(participantId, programId) {
  let sql = "SELECT * FROM v2_checkins WHERE participant_id = ?";
  const args = [participantId];
  if (programId) {
    sql += " AND program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

export async function createCheckin(participantId, programId, status, notes) {
  return db.execute({
    sql: "INSERT INTO v2_checkins (participant_id, program_id, checkin_date, status, notes) VALUES (?, ?, CURRENT_DATE, ?, ?)",
    args: [participantId, programId, status, notes],
  });
}