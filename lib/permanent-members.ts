// JCC's seven permanent members, by player id — names change, ids don't.
//
// They keep stats access for good (lib/stats-access.ts) and lead the Members
// page as their own group. Client-safe: no database imports.

export const PERMANENT_MEMBER_IDS: ReadonlySet<string> = new Set([
  "0642b6bf-e908-4e1a-bfdd-cbcc94a74f31", // Rudraksh Jhalani
  "77d8c607-4fc9-4f9e-9b64-7a614728e3b1", // Sagar Sharma
  "36627128-46d8-4daf-9414-0995bb2eee28", // Opal Chaudhary (stored as "Opal")
  "2a930e74-265a-43a5-9e37-951637b864d4", // Anil Rawat
  "b889a8b9-ac60-4466-9425-d944df2a436c", // Nitin Setia
  "45d81ab7-1668-40d9-8ce1-30dc0f756817", // Nitesh Jhurani
  "5637e75a-93b8-4af5-a885-66657db19f6b", // Abhijeet Singh Shekhawat
]);
