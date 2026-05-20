import client from "./client";
export const getFavorites = () => client.get("/favorites");
export const addFavorite = (id) => client.post(`/favorites/${id}`);
export const removeFavorite = (id) => client.delete(`/favorites/${id}`);
