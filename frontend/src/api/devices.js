import client from "./client";
export const listDevices = (params) => client.get("/devices", { params });
export const getDevice = (id) => client.get(`/devices/${id}`);
export const searchDevices = (q) => client.get("/devices/search", { params: { q } });
