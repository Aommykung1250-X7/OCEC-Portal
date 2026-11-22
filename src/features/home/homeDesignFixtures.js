export function createHomeDemoApplications(profile, examCatalog) {
  const samples = [
    { competitionId: "hkiso", status: "confirmed", id: "OCEC-DEMO-01842", school: "OCEC Sample School" },
    { competitionId: "bbb", status: "pending", id: "OCEC-DEMO-01843", school: "Sample Academy" },
  ];

  return samples.flatMap(({ competitionId, status, id, school }) => {
    const exam = examCatalog.find((item) => item.competitionId === competitionId && item.roundType === "HEAT");
    if (!exam) return [];
    return [{
      id,
      status,
      school,
      year: exam.year,
      kind: "Heat",
      exam: exam.title,
      candidate: profile.name,
      contactEmail: profile.email,
      phone: "0800000000",
      owner: "candidate",
      source: "self",
      submitted: exam.openDate,
      competitions: [{ id: competitionId, name: exam.title, roundId: exam.id }],
    }];
  });
}
