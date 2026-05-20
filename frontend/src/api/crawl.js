import client from "./client";
export const crawlSearch = (data) => client.post("/crawl/search", data);
export const crawlLink = (data) => client.post("/crawl/link", data);
