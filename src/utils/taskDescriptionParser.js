// src/utils/taskDescriptionParser.js
// Shorthand for backdating/seeding a task's timing data by appending
// "###distractionCount,inProgressAt,completedAt" (HH:MM, today's date) to the description.

export const parseTaskShorthand = (rawDescription) => {
  const data = { description: rawDescription };

  const split = rawDescription.split('###');
  if (split[1]) {
    const splitComma = split[1].split(',');
    const distractionCount = parseInt(splitComma[0], 10);
    const today = new Date().toISOString().split('T')[0];
    const inProgressAt = splitComma[1] && new Date(`${today}T${splitComma[1]}`);
    const completedAt = splitComma[2] && new Date(`${today}T${splitComma[2]}`);

    if (distractionCount >= 0) {
      data.distractionCount = distractionCount;
    }
    if (inProgressAt) {
      data.inProgressAt = inProgressAt;
    }
    if (completedAt) {
      data.completedAt = completedAt;
    }
  }

  return data;
};
