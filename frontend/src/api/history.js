import client from "./client";
export const getHistory = (page = 1) => client.get("/history", { params: { page } });
